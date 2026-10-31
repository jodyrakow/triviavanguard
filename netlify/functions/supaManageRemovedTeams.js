// List and restore soft-deleted show teams without touching scoring cells.
import { createClient } from "@supabase/supabase-js";
import Airtable from "airtable";

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base("appnwzfwa2Bl6V2jX");

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
      const { data: active, error: activeError } = await admin.from("show_teams")
        .select("team_id").eq("show_id", showId).eq("is_removed", false);
      if (activeError) throw activeError;
      const activeTeamIds = new Set((active || []).map(t => t.team_id).filter(Boolean));
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teams: (data || []).filter(t => !activeTeamIds.has(t.team_id)).map(t => ({
        showTeamId: t.show_team_id, teamName: t.team_name, teamId: t.team_id,
        showBonus: t.show_bonus, isLeague: t.is_league, entryOrder: t.entry_order,
      })) }) };
    }
    if (event.httpMethod === "POST") {
      // Read the saved team first. Do not create a new Airtable Team.
      const { data: original, error: originalError } = await admin.from("show_teams")
        .select("*").eq("show_id", showId).eq("show_team_id", showTeamId).single();
      if (originalError) throw originalError;
      if (!original.is_removed) {
        return { statusCode: 409, body: JSON.stringify({ error: "Team is not removed" }) };
      }
      if (!/^rec[A-Za-z0-9]{14}$/.test(original.team_id || "") ||
          !/^rec[A-Za-z0-9]{14}$/.test(showId)) {
        return { statusCode: 409, body: JSON.stringify({ error: "Cannot restore in Airtable without valid original Show and Team IDs." }) };
      }
      // Fail closed if the underlying Team has been deleted.
      await airtable("Teams").find(original.team_id);
      // Airtable formula uses linked record IDs from lookup fields.
      const rows = await airtable("ShowTeams").select({
        filterByFormula: `FIND("${showId}", ARRAYJOIN({Show ID}))`,
        pageSize: 100,
      }).all();
      let airtableRecord = rows.find(r => {
        const id = r.fields["Team ID"];
        return (Array.isArray(id) ? id : [id]).includes(original.team_id);
      });
      if (!airtableRecord) {
        airtableRecord = await airtable("ShowTeams").create({
          Show: [showId], Team: [original.team_id],
        });
      }
      const restoredId = airtableRecord.id;
      if (restoredId === showTeamId) {
        const { error } = await admin.from("show_teams").update({ is_removed: false })
          .eq("show_id", showId).eq("show_team_id", showTeamId);
        if (error) throw error;
      } else {
        // New Airtable ShowTeam ID: copy the existing score cells first.
        // Never delete the old scoring rows; they remain available for recovery.
        const { data: cells, error: cellsError } = await admin.from("scoring_cells")
          .select("show_question_id,is_correct,tiebreaker_guess,tiebreaker_guess_raw,bonus_count,partial_count")
          .eq("show_id", showId).eq("show_team_id", showTeamId);
        if (cellsError) throw cellsError;
        const { data: target, error: targetError } = await admin.from("show_teams")
          .select("show_team_id,is_removed").eq("show_id", showId)
          .eq("show_team_id", restoredId).maybeSingle();
        if (targetError) throw targetError;
        if (target && !target.is_removed) {
          return { statusCode: 409, body: JSON.stringify({ error: "Replacement ShowTeam is already active; no scoring data was overwritten." }) };
        }
        if (!target) {
          const { error: insertError } = await admin.from("show_teams").insert({
            show_id: showId, show_team_id: restoredId, team_id: original.team_id,
            team_name: original.team_name, show_bonus: original.show_bonus,
            is_league: original.is_league, entry_order: original.entry_order,
            is_removed: true,
          });
          if (insertError) throw insertError;
        }
        if (cells?.length) {
          const { error: copyError } = await admin.from("scoring_cells").upsert(
            cells.map(cell => ({
              ...cell, show_id: showId, show_team_id: restoredId,
            })), { onConflict: "show_id,show_team_id,show_question_id", ignoreDuplicates: true }
          );
          if (copyError) throw copyError;
        }
        const { error: activateError } = await admin.from("show_teams")
          .update({ is_removed: false }).eq("show_id", showId).eq("show_team_id", restoredId);
        if (activateError) throw activateError;
      }
      return { statusCode: 200, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, showTeamId: restoredId }) };
    }
    return { statusCode: 405, body: "Method not allowed" };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
