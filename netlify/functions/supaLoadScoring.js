// /.netlify/functions/supaLoadScoring.js
import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Netlify env var
const supaAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

export const handler = async (event) => {
  try {
    const { showId } = event.queryStringParameters || {};
    if (!showId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing showId" }),
      };
    }

    // Fetch ALL scoring data for this show (single row with round_id = "all")
    const { data: showRow, error: e1 } = await supaAdmin
      .from("live_scoring")
      .select("payload,updated_at")
      .eq("show_id", showId)
      .eq("round_id", "all")
      .maybeSingle();
    if (e1) throw e1;

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: showRow?.payload ?? null,
        updatedAt: showRow?.updated_at ?? null,
      }),
    };
  } catch (err) {
    console.error("supaLoadScoring failed:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
