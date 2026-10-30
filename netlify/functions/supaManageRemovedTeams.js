// List and restore soft-deleted show teams without touching scoring cells.
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export const handler = async (event) => {
  try {
    const body = event.httpMethod === "POST" ? JSON.parse(event.body || "{}") : (event.queryStringParameters || {});
    const { showId, showTeamId } = body;
    if (!showId || (event.httpMethod === "POST" && !showTeamId)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing showId or showTeamId" }) };
    }
    if (event.httpMethod === "GET") {
      const { data, error } = await admin.from("show_teams")
        .select("show_team_id, team_name, team_id, show_bonus, is_league, entry_order")
        .eq("show_id", showId).eq("is_removed", true)
        .order("entry_order", { ascending: true });
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teams: (data || []).map(t => ({
        showTeamId: t.show_team_id, teamName: t.team_name, teamId: t.team_id,
        showBonus: t.show_bonus, isLeague: t.is_league, entryOrder: t.entry_order,
      })) }) };
    }
    if (event.httpMethod === "POST") {
      const { data, error } = await admin.from("show_teams")
        .update({ is_removed: false })
        .eq("show_id", showId).eq("show_team_id", showTeamId).eq("is_removed", true)
        .select("show_team_id").maybeSingle();
      if (error) throw error;
      if (!data) return { statusCode: 404, body: JSON.stringify({ error: "Removed team not found" }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    return { statusCode: 405, body: "Method not allowed" };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
