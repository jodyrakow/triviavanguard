// netlify/functions/fetchVenuesToday.js
// Returns venues that have shows on today's date, for the venue display picker
const fetch = require("node-fetch");

const AIRTABLE_BASE_ID = "appnwzfwa2Bl6V2jX";
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

exports.handler = async function () {
  try {
    // Today as YYYY-MM-DD (UTC)
    const today = new Date();
    const todayStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    // Tomorrow as YYYY-MM-DD (to use IS_BEFORE for "today only" filter)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0"),
    ].join("-");

    const filterFormula = `AND(NOT(IS_BEFORE({Date}, "${todayStr}")), IS_BEFORE({Date}, "${tomorrowStr}"))`;

    const url = `${AIRTABLE_API_URL}/Shows?` +
      `filterByFormula=${encodeURIComponent(filterFormula)}` +
      `&fields[]=Date&fields[]=Location+name&fields[]=Location` +
      `&sort[0][field]=Location+name&sort[0][direction]=asc`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const records = data.records || [];

    // Group by location — use Location record ID as the stable venue identifier
    const venueMap = new Map();
    for (const rec of records) {
      const f = rec.fields || {};
      const locationName = f["Location name"] || "Unknown venue";
      // Location is a linked record field — comes back as array of record IDs
      const locationId = Array.isArray(f["Location"]) ? f["Location"][0] : f["Location"] || null;
      if (!locationId) continue;

      const venueShowId = `${locationId}:${todayStr}`;
      if (!venueMap.has(venueShowId)) {
        venueMap.set(venueShowId, { venueShowId, venueName: locationName, showCount: 0 });
      }
      venueMap.get(venueShowId).showCount += 1;
    }

    const venues = Array.from(venueMap.values()).sort((a, b) =>
      a.venueName.localeCompare(b.venueName)
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venues }),
    };
  } catch (err) {
    console.error("[fetchVenuesToday] error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
