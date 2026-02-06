// netlify/functions/supaLoadShowTeams.js
// Loads all ShowTeams for a given show from Supabase
// Returns teams that have been added/modified during the show

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
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  try {
    const { showId } = event.queryStringParameters || {};
    if (!showId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing showId" }),
      };
    }

    const { data, error } = await supaAdmin
      .from("show_teams")
      .select("*")
      .eq("show_id", showId)
      .eq("is_removed", false)
      .order("entry_order", { ascending: true, nullsFirst: false });

    if (error) throw error;

    // Transform to frontend format
    const teams = (data || []).map((row) => ({
      showTeamId: row.show_team_id,
      teamId: row.team_id,
      teamName: row.team_name,
      showBonus: row.show_bonus || 0,
      isLeague: row.is_league || false,
      entryOrder: row.entry_order,
    }));

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teams,
        count: teams.length,
      }),
    };
  } catch (err) {
    console.error("supaLoadShowTeams failed:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
