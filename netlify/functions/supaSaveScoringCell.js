// netlify/functions/supaSaveScoringCell.js
// Saves/updates a single scoring cell in Supabase (upsert)

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
    const { showId, showTeamId, showQuestionId, cell, updatedBy } = body;

    if (!showId || !showTeamId || !showQuestionId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing showId, showTeamId, or showQuestionId" }),
      };
    }

    // Build the row to upsert
    const row = {
      show_id: showId,
      show_team_id: showTeamId,
      show_question_id: showQuestionId,
      updated_by: updatedBy || null,
      is_correct: cell?.isCorrect ?? null,
      tiebreaker_guess: cell?.tiebreakerGuess ?? null,
      tiebreaker_guess_raw: cell?.tiebreakerGuessRaw ?? null,
      bonus_count: cell?.bonusCount ?? 0,
      partial_count: cell?.partialCount ?? 0,
    };

    const { data, error } = await supaAdmin
      .from("scoring_cells")
      .upsert(row, { onConflict: "show_id,show_team_id,show_question_id" })
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
        cell: data,
      }),
    };
  } catch (err) {
    console.error("supaSaveScoringCell failed:", err);
    const errorMsg = err?.message || err?.details || JSON.stringify(err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: errorMsg }),
    };
  }
};
