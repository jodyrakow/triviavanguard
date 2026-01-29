// /.netlify/functions/supaRebuildFromEvents.js
// Emergency recovery: rebuild live_scoring payload from scoring_events log
import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supaAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function normalizeTs(ts) {
  const n = Number(ts);
  return Number.isFinite(n) ? n : 0;
}

function ensureBasePayload() {
  return {
    teams: [],
    entryOrder: [],
    grid: {},
    tiebreakers: {},
    prizes: "",
    hostInfo: {},
    scoringMode: "pub",
    pubPoints: 10,
    poolPerQuestion: 500,
    poolContribution: 10,
    factionBonus: 10,
    _meta: {},
  };
}

function metaKeyForEvent(evt) {
  const type = evt?.type;
  if (!type) return null;

  if (type === "mark")
    return `cell:${evt.teamId || ""}:${evt.showQuestionId || ""}`;
  if (type === "cellEdit")
    return `cellEdit:${evt.teamId || ""}:${evt.showQuestionId || ""}`;
  if (type === "teamAdd" || type === "teamRemove")
    return `team:${evt.teamId || ""}`;
  if (type === "teamRename") return `teamName:${evt.teamId || ""}`;
  if (type === "leagueToggle") return `teamLeague:${evt.teamId || ""}`;
  if (type === "factionPledge") return `teamFaction:${evt.teamId || ""}`;
  if (type === "teamBonus") return `teamBonus:${evt.teamId || ""}`;
  if (type === "tbEdit")
    return `tb:${evt.teamId || ""}:${evt.showQuestionId || ""}`;
  if (type === "prizesUpdate") return `prizes:${evt.showId || ""}`;
  if (type === "hostInfoUpdate") return `hostInfo:${evt.showId || ""}`;
  if (type === "scoringSettingsUpdate")
    return `scoringSettings:${evt.showId || ""}`;
  if (type === "tiebreakerAdded") return `tbq:${evt.roundId || ""}`;

  return `evt:${type}`;
}

function isNewer(payload, key, ts) {
  const prev = Number(payload._meta?.[key] || 0);
  return Number(ts || 0) >= prev;
}

function stamp(payload, key, ts) {
  payload._meta[key] = Number(ts || 0);
}

function findTeamIndex(payload, teamId) {
  return payload.teams.findIndex((t) => t?.showTeamId === teamId);
}

function ensureTeam(payload, teamId, fallbackName) {
  let idx = findTeamIndex(payload, teamId);
  if (idx === -1) {
    payload.teams.push({
      showTeamId: teamId,
      teamName: fallbackName || "Team",
      isLeague: false,
      factionPledge: null,
      showBonus: 0,
    });
    idx = payload.teams.length - 1;
  }
  return idx;
}

function applyEvent(payload, evt) {
  const type = evt?.type;
  const ts = normalizeTs(evt?.ts);

  if (!type || !ts) return { applied: false, reason: "missing type/ts" };

  const key = metaKeyForEvent(evt);
  if (!key) return { applied: false, reason: "no key" };

  if (!isNewer(payload, key, ts)) return { applied: false, reason: "stale" };

  switch (type) {
    case "teamAdd": {
      const { teamId, teamName } = evt;
      if (!teamId) return { applied: false, reason: "missing teamId" };
      stamp(payload, key, ts);
      ensureTeam(payload, teamId, teamName);
      if (!payload.entryOrder.includes(teamId)) {
        payload.entryOrder.push(teamId);
      }
      return { applied: true };
    }

    case "teamRemove": {
      const { teamId } = evt;
      if (!teamId) return { applied: false, reason: "missing teamId" };
      stamp(payload, key, ts);
      payload.teams = payload.teams.filter((t) => t?.showTeamId !== teamId);
      payload.entryOrder = payload.entryOrder.filter((id) => id !== teamId);
      if (payload.grid?.[teamId]) delete payload.grid[teamId];
      return { applied: true };
    }

    case "teamRename": {
      const { teamId, teamName } = evt;
      if (!teamId) return { applied: false, reason: "missing teamId" };
      stamp(payload, key, ts);
      const idx = ensureTeam(payload, teamId, teamName);
      if (typeof teamName === "string") payload.teams[idx].teamName = teamName;
      return { applied: true };
    }

    case "leagueToggle": {
      const { teamId, isLeague } = evt;
      if (!teamId) return { applied: false, reason: "missing teamId" };
      stamp(payload, key, ts);
      const idx = ensureTeam(payload, teamId);
      payload.teams[idx].isLeague = !!isLeague;
      return { applied: true };
    }

    case "factionPledge": {
      const { teamId, factionPledge } = evt;
      if (!teamId) return { applied: false, reason: "missing teamId" };
      stamp(payload, key, ts);
      const idx = ensureTeam(payload, teamId);
      payload.teams[idx].factionPledge = factionPledge ?? null;
      return { applied: true };
    }

    case "teamBonus": {
      const { teamId, showBonus } = evt;
      if (!teamId) return { applied: false, reason: "missing teamId" };
      stamp(payload, key, ts);
      const idx = ensureTeam(payload, teamId);
      payload.teams[idx].showBonus = showBonus;
      return { applied: true };
    }

    case "mark": {
      const { teamId, showQuestionId, nowCorrect, bonusCount } = evt;
      if (!teamId || !showQuestionId) {
        return { applied: false, reason: "missing teamId/showQuestionId" };
      }
      stamp(payload, key, ts);
      payload.grid[teamId] ||= {};
      const prev = payload.grid[teamId][showQuestionId] || {};
      payload.grid[teamId][showQuestionId] = {
        ...prev,
        isCorrect: !!nowCorrect,
        bonusCount: Number.isFinite(Number(bonusCount))
          ? Number(bonusCount)
          : prev.bonusCount || 0,
      };
      return { applied: true };
    }

    case "cellEdit": {
      const { teamId, showQuestionId, bonusCount } = evt;
      if (!teamId || !showQuestionId) {
        return { applied: false, reason: "missing teamId/showQuestionId" };
      }
      stamp(payload, key, ts);
      payload.grid[teamId] ||= {};
      const prev = payload.grid[teamId][showQuestionId] || {};
      payload.grid[teamId][showQuestionId] = {
        ...prev,
        bonusCount: Number.isFinite(Number(bonusCount))
          ? Number(bonusCount)
          : prev.bonusCount || 0,
      };
      return { applied: true };
    }

    case "tbEdit": {
      const { teamId, showQuestionId, tiebreakerGuessRaw, tiebreakerGuess } =
        evt;
      if (!teamId || !showQuestionId) {
        return { applied: false, reason: "missing teamId/showQuestionId" };
      }
      stamp(payload, key, ts);
      payload.grid[teamId] ||= {};
      const prev = payload.grid[teamId][showQuestionId] || {};
      payload.grid[teamId][showQuestionId] = {
        ...prev,
        tiebreakerGuessRaw: tiebreakerGuessRaw ?? "",
        tiebreakerGuess:
          tiebreakerGuess === null || tiebreakerGuess === undefined
            ? null
            : Number(tiebreakerGuess),
      };
      return { applied: true };
    }

    case "prizesUpdate": {
      const { prizes } = evt;
      stamp(payload, key, ts);
      payload.prizes = typeof prizes === "string" ? prizes : "";
      return { applied: true };
    }

    case "hostInfoUpdate": {
      const { hostInfo } = evt;
      stamp(payload, key, ts);
      payload.hostInfo =
        hostInfo && typeof hostInfo === "object" ? hostInfo : {};
      return { applied: true };
    }

    case "scoringSettingsUpdate": {
      const {
        scoringMode,
        pubPoints,
        poolPerQuestion,
        poolContribution,
        factionBonus,
      } = evt;
      stamp(payload, key, ts);
      if (scoringMode !== undefined) payload.scoringMode = scoringMode;
      if (pubPoints !== undefined)
        payload.pubPoints = Number.isFinite(Number(pubPoints))
          ? Number(pubPoints)
          : payload.pubPoints;
      if (poolPerQuestion !== undefined)
        payload.poolPerQuestion = Number.isFinite(Number(poolPerQuestion))
          ? Number(poolPerQuestion)
          : payload.poolPerQuestion;
      if (poolContribution !== undefined)
        payload.poolContribution = Number.isFinite(Number(poolContribution))
          ? Number(poolContribution)
          : payload.poolContribution;
      if (factionBonus !== undefined)
        payload.factionBonus = Number.isFinite(Number(factionBonus))
          ? Number(factionBonus)
          : payload.factionBonus;
      return { applied: true };
    }

    case "tiebreakerAdded": {
      const { roundId, tiebreakerQuestion } = evt;
      if (!roundId || !tiebreakerQuestion) {
        return { applied: false, reason: "missing roundId/tiebreakerQuestion" };
      }
      stamp(payload, key, ts);
      payload.tiebreakers[roundId] = tiebreakerQuestion;
      return { applied: true };
    }

    default:
      return { applied: false, reason: "unknown type" };
  }
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ error: "POST required" }),
    };
  }

  try {
    const { showId, roundId, dryRun } = JSON.parse(event.body || "{}");
    const rid = roundId || "all";

    if (!showId) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "Missing showId" }),
      };
    }

    // Fetch all events for this show, ordered by client_ts then id
    const { data: events, error: e1 } = await supaAdmin
      .from("scoring_events")
      .select("*")
      .eq("show_id", showId)
      .eq("round_id", rid)
      .order("client_ts", { ascending: true })
      .order("id", { ascending: true });

    if (e1) throw e1;

    if (!events || events.length === 0) {
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({
          error: "No events found for this show",
          showId,
          roundId: rid,
        }),
      };
    }

    // Start with a fresh payload and replay all events
    const payload = ensureBasePayload();
    let applied = 0;
    let skipped = 0;

    for (const row of events) {
      const evt = row.payload;
      if (!evt) {
        skipped++;
        continue;
      }

      const r = applyEvent(payload, evt);
      if (r.applied) {
        applied++;
      } else {
        skipped++;
      }
    }

    const updatedAt = new Date().toISOString();

    // If dryRun, don't actually save
    if (dryRun) {
      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          dryRun: true,
          eventsFound: events.length,
          applied,
          skipped,
          payload, // Return the rebuilt payload for inspection
        }),
      };
    }

    // Save the rebuilt payload to live_scoring
    const { error: e2 } = await supaAdmin.from("live_scoring").upsert(
      {
        show_id: showId,
        round_id: rid,
        payload,
        updated_at: updatedAt,
      },
      { onConflict: "show_id,round_id" },
    );
    if (e2) throw e2;

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        rebuilt: true,
        eventsFound: events.length,
        applied,
        skipped,
        updatedAt,
      }),
    };
  } catch (err) {
    console.error("supaRebuildFromEvents failed:", err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
