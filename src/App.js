// App.js
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import axios from "axios";
import { marked } from "marked";
import "./App.css";
import "react-h5-audio-player/lib/styles.css";
import Draggable from "react-draggable";
import QuestionsMode from "./QuestionsMode";
import ScoringMode from "./ScoringMode";
import ResultsMode from "./ResultsMode";
import { RULES_ITEMS, PHONE_AWAY_ITEM } from "./rulesItems";
import SidebarMenu from "./SidebarMenu";
import AnswerKeyPanel from "./AnswerKeyPanel";
import logo from "./trivia-logo.png";
import {
  ButtonPrimary,
  colors,
  tokens,
  ui,
  Button,
} from "./styles/index.js";
import { computeAutoEarned, computeBonusBreakdown, computePartialBreakdown, buildCorrectCountMap, buildTeamTotals, computePlaces } from "./scoring/compute.js";
import { supabase } from "./supabaseClient.js";
export { supabase };

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
const ALLOWED_PASSWORD = "tv2025";
const PASSWORD_KEY = "showPasswordAuthorized";

export default function App() {
  // Password protection state
  const [passwordAuthorized, setPasswordAuthorized] = useState(
    () => !!sessionStorage.getItem(PASSWORD_KEY),
  );
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

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
  const [currentImageIndex, setCurrentImageIndex] = useState({});
  const [carouselActive, setCarouselActive] = useState(false);
  const timerRef = useRef(null);

  // Floating mode panels
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [questionsPos, setQuestionsPos] = useState(() => { try { const s=localStorage.getItem("tv_questionsPos"); return s?JSON.parse(s):{x:80,y:100}; } catch { return {x:80,y:100}; } });
  const [scoringPos, setScoringPos] = useState(() => { try { const s=localStorage.getItem("tv_scoringPos"); return s?JSON.parse(s):{x:120,y:120}; } catch { return {x:120,y:120}; } });
  const [resultsPos, setResultsPos] = useState(() => { try { const s=localStorage.getItem("tv_resultsPos"); return s?JSON.parse(s):{x:160,y:140}; } catch { return {x:160,y:140}; } });
  const questionsRef = useRef(null);
  const scoringRef = useRef(null);
  const resultsRef = useRef(null);

  const [rtStatus, setRtStatus] = useState("INIT"); // ✅ moved inside

  // Bundle (rounds+questions+teams)
  const [showBundle, setShowBundle] = useState(null);
  const [bundleLoading, setBundleLoading] = React.useState(false);
  const [bundleError, setBundleError] = React.useState(null);

  const currentShowIdRef = useRef(selectedShowId);
  useEffect(() => {
    currentShowIdRef.current = selectedShowId;
  }, [selectedShowId]);
  const showBundleRef = useRef(null); // mirrors showBundle state for use in mount-time broadcast handlers
  useEffect(() => { showBundleRef.current = showBundle; }, [showBundle]);

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

    console.log(
      "🟣 APP: Subscribing to global scoring realtime for show",
      selectedShowId,
    );

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

          const {
            show_team_id,
            show_question_id,
            is_correct,
            bonus_count,
            partial_count,
            tiebreaker_guess,
            tiebreaker_guess_raw,
          } = newRow;

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
                      partialCount: partial_count ?? 0,
                      tiebreakerGuess: tiebreaker_guess,
                      tiebreakerGuessRaw: tiebreaker_guess_raw,
                    },
                  },
                },
              },
            };
          });
        },
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

            const existingIdx = teams.findIndex(
              (t) => t.showTeamId === showTeamId,
            );
            let newTeams;
            if (existingIdx >= 0) {
              newTeams = [...teams];
              newTeams[existingIdx] = {
                ...newTeams[existingIdx],
                ...updatedTeam,
              };
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
        },
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


  // Script panel state
  const [scriptPanelOpen, setScriptPanelOpen] = useState(false);
  const [rulesStartedWithScript, setRulesStartedWithScript] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Display nav state
  const [navIsAnswerMode, setNavIsAnswerMode] = useState(false);
  const [navIndex, setNavIndex] = useState(0);
  const [navAnswerStage, setNavAnswerStage] = useState(0); // 0=question, 1=answer, 2=stats
  const [navStarted, setNavStarted] = useState(false); // true once first item has been sent via nav
  const [navKeyboardEnabled, setNavKeyboardEnabled] = useState(false); // arrow key nav
  const [navImageVisible, setNavImageVisible] = useState(false); // true when image toggled on for current nav item
  const [navImageIndex, setNavImageIndex] = useState(0); // current image index when cycling
  const [navAudioIndex, setNavAudioIndex] = useState(0); // current audio index when cycling
  const [navGoToInput, setNavGoToInput] = useState(""); // "go to" input value
  const [liveDisplayState, setLiveDisplayState] = useState(null); // what's currently on the display (from Supabase)
  const [remoteAudioStatus, setRemoteAudioStatus] = useState(null); // { playing, hostName } from another host
  const [gridOnRight, setGridOnRight] = useState(() => localStorage.getItem("tv_gridOnRight") !== "false");
  const sharedAudioRef = useRef(null);
  const [sharedAudioUrl, setSharedAudioUrl] = useState("");
  const [sharedAudioPlaying, setSharedAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(null);
  const [stripEditing, setStripEditing] = useState(false);
  const [stripEditDraft, setStripEditDraft] = useState({});

  // Preview dimensions — driven by actual measured height of the flex-1 preview row
  const previewRowRef = useRef(null);
  const [previewRowH, setPreviewRowH] = useState(0);
  const previewW = previewRowH > 0
    ? Math.max(320, Math.min(Math.round(previewRowH * 1920 / 1080), window.innerWidth - 40, 1600))
    : 0;
  const previewH = previewW > 0 ? Math.round(previewW * 1080 / 1920) : 0;

  // Answer Key state
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  // ── Host identity ──────────────────────────────────────────────
  const [hostId, setHostId] = useState(null);
  const [hostName, setHostName] = useState("");
  const [hostSetupOpen, setHostSetupOpen] = useState(false);
  const [hostSetupHosts, setHostSetupHosts] = useState([]); // list from Supabase
  const [hostSetupNewName, setHostSetupNewName] = useState("");
  const [hostSetupError, setHostSetupError] = useState("");

  // venueShowId: stable key for the venue's display channel — "{locationRecordId}:{date}"
  // Persisted to localStorage so co-host sessions survive refresh
  const [venueShowId, setVenueShowId] = useState(() => localStorage.getItem("tv_venueShowId") || null);
  const [venueName, setVenueName] = useState(() => localStorage.getItem("tv_venueName") || null);

  // venueId: stable per-location key used as primary key in display_state table.
  // Strips the trailing ":YYYY-MM-DD" date suffix so co-hosts sharing the same venue
  // always resolve to the same row regardless of when they entered it.
  // Examples: "loc123:2025-04-10" → "loc123", "custom:testing:2025-04-10" → "custom:testing"
  const venueId = venueShowId
    ? venueShowId.replace(/:\d{4}-\d{2}-\d{2}$/, "")
    : null;

  // Active displays detected via Supabase Presence on "tv:displays"
  const [activeDisplays, setActiveDisplays] = useState([]);

  // Venue picker
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const [venuePickerOptions, setVenuePickerOptions] = useState([]);
  const [venuePickerLoading, setVenuePickerLoading] = useState(false);
  const [venueManualInput, setVenueManualInput] = useState("");

  // Supabase channel for broadcasting to the display window
  const displayBroadcastRef = useRef(null);
  const previewIframeRef = useRef(null);
  const isRefreshingBundleRef = useRef(false); // true when refreshBundle() triggered showBundle change

  // On mount: check localStorage for saved host identity, verify against Supabase
  useEffect(() => {
    const savedId = localStorage.getItem("tvHostId");
    const savedName = localStorage.getItem("tvHostName");
    if (savedId && savedName) {
      fetch("/.netlify/functions/supaUpsertHost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: savedId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.host_id) {
            setHostId(data.host_id);
            setHostName(data.host_name);
          } else {
            // Not found in Supabase — show setup
            setHostSetupOpen(true);
          }
        })
        .catch(() => {
          // Network error — trust localStorage and proceed
          setHostId(savedId);
          setHostName(savedName);
        });
    } else {
      setHostSetupOpen(true);
    }
  }, []);

  // Load host list for the setup modal
  useEffect(() => {
    if (!hostSetupOpen) return;
    fetch("/.netlify/functions/supaGetHosts")
      .then((r) => r.json())
      .then((data) => setHostSetupHosts(Array.isArray(data) ? data : []))
      .catch(() => setHostSetupHosts([]));
  }, [hostSetupOpen]);

  const selectHost = (id, name) => {
    setHostId(id);
    setHostName(name);

    localStorage.setItem("tvHostId", id);
    localStorage.setItem("tvHostName", name);
    setHostSetupOpen(false);
    setHostSetupError("");
    setHostSetupNewName("");
  };

  const createHost = async () => {
    const name = hostSetupNewName.trim();
    if (!name) return;
    setHostSetupError("");
    try {
      const res = await fetch("/.netlify/functions/supaUpsertHost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: name }),
      });
      const data = await res.json();
      if (data.host_id) {
        selectHost(data.host_id, data.host_name);
      } else {
        setHostSetupError(data.error || "Failed to create host.");
      }
    } catch {
      setHostSetupError("Network error — please try again.");
    }
  };

  const submitPassword = useCallback(() => {
    if (passwordInput.toLowerCase() === ALLOWED_PASSWORD.toLowerCase()) {
      sessionStorage.setItem(PASSWORD_KEY, "true");
      setPasswordAuthorized(true);
    } else {
      setPasswordError("Incorrect password. Please try again.");
      setPasswordInput("");
    }
  }, [passwordInput]);

  // Keep display broadcast channel in sync with venueShowId
  useEffect(() => {
    if (!supabase || !venueShowId) return;

    // Keep a broadcast channel for non-persistent signals (fontSize, toggleGuide, updateInlineImageIndex)
    // that don't need to survive reconnects and shouldn't be stored in display_state.
    if (displayBroadcastRef.current) {
      supabase.removeChannel(displayBroadcastRef.current);
      displayBroadcastRef.current = null;
    }

    const ch = supabase.channel(`tv:display:${venueShowId}`);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        displayBroadcastRef.current = ch;
      }
    });

    return () => {
      supabase.removeChannel(ch);
      displayBroadcastRef.current = null;
    };
  }, [venueShowId]);

  // Subscribe to display_state changes from Supabase — all hosts see what's on the display
  // (same pattern as scoring_cells: write → Supabase → Realtime → all Mission Controls update)
  useEffect(() => {
    setLiveDisplayState(null);
    if (!supabase || !venueId) return;

    // Load current state on mount
    fetch(`/.netlify/functions/supaLoadDisplayState?venueId=${encodeURIComponent(venueId)}`)
      .then((r) => r.json())
      .then((data) => { if (data.state?.type) setLiveDisplayState(data.state); })
      .catch(() => {});

    // Subscribe to Realtime changes
    const ch = supabase
      .channel(`app_display_state:${venueId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "display_state",
        filter: `venue_id=eq.${venueId}`,
      }, (payload) => {
        const state = payload.new?.state;
        if (state?.type) setLiveDisplayState(state);
      })
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [venueId]);

  // Update preview iframe src imperatively when venue changes, to avoid reload on unrelated re-renders
  useEffect(() => {
    if (!venueShowId || !previewIframeRef.current) return;
    const newSrc = `${window.location.origin}?display&venueShowId=${venueShowId}&hostId=${hostId}&hostName=${encodeURIComponent(hostName)}&viewer=1&preview=1`;
    if (previewIframeRef.current.src !== newSrc) {
      previewIframeRef.current.src = newSrc;
    }
  }, [venueShowId, hostId, hostName]);

  // Subscribe to presence channel to detect active display windows
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel("tv:displays");
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const displays = Object.values(state).flat();
      setActiveDisplays(displays);
    });
    ch.subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // Ephemeral types — sent via broadcast only, not persisted to Supabase
  const EPHEMERAL_DISPLAY_TYPES = new Set(["toggleGuide", "setGuide", "fontSize", "updateInlineImageIndex"]);

  // Send a display update.
  // Persistent types (question, category, results, standby, etc.) are upserted to Supabase display_state
  // AND broadcast so the display window updates instantly without waiting for the Realtime event.
  // Ephemeral types (fontSize, guide toggle, image index) are broadcast only.
  const sendToDisplay = (type, data) => {
    const payload = { type, content: data };

    // Update local live display state immediately (like scoring_cells optimistic update)
    if (!EPHEMERAL_DISPLAY_TYPES.has(type)) {
      setLiveDisplayState(payload);
    }

    // Always broadcast for instant update to display window
    if (displayBroadcastRef.current) {
      displayBroadcastRef.current.send({
        type: "broadcast",
        event: "display_update",
        payload,
      });
    }

    // Persist to Supabase for non-ephemeral types so any joining host/display gets current state
    if (!EPHEMERAL_DISPLAY_TYPES.has(type) && venueId) {
      fetch("/.netlify/functions/supaUpsertDisplayState", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId, venueName, state: payload }),
      }).catch((err) => console.error("[sendToDisplay] Supabase upsert failed:", err));
    }
  };

  // Open a display window — display will load its own state from Supabase on mount
  const openDisplayWindow = useCallback((vid) => {
    const alreadyOpen = activeDisplays.some((d) => d.venueShowId === vid);
    if (alreadyOpen) {
      // Bring existing window to front if possible; display has its own Supabase subscription
      return;
    }
    const name = localStorage.getItem("tv_venueName") || "";
    const url = `${window.location.origin}?display&venueShowId=${vid}&venueName=${encodeURIComponent(name)}&hostId=${hostId}&hostName=${encodeURIComponent(hostName)}`;
    const win = window.open(url, `display:${vid}`, "width=1920,height=1080,location=no,toolbar=no,menubar=no,status=no");
    if (win) win.focus();
  }, [activeDisplays, hostId, hostName]);

  // Select a venue — sets channel, persists, opens controls + display window
  const selectVenue = useCallback((vid, name) => {
    setVenueShowId(vid);
    setVenueName(name);
    localStorage.setItem("tv_venueShowId", vid);
    localStorage.setItem("tv_venueName", name);
    setVenuePickerOpen(false);
    // Clear stale display state only if no active show is already running on this venue
    const isLive = activeDisplays.some((d) => d.venueShowId === vid);
    if (!isLive) {
      const newVenueId = vid.replace(/:\d{4}-\d{2}-\d{2}$/, "");
      const standbyPayload = { type: "standby", content: null };
      setLiveDisplayState(standbyPayload);
      fetch("/.netlify/functions/supaUpsertDisplayState", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: newVenueId, venueName: name, state: standbyPayload }),
      }).catch((err) => console.error("[selectVenue] standby upsert failed:", err));
    }
    openDisplayWindow(vid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDisplayWindow, activeDisplays]);

  // Open venue picker — fetch today's venues then show modal
  const openVenuePicker = useCallback(() => {
    setVenuePickerOpen(true);
    setVenuePickerLoading(true);
    fetch("/.netlify/functions/fetchVenuesToday")
      .then((r) => r.json())
      .then((data) => {
        setVenuePickerOptions(data.venues || []);
        setVenuePickerLoading(false);
      })
      .catch(() => {
        setVenuePickerOptions([]);
        setVenuePickerLoading(false);
      });
  }, []);

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
    if (showBundle.config?.showId !== selectedShowId) return; // Bundle hasn't caught up to selected show yet
    if (supabaseSettingsLoadedRef.current?.showId === selectedShowId) return;

    const loadOrCreateSettings = async () => {
      try {
        console.log(
          "🔵 SUPABASE SETTINGS: Checking for existing settings...",
          selectedShowId,
        );
        const res = await fetch(
          `/.netlify/functions/supaLoadShowSettings?showId=${encodeURIComponent(selectedShowId)}`,
        );
        if (!res.ok) {
          console.error("Failed to load show settings:", await res.text());
          return;
        }
        const { settings, exists } = await res.json();

        supabaseSettingsLoadedRef.current = {
          showId: selectedShowId,
          exists,
          applied: false,
        };

        if (exists && settings) {
          // Supabase has settings - use them, but always override scoring config from Airtable
          // since Airtable is the authoritative source for scoring type/points
          console.log(
            "🔵 SUPABASE SETTINGS: Found existing settings, applying",
            settings,
          );
          console.log(
            "🔵 SUPABASE SETTINGS: prizes value =",
            JSON.stringify(settings.prizes),
          );
          const config = showBundle?.config || {};
          const mergedSettings = { ...settings };
          if (config.scoringMode) {
            const mode = config.scoringMode.toLowerCase().replace(/[\s()]/g, "");
            if (mode === "pub") mergedSettings.scoring_mode = "pub";
            else if (mode === "pooledadaptive" || mode === "adaptive") mergedSettings.scoring_mode = "pooled-adaptive";
            else if (mode === "pooled" || mode === "pooledstatic") mergedSettings.scoring_mode = "pooled";
          }
          if (typeof config.pubPoints === "number") mergedSettings.pub_points = config.pubPoints;
          if (typeof config.poolPerQuestion === "number") mergedSettings.pool_per_question = config.poolPerQuestion;
          if (typeof config.poolContribution === "number") mergedSettings.pool_contribution = config.poolContribution;
          applySettings(mergedSettings);
          supabaseSettingsLoadedRef.current.applied = true;
        } else {
          // No Supabase settings - create from Airtable config
          console.log(
            "🔵 SUPABASE SETTINGS: No existing settings, creating from Airtable config",
          );
          const config = showBundle?.config || {};

          // Build settings from Airtable config
          const newSettings = {};

          if (config.scoringMode) {
            const mode = config.scoringMode
              .toLowerCase()
              .replace(/[\s()]/g, "");
            if (mode === "pub") newSettings.scoring_mode = "pub";
            else if (mode === "pooledadaptive" || mode === "adaptive")
              newSettings.scoring_mode = "pooled-adaptive";
            else if (mode === "pooled" || mode === "pooledstatic")
              newSettings.scoring_mode = "pooled";
          }
          if (typeof config.pubPoints === "number")
            newSettings.pub_points = config.pubPoints;
          if (typeof config.poolPerQuestion === "number")
            newSettings.pool_per_question = config.poolPerQuestion;
          if (typeof config.poolContribution === "number")
            newSettings.pool_contribution = config.poolContribution;
          if (typeof config.timerDefault === "number")
            newSettings.timer_default = config.timerDefault;
          if (config.prizes) newSettings.prizes = config.prizes;
          if (config.hostName) newSettings.host_name = config.hostName;
          if (config.cohostName) newSettings.cohost_name = config.cohostName;
          if (config.location) newSettings.location_name = config.location;
          if (config.startTime) newSettings.start_times = config.startTime;
          if (config.announcements)
            newSettings.announcements = config.announcements;
          if (typeof config.totalGames === "number")
            newSettings.total_games = config.totalGames;

          // Save to Supabase
          if (Object.keys(newSettings).length > 0) {
            console.log(
              "🔵 SUPABASE SETTINGS: Saving initial settings from Airtable",
              newSettings,
            );
            await fetch("/.netlify/functions/supaSaveShowSettings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                showId: selectedShowId,
                settings: newSettings,
              }),
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
        if (settings.location_name)
          updatedHostInfo.location = settings.location_name;
        if (typeof settings.total_games === "number")
          updatedHostInfo.totalGames = String(settings.total_games);
        if (settings.start_times)
          updatedHostInfo.startTimesText = settings.start_times;
        if (settings.announcements)
          updatedHostInfo.announcements = settings.announcements;

        const finalPrizes = settings.prizes || show.prizes || "";
        console.log(
          "🔵 APPLY SETTINGS: Setting prizes in scoringCache =",
          JSON.stringify(finalPrizes),
        );

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

    console.log(
      "🟣 SUPABASE REALTIME: Subscribing to show_settings for show",
      selectedShowId,
    );
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
            else if (mode === "pooled-adaptive")
              setScoringMode("pooled-adaptive");
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
            const currentHostInfo =
              show.hostInfo || DEFAULT_SHOW_STATE.hostInfo;

            const updatedHostInfo = { ...currentHostInfo };
            if (settings.host_name !== undefined)
              updatedHostInfo.host = settings.host_name || "";
            if (settings.cohost_name !== undefined)
              updatedHostInfo.cohost = settings.cohost_name || "";
            if (settings.location_name !== undefined)
              updatedHostInfo.location = settings.location_name || "";
            if (settings.total_games !== undefined)
              updatedHostInfo.totalGames = settings.total_games
                ? String(settings.total_games)
                : "";
            if (settings.start_times !== undefined)
              updatedHostInfo.startTimesText = settings.start_times || "";
            if (settings.announcements !== undefined)
              updatedHostInfo.announcements = settings.announcements || "";

            return {
              ...prev,
              [selectedShowId]: {
                ...show,
                hostInfo: updatedHostInfo,
                ...(settings.prizes !== undefined && {
                  prizes: settings.prizes || "",
                }),
              },
            };
          });
        },
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
      console.log(
        "🟡 SUPABASE SETTINGS SAVE SKIPPED: Settings not loaded yet for this show",
      );
      return;
    }
    if (!supabaseSettingsLoadedRef.current?.applied) {
      console.log(
        "🟡 SUPABASE SETTINGS SAVE SKIPPED: Settings loaded but not yet applied",
      );
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

  // Keep previewRowH in sync with actual rendered height of the preview row
  useEffect(() => {
    if (!previewRowRef.current) return;
    const ro = new ResizeObserver(([entry]) => setPreviewRowH(entry.contentRect.height));
    ro.observe(previewRowRef.current);
    return () => ro.disconnect();
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

    // AUDIO STATUS from another host
    ch.on("broadcast", { event: "audioStatus" }, (msg) => {
      const data = msg?.payload ?? msg;
      const { playing, hostName: remoteHost } = data || {};
      // Only show if it's a different host
      if (remoteHost && remoteHost !== hostName) {
        setRemoteAudioStatus(playing ? { playing: true, hostName: remoteHost } : null);
      }
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
        const [res, teamsRes] = await Promise.all([
          fetch(`/.netlify/functions/supaLoadScoring?showId=${encodeURIComponent(selectedShowId)}`),
          fetch(`/.netlify/functions/supaLoadShowTeams?showId=${encodeURIComponent(selectedShowId)}`),
        ]);
        console.log("[supaLoadScoring] Response status:", res.status);
        const json = await res.json();
        const teamsJson = teamsRes.ok ? await teamsRes.json() : null;
        console.log("[supaLoadScoring] Response data:", json);
        console.log("[supaLoadScoring] Payload:", json.payload);

        // Build a map of fresh showBonus values from show_teams (source of truth for bonus)
        const freshBonusMap = {};
        for (const t of teamsJson?.teams ?? []) {
          freshBonusMap[t.showTeamId] = t.showBonus ?? 0;
        }

        setScoringCache((prev) => {
          const prevShow = prev[selectedShowId] || DEFAULT_SHOW_STATE;
          const loadedData = json.payload ?? prevShow;

          // Merge fresh showBonus values into the loaded teams
          if (loadedData?.teams) {
            loadedData.teams = loadedData.teams.map((t) =>
              freshBonusMap[t.showTeamId] !== undefined
                ? { ...t, showBonus: freshBonusMap[t.showTeamId] }
                : t,
            );
          }

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
      isRefreshingBundleRef.current = true;
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
          })),
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
          console.log("🟢 SUPABASE SETTINGS SAVE (hostInfo/prizes):", {
            hostInfo: hi,
            prizes: prizesVal,
          });
          fetch("/.netlify/functions/supaSaveShowSettings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              showId: showIdForSave,
              settings: {
                host_name: hi.host || null,
                cohost_name: hi.cohost || null,
                location_name: hi.location || null,
                total_games: hi.totalGames
                  ? parseInt(hi.totalGames, 10) || null
                  : null,
                start_times: hi.startTimesText || null,
                announcements: hi.announcements || null,
                prizes: prizesVal || null,
              },
              updatedBy: window.localStorage.getItem("hostDevice") || "unknown",
            }),
          })
            .then((res) => {
              if (res.ok)
                console.log(
                  "🟢 SUPABASE SETTINGS SAVE SUCCESS (hostInfo/prizes)",
                );
              else
                console.error(
                  "Failed to save hostInfo/prizes to show_settings",
                );
            })
            .catch((err) =>
              console.error(
                "supaSaveShowSettings (hostInfo/prizes) error:",
                err,
              ),
            );
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

  // 🔸 Results navigation — standings & prizes computation (mirrors ResultsMode logic)
  const resultsOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  };

  const resultsPrizes = useMemo(() => {
    return (composedCachedState?.prizes || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }, [composedCachedState]);
  const resultsPrizeCount = resultsPrizes.length;

  // Flatten all scored questions from all rounds (mirrors ResultsMode.allQuestions)
  // Only pulls from categories, not flat r.questions (which are host-added tiebreakers)
  const resultsAllQuestions = useMemo(() => {
    if (!showBundle?.rounds) return [];
    const qs = [];
    for (const r of showBundle.rounds) {
      for (const cat of r.categories || []) {
        for (const q of cat.questions || []) {
          qs.push({
            showQuestionId: q.showQuestionId || q.id,
            questionType: q.questionType || null,
            questionOrder: q.questionOrder,
            sortOrder: Number(q.sortOrder ?? 9999),
            bonusAvailable: !!q.bonusAvailable,
            bonusValue: q.bonusValue ?? 0,
            maxBonuses: q.maxBonuses ?? 0,
            partialCreditAvailable: !!q.partialCreditAvailable,
            numParts: typeof q.numParts === "number" ? q.numParts : 0,
            pubPerQuestion: typeof q.pointsPerQuestion === "number" ? q.pointsPerQuestion : null,
          });
        }
      }
    }
    return qs;
  }, [showBundle]);

  // Detect show-wide tiebreaker question
  const resultsTbQ = useMemo(() => {
    if (!showBundle?.rounds) return null;
    for (const r of showBundle.rounds) {
      for (const q of r.questions || []) {
        const t = (q.questionType || "").toLowerCase();
        if (t === "tiebreaker" || String(q.questionOrder).toUpperCase() === "TB" || String(q.id || "").startsWith("tb-"))
          return q;
      }
      for (const cat of r.categories || []) {
        for (const q of cat.questions || []) {
          const t = (q.questionType || "").toLowerCase();
          if (t === "tiebreaker" || String(q.questionOrder).toUpperCase() === "TB" || String(q.id || "").startsWith("tb-"))
            return q;
        }
      }
    }
    return null;
  }, [showBundle]);

  // Parse numeric answer from tiebreaker question
  const resultsTbNumber = useMemo(() => {
    if (!resultsTbQ) return null;
    if (typeof resultsTbQ.tiebreakerNumber === "number" && Number.isFinite(resultsTbQ.tiebreakerNumber))
      return resultsTbQ.tiebreakerNumber;
    const pick = (v) => (Array.isArray(v) ? v[0] : v);
    const raw = pick(resultsTbQ.tiebreakerNumber)?.trim() ||
      pick(resultsTbQ.answer)?.trim() ||
      resultsTbQ.answerText?.trim() ||
      resultsTbQ.correctAnswer?.trim() || null;
    if (!raw) return null;
    const m = String(raw).replace(/[\s,]/g, "").match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }, [resultsTbQ]);

  // Compute standings (same logic as ResultsMode)
  const resultsStandings = useMemo(() => {
    const teams = composedCachedState?.teams || [];
    const grid = composedCachedState?.grid || {};
    if (!teams.length || !resultsAllQuestions.length) return [];

    // Adapt grid format
    const adaptedGrid = {};
    for (const teamId in grid) {
      adaptedGrid[teamId] = {};
      for (const qId in grid[teamId]) {
        const cell = grid[teamId][qId];
        adaptedGrid[teamId][qId] = { isCorrect: cell.isCorrect, bonusCount: cell.bonusCount || 0, partialCount: cell.partialCount ?? 0 };
      }
    }

    const tbQId = resultsTbQ?.showQuestionId || resultsTbQ?.id;
    const scoringQuestions = tbQId
      ? resultsAllQuestions.filter(q => q.showQuestionId !== tbQId)
      : resultsAllQuestions;

    const scoringConfig = { mode: scoringMode, pubPoints: Number(pubPoints || 0), poolPerQuestion: Number(poolPerQuestion || 0), poolContribution: Number(poolContribution || 0), teamCount: teams.length };
    const nCorrectByQ = buildCorrectCountMap(teams, scoringQuestions, adaptedGrid);
    const totalByTeam = buildTeamTotals(teams, scoringQuestions, adaptedGrid, scoringConfig, nCorrectByQ);

    const getTbGuess = (showTeamId) => {
      if (!resultsTbQ) return null;
      const cell = grid[showTeamId]?.[tbQId];
      const v = cell?.tiebreakerGuess;
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    };

    const rows = teams.map(t => {
      const total = +(totalByTeam[t.showTeamId] ?? 0);
      const guess = getTbGuess(t.showTeamId);
      const delta = resultsTbNumber !== null && guess !== null ? Math.abs(guess - resultsTbNumber) : Infinity;
      return {
        showTeamId: t.showTeamId,
        teamName: t.teamName || "(Unnamed team)",
        total,
        tbGuess: guess,
        tbDelta: delta,
        tieBroken: false,
        unbreakableTie: false,
        _tbGroupBroken: false,
        _tbRank: 0,
      };
    });

    rows.sort((a, b) => b.total - a.total || a.teamName.localeCompare(b.teamName, "en", { sensitivity: "base" }));
    const places = computePlaces(totalByTeam);
    for (const r of rows) r.place = places[r.showTeamId];

    if (!resultsPrizeCount || resultsTbNumber === null || !resultsTbQ) return rows;

    // Identify tie groups and reorder by tbDelta within prize band
    const groups = [];
    let idx = 0;
    while (idx < rows.length) {
      const gStart = idx, tot = rows[idx].total;
      idx++;
      while (idx < rows.length && rows[idx].total === tot) idx++;
      groups.push([gStart, idx]);
    }

    for (const [gStart, gEnd] of groups) {
      if (gStart >= resultsPrizeCount || gStart < 0) continue;
      const slice = rows.slice(gStart, gEnd);
      if (!slice.some(r => Number.isFinite(r.tbDelta))) continue;
      slice.sort((a, b) => {
        if (a.total !== b.total) return 0;
        if (a.tbDelta !== b.tbDelta) return a.tbDelta - b.tbDelta;
        return a.teamName.localeCompare(b.teamName, "en", { sensitivity: "base" });
      });
      const best = slice[0]?.tbDelta, second = slice[1]?.tbDelta;
      const groupBroken = slice.length > 1 && Number.isFinite(best) && Number.isFinite(second) && best !== second;
      slice.forEach((r, k) => { r.tieBroken = true; r._tbGroupBroken = !!groupBroken; r._tbRank = k; });
      if (slice.length > 1 && Number.isFinite(best)) {
        const topTied = slice.filter(r => r.tbDelta === best);
        if (topTied.length > 1) topTied.forEach(r => (r.unbreakableTie = true));
      }
      for (let k = 0; k < slice.length; k++) rows[gStart + k] = slice[k];
    }

    // Re-assign places after TB reordering
    let prevKey = null, place = 0, cnt = 0;
    for (const r of rows) {
      cnt++;
      const tieKey = r._tbGroupBroken ? `${r.total}|${r._tbRank}` : `${r.total}|`;
      if (prevKey === null || tieKey !== prevKey) { place = cnt; prevKey = tieKey; }
      r.place = place;
    }
    return rows;
  }, [composedCachedState, resultsAllQuestions, resultsTbQ, resultsTbNumber, resultsPrizeCount, scoringMode, pubPoints, poolPerQuestion, poolContribution]);

  const resultsTiebreakerWasUsed = useMemo(
    () => resultsStandings.some(r => r.place <= resultsPrizeCount && r._tbGroupBroken),
    [resultsStandings, resultsPrizeCount],
  );

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
              ...((edit.notes !== undefined || edit.questionNotes !== undefined) && {
                questionNotes: edit.notes ?? edit.questionNotes,
              }),
              ...(edit.pronunciationGuide !== undefined && {
                questionPronunciationGuide: edit.pronunciationGuide,
              }),
              ...(edit.answer !== undefined && { answer: edit.answer }),
              ...(edit.answerNotes !== undefined && {
                answerNotes: edit.answerNotes,
              }),
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
            ...(edit.questionNotes !== undefined && {
              questionNotes: edit.questionNotes,
            }),
            ...(edit.pronunciationGuide !== undefined && {
              questionPronunciationGuide: edit.pronunciationGuide,
            }),
            ...(edit.answer !== undefined && { answer: edit.answer }),
            ...(edit.questionNotes !== undefined && {
              questionNotes: edit.questionNotes,
            }),
            ...(edit.answerNotes !== undefined && {
              answerNotes: edit.answerNotes,
            }),
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

  // Build a flat ordered list of display nav items for the selected round
  const navFlatList = useMemo(() => {
    if (!showBundleWithEdits?.rounds) return [];
    const round = showBundleWithEdits.rounds.find(
      (r) => String(r.round) === String(selectedRoundId),
    );
    if (!round) return [];

    const sorted = [...(round.categories || [])].sort((a, b) => {
      const av = (a.questionType || "").toLowerCase().includes("visual")
        ? 1
        : 0;
      const bv = (b.questionType || "").toLowerCase().includes("visual")
        ? 1
        : 0;
      if (av !== bv) return bv - av; // visuals first
      return (a.categoryOrder ?? 999) - (b.categoryOrder ?? 999);
    });

    // Collect visual questions for carousel item
    const visualQuestions = [];
    for (const cat of sorted) {
      if ((cat.questionType || "").toLowerCase().includes("visual")) {
        const qs = [...(cat.questions || [])].sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
        );
        for (const q of qs) {
          visualQuestions.push({
            questionNumber: q.questionOrder,
            questionText: q.questionText || "",
            categoryName: (cat.categoryName || "").trim(),
            inlineImages: Array.isArray(q.questionImages)
              ? q.questionImages.map((img) => ({ url: img.url }))
              : [],
            currentInlineImageIndex: 0,
          });
        }
      }
    }

    const items = [];

    // In Questions mode: carousel first (if visual questions exist), then spoken categories/questions
    // In Answers mode: all questions in order (visual included), no carousel item, no category items
    // navFlatList serves Questions mode; navQuestionList (derived below) serves Answers mode.
    // We always build the full list here; navQuestionList filters it.

    if (visualQuestions.length > 0) {
      items.push({
        type: "carousel",
        label: "Visual question carousel",
        visualQuestions,
      });
    }

    for (const cat of sorted) {
      const isVisual = (cat.questionType || "")
        .toLowerCase()
        .includes("visual");
      const isTiebreaker =
        (cat.questionType || "").toLowerCase() === "tiebreaker";

      // In Questions mode, skip visual categories (they're in the carousel)
      // Tiebreaker categories are always included
      if (!isVisual) {
        items.push({
          type: "category",
          categoryName: (cat.categoryName || "").trim(),
          categoryDescription: cat.categoryDescription || "",
          isTiebreaker,
          superSecret: !!cat.superSecret,
          questionType: (cat.questionType || "").toLowerCase(),
          categoryAudio: Array.isArray(cat.categoryAudio)
            ? cat.categoryAudio.filter((a) => a?.url)
            : [],
        });
      }

      const questions = [...(cat.questions || [])].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );
      for (const q of questions) {
        items.push({
          type: "question",
          isVisual,
          isTiebreaker,
          showQuestionId: q.showQuestionId,
          questionNumber: q.questionOrder,
          questionText: q.questionText || "",
          answer: q.answer || "",
          categoryName: (cat.categoryName || "").trim(),
          superSecret: !!cat.superSecret,
          bonusAvailable: !!q.bonusAvailable,
          bonusValue: q.bonusValue || null,
          maxBonuses: q.maxBonuses || null,
          partialCreditAvailable: !!q.partialCreditAvailable,
          numParts: typeof q.numParts === "number" ? q.numParts : null,
          showImageByDefault: !!q.showImageByDefault,
          autoRevealAnswerImage: !!q.autoRevealAnswerImage,
          inlineImages: Array.isArray(q.questionImages)
            ? q.questionImages.map((img) => ({ url: img.url }))
            : [],
          questionNotes: q.questionNotes || "",
          pronunciationGuide: q.questionPronunciationGuide || "",
          answerNotes: q.answerNotes || "",
          questionAudio: Array.isArray(q.questionAudio)
            ? q.questionAudio.filter((a) => a?.url)
            : [],
        });
      }
    }

    return items;
  }, [showBundleWithEdits, selectedRoundId]);

  // Questions mode nav: carousel + non-visual categories + all questions (minus visual)
  // Visual questions are handled by the carousel item, not individually
  const navQuestionsMode = useMemo(
    () =>
      navFlatList.filter(
        (item) =>
          item.type === "carousel" ||
          item.type === "category" ||
          (item.type === "question" && !item.isVisual),
      ),
    [navFlatList],
  );

  // Answers mode nav: all questions in order (visual included, no category/carousel items, no tiebreakers)
  const navQuestionList = useMemo(
    () => navFlatList.filter((item) => item.type === "question" && !item.isTiebreaker),
    [navFlatList],
  );

  // Build the ordered results-reveal nav sequence from last place to first.
  // Each place reveal is TWO steps: place+points first (no teams), then teams added.
  // Step types: "results-splash" | "results-scramble" | "results-tb-combined" |
  //             "results-place-pts" (place+pts, no teams) | "results-place-reveal" (place+pts+teams)
  const resultsNavSequence = useMemo(() => {
    const steps = [];
    if (!resultsStandings.length) return steps;

    // Step 1: splash screen
    steps.push({ type: "results-splash" });

    // Unique total values, sorted ascending (last place → first place)
    const uniqueTotals = [...new Set(resultsStandings.map(r => r.total))].sort((a, b) => a - b);

    const roundNums = (showBundle?.rounds || []).map(r => Number(r.round));
    const maxRound = roundNums.length ? Math.max(...roundNums) : 0;
    const isFinalRound = resultsPrizeCount > 0 && Number(selectedRoundId) === maxRound;

    for (const total of uniqueTotals) {
      const group = resultsStandings.filter(r => r.total === total);
      const highestPlace = Math.min(...group.map(r => r.place));
      const placeStr = resultsOrdinal(highestPlace);
      const isTied = group.length > 1;
      const prize = isFinalRound && highestPlace <= resultsPrizeCount
        ? (isTied ? `Vying for ${resultsPrizes[highestPlace - 1] || ""}` : resultsPrizes[highestPlace - 1] || "")
        : null;

      // In final round, check if tiebreaker was used within this total group
      const anyTbBroken = isFinalRound && group.some(r => r._tbGroupBroken);

      if (anyTbBroken && resultsTiebreakerWasUsed) {
        // Scramble, then TB question, then TB answer, then individual sub-place reveals
        const tbAnswerText = resultsTbQ ? (
          Array.isArray(resultsTbQ.answer) ? resultsTbQ.answer[0] : (resultsTbQ.answer || resultsTbQ.answerText || resultsTbQ.correctAnswer || "")
        ) : "";
        steps.push({
          type: "results-scramble",
          place: placeStr,
          teams: [...group.map(r => r.teamName)].sort(() => Math.random() - 0.5),
          points: total,
          prize: prize,
        });
        steps.push({
          type: "results-tb-question",
          tbQuestion: resultsTbQ?.questionText || "",
          tbTeamsAndGuesses: group.map(r => ({ teamName: r.teamName, guess: r.tbGuess })),
        });
        steps.push({
          type: "results-tb-answer",
          tbQuestion: resultsTbQ?.questionText || "",
          tbAnswer: tbAnswerText,
          tbTeamsAndGuesses: group.map(r => ({ teamName: r.teamName, guess: r.tbGuess })),
        });
        // After the TB reveal the crowd already knows the points, so go straight to team reveal
        const subPlaces = [...new Set(group.map(r => r.place))].sort((a, b) => b - a);
        for (const place of subPlaces) {
          const atPlace = group.filter(r => r.place === place);
          const subPlaceStr = resultsOrdinal(place);
          const subPrize = place <= resultsPrizeCount ? resultsPrizes[place - 1] || "" : null;
          const subIsTied = atPlace.length > 1;
          steps.push({ type: "results-place-reveal", place: subPlaceStr, teams: atPlace.map(r => r.teamName), isTied: subIsTied, points: total, prize: subPrize });
        }
      } else {
        // Simple two-step reveal: place+pts, then teams
        steps.push({ type: "results-place-pts", place: placeStr, points: total, isTied, prize: prize || null });
        steps.push({ type: "results-place-reveal", place: placeStr, teams: group.map(r => r.teamName), isTied, points: total, prize: prize || null });
      }
    }

    return steps;
  }, [resultsStandings, resultsPrizes, resultsPrizeCount, resultsTiebreakerWasUsed, resultsTbQ, resultsTbNumber, showBundle, selectedRoundId]);

  // Rules items as nav prefix — full list or just phoneAway
  const navRulesPrefix = useMemo(
    () => RULES_ITEMS.map((item) => ({ type: "rules", ...item })),
    [],
  );
  const phoneAwayPrefix = useMemo(
    () => [{ type: "rules", ...PHONE_AWAY_ITEM }],
    [],
  );

  // Combined Questions mode list: rules prefix + show content
  const navWithRules = useMemo(() => {
    const prefix = rulesStartedWithScript ? navRulesPrefix : phoneAwayPrefix;
    return [...prefix, ...navQuestionsMode];
  }, [rulesStartedWithScript, navQuestionsMode, navRulesPrefix, phoneAwayPrefix]);

  // When the tiebreaker was NOT used to break a tie, insert it between the last regular
  // question and the results sequence so the host can reveal it as a standalone bonus round.
  // The normal stage logic (0=question, 1=answer) handles the two-step reveal;
  // stage 2 (stats) is already skipped for tiebreaker items in pushNavQuestion.
  const navTiebreakerSteps = useMemo(() => {
    if (!resultsTbQ || resultsTiebreakerWasUsed) return [];
    const roundNums = (showBundle?.rounds || []).map(r => Number(r.round));
    const maxRound = roundNums.length ? Math.max(...roundNums) : 0;
    const isFinalRound = resultsPrizeCount > 0 && Number(selectedRoundId) === maxRound;
    if (!isFinalRound) return [];
    const tbItem = navFlatList.find(i => i.type === "question" && i.isTiebreaker);
    if (!tbItem) return [];
    return [tbItem];
  }, [resultsTbQ, resultsTiebreakerWasUsed, showBundle, resultsPrizeCount, selectedRoundId, navFlatList]);

  // Answers mode list: questions + optional tiebreaker reveal + results sequence
  const navAnswersModeList = useMemo(
    () => [...navQuestionList, ...navTiebreakerSteps, ...resultsNavSequence],
    [navQuestionList, navTiebreakerSteps, resultsNavSequence],
  );

  // Grid of categories + questions for Mission Control direct navigation
  const navGrid = useMemo(() => {
    const rows = [];
    let currentRow = null;
    for (const item of navFlatList) {
      if (item.type === "category" || item.type === "carousel") {
        currentRow = { catItem: item, questions: [] };
        rows.push(currentRow);
      } else if (item.type === "question" && currentRow) {
        currentRow.questions.push(item);
      }
    }
    return rows;
  }, [navFlatList]);

  // Reset nav position when show or round changes (but NOT on bundle refresh)
  useEffect(() => {
    if (isRefreshingBundleRef.current) {
      isRefreshingBundleRef.current = false;
      return; // bundle refresh — keep nav position and display as-is
    }
    setNavIndex(0);
    setNavAnswerStage(0);
    setNavStarted(false);
    setRulesStartedWithScript(false);
  }, [showBundle, selectedRoundId]);

  // Push a questions-mode item to the display
  const pushNavItem = useCallback(
    (item) => {
      if (!item) return;
      if (item.type === "rules") {
        sendToDisplay("message", { text: item.text, fontSize: item.fontSize || 119 });
        return;
      }
      if (item.type === "carousel") {
        sendToDisplay("questionCarousel", {
          questions: item.visualQuestions,
          currentIndex: 0,
          autoCycle: true,
        });
        setCarouselActive(true);
      } else {
        // Close carousel if it was open
        if (carouselActive) {
          sendToDisplay("closeQuestionCarousel", null);
          setCarouselActive(false);
        }
      }
      if (item.type === "category") {
        sendToDisplay("category", {
          categoryName: item.categoryName,
          categoryDescription: item.categoryDescription,
          superSecret: !!item.superSecret,
        });
      } else if (item.type === "question") {
        const payload = {
          questionNumber: item.questionNumber,
          questionText: item.questionText,
          categoryName: item.categoryName,
        };
        if (item.showImageByDefault && item.inlineImages?.length > 0) {
          payload.inlineImages = item.inlineImages;
          payload.currentInlineImageIndex = 0;
        }
        sendToDisplay("question", payload);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [carouselActive],
  );

  // Push an answers-mode question at a given stage (0=question, 1=answer, 2=stats)
  // imageVisible: explicit override — pass navImageVisible when staying on same question, false when moving to a new one
  const pushNavQuestion = useCallback(
    (item, stage, imageVisible = false) => {
      if (!item) return;
      const payload = {
        questionNumber: item.questionNumber,
        questionText: item.questionText,
        categoryName: item.categoryName,
      };
      if ((item.showImageByDefault || imageVisible) && item.inlineImages?.length > 0) {
        payload.inlineImages = item.inlineImages;
        // Auto-reveal answer image overrides manual index; otherwise use current navImageIndex
        if (item.showImageByDefault && item.autoRevealAnswerImage && item.inlineImages.length >= 2) {
          payload.currentInlineImageIndex = stage >= 1 ? 1 : 0;
        } else {
          payload.currentInlineImageIndex = navImageIndex;
        }
      }
      if (stage >= 1) {
        payload.answer = item.answer;
      }
      if (stage >= 2 && !item.isTiebreaker) {
        const grid = composedCachedState?.grid || {};
        const teams = composedCachedState?.teams || [];
        let correctCount = 0;
        for (const team of teams) {
          if (
            grid[team.showTeamId]?.[item.showQuestionId]?.isCorrect === true
          ) {
            correctCount++;
          }
        }
        const scoringObj = {
          mode: scoringMode,
          pubPoints,
          poolPerQuestion,
          poolContribution,
          teamCount: teams.length,
        };
        const questionBonus = item.bonusAvailable
          ? { bonusValue: item.bonusValue, maxBonuses: item.maxBonuses }
          : null;
        const questionPartial = item.partialCreditAvailable && item.numParts > 0
          ? { numParts: item.numParts }
          : null;
        payload.correctCount = correctCount;
        payload.totalTeams = teams.length;
        if (scoringMode !== "pub") {
          payload.pointsPerTeam = computeAutoEarned(
            { isCorrect: true },
            scoringObj,
            correctCount,
          );
        }
        payload.bonusBreakdown = computeBonusBreakdown(
          teams,
          grid,
          item.showQuestionId,
          scoringObj,
          correctCount,
          questionBonus,
        );
        payload.partialBreakdown = computePartialBreakdown(
          teams,
          grid,
          item.showQuestionId,
          scoringObj,
          correctCount,
          questionPartial,
        );
      }
      sendToDisplay("question", payload);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      composedCachedState,
      scoringMode,
      pubPoints,
      poolPerQuestion,
      poolContribution,
      navImageIndex,
    ],
  );

  // Push a results-reveal step to the display
  const pushResultsStep = useCallback((step) => {
    if (!step) return;
    if (step.type === "results-splash") {
      sendToDisplay("results-splash", {});
      return;
    }
    if (step.type === "results-scramble") {
      const scrambled = [...(step.teams || [])].sort(() => Math.random() - 0.5);
      sendToDisplay("results", { place: step.place, teams: scrambled, isTied: true, points: step.points, prize: step.prize || null });
      return;
    }
    if (step.type === "results-tb-question") {
      sendToDisplay("results-tb-question", { tbQuestion: step.tbQuestion });
      return;
    }
    if (step.type === "results-tb-answer") {
      sendToDisplay("results-tb-answer", {
        tbQuestion: step.tbQuestion,
        tbAnswer: step.tbAnswer,
        tbTeamsAndGuesses: step.tbTeamsAndGuesses,
      });
      return;
    }
    if (step.type === "results-place-pts") {
      // Place + points only — no team names yet
      sendToDisplay("results", { place: step.place, teams: null, isTied: step.isTied, points: step.points, prize: step.prize || null });
      return;
    }
    if (step.type === "results-place-reveal") {
      // Place + points + team names
      sendToDisplay("results", { place: step.place, teams: step.teams, isTied: step.isTied, points: step.points, prize: step.prize || null });
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Host Script (moved from Sidebar.js) ──────────────────────────────────
  const scriptPanelRef = useRef(null);
  const [scriptPanelPosition, setScriptPanelPosition] = useState(() => {
    try { const s = localStorage.getItem("scriptPanelPosition"); return s ? JSON.parse(s) : { x: 80, y: 80 }; }
    catch { return { x: 80, y: 80 }; }
  });

  const _isTBQuestion = (q) => {
    const t = String(q?.questionType || q?.["Question type"] || "").toLowerCase();
    const o = String(q?.questionOrder || q?.["Question order"] || "").toUpperCase();
    return t === "tiebreaker" || o === "TB";
  };
  const _scriptAllRounds = useMemo(() => showBundleWithEdits?.rounds ?? [], [showBundleWithEdits?.rounds]);
  const _scriptTotalQ = useMemo(() => {
    let c = 0;
    for (const r of _scriptAllRounds) {
      for (const q of r?.questions || []) { if (!String(q?.questionType||"").toLowerCase().includes("tiebreaker")) c++; }
      for (const cat of r?.categories || []) {
        for (const q of cat?.questions || []) {
          const t = String(q?.questionType||cat?.questionType||"").toLowerCase();
          if (!t.includes("tiebreaker") && String(q?.questionOrder||"").toUpperCase() !== "TB") c++;
        }
      }
    }
    return c;
  }, [_scriptAllRounds]);
  const _scriptMultiGame = useMemo(() => {
    const s = (showBundleWithEdits?.Show?.Show || showBundleWithEdits?.showName || "").trim();
    const m1 = s.match(/^\s*\d{4}-\d{2}-\d{2}\s+Game\s+(\d+)\s*@\s*(.+)\s*$/i);
    if (m1) return { isMultiNight: true, gameIndex: parseInt(m1[1],10), venue: m1[2].trim() };
    const m2 = s.match(/^\s*\d{4}-\d{2}-\d{2}\s*@\s*(.+)\s*$/);
    return { isMultiNight: false, gameIndex: null, venue: m2?.[1]?.trim() || "" };
  }, [showBundleWithEdits?.Show, showBundleWithEdits?.showName]);
  const _scriptPrizeList = useMemo(() => {
    const raw = (composedCachedState?.prizes || "").toString();
    const parts = raw.includes("\n") ? raw.split(/\r?\n/) : raw.split(/,\s*/);
    return parts.map(s => s.trim()).filter(Boolean);
  }, [composedCachedState?.prizes]);
  const _ordinal = (n) => { const j=n%10,k=n%100; if(j===1&&k!==11)return`${n}st`; if(j===2&&k!==12)return`${n}nd`; if(j===3&&k!==13)return`${n}rd`; return`${n}th`; };
  const hostScript = useMemo(() => {
    const X = _scriptTotalQ;
    const hName = (composedCachedState?.hostInfo?.host || showBundleWithEdits?.config?.hostName || "your host").trim();
    const cName = (composedCachedState?.hostInfo?.cohost || showBundleWithEdits?.config?.cohostName || "your co-host").trim();
    const loc = (composedCachedState?.hostInfo?.location || showBundleWithEdits?.config?.location || _scriptMultiGame.venue || "your venue").trim();
    const totalGamesFromConfig = showBundleWithEdits?.config?.totalGamesThisNight;
    const totalGamesInput = Number(composedCachedState?.hostInfo?.totalGames);
    const totalGames = (Number.isFinite(totalGamesFromConfig) && totalGamesFromConfig > 0) ? totalGamesFromConfig : (Number.isFinite(totalGamesInput) && totalGamesInput > 0) ? totalGamesInput : 1;
    const isMultiGame = totalGames >= 2;
    const configStartTimes = showBundleWithEdits?.config?.allStartTimes || [];
    const manualStartTimes = (composedCachedState?.hostInfo?.startTimesText || "").split(/[,;\n]/).map(t => t.trim()).filter(Boolean);
    const startTimes = configStartTimes.length > 0 ? configStartTimes : manualStartTimes;
    const isTipsy = (showBundleWithEdits?.config?.showTemplate || "").toLowerCase().includes("tipsy");
    let visualQ=0, spokenQ=0, audioQ=0, visualCat=0, spokenCat=0; const spokenSizes=[];
    for (const r of _scriptAllRounds) {
      for (const cat of r?.categories || []) {
        const ct = String(cat?.questionType||cat?.["Question type"]||"").toLowerCase();
        const qs = (cat?.questions||[]).filter(q=>!_isTBQuestion(q));
        if (ct.includes("visual")) { visualCat++; visualQ+=qs.length; }
        else if (ct.includes("audio")) { audioQ+=qs.length; }
        else if (qs.length > 0) { spokenCat++; spokenQ+=qs.length; spokenSizes.push(qs.length); }
      }
    }
    const qPerCat = (() => { if(!spokenSizes.length) return 0; const f={}; let b=spokenSizes[0],bc=0; for(const n of spokenSizes){f[n]=(f[n]||0)+1;if(f[n]>bc){b=n;bc=f[n];}} return b; })();
    const triviaType = isTipsy ? "tipsy team trivia" : "team trivia";
    let text = `Hey, everybody! It's time for ${triviaType} at ${loc}!\n\nI'm ${hName} and this is ${cName}, and we're your hosts tonight as you play for trivia glory and some pretty awesome prizes.\n`;
    if (composedCachedState?.hostInfo?.announcements?.trim()) text += `\n${composedCachedState.hostInfo.announcements.trim()}\n`;
    const isFirstGame = _scriptMultiGame.gameIndex === 1 || _scriptMultiGame.gameIndex === null;
    if (isMultiGame && isFirstGame) { const t1=startTimes[0]||"[TIME1]",t2=startTimes[1]||"[TIME2]"; text += `\nWe'll be playing ${totalGames} games of trivia tonight - one starting right now at ${t1}, and the next starting right around ${t2}. The slate will be wiped clean after the first game; that means you can play one OR both games with us. How long you choose to hang out with us tonight is up to you.\n`; }
    text += isMultiGame ? `\nWe'll be asking you ${X} questions in each game tonight.\n` : `\nWe'll be asking you ${X} questions tonight.\n`;
    const parts=[];
    if (visualQ>0) parts.push(`${visualQ} visual question${visualQ===1?"":"s"}`);
    if (spokenQ>0) { let st=`${spokenQ} spoken word question${spokenQ===1?"":"s"}`; if(spokenCat>0&&qPerCat>0) st+=` divided into categories of ${qPerCat} question${qPerCat===1?"":"s"} each`; parts.push(st); }
    if (audioQ>0) parts.push(`${audioQ} audio question${audioQ===1?"":"s"}`);
    if (parts.length>0) { let bd=parts.length===1?parts[0]:parts.length===2?`${parts[0]} and ${parts[1]}`:`${parts.slice(0,-1).join(", ")}, and ${parts[parts.length-1]}`; text+=`\nThere will be ${bd}.\n`; }
    if (scoringMode==="pub") { const pp=Number.isFinite(pubPoints)?pubPoints:10; text+=`\nEach question is worth ${pp} point${pp===1?"":"s"}, for a total of ${X*pp} possible points${isMultiGame?" in each game":""}.\n`; }
    else if (scoringMode==="pooled") { const ps=Number.isFinite(poolPerQuestion)?poolPerQuestion:150; text+=`\nEach question tonight has a point pool of ${ps} points that will be divided up evenly among the teams that answer it correctly; in other words, you'll be rewarded if you know stuff that nobody else knows.\n`; }
    else if (scoringMode==="pooled-adaptive") { const pc=Number.isFinite(poolContribution)?poolContribution:10; text+=`\nEach question tonight has a point pool that contains ${pc} point${pc===1?"":"s"} for each team that is playing the game. The pool for each question will be divided up evenly among the teams that answer it correctly; in other words, you'll be rewarded if you know stuff that nobody else knows.\n`; }
    if (_scriptPrizeList.length>0) { text+=`\n${loc} is awarding prizes for the top ${_scriptPrizeList.length} team${_scriptPrizeList.length===1?"":"s"}:\n`; _scriptPrizeList.forEach((p,i)=>{text+=`  • ${_ordinal(i+1)}: ${p}\n`;}); }
    text += `\nNow before we get going with the game, here are the rules.\n● To keep things fair, no electronic devices may be out during the round. And that's not just when you're with your team at your table. If you have to step away from your table for any reason, please return with only your charming personality, and NOT with answers that you looked up while you were away. Because there are prizes at stake, if it looks like cheating, we have to treat it like cheating.\n● Don't shout out the answers; you might accidentally give answers away to other teams. Use those handy dandy notepads to share ideas with your team instead.\n● Spelling doesn't count unless we say it does.\n● Unless we say otherwise, when we ask for someone's name, we want their last name. Give us the first name, too, if you like, but just remember that if any part of your answer is wrong, the whole thing is wrong. It's always safest to just give us last names.\n● For fictional characters, either the first or last name is okay unless we say otherwise.\n● Our answer is the correct answer. Dispute if you like and we'll consider it, but our decisions are final.\n● Finally, be generous to the staff; they're working hard to ensure you have a great time. Don't be afraid to ask them for answers to our questions; they may know some that you don't.`;
    if (visualQ > 0) { text += "\n\n"; const hasCohost = cName && cName !== "your co-host"; const vd = isMultiGame ? (visualCat>1?"the first visual round for game #1":"the visual round for game #1") : (visualCat>1?"the first visual round":"the visual round"); text += hasCohost ? `${cName} is coming around with ${vd}. That's your signal to put those phones away because the contest starts now. Good luck!` : `I'll be coming around in just a moment with ${vd}. That's your signal to put those phones away because the contest starts now. Good luck!`; }
    return text;
  }, [_scriptTotalQ, _scriptPrizeList, composedCachedState?.hostInfo, _scriptMultiGame, showBundleWithEdits, scoringMode, pubPoints, poolPerQuestion, poolContribution, _scriptAllRounds]);
  const activeRulesIndex = navStarted && navIndex < navRulesPrefix.length ? navIndex : null;
  const scriptSections = useMemo(() => {
    const marker = "\nNow before we get going"; const start = hostScript.indexOf(marker);
    if (start === -1) return [{ text: hostScript, ruleIndex: null }];
    const pre = hostScript.slice(0, start); const body = hostScript.slice(start);
    const bps=[]; let f=0; while(true){const p=body.indexOf("●",f);if(p===-1)break;bps.push(p);f=p+1;}
    if(bps.length<6) return [{text:pre,ruleIndex:null},{text:body,ruleIndex:null}];
    const seg=(s,e)=>body.slice(s,e);
    const sections=[{text:pre,ruleIndex:null},{text:seg(0,bps[0]),ruleIndex:0},{text:seg(bps[0],bps[1]),ruleIndex:1},{text:seg(bps[1],bps[2]),ruleIndex:2},{text:seg(bps[2],bps[3]),ruleIndex:3},{text:seg(bps[3],bps[5]),ruleIndex:4},{text:seg(bps[5]),ruleIndex:5}];
    const last=sections[sections.length-1]; const cp=last.text.lastIndexOf("\n\n");
    if(cp!==-1){sections[sections.length-1]={text:last.text.slice(0,cp),ruleIndex:5};sections.push({text:last.text.slice(cp),ruleIndex:6});}
    return sections;
  }, [hostScript]);
  // ── End Host Script ────────────────────────────────────────────────────────

  // Unified question-send function for QuestionsMode buttons — builds full payload and syncs nav cursor
  const pushDisplayQuestion = useCallback(
    (showQuestionId, stage, withImages) => {
      const item = navFlatList.find(
        (i) => i.type === "question" && i.showQuestionId === showQuestionId,
      );
      if (!item) return;

      const payload = {
        questionNumber: item.questionNumber,
        questionText: item.questionText,
        categoryName: item.categoryName,
      };

      if (withImages && item.inlineImages?.length > 0) {
        payload.inlineImages = item.inlineImages;
        if (item.autoRevealAnswerImage && item.inlineImages.length >= 2) {
          payload.currentInlineImageIndex = stage >= 1 ? 1 : 0;
        } else {
          payload.currentInlineImageIndex = 0;
        }
      }

      if (stage >= 1) {
        payload.answer = item.answer;
      }

      if (stage >= 2 && !item.isTiebreaker) {
        const grid = composedCachedState?.grid || {};
        const teams = composedCachedState?.teams || [];
        let correctCount = 0;
        for (const team of teams) {
          if (grid[team.showTeamId]?.[showQuestionId]?.isCorrect === true)
            correctCount++;
        }
        const scoringObj = {
          mode: scoringMode,
          pubPoints,
          poolPerQuestion,
          poolContribution,
          teamCount: teams.length,
        };
        const questionBonus = item.bonusAvailable
          ? { bonusValue: item.bonusValue, maxBonuses: item.maxBonuses }
          : null;
        const questionPartial = item.partialCreditAvailable && item.numParts > 0
          ? { numParts: item.numParts }
          : null;
        payload.correctCount = correctCount;
        payload.totalTeams = teams.length;
        if (scoringMode !== "pub") {
          payload.pointsPerTeam = computeAutoEarned(
            { isCorrect: true },
            scoringObj,
            correctCount,
          );
        }
        payload.bonusBreakdown = computeBonusBreakdown(
          teams,
          grid,
          showQuestionId,
          scoringObj,
          correctCount,
          questionBonus,
        );
        payload.partialBreakdown = computePartialBreakdown(
          teams,
          grid,
          showQuestionId,
          scoringObj,
          correctCount,
          questionPartial,
        );
      }

      sendToDisplay("question", payload);

      // Sync nav cursor — use navWithRules so navIndex is offset past the rules prefix, consistent with navForward/navBackward
      const list = navIsAnswerMode ? navAnswersModeList : navWithRules;
      const idx = list.findIndex(
        (i) => i.type === "question" && i.showQuestionId === showQuestionId,
      );
      if (idx >= 0) {
        setNavIndex(idx);
        setNavAnswerStage(stage);
        setNavStarted(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      navFlatList,
      navAnswersModeList,
      navWithRules,
      navIsAnswerMode,
      composedCachedState,
      scoringMode,
      pubPoints,
      poolPerQuestion,
      poolContribution,
    ],
  );

  // Wrapper around sendToDisplay that also syncs the nav cursor position
  const sendToDisplayWithNavSync = useCallback(
    (type, data) => {
      sendToDisplay(type, data);
      if (type === "question" && data?.questionNumber !== undefined) { // eslint-disable-line
        // Always search navQuestionList (includes visual questions) to find the item
        const found = navQuestionList.find(
          (item) =>
            item.type === "question" &&
            String(item.questionNumber) === String(data.questionNumber) &&
            item.categoryName === (data.categoryName || "").trim(),
        );
        if (found) {
          // Find index in the active list — use navWithRules so questions are offset past the rules prefix
          const list = navIsAnswerMode ? navAnswersModeList : navWithRules;
          const idx = list.indexOf(found) !== -1 ? list.indexOf(found) : navAnswersModeList.indexOf(found);
          setNavIndex(idx >= 0 ? idx : 0);
          setNavStarted(true);
          if (navIsAnswerMode) {
            const stage =
              data.correctCount !== undefined
                ? 2
                : data.answer !== undefined
                  ? 1
                  : 0;
            setNavAnswerStage(stage);
          }
        }
      } else if (
        type === "category" &&
        !navIsAnswerMode &&
        data?.categoryName
      ) {
        const idx = navFlatList.findIndex(
          (item) =>
            item.type === "category" && item.categoryName === data.categoryName,
        );
        if (idx >= 0) {
          setNavIndex(idx);
          setNavStarted(true);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [navIsAnswerMode, navFlatList, navQuestionList, navAnswersModeList, navWithRules],
  );

  const navActiveList = navIsAnswerMode ? navAnswersModeList : navWithRules;

  // Current nav item (this host's local cursor) — used for nav label, audio, live re-push
  const navCurrentItem = useMemo(() => {
    const current = navActiveList[navIndex];
    if (!current) return null;
    if (current.type === "question") {
      return navQuestionList.find(q => q.showQuestionId === current.showQuestionId) ?? current;
    }
    return current;
  }, [navActiveList, navIndex, navQuestionList]);

  // Context panel item — derived from what's actually on the display (Supabase display_state).
  // All hosts see the same context panel regardless of their local nav cursor position.
  const contextPanelItem = useMemo(() => {
    if (!liveDisplayState) return null;
    const { type, content } = liveDisplayState;
    if (type === "question") {
      return navFlatList.find(
        (item) =>
          item.type === "question" &&
          item.questionNumber === content?.questionNumber &&
          item.categoryName === content?.categoryName,
      ) ?? null;
    }
    if (type === "category") {
      return navFlatList.find(
        (item) =>
          item.type === "category" && item.categoryName === content?.categoryName,
      ) ?? null;
    }
    if (type === "results" && content?.place != null) {
      const stepType = content.teams == null ? "results-place-pts" : "results-place-reveal";
      return navAnswersModeList.find(
        (item) => item.type === stepType && item.place === content.place && item.points === content.points,
      ) ?? null;
    }
    return null;
  }, [liveDisplayState, navFlatList, navAnswersModeList]);

  const navForward = useCallback(() => {
    if (!navStarted) {
      // First press: snapshot whether script is open, then send first item
      setRulesStartedWithScript(scriptPanelOpen);
      setNavStarted(true);
      if (navIsAnswerMode) {
        const firstItem = navAnswersModeList[navIndex];
        if (firstItem?.type === "question") {
          pushNavQuestion(firstItem, 0, false);
        } else if (firstItem) {
          pushResultsStep(firstItem);
        }
      } else {
        // navWithRules not yet updated with snapshot — compute prefix inline
        const prefix = scriptPanelOpen ? navRulesPrefix : phoneAwayPrefix;
        const combined = [...prefix, ...navQuestionsMode];
        pushNavItem(combined[navIndex]);
      }
      return;
    }
    if (navIsAnswerMode) {
      const currentItem = navAnswersModeList[navIndex];
      if (!currentItem) return;
      if (currentItem.type === "question") {
        const maxStage = currentItem.isTiebreaker ? 1 : 2;
        if (navAnswerStage < maxStage) {
          const nextStage = navAnswerStage + 1;
          setNavAnswerStage(nextStage);
          pushNavQuestion(currentItem, nextStage, navImageVisible);
        } else {
          // Advance past this question to next item (could be another question or results step)
          const nextIdx = navIndex + 1;
          if (nextIdx < navAnswersModeList.length) {
            const nextItem = navAnswersModeList[nextIdx];
            setNavIndex(nextIdx);
            setNavAnswerStage(0);
            if (nextItem.type === "question") {
              pushNavQuestion(nextItem, 0, false);
            } else {
              pushResultsStep(nextItem);
            }
          }
        }
      } else {
        // Results step — just advance to the next step
        const nextIdx = navIndex + 1;
        if (nextIdx < navAnswersModeList.length) {
          setNavIndex(nextIdx);
          pushResultsStep(navAnswersModeList[nextIdx]);
        }
      }
    } else {
      if (navIndex < navWithRules.length - 1) {
        const nextIdx = navIndex + 1;
        setNavIndex(nextIdx);
        pushNavItem(navWithRules[nextIdx]);
      }
    }
  }, [
    navStarted,
    navIsAnswerMode,
    navIndex,
    navAnswerStage,
    navWithRules,
    navQuestionsMode,
    navRulesPrefix,
    phoneAwayPrefix,
    navAnswersModeList,
    pushNavItem,
    pushNavQuestion,
    pushResultsStep,
    scriptPanelOpen,
  ]);

  const navBackward = useCallback(() => {
    if (navIsAnswerMode) {
      const currentItem = navAnswersModeList[navIndex];
      if (!currentItem) return;
      if (currentItem.type === "question") {
        if (navAnswerStage > 0) {
          const prevStage = navAnswerStage - 1;
          setNavAnswerStage(prevStage);
          pushNavQuestion(currentItem, prevStage, navImageVisible);
        } else if (navIndex > 0) {
          const prevIdx = navIndex - 1;
          const prevItem = navAnswersModeList[prevIdx];
          setNavIndex(prevIdx);
          if (prevItem?.type === "question") {
            const prevMaxStage = prevItem.isTiebreaker ? 1 : 2;
            setNavAnswerStage(prevMaxStage);
            pushNavQuestion(prevItem, prevMaxStage, false);
          } else {
            setNavAnswerStage(0);
            pushResultsStep(prevItem);
          }
        }
      } else {
        // Results step — go back to previous step
        if (navIndex > 0) {
          const prevIdx = navIndex - 1;
          const prevItem = navAnswersModeList[prevIdx];
          setNavIndex(prevIdx);
          setNavAnswerStage(0);
          if (prevItem?.type === "question") {
            const prevMaxStage = prevItem.isTiebreaker ? 1 : 2;
            setNavAnswerStage(prevMaxStage);
            pushNavQuestion(prevItem, prevMaxStage, false);
          } else {
            pushResultsStep(prevItem);
          }
        }
      }
    } else {
      if (navIndex > 0) {
        const prevIdx = navIndex - 1;
        setNavIndex(prevIdx);
        pushNavItem(navWithRules[prevIdx]);
      }
    }
  }, [
    navIsAnswerMode,
    navIndex,
    navAnswerStage,
    navWithRules,
    navAnswersModeList,
    pushNavItem,
    pushNavQuestion,
    pushResultsStep,
  ]);

  // Keyboard arrow nav (only when enabled) — placed after navForward/navBackward are defined
  useEffect(() => {
    if (!navKeyboardEnabled) return;
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        navForward();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        navBackward();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navKeyboardEnabled, navForward, navBackward]);

  const toggleNavMode = useCallback(() => {
    setNavIsAnswerMode((prev) => !prev);
    setNavIndex(0);
    setNavAnswerStage(0);
    setNavStarted(false);
    setRulesStartedWithScript(false);
  }, []);

  const resetNav = useCallback(() => {
    setNavIndex(0);
    setNavStarted(false);
    setNavAnswerStage(0);
    setRulesStartedWithScript(false);
  }, []);

  const getNavLabel = useCallback(
    (list, idx, stage) => {
      if (list.length === 0) return "No show";
      const item = list[idx];
      if (!item) return "—";
      if (item.type === "rules") return item.label || "Rule";
      if (item.type === "carousel") return "Visual carousel";
      if (item.type === "category") {
        if (item.isTiebreaker) return "Tiebreaker";
        const catItems = list.filter(i => i.type === "category" && !i.isTiebreaker);
        const catIdx = catItems.indexOf(item);
        return catIdx !== -1 ? `Cat ${catIdx + 1}` : (item.categoryName || "Category");
      }
      if (item.type === "results-splash") return "Results splash";
      if (item.type === "results-scramble") return "Scramble";
      if (item.type === "results-tb-question") return "TB question";
      if (item.type === "results-tb-answer") return "TB answer";
      if (item.type === "results-place-pts") return `${item.place} · pts`;
      if (item.type === "results-place-reveal") return `${item.place} · teams`;
      const stageLabel = navIsAnswerMode
        ? ` · ${["question", "answer", "stats"][stage] ?? ""}`
        : "";
      return `Q${item.questionNumber}${stageLabel}`;
    },
    [navIsAnswerMode],
  );

  // Grid click handlers
  const handleGridCategoryClick = useCallback((catItem) => {
    if (!catItem) return;
    const idx = navWithRules.indexOf(catItem);
    setNavIndex(idx >= 0 ? idx : 0);
    setNavStarted(true);
    // pushNavItem handles both category and carousel types
    if (catItem.type === "carousel") {
      sendToDisplay("questionCarousel", { questions: catItem.visualQuestions, currentIndex: 0, autoCycle: true });
    } else {
      sendToDisplay("category", { categoryName: catItem.categoryName, categoryDescription: catItem.categoryDescription, superSecret: !!catItem.superSecret });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navWithRules]);

  const handleGridQuestionClick = useCallback((item) => {
    if (!item) return;
    const isCurrent = navCurrentItem?.type === "question" && navCurrentItem.showQuestionId === item.showQuestionId;
    if (navIsAnswerMode && isCurrent) {
      // Cycle through stages for current question (wrap at max)
      const maxStage = item.isTiebreaker ? 1 : 2;
      const nextStage = navAnswerStage < maxStage ? navAnswerStage + 1 : 0;
      setNavAnswerStage(nextStage);
      const idx = navAnswersModeList.findIndex(i => i.type === "question" && i.showQuestionId === item.showQuestionId);
      if (idx >= 0) setNavIndex(idx);
      pushNavQuestion(item, nextStage, navImageVisible);
    } else {
      // Jump to this question at stage 0
      const list = navIsAnswerMode ? navAnswersModeList : navWithRules;
      const idx = list.findIndex(i => i.type === "question" && i.showQuestionId === item.showQuestionId);
      setNavIndex(idx >= 0 ? idx : 0);
      setNavAnswerStage(0);
      setNavStarted(true);
      const payload = { questionNumber: item.questionNumber, questionText: item.questionText, categoryName: item.categoryName };
      if (item.showImageByDefault && item.inlineImages?.length > 0) {
        payload.inlineImages = item.inlineImages;
        payload.currentInlineImageIndex = 0;
      }
      sendToDisplay("question", payload);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navCurrentItem, navIsAnswerMode, navAnswerStage, navWithRules, navAnswersModeList, pushNavQuestion, navImageVisible]);

  const navCurrentLabel = useMemo(() => {
    if (navActiveList.length === 0) return "No show";
    return getNavLabel(navActiveList, navIndex, navAnswerStage);
  }, [navActiveList, navIndex, navAnswerStage, getNavLabel]);

  const currentNavAudio = useMemo(() => {
    const item = navActiveList[navIndex];
    if (!item) return [];
    if (item.type === "question") return item.questionAudio || [];
    if (item.type === "category") return item.categoryAudio || [];
    return [];
  }, [navActiveList, navIndex]);

  const playAudio = useCallback((url) => {
    if (sharedAudioRef.current) {
      sharedAudioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.onplay = () => { setSharedAudioPlaying(true); window.tvSend?.("audioStatus", { playing: true, url, hostName }); };
    audio.onpause = () => { setSharedAudioPlaying(false); window.tvSend?.("audioStatus", { playing: false, url, hostName }); };
    audio.onended = () => {
      setSharedAudioPlaying(false);
      setAudioCurrentTime(0);
      window.tvSend?.("audioStatus", { playing: false, url, hostName });
    };
    audio.ontimeupdate = () => setAudioCurrentTime(audio.currentTime);
    audio.ondurationchange = () => setAudioDuration(isFinite(audio.duration) ? audio.duration : null);
    sharedAudioRef.current = audio;
    setSharedAudioUrl(url);
    setSharedAudioPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(null);
    audio.play();
  }, [hostName]);

  const toggleAudio = useCallback(() => {
    const a = sharedAudioRef.current;
    if (!a) return;
    if (sharedAudioPlaying) {
      a.pause();
    } else {
      a.play();
    }
  }, [sharedAudioPlaying]);

  const toggleNavImage = useCallback(() => {
    const item = navActiveList[navIndex];
    if (!item || item.type !== "question" || !item.inlineImages?.length) return;
    const newVisible = !navImageVisible;
    setNavImageVisible(newVisible);
    setNavImageIndex(0);
    const stage = navIsAnswerMode ? navAnswerStage : 0;
    pushDisplayQuestion(item.showQuestionId, stage, newVisible);
  }, [
    navImageVisible,
    navActiveList,
    navIndex,
    navIsAnswerMode,
    navAnswerStage,
    pushDisplayQuestion,
  ]);

  const cycleNavImage = useCallback(
    (dir) => {
      const item = navActiveList[navIndex];
      if (!item || item.type !== "question" || !item.inlineImages?.length)
        return;
      const newIdx = Math.max(
        0,
        Math.min(item.inlineImages.length - 1, navImageIndex + dir),
      );
      setNavImageIndex(newIdx);
      sendToDisplay("updateInlineImageIndex", { currentIndex: newIdx });
    },
    [navActiveList, navIndex, navImageIndex],
  );

  const cycleNavAudio = useCallback(
    (dir) => {
      if (!currentNavAudio.length) return;
      const newIdx = Math.max(0, Math.min(currentNavAudio.length - 1, navAudioIndex + dir));
      setNavAudioIndex(newIdx);
      // If already playing this item's audio, switch to the new track
      if (sharedAudioRef.current && (sharedAudioPlaying || sharedAudioUrl === currentNavAudio[navAudioIndex]?.url)) {
        playAudio(currentNavAudio[newIdx].url);
      }
    },
    [currentNavAudio, navAudioIndex, sharedAudioPlaying, sharedAudioUrl, playAudio],
  );

  const navGoTo = useCallback(() => {
    const input = navGoToInput.trim();
    if (!input) return;

    // Special keyword: "audio" — navigate to the audio category in Questions mode
    if (input.toLowerCase() === "audio") {
      const audioCategory = navQuestionsMode.find(
        (item) => item.type === "category" && item.questionType === "audio",
      );
      if (audioCategory) {
        const idx = navWithRules.indexOf(audioCategory);
        setNavIndex(idx !== -1 ? idx : 0);
        setNavAnswerStage(0);
        setNavStarted(true);
        pushNavItem(audioCategory);
        setNavGoToInput("");
      }
      return;
    }

    const inputUpper = input.toUpperCase();
    // Search all questions (navQuestionList includes visual; navQuestionsMode does not)
    const found = navQuestionList.find(
      (item) => String(item.questionNumber || "").toUpperCase() === inputUpper,
    );
    if (!found) return;
    if (navIsAnswerMode) {
      const idx = navQuestionList.indexOf(found);
      setNavIndex(idx);
      setNavAnswerStage(0);
      setNavStarted(true);
      pushNavQuestion(found, 0);
    } else {
      // For Questions mode, find the item in navWithRules so navIndex is offset past the rules prefix
      const qIdx = navWithRules.indexOf(found);
      const idx = qIdx !== -1 ? qIdx : navWithRules.findIndex(
        (item) => item.type === "question" && String(item.questionNumber || "").toUpperCase() === inputUpper,
      );
      setNavIndex(idx !== -1 ? idx : 0);
      setNavAnswerStage(0);
      setNavStarted(true);
      pushNavItem(found);
    }
    setNavGoToInput("");
  }, [navGoToInput, navIsAnswerMode, navQuestionList, navQuestionsMode, navWithRules, pushNavQuestion, pushNavItem]);

  // Stop audio and reset image/audio toggles when nav position changes
  useEffect(() => {
    if (sharedAudioRef.current) {
      sharedAudioRef.current.pause();
      setSharedAudioPlaying(false);
    }
    setNavImageVisible(false);
    setNavImageIndex(0);
    setNavAudioIndex(0);
    setStripEditing(false);
    setStripEditDraft({});
  }, [navIndex, navIsAnswerMode]);

  // Re-push to display when the current question's text is edited live
  const prevLivePushIdRef = useRef(null);
  const prevLivePushTextRef = useRef(null);
  useEffect(() => {
    const id = navCurrentItem?.showQuestionId;
    const text = navCurrentItem?.questionText;
    if (id === prevLivePushIdRef.current && text !== prevLivePushTextRef.current) {
      // Same question, text changed — re-push if we're the active host
      if (navStarted && navCurrentItem?.type === "question") {
        if (navIsAnswerMode) {
          pushNavQuestion(navCurrentItem, navAnswerStage, navImageVisible);
        } else {
          pushNavItem(navCurrentItem);
        }
      }
    }
    prevLivePushIdRef.current = id ?? null;
    prevLivePushTextRef.current = text ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navCurrentItem?.questionText, navCurrentItem?.showQuestionId]);

  const navNextLabel = useMemo(() => {
    if (navIsAnswerMode) {
      if (navAnswerStage < 2) {
        return getNavLabel(navQuestionList, navIndex, navAnswerStage + 1);
      }
      if (navIndex < navQuestionList.length - 1) {
        return getNavLabel(navQuestionList, navIndex + 1, 0);
      }
      return null;
    } else {
      if (navIndex < navWithRules.length - 1) {
        return getNavLabel(navWithRules, navIndex + 1, 0);
      }
      return null;
    }
  }, [
    navIsAnswerMode,
    navWithRules,
    navQuestionList,
    navIndex,
    navAnswerStage,
    getNavLabel,
  ]);

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
      {/* ── Mission Control — fixed full-page layout ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#fff",
          overflow: "hidden",
        }}
      >
        {/* MC top bar: show selector + venue + mode panel toggles */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: ".5rem",
          padding: ".35rem .75rem",
          borderBottom: `1px solid ${colors.gray?.border || "#e0e0e0"}`,
          flexShrink: 0,
          flexWrap: "wrap",
          minHeight: "48px",
        }}>
          <img src={logo} alt="TriviaVanguard" style={{ height: "36px", flexShrink: 0, marginRight: ".25rem" }} />

          {/* Venue button */}
          <Button
            onClick={openVenuePicker}
            title="Select display venue"
            style={{ fontSize: ".85rem", padding: ".3rem .6rem", borderRadius: ".4rem", whiteSpace: "nowrap", ...(venueShowId && { background: colors.accent, color: "#fff" }) }}
          >
            📺 {venueName || "Set venue"}
          </Button>

          {/* Show selector */}
          <select
            value={selectedShowId}
            aria-label="Show selector"
            onChange={(e) => {
              const newId = e.target.value;
              if (newId === "__OLDER__") { setOlderShowsOpen(true); setTimeout(() => { e.target.value = selectedShowId || ""; }, 0); return; }
              if (newId === "__ARCHIVED__") { setShowDropZone(true); setTimeout(() => { e.target.value = selectedShowId || ""; }, 0); return; }
              if (!selectedShowId || selectedShowId === newId) { setSelectedShowId(newId); setSelectedRoundId(""); return; }
              const oldShowId = selectedShowId;
              setScoringCache((prev) => { const next = { ...prev }; delete next[oldShowId]; localStorage.setItem("trivia.scoring.backup", JSON.stringify(next)); return next; });
              setSelectedRoundId(""); setVisibleImages({}); setVisibleCategoryImages({}); setCurrentImageIndex({});
              setSelectedShowId(newId);
            }}
            style={{ fontSize: ".9rem", fontFamily: tokens.font.body, padding: ".3rem .4rem", borderRadius: ".4rem", border: `1px solid ${colors.gray?.border || "#ccc"}`, maxWidth: "260px" }}
          >
            <option value="">— Select a show —</option>
            {shows.map((s) => (<option key={s.id} value={s.id}>{s.Show?.Show}</option>))}
            <option value="__OLDER__" style={{ fontStyle: "italic" }}>📚 View older shows…</option>
            <option value="__ARCHIVED__" style={{ fontStyle: "italic" }}>📂 Open archived show from file…</option>
          </select>

          {/* Round selector */}
          {roundNumbers.length > 1 && (
            <select value={selectedRoundId} onChange={(e) => setSelectedRoundId(e.target.value)}
              style={{ fontSize: ".9rem", fontFamily: tokens.font.body, padding: ".3rem .4rem", borderRadius: ".4rem", border: `1px solid ${colors.gray?.border || "#ccc"}` }}>
              {roundNumbers.map((n) => (<option key={n} value={String(n)}>{`Round ${n}`}</option>))}
            </select>
          )}

          {/* Bundle status */}
          {bundleLoading && <span style={{ fontSize: ".8rem", color: "#888", fontFamily: tokens.font.body }}>Loading…</span>}
          {bundleError && <span style={{ fontSize: ".8rem", color: colors.error, fontFamily: tokens.font.body }}>Error loading show</span>}

          {/* Sync status dot */}
          <span title={`Multi-host sync: ${rtStatus}`} style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, backgroundColor: rtStatus === "SUBSCRIBED" ? "#22c55e" : rtStatus === "SUBSCRIBING" ? "#eab308" : "#ef4444" }} />

          {/* Mode panel toggle buttons */}
          <div style={{ marginLeft: "auto", display: "flex", gap: ".35rem", flexShrink: 0 }}>
            <Button onClick={() => setQuestionsOpen(v => !v)} title="Questions & Answers panel"
              style={{ fontSize: ".85rem", padding: ".3rem .65rem", borderRadius: ".4rem", ...(questionsOpen && { background: colors.accent, color: "#fff" }) }}>
              Questions
            </Button>
            <Button onClick={() => setScoringOpen(v => !v)} title="Scoring panel"
              style={{ fontSize: ".85rem", padding: ".3rem .65rem", borderRadius: ".4rem", ...(scoringOpen && { background: colors.accent, color: "#fff" }) }}>
              Scores
            </Button>
            <Button onClick={() => setResultsOpen(v => !v)} title="Results panel"
              style={{ fontSize: ".85rem", padding: ".3rem .65rem", borderRadius: ".4rem", ...(resultsOpen && { background: colors.accent, color: "#fff" }) }}>
              Results
            </Button>
          </div>
        </div>

              {/* Utility buttons row */}
              <div
                style={{
                  display: "flex",
                  gap: ".4rem",
                  alignItems: "center",
                  padding: ".3rem .5rem",
                  borderTop: `1px solid ${colors.gray?.border || "#e0e0e0"}`,
                }}
              >
                <Button
                  onClick={() => venueShowId && openDisplayWindow(venueShowId)}
                  disabled={!venueShowId}
                  title={venueShowId ? "Open Display Mode in new window" : "Select a venue first"}
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem" }}
                >📺</Button>
                <Button
                  onClick={() => { sendToDisplay("closeQuestionCarousel", null); sendToDisplay("standby", null); setCarouselActive(false); }}
                  title="Clear the display (standby screen)"
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem" }}
                >🧹</Button>
                <Button
                  onClick={() => {
                    if (!venueShowId) return;
                    const url = `${window.location.origin}?display&venueShowId=${venueShowId}&hostId=${hostId}&hostName=${encodeURIComponent(hostName)}&viewer=1`;
                    navigator.clipboard.writeText(url).catch(() => window.prompt("Copy viewer link:", url));
                  }}
                  title="Copy view-only display link"
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem" }}
                >🔗</Button>
                <Button
                  onClick={() => sendToDisplay("toggleGuide")}
                  title="Toggle alignment guide"
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem" }}
                >📐</Button>
                <Button
                  onClick={() => {
                    if (navCurrentItem?.type !== "question") return;
                    setStripEditDraft({
                      question: navCurrentItem.questionText || "",
                      notes: navCurrentItem.questionNotes || "",
                      pronunciationGuide: navCurrentItem.pronunciationGuide || "",
                      answer: navCurrentItem.answer || "",
                      answerNotes: navCurrentItem.answerNotes || "",
                    });
                    setStripEditing(true);
                  }}
                  disabled={navCurrentItem?.type !== "question"}
                  title={navCurrentItem?.type === "question" ? "Edit question" : "Navigate to a question to edit"}
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem", opacity: navCurrentItem?.type !== "question" ? 0.35 : 1 }}
                >✏️</Button>
                <Button
                  onClick={() => setNavKeyboardEnabled(v => !v)}
                  title={navKeyboardEnabled ? "Disable keyboard arrow nav" : "Enable keyboard arrow nav"}
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem", ...(navKeyboardEnabled && { background: colors.accent }) }}
                >←→</Button>
                <Button
                  onClick={() => setGridOnRight(v => { const next = !v; localStorage.setItem("tv_gridOnRight", String(next)); return next; })}
                  title="Swap preview / grid positions"
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem" }}
                >⇄</Button>
                <Button
                  onClick={() => {
                    const closestKey = getClosestQuestionKey?.();
                    setshowDetails((prev) => !prev);
                    if (closestKey && questionRefs?.current?.[closestKey]?.current) {
                      requestAnimationFrame(() => requestAnimationFrame(() => {
                        questionRefs.current[closestKey]?.current?.scrollIntoView({ behavior: "instant", block: "center" });
                      }));
                    }
                  }}
                  title="Show/hide all answers"
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem" }}
                >🥷</Button>
                <Button
                  onClick={() => setShowAnswerKey((prev) => !prev)}
                  title="Show/hide answer key"
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem" }}
                >📋</Button>
                <Button
                  onClick={refreshBundle}
                  title="Refresh questions from Airtable"
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem" }}
                >🔄</Button>
                <Button
                  onClick={() => setScriptPanelOpen((prev) => !prev)}
                  title="Show/hide host script"
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem", ...(scriptPanelOpen && { background: colors.accent }) }}
                >💬</Button>
                <Button
                  onClick={() => setSettingsOpen((prev) => !prev)}
                  title="Settings"
                  style={{ fontSize: "1rem", padding: ".35rem .45rem", minWidth: "2rem", height: "2rem", borderRadius: ".4rem", ...(settingsOpen && { background: colors.accent }) }}
                >⚙️</Button>
              </div>

              {/* Settings panel — opens below utility row */}
              {settingsOpen && (
                <div style={{
                  borderTop: `1px solid ${colors.gray?.border || "#e0e0e0"}`,
                  background: colors.dark,
                  padding: ".5rem",
                  maxHeight: "20rem",
                  overflowY: "auto",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginBottom: ".5rem" }}>
                    <span style={{ fontSize: ".75rem", color: "#aaa", fontFamily: tokens.font.body }}>Timer widget</span>
                    <Button
                      onClick={() => setShowTimer((prev) => !prev)}
                      title={showTimer ? "Hide timer" : "Show timer"}
                      style={{ fontSize: ".8rem", padding: ".2rem .5rem", borderRadius: ".3rem", ...(showTimer && { background: colors.accent }) }}
                    >⏱️ {showTimer ? "Hide" : "Show"}</Button>
                  </div>
                  <SidebarMenu
                    showTimer={showTimer}
                    setTimerPosition={setTimerPosition}
                    prizes={composedCachedState?.prizes ?? ""}
                    setPrizes={(val) => patchShared({ prizes: String(val || "") })}
                    hostInfo={composedCachedState?.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo}
                    setHostInfo={(val) => patchShared({ hostInfo: val })}
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
                </div>
              )}

              {/* ── body column ── */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden", background: colors.dark }}>

                {/* Control bar — 2-row layout */}
                {(() => {
                  // Use navQuestionList for item lookup so visual questions (filtered out of navQuestionsMode) are found
                  const item = navActiveList[navIndex]?.type === "question"
                    ? (navQuestionList.find(q => q.showQuestionId === navActiveList[navIndex]?.showQuestionId) ?? navActiveList[navIndex])
                    : navActiveList[navIndex];
                  const hasAudio = currentNavAudio.length > 0;
                  const multiAudio = currentNavAudio.length > 1;
                  const currentAudio = currentNavAudio[navAudioIndex] || currentNavAudio[0];
                  const isPlaying = hasAudio && sharedAudioUrl === currentAudio?.url && sharedAudioPlaying;
                  const hasImg = item?.type === "question" && item.inlineImages?.length > 0;
                  const multiImg = !!(hasImg && item.inlineImages.length > 1);
                  const imgCount = hasImg ? item.inlineImages.length : 0;
                  const btnBase = {
                    padding: ".22rem .45rem",
                    fontSize: ".8rem",
                    fontFamily: tokens.font.body,
                    borderRadius: ".35rem",
                    border: "1px solid #888",
                    background: "transparent",
                    color: "#fff",
                    cursor: "pointer",
                    minWidth: "1.8rem",
                    textAlign: "center",
                  };
                  const arrowBtn = (label, onClick, disabled, extraStyle = {}) => (
                    <button
                      onClick={disabled ? undefined : onClick}
                      disabled={disabled}
                      style={{
                        ...btnBase,
                        padding: ".15rem .3rem",
                        fontSize: ".75rem",
                        minWidth: "1.4rem",
                        opacity: disabled ? 0.25 : 1,
                        cursor: disabled ? "default" : "pointer",
                        ...extraStyle,
                      }}
                    >
                      {label}
                    </button>
                  );
                  const navAtStart = navIsAnswerMode ? navIndex === 0 && navAnswerStage === 0 : navIndex === 0;
                  const navAtEnd = navStarted && (navIsAnswerMode
                    ? navIndex >= navAnswersModeList.length - 1 && (navAnswersModeList[navIndex]?.type !== "question" || navAnswerStage >= 2)
                    : navIndex >= navWithRules.length - 1);
                  return (
                    <div style={{ background: colors.dark, display: "flex", gap: ".4rem", padding: ".35rem .5rem", alignItems: "stretch", width: previewW, flexShrink: 0 }}>

                      {/* White now-playing panel — tall, spans full control bar height */}
                      <div style={{ flex: 1, background: "#fff", borderRadius: ".5rem", padding: ".3rem .6rem", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                        <div style={{ fontWeight: 700, fontSize: ".85rem", color: colors.dark, fontFamily: tokens.font.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", width: "100%" }}>
                          {navStarted ? navCurrentLabel : `▶ ${navCurrentLabel}`}
                        </div>
                        {navStarted && navNextLabel && (
                          <div style={{ fontSize: ".72rem", color: "#888", fontFamily: tokens.font.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", width: "100%" }}>
                            next: {navNextLabel}
                          </div>
                        )}
                      </div>

                      {/* Timer + arrows column: timer on top, arrows below */}
                      <div style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
                        {/* Timer row: Reset left, countdown center, Start right */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".25rem" }}>
                          <button onClick={handleReset} style={{ ...btnBase, width: "3rem" }}>Reset</button>
                          <span style={{ textAlign: "center", fontSize: "1rem", fontWeight: "bold", fontFamily: tokens.font.body, color: timerRunning ? colors.accent : "#fff", display: "inline-block", minWidth: "3.2rem" }}>
                            {timeLeft !== null ? `${timeLeft}s` : "--"}
                          </span>
                          <button onClick={handleStartPause} style={{ ...btnBase, width: "3rem", border: `1px solid ${colors.accent}`, background: colors.accent }}>
                            {timerRunning ? "Pause" : "Start"}
                          </button>
                        </div>
                        {/* Nav arrows row: fill available width with consistent gap */}
                        <div style={{ display: "flex", gap: ".25rem", alignItems: "center" }}>
                          {arrowBtn("←", navBackward, navActiveList.length === 0 || navAtStart, { flex: 1 })}
                          {arrowBtn(navStarted ? "→" : "▶", navForward, navActiveList.length === 0 || navAtEnd, { flex: 1 })}
                        </div>
                      </div>

                      {/* Audio column: ‹ › arrows above ♪ button */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", width: "3rem" }}>
                          {arrowBtn("‹", () => cycleNavAudio(-1), !multiAudio || navAudioIndex === 0)}
                          {arrowBtn("›", () => cycleNavAudio(1), !multiAudio || navAudioIndex >= currentNavAudio.length - 1)}
                        </div>
                        <button
                          onClick={hasAudio ? () => sharedAudioUrl === currentAudio?.url ? toggleAudio() : playAudio(currentAudio.url) : undefined}
                          disabled={!hasAudio}
                          title={!hasAudio ? "No audio" : isPlaying ? "Stop audio" : "Play audio"}
                          style={{
                            ...btnBase,
                            width: "3rem",
                            border: `1px solid ${isPlaying ? colors.accent : "#888"}`,
                            background: isPlaying ? colors.accent : "transparent",
                            color: hasAudio ? "#fff" : "#555",
                            opacity: hasAudio ? 1 : 0.35,
                            cursor: hasAudio ? "pointer" : "default",
                          }}
                        >
                          {isPlaying ? "■" : "♪"}
                        </button>
                      </div>

                      {/* Image column: ‹ › arrows above ▣ button */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", width: "3rem" }}>
                          {arrowBtn("‹", () => cycleNavImage(-1), !multiImg || navImageIndex === 0)}
                          {arrowBtn("›", () => cycleNavImage(1), !multiImg || navImageIndex >= imgCount - 1)}
                        </div>
                        <button
                          onClick={hasImg ? toggleNavImage : undefined}
                          disabled={!hasImg}
                          title={!hasImg ? "No image" : navImageVisible ? "Hide image" : "Show image"}
                          style={{
                            ...btnBase,
                            width: "3rem",
                            border: `1px solid ${navImageVisible ? colors.accent : "#888"}`,
                            background: navImageVisible ? colors.accent : "transparent",
                            color: hasImg ? "#fff" : "#555",
                            opacity: hasImg ? 1 : 0.35,
                            cursor: hasImg ? "pointer" : "default",
                          }}
                        >
                          ▣
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {/* Preview + grid sub-row — flex:1 so it fills remaining body space; height measured by ResizeObserver */}
                <div ref={previewRowRef} style={{ display: "flex", flexDirection: gridOnRight ? "row" : "row-reverse", flex: 1, minHeight: 0, overflow: "hidden" }}>
                  {/* Preview iframe */}
                  <div
                    style={{
                      width: previewW,
                      height: previewH,
                      overflow: "hidden",
                      background: "#000",
                      flexShrink: 0,
                    }}
                  >
                    <iframe
                      ref={previewIframeRef}
                      title="Display preview"
                      style={{
                        width: 1920,
                        height: 1080,
                        border: "none",
                        transformOrigin: "top left",
                        transform: `scale(${previewW / 1920})`,
                        display: "block",
                        pointerEvents: "none",
                      }}
                    />
                  </div>

                  {/* Grid — fills all space to the right of preview */}
                  {navGrid.length > 0 && (
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      height: previewH,
                      background: colors.dark,
                      borderLeft: gridOnRight ? `1px solid rgba(255,255,255,0.1)` : "none",
                      borderRight: !gridOnRight ? `1px solid rgba(255,255,255,0.1)` : "none",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }}>
                      {/* Q/A mode toggle */}
                      <div style={{ display: "flex", gap: ".25rem", padding: ".3rem .5rem", flexShrink: 0, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
                        {[
                          { label: "Questions", isActive: !navIsAnswerMode },
                          { label: "Answers", isActive: navIsAnswerMode },
                        ].map(({ label, isActive }) => (
                          <button
                            key={label}
                            onClick={isActive ? undefined : toggleNavMode}
                            disabled={navActiveList.length === 0 || isActive}
                            style={{
                              flex: 1,
                              fontSize: ".88rem",
                              fontFamily: tokens.font.body,
                              padding: ".2rem .4rem",
                              borderRadius: ".35rem",
                              border: `1px solid ${colors.accent}`,
                              background: isActive ? colors.accent : "transparent",
                              color: "#fff",
                              fontWeight: isActive ? 700 : 400,
                              opacity: navActiveList.length === 0 ? 0.4 : 1,
                              cursor: isActive ? "default" : "pointer",
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {/* Scrollable grid rows */}
                      <div style={{ flex: 1, overflowY: "auto", padding: ".3rem .5rem", display: "flex", flexDirection: "column", gap: ".25rem" }}>
                        {(() => {
                          let spokenCatCount = 0;
                          return navGrid.map((row, rowIdx) => {
                            const catItem = row.catItem;
                            const isCatActive = navCurrentItem === catItem ||
                              (navCurrentItem?.type === "carousel" && catItem?.type === "carousel" && navCurrentItem?.categoryName === catItem?.categoryName);
                            let catLabel;
                            if (catItem.type === "carousel") {
                              catLabel = "Visual";
                            } else if (catItem.isTiebreaker) {
                              catLabel = "TB";
                            } else if (catItem.questionType === "audio") {
                              catLabel = "Audio";
                            } else {
                              spokenCatCount++;
                              catLabel = `Cat ${spokenCatCount}`;
                            }
                            const rawName = catItem.categoryName || catLabel;
                            const plainName = rawName
                              .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
                              .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
                              .replace(/\*\*([^*]+)\*\*/g, "$1")
                              .replace(/\*([^*]+)\*/g, "$1")
                              .replace(/__([^_]+)__/g, "$1")
                              .replace(/_([^_]+)_/g, "$1")
                              .replace(/`([^`]+)`/g, "$1")
                              .replace(/#+\s*/g, "")
                              .trim();
                            return (
                              <div key={rowIdx} style={{ display: "flex", gap: ".25rem", alignItems: "center" }}>
                                <button
                                  onClick={() => handleGridCategoryClick(catItem)}
                                  title={plainName}
                                  style={{
                                    fontSize: ".85rem",
                                    fontFamily: tokens.font.body,
                                    padding: ".2rem 0",
                                    borderRadius: ".35rem",
                                    border: `1px solid ${colors.accent}`,
                                    background: isCatActive ? colors.accent : "transparent",
                                    color: "#fff",
                                    fontWeight: isCatActive ? 700 : 400,
                                    cursor: "pointer",
                                    width: "4.5rem",
                                    flexShrink: 0,
                                    textAlign: "center",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {catLabel}
                                </button>
                                {row.questions.map((q, qIdx) => {
                                  const isQActive = navCurrentItem?.type === "question" && navCurrentItem.showQuestionId === q.showQuestionId;
                                  const stageLabel = isQActive && navIsAnswerMode
                                    ? (navAnswerStage === 0 ? "" : navAnswerStage === 1 ? "·A" : "·S")
                                    : "";
                                  return (
                                    <button
                                      key={q.showQuestionId || qIdx}
                                      onClick={() => handleGridQuestionClick(q)}
                                      title={q.questionText || `Q${q.questionNumber}`}
                                      style={{
                                        fontSize: ".85rem",
                                        fontFamily: tokens.font.body,
                                        padding: ".2rem .4rem",
                                        borderRadius: ".35rem",
                                        border: "1px solid #888",
                                        background: isQActive ? colors.accent : "transparent",
                                        color: "#fff",
                                        fontWeight: isQActive ? 700 : 400,
                                        cursor: "pointer",
                                        minWidth: "2rem",
                                        textAlign: "center",
                                      }}
                                    >
                                      {q.questionNumber}{stageLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>{/* end preview+grid sub-row */}

                {/* Remote audio status — shown when another host is playing audio */}
                {remoteAudioStatus?.playing && (
                  <div style={{ background: "#1a2a1a", borderTop: "1px solid #2a4a2a", padding: ".25rem .6rem", fontSize: ".75rem", color: "#7fc97f", fontFamily: tokens.font.body, fontStyle: "italic", width: previewW, flexShrink: 0 }}>
                    {remoteAudioStatus.hostName} is playing audio
                  </div>
                )}

                {/* Context panel — always rendered so preview position doesn't jump */}
                {(() => {
                  const enrichedItem = contextPanelItem;
                  const hasAudio = currentNavAudio.length > 0;
                  const audioObj = currentNavAudio[navAudioIndex] || currentNavAudio[0];
                  const isCurrentAudio = hasAudio && !!audioObj && sharedAudioUrl === audioObj.url;

                  let categoryNumber = null, totalCategories = 0;
                  if (enrichedItem?.type === "category") {
                    const catItems = navQuestionsMode.filter(i => i.type === "category" && !i.isTiebreaker);
                    totalCategories = catItems.length;
                    const catIdx = catItems.indexOf(enrichedItem);
                    if (catIdx !== -1) categoryNumber = catIdx + 1;
                  }

                  const hasQuestionNotes = !!(enrichedItem?.questionNotes?.trim());
                  const hasPronunciation = !!(enrichedItem?.pronunciationGuide?.trim());
                  const hasAnswerNotes = !!(enrichedItem?.answerNotes?.trim());
                  const isTbStep = enrichedItem?.type === "results-tb-question" || enrichedItem?.type === "results-tb-answer";

                  // Solo: exactly one team answered correctly
                  let soloTeamName = null;
                  if (enrichedItem?.type === "question" && enrichedItem.showQuestionId) {
                    const sqid = enrichedItem.showQuestionId;
                    const grid = composedCachedState?.grid || {};
                    const teams = composedCachedState?.teams || [];
                    const correctTeams = teams.filter(t => grid[t.showTeamId]?.[sqid]?.isCorrect === true);
                    if (correctTeams.length === 1) soloTeamName = correctTeams[0].teamName || correctTeams[0].name || null;
                  }
                  const tbTeamsAndGuesses = isTbStep ? (enrichedItem.tbTeamsAndGuesses || []) : [];

                  // Next place info: find the next results-place-pts or results-place-reveal step after current
                  const isResultsPlaceStep = enrichedItem?.type === "results-place-pts" || enrichedItem?.type === "results-place-reveal";
                  let nextPlaceInfo = null;
                  if (isResultsPlaceStep) {
                    for (let i = navIndex + 1; i < navAnswersModeList.length; i++) {
                      const s = navAnswersModeList[i];
                      if (s.type === "results-place-pts" || s.type === "results-place-reveal") {
                        nextPlaceInfo = s;
                        break;
                      }
                    }
                  }

                  const hasContent = (hasQuestionNotes && !navIsAnswerMode) || hasPronunciation || (hasAnswerNotes && navIsAnswerMode) || hasAudio || categoryNumber !== null || isTbStep || isResultsPlaceStep || soloTeamName !== null || !!enrichedItem?.superSecret;

                  const formatTime = (s) => {
                    if (!s || !isFinite(s)) return "--:--";
                    const m = Math.floor(s / 60);
                    const sec = Math.floor(s % 60);
                    return `${m}:${sec.toString().padStart(2, "0")}`;
                  };

                  const labelStyle = {
                    fontSize: ".72rem",
                    fontWeight: 700,
                    letterSpacing: ".05em",
                    textTransform: "uppercase",
                    color: colors.accent,
                    fontFamily: tokens.font.body,
                    flexShrink: 0,
                    lineHeight: 1.5,
                    paddingTop: "1px",
                    width: "3.8rem",
                    textAlign: "right",
                  };
                  const textStyle = {
                    fontSize: "1rem",
                    color: "#ddd",
                    fontFamily: tokens.font.body,
                    lineHeight: 1.45,
                  };
                  const rowStyle = { display: "flex", gap: ".5rem", alignItems: "flex-start" };

                  return (
                    <div style={{
                      background: "#182030",
                      borderTop: "1px solid #2a3a4a",
                      padding: ".4rem .6rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: ".3rem",
                      minHeight: "2.4rem",
                      justifyContent: hasContent ? "flex-start" : "center",
                      width: previewW,
                      flexShrink: 0,
                    }}>
                      {!hasContent && (
                        <div style={{ ...textStyle, color: "#2e4050", textAlign: "center", fontSize: ".78rem", fontStyle: "italic" }}>
                          no context
                        </div>
                      )}

                      {categoryNumber !== null && (
                        <div style={rowStyle}>
                          <span style={labelStyle}>Cat</span>
                          <span style={{ ...textStyle, color: "#fff", fontWeight: 700 }}>
                            {categoryNumber} of {totalCategories}
                          </span>
                          {enrichedItem?.superSecret && (
                            <span style={{ fontSize: ".7rem", color: colors.accent, fontWeight: 700, fontStyle: "italic", letterSpacing: ".03em", alignSelf: "center" }}>
                              Super Secret
                            </span>
                          )}
                        </div>
                      )}

                      {isResultsPlaceStep && enrichedItem && (
                        <div style={rowStyle}>
                          <span style={labelStyle}>Now</span>
                          <span style={{ ...textStyle, color: "#fff", fontWeight: 700 }}>
                            {enrichedItem.place} · {enrichedItem.points} {enrichedItem.points === 1 ? "pt" : "pts"}
                          </span>
                        </div>
                      )}
                      {nextPlaceInfo && (
                        <div style={rowStyle}>
                          <span style={labelStyle}>Next</span>
                          <span style={{ ...textStyle, color: colors.accent }}>
                            {nextPlaceInfo.place} · {nextPlaceInfo.points} pts
                            {enrichedItem?.points != null ? ` (+${nextPlaceInfo.points - enrichedItem.points})` : ""}
                          </span>
                        </div>
                      )}

                      {soloTeamName && (
                        <div style={rowStyle}>
                          <span style={labelStyle}>Solo</span>
                          <span style={{ ...textStyle, color: "#fff", fontWeight: 700 }}>{soloTeamName}</span>
                        </div>
                      )}

                      {enrichedItem?.type === "category" && enrichedItem?.superSecret && (
                        <div style={rowStyle}>
                          <span style={labelStyle}>🔎</span>
                          <span style={{ ...textStyle, color: "#ddd" }}>
                            <strong style={{ color: colors.accent }}>This is the Super Secret category of the week!</strong>{" "}
                            If you follow us on Facebook, you'll see a post at the start of each week letting you know where around central Minnesota you can find us that week. That post also tells you the super secret category for the week, so that you can study up before the contest to have a leg up on the competition!
                          </span>
                        </div>
                      )}

                      {hasQuestionNotes && !navIsAnswerMode && (
                        <div style={rowStyle}>
                          <span style={labelStyle}>Notes</span>
                          <span style={textStyle} dangerouslySetInnerHTML={{ __html: marked.parseInline(enrichedItem.questionNotes) }} />
                        </div>
                      )}

                      {hasPronunciation && (
                        <div style={rowStyle}>
                          <span style={labelStyle}>Pron.</span>
                          <span style={{ ...textStyle, fontStyle: "italic" }} dangerouslySetInnerHTML={{ __html: marked.parseInline(enrichedItem.pronunciationGuide) }} />
                        </div>
                      )}

                      {hasAnswerNotes && navIsAnswerMode && (
                        <div style={rowStyle}>
                          <span style={labelStyle}>Ans. notes</span>
                          <span style={textStyle} dangerouslySetInnerHTML={{ __html: marked.parseInline(enrichedItem.answerNotes) }} />
                        </div>
                      )}

                      {isTbStep && tbTeamsAndGuesses.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: ".2rem" }}>
                          <div style={rowStyle}>
                            <span style={labelStyle}>TB</span>
                            <span style={{ ...textStyle, color: "#fff", fontWeight: 700 }}>
                              {enrichedItem.tbQuestion || ""}
                            </span>
                          </div>
                          {enrichedItem.tbAnswer && (
                            <div style={rowStyle}>
                              <span style={labelStyle}>Ans.</span>
                              <span style={{ ...textStyle, color: colors.accent }}>{enrichedItem.tbAnswer}</span>
                            </div>
                          )}
                          {tbTeamsAndGuesses.map((tg, i) => (
                            <div key={i} style={{ ...rowStyle, paddingLeft: "4.3rem" }}>
                              <span style={{ ...textStyle, color: "#aaa", flex: 1 }}>{tg.teamName}</span>
                              <span style={{ ...textStyle, color: "#fff", flexShrink: 0, marginLeft: ".5rem" }}>
                                {tg.guess !== null && tg.guess !== undefined ? `guessed ${tg.guess}` : "no guess"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {hasAudio && audioObj && (
                        <div style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
                          <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                            <span style={labelStyle}>Audio</span>
                            <span style={{ ...textStyle, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {audioObj.filename || "audio file"}
                            </span>
                            <span style={{ ...textStyle, color: "#888", flexShrink: 0, fontSize: ".78rem" }}>
                              {isCurrentAudio && audioCurrentTime > 0
                                ? `${formatTime(audioCurrentTime)} / ${formatTime(audioDuration)}`
                                : formatTime(audioDuration)}
                            </span>
                          </div>
                          <div
                            style={{
                              height: "5px",
                              background: "#2a3a4a",
                              borderRadius: "3px",
                              cursor: isCurrentAudio && audioDuration ? "pointer" : "default",
                              overflow: "hidden",
                            }}
                            onClick={(e) => {
                              if (!sharedAudioRef.current || !audioDuration) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                              sharedAudioRef.current.currentTime = ratio * audioDuration;
                            }}
                          >
                            <div style={{
                              height: "100%",
                              width: isCurrentAudio && audioDuration
                                ? `${Math.min(100, (audioCurrentTime / audioDuration) * 100)}%`
                                : "0%",
                              background: colors.accent,
                              borderRadius: "3px",
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>{/* end body column */}
      </div>

      {/* Question Edit Modal */}
      {stripEditing && navCurrentItem?.type === "question" && (() => {
        const sqid = navCurrentItem.showQuestionId;
        const saveEdits = () => {
          editQuestionField(sqid, "question", stripEditDraft.question.trim());
          editQuestionField(sqid, "notes", stripEditDraft.notes.trim());
          editQuestionField(sqid, "pronunciationGuide", stripEditDraft.pronunciationGuide.trim());
          editQuestionField(sqid, "answer", stripEditDraft.answer.trim());
          editQuestionField(sqid, "answerNotes", stripEditDraft.answerNotes.trim());
          setStripEditing(false);
        };
        const fieldStyle = {
          width: "100%",
          boxSizing: "border-box",
          background: "#f7f7f7",
          border: `1px solid ${colors.gray?.border || "#ddd"}`,
          borderRadius: ".3rem",
          fontFamily: tokens.font.body,
          fontSize: ".9rem",
          padding: ".35rem .5rem",
          color: colors.dark,
          resize: "vertical",
        };
        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
            onClick={() => setStripEditing(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: "10px", padding: "1.25rem 1.5rem", width: "min(520px, 100%)", display: "flex", flexDirection: "column", gap: ".75rem", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".25rem" }}>
                <span style={{ fontWeight: 700, fontSize: "1rem", fontFamily: tokens.font.body, color: colors.dark }}>
                  Edit Q{navCurrentItem.questionNumber} — {navCurrentItem.categoryName}
                </span>
                <button onClick={() => setStripEditing(false)} style={{ background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer", color: "#888", lineHeight: 1 }}>✕</button>
              </div>
              {[
                { key: "question", label: "Question text", rows: 3 },
                { key: "notes", label: "Question notes", rows: 2 },
                { key: "pronunciationGuide", label: "Pronunciation guide", rows: 1 },
                { key: "answer", label: "Answer", rows: 1 },
                { key: "answerNotes", label: "Answer notes", rows: 2 },
              ].map(({ key, label, rows }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: ".2rem" }}>
                  <label style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: colors.accent, fontFamily: tokens.font.body }}>{label}</label>
                  <textarea
                    value={stripEditDraft[key] || ""}
                    onChange={(e) => setStripEditDraft(d => ({ ...d, [key]: e.target.value }))}
                    rows={rows}
                    style={fieldStyle}
                    autoFocus={key === "question"}
                  />
                </div>
              ))}
              <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end", marginTop: ".25rem" }}>
                <button onClick={() => setStripEditing(false)} style={{ fontFamily: tokens.font.body, fontSize: ".85rem", padding: ".4rem .9rem", borderRadius: ".35rem", border: `1px solid ${colors.gray?.border || "#ccc"}`, background: "transparent", cursor: "pointer", color: colors.dark }}>Cancel</button>
                <button onClick={saveEdits} style={{ fontFamily: tokens.font.body, fontSize: ".85rem", padding: ".4rem .9rem", borderRadius: ".35rem", border: `1px solid ${colors.accent}`, background: colors.accent, color: "#fff", cursor: "pointer", fontWeight: 600 }}>Save</button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* ── Floating Questions panel ── */}
      {questionsOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 500 }}>
          <Draggable nodeRef={questionsRef} position={questionsPos} onStop={(e, d) => { const p = { x: d.x, y: d.y }; setQuestionsPos(p); localStorage.setItem("tv_questionsPos", JSON.stringify(p)); }}>
            <div ref={questionsRef} style={{ position: "absolute", background: "#fff", borderRadius: "8px", boxShadow: "0 4px 24px rgba(0,0,0,0.2)", width: "min(96vw, 900px)", maxHeight: "85vh", display: "flex", flexDirection: "column", pointerEvents: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", padding: ".4rem .75rem", borderBottom: `1px solid ${colors.gray?.border || "#e0e0e0"}`, cursor: "grab", background: colors.dark, borderRadius: "8px 8px 0 0", userSelect: "none" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: ".9rem", flex: 1, fontFamily: tokens.font.body }}>Questions &amp; Answers</span>
                <button onClick={() => setQuestionsOpen(false)} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0 .25rem" }}>✕</button>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
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
                  hostInfo={composedCachedState?.hostInfo ?? DEFAULT_SHOW_STATE.hostInfo}
                  setPrizes={(val) => patchShared({ prizes: String(val || "") })}
                  setHostInfo={(val) => patchShared({ hostInfo: val })}
                  editQuestionField={editQuestionField}
                  addTiebreaker={addTiebreaker}
                  refreshBundle={refreshBundle}
                  sharedAudioUrl={sharedAudioUrl}
                  sharedAudioPlaying={sharedAudioPlaying}
                  sharedAudioRef={sharedAudioRef}
                  onPlayAudio={playAudio}
                  onToggleAudio={toggleAudio}
                />
              </div>
            </div>
          </Draggable>
        </div>
      )}

      {/* ── Floating Scores panel ── */}
      {scoringOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 500 }}>
          <Draggable nodeRef={scoringRef} position={scoringPos} onStop={(e, d) => { const p = { x: d.x, y: d.y }; setScoringPos(p); localStorage.setItem("tv_scoringPos", JSON.stringify(p)); }}>
            <div ref={scoringRef} style={{ position: "absolute", background: "#fff", borderRadius: "8px", boxShadow: "0 4px 24px rgba(0,0,0,0.2)", width: "min(96vw, 1100px)", maxHeight: "85vh", display: "flex", flexDirection: "column", pointerEvents: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", padding: ".4rem .75rem", borderBottom: `1px solid ${colors.gray?.border || "#e0e0e0"}`, cursor: "grab", background: colors.dark, borderRadius: "8px 8px 0 0", userSelect: "none" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: ".9rem", flex: 1, fontFamily: tokens.font.body }}>Scores</span>
                <button onClick={() => setScoringOpen(false)} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0 .25rem" }}>✕</button>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                <ScoringMode
                  showBundle={showBundle ? { ...showBundle, rounds: (showBundle.rounds || []).filter((r) => Number(r.round) === Number(selectedRoundId)) } : { rounds: [], teams: [] }}
                  selectedShowId={selectedShowId}
                  selectedRoundId={selectedRoundId}
                  preloadedTeams={showBundle?.teams ?? []}
                  cachedState={composedCachedState}
                  onChangeState={(payload) => {
                    setScoringCache((prev) => {
                      const { teams = [], entryOrder = [], grid = {} } = payload;
                      const prevShow = prev[selectedShowId] || DEFAULT_SHOW_STATE;
                      const nextShow = { ...prevShow, teams, entryOrder, grid };
                      const next = { ...prev, [selectedShowId]: nextShow };
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
                      try { localStorage.setItem("trivia.scoring.backup", JSON.stringify(next)); } catch {}
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
              </div>
            </div>
          </Draggable>
        </div>
      )}

      {/* ── Floating Results panel ── */}
      {resultsOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 500 }}>
          <Draggable nodeRef={resultsRef} position={resultsPos} onStop={(e, d) => { const p = { x: d.x, y: d.y }; setResultsPos(p); localStorage.setItem("tv_resultsPos", JSON.stringify(p)); }}>
            <div ref={resultsRef} style={{ position: "absolute", background: "#fff", borderRadius: "8px", boxShadow: "0 4px 24px rgba(0,0,0,0.2)", width: "min(96vw, 1100px)", maxHeight: "85vh", display: "flex", flexDirection: "column", pointerEvents: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", padding: ".4rem .75rem", borderBottom: `1px solid ${colors.gray?.border || "#e0e0e0"}`, cursor: "grab", background: colors.dark, borderRadius: "8px 8px 0 0", userSelect: "none" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: ".9rem", flex: 1, fontFamily: tokens.font.body }}>Results</span>
                <button onClick={() => setResultsOpen(false)} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0 .25rem" }}>✕</button>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
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
                  sendToDisplay={sendToDisplayWithNavSync}
                  displayControlsOpen={true}
                />
              </div>
            </div>
          </Draggable>
        </div>
      )}

      {/* ── Floating Script panel ── */}
      {scriptPanelOpen && scriptSections.length > 0 && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 600 }}>
          <Draggable nodeRef={scriptPanelRef} position={scriptPanelPosition} onStop={(e, d) => { const p = { x: d.x, y: d.y }; setScriptPanelPosition(p); localStorage.setItem("scriptPanelPosition", JSON.stringify(p)); }}>
            <div ref={scriptPanelRef} style={{ position: "absolute", background: colors.dark, borderRadius: "8px", boxShadow: "0 4px 24px rgba(0,0,0,0.35)", width: "min(96vw, 520px)", maxHeight: "75vh", display: "flex", flexDirection: "column", pointerEvents: "auto", border: `1px solid rgba(255,255,255,0.12)` }}>
              <div style={{ display: "flex", alignItems: "center", padding: ".4rem .75rem", borderBottom: "1px solid rgba(255,255,255,0.1)", cursor: "grab", userSelect: "none", gap: ".5rem" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: ".9rem", flex: 1, fontFamily: tokens.font.body }}>💬 Host Script</span>
                {(() => {
                  const atStart = navIsAnswerMode ? navIndex === 0 && navAnswerStage === 0 : navIndex === 0;
                  const atEnd = navStarted && (navIsAnswerMode
                    ? navIndex >= navAnswersModeList.length - 1 && (navAnswersModeList[navIndex]?.type !== "question" || navAnswerStage >= 2)
                    : navIndex >= navWithRules.length - 1);
                  const btnStyle = (disabled) => ({
                    background: "none", border: "1px solid rgba(255,255,255,0.3)", borderRadius: ".35rem",
                    color: disabled ? "rgba(255,255,255,0.25)" : "#fff", cursor: disabled ? "default" : "pointer",
                    fontSize: ".9rem", padding: ".2rem .55rem", fontFamily: tokens.font.body, lineHeight: 1,
                  });
                  return (
                    <>
                      <button onClick={() => !atStart && navBackward()} disabled={atStart} style={btnStyle(atStart)}>←</button>
                      <button onClick={() => !atEnd && navForward()} disabled={atEnd} style={btnStyle(atEnd)}>{navStarted ? "→" : "▶"}</button>
                    </>
                  );
                })()}
                <button onClick={() => setScriptPanelOpen(false)} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0 .25rem" }}>✕</button>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: ".75rem 1rem" }}>
                {scriptSections.map((section, idx) => {
                  const isActive = activeRulesIndex !== null && section.ruleIndex === activeRulesIndex;
                  return (
                    <div key={idx} style={{ marginBottom: ".75rem", padding: ".4rem .6rem", borderRadius: ".35rem", background: isActive ? "rgba(255,140,0,0.18)" : "transparent", border: isActive ? `1px solid ${colors.accent}` : "1px solid transparent", transition: "background 0.2s" }}>
                      <p style={{ margin: 0, fontSize: ".88rem", fontFamily: tokens.font.body, color: "#ddd", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{section.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Draggable>
        </div>
      )}

      {/* ── Older Shows Modal (app-level) ── */}
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

      {/* ── Password Modal ── */}
      {!passwordAuthorized && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "2rem",
              width: 360,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            }}
          >
            <h2 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>
              Enter show password
            </h2>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitPassword()}
                placeholder="Password"
                autoFocus
                style={{
                  flex: 1,
                  padding: "0.4rem 0.6rem",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  fontSize: "0.95rem",
                }}
              />
              <Button onClick={submitPassword}>Go</Button>
            </div>
            {passwordError && (
              <p
                style={{
                  color: "red",
                  fontSize: "0.82rem",
                  marginTop: "0.5rem",
                }}
              >
                {passwordError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Host Setup Modal ── */}
      {hostSetupOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 9000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "2rem",
              width: 360,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            }}
          >
            <h2 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>
              Who's hosting?
            </h2>

            {hostSetupHosts.length > 0 && (
              <>
                <p
                  style={{
                    fontSize: "0.85rem",
                    marginBottom: "0.5rem",
                    color: "#555",
                  }}
                >
                  Select an existing host:
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.4rem",
                    marginBottom: "1rem",
                  }}
                >
                  {hostSetupHosts.map((h) => (
                    <button
                      key={h.host_id}
                      onClick={() => selectHost(h.host_id, h.host_name)}
                      style={{
                        padding: "0.35rem 0.75rem",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                        background: "#f5f5f5",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                      }}
                    >
                      {h.host_name}
                    </button>
                  ))}
                </div>
                <p
                  style={{
                    fontSize: "0.85rem",
                    marginBottom: "0.5rem",
                    color: "#555",
                  }}
                >
                  Or create a new host:
                </p>
              </>
            )}

            {hostSetupHosts.length === 0 && (
              <p
                style={{
                  fontSize: "0.85rem",
                  marginBottom: "0.5rem",
                  color: "#555",
                }}
              >
                Enter your name to get started:
              </p>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                value={hostSetupNewName}
                onChange={(e) => setHostSetupNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createHost()}
                placeholder="Your name"
                style={{
                  flex: 1,
                  padding: "0.4rem 0.6rem",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  fontSize: "0.95rem",
                }}
              />
              <Button onClick={createHost}>Add</Button>
            </div>

            {hostSetupError && (
              <p
                style={{
                  color: "red",
                  fontSize: "0.82rem",
                  marginTop: "0.5rem",
                }}
              >
                {hostSetupError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Venue Picker Modal ── */}
      {venuePickerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 9000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "2rem",
              width: 380,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            }}
          >
            <h2 style={{ marginBottom: "1rem", fontSize: "1.1rem", fontFamily: tokens.font.body }}>
              Where are you hosting tonight?
            </h2>

            {venuePickerLoading && (
              <p style={{ color: "#888", fontFamily: tokens.font.body, fontSize: ".9rem" }}>
                Loading venues…
              </p>
            )}

            {!venuePickerLoading && venuePickerOptions.length === 0 && (
              <p style={{ color: "#888", fontFamily: tokens.font.body, fontSize: ".9rem" }}>
                No shows found for today.
              </p>
            )}

            {(() => {
              const activeVenues = [...new Map(activeDisplays.map((d) => [d.venueShowId, d])).values()];
              if (activeVenues.length === 0) return null;
              return (
                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ fontWeight: 600, fontSize: ".8rem", color: "#888", fontFamily: tokens.font.body, marginBottom: ".4rem", textTransform: "uppercase", letterSpacing: ".04em" }}>
                    Currently active
                  </p>
                  {activeVenues.map((d) => (
                    <Button
                      key={d.venueShowId}
                      onClick={() => selectVenue(d.venueShowId, d.venueName || d.venueShowId)}
                      style={{
                        width: "100%",
                        marginBottom: "0.4rem",
                        background: venueShowId === d.venueShowId ? colors.accent : undefined,
                        color: venueShowId === d.venueShowId ? "#fff" : undefined,
                      }}
                    >
                      {d.venueName || d.venueShowId}
                    </Button>
                  ))}
                  {venuePickerOptions.length > 0 && (
                    <p style={{ fontWeight: 600, fontSize: ".8rem", color: "#888", fontFamily: tokens.font.body, margin: ".8rem 0 .4rem", textTransform: "uppercase", letterSpacing: ".04em" }}>
                      Tonight's shows
                    </p>
                  )}
                </div>
              );
            })()}

            {!venuePickerLoading && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = venueManualInput.trim();
                  if (!name) return;
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                  selectVenue(`custom:${slug}:${todayStr}`, name);
                  setVenueManualInput("");
                }}
                style={{ display: "flex", gap: ".5rem", marginBottom: "1rem" }}
              >
                <input
                  value={venueManualInput}
                  onChange={(e) => setVenueManualInput(e.target.value)}
                  placeholder="Or type a venue name…"
                  style={{
                    flex: 1,
                    fontSize: ".9rem",
                    padding: ".4rem .6rem",
                    border: `1px solid ${colors.gray?.border || "#ccc"}`,
                    borderRadius: ".5rem",
                    fontFamily: tokens.font.body,
                  }}
                />
                <ButtonPrimary type="submit" disabled={!venueManualInput.trim()}>
                  Go
                </ButtonPrimary>
              </form>
            )}

            {!venuePickerLoading && venuePickerOptions.map((v) => (
              <Button
                key={v.venueShowId}
                onClick={() => selectVenue(v.venueShowId, v.venueName)}
                style={{
                  width: "100%",
                  marginBottom: "0.5rem",
                  background: venueShowId === v.venueShowId ? colors.accent : undefined,
                  color: venueShowId === v.venueShowId ? "#fff" : undefined,
                }}
              >
                {v.venueName}
                {v.showCount > 1 && (
                  <span style={{ fontSize: ".75em", marginLeft: ".4rem", opacity: 0.7 }}>
                    ({v.showCount} shows)
                  </span>
                )}
              </Button>
            ))}

            <button
              onClick={() => setVenuePickerOpen(false)}
              style={{
                marginTop: "0.5rem",
                background: "transparent",
                border: "none",
                color: "#888",
                cursor: "pointer",
                fontSize: "0.85rem",
                width: "100%",
                fontFamily: tokens.font.body,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
