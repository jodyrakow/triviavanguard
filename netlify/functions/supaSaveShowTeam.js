// netlify/functions/supaSaveShowTeam.js
// Saves/updates a ShowTeam in Supabase (upsert)
// Used for: adding teams, renaming teams, changing show bonus

import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supaAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "Method not allowed",
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { showId, showTeam, updatedBy } = body;

    if (!showId || !showTeam?.showTeamId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing showId or showTeam.showTeamId" }),
      };
    }

    // Build the row to upsert
    // showTeamId is the unique identifier (either Airtable record ID or locally generated)
    const row = {
      show_id: showId,
      show_team_id: showTeam.showTeamId,
      team_id: showTeam.teamId || null, // Airtable Team record ID (may be null for new teams)
      team_name: showTeam.teamName || "(Unnamed)",
      show_bonus: typeof showTeam.showBonus === "number" ? showTeam.showBonus : 0,
      is_league: !!showTeam.isLeague,
      entry_order: typeof showTeam.entryOrder === "number" ? showTeam.entryOrder : null,
      updated_by: updatedBy || null,
    };

    const { data, error } = await supaAdmin
      .from("show_teams")
      .upsert(row, { onConflict: "show_id,show_team_id" })
      .select()
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: true,
        showTeam: data,
      }),
    };
  } catch (err) {
    console.error("supaSaveShowTeam failed:", err);
    const errorMsg = err?.message || err?.details || JSON.stringify(err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: errorMsg }),
    };
  }
};
