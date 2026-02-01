// netlify/functions/supaSaveShowSettings.js
// Saves/updates show settings in Supabase (upsert)

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
    const { showId, settings, updatedBy } = body;

    if (!showId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing showId" }),
      };
    }

    // Build the row to upsert
    const row = {
      show_id: showId,
      updated_by: updatedBy || null,
      // Map settings fields to columns
      ...(settings.show_name !== undefined && { show_name: settings.show_name }),
      ...(settings.date !== undefined && { date: settings.date }),
      ...(settings.location_id !== undefined && { location_id: settings.location_id }),
      ...(settings.location_name !== undefined && { location_name: settings.location_name }),
      ...(settings.start_time !== undefined && { start_time: settings.start_time }),
      ...(settings.start_times !== undefined && { start_times: settings.start_times }),
      ...(settings.total_games !== undefined && { total_games: settings.total_games }),
      ...(settings.scoring_mode !== undefined && { scoring_mode: settings.scoring_mode }),
      ...(settings.pub_points !== undefined && { pub_points: settings.pub_points }),
      ...(settings.pool_per_question !== undefined && { pool_per_question: settings.pool_per_question }),
      ...(settings.pool_contribution !== undefined && { pool_contribution: settings.pool_contribution }),
      ...(settings.timer_default !== undefined && { timer_default: settings.timer_default }),
      ...(settings.host_name !== undefined && { host_name: settings.host_name }),
      ...(settings.cohost_name !== undefined && { cohost_name: settings.cohost_name }),
      ...(settings.announcements !== undefined && { announcements: settings.announcements }),
      ...(settings.prizes !== undefined && { prizes: settings.prizes }),
    };

    const { data, error } = await supaAdmin
      .from("show_settings")
      .upsert(row, { onConflict: "show_id" })
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
        settings: data,
      }),
    };
  } catch (err) {
    console.error("supaSaveShowSettings failed:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
