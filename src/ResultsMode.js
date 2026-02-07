// src/ResultsMode.js
import React, { useMemo, useRef, useState, useCallback } from "react";
import { tokens, colors as theme, Button } from "./styles/index.js";
import { colors } from "./styles/ui.js";
import {
  buildCorrectCountMap,
  buildTeamTotals,
  computePlaces,
  computeCellPoints,
} from "./scoring/compute.js";

// Normalize team shapes coming from cache (same as ScoringMode)
const normalizeTeam = (t) => ({
  showTeamId: t.showTeamId,
  teamId: t.teamId ?? null,
  teamName: Array.isArray(t.teamName)
    ? t.teamName[0]
    : t.teamName || "(Unnamed team)",
  showBonus: Number(t.showBonus || 0),
  isLeague: !!t.isLeague,
  factionPledge: t.factionPledge || null,
});

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export default function ResultsMode({
  showBundle, // { rounds:[{round, questions:[...] }], showId? }
  selectedRoundId, // e.g. "1" (still used for UI text & fallback mode)
  cachedState, // { teams, grid, entryOrder } for current round (fallback)
  cachedByRound = null, // NEW: flat structure { teams, grid, entryOrder, ... } for all rounds
  scoringMode, // "pub" | "pooled" | "pooled-adaptive"
  pubPoints,
  poolPerQuestion,
  poolContribution,
  factionBonus = 10,
  selectedShowId,
  prizes: prizesString = "", // NEW: prizes from shared state (newline-separated string)
  questionEdits = {}, // { [showQuestionId]: { question?, notes?, pronunciationGuide?, answer? } }
  sendToDisplay, // Function to send content to display mode
  displayControlsOpen = false,
}) {
  // New architecture is ALWAYS cumulative (all data in one flat structure)
  const usingCumulative = true;

  // ---- Build ALL questions across the whole show ----
  const allQuestions = useMemo(() => {
    const rounds = Array.isArray(showBundle?.rounds) ? showBundle.rounds : [];
    const flat = [];
    for (const r of rounds) {
      // Questions are nested under categories
      for (const cat of r?.categories || []) {
        for (const q of cat?.questions || []) {
          flat.push({
            round: r.round,
            showQuestionId: q.showQuestionId || q.id,
            questionId: Array.isArray(q.questionId)
              ? q.questionId[0]
              : (q.questionId ?? null),
            pubPerQuestion:
              typeof q.pointsPerQuestion === "number"
                ? q.pointsPerQuestion
                : null,
            questionType: q.questionType || null,
            sortOrder: Number(q.sortOrder ?? 9999),
            questionOrder: q.questionOrder,
            bonusAvailable: !!q.bonusAvailable,
            bonusValue: q.bonusValue ?? 0,
            maxBonuses: q.maxBonuses ?? 0,
          });
        }
      }
    }
    // same sort you use elsewhere: Sort Order, then alpha/num Question Order
    const cvt = (val) => {
      if (typeof val === "string" && /^[A-Z]$/i.test(val)) {
        return val.toUpperCase().charCodeAt(0) - 64; // A=1
      }
      const n = parseInt(val, 10);
      return Number.isNaN(n) ? 9999 : 100 + n;
    };
    flat.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || cvt(a.questionOrder) - cvt(b.questionOrder)
    );
    return flat;
  }, [showBundle]);

  // ---- Questions: Always use all questions (cumulative) ----
  const questions = useMemo(() => {
    console.log("🔍 ResultsMode - allQuestions:", allQuestions);
    console.log("🔍 ResultsMode - allQuestions.length:", allQuestions.length);
    return allQuestions; // All questions from all rounds
  }, [allQuestions]);

  // ---- Teams (always use flat structure from cachedByRound) ----
  const teams = useMemo(() => {
    // Flat structure: teams are at top level
    const incoming = cachedByRound?.teams || [];
    console.log("🔍 ResultsMode - cachedByRound:", cachedByRound);
    console.log("🔍 ResultsMode - incoming teams:", incoming);
    console.log("🔍 ResultsMode - incoming.length:", incoming.length);
    return incoming.map(normalizeTeam);
  }, [cachedByRound]);

  // ---- Cell accessor: reads from grid (flat structure has single grid for all rounds) ----
  const getCell = useCallback(
    (showTeamId, showQuestionId) => {
      // Flat structure: single grid at top level contains all questions from all rounds
      return cachedByRound?.grid?.[showTeamId]?.[showQuestionId] || null;
    },
    [cachedByRound]
  );

  // ---- Show-wide TB detection (one per show) ----
  const tbQ = useMemo(() => {
    const allRounds = Array.isArray(showBundle?.rounds)
      ? showBundle.rounds
      : [];
    console.log(
      "🔍 ResultsMode - Searching for tiebreaker in rounds:",
      allRounds
    );
    for (const r of allRounds) {
      console.log(
        "🔍 ResultsMode - Round",
        r.round,
        "questions array:",
        r?.questions
      );
      // Check flat questions array (where host-added tiebreakers are stored)
      for (const q of r?.questions || []) {
        const type = (q.questionType || "").toLowerCase();
        if (
          type === "tiebreaker" ||
          String(q.questionOrder).toUpperCase() === "TB" ||
          String(q.id || "").startsWith("tb-")
        ) {
          console.log(
            "🎯 ResultsMode - FOUND TIEBREAKER in flat questions:",
            q
          );
          return q;
        }
      }
      // Also check nested categories structure (for Airtable tiebreakers)
      for (const cat of r?.categories || []) {
        for (const q of cat?.questions || []) {
          const type = (q.questionType || "").toLowerCase();
          if (
            type === "tiebreaker" ||
            String(q.questionOrder).toUpperCase() === "TB" ||
            String(q.id || "").startsWith("tb-")
          ) {
            console.log("🎯 ResultsMode - FOUND TIEBREAKER in categories:", q);
            return q;
          }
        }
      }
    }
    console.log("❌ ResultsMode - NO TIEBREAKER FOUND");
    return null;
  }, [showBundle]);

  const tbNumber = React.useMemo(() => {
    console.log("🔍 ResultsMode - tbNumber extraction - tbQ:", tbQ);
    if (!tbQ) {
      console.log("❌ ResultsMode - tbNumber is null because tbQ is null");
      return null;
    }

    console.log("🔍 ResultsMode - tbQ.tiebreakerNumber:", tbQ.tiebreakerNumber);
    console.log("🔍 ResultsMode - tbQ.answer:", tbQ.answer);
    console.log("🔍 ResultsMode - tbQ.answerText:", tbQ.answerText);
    console.log("🔍 ResultsMode - tbQ.correctAnswer:", tbQ.correctAnswer);

    // 1) explicit numeric wins
    if (
      typeof tbQ.tiebreakerNumber === "number" &&
      Number.isFinite(tbQ.tiebreakerNumber)
    ) {
      console.log(
        "✅ ResultsMode - Using tiebreakerNumber (numeric):",
        tbQ.tiebreakerNumber
      );
      return tbQ.tiebreakerNumber;
    }

    // 2) try common string-ish fields (handle arrays too)
    const pick = (v) => (Array.isArray(v) ? v[0] : v);
    // Filter out empty strings, not just null/undefined
    const raw =
      pick(tbQ.tiebreakerNumber)?.trim() ||
      pick(tbQ.answer)?.trim() ||
      tbQ.answerText?.trim() ||
      tbQ.correctAnswer?.trim() ||
      null;

    console.log("🔍 ResultsMode - raw value after pick:", raw);

    if (!raw) {
      console.log("❌ ResultsMode - raw is falsy, returning null");
      return null;
    }

    // 💡 key fix: remove thousands separators/spaces before matching the number
    const cleaned = String(raw).replace(/[\s,]/g, "");
    console.log("🔍 ResultsMode - cleaned value:", cleaned);
    const m = cleaned.match(/-?\d+(?:\.\d+)?/);
    console.log("🔍 ResultsMode - regex match:", m);
    if (!m) {
      console.log("❌ ResultsMode - No number found in cleaned string");
      return null;
    }

    const n = Number(m[0]);
    console.log("✅ ResultsMode - Extracted number:", n);
    return Number.isFinite(n) ? n : null;
  }, [tbQ]);

  const tbGuessFor = useCallback(
    (showTeamId) => {
      if (!tbQ) return null;
      const cell = getCell(showTeamId, tbQ.showQuestionId || tbQ.id);
      const v = cell?.tiebreakerGuess;
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    },
    [getCell, tbQ]
  );

  // ----------------------- Prize editor state -----------------------
  // Convert shared prizes string to array
  console.log("🎁 RESULTS MODE: prizesString prop =", JSON.stringify(prizesString));
  const prizes = useMemo(() => {
    if (!prizesString) return [];
    const arr = prizesString
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    console.log("🎁 RESULTS MODE: parsed prizes array =", arr);
    return arr;
  }, [prizesString]);

  const prizeCount = prizes.length;
  const showPrizeCol = prizeCount > 0 && prizes.some((p) => p && p.length);

  // --- On-the-fly TB (OTF) state ---
  const [otfOpen, setOtfOpen] = useState(false);
  const [otfSelectedTeams, setOtfSelectedTeams] = useState([]); // [showTeamId]
  const [otfStage, setOtfStage] = useState("pick"); // "pick" | "source" | "guesses" | "review"
  const [otfSource, setOtfSource] = useState({
    // chosen source of the OTF TB
    mode: null, // "airtable" | "custom"
    recordId: null, // Airtable record id (if any)
    question: "", // short text (if any)
    answerText: "", // short text (if any)
    number: null, // numeric answer we’ll compare against
  });
  const [otfGuesses, setOtfGuesses] = useState({}); // { [showTeamId]: "" }
  const [otfApplied, setOtfApplied] = useState(null);
  // when applied: { number, question, answerText, teamDelta: {teamId: number}, selected: [ids] }

  // Build scoring config for utility functions
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

  // ----------------------- Faction Statistics -----------------------
  const factionStats = useMemo(() => {
    // Get all factions that have been pledged to
    const pledgedFactions = new Set(
      teams.map((t) => t.factionPledge).filter(Boolean)
    );

    if (pledgedFactions.size === 0) {
      return null; // No faction battle if no teams pledged
    }

    // Get all questions with faction tags
    const factionQuestions = questions.filter((q) => q.faction);

    if (factionQuestions.length === 0) {
      return null; // No faction battle if no tagged questions
    }

    const rawGrid = cachedByRound?.grid || {};
    const stats = {};

    // Calculate accuracy for each faction
    for (const faction of pledgedFactions) {
      const factionTeams = teams.filter((t) => t.factionPledge === faction);
      const factionQs = factionQuestions.filter((q) => q.faction === faction);

      if (factionTeams.length === 0 || factionQs.length === 0) {
        stats[faction] = {
          teamCount: factionTeams.length,
          questionCount: factionQs.length,
          totalAnswers: 0,
          correctAnswers: 0,
          accuracy: 0,
        };
        continue;
      }

      let totalAnswers = 0;
      let correctAnswers = 0;

      // Count correct answers for this faction's teams on this faction's questions
      for (const team of factionTeams) {
        for (const q of factionQs) {
          const cell = rawGrid[team.showTeamId]?.[q.showQuestionId];
          if (cell) {
            totalAnswers++;
            if (cell.isCorrect) {
              correctAnswers++;
            }
          }
        }
      }

      stats[faction] = {
        teamCount: factionTeams.length,
        questionCount: factionQs.length,
        totalAnswers,
        correctAnswers,
        accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0,
      };
    }

    // Determine winner (highest accuracy)
    let winner = null;
    let maxAccuracy = -1;
    let isTie = false;

    for (const faction of pledgedFactions) {
      const acc = stats[faction].accuracy;
      if (acc > maxAccuracy) {
        maxAccuracy = acc;
        winner = faction;
        isTie = false;
      } else if (acc === maxAccuracy && acc > 0) {
        isTie = true;
      }
    }

    if (isTie) {
      winner = null; // No winner if there's a tie
    }

    return {
      stats,
      winner,
      bonusPoints: winner ? factionBonus : 0,
      factions: Array.from(pledgedFactions),
    };
  }, [teams, questions, cachedByRound?.grid, factionBonus]);

  // ----------------------- Standings (cumulative-aware) -----------------------
  const standings = useMemo(() => {
    if (!teams.length || !questions.length) return [];

    // Build grid in utility format (adapt from cachedByRound.grid)
    const adaptedGrid = {};
    const rawGrid = cachedByRound?.grid || {};
    for (const teamId in rawGrid) {
      adaptedGrid[teamId] = {};
      for (const questionId in rawGrid[teamId]) {
        const cell = rawGrid[teamId][questionId];
        adaptedGrid[teamId][questionId] = {
          isCorrect: cell.isCorrect,
          bonusCount: cell.bonusCount || 0,
        };
      }
    }

    // Filter out tiebreaker questions for scoring
    const scoringQuestions = tbQ
      ? questions.filter((q) => q.showQuestionId !== (tbQ.showQuestionId || tbQ.id))
      : questions;

    // Use utility to build correct count map and team totals
    const nCorrectByQ = buildCorrectCountMap(
      teams,
      scoringQuestions,
      adaptedGrid
    );
    const totalByTeam = buildTeamTotals(
      teams,
      scoringQuestions,
      adaptedGrid,
      scoringConfig,
      nCorrectByQ
    );

    // Base rows
    const rows = teams.map((t) => {
      const baseTotal = +(totalByTeam[t.showTeamId] ?? 0);

      // Apply faction bonus if team won faction battle
      const factionBonus =
        factionStats?.winner && t.factionPledge === factionStats.winner
          ? factionStats.bonusPoints
          : 0;

      const total = baseTotal + factionBonus;

      const guess = tbGuessFor(t.showTeamId);
      const delta =
        tbNumber !== null && guess !== null
          ? Math.abs(guess - tbNumber)
          : Infinity;
      return {
        showTeamId: t.showTeamId,
        teamName: t.teamName || "(Unnamed team)",
        total,
        factionBonus,
        factionPledge: t.factionPledge || null,
        tbGuess: guess,
        tbDelta: delta,
        tieBroken: false,
        unbreakableTie: false,
      };
    });

    // Sort by total desc, then name
    rows.sort(
      (a, b) =>
        b.total - a.total ||
        a.teamName.localeCompare(b.teamName, "en", { sensitivity: "base" })
    );

    // Use utility to compute places with tie handling
    const places = computePlaces(totalByTeam);
    for (const r of rows) {
      r.place = places[r.showTeamId];
    }

    // TB only affects ordering inside prize band (optional)
    if (!prizeCount || prizeCount <= 0 || tbNumber === null || !tbQ) {
      return rows;
    }

    // Identify tie groups (same total)
    const groups = [];
    let idx = 0;
    while (idx < rows.length) {
      const gStart = idx;
      const tot = rows[idx].total;
      idx++;
      while (idx < rows.length && rows[idx].total === tot) idx++;
      groups.push([gStart, idx]); // [start, end)
    }

    // Reorder tie groups intersecting the prize band by tbDelta
    for (const [gStart, gEnd] of groups) {
      const groupInsidePrizeBand = gStart < prizeCount && gStart >= 0;
      if (!groupInsidePrizeBand) continue;

      const slice = rows.slice(gStart, gEnd);
      const usedTBInSlice = slice.some((r) => Number.isFinite(r.tbDelta));
      if (!usedTBInSlice) continue;

      slice.sort((a, b) => {
        if (a.total !== b.total) return 0;
        if (a.tbDelta !== b.tbDelta) return a.tbDelta - b.tbDelta;
        return a.teamName.localeCompare(b.teamName, "en", {
          sensitivity: "base",
        });
      });

      const best = slice[0]?.tbDelta;
      const second = slice[1]?.tbDelta;
      const groupBroken =
        slice.length > 1 &&
        Number.isFinite(best) &&
        Number.isFinite(second) &&
        best !== second;

      slice.forEach((r, k) => {
        r.tieBroken = true;
        r._tbGroupBroken = !!groupBroken;
        r._tbRank = k;
      });

      if (slice.length > 1 && Number.isFinite(best)) {
        const topTied = slice.filter((r) => r.tbDelta === best);
        if (topTied.length > 1)
          topTied.forEach((r) => (r.unbreakableTie = true));
      }

      for (let k = 0; k < slice.length; k++) rows[gStart + k] = slice[k];
    }

    // Re-assign places (unique inside TB-broken groups)
    let prevKey = null;
    let place = 0;
    let cnt = 0;
    for (const r of rows) {
      cnt++;
      const tieKey =
        r && r._tbGroupBroken ? `${r.total}|${r._tbRank}` : `${r.total}|`;
      if (prevKey === null || tieKey !== prevKey) {
        place = cnt;
        prevKey = tieKey;
      }
      r.place = place;
    }
    // ---- OTF TB (on-the-fly) reordering (non-destructive to authored TB logic) ----
    if (otfApplied && prizeCount > 0) {
      const { selected, teamDelta, number } = otfApplied;
      if (selected?.length && Number.isFinite(number)) {
        // group rows by total to ensure we only reorder within equal-total tie groups
        const byTotal = new Map();
        rows.forEach((r, idx) => {
          const arr = byTotal.get(r.total) || [];
          arr.push({ r, idx });
          byTotal.set(r.total, arr);
        });

        for (const arr of byTotal.values()) {
          // consider only the subset that is both selected and inside prize band
          const inThisGroup = arr
            .map((x) => x.r)
            .filter(
              (x) => selected.includes(x.showTeamId) && x.place <= prizeCount
            );

          if (inThisGroup.length >= 2) {
            // sort that subset by OTF distance asc; stable fallback by team name
            const sorted = [...inThisGroup].sort((a, b) => {
              const da = teamDelta[a.showTeamId] ?? Infinity;
              const db = teamDelta[b.showTeamId] ?? Infinity;
              if (da !== db) return da - db;
              return a.teamName.localeCompare(b.teamName, "en", {
                sensitivity: "base",
              });
            });

            // write back in place: we only permute within the same indexes for the selected ones
            const positions = arr
              .map((x, i) => ({ i, r: x.r }))
              .filter(
                (x) =>
                  selected.includes(x.r.showTeamId) && x.r.place <= prizeCount
              )
              .map((x) => x.i);

            positions.forEach((pos, k) => {
              arr[pos].r = sorted[k];
            });
          }
        }

        // flatten back
        const flattened = [];
        byTotal.forEach((group) => group.forEach((x) => flattened.push(x.r)));
        // reassign ascending by the original sort order of groups (they still in order)
        // then recompute places
        flattened.sort(
          (a, b) =>
            b.total - a.total ||
            a.teamName.localeCompare(b.teamName, "en", { sensitivity: "base" })
        );
        let place = 0,
          prevKey = null,
          cnt = 0;
        for (const r of flattened) {
          cnt++;
          // if we re-ordered inside a tie group, make that tie “broken” for the selected ones
          if (selected.includes(r.showTeamId) && r.place <= prizeCount) {
            r.tieBroken = true;
            r._tbGroupBroken = true;
            r._tbRank = teamDelta[r.showTeamId] ?? Infinity; // not shown, but keeps uniqueness
          }
          const tieKey =
            r && r._tbGroupBroken ? `${r.total}|${r._tbRank}` : `${r.total}|`;
          if (prevKey === null || tieKey !== prevKey) {
            place = cnt;
            prevKey = tieKey;
          }
          r.place = place;
        }
        rows.splice(0, rows.length, ...flattened);
      }
    }

    return rows;
  }, [
    teams,
    questions,
    prizeCount,
    tbQ,
    tbNumber,
    tbGuessFor,
    otfApplied,
    cachedByRound,
    scoringConfig,
    factionStats,
  ]);

  // Candidates inside prize band that remain tied (or were unbreakably tied by authored TB)
  const otfDefaultCandidates = useMemo(() => {
    if (!standings.length || prizeCount <= 0) return [];
    // teams whose place is within prizeCount and (not tieBroken OR unbreakableTie)
    // i.e., either no authored TB applied to them, or authored TB still left a tie.
    const ids = standings
      .filter(
        (r) => r.place <= prizeCount && (!r.tieBroken || r.unbreakableTie)
      )
      .map((r) => r.showTeamId);
    // keep only groups where at least 2 share the same total
    const byTotal = new Map();
    standings.forEach((r) => {
      if (r.place <= prizeCount) {
        const arr = byTotal.get(r.total) || [];
        arr.push(r);
        byTotal.set(r.total, arr);
      }
    });
    const realTies = new Set();
    for (const arr of byTotal.values()) {
      if (arr.length >= 2) arr.forEach((r) => realTies.add(r.showTeamId));
    }
    return ids.filter((id) => realTies.has(id));
  }, [standings, prizeCount]);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState(null); // 'ok' | 'error' | null
  const [publishDetail, setPublishDetail] = useState(""); // human text

  const hideTimerRef = React.useRef(null);
  React.useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  const clearBannerSoon = () => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setPublishStatus(null);
      setPublishDetail("");
    }, 4000);
  };

  // ---------- Export JSON Backup ----------
  const exportJSON = () => {
    const showName =
      showBundle?.showName ||
      showBundle?.rounds?.[0]?.categories?.[0]?.questions?.[0]?.showName ||
      "show";
    const showDate =
      showBundle?.showDate || new Date().toISOString().split("T")[0];

    const exportData = {
      showId: selectedShowId,
      showName,
      showDate,
      exportedAt: new Date().toISOString(),
      scoringMode,
      pubPoints,
      poolPerQuestion,
      poolContribution,
      factionBonus,
      showBundle,
      cachedByRound,
      standings: standings.map((s) => ({
        teamName: s.teamName,
        total: s.total,
        place: s.place,
        tbRank: s._tbRank,
        showBonus: s.showBonus,
        factionBonus: s.factionBonus,
        factionPledge: s.factionPledge,
      })),
      prizes: prizes,
      factionStats: factionStats
        ? {
            winner: factionStats.winner,
            bonusPoints: factionStats.bonusPoints,
            stats: factionStats.stats,
            factions: factionStats.factions,
          }
        : null,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trivia-backup-${showName.replace(/[^a-z0-9]/gi, "-")}-${showDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fmtFloat = (v) => {
    if (!Number.isFinite(v)) return "—";
    return Number.isInteger(v) ? String(v) : String(v);
  };

  // Formats
  const fmtNum = (n) =>
    Number.isFinite(n)
      ? Number.isInteger(n)
        ? Math.round(n).toLocaleString("en-US")
        : Number(n).toLocaleString("en-US")
      : "—";

  // Teams whose TB guess should be shown:
  // - authored TB: any tie group (same total) with >=2 teams where at least one finished inside prize band
  // - OTF TB: any selected subset within a tie group where at least one finished inside prize band
  const tbDisplaySet = useMemo(() => {
    const s = new Set();
    if (!standings.length || prizeCount <= 0) return s;

    // group by total
    const groups = new Map(); // total -> rows[]
    for (const r of standings) {
      const arr = groups.get(r.total) || [];
      arr.push(r);
      groups.set(r.total, arr);
    }

    // 1) Authored TB path
    for (const arr of groups.values()) {
      if (arr.length < 2) continue; // not a tie group
      const intersectsPrizeBand = arr.some((r) => r.place <= prizeCount);
      if (!intersectsPrizeBand) continue;
      // show authored guesses for anyone in this tie group who has a finite tbGuess
      for (const r of arr) {
        if (Number.isFinite(r.tbGuess)) s.add(r.showTeamId);
      }
    }

    // 2) OTF path
    if (
      otfApplied &&
      Array.isArray(otfApplied.selected) &&
      otfApplied.selected.length
    ) {
      for (const arr of groups.values()) {
        if (arr.length < 2) continue;
        const selectedInGroup = arr.filter((r) =>
          otfApplied.selected.includes(r.showTeamId)
        );
        if (selectedInGroup.length < 2) continue;
        const intersectsPrizeBand = selectedInGroup.some(
          (r) => r.place <= prizeCount
        );
        if (!intersectsPrizeBand) continue;
        // show OTF guesses for all selected teams in this tie group
        for (const r of selectedInGroup) s.add(r.showTeamId);
      }
    }

    return s;
  }, [standings, prizeCount, otfApplied]);

  const showTbColumn = tbDisplaySet.size > 0;

  // Check if tiebreaker was actually used to break a tie in the prize band
  const tiebreakerWasUsed = useMemo(() => {
    if (!prizeCount || prizeCount <= 0) return false;
    return standings.some((r) => r.place <= prizeCount && r._tbGroupBroken);
  }, [standings, prizeCount]);

  function computePlacesForPublish(rows) {
    let place = 0,
      prevKey = null,
      cnt = 0;
    const out = rows.map((r) => ({ ...r }));
    for (const r of out) {
      cnt++;
      const tieKey =
        r && r._tbGroupBroken ? `${r.total}|${r._tbRank}` : `${r.total}|`;
      if (prevKey === null || tieKey !== prevKey) {
        place = cnt;
        prevKey = tieKey;
      }
      r.place = place;
    }
    return out;
  }

  // ---------- Export & Publish to Airtable ----------
  const publishResults = async () => {
    const ok = window.confirm(
      "Export backup and publish final results to Airtable?\n\n" +
        "This will:\n" +
        "1. Download a JSON backup of this show\n" +
        "2. Create ShowTeams as needed in Airtable\n" +
        "3. Replace any existing Scores for this show in Airtable"
    );
    if (!ok) return;

    // Step 1: Export JSON backup
    setPublishDetail("Exporting JSON backup...");
    exportJSON();

    setIsPublishing(true);
    setPublishStatus(null);
    setPublishDetail("Starting publish...");

    try {
      // exclude TB from scores
      const nonTBQuestions = questions.filter(
        (q) => !(tbQ && q.showQuestionId === (tbQ.showQuestionId || tbQ.id))
      );

      // Filter out questions without questionId (host-added or edited questions)
      // These will be skipped during publish
      const questionsWithIds = nonTBQuestions.filter((q) => q.questionId);
      const missingQids = nonTBQuestions
        .filter((q) => !q.questionId)
        .map((q) => q.showQuestionId);

      if (missingQids.length) {
        console.warn(
          `⚠️ Skipping ${missingQids.length} questions without questionId links:`,
          missingQids
        );
        setPublishDetail(
          `Note: Skipping ${missingQids.length} host-added/edited questions (no Airtable link)`
        );
        // Wait a moment so user can see the message
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Build adapted grid for utility functions
      const adaptedGridForPublish = {};
      const rawGrid = cachedByRound?.grid || {};
      for (const teamId in rawGrid) {
        adaptedGridForPublish[teamId] = {};
        for (const questionId in rawGrid[teamId]) {
          const cell = rawGrid[teamId][questionId];
          adaptedGridForPublish[teamId][questionId] = {
            isCorrect: cell.isCorrect,
            bonusCount: cell.bonusCount,
          };
        }
      }

      // Use utility to build correct count map (only for questions with IDs)
      const nCorrectByQ = buildCorrectCountMap(
        teams,
        questionsWithIds,
        adaptedGridForPublish
      );

      setPublishDetail("Preparing payload…");

      const publishRows = computePlacesForPublish(standings);
      const teamsById = new Map(teams.map((t) => [t.showTeamId, t]));
      const teamsPayload = publishRows.map((r) => {
        const t = teamsById.get(r.showTeamId);
        // Extract teamId from array if needed (Airtable link fields are arrays)
        let teamId = t?.teamId || null;
        if (Array.isArray(teamId)) {
          teamId = teamId[0] || null;
        }
        return {
          showTeamId: r.showTeamId,
          teamId: teamId,
          teamName: r.teamName,
          finalTotal: r.total,
          finalPlace: r.place,
          isLeague: !!t?.isLeague, // Include league status
        };
      });

      const scoresPayload = [];
      for (const t of teams) {
        for (const q of questionsWithIds) {
          const cell = getCell(t.showTeamId, q.showQuestionId);
          if (!cell) continue;

          // Adapt cell for utility format
          const adaptedCell = {
            isCorrect: cell.isCorrect,
            bonusCount: cell.bonusCount || 0,
          };

          // Handle per-question pub points
          let config = scoringConfig;
          if (scoringConfig.mode === "pub") {
            const perQPub = q.pubPerQuestion;
            if (perQPub !== null && perQPub !== undefined) {
              config = { ...scoringConfig, pubPoints: perQPub };
            }
          }

          const correctCount = nCorrectByQ[q.showQuestionId] || 0;
          // Get question bonus info for click-cycle bonus calculation
          const questionBonus = q.bonusAvailable
            ? { bonusValue: q.bonusValue, maxBonuses: q.maxBonuses }
            : null;
          const pointsEarned = computeCellPoints(
            adaptedCell,
            config,
            correctCount,
            questionBonus
          );

          scoresPayload.push({
            showTeamId: t.showTeamId,
            questionId: q.questionId,
            showQuestionId: q.showQuestionId,
            isCorrect: !!cell.isCorrect,
            pointsEarned: Number(pointsEarned || 0),
          });
        }
      }

      const body = {
        showId: String(selectedShowId || showBundle?.showId || "").trim(),
        teams: teamsPayload,
        scores: scoresPayload,
      };

      if (!body.showId) {
        throw new Error("Missing showId (Shows recordId).");
      }

      setPublishDetail("Sending to Airtable…");

      const res = await fetch("/.netlify/functions/writeShowResults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const json = await res.json();
      console.log("Publish OK:", json);

      // Warn about skipped invalid questions if any
      if (json.skippedInvalid > 0) {
        console.warn(
          `⚠️ Skipped ${json.skippedInvalid} questions with invalid record IDs:`,
          json.invalidIdDetails
        );
      }

      // Update question edits if any exist
      let editsUpdated = 0;
      if (questionEdits && Object.keys(questionEdits).length > 0) {
        try {
          setPublishDetail("Updating edited questions…");

          const editsPayload = Object.entries(questionEdits).map(
            ([showQuestionId, edit]) => ({
              showQuestionId,
              question: edit.question,
              notes: edit.notes,
              pronunciationGuide: edit.pronunciationGuide,
              answer: edit.answer,
            })
          );

          const editsRes = await fetch(
            "/.netlify/functions/updateShowQuestionEdits",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ edits: editsPayload }),
            }
          );

          if (editsRes.ok) {
            const editsJson = await editsRes.json();
            editsUpdated = editsJson.updatedCount || 0;
            console.log("Question edits updated:", editsJson);
          } else {
            console.error(
              "Failed to update question edits:",
              await editsRes.text()
            );
          }
        } catch (e) {
          console.error("Error updating question edits:", e);
        }
      }

      setPublishStatus("ok");
      const detailParts = [
        `Upserted ${json.teamsUpserted} ShowTeams`,
        `created ${json.scoresCreated} Scores`,
      ];
      if (editsUpdated > 0) {
        detailParts.push(`updated ${editsUpdated} question edit(s)`);
      }
      if (json.skippedInvalid > 0) {
        detailParts.push(
          `⚠️ skipped ${json.skippedInvalid} question(s) with invalid IDs`
        );
      }
      setPublishDetail(`✅ Published! ${detailParts.join(", ")}.`);
      clearBannerSoon();
    } catch (err) {
      console.error("Publish error:", err);
      setPublishStatus("error");
      setPublishDetail(err.message || "Publish failed.");
      // leave the error banner up (no auto-hide), or uncomment the next line:
      // clearBannerSoon();
    } finally {
      setIsPublishing(false);
    }
  };

  // --------- Guard rails ---------
  const noRound = false; // Always false since we're always in cumulative mode
  const noData = !teams.length && !questions.length;

  const finalStandingsRef = useRef(null);

  return (
    <div style={{ fontFamily: tokens.font.body, color: theme.dark }}>
      {/* Header */}
      <div
        style={{
          backgroundColor: theme.dark,
          padding: `${tokens.spacing.sm} 0`,
          borderTop: `${tokens.borders.medium} ${theme.accent}`,
          borderBottom: `${tokens.borders.medium} ${theme.accent}`,
          marginBottom: "0.75rem",
        }}
      >
        <h2
          style={{
            color: theme.accent,
            fontFamily: tokens.font.display,
            fontSize: "1.6rem",
            margin: 0,
            textIndent: tokens.spacing.sm,
            letterSpacing: "0.015em",
          }}
        >
          Results {usingCumulative ? "— Show Total" : ""}
        </h2>
      </div>

      {(isPublishing || publishStatus) && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            background:
              publishStatus === "ok"
                ? "rgba(28, 164, 109, 0.10)"
                : publishStatus === "error"
                  ? "rgba(220, 53, 69, 0.10)"
                  : "rgba(220,106,36,0.10)",
            color:
              publishStatus === "ok"
                ? colors.success
                : publishStatus === "error"
                  ? colors.error
                  : theme.accent,
            border: `${tokens.borders.thin} ${
              publishStatus === "ok"
                ? colors.success
                : publishStatus === "error"
                  ? colors.error
                  : theme.accent
            }`,
            borderLeft: "none",
            borderRight: "none",
            padding: ".6rem .9rem",
            marginBottom: tokens.spacing.sm,
            textAlign: "center",
            fontFamily: tokens.font.body,
          }}
        >
          {isPublishing ? "⏳ Publishing results to Airtable…" : null}
          {!isPublishing && publishStatus === "ok"
            ? `✅ ${publishDetail}`
            : null}
          {!isPublishing && publishStatus === "error"
            ? `❌ ${publishDetail}`
            : null}
        </div>
      )}

      {noRound ? (
        <div
          style={{ opacity: 0.8, fontStyle: "italic", margin: "0 12px 1rem" }}
        >
          Select a round to see results.
        </div>
      ) : null}

      {noData ? (
        <div
          style={{ opacity: 0.8, fontStyle: "italic", margin: "0 12px 1rem" }}
        >
          No teams or questions yet for this{" "}
          {usingCumulative ? "show" : "round"}.
        </div>
      ) : null}

      {/* Buttons */}
      <div
        style={{
          margin: `0 12px ${tokens.spacing.sm}`,
          display: "flex",
          alignItems: "center",
          gap: tokens.spacing.sm,
        }}
      >
        {/* Export & Publish button */}
        <button
          type="button"
          onClick={publishResults}
          disabled={isPublishing}
          style={{
            padding: `${tokens.spacing.sm} .8rem`,
            border: `${tokens.borders.thin} ${theme.accent}`,
            background: isPublishing ? "#ffe8d8" : theme.accent,
            color: isPublishing ? theme.accent : colors.white,
            borderRadius: ".35rem",
            cursor: isPublishing ? "not-allowed" : "pointer",
            fontFamily: tokens.font.body,
            opacity: isPublishing ? 0.9 : 1,
          }}
          title="Export JSON backup and publish final results to Airtable"
        >
          {isPublishing
            ? "⏳ Publishing…"
            : "💾📤 Export & Publish to Airtable"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOtfSelectedTeams(
              otfDefaultCandidates.length >= 2 ? otfDefaultCandidates : []
            );
            setOtfGuesses({});
            setOtfSource({
              mode: null,
              recordId: null,
              question: "",
              answerText: "",
              number: null,
            });
            setOtfStage("pick");
            setOtfOpen(true);
          }}
          style={{
            padding: ".45rem .7rem",
            border: `${tokens.borders.thin} ${theme.accent}`,
            background: colors.white,
            color: theme.accent,
            borderRadius: ".35rem",
            cursor: "pointer",
            fontFamily: tokens.font.body,
          }}
          title="Break ties on the fly (closest to the pin)"
        >
          On-the-fly tiebreaker
        </button>

        {showPrizeCol && (
          <span
            style={{
              fontSize: ".9rem",
              opacity: 0.9,
              padding: ".2rem .55rem",
              borderRadius: "999px",
              border: `${tokens.borders.thin} ${theme.accent}`,
              background: "rgba(220,106,36,0.06)",
              color: theme.accent,
              fontFamily: tokens.font.body,
              marginLeft: 8,
            }}
          >
            Showing prizes for {prizeCount} place{prizeCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ===== Faction Battle Results ===== */}
      {factionStats && (
        <div
          style={{
            margin: `${tokens.spacing.md} 12px`,
            background: factionStats.winner
              ? "rgba(28, 164, 109, 0.1)"
              : colors.white,
            border: `${tokens.borders.thin} ${factionStats.winner ? "rgba(28, 164, 109, 0.4)" : colors.gray.borderLight}`,
            borderRadius: tokens.radius.md,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              background: factionStats.winner
                ? "rgba(28, 164, 109, 0.2)"
                : theme.bg,
              borderBottom: `${tokens.borders.thin} ${colors.gray.borderLight}`,
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              fontWeight: 700,
              letterSpacing: ".01em",
              fontSize: "1.4rem",
              fontFamily: tokens.font.display,
            }}
          >
            🌌 Faction Battle Results
          </div>

          <div
            style={{
              padding: `${tokens.spacing.md}`,
              fontFamily: tokens.font.body,
            }}
          >
            {/* Display stats for each faction */}
            {factionStats.factions.map((faction) => {
              const stats = factionStats.stats[faction];
              const isWinner = factionStats.winner === faction;

              return (
                <div
                  key={faction}
                  style={{
                    marginBottom: tokens.spacing.sm,
                    padding: tokens.spacing.sm,
                    background: isWinner
                      ? "rgba(28, 164, 109, 0.15)"
                      : "rgba(0,0,0,0.02)",
                    borderRadius: tokens.radius.sm,
                    border: `${tokens.borders.thin} ${isWinner ? "rgba(28, 164, 109, 0.4)" : colors.gray.borderLighter}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 600,
                        color: theme.dark,
                      }}
                    >
                      {faction === "Star Trek" ? "🖖" : "⚔️"} {faction}
                      {isWinner && " 👑"}
                    </span>
                    <span
                      style={{
                        fontSize: "1.2rem",
                        fontWeight: 700,
                        color: isWinner ? colors.success : theme.accent,
                      }}
                    >
                      {stats.accuracy.toFixed(1)}% accuracy
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: colors.gray.text,
                    }}
                  >
                    {stats.teamCount} team{stats.teamCount !== 1 ? "s" : ""} •{" "}
                    {stats.correctAnswers}/{stats.totalAnswers} correct on{" "}
                    {stats.questionCount} question
                    {stats.questionCount !== 1 ? "s" : ""}
                  </div>
                </div>
              );
            })}

            {/* Winner announcement */}
            {factionStats.winner ? (
              <div
                style={{
                  marginTop: tokens.spacing.md,
                  padding: tokens.spacing.sm,
                  background: "rgba(28, 164, 109, 0.2)",
                  borderRadius: tokens.radius.sm,
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: colors.success,
                  textAlign: "center",
                }}
              >
                🎉 {factionStats.winner} wins! All {factionStats.winner} teams
                receive +{factionStats.bonusPoints} bonus points!
              </div>
            ) : (
              <div
                style={{
                  marginTop: tokens.spacing.md,
                  padding: tokens.spacing.sm,
                  background: "rgba(0,0,0,0.05)",
                  borderRadius: tokens.radius.sm,
                  fontSize: "0.95rem",
                  fontStyle: "italic",
                  color: colors.gray.text,
                  textAlign: "center",
                }}
              >
                {factionStats.factions.length > 0
                  ? "It's a tie! No faction bonus awarded."
                  : "No teams pledged to any faction."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Final standings ===== */}
      <div
        ref={finalStandingsRef}
        style={{
          margin: `${tokens.spacing.md} 12px ${tokens.spacing.xl}`,
          background: colors.white,
          border: `${tokens.borders.thin} ${colors.gray.borderLight}`,
          borderRadius: tokens.radius.md,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            background: theme.bg,
            borderBottom: `${tokens.borders.thin} ${colors.gray.borderLight}`,
            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
            fontWeight: 700,
            letterSpacing: ".01em",
            fontSize: "1.6rem",
            fontFamily: tokens.font.display,
          }}
        >
          Final standings
        </div>

        {showTbColumn ? (
          <div
            style={{
              padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
              borderBottom: `${tokens.borders.thin} ${colors.gray.borderLighter}`,
              background: tiebreakerWasUsed
                ? "rgba(220,106,36,0.15)"
                : "rgba(220,106,36,0.07)",
              fontFamily: tokens.font.body,
              fontSize: ".95rem",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                marginBottom: 4,
                display: "flex",
                alignItems: "center",
                gap: ".5rem",
              }}
            >
              🎯 {otfApplied ? "On-the-fly tiebreaker" : "Tiebreaker"}
              {tiebreakerWasUsed && (
                <span
                  style={{
                    fontSize: ".75rem",
                    fontWeight: 600,
                    padding: ".15rem .5rem",
                    borderRadius: "999px",
                    background: theme.accent,
                    color: colors.white,
                  }}
                >
                  USED
                </span>
              )}
              {!tiebreakerWasUsed && prizeCount > 0 && (
                <span
                  style={{
                    fontSize: ".75rem",
                    fontWeight: 600,
                    padding: ".15rem .5rem",
                    borderRadius: "999px",
                    background: colors.gray.border,
                    color: theme.dark,
                    opacity: 0.7,
                  }}
                >
                  NOT USED
                </span>
              )}
              {!tiebreakerWasUsed && prizeCount === 0 && (
                <span
                  style={{
                    fontSize: ".75rem",
                    fontWeight: 600,
                    padding: ".15rem .5rem",
                    borderRadius: "999px",
                    background: "#ffc107",
                    color: theme.dark,
                  }}
                >
                  ⚠️ SET PRIZES BELOW
                </span>
              )}
            </div>
            {otfApplied ? (
              <>
                {otfApplied.question ? (
                  <div style={{ marginBottom: 2 }}>{otfApplied.question}</div>
                ) : null}
                <div>
                  <strong>Correct answer:</strong> {fmtNum(otfApplied.number)}
                </div>
              </>
            ) : (
              <>
                {tbQ?.questionText ? (
                  <div style={{ marginBottom: 2 }}>{tbQ.questionText}</div>
                ) : null}
                <div>
                  <strong>Correct answer:</strong> {fmtNum(tbNumber)}
                </div>
              </>
            )}
          </div>
        ) : null}

        <div style={{ padding: tokens.spacing.md }}>
          {standings.length === 0 ? (
            <div
              style={{ opacity: 0.7, fontStyle: "italic", fontSize: "1.1rem" }}
            >
              No teams yet.
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: tokens.font.body,
                fontSize: "1.05rem",
              }}
            >
              <thead>
                <tr style={{ background: theme.dark, color: colors.white }}>
                  {showPrizeCol && (
                    <th
                      style={{
                        padding: tokens.spacing.sm,
                        fontSize: "1.1rem",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Prize
                    </th>
                  )}
                  {showTbColumn && (
                    <th
                      style={{
                        padding: tokens.spacing.sm,
                        fontSize: "1.1rem",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Tiebreaker
                    </th>
                  )}
                  {sendToDisplay && displayControlsOpen && (
                    <th
                      style={{
                        padding: tokens.spacing.sm,
                        fontSize: "1.1rem",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Display
                    </th>
                  )}
                  <th
                    style={{
                      padding: tokens.spacing.sm,
                      fontSize: "1.1rem",
                      textAlign: "center",
                    }}
                  >
                    Place
                  </th>
                  <th
                    style={{
                      padding: tokens.spacing.sm,
                      fontSize: "1.1rem",
                      textAlign: "center",
                    }}
                  >
                    Points
                  </th>
                  <th
                    style={{
                      padding: tokens.spacing.sm,
                      fontSize: "1.1rem",
                      textAlign: "left",
                    }}
                  >
                    Team
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let tieGroupIndex = 0;
                  return standings.map((r, i, arr) => {
                    const prev = arr[i - 1];
                    const sameAsPrev = !!prev && prev.total === r.total;
                    if (!sameAsPrev) tieGroupIndex++;

                    const next = arr[i + 1];
                    const sameAsNext = !!next && next.total === r.total;
                    const isEndOfTieGroup = !sameAsNext;
                    const gapToNext =
                      isEndOfTieGroup && next ? r.total - next.total : 0;

                    const bgColor =
                      tieGroupIndex % 2 === 0
                        ? colors.white
                        : "rgba(255,165,0,0.07)";
                    const prizeText =
                      showPrizeCol && r.place <= prizeCount
                        ? prizes[r.place - 1] || ""
                        : "";

                    return (
                      <tr
                        key={r.showTeamId}
                        style={{ backgroundColor: bgColor }}
                      >
                        {showPrizeCol && (
                          <td
                            style={{
                              padding: tokens.spacing.sm,
                              fontSize: "1.1rem",
                              textAlign: "center",
                            }}
                          >
                            {prizeText}
                          </td>
                        )}

                        {showTbColumn && (
                          <td
                            style={{
                              padding: tokens.spacing.sm,
                              textAlign: "center",
                              whiteSpace: "nowrap",
                              fontSize: "1.0rem",
                            }}
                          >
                            {(() => {
                              // authored TB path
                              if (
                                !otfApplied &&
                                tbDisplaySet.has(r.showTeamId) &&
                                Number.isFinite(r.tbGuess)
                              ) {
                                return (
                                  <div
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "baseline",
                                      gap: 6,
                                    }}
                                    title={`Guess: ${fmtNum(r.tbGuess)} … (${fmtNum(r.tbDelta)} away!)`}
                                  >
                                    <span aria-hidden>🎯</span>
                                    <span>{fmtNum(r.tbGuess)}</span>
                                    <span style={{ opacity: 0.8 }}>
                                      ({fmtNum(r.tbDelta)} away!)
                                    </span>
                                  </div>
                                );
                              }
                              // OTF path
                              if (
                                otfApplied &&
                                tbDisplaySet.has(r.showTeamId)
                              ) {
                                const guess = otfGuesses[r.showTeamId];
                                const delta =
                                  otfApplied.teamDelta[r.showTeamId];
                                if (
                                  guess !== undefined &&
                                  Number.isFinite(delta)
                                ) {
                                  return (
                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "baseline",
                                        gap: 6,
                                      }}
                                      title={`Guess: ${fmtNum(+guess)} … (${fmtNum(delta)} away!)`}
                                    >
                                      <span aria-hidden>🎯</span>
                                      <span>{fmtNum(+guess)}</span>
                                      <span style={{ opacity: 0.8 }}>
                                        ({fmtNum(delta)} away!)
                                      </span>
                                    </div>
                                  );
                                }
                              }
                              return (
                                <span
                                  style={{
                                    display: "inline-block",
                                    minHeight: 18,
                                  }}
                                />
                              );
                            })()}
                          </td>
                        )}

                        {/* Display push buttons column */}
                        {sendToDisplay && displayControlsOpen && (
                          <td
                            style={{
                              padding: tokens.spacing.sm,
                              textAlign: "center",
                              verticalAlign: "middle",
                            }}
                          >
                            {!sameAsPrev &&
                              (() => {
                                // First row of this tie group (by score) - show ALL buttons for entire group
                                const allTiedByScore = arr.filter(
                                  (row) => row.total === r.total
                                );
                                const isTiedByScore = allTiedByScore.length > 1;

                                // Get unique places within this tie group
                                const uniquePlaces = [
                                  ...new Set(
                                    allTiedByScore.map((t) => t.place)
                                  ),
                                ].sort((a, b) => a - b);

                                // For randomize button: get the highest place in the tie group
                                const highestPlaceInTie = Math.min(
                                  ...uniquePlaces
                                );
                                const highestPlaceStr =
                                  ordinal(highestPlaceInTie);

                                // Check if there are "unlucky" teams (tied but outside prize band)
                                const unluckyTeams = isTiedByScore
                                  ? allTiedByScore.filter(
                                      (t) => t.place > prizeCount
                                    )
                                  : [];

                                return (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "0.25rem",
                                      alignItems: "center",
                                    }}
                                  >
                                    {/* NEW: Push place + points only (no team names) */}
                                    <Button
                                      onClick={() => {
                                        const placeStr = `${ordinal(highestPlaceInTie)}`;
                                        const isTied =
                                          Array.isArray(allTiedByScore) &&
                                          allTiedByScore.length > 1;
                                        const points =
                                          allTiedByScore[0]?.total || 0;
                                        const finalPrizeText = prizeText?.trim()
                                          ? isTied
                                            ? `Vying for ${prizeText}`
                                            : prizeText
                                          : null;
                                        sendToDisplay("results", {
                                          place: placeStr,
                                          teams: null, // No team names
                                          isTied,
                                          points, // Add points to display
                                          prize: finalPrizeText,
                                        });
                                      }}
                                      style={{
                                        fontSize: ".8rem",
                                        padding: "0.25rem 0.5rem",
                                        whiteSpace: "nowrap",
                                        background: theme.dark,
                                        color: "#fff",
                                      }}
                                      title="Push place and points only (no team names)"
                                    >
                                      📺#️⃣ Place + Pts
                                    </Button>

                                    {/* Randomize ALL tied teams (if tied by score) */}
                                    {isTiedByScore && (
                                      <Button
                                        onClick={() => {
                                          const allTiedTeamNames =
                                            allTiedByScore.map(
                                              (t) => t.teamName
                                            );
                                          const shuffled = [
                                            ...allTiedTeamNames,
                                          ].sort(() => Math.random() - 0.5);
                                          const points =
                                            allTiedByScore[0]?.total || 0;

                                          sendToDisplay("results", {
                                            place: highestPlaceStr,
                                            teams: shuffled,
                                            prize:
                                              `Vying for ${prizeText}` ?? null,
                                            isTied: true,
                                            points, // Add points to display
                                          });
                                        }}
                                        style={{
                                          fontSize: "0.8rem",
                                          padding: "0.25rem 0.5rem",
                                          whiteSpace: "nowrap",
                                          background: theme.dark,
                                          color: "#fff",
                                        }}
                                        title={`Randomize ALL tied teams`}
                                      >
                                        📺🌪️ Scramble
                                      </Button>
                                    )}

                                    {/* Individual push buttons for EACH place in the tie group */}
                                    {uniquePlaces.map((place) => {
                                      const teamsAtThisPlace =
                                        allTiedByScore.filter(
                                          (t) => t.place === place
                                        );
                                      const placeStr = ordinal(place);
                                      const teamNames = teamsAtThisPlace.map(
                                        (t) => t.teamName
                                      );
                                      const prizeText =
                                        prizeCount > 0 && place <= prizeCount
                                          ? prizes[place - 1] || ""
                                          : "";
                                      const points =
                                        teamsAtThisPlace[0]?.total || 0;

                                      return (
                                        <Button
                                          key={place}
                                          onClick={() => {
                                            sendToDisplay("results", {
                                              place: placeStr,
                                              teams: teamNames,
                                              prize: prizeText,
                                              isTied: false,
                                              points, // Add points to display
                                            });
                                          }}
                                          style={{
                                            fontSize: "0.8rem",
                                            padding: "0.25rem 0.5rem",
                                            whiteSpace: "nowrap",
                                            fontWeight: 700,
                                            background: theme.accent,
                                            color: "#fff",
                                          }}
                                          title={`Push ${placeStr} place: ${teamNames.join(", ")}`}
                                        >
                                          📺🏅 {placeStr}
                                        </Button>
                                      );
                                    })}

                                    {/* Push button for "unlucky" teams (tied but no prize) */}
                                    {unluckyTeams.length > 0 && (
                                      <Button
                                        onClick={() => {
                                          const unluckyTeamNames =
                                            unluckyTeams.map((t) => t.teamName);
                                          const points =
                                            unluckyTeams[0]?.total || 0;
                                          sendToDisplay("results", {
                                            place: highestPlaceStr,
                                            teams: unluckyTeamNames,
                                            prize: null,
                                            isTied: true,
                                            points, // Add points to display
                                          });
                                        }}
                                        style={{
                                          fontSize: "0.8rem",
                                          padding: "0.25rem 0.5rem",
                                          whiteSpace: "nowrap",
                                          background: theme.dark,
                                          color: "#fff",
                                        }}
                                        title={`Push unlucky tied teams (no prizes)`}
                                      >
                                        📺💔 Non-winners
                                      </Button>
                                    )}
                                  </div>
                                );
                              })()}
                          </td>
                        )}

                        <td
                          style={{
                            padding: tokens.spacing.sm,
                            textAlign: "center",
                            fontSize: "1.5rem",
                            fontWeight: 800,
                            color: theme.accent,
                            fontFamily: tokens.font.display,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {ordinal(r.place)}
                        </td>

                        <td
                          style={{
                            padding: tokens.spacing.sm,
                            textAlign: "center",
                            fontSize: "1.35rem",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fmtNum(r.total)}
                          {gapToNext > 0 && (
                            <span
                              style={{
                                marginLeft: tokens.spacing.sm,
                                fontSize: "0.95rem",
                                color: theme.accent,
                                fontWeight: 700,
                              }}
                            >
                              +{fmtNum(gapToNext)}
                            </span>
                          )}
                        </td>

                        <td
                          style={{
                            padding: tokens.spacing.sm,
                            textAlign: "left",
                            fontSize: "1.35rem",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.teamName}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {otfOpen && (
        <div
          onMouseDown={() => setOtfOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: colors.overlay,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: tokens.spacing.md,
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "min(92vw, 660px)",
              background: colors.white,
              borderRadius: ".6rem",
              border: `${tokens.borders.thin} ${theme.accent}`,
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,.25)",
              fontFamily: tokens.font.body,
            }}
          >
            {/* Header */}
            <div
              style={{
                background: theme.dark,
                color: colors.white,
                padding: ".6rem .8rem",
                borderBottom: `${tokens.borders.medium} ${theme.accent}`,
              }}
            >
              <div
                style={{
                  fontFamily: tokens.font.display,
                  fontSize: "1.25rem",
                  letterSpacing: ".01em",
                }}
              >
                On-the-fly tiebreaker
              </div>
              <div
                style={{ fontSize: ".9rem", opacity: 0.9, marginTop: ".15rem" }}
              >
                Closest-to-the-pin; affects only the teams you choose.
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: ".9rem .9rem 0" }}>
              {(() => {
                // 🔍 DEBUG: detect duplicate keys
                const ids = standings.map((x) => String(x.showTeamId));
                const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
                if (dups.length) {
                  console.warn(
                    "❌ Duplicate showTeamId keys in standings:",
                    dups
                  );
                  console.warn("Full standings:", standings);
                }
                return null;
              })()}
              {otfStage === "pick" && (
                <>
                  <div style={{ marginBottom: ".6rem", fontWeight: 700 }}>
                    Select teams to include
                  </div>
                  <div
                    style={{
                      maxHeight: 260,
                      overflow: "auto",
                      border: `${tokens.borders.thin} ${colors.gray.borderLighter}`,
                      borderRadius: ".35rem",
                    }}
                  >
                    {standings.map((r) => (
                      <label
                        key={r.showTeamId}
                        style={{
                          display: "flex",
                          gap: tokens.spacing.sm,
                          alignItems: "center",
                          padding: ".4rem .6rem",
                          borderBottom: `${tokens.borders.thin} #f2f2f2`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={otfSelectedTeams.includes(r.showTeamId)}
                          onChange={(e) => {
                            setOtfSelectedTeams((prev) => {
                              if (e.target.checked)
                                return Array.from(
                                  new Set([...prev, r.showTeamId])
                                );
                              return prev.filter((id) => id !== r.showTeamId);
                            });
                          }}
                        />
                        <div
                          style={{
                            width: 64,
                            textAlign: "right",
                            color: theme.accent,
                            fontWeight: 700,
                          }}
                        >
                          {ordinal(r.place)}
                        </div>
                        <div
                          style={{
                            width: 88,
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtNum(r.total)}
                        </div>
                        <div style={{ flex: 1 }}>{r.teamName}</div>
                      </label>
                    ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: tokens.spacing.sm,
                      padding: ".8rem 0",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (otfSelectedTeams.length < 2) return;
                        setOtfStage("source");
                      }}
                      style={{
                        padding: ".45rem .8rem",
                        border: `${tokens.borders.thin} ${theme.accent}`,
                        background: theme.accent,
                        color: colors.white,
                        borderRadius: ".35rem",
                        cursor:
                          otfSelectedTeams.length < 2
                            ? "not-allowed"
                            : "pointer",
                        opacity: otfSelectedTeams.length < 2 ? 0.6 : 1,
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}

              {otfStage === "source" && (
                <>
                  <div style={{ marginBottom: ".6rem", fontWeight: 700 }}>
                    Pick the tiebreaker source
                  </div>

                  <div style={{ display: "grid", gap: tokens.spacing.sm }}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            "/.netlify/functions/getNextTiebreaker"
                          );
                          const json = await res.json();
                          if (!json || !json.id) {
                            // fallback to custom
                            setOtfSource({
                              mode: "custom",
                              recordId: null,
                              question: "",
                              answerText: "",
                              number: null,
                            });
                            setOtfStage("guesses");
                            return;
                          }
                          const q = json.fields?.["Tiebreaker question"] || "";
                          const aText =
                            json.fields?.["Tiebreaker answer"] || "";
                          const nRaw = json.fields?.["Tiebreaker number"];
                          const n =
                            nRaw === undefined || nRaw === null
                              ? null
                              : Number(nRaw);
                          setOtfSource({
                            mode: "airtable",
                            recordId: json.id,
                            question: String(q || ""),
                            answerText: String(aText || ""),
                            number: Number.isFinite(n) ? n : null,
                          });
                          // mark used now
                          await fetch(
                            "/.netlify/functions/markTiebreakerUsed",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ recordId: json.id }),
                            }
                          );
                          setOtfStage("guesses");
                        } catch {
                          // fallback to custom
                          setOtfSource({
                            mode: "custom",
                            recordId: null,
                            question: "",
                            answerText: "",
                            number: null,
                          });
                          setOtfStage("guesses");
                        }
                      }}
                      style={{
                        padding: ".45rem .7rem",
                        border: `${tokens.borders.thin} ${colors.gray.border}`,
                        background: colors.gray.bg,
                        borderRadius: ".35rem",
                        cursor: "pointer",
                      }}
                    >
                      Use next unused from Airtable
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOtfSource({
                          mode: "custom",
                          recordId: null,
                          question: "",
                          answerText: "",
                          number: null,
                        });
                        setOtfStage("guesses");
                      }}
                      style={{
                        padding: ".45rem .7rem",
                        border: `${tokens.borders.thin} ${colors.gray.border}`,
                        background: colors.gray.bg,
                        borderRadius: ".35rem",
                        cursor: "pointer",
                      }}
                    >
                      Enter a custom numeric answer
                    </button>
                  </div>
                </>
              )}

              {otfStage === "guesses" && (
                <>
                  <div style={{ marginBottom: ".6rem", fontWeight: 700 }}>
                    Enter guesses
                  </div>

                  {otfSource.mode === "airtable" &&
                    (otfSource.question || otfSource.answerText) && (
                      <div
                        style={{
                          marginBottom: tokens.spacing.sm,
                          padding: tokens.spacing.sm,
                          border: `${tokens.borders.thin} ${colors.gray.borderLighter}`,
                          borderRadius: ".35rem",
                          background: colors.gray.bgLightest,
                        }}
                      >
                        {otfSource.question ? (
                          <div style={{ marginBottom: 4 }}>
                            <strong>Question:</strong> {otfSource.question}
                          </div>
                        ) : null}
                        {otfSource.answerText ? (
                          <div style={{ marginBottom: 4 }}>
                            <strong>Answer:</strong> {otfSource.answerText}
                          </div>
                        ) : null}
                        <div>
                          <strong>Number:</strong>{" "}
                          {otfSource.number !== null
                            ? fmtFloat(otfSource.number)
                            : "(host will enter custom number)"}
                        </div>
                      </div>
                    )}

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: tokens.spacing.sm,
                      marginBottom: ".75rem",
                    }}
                  >
                    <span style={{ minWidth: 160 }}>Correct number:</span>
                    <input
                      type="number"
                      step="any"
                      value={otfSource.number ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOtfSource((src) => ({
                          ...src,
                          number: v === "" ? null : Number(v),
                        }));
                      }}
                      placeholder="e.g., 123.45"
                      style={{
                        width: 160,
                        padding: ".45rem .55rem",
                        border: `${tokens.borders.thin} ${colors.gray.border}`,
                        borderRadius: ".35rem",
                      }}
                    />
                  </label>

                  <div
                    style={{
                      maxHeight: 260,
                      overflow: "auto",
                      border: `${tokens.borders.thin} ${colors.gray.borderLighter}`,
                      borderRadius: ".35rem",
                    }}
                  >
                    {otfSelectedTeams.map((id) => {
                      const team = standings.find((r) => r.showTeamId === id);
                      if (!team) return null;
                      return (
                        <label
                          key={id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 180px",
                            alignItems: "center",
                            gap: tokens.spacing.sm,
                            padding: ".4rem .6rem",
                            borderBottom: `${tokens.borders.thin} #f2f2f2`,
                          }}
                        >
                          <div>{team.teamName}</div>
                          <input
                            type="number"
                            step="any"
                            value={otfGuesses[id] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setOtfGuesses((prev) => ({ ...prev, [id]: v }));
                            }}
                            placeholder="Guess"
                            style={{
                              padding: ".35rem .5rem",
                              border: `${tokens.borders.thin} ${colors.gray.border}`,
                              borderRadius: ".35rem",
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: tokens.spacing.sm,
                      padding: ".8rem 0",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!Number.isFinite(otfSource.number)) return;
                        // compute deltas
                        const teamDelta = {};
                        for (const id of otfSelectedTeams) {
                          const g = otfGuesses[id];
                          const num = g === "" || g == null ? NaN : Number(g);
                          teamDelta[id] = Number.isFinite(num)
                            ? Math.abs(num - otfSource.number)
                            : Infinity;
                        }
                        setOtfApplied({
                          question: otfSource.question || "",
                          answerText: otfSource.answerText || "",
                          number: otfSource.number,
                          selected: otfSelectedTeams.slice(),
                          teamDelta,
                        });
                        setOtfStage("review");
                      }}
                      style={{
                        padding: ".45rem .8rem",
                        border: `${tokens.borders.thin} ${theme.accent}`,
                        background: theme.accent,
                        color: colors.white,
                        borderRadius: ".35rem",
                        cursor: Number.isFinite(otfSource.number)
                          ? "pointer"
                          : "not-allowed",
                        opacity: Number.isFinite(otfSource.number) ? 1 : 0.6,
                      }}
                    >
                      Preview results
                    </button>
                  </div>
                </>
              )}

              {otfStage === "review" && otfApplied && (
                <>
                  <div style={{ marginBottom: ".6rem", fontWeight: 700 }}>
                    Preview: closest to the pin
                  </div>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      marginBottom: ".75rem",
                    }}
                  >
                    <thead>
                      <tr style={{ background: theme.bg }}>
                        <th
                          style={{ textAlign: "left", padding: ".35rem .5rem" }}
                        >
                          Team
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: ".35rem .5rem",
                          }}
                        >
                          Guess
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: ".35rem .5rem",
                          }}
                        >
                          Distance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...otfApplied.selected]
                        .sort((a, b) => {
                          const da = otfApplied.teamDelta[a] ?? Infinity;
                          const db = otfApplied.teamDelta[b] ?? Infinity;
                          if (da !== db) return da - db;
                          const A =
                            standings.find((r) => r.showTeamId === a)
                              ?.teamName || "";
                          const B =
                            standings.find((r) => r.showTeamId === b)
                              ?.teamName || "";
                          return A.localeCompare(B, "en", {
                            sensitivity: "base",
                          });
                        })
                        .map((id) => {
                          const name =
                            standings.find((r) => r.showTeamId === id)
                              ?.teamName || id;
                          const g = otfGuesses[id];
                          const d = otfApplied.teamDelta[id];
                          return (
                            <tr key={id}>
                              <td style={{ padding: ".35rem .5rem" }}>
                                {name}
                              </td>
                              <td
                                style={{
                                  padding: ".35rem .5rem",
                                  textAlign: "right",
                                }}
                              >
                                {g === "" || g == null ? "—" : fmtFloat(+g)}
                              </td>
                              <td
                                style={{
                                  padding: ".35rem .5rem",
                                  textAlign: "right",
                                }}
                              >
                                {Number.isFinite(d) ? fmtFloat(d) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: tokens.spacing.sm,
                      paddingBottom: ".9rem",
                    }}
                  >
                    <div style={{ opacity: 0.85 }}>
                      Correct number:&nbsp;
                      <strong>{fmtFloat(otfApplied.number)}</strong>
                    </div>
                    <div style={{ display: "flex", gap: tokens.spacing.sm }}>
                      <button
                        type="button"
                        onClick={() => setOtfStage("guesses")}
                        style={{
                          padding: ".45rem .7rem",
                          border: `${tokens.borders.thin} ${colors.gray.border}`,
                          background: colors.gray.bg,
                          borderRadius: ".35rem",
                          cursor: "pointer",
                        }}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setOtfOpen(false)}
                        style={{
                          padding: ".45rem .8rem",
                          border: `${tokens.borders.thin} ${theme.accent}`,
                          background: theme.accent,
                          color: colors.white,
                          borderRadius: ".35rem",
                          cursor: "pointer",
                        }}
                      >
                        Apply to standings
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
