// netlify/functions/fetchShowBundle.js
import fetch from "node-fetch";

const AIRTABLE_BASE_ID = "appnwzfwa2Bl6V2jX";
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

// Build Airtable URL
function buildUrl(
  endpoint,
  { filterByFormula, sort = [], pageSize = 100, offset, fields = [] } = {}
) {
  const url = new URL(`${AIRTABLE_API_URL}/${endpoint}`);
  if (filterByFormula) url.searchParams.set("filterByFormula", filterByFormula);
  if (pageSize) url.searchParams.set("pageSize", String(pageSize));
  if (offset) url.searchParams.set("offset", offset);
  sort.forEach((s, i) => {
    if (s.field) url.searchParams.set(`sort[${i}][field]`, s.field);
    if (s.direction) url.searchParams.set(`sort[${i}][direction]`, s.direction);
  });
  fields.forEach((f) => {
    url.searchParams.set(`fields[]`, f);
  });
  return url;
}

async function fetchAll(endpoint, opts) {
  let all = [];
  let offset;
  do {
    const url = buildUrl(endpoint, { ...opts, offset });
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Airtable error ${res.status}: ${text}\nURL: ${url.toString()}`
      );
    }
    const json = JSON.parse(text);
    all = all.concat(json.records || []);
    offset = json.offset;
  } while (offset);
  return all;
}

const toAttachmentArray = (val) =>
  Array.isArray(val)
    ? val
        .filter((a) => a && a.url)
        .map((a) => ({
          url: a.url,
          filename: a.filename || undefined,
          type: a.type || undefined,
          size: a.size || undefined,
          id: a.id || undefined,
        }))
    : [];

export async function handler(event) {
  // Basic CORS support
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "Content-Type, Authorization",
      },
    };
  }

  try {
    const showId = event.queryStringParameters?.showId;
    console.log(`[fetchShowBundle] Called with showId: ${showId}`);
    if (!showId)
      return { statusCode: 400, body: "Missing required query param: showId" };
    if (!AIRTABLE_TOKEN)
      return {
        statusCode: 500,
        body: "Server not configured: AIRTABLE_TOKEN is missing.",
      };

    // Fetch the Show record itself for configuration fields
    let showConfig = {};
    console.log(`[fetchShowBundle] Fetching Show record from Shows/${showId}`);
    try {
      // Don't use buildUrl for single record fetch - it adds query params that cause 422 errors
      const showUrl = `${AIRTABLE_API_URL}/Shows/${showId}`;
      const showRes = await fetch(showUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      });
      if (showRes.ok) {
        const showData = await showRes.json();
        const f = showData.fields || {};

        // Debug: log all field names to see what Airtable is actually returning
        console.log(
          `[fetchShowBundle] All field names in Show record:`,
          Object.keys(f)
        );

        const locationName = f["Location name"] || null;
        const scoringModeCell = f["Scoring mode"];
        const showDate = f["Date"] || null;
        const showTemplate = f["ShowTemplate"] || "";

        console.log(
          `[fetchShowBundle] Show fields - Date: ${showDate}, Location name: "${locationName}", Host: "${f["Host name"]}", Cohost: "${f["Cohost name"]}", Start: "${f["Start time"]}", Template: "${showTemplate}"`
        );

        // Read total games and start times from static Airtable fields
        const totalGamesThisNight =
          typeof f["Total # of games"] === "number" && f["Total # of games"] > 0
            ? f["Total # of games"]
            : 1; // Default to 1 if not set

        // Parse start times from comma-separated text field (e.g., "8:00pm, 9:00pm")
        const startTimesText = f["Start times"] || "";
        const allStartTimes = startTimesText
          .split(/,\s*/)
          .map((t) => t.trim())
          .filter(Boolean);

        console.log(
          `[fetchShowBundle] Static fields - Total games: ${totalGamesThisNight}, Start times: [${allStartTimes.join(", ")}]`
        );

        showConfig = {
          showId,
          location: locationName || null,
          scoringMode: scoringModeCell?.name || scoringModeCell || null,
          pubPoints:
            typeof f["Pub points"] === "number" ? f["Pub points"] : null,
          poolPerQuestion:
            typeof f["Pool per question"] === "number"
              ? f["Pool per question"]
              : null,
          poolContribution:
            typeof f["Pool contribution"] === "number"
              ? f["Pool contribution"]
              : null,
          announcements: f["Announcements"] || "",
          prizeDonor: f["Prize donor"] || "",
          timerDefault:
            typeof f["Timer default"] === "number" ? f["Timer default"] : null,
          hostName: f["Host name"] || "",
          cohostName: f["Cohost name"] || "",
          startTime: f["Start time"] || "",
          showTemplate: showTemplate,
          totalGamesThisNight,
          allStartTimes, // Array of all start times for multi-game nights
        };
        console.log(
          `[fetchShowBundle] Successfully fetched Show config:`,
          JSON.stringify(showConfig, null, 2)
        );
      } else {
        // Log when Show record fetch fails
        const errorText = await showRes.text();
        console.error(
          `[fetchShowBundle] Failed to fetch Show record: ${showRes.status} ${showRes.statusText}`,
          errorText
        );
      }
    } catch (err) {
      // Non-fatal: if we can't fetch Show config, continue without it
      console.error("Could not fetch Show config:", err);
    }

    // Fetch ShowCategories for this show
    const scRecords = await fetchAll("ShowCategories", {
      filterByFormula: `FIND('${showId}', ARRAYJOIN({Show ID}))`,
      sort: [
        { field: "Round", direction: "asc" },
        { field: "Category order", direction: "asc" },
      ],
      pageSize: 100,
    });

    // Build a map of ShowCategory ID -> category data
    const categoryMap = new Map();
    for (const rec of scRecords) {
      const f = rec.fields || {};
      const qTypeCell = f["Question type"];

      const showIdArray = f["Show ID"];
      const normalizedShowId =
        Array.isArray(showIdArray) && showIdArray.length > 0
          ? showIdArray[0]
          : showIdArray || null;

      categoryMap.set(rec.id, {
        showCategoryId: rec.id,
        showId: normalizedShowId,
        superSecret: !!f["Super secret"],
        categoryName: f["Category name"] || "",
        categoryDescription: f["Category description"] || "",
        categoryNotes: f["Category notes"] || "",
        categoryPronunciationGuide: f["Category pronunciation guide"] || "",
        questionType: qTypeCell?.name || qTypeCell || null,
        categoryImages: toAttachmentArray(f["Category image attachments"]),
        categoryAudio: toAttachmentArray(f["Category audio attachments"]),
        imageCarousel: toAttachmentArray(f["Image carousel"]),
        round: typeof f["Round"] === "number" ? f["Round"] : null,
        categoryOrder:
          typeof f["Category order"] === "number" ? f["Category order"] : null,
      });
    }

    // Fetch ShowQuestions for this show
    const sqRecords = await fetchAll("ShowQuestions", {
      filterByFormula: `FIND('${showId}', ARRAYJOIN({Show ID}))`,
      sort: [
        { field: "Round", direction: "asc" },
        { field: "Sort order", direction: "asc" },
      ],
      pageSize: 100,
    });

    // Build hierarchical structure: rounds → categories → questions
    const byRoundCategory = new Map(); // Map<roundNumber, Map<categoryId, {category, questions}>>

    for (const rec of sqRecords) {
      const f = rec.fields || {};

      // Debug: log field names for first question to see what Airtable is returning
      if (sqRecords.indexOf(rec) === 0) {
        console.log(
          `[fetchShowBundle] ShowQuestion field names (first record):`,
          Object.keys(f)
        );
        console.log(`[fetchShowBundle] Answer field value:`, f["Answer"]);
      }

      const scIdArray = f["ShowCategory ID"];
      const scId =
        Array.isArray(scIdArray) && scIdArray.length > 0
          ? scIdArray[0]
          : scIdArray || null;

      // Get category data from map
      const categoryData = scId ? categoryMap.get(scId) : null;
      const round = categoryData?.round ?? 0;

      const showIdArray = f["Show ID"];
      const normalizedShowId =
        Array.isArray(showIdArray) && showIdArray.length > 0
          ? showIdArray[0]
          : showIdArray || null;

      // Question object (only question-specific fields)
      // Extract questionId from the linked "Question" field (direct link to Questions table)
      // This is more reliable than using the "Question ID" lookup field
      const questionIdArray = f["Question"];
      const questionId =
        Array.isArray(questionIdArray) && questionIdArray.length > 0
          ? questionIdArray[0]
          : questionIdArray || null;

      // Check for host edits - use edited versions if they exist
      const editedByHost = f["Edited by host"] || false;
      const hasEditedQuestion =
        f["Edited question"] !== undefined && f["Edited question"] !== null;
      const hasEditedNotes =
        f["Edited notes"] !== undefined && f["Edited notes"] !== null;
      const hasEditedPronunciation =
        f["Edited pronunciation guide"] !== undefined &&
        f["Edited pronunciation guide"] !== null;
      const hasEditedAnswer =
        f["Edited answer"] !== undefined && f["Edited answer"] !== null;

      const q = {
        showQuestionId: rec.id,
        showId: normalizedShowId,
        questionId: questionId, // ✅ Add the linked Question ID from Airtable
        questionOrder: f["Question order"] || "",
        sortOrder: typeof f["Sort order"] === "number" ? f["Sort order"] : null,
        questionType: f["Question type"] || null,
        questionText: hasEditedQuestion
          ? f["Edited question"]
          : f["Question text"] || "",
        questionNotes: hasEditedNotes ? f["Edited notes"] : f["Notes"] || "",
        questionPronunciationGuide: hasEditedPronunciation
          ? f["Edited pronunciation guide"]
          : f["Pronunciation guide"] || "",
        answer: hasEditedAnswer ? f["Edited answer"] : f["Answer"] || "",
        tiebreakerNumber: f["Tiebreaker number"] || "",
        questionImages: toAttachmentArray(f["Question image attachments"]),
        questionAudio: toAttachmentArray(f["Question audio attachments"]),
        pointsPerQuestion:
          typeof f["Points per question"] === "number"
            ? f["Points per question"]
            : null,
        _edited: editedByHost, // Flag to show "edited" indicator in UI
      };

      // Initialize round if needed
      if (!byRoundCategory.has(round)) {
        byRoundCategory.set(round, new Map());
      }
      const roundMap = byRoundCategory.get(round);

      // Initialize category if needed
      if (!roundMap.has(scId)) {
        roundMap.set(scId, {
          category: categoryData || {
            showCategoryId: null,
            showId: null,
            superSecret: false,
            categoryName: "",
            categoryDescription: "",
            categoryNotes: "",
            categoryPronunciationGuide: "",
            questionType: null,
            categoryImages: [],
            categoryAudio: [],
            imageCarousel: [],
            round: null,
            categoryOrder: null,
          },
          questions: [],
        });
      }

      // Add question to category
      roundMap.get(scId).questions.push(q);
    }

    // Convert to array structure and sort
    const rounds = Array.from(byRoundCategory.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, categoryMap]) => {
        const categories = Array.from(categoryMap.values())
          .sort(
            (a, b) =>
              (a.category.categoryOrder ?? 0) - (b.category.categoryOrder ?? 0)
          )
          .map(({ category, questions }) => ({
            ...category,
            questions: questions.sort(
              (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
            ),
          }));

        return { round, categories };
      });

    // Fetch ShowTeams
    const teamRows = await fetchAll("ShowTeams", {
      filterByFormula: `FIND('${showId}', ARRAYJOIN({Show ID}))`,
      pageSize: 100,
    });

    const teams = teamRows.map((r) => {
      const f = r.fields || {};
      const teamLinked = Array.isArray(f["Team"]) ? f["Team"][0] : null;

      // Extract teamId from array (lookup fields return arrays)
      const teamIdRaw = f["Team ID"];
      const teamId =
        Array.isArray(teamIdRaw) && teamIdRaw.length > 0
          ? teamIdRaw[0]
          : teamIdRaw || null;

      const showIdArray = f["Show ID"];
      const normalizedShowId =
        Array.isArray(showIdArray) && showIdArray.length > 0
          ? showIdArray[0]
          : showIdArray || null;

      return {
        showTeamId: r.id,
        showId: normalizedShowId,
        team: teamLinked || null,
        teamId: teamId,
        teamName: f["Team name"] ?? "(Unnamed team)",
        showBonus: Number(f["Show bonus"] || 0),
        isLeague: !!f["League"],
      };
    });

    const bundle = {
      showId,
      totalQuestions: sqRecords.length,
      rounds,
      teams,
      config: showConfig,
      meta: {
        generatedAt: new Date().toISOString(),
        sortedBy: ["Round asc", "Sort order asc"],
        fieldsMode: ["all (no fields[] to avoid 422)"],
      },
    };

    console.log(
      `[fetchShowBundle] Returning bundle with config:`,
      JSON.stringify(bundle.config)
    );

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "x-function-version": "v2-rebuild",
      },
      body: JSON.stringify(bundle),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "text/plain",
        "access-control-allow-origin": "*",
      },
      body: String(err?.message || err),
    };
  }
}
