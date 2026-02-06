// netlify/functions/supaRemoveShowTeam.js
// Soft-deletes a ShowTeam from a show (sets is_removed = true)

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
    const { showId, showTeamId, updatedBy } = body;

    if (!showId || !showTeamId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing showId or showTeamId" }),
      };
    }

    // Soft delete by setting is_removed = true
    const { data, error } = await supaAdmin
      .from("show_teams")
      .update({
        is_removed: true,
        updated_by: updatedBy || null,
      })
      .eq("show_id", showId)
      .eq("show_team_id", showTeamId)
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
        removed: data,
      }),
    };
  } catch (err) {
    console.error("supaRemoveShowTeam failed:", err);
    const errorMsg = err?.message || err?.details || JSON.stringify(err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: errorMsg }),
    };
  }
};
