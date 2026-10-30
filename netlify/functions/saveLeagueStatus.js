// Keep the League flag synchronized between Airtable and Supabase.
import Airtable from "airtable";
import { createClient } from "@supabase/supabase-js";

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base("appnwzfwa2Bl6V2jX");
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    const { showId, showTeamId, isLeague } = JSON.parse(event.body || "{}");
    if (!/^rec[A-Za-z0-9]{14}$/.test(showId || "") ||
        !/^rec[A-Za-z0-9]{14}$/.test(showTeamId || "") ||
        typeof isLeague !== "boolean") {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid Show, ShowTeam, or League value" }) };
    }
    const { data: team, error: readError } = await supabase.from("show_teams")
      .select("show_team_id,is_league,is_removed").eq("show_id", showId)
      .eq("show_team_id", showTeamId).maybeSingle();
    if (readError) throw readError;
    if (!team || team.is_removed) return { statusCode: 404, body: JSON.stringify({ error: "Active ShowTeam not found" }) };

    // Confirm this Airtable ShowTeam belongs to the requested show.
    const record = await airtable("ShowTeams").find(showTeamId);
    const linkedShows = record.fields["Show"] || [];
    if (!Array.isArray(linkedShows) || !linkedShows.includes(showId)) {
      return { statusCode: 409, body: JSON.stringify({ error: "ShowTeam does not belong to this show in Airtable" }) };
    }
    await airtable("ShowTeams").update(showTeamId, { League: isLeague });
    const { error: updateError } = await supabase.from("show_teams")
      .update({ is_league: isLeague }).eq("show_id", showId).eq("show_team_id", showTeamId);
    if (updateError) {
      // Best effort rollback; surface failure instead of claiming successful sync.
      try { await airtable("ShowTeams").update(showTeamId, { League: !!record.fields["League"] }); }
      catch (rollbackError) { console.error("League Airtable rollback failed:", rollbackError); }
      throw updateError;
    }
    return { statusCode: 200, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, isLeague }) };
  } catch (error) {
    console.error("saveLeagueStatus error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
