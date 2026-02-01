// netlify/functions/createShowTeam.js
// Creates a ShowTeam record in Airtable, optionally creating a new Team first.
// Used when hosts add teams during a live show.

const Airtable = require("airtable");

const AIRTABLE_BASE_ID = "appnwzfwa2Bl6V2jX";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

const TBL_TEAMS = "Teams";
const TBL_SHOWTEAMS = "ShowTeams";

const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(AIRTABLE_BASE_ID);

// Validate Airtable record ID format
const isValidRecordId = (id) => {
  if (!id || typeof id !== "string") return false;
  return /^rec[a-zA-Z0-9]{14}$/.test(id);
};

exports.handler = async function handler(event) {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "access-control-allow-origin": "*" },
      body: "Method not allowed",
    };
  }

  try {
    if (!AIRTABLE_TOKEN) {
      return {
        statusCode: 500,
        headers: { "access-control-allow-origin": "*" },
        body: "Server not configured: AIRTABLE_TOKEN is missing.",
      };
    }

    const data = JSON.parse(event.body || "{}");
    const { showId, teamName, teamId: existingTeamId } = data;

    if (!showId) {
      return {
        statusCode: 400,
        headers: { "access-control-allow-origin": "*" },
        body: "Missing showId",
      };
    }

    if (!teamName && !existingTeamId) {
      return {
        statusCode: 400,
        headers: { "access-control-allow-origin": "*" },
        body: "Must provide teamName or teamId",
      };
    }

    let teamId = existingTeamId;
    let finalTeamName = teamName;

    // If we have an existing teamId, verify it and get the name
    if (existingTeamId && isValidRecordId(existingTeamId)) {
      try {
        const existingTeam = await base(TBL_TEAMS).find(existingTeamId);
        finalTeamName = existingTeam.fields["Team"] || teamName || "(Unknown)";
      } catch (err) {
        // Team doesn't exist, fall through to create new
        console.warn(`Team ${existingTeamId} not found, will create new`);
        teamId = null;
      }
    } else {
      teamId = null;
    }

    // Create new Team if needed
    if (!teamId) {
      const trimmedName = (teamName || "").trim();
      if (!trimmedName) {
        return {
          statusCode: 400,
          headers: { "access-control-allow-origin": "*" },
          body: "Team name is required for new teams",
        };
      }

      const newTeam = await base(TBL_TEAMS).create([
        { fields: { Team: trimmedName } },
      ]);
      teamId = newTeam[0].id;
      finalTeamName = trimmedName;
    }

    // Check if ShowTeam already exists for this Show + Team combo
    const existingFilter = `AND(FIND("${showId}", ARRAYJOIN({Show})), FIND("${teamId}", ARRAYJOIN({Team})))`;
    const existingShowTeams = await base(TBL_SHOWTEAMS)
      .select({ filterByFormula: existingFilter, maxRecords: 1 })
      .firstPage();

    if (existingShowTeams.length > 0) {
      // Already exists - return the existing record
      const existing = existingShowTeams[0];
      return {
        statusCode: 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
        body: JSON.stringify({
          showTeamId: existing.id,
          teamId: teamId,
          teamName: finalTeamName,
          alreadyExisted: true,
        }),
      };
    }

    // Create new ShowTeam
    const newShowTeam = await base(TBL_SHOWTEAMS).create([
      {
        fields: {
          Show: [showId],
          Team: [teamId],
        },
      },
    ]);

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify({
        showTeamId: newShowTeam[0].id,
        teamId: teamId,
        teamName: finalTeamName,
        alreadyExisted: false,
      }),
    };
  } catch (err) {
    console.error("createShowTeam error:", err);
    return {
      statusCode: 500,
      headers: { "access-control-allow-origin": "*" },
      body: `Server error: ${err.message}`,
    };
  }
};
