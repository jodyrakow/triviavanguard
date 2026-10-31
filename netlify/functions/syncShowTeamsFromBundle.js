// Import ShowTeams newly found in the refreshed Airtable show bundle.
// Existing Supabase rows (including live edits and soft deletions) are never overwritten.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { showId, teams } = JSON.parse(event.body || "{}");
    if (typeof showId !== "string" || !showId || !Array.isArray(teams)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing showId or teams" }) };
    }

    const { data: existing, error: loadError } = await supabase
      .from("show_teams")
      .select("show_team_id, entry_order")
      .eq("show_id", showId);
    if (loadError) throw loadError;

    const existingIds = new Set((existing || []).map((t) => t.show_team_id));
    const seen = new Set();
    let nextOrder = Math.max(-1, ...(existing || []).map((t) =>
      Number.isFinite(t.entry_order) ? t.entry_order : -1
    )) + 1;

    const missing = teams.filter((team) => {
      if (!team || typeof team.showTeamId !== "string" ||
          !/^rec[A-Za-z0-9]+$/.test(team.showTeamId) ||
          existingIds.has(team.showTeamId) || seen.has(team.showTeamId)) return false;
      seen.add(team.showTeamId);
      return true;
    });

    if (missing.length) {
      const rows = missing.map((team) => ({
        show_id: showId,
        show_team_id: team.showTeamId,
        team_id: team.teamId || null,
        team_name: team.teamName || "(Unnamed team)",
        show_bonus: Number(team.showBonus) || 0,
        is_league: !!team.isLeague,
        entry_order: nextOrder++,
        is_removed: false,
      }));

      // ON CONFLICT DO NOTHING: protects existing team data even during concurrent refreshes.
      const { error: insertError } = await supabase
        .from("show_teams")
        .upsert(rows, { onConflict: "show_id,show_team_id", ignoreDuplicates: true });
      if (insertError) throw insertError;
    }

    // Return the actual roster, including concurrent inserts, for immediate UI reconciliation.
    const { data: roster, error: rosterError } = await supabase
      .from("show_teams")
      .select("show_team_id, team_id, team_name, show_bonus, is_league, entry_order, is_removed")
      .eq("show_id", showId);
    if (rosterError) throw rosterError;

    // Only active Supabase teams absent from the authoritative Airtable bundle
    // require a host decision. Already-removed teams are never prompted.
    const airtableIds = new Set(teams.map(t => t?.showTeamId).filter(Boolean));
    const missingFromAirtable = (roster || [])
      .filter(t => !t.is_removed && !airtableIds.has(t.show_team_id))
      .map(t => ({ showTeamId: t.show_team_id, teamName: t.team_name }));

    const activeTeams = (roster || []).filter((t) => !t.is_removed).map((t) => ({
      showTeamId: t.show_team_id,
      teamId: t.team_id,
      teamName: t.team_name,
      showBonus: t.show_bonus ?? 0,
      isLeague: !!t.is_league,
      entryOrder: t.entry_order,
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        added: missing.filter((t) => (roster || []).some((r) => r.show_team_id === t.showTeamId && !r.is_removed)).length,
        teams: activeTeams,
        missingFromAirtable,
      }),
    };
  } catch (err) {
    console.error("syncShowTeamsFromBundle failed:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Team sync failed" }) };
  }
};
