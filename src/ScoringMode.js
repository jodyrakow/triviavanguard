// ScoringMode.js — scoring with Supabase as source of truth
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ui,
  ButtonPrimary,
  ButtonTab,
  colors as theme,
  tokens,
} from "./styles/index.js";
import {
  buildCorrectCountMap,
  computeCellPoints,
  buildTeamTotals,
  computeSolosForRound,
} from "./scoring/compute.js";
import { supabase } from "./App.js";

// Save a single cell to Supabase (debounced calls happen in the component)
const saveCellToSupabase = async (showId, showTeamId, showQuestionId, cell) => {
  try {
    console.log("🟢 SUPABASE SAVE:", { showTeamId, showQuestionId, cell });
    const res = await fetch("/.netlify/functions/supaSaveScoringCell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showId,
        showTeamId,
        showQuestionId,
        cell,
        updatedBy: window.localStorage.getItem("hostDevice") || "unknown",
      }),
    });
    if (!res.ok) {
      console.error("Failed to save cell:", await res.text());
    } else {
      console.log("🟢 SUPABASE SAVE SUCCESS");
    }
  } catch (err) {
    console.error("saveCellToSupabase error:", err);
  }
};

// Load all scoring cells for a show from Supabase
const loadGridFromSupabase = async (showId) => {
  try {
    console.log("🔵 SUPABASE LOAD: Fetching grid for show", showId);
    const res = await fetch(
      `/.netlify/functions/supaLoadScoringCells?showId=${encodeURIComponent(showId)}`
    );
    if (!res.ok) {
      console.error("Failed to load grid:", await res.text());
      return null;
    }
    const { grid, cellCount } = await res.json();
    console.log("🔵 SUPABASE LOAD SUCCESS:", cellCount, "cells loaded");
    return grid || {};
  } catch (err) {
    console.error("loadGridFromSupabase error:", err);
    return null;
  }
};

// Small helper to make local IDs for teams added during the show
const makeLocalId = (prefix = "local") =>
  `${prefix}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2, 7)}`;

// Save a ShowTeam to Supabase (add, rename, bonus, league toggle)
const saveShowTeamToSupabase = async (showId, showTeam) => {
  try {
    console.log("🟢 SUPABASE SAVE SHOWTEAM:", { showId, showTeam });
    const res = await fetch("/.netlify/functions/supaSaveShowTeam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showId,
        showTeam,
        updatedBy: window.localStorage.getItem("hostDevice") || "unknown",
      }),
    });
    if (!res.ok) {
      console.error("Failed to save ShowTeam:", await res.text());
    } else {
      console.log("🟢 SUPABASE SAVE SHOWTEAM SUCCESS");
    }
  } catch (err) {
    console.error("saveShowTeamToSupabase error:", err);
  }
};

// Remove a ShowTeam from Supabase (soft delete)
const removeShowTeamFromSupabase = async (showId, showTeamId) => {
  try {
    console.log("🟢 SUPABASE REMOVE SHOWTEAM:", { showId, showTeamId });
    const res = await fetch("/.netlify/functions/supaRemoveShowTeam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        showId,
        showTeamId,
        updatedBy: window.localStorage.getItem("hostDevice") || "unknown",
      }),
    });
    if (!res.ok) {
      console.error("Failed to remove ShowTeam:", await res.text());
    } else {
      console.log("🟢 SUPABASE REMOVE SHOWTEAM SUCCESS");
    }
  } catch (err) {
    console.error("removeShowTeamFromSupabase error:", err);
  }
};

// Load all ShowTeams for a show from Supabase
const loadShowTeamsFromSupabase = async (showId) => {
  try {
    console.log("🔵 SUPABASE LOAD SHOWTEAMS: Fetching for show", showId);
    const res = await fetch(
      `/.netlify/functions/supaLoadShowTeams?showId=${encodeURIComponent(showId)}`
    );
    if (!res.ok) {
      console.error("Failed to load ShowTeams:", await res.text());
      return null;
    }
    const { teams, count } = await res.json();
    console.log("🔵 SUPABASE LOAD SHOWTEAMS SUCCESS:", count, "teams loaded");
    return teams || [];
  } catch (err) {
    console.error("loadShowTeamsFromSupabase error:", err);
    return null;
  }
};

// Feature flag for faction battle (matches SidebarMenu.js)
const ENABLE_FACTION_BATTLE = false;

export default function ScoringMode({
  showBundle, // { rounds: [{ round, questions: [...] }], teams?: [...] }
  selectedShowId,
  selectedRoundId, // string, e.g. "1"
  preloadedTeams = [], // [{showTeamId, teamId?, teamName, showBonus}]
  cachedState, // { teams, grid, entryOrder } from App-level cache
  onChangeState = () => {},
  scoringMode,
  setScoringMode,
  pubPoints,
  setPubPoints,
  poolPerQuestion,
  setPoolPerQuestion,
  poolContribution,
  setPoolContribution,
}) {
  const roundNumber = Number(selectedRoundId);

  // ---- Build question list for the round (compact shape for grid) ----
  const roundObj = useMemo(() => {
    if (!Array.isArray(showBundle?.rounds)) return null;
    return (
      showBundle.rounds.find((r) => Number(r.round) === roundNumber) || null
    );
  }, [showBundle, roundNumber]);

  const teamBarRef = useRef(null);

  const questions = useMemo(() => {
    // Flatten questions from categories structure
    const raw = [];
    const categories = roundObj?.categories || [];
    for (const cat of categories) {
      const catQuestions = cat.questions || [];
      raw.push(...catQuestions);
    }

    // Find the single tiebreaker question (if present)
    const tbQ =
      raw.find((q) => (q.questionType || "").toLowerCase() === "tiebreaker") ||
      raw.find((q) => String(q.questionOrder).toUpperCase() === "TB") ||
      raw.find((q) => String(q.id || "").startsWith("tb-")) ||
      null;

    // Exclude tiebreaker from the regular grid
    const rawNonTB = tbQ ? raw.filter((q) => q !== tbQ) : raw;

    // Same sort as before (letters first, then numbers)
    const bySort = [...rawNonTB].sort((a, b) => {
      const sa = Number(a.sortOrder ?? 9999);
      const sb = Number(b.sortOrder ?? 9999);
      if (sa !== sb) return sa - sb;
      const cvt = (val) => {
        if (typeof val === "string" && /^[A-Z]$/i.test(val)) {
          return val.toUpperCase().charCodeAt(0) - 64; // A=1
        }
        const n = parseInt(val, 10);
        return isNaN(n) ? 9999 : 100 + n;
      };
      return cvt(a.questionOrder) - cvt(b.questionOrder);
    });

    return bySort.map((q) => ({
      showQuestionId: q.showQuestionId || q.id, // prefer showQuestionId, fall back to id
      questionId: (Array.isArray(q.questionId) && q.questionId[0]) || null,
      order: q.questionOrder,
      text: q.questionText || "",
      notes: q.questionNotes || "",
      answer: q.answer || "",
      pubPerQuestion:
        typeof q.pointsPerQuestion === "number" ? q.pointsPerQuestion : null,
      // Bonus click-cycle fields
      bonusAvailable: !!q.bonusAvailable,
      bonusValue: q.bonusValue || null,
      maxBonuses: typeof q.maxBonuses === "number" ? q.maxBonuses : null,
    }));
  }, [roundObj]);

  // --- Tiebreaker detection (one per show) ---
  const tiebreaker = React.useMemo(() => {
    // Search BOTH the flat questions array (where host-added TBs live)
    // AND the nested categories structure (for Airtable TBs)
    const list = [];

    // First: check flat questions array (host-added tiebreakers)
    const flatQuestions = roundObj?.questions || [];
    list.push(...flatQuestions);

    // Second: check nested categories structure (Airtable tiebreakers)
    const categories = roundObj?.categories || [];
    for (const cat of categories) {
      const catQuestions = cat.questions || [];
      list.push(...catQuestions);
    }

    // prefer explicit type, else "TB" order, else id that starts with tb-
    return (
      list.find((q) => (q.questionType || "").toLowerCase() === "tiebreaker") ||
      list.find((q) => String(q.questionOrder).toUpperCase() === "TB") ||
      list.find((q) => String(q.id || "").startsWith("tb-")) ||
      null
    );
  }, [roundObj]);

  // ---------------- Local state (seeded from cachedState OR preloadedTeams) ----------------
  const [teams, setTeams] = useState([]); // [{showTeamId, teamId?, teamName, showBonus}]
  const [grid, setGrid] = useState({}); // {[showTeamId]: {[showQuestionId]: {isCorrect, bonusCount}}}
  const [entryOrder, setEntryOrder] = useState([]); // [showTeamId]
  const seededOnceRef = useRef(false);
  const [supabaseLoaded, setSupabaseLoaded] = useState(false); // track if Supabase load finished

  // Search results state (used by Add Team modal)
  const [searchResults, setSearchResults] = useState([]);
  // 🔁 MOVED UP: Add Team modal state so it's defined before useEffect below
  const [addingTeam, setAddingTeam] = useState(false);
  const [teamInput, setTeamInput] = useState("");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  // Debounce and abort refs for team search
  const searchDebounceRef = useRef(null);
  const searchAbortRef = useRef(null);
  // Keep refs to each cell <div> for scrolling into view
  const cellRefs = useRef({});
  const tbRefs = useRef({});
  const onEnterBlur = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  // OLD tv:mark, tv:cellEdit, tv:tbEdit, tv:teamBonus listeners REMOVED - now using Supabase realtime

  // Remove a team and all their cells
  const removeTeam = (showTeamId) => {
    const hasAnyScores =
      Object.values(grid[showTeamId] || {}).some(
        (c) => c?.isCorrect || (c?.bonusCount ?? 0) !== 0
      ) ||
      (teams.find((t) => t.showTeamId === showTeamId)?.showBonus ?? 0) !== 0;

    const name =
      teams.find((t) => t.showTeamId === showTeamId)?.teamName || "this team";
    const ok = window.confirm(
      hasAnyScores
        ? `Delete “${name}” and all their scores/bonuses for this round? This cannot be undone.`
        : `Delete “${name}”?`
    );
    if (!ok) return;

    setTeams((prev) => prev.filter((t) => t.showTeamId !== showTeamId));
    setGrid((prev) => {
      const next = { ...prev };
      delete next[showTeamId];
      return next;
    });
    setEntryOrder((prev) => prev.filter((id) => id !== showTeamId));

    // If focused column was this team, bump focus left if possible
    setFocus((f) => {
      const totalAfter = Math.max(0, teams.length - 1);
      const newTeamIdx = Math.min(f.teamIdx, Math.max(0, totalAfter - 1));
      return { teamIdx: newTeamIdx, qIdx: f.qIdx };
    });

    // Save removal to Supabase (soft delete)
    removeShowTeamFromSupabase(selectedShowId, showTeamId);
  };

  useEffect(() => {
    if (!addingTeam) setSearchResults([]);
  }, [addingTeam]);

  const pubPerQuestionByShowQ = useMemo(() => {
    const m = {};
    for (const q of questions) {
      if (q.pubPerQuestion !== null && q.pubPerQuestion !== undefined) {
        m[q.showQuestionId] = q.pubPerQuestion; // allow 0 as a valid value
      }
    }
    return m;
  }, [questions]);

  const moveTeam = (teamId, delta) => {
    setEntryOrder((prev) => {
      const idx = prev.indexOf(teamId);
      if (idx === -1) return prev;
      const newIdx = Math.min(Math.max(0, idx + delta), prev.length - 1);
      const copy = [...prev];
      copy.splice(idx, 1);
      copy.splice(newIdx, 0, teamId);
      return copy;
    });
  };

  // helper: coerce Airtable-ish shapes into what the grid expects
  const normalizeTeam = (t) => ({
    showTeamId: t.showTeamId || makeLocalId("team"),
    teamId: t.teamId ?? null,
    teamName: Array.isArray(t.teamName)
      ? t.teamName[0]
      : t.teamName || "(Unnamed team)",
    showBonus: Number(t.showBonus || 0),
    isLeague: !!t.isLeague, // Include league status
  });

  // Clear local state when the SHOW changes (not the round)
  useEffect(() => {
    setTeams([]);
    setGrid({});
    setEntryOrder([]);
    setFocus({ teamIdx: 0, qIdx: 0 });
    seededOnceRef.current = false; // allow a fresh seed for the new show
  }, [selectedShowId]);

  // Fallback seed from cache/preloaded ONLY if Supabase has loaded but found no teams
  // This handles the case of a brand new show with no Supabase data yet
  useEffect(() => {
    if (seededOnceRef.current) return; // already seeded (from Supabase or earlier)
    if (!supabaseLoaded) return; // wait for Supabase to finish loading first
    if (teams.length > 0) return; // local already has teams

    const source =
      (cachedState?.teams?.length && cachedState.teams) ||
      (preloadedTeams?.length && preloadedTeams) ||
      null;

    if (!source) return; // no fallback data available

    console.log("🔵 FALLBACK: Seeding from cache/preloaded (Supabase had no teams)");
    const seededTeams = source.map(normalizeTeam);
    const seededEntryOrder =
      cachedState?.entryOrder || seededTeams.map((t) => t.showTeamId);

    setTeams(seededTeams);
    // Don't overwrite grid - it may have been loaded from Supabase even if teams weren't
    // Only seed grid if it's currently empty
    setGrid((prevGrid) => {
      if (Object.keys(prevGrid).length > 0) {
        console.log("🔵 FALLBACK: Keeping existing grid (already has data)");
        return prevGrid;
      }
      return cachedState?.grid || {};
    });
    setEntryOrder(seededEntryOrder);
    setFocus({ teamIdx: 0, qIdx: 0 });
    seededOnceRef.current = true;
  }, [teams.length, cachedState, preloadedTeams, supabaseLoaded]);

  // ---------- Load teams and grid from Supabase on mount ----------
  const supabaseLoadedRef = useRef(false);
  useEffect(() => {
    if (!selectedShowId) return;
    if (supabaseLoadedRef.current) return;

    const loadFromSupabase = async () => {
      // Load teams from Supabase (the authoritative source)
      const supabaseTeams = await loadShowTeamsFromSupabase(selectedShowId);
      if (supabaseTeams && supabaseTeams.length > 0) {
        console.log("🔵 SUPABASE: Setting teams from Supabase", supabaseTeams.length);
        const normalizedTeams = supabaseTeams.map((t) => ({
          showTeamId: t.show_team_id,
          teamId: t.team_id,
          teamName: t.team_name,
          showBonus: t.show_bonus || 0,
          isLeague: t.is_league || false,
        }));
        setTeams(normalizedTeams);
        setEntryOrder(supabaseTeams.map((t) => t.show_team_id));
        seededOnceRef.current = true; // Mark as seeded from Supabase
      }

      // Load grid from Supabase
      const supabaseGrid = await loadGridFromSupabase(selectedShowId);
      if (supabaseGrid && Object.keys(supabaseGrid).length > 0) {
        setGrid(supabaseGrid);
      }
      supabaseLoadedRef.current = true;
      setSupabaseLoaded(true); // Trigger fallback seeding check
    };
    loadFromSupabase();
  }, [selectedShowId]);

  // Reset supabase loaded flag when show changes
  useEffect(() => {
    supabaseLoadedRef.current = false;
    setSupabaseLoaded(false);
  }, [selectedShowId]);

  // ---------- Supabase realtime subscription for scoring_cells ----------
  useEffect(() => {
    if (!supabase || !selectedShowId) return;

    console.log("🟣 SUPABASE REALTIME: Subscribing to scoring_cells for show", selectedShowId);
    const channel = supabase
      .channel(`scoring_cells:${selectedShowId}`)
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

          console.log("🟣 SUPABASE REALTIME UPDATE:", {
            team: newRow.show_team_id,
            question: newRow.show_question_id,
            isCorrect: newRow.is_correct
          });
          const { show_team_id, show_question_id, is_correct, bonus_count, tiebreaker_guess, tiebreaker_guess_raw } = newRow;

          setGrid((prev) => {
            const byTeam = prev[show_team_id] ? { ...prev[show_team_id] } : {};
            byTeam[show_question_id] = {
              isCorrect: is_correct,
              bonusCount: bonus_count || 0,
              tiebreakerGuess: tiebreaker_guess,
              tiebreakerGuessRaw: tiebreaker_guess_raw,
            };
            return { ...prev, [show_team_id]: byTeam };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedShowId]);

  // ---------- Supabase realtime subscription for show_teams ----------
  useEffect(() => {
    if (!supabase || !selectedShowId) return;

    console.log("🟣 SUPABASE REALTIME: Subscribing to show_teams for show", selectedShowId);
    const channel = supabase
      .channel(`show_teams:${selectedShowId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "show_teams",
          filter: `show_id=eq.${selectedShowId}`,
        },
        (payload) => {
          const { new: newRow, eventType } = payload;
          if (!newRow) return;

          console.log("🟣 SUPABASE REALTIME SHOWTEAM UPDATE:", {
            event: eventType,
            showTeamId: newRow.show_team_id,
            teamName: newRow.team_name,
            isRemoved: newRow.is_removed,
          });

          const showTeamId = newRow.show_team_id;

          // Handle removal (soft delete)
          if (newRow.is_removed) {
            setTeams((prev) => prev.filter((t) => t.showTeamId !== showTeamId));
            setGrid((prev) => {
              const next = { ...prev };
              delete next[showTeamId];
              return next;
            });
            setEntryOrder((prev) => prev.filter((id) => id !== showTeamId));
            return;
          }

          // Handle add or update
          const updatedTeam = {
            showTeamId: newRow.show_team_id,
            teamId: newRow.team_id,
            teamName: newRow.team_name,
            showBonus: newRow.show_bonus || 0,
            isLeague: newRow.is_league || false,
          };

          setTeams((prev) => {
            const existingIdx = prev.findIndex((t) => t.showTeamId === showTeamId);
            if (existingIdx >= 0) {
              // Update existing team
              const updated = [...prev];
              updated[existingIdx] = { ...updated[existingIdx], ...updatedTeam };
              return updated;
            } else {
              // Add new team
              return [...prev, updatedTeam];
            }
          });

          // Add to entry order if new
          setEntryOrder((prev) => {
            if (!prev.includes(showTeamId)) {
              return [...prev, showTeamId];
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedShowId]);

  // ---------- Sync state back to App-level cache for ResultsMode ----------
  const lastSentRef = useRef("");
  useEffect(() => {
    // Don't sync empty state to cache before Supabase has loaded
    // This prevents clobbering the cache during initial component mount
    if (!supabaseLoaded) return;

    const payload = { teams, grid, entryOrder };
    const key = JSON.stringify(payload);
    if (key !== lastSentRef.current) {
      lastSentRef.current = key;
      onChangeState(payload);
    }
  }, [teams, grid, entryOrder, onChangeState, supabaseLoaded]);

  // ---------------- View wiring (sorting, team mode, nav) ----------------
  const [sortMode, setSortMode] = useState("entry"); // "entry" | "alpha"

  const visibleTeams = useMemo(() => {
    if (!teams.length) return [];
    if (sortMode === "alpha") {
      return [...teams].sort((a, b) =>
        (a.teamName || "").localeCompare(b.teamName || "", "en", {
          sensitivity: "base",
        })
      );
    }
    const pos = new Map(entryOrder.map((id, i) => [id, i]));
    return [...teams].sort(
      (a, b) => (pos.get(a.showTeamId) ?? 1e9) - (pos.get(b.showTeamId) ?? 1e9)
    );
  }, [teams, sortMode, entryOrder]);

  const [teamMode, setTeamMode] = useState(false);
  const [teamIdxSolo, setTeamIdxSolo] = useState(0);
  const renderTeams = useMemo(() => {
    if (!teamMode) return visibleTeams;
    const one = visibleTeams[teamIdxSolo];
    return one ? [one] : [];
  }, [teamMode, visibleTeams, teamIdxSolo]);

  // after renderTeams/useState etc., put these at top level:
  const nextTeam = useCallback(() => {
    if (!visibleTeams.length) return;
    setTeamIdxSolo((i) => (i + 1) % visibleTeams.length);
  }, [visibleTeams.length]);

  const prevTeam = useCallback(() => {
    if (!visibleTeams.length) return;
    setTeamIdxSolo((i) => (i - 1 + visibleTeams.length) % visibleTeams.length);
  }, [visibleTeams.length]);

  // OLD tv:teamAdd, tv:teamRemove, tv:teamRename listeners REMOVED - now using Supabase show_teams realtime

  const renameTeam = (showTeamId, nextName) => {
    const name = String(nextName ?? "").trim();
    if (!name) return;

    let updatedTeam = null;
    setTeams((prev) =>
      prev.map((t) => {
        if (t.showTeamId === showTeamId) {
          updatedTeam = { ...t, teamName: name };
          return updatedTeam;
        }
        return t;
      })
    );

    // Save to Supabase
    if (updatedTeam) {
      saveShowTeamToSupabase(selectedShowId, updatedTeam);
    }
  };

  const toggleLeague = (showTeamId, isLeague) => {
    let updatedTeam = null;
    setTeams((prev) =>
      prev.map((t) => {
        if (t.showTeamId === showTeamId) {
          updatedTeam = { ...t, isLeague };
          return updatedTeam;
        }
        return t;
      })
    );

    // Save to Supabase
    if (updatedTeam) {
      saveShowTeamToSupabase(selectedShowId, updatedTeam);
    }
  };

  const setFactionPledge = (showTeamId, factionPledge) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.showTeamId === showTeamId ? { ...t, factionPledge } : t
      )
    );
    try {
      window.sendFactionPledge?.({
        showId: selectedShowId,
        teamId: showTeamId,
        factionPledge,
        ts: Date.now(),
      });
    } catch {}
  };

  // ---------------- Focus + keyboard nav ----------------
  const [focus, setFocus] = useState({ teamIdx: 0, qIdx: 0 });
  useEffect(() => {
    setFocus((f) => ({
      teamIdx: Math.min(f.teamIdx, Math.max(renderTeams.length - 1, 0)),
      qIdx: Math.min(f.qIdx, Math.max(questions.length - 1, 0)),
    }));
  }, [renderTeams, questions.length]);

  const toggleCell = useCallback(
    (showTeamId, showQuestionId) => {
      // Find team and question by ID instead of index to avoid stale closure issues
      const t = teams.find((team) => team.showTeamId === showTeamId);
      const q = questions.find(
        (question) => question.showQuestionId === showQuestionId
      );
      if (!t || !q) return;

      setGrid((prev) => {
        const byTeam = prev[showTeamId] ? { ...prev[showTeamId] } : {};
        const cell = byTeam[showQuestionId] || {
          isCorrect: false,
          bonusCount: 0,
        };

        // Click-cycle logic:
        // - If incorrect → mark correct, bonusCount = 0
        // - If correct && bonusAvailable && bonusCount < maxBonuses → increment bonusCount
        // - If correct && (!bonusAvailable || bonusCount >= maxBonuses) → mark incorrect
        const maxBonuses = q.maxBonuses || 0;
        const hasBonusAvailable = q.bonusAvailable && maxBonuses > 0;
        const currentBonusCount = cell.bonusCount || 0;

        let nextOn, nextBonusCount;
        if (!cell.isCorrect) {
          // Click #1: mark correct
          nextOn = true;
          nextBonusCount = 0;
        } else if (hasBonusAvailable && currentBonusCount < maxBonuses) {
          // Click #2+: apply bonus (stay correct, increment bonusCount)
          nextOn = true;
          nextBonusCount = currentBonusCount + 1;
        } else {
          // Max bonuses reached or no bonus available: toggle back to incorrect
          nextOn = false;
          nextBonusCount = 0;
        }

        const newCell = {
          ...cell,
          isCorrect: nextOn,
          bonusCount: nextBonusCount,
        };
        byTeam[showQuestionId] = newCell;

        // Save to Supabase
        saveCellToSupabase(selectedShowId, showTeamId, showQuestionId, newCell);

        console.log("[toggleCell]", {
          question: q.order,
          nowCorrect: nextOn,
          bonusCount: nextBonusCount,
          bonusAvailable: q.bonusAvailable,
          bonusValue: q.bonusValue,
          maxBonuses: q.maxBonuses,
        });

        // OLD BROADCAST REMOVED - now using Supabase scoring_cells realtime

        return { ...prev, [showTeamId]: byTeam };
      });
    },
    [teams, questions, selectedShowId, selectedRoundId]
  );

  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
        return;
      if (!renderTeams.length || !questions.length) return;

      const { teamIdx, qIdx } = focus;

      if (e.key === "1" || e.key === " ") {
        e.preventDefault();
        const team = teamMode ? renderTeams[0] : renderTeams[teamIdx];
        const question = questions[qIdx];
        if (team && question) {
          toggleCell(team.showTeamId, question.showQuestionId);
        }
      } else if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        // If we're on the last grid row and there's a TB row, focus its input
        if (focus.qIdx === questions.length - 1 && tiebreaker) {
          const colTeam = teamMode
            ? visibleTeams[teamIdxSolo]
            : renderTeams[teamIdx];
          const input = colTeam ? tbRefs.current?.[colTeam.showTeamId] : null;
          if (input && typeof input.focus === "function") {
            input.focus();
            // make it obvious + bring it onscreen
            input.select?.();
            input.scrollIntoView?.({ block: "center", behavior: "smooth" });
            // brief highlight so you can SEE it moved
            input.style.outline = "2px solid #DC6A24";
            setTimeout(() => (input.style.outline = ""), 600);
            return; // stop here so we don't advance to next column
          }
        }
        // otherwise: advance to next question in this column
        setFocus(({ teamIdx: t, qIdx }) => ({
          teamIdx: teamMode ? teamIdxSolo : t,
          qIdx: (qIdx + 1) % questions.length, // ✅ wraps to top when at last row
        }));
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        setFocus(({ teamIdx: t, qIdx }) => ({
          teamIdx: teamMode ? teamIdxSolo : t,
          qIdx: (qIdx - 1 + questions.length) % questions.length,
        }));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (teamMode) {
          nextTeam(); // 👈 cycle to next team
          setFocus((f) => ({ teamIdx: 0, qIdx: f.qIdx })); // single column
        } else {
          setFocus(({ teamIdx, qIdx }) => ({
            teamIdx: Math.min(teamIdx + 1, renderTeams.length - 1),
            qIdx,
          }));
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (teamMode) {
          prevTeam(); // 👈 cycle to previous team
          setFocus((f) => ({ teamIdx: 0, qIdx: f.qIdx }));
        } else {
          setFocus(({ teamIdx, qIdx }) => ({
            teamIdx: Math.max(teamIdx - 1, 0),
            qIdx,
          }));
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        // If we're on the last grid row and there's a TB row, focus its input
        if (focus.qIdx === questions.length - 1 && tiebreaker) {
          const colTeam = teamMode
            ? visibleTeams[teamIdxSolo]
            : renderTeams[teamIdx];
          const input = colTeam ? tbRefs.current?.[colTeam.showTeamId] : null;
          if (input && typeof input.focus === "function") {
            input.focus();
            return; // stop here so we don't advance to next question
          }
        }

        // otherwise: advance down in the grid as usual
        setFocus(({ teamIdx: t, qIdx }) => ({
          teamIdx: teamMode ? teamIdxSolo : t,
          qIdx: Math.min(qIdx + 1, questions.length - 1),
        }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocus(({ teamIdx: t, qIdx }) => ({
          teamIdx: teamMode ? teamIdxSolo : t,
          qIdx: Math.max(qIdx - 1, 0),
        }));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    renderTeams,
    questions,
    focus,
    teamMode,
    teamIdxSolo,
    nextTeam,
    prevTeam,
    toggleCell,
    tiebreaker,
    visibleTeams,
  ]); // 👈 include next/prev

  // 👉 Auto-scroll focused cell into view
  useEffect(() => {
    if (!renderTeams.length || !questions.length) return;

    const logicalTeamIdx = teamMode ? 0 : focus.teamIdx;
    const t = renderTeams[logicalTeamIdx];
    const q = questions[focus.qIdx];
    if (!t || !q) return;

    const key = `${t.showTeamId}:${q.showQuestionId}`;
    const el = cellRefs.current[key];
    if (!el || typeof el.getBoundingClientRect !== "function") return;

    // 1) center it (good for large jumps)
    el.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });

    // 2) then correct for sticky chrome (table header + optional team bar)
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();

      // Increased to show full header + controls bar (including Team Scoring Mode button)
      const baseTopGuard = 180; // header (~55px) + controls bar (~100px) + margin/padding (~25px)
      const extraTeamBar =
        teamMode && teamBarRef.current
          ? teamBarRef.current.getBoundingClientRect().height || 0
          : 0;

      const topLimit = baseTopGuard + extraTeamBar;
      const bottomLimit = window.innerHeight - 56; // your BOTTOM_GUARD

      let dy = 0;
      if (r.top < topLimit) dy = r.top - topLimit;
      else if (r.bottom > bottomLimit) dy = r.bottom - bottomLimit;

      if (dy !== 0) window.scrollBy({ top: dy, behavior: "smooth" });
    });
  }, [focus, renderTeams, questions, teamMode, teamIdxSolo]);

  // ---------------- Derived scoring helpers ----------------
  const correctCountByShowQuestionId = useMemo(() => {
    return buildCorrectCountMap(teams, questions, grid);
  }, [questions, teams, grid]);

  // Build scoring config object for utility functions
  const scoringConfig = useMemo(
    () => ({
      mode: scoringMode,
      pubPoints: Number(pubPoints || 0),
      poolPerQuestion: Number(poolPerQuestion || 0),
      poolContribution: Number(poolContribution || 0),
      teamCount: teams.length,
    }),
    [scoringMode, pubPoints, poolPerQuestion, poolContribution, teams.length]
  );

  const earnedFor = useCallback(
    (cell, showQuestionId) => {
      if (!cell) return 0;

      // Cell format for compute utility
      const adaptedCell = {
        isCorrect: cell.isCorrect,
        bonusCount: cell.bonusCount || 0,
      };

      // Handle per-question pub points (if this question has its own value, use it)
      let config = scoringConfig;
      if (scoringConfig.mode === "pub") {
        const perQPub = pubPerQuestionByShowQ[showQuestionId];
        if (perQPub !== null && perQPub !== undefined) {
          config = { ...scoringConfig, pubPoints: perQPub };
        }
      }

      const correctCount = correctCountByShowQuestionId[showQuestionId] || 0;

      // Get question bonus info for click-cycle bonus calculation
      const q = questions.find((q) => q.showQuestionId === showQuestionId);
      const questionBonus = q?.bonusAvailable
        ? { bonusValue: q.bonusValue, maxBonuses: q.maxBonuses }
        : null;

      return computeCellPoints(
        adaptedCell,
        config,
        correctCount,
        questionBonus
      );
    },
    [
      correctCountByShowQuestionId,
      scoringConfig,
      pubPerQuestionByShowQ,
      questions,
    ]
  );

  // Adapt grid format for buildTeamTotals utility
  const adaptedGrid = useMemo(() => {
    const adapted = {};
    for (const teamId in grid) {
      adapted[teamId] = {};
      for (const questionId in grid[teamId]) {
        const cell = grid[teamId][questionId];
        adapted[teamId][questionId] = {
          isCorrect: cell.isCorrect,
          bonusCount: cell.bonusCount || 0,
        };
      }
    }
    return adapted;
  }, [grid]);

  const displayTotals = useMemo(() => {
    if (!teams.length || !questions.length) return {};
    return buildTeamTotals(
      teams,
      questions,
      adaptedGrid,
      scoringConfig,
      correctCountByShowQuestionId
    );
  }, [
    teams,
    questions,
    adaptedGrid,
    scoringConfig,
    correctCountByShowQuestionId,
  ]);

  // ---------------- Local mutations (pure state) ----------------
  const updateShowBonus = (showTeamId, val) => {
    const v = Number(val) || 0;

    let updatedTeam = null;
    setTeams((prev) =>
      prev.map((t) => {
        if (t.showTeamId === showTeamId) {
          updatedTeam = { ...t, showBonus: v };
          return updatedTeam;
        }
        return t;
      })
    );

    // Save to Supabase
    if (updatedTeam) {
      saveShowTeamToSupabase(selectedShowId, updatedTeam);
    }
  };

  const addTeamLocal = async (teamName, airtableTeamId = null) => {
    const trimmed = (teamName || "").trim();
    if (!trimmed) return;

    setIsCreatingTeam(true);

    try {
      // Call Airtable to create ShowTeam (and Team if needed)
      const res = await fetch("/.netlify/functions/createShowTeam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId: selectedShowId,
          teamName: trimmed,
          teamId: airtableTeamId, // Pass existing Team ID if from search
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to create team");
      }

      const { showTeamId, teamId, teamName: finalName } = await res.json();

      const newTeam = {
        showTeamId,  // Real Airtable ShowTeam ID
        teamId,      // Real Airtable Team ID
        teamName: finalName || trimmed,
        showBonus: 0,
      };

      let entryOrderIdx = 0;
      setTeams((prev) => {
        entryOrderIdx = prev.length; // Will be the index in the new array
        const updated = [...prev, newTeam];
        // Set focus to the new team (will be last in visible teams)
        setTimeout(() => {
          setTeamIdxSolo(updated.length - 1);
          setFocus({ teamIdx: updated.length - 1, qIdx: 0 });
        }, 0);
        return updated;
      });
      setEntryOrder((prev) => [...prev, newTeam.showTeamId]);

      // Save to Supabase
      saveShowTeamToSupabase(selectedShowId, {
        ...newTeam,
        entryOrder: entryOrderIdx,
      });

      // Close modal and reset input
      setAddingTeam(false);
      setTeamInput("");
      setSearchResults([]);
    } catch (err) {
      console.error("Failed to create team:", err);
      alert(`Failed to add team: ${err.message}`);
    } finally {
      setIsCreatingTeam(false);
    }
  };

  // --- TB ADD: helpers to read/write tiebreaker guesses in local grid -------
  // --- TB ADD: helpers to read/write tiebreaker guesses in local grid -------
  const getTBGuess = (showTeamId) => {
    if (!tiebreaker) return "";
    const cell = grid[showTeamId]?.[(tiebreaker.showQuestionId || tiebreaker.id)] || {};
    if (typeof cell.tiebreakerGuessRaw === "string")
      return cell.tiebreakerGuessRaw;
    if (
      typeof cell.tiebreakerGuess === "number" &&
      Number.isFinite(cell.tiebreakerGuess)
    ) {
      return String(cell.tiebreakerGuess);
    }
    return "";
  };

  // Allow partial numerics while typing (e.g., "-", ".", "12.", "0.").
  const setTBGuess = (showTeamId, nextStr) => {
    if (!tiebreaker) return;
    const raw = String(nextStr ?? "");

    // Accept empty or partial numeric inputs
    const partialOk = /^-?\d*\.?\d*$/.test(raw);
    if (!partialOk) return; // ignore disallowed characters

    setGrid((prev) => {
      const byTeam = prev[showTeamId] ? { ...prev[showTeamId] } : {};
      const cell = byTeam[(tiebreaker.showQuestionId || tiebreaker.id)] || {
        isCorrect: false,
        bonusCount: 0,
      };
      byTeam[(tiebreaker.showQuestionId || tiebreaker.id)] = { ...cell, tiebreakerGuessRaw: raw };
      return { ...prev, [showTeamId]: byTeam };
    });

    // OLD BROADCAST REMOVED - now using Supabase scoring_cells realtime (sync happens on blur/save)
  };

  // Commit on blur: coerce to number if valid, else clear
  const commitTBGuess = (showTeamId) => {
    if (!tiebreaker) return;
    const raw = getTBGuess(showTeamId).trim();
    const num = raw === "" ? null : Number(raw);

    setGrid((prev) => {
      const byTeam = prev[showTeamId] ? { ...prev[showTeamId] } : {};
      const cell = byTeam[(tiebreaker.showQuestionId || tiebreaker.id)] || {
        isCorrect: false,
        bonusCount: 0,
      };

      const showQuestionId = tiebreaker.showQuestionId || tiebreaker.id;
      let newCell;
      if (raw === "" || Number.isNaN(num)) {
        newCell = {
          ...cell,
          tiebreakerGuess: null,
          tiebreakerGuessRaw: "",
        };
      } else {
        // normalize stored raw to canonical string
        const normalized = String(num);
        newCell = {
          ...cell,
          tiebreakerGuess: num,
          tiebreakerGuessRaw: normalized,
        };
      }
      byTeam[showQuestionId] = newCell;

      // Save to Supabase
      saveCellToSupabase(selectedShowId, showTeamId, showQuestionId, newCell);

      return { ...prev, [showTeamId]: byTeam };
    });

    // OLD BROADCAST REMOVED - Supabase realtime syncs via saveCellToSupabase above
  };

  // ---------------- Sticky & tile styles ----------------
  const COL_Q_WIDTH = 60;
  const TEAM_COL_WIDTH = 120;
  const bonusBorder = "1px solid rgba(220,106,36,0.65)";
  const thinRowBorder = "1px solid rgba(220,106,36,0.35)";
  const focusColor = theme.dark;
  const HEADER_ROW_HEIGHT = 44; // Height to position bonus row below header

  const sticky = {
    thTop: {
      position: "sticky",
      top: 0,
      zIndex: 10,
      background: "#fff",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)", // Add shadow for visibility
    },
    qNumTh: {
      position: "sticky",
      left: 0,
      top: 0,
      zIndex: 11, // Higher than thTop so corner cell stays on top
      background: "#fff",
      textAlign: "center",
      minWidth: COL_Q_WIDTH,
      width: COL_Q_WIDTH,
      maxWidth: COL_Q_WIDTH,
      boxShadow: "2px 2px 4px rgba(0,0,0,0.1)", // Shadow on both axes
    },
    qNumTd: {
      position: "sticky",
      left: 0,
      zIndex: 5,
      background: "#fff",
      textAlign: "center",
      minWidth: COL_Q_WIDTH,
      width: COL_Q_WIDTH,
      maxWidth: COL_Q_WIDTH,
      boxShadow: "2px 0 4px rgba(0,0,0,0.05)", // Subtle shadow
    },
    bonusRowCell: {
      position: "sticky",
      top: HEADER_ROW_HEIGHT, // sits just under the header row
      zIndex: 9,
      background: "#fff",
      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
    },
  };

  const tileBase = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
    height: 30,
    borderRadius: 5,
    border: "1px solid #DC6A24",
    padding: "0 .25rem",
    userSelect: "none",
    fontSize: ".95rem",
  };
  const tileStates = {
    correct: { background: "#DC6A24", color: "#fff", cursor: "pointer" },
    correctWithBonus: {
      background: theme.dark,
      color: "#fff",
      cursor: "pointer",
    },
    wrong: { background: "#fff1e6", color: "#2B394A", cursor: "pointer" },
  };
  const tileFocus = {
    boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${focusColor}`,
    transform: "scale(1.04)",
    outline: "none",
    transition: "box-shadow 120ms ease, transform 120ms ease",
  };

  // --------- Solos calculation ---------
  const solosData = useMemo(() => {
    const result = computeSolosForRound(teams, questions, adaptedGrid);
    // Convert to format expected by UI (array of team names, sorted)
    const formatted = {
      count: result.count,
      teams: result.teams.map((t) => t.teamName).sort(),
    };
    console.log("[ScoringMode] Solos calculation:", {
      questionCount: questions.length,
      teamCount: teams.length,
      solosCount: formatted.count,
      soloTeams: formatted.teams,
    });
    return formatted;
  }, [teams, questions, adaptedGrid]);

  // ---------------- Render ----------------

  return (
    <div
      style={{
        marginTop: "1rem",
        fontFamily: "Questrial, sans-serif",
        color: theme.dark,
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: theme.dark,
          padding: "0.5rem 0",
          borderTop: `2px solid ${theme.accent}`,
          borderBottom: `2px solid ${theme.accent}`,
          marginBottom: "0.75rem",
        }}
      >
        <h2
          style={{
            color: theme.accent,
            fontFamily: "Antonio",
            fontSize: "1.6rem",
            margin: 0,
            textIndent: "0.5rem",
            letterSpacing: "0.015em",
          }}
        >
          Scores
        </h2>
        {solosData.count > 0 && (
          <div
            style={{
              color: "#fff",
              fontFamily: tokens.font.body,
              fontSize: "1rem",
              marginLeft: "0.5rem",
              marginTop: "0.25rem",
              marginRight: "1rem",
            }}
          >
            {solosData.count} solo{solosData.count !== 1 ? "s" : ""} this round:{" "}
            {solosData.teams.join(", ")}
          </div>
        )}
      </div>

      {/* Top controls */}
      <ui.Bar>
        {/* LEFT controls */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: ".35rem",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "nowrap",
              minWidth: 0,
            }}
          >
            <ButtonPrimary onClick={() => setAddingTeam(true)}>
              + Add team
            </ButtonPrimary>

            <ui.Segmented style={{ flexShrink: 0 }}>
              <button
                style={ui.segBtn(sortMode === "entry")}
                onClick={() => setSortMode("entry")}
                title="Entry order"
              >
                Entry
              </button>
              <button
                style={ui.segBtn(sortMode === "alpha")}
                onClick={() => setSortMode("alpha")}
                title="Alphabetical"
              >
                A→Z
              </button>
            </ui.Segmented>

            <ButtonTab
              active={teamMode}
              onClick={() => {
                if (!teamMode) {
                  // Entering team mode - show the currently focused team
                  setTeamIdxSolo(focus.teamIdx);
                }
                setTeamMode((prev) => !prev);
              }}
              title="Toggle team scoring mode"
              style={{ flexShrink: 0 }}
            >
              {teamMode ? "Exit Team Scoring Mode" : "Team Scoring Mode"}
            </ButtonTab>
          </div>
        </div>

        {/* RIGHT stats */}
        <div
          style={{
            justifySelf: "end",
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textAlign: "right",
          }}
        >
          <strong>Teams:</strong> {teams.length} &nbsp;|&nbsp;
          <strong>Questions:</strong> {questions.length}
        </div>
      </ui.Bar>

      {/* Grid */}
      <div
        style={{
          overflowX: "auto",
          overflowY: "auto", // 👈 allow vertical scroll *inside* grid
          maxHeight: "70vh",
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: "0.5rem",
          display: "block",
          maxWidth: "100%",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {teamMode && (
          <div
            ref={teamBarRef}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.4rem 0.5rem",
              borderBottom: "1px solid #eee",
              position: "sticky",
              top: 0,
              background: "#fff",
              zIndex: 5,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: theme.dark,
                whiteSpace: "nowrap",
              }}
            >
              Scoring team:
            </div>

            <ui.Segmented style={{ flexShrink: 0 }}>
              <button
                style={ui.segBtn(false)}
                onClick={prevTeam}
                title="Previous team"
              >
                ◀
              </button>
              <button
                style={{
                  ...ui.segBtn(false),
                  borderLeft: "1px solid rgba(220,106,36,0.35)", // thin light orange divider
                }}
                onClick={nextTeam}
                title="Next team"
              >
                ▶
              </button>
            </ui.Segmented>

            <select
              value={teamIdxSolo}
              onChange={(e) => setTeamIdxSolo(Number(e.target.value))}
              style={{
                padding: "0.35rem 0.5rem",
                border: "1px solid #ccc",
                borderRadius: "0.35rem",
                minWidth: 180,
                maxWidth: 360,
              }}
              title="Choose team to score"
            >
              {visibleTeams.map((t, idx) => (
                <option key={t.showTeamId} value={idx}>
                  {t.teamName}
                </option>
              ))}
            </select>
          </div>
        )}

        <table
          style={{
            width: "auto",
            borderCollapse: "separate",
            tableLayout: "fixed",
            borderSpacing: 0,
          }}
        >
          <thead>
            <tr style={{ background: theme.bg, borderBottom: thinRowBorder }}>
              <th
                style={{
                  padding: "0.35rem 0.4rem",
                  ...sticky.qNumTh,
                  ...sticky.thTop,
                }}
              >
                Q#
              </th>
              {renderTeams.map((t) => (
                <th
                  key={t.showTeamId}
                  style={{
                    textAlign: "center",
                    padding: "0.3rem",
                    width: TEAM_COL_WIDTH,
                    maxWidth: TEAM_COL_WIDTH,
                    minWidth: TEAM_COL_WIDTH,
                    ...sticky.thTop,
                    borderBottom: "none",
                  }}
                >
                  {/* Team name (renamable) */}
                  <div
                    style={{
                      fontSize: "0.95rem",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      lineHeight: 1.1,
                      cursor: "pointer",
                    }}
                    title="Right-click or double-click to rename"
                    onDoubleClick={() => {
                      const v = window.prompt("Rename team:", t.teamName);
                      if (v !== null) renameTeam(t.showTeamId, v);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const v = window.prompt("Rename team:", t.teamName);
                      if (v !== null) renameTeam(t.showTeamId, v);
                    }}
                  >
                    {t.teamName}
                  </div>

                  {/* League checkbox */}
                  <div
                    style={{
                      marginTop: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!t.isLeague}
                        onChange={(e) => {
                          toggleLeague(t.showTeamId, e.target.checked);
                        }}
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ opacity: 0.85 }}>League</span>
                    </label>
                  </div>

                  {/* Faction pledge dropdown */}
                  {ENABLE_FACTION_BATTLE && (
                    <div
                      style={{
                        marginTop: "0.35rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.75rem",
                          userSelect: "none",
                        }}
                      >
                        <span style={{ opacity: 0.85 }}>Faction</span>
                        <select
                          value={t.factionPledge || ""}
                          onChange={(e) => {
                            setFactionPledge(
                              t.showTeamId,
                              e.target.value || null
                            );
                          }}
                          style={{
                            cursor: "pointer",
                            fontSize: "0.7rem",
                            padding: "0.15rem 0.25rem",
                            borderRadius: "3px",
                            border: `1px solid ${theme.accent}`,
                            backgroundColor: theme.bg,
                            color: theme.accent,
                            fontFamily: tokens.font.body,
                          }}
                        >
                          <option value="">None</option>
                          <option value="Star Trek">🖖 Star Trek</option>
                          <option value="Star Wars">⚔️ Star Wars</option>
                        </select>
                      </label>
                    </div>
                  )}

                  {/* Move buttons */}
                  <div
                    style={{
                      marginTop: "0.25rem",
                      display: "flex",
                      gap: "0.25rem",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        marginTop: "0.25rem",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <ui.Segmented
                        style={{
                          border: "1px solid rgba(220,106,36,0.65)", // thin orange border all around
                          borderRadius: "999px", // keep pill shape
                          overflow: "hidden",
                        }}
                      >
                        <button
                          style={ui.segBtn(false)}
                          onClick={() => moveTeam(t.showTeamId, -1)}
                          title="Move left"
                        >
                          ◀
                        </button>
                        <button
                          style={{
                            ...ui.segBtn(false),
                            borderLeft: "1px solid rgba(220,106,36,0.65)", // thin orange divider
                          }}
                          onClick={() => moveTeam(t.showTeamId, +1)}
                          title="Move right"
                        >
                          ▶
                        </button>
                      </ui.Segmented>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    aria-label={`Remove ${t.teamName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTeam(t.showTeamId);
                    }}
                    style={{
                      margin: "0.25rem auto 0",
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: `1px solid ${theme.accent}`,
                      background: theme.bg,
                      color: theme.accent,
                      cursor: "pointer",
                      padding: 0,
                      display: "grid",
                      placeItems: "center",
                    }}
                    title="Delete team"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  {/* Totals */}
                  <div
                    style={{ fontSize: ".8rem", opacity: 0.85, marginTop: 2 }}
                  >
                    Total: <strong>{displayTotals[t.showTeamId] ?? 0}</strong>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Team bonus row */}
            <tr>
              <td
                style={{
                  padding: "0.3rem",
                  ...sticky.qNumTd,
                  ...sticky.bonusRowCell,
                  fontWeight: "bold",
                  color: theme.accent,
                  borderTop: bonusBorder,
                  borderBottom: bonusBorder,
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  lineHeight: 1.1,
                  fontSize: ".9rem",
                }}
              >
                Team bonus
              </td>

              {renderTeams.map((t) => (
                <td
                  key={t.showTeamId}
                  style={{
                    textAlign: "center",
                    padding: "0.2rem",
                    borderTop: bonusBorder,
                    borderBottom: bonusBorder,
                    ...sticky.bonusRowCell,
                  }}
                >
                  <input
                    type="number"
                    value={t.showBonus ?? 0}
                    onChange={(e) =>
                      updateShowBonus(t.showTeamId, e.target.value)
                    }
                    onKeyDown={onEnterBlur}
                    style={{
                      width: 40,
                      textAlign: "center",
                      padding: "0.2rem",
                      border: `1px solid ${theme.accent}`,
                      borderRadius: "0.25rem",
                      fontSize: ".85rem",
                      color: theme.accent,
                      outlineColor: theme.accent,
                    }}
                    title="Show-level bonus points"
                  />
                </td>
              ))}
            </tr>

            {questions.map((q, qi) => (
              <tr key={q.showQuestionId}>
                <td
                  style={{
                    padding: "0.35rem",
                    ...sticky.qNumTd,
                    borderBottom: thinRowBorder,
                  }}
                >
                  <strong>{q.order}</strong>
                </td>

                {renderTeams.map((t, ti) => {
                  // 👇 use 0 when teamMode renders a single column
                  const renderIndex = teamMode ? 0 : ti;

                  const cell = grid[t.showTeamId]?.[q.showQuestionId];
                  const on = !!cell?.isCorrect;
                  const bonusCount = cell?.bonusCount || 0;
                  // normalize focus to the single rendered column in team mode
                  const focusTeamIdx = teamMode ? 0 : focus.teamIdx;

                  // highlight should compare against the rendered index (0 in team mode)
                  const isFocused =
                    focusTeamIdx === renderIndex && focus.qIdx === qi;

                  const pts = earnedFor(cell, q.showQuestionId);

                  // Determine tile state: correct with bonus, correct, or wrong
                  let tileState = tileStates.wrong;
                  if (on && bonusCount > 0) {
                    tileState = tileStates.correctWithBonus;
                  } else if (on) {
                    tileState = tileStates.correct;
                  }

                  const style = {
                    ...tileBase,
                    ...tileState,
                    ...(isFocused ? tileFocus : null),

                    scrollMarginTop: 8,
                    scrollMarginBottom: 8,
                    // Dark blue border for questions with bonus available
                    ...(q.bonusAvailable
                      ? {
                          borderColor: theme.dark,
                          ...(on ? null : { background: "#EAF2FB" }),
                        }
                      : null),
                  };

                  return (
                    <td
                      key={t.showTeamId}
                      style={{
                        textAlign: "center",
                        padding: "0.25rem",
                        borderBottom: thinRowBorder,
                      }}
                    >
                      <div
                        tabIndex={-1}
                        ref={(el) => {
                          cellRefs.current[
                            `${t.showTeamId}:${q.showQuestionId}`
                          ] = el;
                        }}
                        role="button"
                        aria-pressed={!!cell?.isCorrect}
                        // 👇 clicking outer area selects the cell without toggling
                        onClick={() => {
                          setFocus({
                            teamIdx: renderIndex,
                            qIdx: qi,
                          });
                        }}
                        style={style}
                        title={
                          on
                            ? bonusCount > 0
                              ? `Correct — ${pts} pts (${bonusCount} bonus${bonusCount > 1 ? "es" : ""} applied)\n(Click to toggle • 1/Space to toggle)`
                              : `Correct — ${pts} pts\n(Click to toggle • 1/Space to toggle)`
                            : `Incorrect\n(Click to toggle • 1/Space to toggle)`
                        }
                      >
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCell(t.showTeamId, q.showQuestionId);
                          }}
                          style={{ cursor: "pointer", display: "block" }}
                        >
                          {on
                            ? bonusCount > 0
                              ? `(${bonusCount}⭑) ${pts}`
                              : `✓ ${pts}`
                            : "○"}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* --- TB ADD: Tiebreaker capture row (final in grid) ---------------- */}
            {tiebreaker && (
              <tr>
                <td
                  style={{
                    padding: "0.35rem",
                    ...sticky.qNumTd,
                    borderTop: thinRowBorder,
                    borderBottom: thinRowBorder,
                    fontWeight: 700,
                    color: theme.accent,
                    verticalAlign: "middle",
                  }}
                  title="Tiebreaker — closest to the number wins"
                >
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      transform: "translateY(2px)",
                      marginRight: "0.25rem",
                    }}
                  >
                    🎯
                  </span>
                  TB
                </td>

                {renderTeams.map((t) => (
                  <td
                    key={t.showTeamId}
                    style={{
                      textAlign: "center",
                      padding: "0.25rem",
                      borderTop: thinRowBorder,
                      borderBottom: thinRowBorder,
                    }}
                  >
                    <input
                      ref={(el) => {
                        tbRefs.current[t.showTeamId] = el;
                      }}
                      type="text"
                      inputMode="decimal"
                      placeholder="—"
                      value={getTBGuess(t.showTeamId)}
                      onChange={(e) => setTBGuess(t.showTeamId, e.target.value)}
                      onBlur={() => commitTBGuess(t.showTeamId)}
                      style={{
                        width: 60,
                        textAlign: "center",
                        padding: ".2rem .3rem",
                        border: `1px solid ${theme.accent}`,
                        borderRadius: tokens.radius.sm,
                        fontFamily: tokens.font.body,
                        fontSize: tokens.font.size,
                        color: theme.accent,
                        outlineColor: theme.accent,
                      }}
                      onKeyDown={(e) => {
                        const goTopOfSameColumn = () => {
                          e.preventDefault();
                          // Always return to top of current column (don't advance to next column)
                          setFocus(({ teamIdx }) => ({
                            teamIdx: teamMode ? 0 : teamIdx,
                            qIdx: 0,
                          }));
                          e.currentTarget.blur(); // leave the TB field so focus returns to grid
                        };

                        if (e.key === "Enter") {
                          commitTBGuess(t.showTeamId);
                          goTopOfSameColumn();
                          return;
                        }
                        if (e.key === "Tab" && !e.shiftKey) {
                          goTopOfSameColumn();
                        } else if (e.key === "ArrowDown") {
                          goTopOfSameColumn();
                        }
                      }}
                      aria-label={`Tiebreaker guess for ${t.teamName}`}
                    />
                  </td>
                ))}
              </tr>
            )}
            {/* ------------------------------------------------------------------- */}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: ".5rem", fontSize: ".9rem" }}>
        Keyboard: <code>1</code> / <code>Space</code> toggle • <code>Tab</code>/
        <code>Shift+Tab</code> next/prev question • <code>←/→</code> team •{" "}
        <code>↑/↓</code> question
      </div>

      {/* Add Team Modal (local or Airtable search) */}
      {addingTeam && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(43,57,74,.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setAddingTeam(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              padding: "1rem",
              borderRadius: "0.5rem",
              minWidth: 420,
              border: `1px solid ${theme.accent}`,
            }}
          >
            <h3 style={{ marginTop: 0, color: theme.dark }}>
              Add team to this show
            </h3>

            {/* Search field */}
            <input
              autoFocus
              value={teamInput}
              onChange={(e) => {
                const val = e.target.value;
                setTeamInput(val);

                // Clear any pending debounce
                if (searchDebounceRef.current) {
                  clearTimeout(searchDebounceRef.current);
                }

                // Abort any in-flight request
                if (searchAbortRef.current) {
                  searchAbortRef.current.abort();
                }

                if (val.length >= 3) {
                  // Debounce: wait 300ms after last keystroke
                  searchDebounceRef.current = setTimeout(async () => {
                    const controller = new AbortController();
                    searchAbortRef.current = controller;

                    try {
                      const res = await fetch(
                        `/.netlify/functions/searchTeams?q=${encodeURIComponent(val)}`,
                        { signal: controller.signal }
                      );
                      const json = await res.json();

                      // Normalize to { id, name, recentShowTeams: [{id,label}] }
                      const normalized = (json.matches || []).map((m) => {
                        const id = m.teamId ?? m.id ?? "";
                        const name = m.teamName ?? m.name ?? "";
                        // If backend returns strings in m.showTeams, convert to [{id,label}]
                        const recentShowTeams = Array.isArray(m.showTeams)
                          ? m.showTeams.map((label, idx) => ({
                              id: `${id}::${idx}`, // unique key for React
                              label: String(label || ""),
                            }))
                          : Array.isArray(m.recentShowTeams)
                            ? m.recentShowTeams.map((r, idx) => ({
                                id: r.id ?? `${id}::${idx}`,
                                label: r.label ?? String(r || ""),
                              }))
                            : [];

                        return { id, name, recentShowTeams };
                      });

                      setSearchResults(normalized);
                    } catch (err) {
                      // Ignore abort errors (expected when typing fast)
                      if (err.name !== "AbortError") {
                        console.error("searchTeams error:", err);
                        setSearchResults([]);
                      }
                    }
                  }, 300);
                } else {
                  setSearchResults([]);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isCreatingTeam) {
                  e.preventDefault();
                  if (searchResults.length > 0) {
                    const t = searchResults[0];
                    addTeamLocal(t.name, t.id);
                  } else if (teamInput.trim()) {
                    addTeamLocal(teamInput.trim());
                  }
                  // Modal closing handled by addTeamLocal on success
                } else if (e.key === "Escape" && !isCreatingTeam) {
                  e.preventDefault();
                  setAddingTeam(false);
                }
              }}
              placeholder="Enter team name"
              style={{
                width: "100%",
                marginBottom: ".5rem",
                padding: "0.5rem",
                border: "1px solid #ccc",
                borderRadius: "0.25rem",
              }}
            />

            {searchResults.map((t) => (
              <div
                key={t.id} // ✅ unique team key
                onClick={() => {
                  if (isCreatingTeam) return;
                  addTeamLocal(t.name, t.id);
                  // Modal closing handled by addTeamLocal on success
                }}
                style={{
                  padding: ".45rem .6rem",
                  cursor: "pointer",
                  borderBottom: "1px solid #eee",
                }}
                title={
                  Array.isArray(t.recentShowTeams) && t.recentShowTeams.length
                    ? `Recent: ${t.recentShowTeams.map((r) => r.label).join(" • ")}`
                    : ""
                }
              >
                <div style={{ fontWeight: 600 }}>{t.name}</div>

                {Array.isArray(t.recentShowTeams) &&
                  t.recentShowTeams.length > 0 && (
                    <div
                      style={{ fontSize: ".85rem", opacity: 0.8, marginTop: 4 }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>
                        Recent:
                      </div>
                      <div>
                        {t.recentShowTeams.slice(0, 3).map((r) => (
                          <div key={r.id} style={{ lineHeight: 1.2 }}>
                            {r.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ))}

            {/* Loading indicator */}
            {isCreatingTeam && (
              <div style={{ padding: "0.5rem", textAlign: "center", color: theme.accent }}>
                Adding team...
              </div>
            )}

            {/* Manual add fallback */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                disabled={isCreatingTeam || !teamInput.trim()}
                onClick={() => {
                  if (isCreatingTeam) return;
                  addTeamLocal(teamInput); // no Airtable ID
                  // Modal closing handled by addTeamLocal on success
                }}
                style={{
                  padding: "0.5rem 0.75rem",
                  border: `1px solid ${theme.accent}`,
                  background: isCreatingTeam ? "#ccc" : theme.accent,
                  color: "#fff",
                  borderRadius: "0.25rem",
                  cursor: isCreatingTeam ? "wait" : "pointer",
                  flex: 1,
                  opacity: isCreatingTeam || !teamInput.trim() ? 0.6 : 1,
                }}
              >
                {isCreatingTeam ? "Adding..." : `Add "${teamInput || "Unnamed"}"`}
              </button>
              <button
                disabled={isCreatingTeam}
                onClick={() => setAddingTeam(false)}
                style={{
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #ccc",
                  background: "#f7f7f7",
                  borderRadius: "0.25rem",
                  cursor: isCreatingTeam ? "not-allowed" : "pointer",
                  opacity: isCreatingTeam ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
