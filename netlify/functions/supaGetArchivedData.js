// /.netlify/functions/supaGetArchivedData.js
import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    const { data, error } = await supaAdmin
      .from("archived_shows")
      .select("*")
      .eq("show_id", showId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "No archived data found for this show" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        showId: data.show_id,
        showName: data.show_name,
        showDate: data.show_date,
        scoringData: data.scoring_data,
        archivedAt: data.archived_at,
        isFinalized: data.is_finalized,
        publishedToAirtable: data.published_to_airtable,
        reopenedAt: data.reopened_at,
      }),
    };
  } catch (err) {
    console.error("supaGetArchivedData failed:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
