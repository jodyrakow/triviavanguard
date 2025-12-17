// App.js
import React, { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";
import "./App.css";
import "react-h5-audio-player/lib/styles.css";
import Draggable from "react-draggable";
import ShowMode from "./ShowMode";
import ScoringMode from "./ScoringMode";
import ResultsMode from "./ResultsMode";
import Sidebar from "./Sidebar";
import SidebarMenu from "./SidebarMenu";
import AnswerKeyPanel from "./AnswerKeyPanel";
import logo from "./trivia-logo.png";
import {
  ButtonTab,
  ButtonPrimary,
  colors,
  tokens,
  ui,
  Button,
} from "./styles/index.js";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Default state structure for all shows
// NEW STRUCTURE: All scoring data in one bundle (not split by round)
const DEFAULT_SHOW_STATE = {
  teams: [],
  entryOrder: [],
  prizes: "",
  scoringMode: "pub",
  pubPoints: 10,
  poolPerQuestion: 500,
  poolContribution: 10,
  hostInfo: {
    host: "",
    cohost: "",
    location: "",
    totalGames: "",
    startTimesText: "",
    announcements: "",
  },
  tiebreakers: {}, // { [roundId]: tiebreakerQuestion }
  grid: {}, // { [showTeamId]: { [showQuestionId]: { isCorrect, questionBonus, overridePoints, tiebreakerGuess, tiebreakerGuessRaw } } }
};

// 🔐 PASSWORD PROTECTION
const allowedPassword = "tv2025";
const passwordKey = "showPasswordAuthorized";
const isAuthorized = sessionStorage.getItem(passwordKey);
if (!isAuthorized) {
  const enteredPassword = prompt("Enter show password:");
  if (enteredPassword?.toLowerCase() === allowedPassword.toLowerCase()) {
    sessionStorage.setItem(passwordKey, "true");
  } else {
    document.body.innerHTML =
      "<h2 style='font-family:sans-serif;'>Access denied.</h2>";
    throw new Error("Unauthorized access");
  }
}

export default function App() {
  // Core app state
  const [shows, setShows] = useState([]);
  const [selectedShowId, setSelectedShowId] = useState("");
  const [olderShowsOpen, setOlderShowsOpen] = useState(false);
  const [olderShows, setOlderShows] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState(""); // string (e.g. "1")
  const [showDetails, setshowDetails] = useState(true);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [visibleImages, setVisibleImages] = useState({});
  const questionRefs = useRef({});
  const [visibleCategoryImages, setVisibleCategoryImages] = useState({});
  const [activeMode, setActiveMode] = useState("show");
  const [currentImageIndex, setCurrentImageIndex] = useState({});
  const timerRef = useRef(null);
  const [rtStatus, setRtStatus] = useState("INIT"); // ✅ moved inside

  // Bundle (rounds+questions+teams)
  const [showBundle, setShowBundle] = useState(null);
  const [bundleLoading, setBundleLoading] = React.useState(false);
  const [bundleError, setBundleError] = React.useState(null);

  const currentShowIdRef = useRef(selectedShowId);
  useEffect(() => {
    currentShowIdRef.current = selectedShowId;
  }, [selectedShowId]);

  // Scoring cache across mode switches
  const [scoringCache, setScoringCache] = useState({});
  // Restore scoring backup (if any) on app load
  useEffect(() => {
    try {
      const raw = localStorage.getItem("trivia.scoring.backup");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setScoringCache(parsed);
        }
      }
    } catch (err) {
      console.warn("Failed to load scoring backup:", err);
    }
  }, []);

  // Question edits cache: { [showId]: { [showQuestionId]: { question?, flavorText?, answer? } } }
  const [questionEdits, setQuestionEdits] = useState({});
  // Restore question edits backup (if any) on app load
  useEffect(() => {
    try {
      const raw = localStorage.getItem("trivia.questionEdits.backup");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setQuestionEdits(parsed);
        }
      }
    } catch (err) {
      console.warn("Failed to load question edits backup:", err);
    }
  }, []);

  // Timer state
  const [timerPosition, setTimerPosition] = useState({ x: 0, y: 0 });
  const [timerDuration, setTimerDuration] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);

  // Timer hidden by default
  const [showTimer, setShowTimer] = useState(false);

  useEffect(() => {
    localStorage.setItem("tv_showTimer", String(showTimer));
  }, [showTimer]);

  // Display controls state
  const [displayControlsOpen, setDisplayControlsOpen] = useState(false);
  const [displayPreviewOpen, setDisplayPreviewOpen] = useState(false);
  const [displayFontSize, setDisplayFontSize] = useState(100);
  const [customMessages, setCustomMessages] = useState(["", "", ""]);

  // Answer Key state
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  // BroadcastChannel for sending to display window
  const displayChannelRef = useRef(null);
  useEffect(() => {
    if (typeof BroadcastChannel !== "undefined") {
      displayChannelRef.current = new BroadcastChannel("tv:display");
    }
    return () => {
      displayChannelRef.current?.close();
    };
  }, []);

  // Send message to display window
  const sendToDisplay = (type, data) => {
    if (!displayChannelRef.current) return;
    displayChannelRef.current.postMessage({ type, content: data });
  };

  // Global scoring settings
  const [scoringMode, setScoringMode] = useState(
    () => localStorage.getItem("tv_scoringMode") || "pub"
  );
  const [pubPoints, setPubPoints] = useState(
    () => Number(localStorage.getItem("tv_pubPoints")) || 10
  );
  const [poolPerQuestion, setPoolPerQuestion] = useState(
    () => Number(localStorage.getItem("tv_poolPerQuestion")) || 500
  );
  const [poolContribution, setPoolContribution] = useState(
    () => Number(localStorage.getItem("tv_poolContribution")) || 10
  );

  // Persist scoring settings to localStorage, scoringCache, and Supabase
  useEffect(() => {
    localStorage.setItem("tv_scoringMode", scoringMode);
    localStorage.setItem("tv_pubPoints", String(pubPoints));
    localStorage.setItem("tv_poolPerQuestion", String(poolPerQuestion));
    localStorage.setItem("tv_poolContribution", String(poolContribution));

    if (!selectedShowId) return;

    setScoringCache((prev) => {
      const show = prev[selectedShowId] || DEFAULT_SHOW_STATE;

      const nextShow = {
        ...show,
        scoringMode,
        pubPoints,
        poolPerQuestion,
        poolContribution,
      };

      const next = {
        ...prev,
        [selectedShowId]: nextShow,
      };

      // Save to Supabase with round_id="all"
      saveDebounced("all", () => {
        fetch("/.netlify/functions/supaSaveScoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId: selectedShowId,
            roundId: "all",
            payload: {
              teams: nextShow.teams ?? [],
              entryOrder: nextShow.entryOrder ?? [],
              prizes: nextShow.prizes ?? "",
              scoringMode: nextShow.scoringMode ?? "pub",
              pubPoints: nextShow.pubPoints ?? 10,
              poolPerQuestion: nextShow.poolPerQuestion ?? 500,
              poolContribution: nextShow.poolContribution ?? 10,
              hostInfo: nextShow.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo,
              tiebreakers: nextShow.tiebreakers ?? {},
              grid: nextShow.grid ?? {},
            },
          }),
        }).catch(() => {});
      });

      // Broadcast to other hosts
      try {
        window.tvSend?.("scoringSettingsUpdate", {
          showId: selectedShowId,
          scoringMode,
          pubPoints,
          poolPerQuestion,
          poolContribution,
          ts: Date.now(),
        });
      } catch {}

      try {
        localStorage.setItem("trivia.scoring.backup", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [
    scoringMode,
    selectedShowId,
    poolPerQuestion,
    pubPoints,
    poolContribution,
  ]);

  useEffect(() => {
    const savedPosition = localStorage.getItem("timerPosition");
    if (savedPosition) {
      try {
        setTimerPosition(JSON.parse(savedPosition));
      } catch {}
    }

    if (!timerRunning) return;

    if (timeLeft <= 0) {
      setTimeLeft(timerDuration); // reset the clock
      setTimerRunning(false); // stop after reset
      return;
    }

    const t = setTimeout(
      () => setTimeLeft((prev) => Math.max(prev - 1, 0)),
      1000
    );
    return () => clearTimeout(t);
  }, [timerRunning, timeLeft, timerDuration]);

  const handleStartPause = () => setTimerRunning((p) => !p);
  const handleReset = () => {
    setTimerRunning(false);
    setTimeLeft(timerDuration);
  };
  const handleDurationChange = (e) => {
    const newDuration = parseInt(e.target.value);
    setTimerDuration(newDuration);
    setTimeLeft(newDuration);
  };

  useEffect(() => {
    if (!supabase) return;

    const ch = supabase.channel("tv-sanity", {
      config: { broadcast: { ack: true } },
    });

    // queue + ready flag + unified sender
    window._tvReady = false;
    window._tvQueue = [];
    window.tvSend = (event, payload) => {
      if (!window._tvReady) {
        window._tvQueue.push({ event, payload });
        return;
      }
      return ch.send({ type: "broadcast", event, payload });
    };

    // event handlers -> DOM CustomEvents
    ch.on("broadcast", { event: "ping" }, (payload) => {
      console.log("[realtime] ping received:", payload);
    });
    ch.on("broadcast", { event: "mark" }, (msg) => {
      const data = msg?.payload ?? msg;
      window.dispatchEvent(new CustomEvent("tv:mark", { detail: data }));

      // Also update scoringCache so isCorrect persists
      const { showId, roundId, teamId, showQuestionId, nowCorrect } =
        data || {};
      if (!showId || !roundId || !teamId || !showQuestionId) return;

      setScoringCache((prev) => {
        const show = prev[showId] || DEFAULT_SHOW_STATE;
        const byTeam = show.grid?.[teamId] ? { ...show.grid[teamId] } : {};
        const cell = byTeam[showQuestionId] || {
          isCorrect: false,
          questionBonus: 0,
          overridePoints: null,
        };

        byTeam[showQuestionId] = {
          ...cell,
          isCorrect: !!nowCorrect,
        };

        const next = {
          ...prev,
          [showId]: {
            ...show,
            grid: { ...(show.grid || {}), [teamId]: byTeam },
          },
        };

        try {
          localStorage.setItem("trivia.scoring.backup", JSON.stringify(next));
        } catch {}
        return next;
      });
    });
    ch.on("broadcast", { event: "cellEdit" }, (msg) => {
      const data = msg?.payload ?? msg;
      window.dispatchEvent(new CustomEvent("tv:cellEdit", { detail: data }));

      // Also update scoringCache so bonus/override persists
      const {
        showId,
        roundId,
        teamId,
        showQuestionId,
        questionBonus,
        overridePoints,
      } = data || {};
      if (!showId || !roundId || !teamId || !showQuestionId) return;

      setScoringCache((prev) => {
        const show = prev[showId] || DEFAULT_SHOW_STATE;
        const byTeam = show.grid?.[teamId] ? { ...show.grid[teamId] } : {};
        const cell = byTeam[showQuestionId] || {
          isCorrect: false,
          questionBonus: 0,
          overridePoints: null,
        };

        byTeam[showQuestionId] = {
          ...cell,
          questionBonus: Number(questionBonus || 0),
          overridePoints:
            overridePoints === null || overridePoints === undefined
              ? null
              : Number(overridePoints),
        };

        const next = {
          ...prev,
          [showId]: {
            ...show,
            grid: { ...(show.grid || {}), [teamId]: byTeam },
          },
        };

        try {
          localStorage.setItem("trivia.scoring.backup", JSON.stringify(next));
        } catch {}
        return next;
      });
    });
    ch.on("broadcast", { event: "teamBonus" }, (msg) => {
      const data = msg?.payload ?? msg;
      window.dispatchEvent(new CustomEvent("tv:teamBonus", { detail: data }));

      const { showId, teamId, showBonus } = data || {};
      if (!showId || !teamId) return;
      if (showId !== currentShowIdRef.current) return;

      setScoringCache((prev) => {
        const show = prev[showId] || DEFAULT_SHOW_STATE;

        const nextTeams = (show.teams || []).map((t) =>
          t.showTeamId === teamId
            ? { ...t, showBonus: Number(showBonus || 0) }
            : t
        );

        const next = {
          ...prev,
          [showId]: {
            ...show,
            teams: nextTeams,
          },
        };

        try {
          localStorage.setItem("trivia.scoring.backup", JSON.stringify(next));
        } catch {}
        return next;
      });
    });
    // TEAM ADDED
    ch.on("broadcast", { event: "teamAdd" }, (msg) => {
      const data = msg?.payload ?? msg;
      window.dispatchEvent(new CustomEvent("tv:teamAdd", { detail: data }));

      const { showId, teamId, teamName } = data || {};
      if (!showId || !teamId || !teamName) return;
      if (showId !== currentShowIdRef.current) return;

      setScoringCache((prev) => {
        const show = prev[showId] || DEFAULT_SHOW_STATE;

        // skip if already present
        if (show.teams?.some((t) => t.showTeamId === teamId)) return prev;

        const nextTeams = [
          ...(show.teams || []),
          {
            showTeamId: teamId,
            teamName,
            showBonus: 0,
          },
        ];
        const nextEntry = show.entryOrder?.includes(teamId)
          ? show.entryOrder
          : [...(show.entryOrder || []), teamId];

        const next = {
          ...prev,
          [showId]: {
            ...show,
            teams: nextTeams,
            entryOrder: nextEntry,
          },
        };

        try {
          localStorage.setItem("trivia.scoring.backup", JSON.stringify(next));
        } catch {}
        return next;
      });
    });

    ch.on("broadcast", { event: "teamRename" }, (msg) => {
      const data = msg?.payload ?? msg;
      window.dispatchEvent(new CustomEvent("tv:teamRename", { detail: data }));

      const { showId, teamId, teamName } = data || {};
      if (!showId || !teamId || !teamName) return;
      if (showId !== currentShowIdRef.current) return;

      setScoringCache((prev) => {
        const show = prev[showId] || DEFAULT_SHOW_STATE;

        const nextTeams = (show.teams || []).map((t) =>
          t.showTeamId === teamId ? { ...t, teamName } : t
        );

        const next = {
          ...prev,
          [showId]: {
            ...show,
            teams: nextTeams,
          },
        };

        try {
          localStorage.setItem("trivia.scoring.backup", JSON.stringify(next));
        } catch {}
        return next;
      });
    });

    ch.on("broadcast", { event: "teamRemove" }, (msg) => {
      const data = msg?.payload ?? msg;
      window.dispatchEvent(new CustomEvent("tv:teamRemove", { detail: data }));

      const { showId, teamId } = data || {};
      if (!showId || !teamId) return;
      if (showId !== currentShowIdRef.current) return;

      setScoringCache((prev) => {
        const show = prev[showId] || DEFAULT_SHOW_STATE;

        const nextTeams = (show.teams || []).filter(
          (t) => t.showTeamId !== teamId
        );
        const nextEntry = (show.entryOrder || []).filter((id) => id !== teamId);

        const next = {
          ...prev,
          [showId]: {
            ...show,
            teams: nextTeams,
            entryOrder: nextEntry,
          },
        };

        try {
          localStorage.setItem("trivia.scoring.backup", JSON.stringify(next));
        } catch {}
        return next;
      });
    });
    // TIEBREAKER EDIT
    ch.on("broadcast", { event: "tbEdit" }, (msg) => {
      const data = msg?.payload ?? msg;

      // 1) Keep the DOM event for ScoringMode if it's mounted
      window.dispatchEvent(new CustomEvent("tv:tbEdit", { detail: data }));

      // 2) ALSO patch scoringCache so late-joining hosts see the latest guess
      const {
        showId, // string
        roundId, // string
        teamId, // showTeamId
        showQuestionId, // tb question id
        tiebreakerGuessRaw,
        tiebreakerGuess,
      } = data || {};

      if (!showId || !roundId || !teamId || !showQuestionId) return;
      if (showId !== currentShowIdRef.current) return;

      setScoringCache((prev) => {
        const show = prev[showId] || DEFAULT_SHOW_STATE;

        const byTeam = show.grid?.[teamId] ? { ...show.grid[teamId] } : {};
        const cell = byTeam[showQuestionId] || {
          isCorrect: false,
          questionBonus: 0,
          overridePoints: null,
        };

        byTeam[showQuestionId] = {
          ...cell,
          tiebreakerGuessRaw: tiebreakerGuessRaw ?? "",
          tiebreakerGuess:
            tiebreakerGuess === null || tiebreakerGuess === undefined
              ? null
              : Number(tiebreakerGuess),
        };

        const next = {
          ...prev,
          [showId]: {
            ...show,
            grid: { ...(show.grid || {}), [teamId]: byTeam },
          },
        };

        try {
          localStorage.setItem("trivia.scoring.backup", JSON.stringify(next));
        } catch {}
        return next;
      });
    });

    ch.on("broadcast", { event: "prizesUpdate" }, (msg) => {
      const data = msg?.payload ?? msg;
      const showId = data?.showId;
      const val = typeof data?.prizes === "string" ? data.prizes : "";
      if (!showId) return;
      if (showId !== currentShowIdRef.current) return;

      setScoringCache((prev) => {
        const show = prev[showId] || DEFAULT_SHOW_STATE;
        return {
          ...prev,
          [showId]: { ...show, prizes: val },
        };
      });
    });

    ch.on("broadcast", { event: "hostInfoUpdate" }, (msg) => {
      const data = msg?.payload ?? msg;
      const showId = data?.showId;
      const hostInfo = data?.hostInfo;
      if (!showId || !hostInfo) return;
      if (showId !== currentShowIdRef.current) return;

      setScoringCache((prev) => {
        const show = prev[showId] || DEFAULT_SHOW_STATE;
        return {
          ...prev,
          [showId]: { ...show, hostInfo },
        };
      });
    });

    ch.on("broadcast", { event: "scoringSettingsUpdate" }, (msg) => {
      const data = msg?.payload ?? msg;
      const {
        showId,
        scoringMode: mode,
        pubPoints: pub,
        poolPerQuestion: pool,
        poolContribution: contrib,
      } = data || {};
      if (!showId) return;
      if (showId !== currentShowIdRef.current) return;

      // Update local state
      if (mode !== undefined) setScoringMode(mode);
      if (pub !== undefined) setPubPoints(Number(pub));
      if (pool !== undefined) setPoolPerQuestion(Number(pool));
      if (contrib !== undefined) setPoolContribution(Number(contrib));

      // Update cache
      setScoringCache((prev) => {
        const show = prev[showId] || DEFAULT_SHOW_STATE;
        const nextShow = {
          ...show,
          ...(mode !== undefined && { scoringMode: mode }),
          ...(pub !== undefined && { pubPoints: Number(pub) }),
          ...(pool !== undefined && { poolPerQuestion: Number(pool) }),
          ...(contrib !== undefined && { poolContribution: Number(contrib) }),
        };
        return {
          ...prev,
          [showId]: nextShow,
        };
      });
    });

    // QUESTION EDIT
    ch.on("broadcast", { event: "questionEdit" }, (msg) => {
      const data = msg?.payload ?? msg;
      const { showId, showQuestionId, question, flavorText, answer } =
        data || {};
      if (!showId || !showQuestionId) return;
      if (showId !== currentShowIdRef.current) return;

      setQuestionEdits((prev) => {
        const showEdits = prev[showId] || {};
        const questionEdit = showEdits[showQuestionId] || {};

        const updatedEdit = {
          ...questionEdit,
          ...(question !== undefined && { question }),
          ...(flavorText !== undefined && { flavorText }),
          ...(answer !== undefined && { answer }),
        };

        const next = {
          ...prev,
          [showId]: {
            ...showEdits,
            [showQuestionId]: updatedEdit,
          },
        };

        try {
          localStorage.setItem(
            "trivia.questionEdits.backup",
            JSON.stringify(next)
          );
        } catch {}
        return next;
      });
    });

    // TIEBREAKER ADDED
    ch.on("broadcast", { event: "tiebreakerAdded" }, (msg) => {
      const data = msg?.payload ?? msg;
      const { showId, roundId, tiebreakerQuestion } = data || {};
      if (!showId || !roundId || !tiebreakerQuestion) return;
      if (showId !== currentShowIdRef.current) return;

      setShowBundle((prev) => {
        if (!prev) return prev;

        const updatedRounds = prev.rounds.map((r) => {
          if (Number(r.round) === Number(roundId)) {
            // Check if tiebreaker already exists (avoid duplicates)
            const hasTB = (r.questions || []).some(
              (q) =>
                (q.questionType || "").toLowerCase() === "tiebreaker" ||
                String(q.questionOrder).toUpperCase() === "TB"
            );
            if (hasTB) return r; // Already has TB, don't add again

            return {
              ...r,
              questions: [...(r.questions || []), tiebreakerQuestion],
            };
          }
          return r;
        });

        return { ...prev, rounds: updatedRounds };
      });
    });

    // expose helpers (safe via tvSend queue)
    window.sendMark = (payload) => window.tvSend("mark", payload);
    // App.js (right after window.tvSend is defined)
    window.sendTBEdit = (payload) => window.tvSend("tbEdit", payload);
    window.sendCellEdit = (payload) => window.tvSend("cellEdit", payload);
    window.sendTeamBonus = (payload) => window.tvSend("teamBonus", payload);
    window.sendTeamAdd = (payload) => window.tvSend("teamAdd", payload);
    window.sendTeamRename = (payload) => window.tvSend("teamRename", payload);
    window.sendTeamRemove = (payload) => window.tvSend("teamRemove", payload);
    window.sendQuestionEdit = (payload) =>
      window.tvSend("questionEdit", payload);
    window.sendTiebreakerAdded = (payload) =>
      window.tvSend("tiebreakerAdded", payload);

    setRtStatus("SUBSCRIBING");
    ch.subscribe((status) => {
      setRtStatus(status); // "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR"
      if (status === "SUBSCRIBED") {
        console.log("[realtime] joined tv-sanity");
        window._tvReady = true;
        if (window._tvQueue?.length) {
          const q = window._tvQueue.splice(0);
          q.forEach(({ event, payload }) =>
            ch.send({ type: "broadcast", event, payload })
          );
        }
      }
    });

    // single cleanup
    return () => {
      try {
        delete window.sendMark;
        delete window.sendCellEdit;
        delete window.sendTeamBonus;
        delete window.sendTeamAdd;
        delete window.sendTeamRename;
        delete window.sendTeamRemove;
        delete window.tvSend;
        delete window.sendTBEdit;
        delete window.sendQuestionEdit;
      } catch {}
      window._tvReady = false;
      window._tvQueue = [];
      try {
        supabase.removeChannel(ch);
      } catch {}
      setRtStatus("CLOSED");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once; supabase is module-constant

  // Utils
  function numberToLetter(n) {
    return String.fromCharCode(64 + n);
  }

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        try {
          window.tvSend?.("ping", { at: Date.now() });
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Load ALL scoring data for the show (once per show, not per round)
  useEffect(() => {
    if (!selectedShowId) return;

    (async () => {
      try {
        const res = await fetch(
          `/.netlify/functions/supaLoadScoring?showId=${encodeURIComponent(selectedShowId)}`
        );
        const json = await res.json();

        setScoringCache((prev) => {
          const prevShow = prev[selectedShowId] || DEFAULT_SHOW_STATE;
          const loadedData = json.payload ?? prevShow;

          // Only override scoring settings if the show has actual scoring data saved
          const gridHasData =
            loadedData?.grid && Object.keys(loadedData.grid).length > 0;
          const showHasBeenStarted = gridHasData && !!json.payload;

          if (showHasBeenStarted) {
            // Update local scoring state from loaded Supabase data (show in progress)
            if (loadedData.scoringMode) setScoringMode(loadedData.scoringMode);
            if (loadedData.pubPoints !== undefined)
              setPubPoints(Number(loadedData.pubPoints));
            if (loadedData.poolPerQuestion !== undefined)
              setPoolPerQuestion(Number(loadedData.poolPerQuestion));
            if (loadedData.poolContribution !== undefined)
              setPoolContribution(Number(loadedData.poolContribution));
          }
          // Otherwise: Keep Airtable config that was set when the bundle loaded

          return {
            ...prev,
            [selectedShowId]: { ...DEFAULT_SHOW_STATE, ...loadedData },
          };
        });
      } catch (e) {
        console.warn("supaLoadScoring failed", e);
        // falls back to whatever is in local scoringCache/localStorage
      }
    })();
  }, [selectedShowId]); // Load once per show, not per round

  const getClosestQuestionKey = () => {
    const viewportCenter = window.innerHeight / 2;
    let closestKey = null;
    let closestDistance = Infinity;
    for (const [key, ref] of Object.entries(questionRefs.current)) {
      if (ref?.current) {
        const rect = ref.current.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestKey = key;
        }
      }
    }
    return closestKey;
  };

  const saveTimers = useRef({}); // {shared, round}

  const saveDebounced = (key, fn, delay = 350) => {
    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(fn, delay);
  };

  // Fetch shows
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get("/.netlify/functions/fetchShows");
        setShows(res.data?.Shows || []);
      } catch (err) {
        console.error("Error fetching shows:", err);
      }
    })();
  }, []);

  // Function to manually refresh the bundle (for getting fresh URLs)
  const refreshBundle = async () => {
    if (!selectedShowId) return;
    try {
      setBundleLoading(true);
      setBundleError("");
      const res = await axios.get("/.netlify/functions/fetchShowBundle", {
        params: { showId: selectedShowId },
      });
      const bundle = res.data || null;
      setShowBundle(bundle);
      setBundleLoading(false);
    } catch (e) {
      console.error("Error refreshing bundle:", e);
      setBundleError(e.message || String(e));
      setBundleLoading(false);
    }
  };

  // Fetch bundle for selected show
  useEffect(() => {
    if (!selectedShowId) {
      setShowBundle(null);
      setSelectedRoundId("");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setBundleLoading(true);
        setBundleError("");
        const res = await axios.get("/.netlify/functions/fetchShowBundle", {
          params: { showId: selectedShowId },
        });
        if (cancelled) return;

        const bundle = res.data || null;

        // Debug: log first question to check if answer field exists
        if (bundle?.rounds?.[0]?.categories?.[0]?.questions?.[0]) {
          console.log(
            "[App] First question from bundle:",
            bundle.rounds[0].categories[0].questions[0]
          );
        }

        setShowBundle(bundle);

        // Pre-populate settings from Airtable config (if available)
        if (bundle?.config) {
          const config = bundle.config;

          // DEBUG: Log the entire config to see what we're getting
          console.log("[App] Bundle config received:", JSON.stringify(config, null, 2));

          // Only set scoring mode if it's provided and valid
          if (config.scoringMode) {
            console.log("[App] Applying scoring mode from config:", config.scoringMode);
            const mode = config.scoringMode
              .toLowerCase()
              .replace(/\s*\(.*?\)\s*/g, "");
            if (mode === "pub") {
              setScoringMode("pub");
            } else if (mode === "pooled" || mode === "pooledstatic") {
              setScoringMode("pooled");
            } else if (mode === "adaptive" || mode === "pooledadaptive") {
              setScoringMode("pooled-adaptive");
            }
          }

          // Set pub points if provided
          if (typeof config.pubPoints === "number") {
            console.log("[App] Setting pubPoints from config:", config.pubPoints);
            setPubPoints(config.pubPoints);
          } else {
            console.log("[App] pubPoints not a number, got:", typeof config.pubPoints, config.pubPoints);
          }

          // Set pool per question if provided
          if (typeof config.poolPerQuestion === "number") {
            console.log("[App] Setting poolPerQuestion from config:", config.poolPerQuestion);
            setPoolPerQuestion(config.poolPerQuestion);
          } else {
            console.log("[App] poolPerQuestion not a number, got:", typeof config.poolPerQuestion, config.poolPerQuestion);
          }

          // Set pool contribution if provided
          if (typeof config.poolContribution === "number") {
            console.log("[App] Setting poolContribution from config:", config.poolContribution);
            setPoolContribution(config.poolContribution);
          } else {
            console.log("[App] poolContribution not a number, got:", typeof config.poolContribution, config.poolContribution);
          }

          // Set timer default if provided
          if (typeof config.timerDefault === "number") {
            setTimerDuration(config.timerDefault);
            setTimeLeft(config.timerDefault);
          }

          // Pre-populate hostInfo from Airtable (always sync from show config)
          const currentHostInfo =
            composedCachedState?.hostInfo || DEFAULT_SHOW_STATE.hostInfo;
          const updatedHostInfo = { ...currentHostInfo };
          let hasChanges = false;

          // Update if we have a value and it's different (including empty -> filled)
          if (
            config.hostName &&
            (!currentHostInfo.host || config.hostName !== currentHostInfo.host)
          ) {
            updatedHostInfo.host = config.hostName;
            hasChanges = true;
          }
          if (
            config.cohostName &&
            (!currentHostInfo.cohost ||
              config.cohostName !== currentHostInfo.cohost)
          ) {
            updatedHostInfo.cohost = config.cohostName;
            hasChanges = true;
          }
          if (
            config.startTime &&
            (!currentHostInfo.startTimesText ||
              config.startTime !== currentHostInfo.startTimesText)
          ) {
            updatedHostInfo.startTimesText = config.startTime;
            hasChanges = true;
          }

          if (hasChanges) {
            patchShared({ hostInfo: updatedHostInfo });
          }
        }

        // set default round if needed
        const roundNums = (bundle?.rounds || [])
          .map((r) => Number(r.round))
          .filter((n) => Number.isFinite(n));
        const uniqueSorted = Array.from(new Set(roundNums)).sort(
          (a, b) => a - b
        );

        if (!uniqueSorted.length) {
          setSelectedRoundId("");
        } else if (!uniqueSorted.includes(Number(selectedRoundId))) {
          setSelectedRoundId(String(uniqueSorted[0]));
        }
      } catch (e) {
        if (!cancelled) {
          setBundleError("Failed to load show data.");
          console.error(e);
        }
      } finally {
        if (!cancelled) setBundleLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // only depend on selectedShowId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShowId]);

  // Round numbers for dropdown (from bundle)
  const roundNumbers = useMemo(() => {
    const arr = (showBundle?.rounds || [])
      .map((r) => Number(r.round))
      .filter((n) => Number.isFinite(n));
    return Array.from(new Set(arr)).sort((a, b) => a - b);
  }, [showBundle]);

  const patchShared = (patch) => {
    setScoringCache((prev) => {
      const show = prev[selectedShowId] || DEFAULT_SHOW_STATE;

      // merge the change (patch) into the show
      const nextShow = { ...show, ...patch };

      const next = {
        ...prev,
        [selectedShowId]: nextShow,
      };

      // Persist to Supabase with round_id="all" - save COMPLETE state
      saveDebounced("all", () => {
        fetch("/.netlify/functions/supaSaveScoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId: selectedShowId,
            roundId: "all",
            payload: {
              teams: nextShow.teams ?? [],
              entryOrder: nextShow.entryOrder ?? [],
              prizes: nextShow.prizes ?? "",
              scoringMode: nextShow.scoringMode ?? "pub",
              pubPoints: nextShow.pubPoints ?? 10,
              poolPerQuestion: nextShow.poolPerQuestion ?? 500,
              poolContribution: nextShow.poolContribution ?? 10,
              hostInfo: nextShow.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo,
              tiebreakers: nextShow.tiebreakers ?? {},
              grid: nextShow.grid ?? {},
            },
          }),
        }).catch(() => {});
      });

      // Realtime broadcast so other hosts update instantly
      try {
        // Broadcast prizes if they changed
        if (patch.prizes !== undefined) {
          window.tvSend?.("prizesUpdate", {
            showId: selectedShowId,
            prizes: nextShow.prizes ?? "",
            ts: Date.now(),
          });
        }
        // Broadcast hostInfo if it changed
        if (patch.hostInfo !== undefined) {
          window.tvSend?.("hostInfoUpdate", {
            showId: selectedShowId,
            hostInfo: nextShow.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo,
            ts: Date.now(),
          });
        }
      } catch {}

      // optional local backup
      try {
        localStorage.setItem("trivia.scoring.backup", JSON.stringify(next));
      } catch {}

      return next;
    });
  };

  // 🔸 Compose a single cachedState shape shared by all modes
  const composedCachedState = (() => {
    const show = scoringCache[selectedShowId] ?? null;
    if (!show) return null;
    return {
      teams: show.teams ?? [],
      entryOrder: show.entryOrder ?? [],
      grid: show.grid ?? {},
      prizes: show.prizes ?? "",
      hostInfo: show.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo,
    };
  })();

  // 🔸 Merge question edits into showBundle for display
  const showBundleWithEdits = useMemo(() => {
    if (!showBundle) return null;
    const edits = questionEdits[selectedShowId];
    const show = scoringCache[selectedShowId];
    const tiebreakers = show?.tiebreakers || {};

    // Deep clone and apply edits + tiebreakers
    const updatedBundle = {
      ...showBundle,
      rounds: (showBundle.rounds || []).map((round) => {
        const roundNum = String(round.round);
        const tb = tiebreakers[roundNum];

        // Apply question edits to questions in CATEGORIES (the main questions)
        const categories = (round.categories || []).map((cat) => ({
          ...cat,
          questions: (cat.questions || []).map((q) => {
            const edit = edits?.[q.showQuestionId];
            if (!edit) return q;

            return {
              ...q,
              ...(edit.question !== undefined && { questionText: edit.question }),
              ...(edit.flavorText !== undefined && {
                flavorText: edit.flavorText,
              }),
              ...(edit.answer !== undefined && { answer: edit.answer }),
              _edited: true, // flag for UI to show indicator
            };
          }),
        }));

        // Apply question edits to flat questions array (host-added tiebreakers)
        let questions = (round.questions || []).map((q) => {
          const edit = edits?.[q.showQuestionId || q.id];
          if (!edit) return q;

          return {
            ...q,
            ...(edit.question !== undefined && { questionText: edit.question }),
            ...(edit.flavorText !== undefined && {
              flavorText: edit.flavorText,
            }),
            ...(edit.answer !== undefined && { answer: edit.answer }),
            _edited: true, // flag for UI to show indicator
          };
        });

        // Add tiebreaker if one exists for this round (and not already added)
        if (tb) {
          const hasTB = questions.some(
            (q) =>
              (q.questionType || "").toLowerCase() === "tiebreaker" ||
              String(q.questionOrder).toUpperCase() === "TB"
          );
          if (!hasTB) {
            questions = [...questions, tb];
          }
        }

        return { ...round, categories, questions };
      }),
    };

    return updatedBundle;
  }, [showBundle, questionEdits, selectedShowId, scoringCache]);

  // Helper function to edit a question field
  const editQuestionField = (showQuestionId, field, value) => {
    setQuestionEdits((prev) => {
      const showEdits = prev[selectedShowId] || {};
      const questionEdit = showEdits[showQuestionId] || {};

      const updatedEdit = {
        ...questionEdit,
        [field]: value,
      };

      const next = {
        ...prev,
        [selectedShowId]: {
          ...showEdits,
          [showQuestionId]: updatedEdit,
        },
      };

      try {
        localStorage.setItem(
          "trivia.questionEdits.backup",
          JSON.stringify(next)
        );
      } catch {}

      // Broadcast to other hosts
      try {
        window.sendQuestionEdit?.({
          showId: selectedShowId,
          showQuestionId,
          [field]: value,
        });
      } catch {}

      return next;
    });
  };

  // Helper function to add a tiebreaker question
  const addTiebreaker = (questionText, answer) => {
    if (!showBundle || !selectedRoundId) return;

    const tiebreakerQuestion = {
      id: `tb-${Date.now()}`,
      questionId: [`tb-${Date.now()}`],
      questionOrder: "TB",
      questionText,
      flavorText: "",
      answer,
      questionType: "Tiebreaker",
      sortOrder: 9999, // Put it at the end
      categoryName: "Tiebreaker",
      categoryDescription: "",
      categoryOrder: 9999,
      categoryImages: [],
      categoryAudio: [],
      questionImages: [],
      questionAudio: [],
      pointsPerQuestion: null,
      _edited: false,
      _addedByHost: true, // Flag to indicate it was added during the show
    };

    setShowBundle((prev) => {
      if (!prev) return prev;

      const updatedRounds = prev.rounds.map((r) => {
        if (Number(r.round) === Number(selectedRoundId)) {
          // Check if tiebreaker already exists
          const hasTB = (r.questions || []).some(
            (q) =>
              (q.questionType || "").toLowerCase() === "tiebreaker" ||
              String(q.questionOrder).toUpperCase() === "TB"
          );
          if (hasTB) {
            alert("This round already has a tiebreaker.");
            return r;
          }
          return {
            ...r,
            questions: [...(r.questions || []), tiebreakerQuestion],
          };
        }
        return r;
      });

      return { ...prev, rounds: updatedRounds };
    });

    // Save to Supabase
    setScoringCache((prev) => {
      const show = prev[selectedShowId] || DEFAULT_SHOW_STATE;
      const tiebreakers = show.tiebreakers || {};

      const nextShow = {
        ...show,
        tiebreakers: {
          ...tiebreakers,
          [selectedRoundId]: tiebreakerQuestion,
        },
      };

      const next = {
        ...prev,
        [selectedShowId]: nextShow,
      };

      // Save to Supabase with round_id="all"
      saveDebounced("all", () => {
        fetch("/.netlify/functions/supaSaveScoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId: selectedShowId,
            roundId: "all",
            payload: {
              teams: nextShow.teams ?? [],
              entryOrder: nextShow.entryOrder ?? [],
              prizes: nextShow.prizes ?? "",
              scoringMode: nextShow.scoringMode ?? "pub",
              pubPoints: nextShow.pubPoints ?? 10,
              poolPerQuestion: nextShow.poolPerQuestion ?? 500,
              poolContribution: nextShow.poolContribution ?? 10,
              hostInfo: nextShow.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo,
              tiebreakers: nextShow.tiebreakers ?? {},
              grid: nextShow.grid ?? {},
            },
          }),
        }).catch(() => {});
      });

      return next;
    });

    // Broadcast to other hosts
    try {
      window.sendTiebreakerAdded?.({
        showId: selectedShowId,
        roundId: selectedRoundId,
        tiebreaker: tiebreakerQuestion,
      });
    } catch {}
  };

  // UI
  return (
    <>
      {/* Sidebar with menu */}
      <Sidebar
        setShowDetails={setshowDetails}
        setDisplayControlsOpen={setDisplayControlsOpen}
        showTimer={showTimer}
        setShowTimer={setShowTimer}
      >
        <SidebarMenu
          showBundle={showBundleWithEdits || { rounds: [], teams: [] }}
          showTimer={showTimer}
          setShowTimer={setShowTimer}
          showDetails={showDetails}
          setShowDetails={setshowDetails}
          timerDuration={timerDuration}
          setTimerDuration={setTimerDuration}
          setScriptOpen={setScriptOpen}
          hostInfo={
            composedCachedState?.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo
          }
          setHostInfo={(val) => patchShared({ hostInfo: val })}
          displayControlsOpen={displayControlsOpen}
          setDisplayControlsOpen={setDisplayControlsOpen}
          setShowAnswerKey={setShowAnswerKey}
          refreshBundle={refreshBundle}
          scoringMode={scoringMode}
          setScoringMode={setScoringMode}
          pubPoints={pubPoints}
          setPubPoints={setPubPoints}
          poolPerQuestion={poolPerQuestion}
          setPoolPerQuestion={setPoolPerQuestion}
          poolContribution={poolContribution}
          setPoolContribution={setPoolContribution}
        />
      </Sidebar>

      {/* Fixed header bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "80px",
          backgroundColor: "#fff",
          borderBottom: "2px solid " + colors.accent,
          zIndex: 998,
          display: "flex",
          alignItems: "center",
          padding: "0 2rem",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <img src={logo} alt="TriviaVanguard" style={{ height: "68px" }} />
      </div>

      {/* Display Controls Panel (app-level, available in all modes) */}
      {displayControlsOpen && (
        <div
          style={{
            position: "fixed",
            right: "1rem",
            top: "1rem",
            zIndex: 1000,
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            gap: ".5rem",
            maxWidth: "200px",
            backgroundColor: "#fff",
            padding: "1rem",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            border: `2px solid ${colors.accent}`,
          }}
        >
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
              color: colors.dark,
            }}
          >
            Display Controls
          </div>

          <ButtonPrimary
            onClick={() => {
              const newWindow = window.open(
                window.location.origin + "?display",
                "displayMode",
                "width=1920,height=1080,location=no,toolbar=no,menubar=no,status=no"
              );
              if (newWindow) {
                newWindow.focus();
              }
            }}
            title="Open Display Mode in new window"
            style={{ fontSize: "0.9rem", padding: "0.5rem 0.75rem" }}
          >
            Open Display
          </ButtonPrimary>

          <ButtonPrimary
            onClick={() => setDisplayPreviewOpen((v) => !v)}
            title="Toggle preview of what's showing on display"
            style={{ fontSize: "0.9rem", padding: "0.5rem 0.75rem" }}
          >
            {displayPreviewOpen ? "Hide Preview" : "Show Preview"}
          </ButtonPrimary>

          <Button
            onClick={() => {
              sendToDisplay("standby", null);
            }}
            title="Clear the display (standby screen)"
            style={{ fontSize: "0.9rem", padding: "0.5rem 0.75rem" }}
          >
            Clear Display
          </Button>

          <Button
            onClick={() => {
              sendToDisplay("closeImageOverlay", null);
            }}
            title="Close any image overlay on the display"
            style={{ fontSize: "0.9rem", padding: "0.5rem 0.75rem" }}
          >
            Close Image
          </Button>

          {/* Font size controls */}
          <div
            style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}
          >
            <Button
              onClick={() => {
                const newSize = Math.max(50, displayFontSize - 10);
                setDisplayFontSize(newSize);
                sendToDisplay("fontSize", { size: newSize });
              }}
              title="Decrease display text size"
              style={{ fontSize: "0.9rem", padding: "0.5rem 0.5rem", flex: 1 }}
            >
              A-
            </Button>
            <Button
              onClick={() => {
                const newSize = Math.min(400, displayFontSize + 10);
                setDisplayFontSize(newSize);
                sendToDisplay("fontSize", { size: newSize });
              }}
              title="Increase display text size"
              style={{ fontSize: "0.9rem", padding: "0.5rem 0.5rem", flex: 1 }}
            >
              A+
            </Button>
          </div>

          {/* Custom messages */}
          <div style={{ marginTop: "0.5rem" }}>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
                color: colors.dark,
              }}
            >
              Custom Messages:
            </div>
            {customMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: "0.25rem",
                  display: "flex",
                  gap: "0.25rem",
                }}
              >
                <input
                  type="text"
                  value={msg}
                  onChange={(e) => {
                    const newMessages = [...customMessages];
                    newMessages[idx] = e.target.value;
                    setCustomMessages(newMessages);
                  }}
                  placeholder={`Message ${idx + 1}`}
                  style={{
                    flex: 1,
                    fontSize: "0.8rem",
                    padding: "0.3rem",
                    border: `1px solid ${colors.gray?.border || "#ccc"}`,
                    borderRadius: "4px",
                  }}
                />
                <Button
                  onClick={() => {
                    if (msg.trim()) {
                      sendToDisplay("message", { text: msg });
                    }
                  }}
                  disabled={!msg.trim()}
                  title="Push this message to display"
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.3rem 0.5rem",
                    opacity: msg.trim() ? 1 : 0.5,
                  }}
                >
                  📺
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Display Preview Panel */}
      {displayPreviewOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "1rem",
            right: "1rem",
            width: "400px",
            height: "225px",
            backgroundColor: "#000",
            border: `3px solid ${colors.accent}`,
            borderRadius: "8px",
            zIndex: 2000,
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              backgroundColor: colors.accent,
              color: "#fff",
              padding: "0.5rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Display Preview (16:9)</span>
            <button
              onClick={() => setDisplayPreviewOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: "1.2rem",
                cursor: "pointer",
                padding: "0 0.5rem",
              }}
            >
              ×
            </button>
          </div>
          <iframe
            src={window.location.origin + "?display"}
            title="Display Preview"
            style={{
              width: "100%",
              height: "calc(100% - 35px)",
              border: "none",
              backgroundColor: "#000",
            }}
          />
        </div>
      )}

      {/* Answer Key Modal (app-level) */}
      {showAnswerKey && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setShowAnswerKey(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "600px",
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <AnswerKeyPanel
              showBundle={showBundleWithEdits || { rounds: [], teams: [] }}
              onClose={() => setShowAnswerKey(false)}
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div
        style={{
          fontFamily: tokens.font.display,
          padding: `${tokens.spacing.md} ${tokens.spacing.xl} ${tokens.spacing.xl} ${tokens.spacing.xl}`,
          backgroundColor: colors.bg,
          marginTop: "80px", // Offset for fixed header
          marginLeft: "50px", // Offset for sidebar
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "left",
            gap: tokens.spacing.sm,
            marginBottom: tokens.spacing.sm,
          }}
        >
          <ButtonTab
            active={activeMode === "show"}
            onClick={() => setActiveMode("show")}
          >
            Questions & answers
          </ButtonTab>

          <ButtonTab
            active={activeMode === "score"}
            onClick={() => setActiveMode("score")}
          >
            Scores
          </ButtonTab>

          <ButtonTab
            active={activeMode === "results"}
            onClick={() => setActiveMode("results")}
          >
            Results
          </ButtonTab>
        </div>
        <div
          style={{
            fontSize: ".9rem",
            opacity: 0.85,
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            marginLeft: "0.25rem",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor:
                rtStatus === "SUBSCRIBED"
                  ? "#22c55e"
                  : rtStatus === "SUBSCRIBING"
                    ? "#eab308"
                    : "#ef4444",
            }}
          />
          Multi-host sync:{" "}
          <strong>
            {rtStatus === "SUBSCRIBED"
              ? "Active"
              : rtStatus === "SUBSCRIBING"
                ? "Connecting..."
                : "Offline"}
          </strong>
        </div>

        <div>
          <label
            style={{
              fontSize: "1.25rem",
              color: colors.dark,
              marginRight: tokens.spacing.md,
            }}
          >
            Select Show:
            <select
              value={selectedShowId}
              onChange={(e) => {
                const newId = e.target.value;

                // Special case: "View older shows" option
                if (newId === "__OLDER__") {
                  setOlderShowsOpen(true);
                  return;
                }

                if (!selectedShowId || selectedShowId === newId) {
                  setSelectedShowId(newId);
                  setSelectedRoundId("");
                  return;
                }

                const ok = window.confirm(
                  "Switch shows? This will delete all scores and data you've entered for the current show."
                );
                if (!ok) return;

                // Clear cache for the OLD show to prevent data leakage
                const oldShowId = selectedShowId;
                setScoringCache((prev) => {
                  const next = { ...prev };
                  // Remove the old show's data completely
                  delete next[oldShowId];
                  // Update localStorage immediately
                  localStorage.setItem(
                    "trivia.scoring.backup",
                    JSON.stringify(next)
                  );
                  return next;
                });

                // Clear in-memory, per-show UI bits
                setSelectedRoundId("");
                setVisibleImages({});
                setVisibleCategoryImages({});
                setCurrentImageIndex({});

                setSelectedShowId(newId);
              }}
              style={{
                fontSize: "1.25rem",
                fontFamily: tokens.font.body,
                marginLeft: tokens.spacing.sm,
                verticalAlign: "middle",
              }}
            >
              <option value="">-- Select a Show --</option>
              {shows.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                  style={{ fontFamily: tokens.font.body }}
                >
                  {s.Show?.Show}
                </option>
              ))}
              <option
                value="__OLDER__"
                style={{ fontFamily: tokens.font.body, fontStyle: "italic" }}
              >
                📚 View older shows...
              </option>
            </select>
          </label>
        </div>

        {roundNumbers.length > 1 && (
          <div>
            <label
              style={{
                fontSize: "1.25rem",
                color: colors.dark,
                marginRight: tokens.spacing.md,
              }}
            >
              Select Round:
              <select
                value={selectedRoundId}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                style={{
                  fontSize: "1.25rem",
                  fontFamily: tokens.font.body,
                  marginLeft: tokens.spacing.sm,
                  verticalAlign: "middle",
                }}
              >
                {roundNumbers.map((n) => (
                  <option key={n} value={String(n)}>
                    {`Round ${n}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {bundleLoading && (
          <div style={{ padding: tokens.spacing.md }}>Loading show…</div>
        )}
        {bundleError && (
          <div style={{ padding: tokens.spacing.md, color: colors.error }}>
            Error loading show: {String(bundleError)}
          </div>
        )}

        {activeMode === "show" && (
          <ShowMode
            showBundle={showBundleWithEdits || { rounds: [], teams: [] }}
            selectedRoundId={selectedRoundId}
            showDetails={showDetails}
            setshowDetails={setshowDetails}
            questionRefs={questionRefs}
            visibleImages={visibleImages}
            setVisibleImages={setVisibleImages}
            currentImageIndex={currentImageIndex}
            setCurrentImageIndex={setCurrentImageIndex}
            visibleCategoryImages={visibleCategoryImages}
            setVisibleCategoryImages={setVisibleCategoryImages}
            getClosestQuestionKey={getClosestQuestionKey}
            numberToLetter={numberToLetter}
            scoringMode={scoringMode}
            pubPoints={pubPoints}
            poolPerQuestion={poolPerQuestion}
            poolContribution={poolContribution}
            prizes={composedCachedState?.prizes ?? ""}
            cachedState={composedCachedState}
            hostInfo={
              composedCachedState?.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo
            }
            setPrizes={(val) => patchShared({ prizes: String(val || "") })}
            setHostInfo={(val) => patchShared({ hostInfo: val })}
            editQuestionField={editQuestionField}
            addTiebreaker={addTiebreaker}
            scriptOpen={scriptOpen}
            setScriptOpen={setScriptOpen}
            sendToDisplay={sendToDisplay}
            refreshBundle={refreshBundle}
          />
        )}

        {activeMode === "score" && (
          <ScoringMode
            showBundle={
              showBundle
                ? {
                    ...showBundle,
                    rounds: (showBundle.rounds || []).filter(
                      (r) => Number(r.round) === Number(selectedRoundId)
                    ),
                  }
                : { rounds: [], teams: [] }
            }
            selectedShowId={selectedShowId}
            selectedRoundId={selectedRoundId}
            preloadedTeams={showBundle?.teams ?? []}
            cachedState={composedCachedState}
            onChangeState={(payload) => {
              setScoringCache((prev) => {
                const { teams = [], entryOrder = [], grid = {} } = payload;
                const prevShow = prev[selectedShowId] || DEFAULT_SHOW_STATE;

                const nextShow = {
                  ...prevShow,
                  teams,
                  entryOrder,
                  grid,
                };

                const next = {
                  ...prev,
                  [selectedShowId]: nextShow,
                };

                // Persist to Supabase with round_id="all" - save COMPLETE show state
                saveDebounced("all", () => {
                  fetch("/.netlify/functions/supaSaveScoring", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      showId: selectedShowId,
                      roundId: "all",
                      payload: {
                        teams: nextShow.teams ?? [],
                        entryOrder: nextShow.entryOrder ?? [],
                        prizes: nextShow.prizes ?? "",
                        scoringMode: nextShow.scoringMode ?? "pub",
                        pubPoints: nextShow.pubPoints ?? 10,
                        poolPerQuestion: nextShow.poolPerQuestion ?? 500,
                        poolContribution: nextShow.poolContribution ?? 10,
                        hostInfo:
                          nextShow.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo,
                        tiebreakers: nextShow.tiebreakers ?? {},
                        grid: nextShow.grid ?? {},
                      },
                    }),
                  }).catch(() => {});
                });

                // keep your localStorage backup
                try {
                  localStorage.setItem(
                    "trivia.scoring.backup",
                    JSON.stringify(next)
                  );
                } catch {}

                return next;
              });
            }}
            scoringMode={scoringMode}
            setScoringMode={setScoringMode}
            pubPoints={pubPoints}
            setPubPoints={setPubPoints}
            poolPerQuestion={poolPerQuestion}
            setPoolPerQuestion={setPoolPerQuestion}
            poolContribution={poolContribution}
            setPoolContribution={setPoolContribution}
          />
        )}

        {activeMode === "results" && (
          <ResultsMode
            showBundle={showBundleWithEdits || { rounds: [], teams: [] }}
            selectedShowId={selectedShowId}
            selectedRoundId={selectedRoundId}
            cachedState={composedCachedState}
            cachedByRound={scoringCache[selectedShowId] ?? {}}
            scoringMode={scoringMode}
            setScoringMode={setScoringMode}
            pubPoints={pubPoints}
            setPubPoints={setPubPoints}
            poolPerQuestion={poolPerQuestion}
            setPoolPerQuestion={setPoolPerQuestion}
            poolContribution={poolContribution}
            prizes={composedCachedState?.prizes ?? ""}
            setPrizes={(val) => patchShared({ prizes: String(val || "") })}
            questionEdits={questionEdits[selectedShowId] ?? {}}
            sendToDisplay={sendToDisplay}
          />
        )}

        <ButtonPrimary
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ margin: `${tokens.spacing.xl} auto`, display: "block" }}
        >
          ↑ Back to Top
        </ButtonPrimary>

        {/* Older Shows Modal */}
        <ui.Modal
          isOpen={olderShowsOpen}
          onClose={() => setOlderShowsOpen(false)}
          title="Browse Older Shows"
          subtitle="Select a show from the past 50 shows"
          style={{ width: "min(92vw, 600px)", maxHeight: "80vh" }}
        >
          {olderShows.length === 0 ? (
            <div style={{ textAlign: "center", padding: tokens.spacing.md }}>
              <Button
                onClick={async () => {
                  try {
                    const res = await axios.get(
                      "/.netlify/functions/fetchOlderShows"
                    );
                    setOlderShows(res.data?.Shows || []);
                  } catch (err) {
                    console.error("Error fetching older shows:", err);
                    alert("Failed to load older shows");
                  }
                }}
              >
                Load Older Shows
              </Button>
            </div>
          ) : (
            <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
              {olderShows.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    const ok = selectedShowId
                      ? window.confirm(
                          "Switch to this show? This will delete all scores and data you've entered for the current show."
                        )
                      : true;
                    if (!ok) return;

                    // Clear cache for the OLD show to prevent data leakage
                    if (selectedShowId) {
                      const oldShowId = selectedShowId;
                      setScoringCache((prev) => {
                        const next = { ...prev };
                        // Remove the old show's data completely
                        delete next[oldShowId];
                        // Update localStorage immediately
                        localStorage.setItem(
                          "trivia.scoring.backup",
                          JSON.stringify(next)
                        );
                        return next;
                      });
                    }

                    setSelectedShowId(s.id);
                    setSelectedRoundId("");
                    setVisibleImages({});
                    setVisibleCategoryImages({});
                    setCurrentImageIndex({});
                    setOlderShowsOpen(false);
                  }}
                  style={{
                    padding: tokens.spacing.sm,
                    borderBottom: `${tokens.borders.thin} ${colors.gray.borderLight}`,
                    cursor: "pointer",
                    fontFamily: tokens.font.body,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      colors.gray.bgLightest)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = colors.white)
                  }
                >
                  <strong>{s.Show?.Show}</strong>
                  {s.Show?.Date && (
                    <div style={{ fontSize: ".9rem", opacity: 0.7 }}>
                      {new Date(s.Show.Date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: tokens.spacing.sm,
              justifyContent: "flex-end",
              padding: `${tokens.spacing.sm} 0`,
              borderTop: `${tokens.borders.thin} ${colors.gray.borderLighter}`,
              marginTop: tokens.spacing.sm,
            }}
          >
            <Button onClick={() => setOlderShowsOpen(false)}>Close</Button>
          </div>
        </ui.Modal>

        {/* Countdown Timer - Always available across all modes */}
        {showTimer && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 999,
            }}
          >
            <Draggable
              nodeRef={timerRef}
              defaultPosition={timerPosition}
              onStop={(e, data) => {
                const newPos = { x: data.x, y: data.y };
                setTimerPosition(newPos);
                localStorage.setItem("timerPosition", JSON.stringify(newPos));
              }}
            >
              <div
                ref={timerRef}
                style={{
                  position: "absolute",
                  backgroundColor: colors.dark,
                  color: "#fff",
                  padding: "1rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${colors.accent}`,
                  boxShadow: "0 0 10px rgba(0,0,0,0.3)",
                  fontFamily: tokens.font.body,
                  width: "180px",
                  textAlign: "center",
                  pointerEvents: "auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "2rem",
                    fontWeight: "bold",
                    marginBottom: "0.5rem",
                  }}
                >
                  {timeLeft}s
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <ButtonPrimary
                    onClick={handleStartPause}
                    style={{ width: "70px" }}
                  >
                    {timerRunning ? "Pause" : "Start"}
                  </ButtonPrimary>
                  <Button onClick={handleReset} style={{ width: "70px" }}>
                    Reset
                  </Button>
                </div>

                <input
                  type="number"
                  value={timerDuration}
                  onChange={handleDurationChange}
                  style={{
                    width: "80px",
                    padding: "0.25rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #ccc",
                    fontSize: "0.9rem",
                    textAlign: "center",
                  }}
                  min={5}
                  max={300}
                />
              </div>
            </Draggable>
          </div>
        )}
      </div>
    </>
  );
}
