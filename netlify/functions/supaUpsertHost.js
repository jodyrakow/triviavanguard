// netlify/functions/supaUpsertHost.js
// POST { hostId }       → verify host exists, update last_seen, return host row
// POST { hostName }     → create new host, return host row
import { createClient } from "@supabase/supabase-js";

const supaAdmin = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: "Invalid JSON" };
  }

  const { hostId, hostName } = body;

  // Verify existing host by ID and refresh last_seen
  if (hostId) {
    const { data, error } = await supaAdmin
      .from("hosts")
      .update({ last_seen: new Date().toISOString() })
      .eq("host_id", hostId)
      .select("host_id, host_name, last_seen")
      .single();

    if (error || !data) {
      return {
        statusCode: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Host not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  }

  // Create new host by name
  if (hostName) {
    const { data, error } = await supaAdmin
      .from("hosts")
      .insert({ host_name: hostName.trim() })
      .select("host_id, host_name, last_seen")
      .single();

    if (error) {
      return {
        statusCode: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  }

  return {
    statusCode: 400,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify({ error: "Provide either hostId or hostName" }),
  };
};
