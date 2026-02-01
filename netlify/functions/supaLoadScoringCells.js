// netlify/functions/supaLoadScoringCells.js
// Loads all scoring cells for a given show

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
      .from("scoring_cells")
      .select("*")
      .eq("show_id", showId);

    if (error) throw error;

    // Transform to a grid structure: { [showTeamId]: { [showQuestionId]: cellData } }
    const grid = {};
    for (const cell of data || []) {
      const teamId = cell.show_team_id;
      const questionId = cell.show_question_id;
      if (!grid[teamId]) grid[teamId] = {};
      grid[teamId][questionId] = {
        isCorrect: cell.is_correct,
        tiebreakerGuess: cell.tiebreaker_guess,
        tiebreakerGuessRaw: cell.tiebreaker_guess_raw,
        bonusCount: cell.bonus_count,
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grid,
        cellCount: (data || []).length,
      }),
    };
  } catch (err) {
    console.error("supaLoadScoringCells failed:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
