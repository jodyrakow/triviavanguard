// App.js
import React, { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";
import "./App.css";
import "react-h5-audio-player/lib/styles.css";
import Draggable from "react-draggable";
import QuestionsMode from "./QuestionsMode";
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
  grid: {}, // { [showTeamId]: { [showQuestionId]: { isCorrect, tiebreakerGuess, tiebreakerGuessRaw } } }
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
  const fileInputRef = useRef(null); // For importing archived shows from JSON
  const [showDropZone, setShowDropZone] = useState(false); // Show drag-and-drop modal for archived files
  const [showDetails, setshowDetails] = useState(true);
  const [visibleImages, setVisibleImages] = useState({});
  const questionRefs = useRef({});
  const [visibleCategoryImages, setVisibleCategoryImages] = useState({});
  const [activeMode, setActiveMode] = useState("show");
  const [currentImageIndex, setCurrentImageIndex] = useState({});
  const [carouselActive, setCarouselActive] = useState(false);
  const timerRef = useRef(null);
  const displayControlsRef = useRef(null);
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

  // ---------- Global Supabase realtime for scoring (updates cache for all modes) ----------
  useEffect(() => {
    if (!supabase || !selectedShowId) return;

    console.log("🟣 APP: Subscribing to global scoring realtime for show", selectedShowId);

    // Subscribe to scoring_cells changes
    const cellsChannel = supabase
      .channel(`app_scoring_cells:${selectedShowId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scoring_cells",
          filter: `show_id=eq.${selectedShowId}`,
        },
        (payload) => {
          const { new: newRow } = payload;
          if (!newRow) return;

          const { show_team_id, show_question_id, is_correct, bonus_count, tiebreaker_guess, tiebreaker_guess_raw } = newRow;

          setScoringCache((prev) => {
            const showCache = prev[selectedShowId] || {};
            const grid = showCache.grid || {};
            const teamGrid = grid[show_team_id] || {};

            return {
              ...prev,
              [selectedShowId]: {
                ...showCache,
                grid: {
                  ...grid,
                  [show_team_id]: {
                    ...teamGrid,
                    [show_question_id]: {
                      isCorrect: is_correct,
                      bonusCount: bonus_count || 0,
                      tiebreakerGuess: tiebreaker_guess,
                      tiebreakerGuessRaw: tiebreaker_guess_raw,
                    },
                  },
                },
              },
            };
          });
        }
      )
      .subscribe();

    // Subscribe to show_teams changes
    const teamsChannel = supabase
      .channel(`app_show_teams:${selectedShowId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "show_teams",
          filter: `show_id=eq.${selectedShowId}`,
        },
        (payload) => {
          const { new: newRow } = payload;
          if (!newRow) return;

          const showTeamId = newRow.show_team_id;

          setScoringCache((prev) => {
            const showCache = prev[selectedShowId] || {};
            const teams = showCache.teams || [];

            // Handle removal
            if (newRow.is_removed) {
              return {
                ...prev,
                [selectedShowId]: {
                  ...showCache,
                  teams: teams.filter((t) => t.showTeamId !== showTeamId),
                },
              };
            }

            // Handle add or update
            const updatedTeam = {
              showTeamId: newRow.show_team_id,
              teamId: newRow.team_id,
              teamName: newRow.team_name,
              showBonus: newRow.show_bonus || 0,
              isLeague: newRow.is_league || false,
            };

            const existingIdx = teams.findIndex((t) => t.showTeamId === showTeamId);
            let newTeams;
            if (existingIdx >= 0) {
              newTeams = [...teams];
              newTeams[existingIdx] = { ...newTeams[existingIdx], ...updatedTeam };
            } else {
              newTeams = [...teams, updatedTeam];
            }

            return {
              ...prev,
              [selectedShowId]: {
                ...showCache,
                teams: newTeams,
              },
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cellsChannel);
      supabase.removeChannel(teamsChannel);
    };
  }, [selectedShowId]);

  // Question edits cache: { [showId]: { [showQuestionId]: { question?, notes?, pronunciationGuide?, answer? } } }
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
  const [timerDuration, setTimerDuration] = useState(null); // No default - loaded from Airtable/Supabase
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);

  // Timer hidden by default
  const [showTimer, setShowTimer] = useState(false);

  useEffect(() => {
    localStorage.setItem("tv_showTimer", String(showTimer));
  }, [showTimer]);

  // Display controls state
  const [displayControlsOpen, setDisplayControlsOpen] = useState(false);
  const [displayControlsPosition, setDisplayControlsPosition] = useState({
    x: 0,
    y: 0,
  });

  const [displayFontSize, setDisplayFontSize] = useState(() => {
    const saved = Number(localStorage.getItem("tv_displayFontSize"));
    return Number.isFinite(saved) ? saved : 220; // pick your normal default
  });

  const [customMessage, setCustomMessage] = useState("");
  const [customMessageImage, setCustomMessageImage] = useState("");

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
  useEffect(() => {
    localStorage.setItem("tv_displayFontSize", String(displayFontSize));
  }, [displayFontSize]);

  // Send message to display window
  const sendToDisplay = (type, data) => {
    if (!displayChannelRef.current) return;
    console.log("[sendToDisplay]", type, data);
    displayChannelRef.current.postMessage({ type, content: data });
  };

  // Global scoring settings
  const [scoringMode, setScoringMode] = useState(
    () => localStorage.getItem("tv_scoringMode") || "pub",
  );
  const [pubPoints, setPubPoints] = useState(
    () => Number(localStorage.getItem("tv_pubPoints")) || 10,
  );
  const [poolPerQuestion, setPoolPerQuestion] = useState(
    () => Number(localStorage.getItem("tv_poolPerQuestion")) || 500,
  );
  const [poolContribution, setPoolContribution] = useState(
    () => Number(localStorage.getItem("tv_poolContribution")) || 10,
  );
  const [factionBonus, setFactionBonus] = useState(
    () => Number(localStorage.getItem("tv_factionBonus")) || 10,
  );

  // Track if we've loaded settings from Supabase for this show AND if they existed
  // Format: { showId: string, exists: boolean } or null
  const supabaseSettingsLoadedRef = useRef(null);

  // Debounce timer for Supabase settings saves (avoids saving on every keystroke)
  const supabaseSettingsSaveTimeoutRef = useRef(null);
  const supabaseHostInfoSaveTimeoutRef = useRef(null);

  // Load settings from Supabase AFTER showBundle has loaded
  // If Supabase has a row → use it (show was previously opened)
  // If no row → create one from Airtable config, then use it
  useEffect(() => {
    if (!selectedShowId) return;
    if (!showBundle) return; // Wait for Airtable bundle to load first
    if (supabaseSettingsLoadedRef.current?.showId === selectedShowId) return;

    const loadOrCreateSettings = async () => {
      try {
        console.log("🔵 SUPABASE SETTINGS: Checking for existing settings...", selectedShowId);
        const res = await fetch(
          `/.netlify/functions/supaLoadShowSettings?showId=${encodeURIComponent(selectedShowId)}`
        );
        if (!res.ok) {
          console.error("Failed to load show settings:", await res.text());
          return;
        }
        const { settings, exists } = await res.json();

        supabaseSettingsLoadedRef.current = { showId: selectedShowId, exists, applied: false };

        if (exists && settings) {
          // Supabase has settings - use them (show was previously opened)
          console.log("🔵 SUPABASE SETTINGS: Found existing settings, applying", settings);
          console.log("🔵 SUPABASE SETTINGS: prizes value =", JSON.stringify(settings.prizes));
          applySettings(settings);
          supabaseSettingsLoadedRef.current.applied = true;
        } else {
          // No Supabase settings - create from Airtable config
          console.log("🔵 SUPABASE SETTINGS: No existing settings, creating from Airtable config");
          const config = showBundle?.config || {};

          // Build settings from Airtable config
          const newSettings = {};

          if (config.scoringMode) {
            const mode = config.scoringMode.toLowerCase().replace(/[\s()]/g, "");
            if (mode === "pub") newSettings.scoring_mode = "pub";
            else if (mode === "pooledadaptive" || mode === "adaptive") newSettings.scoring_mode = "pooled-adaptive";
            else if (mode === "pooled" || mode === "pooledstatic") newSettings.scoring_mode = "pooled";
          }
          if (typeof config.pubPoints === "number") newSettings.pub_points = config.pubPoints;
          if (typeof config.poolPerQuestion === "number") newSettings.pool_per_question = config.poolPerQuestion;
          if (typeof config.poolContribution === "number") newSettings.pool_contribution = config.poolContribution;
          if (typeof config.timerDefault === "number") newSettings.timer_default = config.timerDefault;
          if (config.prizes) newSettings.prizes = config.prizes;
          if (config.hostName) newSettings.host_name = config.hostName;
          if (config.cohostName) newSettings.cohost_name = config.cohostName;
          if (config.location) newSettings.location_name = config.location;
          if (config.startTime) newSettings.start_times = config.startTime;
          if (config.announcements) newSettings.announcements = config.announcements;
          if (typeof config.totalGames === "number") newSettings.total_games = config.totalGames;

          // Save to Supabase
          if (Object.keys(newSettings).length > 0) {
            console.log("🔵 SUPABASE SETTINGS: Saving initial settings from Airtable", newSettings);
            await fetch("/.netlify/functions/supaSaveShowSettings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ showId: selectedShowId, settings: newSettings }),
            });
          }

          // Apply the settings locally
          applySettings(newSettings);
          supabaseSettingsLoadedRef.current.applied = true;
        }
      } catch (err) {
        console.error("supaLoadShowSettings error:", err);
      }
    };

    // Helper to apply settings to state
    const applySettings = (settings) => {
      if (settings.scoring_mode) {
        const mode = settings.scoring_mode;
        if (mode === "pub") setScoringMode("pub");
        else if (mode === "pooled-adaptive") setScoringMode("pooled-adaptive");
        else if (mode === "pooled") setScoringMode("pooled");
      }
      if (typeof settings.pub_points === "number") {
        setPubPoints(settings.pub_points);
      }
      if (typeof settings.pool_per_question === "number") {
        setPoolPerQuestion(settings.pool_per_question);
      }
      if (typeof settings.pool_contribution === "number") {
        setPoolContribution(settings.pool_contribution);
      }
      if (typeof settings.timer_default === "number") {
        setTimerDuration(settings.timer_default);
        setTimeLeft(settings.timer_default);
      }

      // Apply hostInfo and prizes from Supabase to scoringCache
      setScoringCache((prev) => {
        const show = prev[selectedShowId] || DEFAULT_SHOW_STATE;
        const currentHostInfo = show.hostInfo || DEFAULT_SHOW_STATE.hostInfo;

        const updatedHostInfo = { ...currentHostInfo };
        if (settings.host_name) updatedHostInfo.host = settings.host_name;
        if (settings.cohost_name) updatedHostInfo.cohost = settings.cohost_name;
        if (settings.location_name) updatedHostInfo.location = settings.location_name;
        if (typeof settings.total_games === "number") updatedHostInfo.totalGames = String(settings.total_games);
        if (settings.start_times) updatedHostInfo.startTimesText = settings.start_times;
        if (settings.announcements) updatedHostInfo.announcements = settings.announcements;

        const finalPrizes = settings.prizes || show.prizes || "";
        console.log("🔵 APPLY SETTINGS: Setting prizes in scoringCache =", JSON.stringify(finalPrizes));

        return {
          ...prev,
          [selectedShowId]: {
            ...show,
            hostInfo: updatedHostInfo,
            prizes: finalPrizes,
          },
        };
      });
    };

    loadOrCreateSettings();
  }, [selectedShowId, showBundle]);

  // Reset supabase settings loaded flag when show changes
  useEffect(() => {
    supabaseSettingsLoadedRef.current = null;
  }, [selectedShowId]);

  // Supabase realtime subscription for show_settings (sync between hosts)
  useEffect(() => {
    if (!supabase || !selectedShowId) return;

    console.log("🟣 SUPABASE REALTIME: Subscribing to show_settings for show", selectedShowId);
    const channel = supabase
      .channel(`show_settings:${selectedShowId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "show_settings",
          filter: `show_id=eq.${selectedShowId}`,
        },
        (payload) => {
          const { new: settings } = payload;
          if (!settings) return;

          console.log("🟣 SUPABASE REALTIME SETTINGS UPDATE:", settings);

          // Apply updated settings - scoring settings
          if (settings.scoring_mode) {
            const mode = settings.scoring_mode;
            if (mode === "pub") setScoringMode("pub");
            else if (mode === "pooled-adaptive") setScoringMode("pooled-adaptive");
            else if (mode === "pooled") setScoringMode("pooled");
          }
          if (typeof settings.pub_points === "number") {
            setPubPoints(settings.pub_points);
          }
          if (typeof settings.pool_per_question === "number") {
            setPoolPerQuestion(settings.pool_per_question);
          }
          if (typeof settings.pool_contribution === "number") {
            setPoolContribution(settings.pool_contribution);
          }
          if (typeof settings.timer_default === "number") {
            setTimerDuration(settings.timer_default);
            setTimeLeft(settings.timer_default);
          }

          // Apply updated hostInfo and prizes to scoringCache
          setScoringCache((prev) => {
            const show = prev[selectedShowId] || DEFAULT_SHOW_STATE;
            const currentHostInfo = show.hostInfo || DEFAULT_SHOW_STATE.hostInfo;

            const updatedHostInfo = { ...currentHostInfo };
            if (settings.host_name !== undefined) updatedHostInfo.host = settings.host_name || "";
            if (settings.cohost_name !== undefined) updatedHostInfo.cohost = settings.cohost_name || "";
            if (settings.location_name !== undefined) updatedHostInfo.location = settings.location_name || "";
            if (settings.total_games !== undefined) updatedHostInfo.totalGames = settings.total_games ? String(settings.total_games) : "";
            if (settings.start_times !== undefined) updatedHostInfo.startTimesText = settings.start_times || "";
            if (settings.announcements !== undefined) updatedHostInfo.announcements = settings.announcements || "";

            return {
              ...prev,
              [selectedShowId]: {
                ...show,
                hostInfo: updatedHostInfo,
                ...(settings.prizes !== undefined && { prizes: settings.prizes || "" }),
              },
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedShowId]);

  // Persist scoring settings to localStorage, scoringCache, and Supabase
  useEffect(() => {
    localStorage.setItem("tv_scoringMode", scoringMode);
    localStorage.setItem("tv_pubPoints", String(pubPoints));
    localStorage.setItem("tv_poolPerQuestion", String(poolPerQuestion));
    localStorage.setItem("tv_poolContribution", String(poolContribution));
    localStorage.setItem("tv_factionBonus", String(factionBonus));

    if (!selectedShowId) return;

    // DON'T save to Supabase until we've loaded AND APPLIED settings
    // This prevents overwriting correct Supabase/Airtable values with localStorage defaults
    if (supabaseSettingsLoadedRef.current?.showId !== selectedShowId) {
      console.log("🟡 SUPABASE SETTINGS SAVE SKIPPED: Settings not loaded yet for this show");
      return;
    }
    if (!supabaseSettingsLoadedRef.current?.applied) {
      console.log("🟡 SUPABASE SETTINGS SAVE SKIPPED: Settings loaded but not yet applied");
      return;
    }

    // Debounce Supabase save - wait 500ms after last change before saving
    if (supabaseSettingsSaveTimeoutRef.current) {
      clearTimeout(supabaseSettingsSaveTimeoutRef.current);
    }
    supabaseSettingsSaveTimeoutRef.current = setTimeout(() => {
      // Save to Supabase show_settings table (NEW per-field storage)
      // Only include timer_default if it has a value (not null)
      const settingsToSave = {
        scoring_mode: scoringMode,
        pub_points: pubPoints,
        pool_per_question: poolPerQuestion,
        pool_contribution: poolContribution,
      };
      if (timerDuration !== null) {
        settingsToSave.timer_default = timerDuration;
      }
      console.log("🟢 SUPABASE SETTINGS SAVE:", settingsToSave);
      fetch("/.netlify/functions/supaSaveShowSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId: selectedShowId,
          settings: settingsToSave,
          updatedBy: window.localStorage.getItem("hostDevice") || "unknown",
        }),
      })
        .then((res) => {
          if (res.ok) console.log("🟢 SUPABASE SETTINGS SAVE SUCCESS");
          else console.error("Failed to save show settings");
        })
        .catch((err) => console.error("supaSaveShowSettings error:", err));
    }, 500);

    setScoringCache((prev) => {
      const show = prev[selectedShowId] || DEFAULT_SHOW_STATE;

      const nextShow = {
        ...show,
        scoringMode,
        pubPoints,
        poolPerQuestion,
        poolContribution,
        factionBonus,
      };

      const next = {
        ...prev,
        [selectedShowId]: nextShow,
      };

      // OLD SYSTEM DISABLED - now using Supabase show_settings table
      // saveDebounced("all", () => {
      //   fetch("/.netlify/functions/supaSaveScoring", {
      //     method: "POST",
      //     headers: { "Content-Type": "application/json" },
      //     body: JSON.stringify({
      //       showId: selectedShowId,
      //       roundId: "all",
      //       payload: {
      //         teams: nextShow.teams ?? [],
      //         entryOrder: nextShow.entryOrder ?? [],
      //         prizes: nextShow.prizes ?? "",
      //         scoringMode: nextShow.scoringMode ?? "pub",
      //         pubPoints: nextShow.pubPoints ?? 10,
      //         poolPerQuestion: nextShow.poolPerQuestion ?? 500,
      //         poolContribution: nextShow.poolContribution ?? 10,
      //         factionBonus: nextShow.factionBonus ?? 10,
      //         hostInfo: nextShow.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo,
      //         tiebreakers: nextShow.tiebreakers ?? {},
      //         grid: nextShow.grid ?? {},
      //       },
      //     }),
      //   }).catch(() => {});
      // });

      // OLD BROADCAST REMOVED - now using Supabase show_settings realtime

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
    factionBonus,
    timerDuration,
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
      1000,
    );
    return () => clearTimeout(t);
  }, [timerRunning, timeLeft, timerDuration]);

  // Restore display controls position from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem("displayControlsPosition");
    if (savedPosition) {
      try {
        setDisplayControlsPosition(JSON.parse(savedPosition));
      } catch {}
    }
  }, []);

  const handleStartPause = () => setTimerRunning((p) => !p);
  const handleReset = () => {
    setTimerRunning(false);
    setTimeLeft(timerDuration);
  };
  const handleDurationChange = (e) => {
    const newDuration = parseInt(e.target.value);
    if (!Number.isNaN(newDuration) && newDuration > 0) {
      setTimerDuration(newDuration);
      setTimeLeft(newDuration);
    }
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
    // OLD "mark" and "cellEdit" HANDLERS REMOVED - now using Supabase scoring_cells realtime
    // OLD "teamBonus", "teamAdd", "teamRename", "teamRemove" HANDLERS REMOVED - now using Supabase show_teams realtime
    // OLD "reloadScoring" HANDLER REMOVED - not needed with Supabase realtime
    // OLD "tbEdit" HANDLER REMOVED - now using Supabase scoring_cells realtime (tiebreaker_guess fields)
    // OLD "prizesUpdate" HANDLER REMOVED - now using Supabase show_settings realtime
    // OLD "hostInfoUpdate" HANDLER REMOVED - now using Supabase show_settings realtime
    // OLD "scoringSettingsUpdate" HANDLER REMOVED - now using Supabase show_settings realtime

    // QUESTION EDIT (keeping this - not yet in Supabase)
    ch.on("broadcast", { event: "questionEdit" }, (msg) => {
      const data = msg?.payload ?? msg;
      const {
        showId,
        showQuestionId,
        question,
        notes,
        pronunciationGuide,
        answer,
      } = data || {};
      if (!showId || !showQuestionId) return;
      if (showId !== currentShowIdRef.current) return;

      setQuestionEdits((prev) => {
        const showEdits = prev[showId] || {};
        const questionEdit = showEdits[showQuestionId] || {};

        const updatedEdit = {
          ...questionEdit,
          ...(question !== undefined && { question }),
          ...(notes !== undefined && { notes }),
          ...(pronunciationGuide !== undefined && { pronunciationGuide }),
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
            JSON.stringify(next),
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
                String(q.questionOrder).toUpperCase() === "TB",
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
    // NOTE: sendMark, sendCellEdit, sendTBEdit, sendTeamBonus/Add/Rename/Remove REMOVED - now using Supabase realtime
    // Keep only sendQuestionEdit and sendTiebreakerAdded until they're migrated to Supabase
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
            ch.send({ type: "broadcast", event, payload }),
          );
        }
      }
    });

    // single cleanup
    return () => {
      try {
        delete window.tvSend;
        delete window.sendQuestionEdit;
        delete window.sendTiebreakerAdded;
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

    // Skip Supabase fetch for archived shows (they already have their data loaded)
    if (selectedShowId.startsWith("archived-")) {
      console.log(
        "[supaLoadScoring] Skipping Supabase fetch for archived show:",
        selectedShowId,
      );
      return;
    }

    (async () => {
      try {
        console.log(
          "[supaLoadScoring] Fetching scoring data for show:",
          selectedShowId,
        );
        const res = await fetch(
          `/.netlify/functions/supaLoadScoring?showId=${encodeURIComponent(selectedShowId)}`,
        );
        console.log("[supaLoadScoring] Response status:", res.status);
        const json = await res.json();
        console.log("[supaLoadScoring] Response data:", json);
        console.log("[supaLoadScoring] Payload:", json.payload);

        setScoringCache((prev) => {
          const prevShow = prev[selectedShowId] || DEFAULT_SHOW_STATE;
          const loadedData = json.payload ?? prevShow;

          // Only override scoring settings if the show has actual scoring data saved
          const gridHasData =
            loadedData?.grid && Object.keys(loadedData.grid).length > 0;
          const showHasBeenStarted = gridHasData && !!json.payload;

          console.log(
            "[supaLoadScoring] gridHasData:",
            gridHasData,
            "grid keys:",
            Object.keys(loadedData?.grid || {}).length,
          );
          console.log(
            "[supaLoadScoring] showHasBeenStarted:",
            showHasBeenStarted,
          );
          console.log(
            "[supaLoadScoring] loadedData.teams:",
            loadedData?.teams?.length || 0,
            "teams",
          );

          if (showHasBeenStarted) {
            console.log(
              "[supaLoadScoring] Applying scoring settings from Supabase",
            );
            // Update local scoring state from loaded Supabase data (show in progress)
            if (loadedData.scoringMode) setScoringMode(loadedData.scoringMode);
            if (loadedData.pubPoints !== undefined)
              setPubPoints(Number(loadedData.pubPoints));
            if (loadedData.poolPerQuestion !== undefined)
              setPoolPerQuestion(Number(loadedData.poolPerQuestion));
            if (loadedData.poolContribution !== undefined)
              setPoolContribution(Number(loadedData.poolContribution));
            if (loadedData.factionBonus !== undefined)
              setFactionBonus(Number(loadedData.factionBonus));
          } else {
            console.log(
              "[supaLoadScoring] No grid data found, keeping Airtable config",
            );
          }

          const result = {
            ...prev,
            [selectedShowId]: { ...DEFAULT_SHOW_STATE, ...loadedData },
          };
          console.log(
            "[supaLoadScoring] Final scoringCache for this show:",
            result[selectedShowId],
          );
          return result;
        });
      } catch (e) {
        console.warn("[supaLoadScoring] Failed:", e);
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

    // Skip bundle fetch for archived shows (they already have their bundle loaded)
    if (selectedShowId.startsWith("archived-")) {
      console.log(
        "[fetchShowBundle] Skipping bundle fetch for archived show:",
        selectedShowId,
      );
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
            bundle.rounds[0].categories[0].questions[0],
          );
        }

        console.log("showBundle.config", showBundle?.config);

        console.log("[App] FULL SHOW BUNDLE:", bundle);
console.log(
  "[App] ROUNDS/CATEGORIES SUMMARY:",
  (bundle?.rounds || []).map((r) => ({
    round: r.round,
    categories: (r.categories || []).map((c) => ({
      categoryName: c.categoryName,
      questionType: c.questionType,
      questionCount: (c.questions || []).length,
      questionOrders: (c.questions || []).map((q) => q.questionOrder),
    })),
  }))
);

        setShowBundle(bundle);

        // Scoring/timer settings are now handled by the Supabase settings effect
        // which waits for showBundle to load, then either uses existing Supabase
        // settings or creates new ones from Airtable config

        // Handle prizes and hostInfo from Airtable config (for initial population)
        if (bundle?.config) {
          const config = bundle.config;

          // Set prizes from config if provided (and not already set by host)
          const currentPrizes = composedCachedState?.prizes || "";
          if (config.prizes && !currentPrizes) {
            console.log("[App] Setting prizes from config:", config.prizes);
            patchShared({ prizes: config.prizes });
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

          // Set location if provided

          if (
            config.location &&
            (!currentHostInfo.location ||
              config.location !== currentHostInfo.location)
          ) {
            updatedHostInfo.location = config.location;
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
          (a, b) => a - b,
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
              factionBonus: nextShow.factionBonus ?? 10,
              hostInfo: nextShow.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo,
              tiebreakers: nextShow.tiebreakers ?? {},
              grid: nextShow.grid ?? {},
            },
          }),
        }).catch(() => {});
      });

      // Save hostInfo and prizes to Supabase show_settings table (NEW per-field storage)
      // Debounced to avoid saving on every keystroke
      if (patch.hostInfo !== undefined || patch.prizes !== undefined) {
        const hi = nextShow.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo;
        const prizesVal = nextShow.prizes;
        const showIdForSave = selectedShowId;

        if (supabaseHostInfoSaveTimeoutRef.current) {
          clearTimeout(supabaseHostInfoSaveTimeoutRef.current);
        }
        supabaseHostInfoSaveTimeoutRef.current = setTimeout(() => {
          console.log("🟢 SUPABASE SETTINGS SAVE (hostInfo/prizes):", { hostInfo: hi, prizes: prizesVal });
          fetch("/.netlify/functions/supaSaveShowSettings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              showId: showIdForSave,
              settings: {
                host_name: hi.host || null,
                cohost_name: hi.cohost || null,
                location_name: hi.location || null,
                total_games: hi.totalGames ? parseInt(hi.totalGames, 10) || null : null,
                start_times: hi.startTimesText || null,
                announcements: hi.announcements || null,
                prizes: prizesVal || null,
              },
              updatedBy: window.localStorage.getItem("hostDevice") || "unknown",
            }),
          })
            .then((res) => {
              if (res.ok) console.log("🟢 SUPABASE SETTINGS SAVE SUCCESS (hostInfo/prizes)");
              else console.error("Failed to save hostInfo/prizes to show_settings");
            })
            .catch((err) => console.error("supaSaveShowSettings (hostInfo/prizes) error:", err));
        }, 500);
      }

      // OLD BROADCASTS REMOVED - now using Supabase show_settings realtime

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
              ...(edit.question !== undefined && {
                questionText: edit.question,
              }),
              ...(edit.notes !== undefined && {
                questionNotes: edit.notes,
              }),
              ...(edit.pronunciationGuide !== undefined && {
                questionPronunciationGuide: edit.pronunciationGuide,
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
            ...(edit.notes !== undefined && {
              questionNotes: edit.notes,
            }),
            ...(edit.pronunciationGuide !== undefined && {
              questionPronunciationGuide: edit.pronunciationGuide,
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
              String(q.questionOrder).toUpperCase() === "TB",
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
          JSON.stringify(next),
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
      questionNotes: "",
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
              String(q.questionOrder).toUpperCase() === "TB",
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
              factionBonus: nextShow.factionBonus ?? 10,
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
        tiebreakerQuestion: tiebreakerQuestion,
      });
    } catch {}
  };

  // Helper function to load archived show from file
  const loadArchivedShowFile = async (file) => {
    try {
      const text = await file.text();
      const archivedShow = JSON.parse(text);

      // Validate the archived show structure
      if (!archivedShow.showBundle || !archivedShow.cachedByRound) {
        alert("Invalid archived show file. Missing required data.");
        return false;
      }

      // Confirm before loading
      const ok = selectedShowId
        ? window.confirm(
            `Load archived show "${archivedShow.showName}" from ${archivedShow.showDate}?\n\nThis will delete all scores and data you've entered for the current show.`,
          )
        : window.confirm(
            `Load archived show "${archivedShow.showName}" from ${archivedShow.showDate}?`,
          );

      if (!ok) {
        return false;
      }

      // Clear cache for the OLD show if switching
      if (selectedShowId) {
        setScoringCache((prev) => {
          const next = { ...prev };
          delete next[selectedShowId];
          return next;
        });
      }

      // Set the show bundle
      setShowBundle(archivedShow.showBundle);

      // Set the scoring cache with the archived data
      // Always use "archived-" prefix to prevent Supabase fetch from overwriting the data
      const archivedShowId = `archived-${Date.now()}`;
      setScoringCache((prev) => ({
        ...prev,
        [archivedShowId]: archivedShow.cachedByRound,
      }));

      // Update scoring settings from archived show
      setScoringMode(archivedShow.scoringMode || "pub");
      setPubPoints(archivedShow.pubPoints || 2);
      setPoolPerQuestion(archivedShow.poolPerQuestion || 10);
      setPoolContribution(archivedShow.poolContribution || 0);
      setFactionBonus(archivedShow.factionBonus || 10);

      // Auto-select first round so questions appear in the grid
      const firstRound = archivedShow.showBundle?.rounds?.[0]?.round;
      const firstRoundId = firstRound ? String(firstRound) : "";

      // Set as the selected show
      setSelectedShowId(archivedShowId);
      setSelectedRoundId(firstRoundId);
      setVisibleImages({});
      setVisibleCategoryImages({});
      setCurrentImageIndex({});

      alert(`Successfully loaded archived show: ${archivedShow.showName}`);
      return true;
    } catch (err) {
      console.error("Error loading archived show:", err);
      alert(`Failed to load archived show: ${err.message}`);
      return false;
    }
  };

  // UI
  return (
    <>
      {/* Sidebar with menu */}
      <Sidebar
        setShowDetails={setshowDetails}
        displayControlsOpen={displayControlsOpen}
        setDisplayControlsOpen={setDisplayControlsOpen}
        showTimer={showTimer}
        setShowTimer={setShowTimer}
        setShowAnswerKey={setShowAnswerKey}
        refreshBundle={refreshBundle}
        getClosestQuestionKey={getClosestQuestionKey}
        questionRefs={questionRefs}
        showBundle={showBundleWithEdits || { rounds: [], teams: [] }}
        hostInfo={composedCachedState?.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo}
        prizes={composedCachedState?.prizes ?? ""}
        scoringMode={scoringMode}
        pubPoints={pubPoints}
        poolPerQuestion={poolPerQuestion}
        poolContribution={poolContribution}
        sendToDisplay={sendToDisplay}
      >
        <SidebarMenu
          showTimer={showTimer}
          setTimerPosition={setTimerPosition}
          prizes={composedCachedState?.prizes ?? ""}
          setPrizes={(val) => patchShared({ prizes: String(val || "") })}
          hostInfo={
            composedCachedState?.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo
          }
          setHostInfo={(val) => patchShared({ hostInfo: val })}
          displayControlsOpen={displayControlsOpen}
          setDisplayControlsPosition={setDisplayControlsPosition}
          scoringMode={scoringMode}
          setScoringMode={setScoringMode}
          pubPoints={pubPoints}
          setPubPoints={setPubPoints}
          poolPerQuestion={poolPerQuestion}
          setPoolPerQuestion={setPoolPerQuestion}
          poolContribution={poolContribution}
          setPoolContribution={setPoolContribution}
          factionBonus={factionBonus}
          setFactionBonus={setFactionBonus}
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
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          <Draggable
            nodeRef={displayControlsRef}
            position={displayControlsPosition}
            onStop={(e, data) => {
              const newPos = { x: data.x, y: data.y };
              setDisplayControlsPosition(newPos);
              localStorage.setItem(
                "displayControlsPosition",
                JSON.stringify(newPos),
              );
            }}
          >
            <div
              ref={displayControlsRef}
              style={{
                position: "absolute",
                pointerEvents: "auto",
                display: "flex",
                flexDirection: "column",
                gap: ".5rem",
                width: "min(300px, calc(100vw - 2rem))",
                backgroundColor: "#fff",
                padding: ".6rem .7rem",
                borderRadius: "12px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                border: `2px solid ${colors.accent}`,
              }}
            >
              {/* Drag / title row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: ".5rem",
                  cursor: "grab",
                  userSelect: "none",
                }}
              >
                <span style={{ opacity: 0.6 }}>⋮⋮</span>
                <span
                  style={{
                    fontWeight: 500,
                    color: colors.dark,
                    fontFamily: tokens.font.body,
                  }}
                >
                  Display controls
                </span>
              </div>

              {/* Everything below stays basically the same */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: ".4rem",
                  alignItems: "center",
                }}
              >
                <Button
                  onClick={() => {
                    const newWindow = window.open(
                      window.location.origin + "?display",
                      "displayMode",
                      "width=1920,height=1080,location=no,toolbar=no,menubar=no,status=no",
                    );
                    if (newWindow) newWindow.focus();

                    // push current host-stored size to display
                    sendToDisplay("fontSize", { size: displayFontSize });
                  }}
                  title="Open Display Mode in new window"
                  style={{
                    fontSize: "1rem",
                    padding: ".45rem .55rem",
                    minWidth: "2.25rem",
                    height: "2.25rem",
                    borderRadius: ".5rem",
                  }}
                >
                  📺
                </Button>

                <Button
                  onClick={() => {
                    sendToDisplay("closeImageOverlay", null);
                    sendToDisplay("closeQuestionCarousel", null);
                    sendToDisplay("standby", null);
                    setCarouselActive(false);
                  }}
                  title="Clear the display (standby screen)"
                  style={{
                    fontSize: "1rem",
                    padding: ".45rem .55rem",
                    minWidth: "2.25rem",
                    height: "2.25rem",
                    borderRadius: ".5rem",
                  }}
                >
                  🧹
                </Button>

                <Button
                  onClick={() => sendToDisplay("closeImageOverlay", null)}
                  title="Close any image overlay on the display"
                  style={{
                    fontSize: "1rem",
                    padding: ".45rem .55rem",
                    minWidth: "2.25rem",
                    height: "2.25rem",
                    borderRadius: ".5rem",
                  }}
                >
                  🖼️
                </Button>

                <Button
                  onClick={() => sendToDisplay("toggleGuide")}
                  title="Toggle alignment guide"
                  style={{
                    fontSize: "1rem",
                    padding: ".45rem .55rem",
                    minWidth: "2.25rem",
                    height: "2.25rem",
                    borderRadius: ".5rem",
                  }}
                >
                  📐
                </Button>

                <Button
                  onClick={() => {
                    setDisplayFontSize((prev) => {
                      const newSize = Math.max(50, prev - 10);
                      sendToDisplay("fontSize", { size: newSize });
                      return newSize;
                    });
                  }}
                  title="Decrease display text size"
                >
                  A-
                </Button>

                <Button
                  onClick={() => {
                    setDisplayFontSize((prev) => {
                      const newSize = Math.min(400, prev + 10);
                      sendToDisplay("fontSize", { size: newSize });
                      return newSize;
                    });
                  }}
                  title="Increase display text size"
                >
                  A+
                </Button>
              </div>

              {/* Custom message row */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}
              >
                <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                  <input
                    type="text"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Type a message for the TV…"
                    className="display-controls-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (customMessage.trim() || customMessageImage.trim())) {
                        sendToDisplay("message", {
                          text: customMessage.trim(),
                          imageUrl: customMessageImage.trim() || null,
                        });
                      }
                    }}
                    style={{
                      flex: 1,
                      fontSize: ".9rem",
                      padding: ".5rem .6rem",
                      border: `1px solid ${colors.gray?.border || "#ccc"}`,
                      borderRadius: ".6rem",
                      minWidth: "200px",
                      backgroundColor: "#fff",
                      color: colors.dark || "#2B394A",
                    }}
                  />

                  <ButtonPrimary
                    onClick={() => {
                      if (customMessage.trim() || customMessageImage.trim()) {
                        sendToDisplay("message", {
                          text: customMessage.trim(),
                          imageUrl: customMessageImage.trim() || null,
                        });
                      }
                    }}
                    disabled={!customMessage.trim() && !customMessageImage.trim()}
                    title="Push this message to display"
                    style={{
                      fontSize: "1rem",
                      padding: ".45rem .55rem",
                      minWidth: "2.25rem",
                      height: "2.25rem",
                      borderRadius: ".5rem",
                      opacity: (customMessage.trim() || customMessageImage.trim()) ? 1 : 0.5,
                    }}
                  >
                    📣
                  </ButtonPrimary>
                </div>

                {/* Image URL row */}
                <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                  <input
                    type="text"
                    value={customMessageImage}
                    onChange={(e) => setCustomMessageImage(e.target.value)}
                    placeholder="Paste image URL here…"
                    className="display-controls-input"
                    style={{
                      flex: 1,
                      fontSize: ".85rem",
                      padding: ".4rem .6rem",
                      border: `1px solid ${colors.gray?.border || "#ccc"}`,
                      borderRadius: ".6rem",
                      minWidth: "200px",
                      backgroundColor: "#fff",
                      color: colors.dark || "#2B394A",
                    }}
                  />
                  {customMessageImage.trim() && (
                    <Button
                      onClick={() => setCustomMessageImage("")}
                      title="Clear image"
                      style={{
                        fontSize: ".85rem",
                        padding: ".3rem .5rem",
                        minWidth: "2rem",
                        height: "2rem",
                        borderRadius: ".5rem",
                      }}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Draggable>
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
              showName={
                shows.find((s) => s.id === selectedShowId)?.Show?.Show || ""
              }
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
                  // Reset select to prevent it from staying on this option
                  setTimeout(() => {
                    e.target.value = selectedShowId || "";
                  }, 0);
                  return;
                }

                // Special case: "Open archived show from file" option
                if (newId === "__ARCHIVED__") {
                  // Show the drag-and-drop modal
                  setShowDropZone(true);

                  // Reset select after triggering
                  setTimeout(() => {
                    e.target.value = selectedShowId || "";
                  }, 0);

                  return;
                }

                if (!selectedShowId || selectedShowId === newId) {
                  setSelectedShowId(newId);
                  setSelectedRoundId("");
                  return;
                }

                const ok = window.confirm(
                  "Switch shows? This will delete all scores and data you've entered for the current show.",
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
                    JSON.stringify(next),
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
              <option
                value="__ARCHIVED__"
                style={{ fontFamily: tokens.font.body, fontStyle: "italic" }}
              >
                📂 Open archived show from file...
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
          <QuestionsMode
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
            displayControlsOpen={displayControlsOpen}
            addTiebreaker={addTiebreaker}
            sendToDisplay={sendToDisplay}
            refreshBundle={refreshBundle}
            carouselActive={carouselActive}
            setCarouselActive={setCarouselActive}
          />
        )}

        {activeMode === "score" && (
          <ScoringMode
            showBundle={
              showBundle
                ? {
                    ...showBundle,
                    rounds: (showBundle.rounds || []).filter(
                      (r) => Number(r.round) === Number(selectedRoundId),
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
                    JSON.stringify(next),
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
            factionBonus={factionBonus}
            prizes={composedCachedState?.prizes ?? ""}
            setPrizes={(val) => patchShared({ prizes: String(val || "") })}
            questionEdits={questionEdits[selectedShowId] ?? {}}
            sendToDisplay={sendToDisplay}
            displayControlsOpen={displayControlsOpen}
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
                      "/.netlify/functions/fetchOlderShows",
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
                          "Switch to this show? This will delete all scores and data you've entered for the current show.",
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
                          JSON.stringify(next),
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
              position={timerPosition}
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
                {/* Drag handle */}
                <div
                  style={{
                    position: "absolute",
                    top: "0.5rem",
                    left: "0.5rem",
                    cursor: "grab",
                    userSelect: "none",
                    opacity: 0.6,
                  }}
                >
                  ⋮⋮
                </div>

                <div
                  style={{
                    fontSize: "2rem",
                    fontWeight: "bold",
                    marginBottom: "0.5rem",
                  }}
                >
                  {timeLeft !== null ? `${timeLeft}s` : "--"}
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
                  value={timerDuration ?? ""}
                  onChange={handleDurationChange}
                  placeholder="--"
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

      {/* Hidden file input for importing archived shows */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          opacity: 0,
        }}
        onClick={(e) => {
          // Reset the file input value so the same file can be selected again
          e.target.value = null;
        }}
        onChange={async (e) => {
          const file = e.target.files?.[0];

          // Reset the select dropdown back to the current show
          const selectElement = document.querySelector(
            'select[aria-label="Show selector"], select',
          );
          if (selectElement) {
            selectElement.value = selectedShowId || "";
          }

          if (!file) return;

          await loadArchivedShowFile(file);
          e.target.value = ""; // Reset file input
        }}
      />

      {/* Drag-and-drop modal for archived show files */}
      {showDropZone && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
          onClick={() => setShowDropZone(false)}
        >
          <div
            style={{
              backgroundColor: colors.bg,
              borderRadius: "1rem",
              padding: "2rem",
              maxWidth: "600px",
              width: "100%",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.5rem",
                  fontFamily: tokens.font.display,
                }}
              >
                Load Archived Show
              </h2>
              <button
                onClick={() => setShowDropZone(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  padding: "0.25rem 0.5rem",
                  opacity: 0.7,
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.backgroundColor =
                  colors.purple?.bg || "#f0e5ff";
                e.currentTarget.style.borderColor =
                  colors.purple?.border || "#9b59b6";
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.backgroundColor =
                  colors.gray?.bg || "#f5f5f5";
                e.currentTarget.style.borderColor =
                  colors.gray?.border || "#ccc";
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.backgroundColor =
                  colors.gray?.bg || "#f5f5f5";
                e.currentTarget.style.borderColor =
                  colors.gray?.border || "#ccc";

                const file = e.dataTransfer.files?.[0];
                if (!file) return;

                if (!file.name.endsWith(".json")) {
                  alert("Please drop a .json file");
                  return;
                }

                const success = await loadArchivedShowFile(file);
                if (success) {
                  setShowDropZone(false);
                }
              }}
              style={{
                border: `3px dashed ${colors.gray?.border || "#ccc"}`,
                borderRadius: "0.75rem",
                padding: "3rem 2rem",
                textAlign: "center",
                backgroundColor: colors.gray?.bg || "#f5f5f5",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📁</div>
              <div
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "bold",
                  marginBottom: "0.5rem",
                }}
              >
                Drag & Drop Your Archived Show File Here
              </div>
              <div style={{ fontSize: "0.9rem", opacity: 0.7 }}>
                or click to browse
              </div>
              <input
                type="file"
                accept=".json"
                style={{ display: "none" }}
                id="dropZoneFileInput"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const success = await loadArchivedShowFile(file);
                  if (success) {
                    setShowDropZone(false);
                  }
                  e.target.value = ""; // Reset
                }}
              />
              <label
                htmlFor="dropZoneFileInput"
                style={{
                  display: "inline-block",
                  marginTop: "1rem",
                  padding: "0.75rem 1.5rem",
                  backgroundColor: colors.purple?.bg || "#9b59b6",
                  color: "#fff",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "1rem",
                }}
              >
                Browse Files
              </label>
            </div>

            <div
              style={{
                marginTop: "1rem",
                fontSize: "0.85rem",
                opacity: 0.6,
                textAlign: "center",
              }}
            >
              Only .json archive files are supported
            </div>
          </div>
        </div>
      )}
    </>
  );
}
