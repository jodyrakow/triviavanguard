/***** Bulk Create Shows from Template
 * Creates multiple Shows at once from a selected ShowTemplate,
 * with customizable descriptions and automatic ShowCategories creation.
 * OR adds ShowCategories to existing Shows.
 ******************************************************************************/

// === Tables
const TABLES = {
  SHOWS: "Shows",
  SHOW_TEMPLATES: "ShowTemplates",
  SHOW_CATEGORIES: "ShowCategories",
  LOCATIONS: "Locations",
  CATEGORIES: "Categories",
};

// === Field names
const SHOW_FIELDS = {
  DATE: "Date",
  LOCATION: "Location",
  TEMPLATE: "ShowTemplate (from ShowTemplates)",
  DESCRIPTION: "Description",
  HOST_NAME: "Host name",
  COHOST_NAME: "Cohost name",
  SCORING_MODE: "Scoring mode",
  PUB_POINTS: "Pub points",
  POOL_PER_QUESTION: "Pool per question",
  POOL_CONTRIBUTION: "Pool contribution",
  ANNOUNCEMENTS: "Announcements",
};

const ST_FIELDS = {
  NUM_ROUNDS: "# of rounds",
  V1: "# of visual categories in round 1",
  S1: "# of spoken categories in round 1",
  A1: "# of audio categories in round 1",
  V2: "# of visual categories in round 2",
  S2: "# of spoken categories in round 2",
  A2: "# of audio categories in round 2",
  Q_PER_VISUAL: "# of questions per visual category",
  Q_PER_SPOKEN: "# of questions per spoken category",
  Q_PER_AUDIO: "# of questions per audio category",
};

const SC_FIELDS = {
  SHOW: "Show",
  CATEGORY: "Category",
  ROUND: "Round",
  CATEGORY_ORDER: "Category order",
  EXPECTED_COUNT: "Expected count",
  QUESTION_TYPE: "Question type",
  DATE: "Date", // ✅ NEW (ShowCategories.Date)
};

function nz(n) {
  return typeof n === "number" && !isNaN(n) ? n : 0;
}

function buildRoundRecords(
  showId,
  roundNumber,
  counts,
  perTypeQuestionCounts,
  showDate
) {
  const result = [];
  let order = 1;

  const sequence = [
    {
      type: "Visual",
      count: nz(counts.visual),
      per: nz(perTypeQuestionCounts.visual),
    },
    {
      type: "Spoken",
      count: nz(counts.spoken),
      per: nz(perTypeQuestionCounts.spoken),
    },
    {
      type: "Audio",
      count: nz(counts.audio),
      per: nz(perTypeQuestionCounts.audio),
    },
  ];

  for (const { type, count, per } of sequence) {
    for (let i = 0; i < count; i++) {
      result.push({
        fields: {
          [SC_FIELDS.SHOW]: [{ id: showId }],
          [SC_FIELDS.ROUND]: roundNumber,
          [SC_FIELDS.QUESTION_TYPE]: { name: type },
          [SC_FIELDS.CATEGORY_ORDER]: order++,
          [SC_FIELDS.EXPECTED_COUNT]: per,
          [SC_FIELDS.DATE]: showDate, // ✅ NEW
        },
      });
    }
  }
  return result;
}

// === Main
const showsTable = base.getTable(TABLES.SHOWS);
const showTemplates = base.getTable(TABLES.SHOW_TEMPLATES);
const showCategories = base.getTable(TABLES.SHOW_CATEGORIES);
const locationsTable = base.getTable(TABLES.LOCATIONS);

output.markdown("# 🎯 Show & ShowCategories Creator");

// === MODE SELECTION ===
const mode = await input.buttonsAsync("What would you like to do?", [
  { label: "Create new Shows from scratch", value: "new" },
  { label: "Add ShowCategories to existing Shows", value: "existing" },
]);

// === Variables that differ by mode ===
let targetShowIds = [];
let targetShowDates = {}; // Map of showId -> date string
let selectedTemplate = null;
let selectedTemplateId = null;

if (mode === "existing") {
  // ========================================
  // MODE: Add ShowCategories to existing Shows
  // ========================================
  output.markdown("## Select Existing Show(s)");

  // Fetch all shows sorted by Date descending (latest first)
  const allShows = await showsTable.selectRecordsAsync({
    fields: [
      SHOW_FIELDS.DATE,
      SHOW_FIELDS.DESCRIPTION,
      SHOW_FIELDS.TEMPLATE,
    ],
    sorts: [{ field: SHOW_FIELDS.DATE, direction: "desc" }],
  });

  if (allShows.records.length === 0) {
    output.markdown("❌ No Shows found. Please create a Show first.");
    return;
  }

  // Build button choices from shows (latest dates first, limit to 20)
  const MAX_SHOWS = 20;
  const recentShows = allShows.records.slice(0, MAX_SHOWS);
  const showChoices = recentShows.map((show) => ({
    label: show.name || "(Unnamed Show)",
    value: show.id,
  }));

  // Select first show
  const firstShowId = await input.buttonsAsync(
    `Select a Show (${MAX_SHOWS} most recent):`,
    showChoices
  );

  const showsToProcess = [recentShows.find((s) => s.id === firstShowId)];

  // Allow selecting more shows
  let addMore = await input.buttonsAsync(
    "Do you want to add ShowCategories to another Show too?",
    ["Yes, select another", "No, that's all"]
  );

  while (addMore === "Yes, select another") {
    // Filter out already-selected shows
    const remainingChoices = showChoices.filter(
      (c) => !showsToProcess.some((s) => s.id === c.value)
    );

    if (remainingChoices.length === 0) {
      output.markdown("No more shows to select.");
      break;
    }

    const nextShowId = await input.buttonsAsync(
      "Select another Show:",
      remainingChoices
    );

    const nextShow = recentShows.find((s) => s.id === nextShowId);
    if (nextShow) {
      showsToProcess.push(nextShow);
    }

    addMore = await input.buttonsAsync("Add another Show?", [
      "Yes, select another",
      "No, that's all",
    ]);
  }

  // Validate all selected shows have templates
  output.markdown(`📋 Selected **${showsToProcess.length}** Show(s):`);

  const allTemplates = await showTemplates.selectRecordsAsync();

  for (const show of showsToProcess) {
    const showDate = show.getCellValueAsString(SHOW_FIELDS.DATE);
    const showDesc = show.getCellValueAsString(SHOW_FIELDS.DESCRIPTION);
    output.markdown(`- ${show.name} ${showDesc ? `(${showDesc})` : ""}`);

    // Get the template from the show's linked field
    const linkedTemplates = show.getCellValue(SHOW_FIELDS.TEMPLATE);
    if (!linkedTemplates || linkedTemplates.length === 0) {
      output.markdown(
        `  ❌ This Show doesn't have a ShowTemplate linked. Skipping.`
      );
      continue;
    }

    // Use the first show's template for all (they should match)
    if (!selectedTemplate) {
      selectedTemplateId = linkedTemplates[0].id;
      selectedTemplate = allTemplates.records.find(
        (t) => t.id === selectedTemplateId
      );
      output.markdown(`📄 Using template: **${selectedTemplate?.name}**`);
    }

    targetShowIds.push(show.id);
    targetShowDates[show.id] = showDate || null;
  }

  if (targetShowIds.length === 0) {
    output.markdown("❌ No valid shows to process.");
    return;
  }

  if (!selectedTemplate) {
    output.markdown("❌ Could not find the linked ShowTemplate.");
    return;
  }
} else {
  // ========================================
  // MODE: Create new Shows from scratch
  // ========================================
  output.markdown(
    "Create multiple Shows at once from a template with automatic ShowCategories generation."
  );

  // Select ShowTemplate
  const allTemplates = await showTemplates.selectRecordsAsync();
  if (allTemplates.records.length === 0) {
    output.markdown(
      "❌ No ShowTemplates found. Please create a template first."
    );
    return;
  }

  const templateChoices = allTemplates.records.map((t) => ({
    label: t.name || "(Unnamed Template)",
    value: t.id,
  }));

  selectedTemplateId = await input.buttonsAsync(
    "Select a ShowTemplate:",
    templateChoices
  );

  selectedTemplate = allTemplates.records.find(
    (t) => t.id === selectedTemplateId
  );
  if (!selectedTemplate) {
    output.markdown("❌ Template not found.");
    return;
  }

  output.markdown(`✅ Selected template: **${selectedTemplate.name}**`);

  // How many Shows to create?
  const defaultNumShows =
    selectedTemplate.name === "Tipsy: 1 round, 1 visual" ? 2 : 1;
  const numShowsInput = await input.textAsync(
    `How many Shows do you want to create?`
  );
  const numShows = parseInt(numShowsInput || defaultNumShows.toString());

  if (isNaN(numShows) || numShows < 1 || numShows > 10) {
    output.markdown("❌ Please enter a number between 1 and 10.");
    return;
  }

  output.markdown(`📋 Creating **${numShows}** Show(s)...`);

  // Collect shared fields
  output.markdown("## Shared Information");

  const dateInput = await input.textAsync("Date (e.g., 2025-01-15):");
  const sharedDate = dateInput;

  // Location dropdown
  const allLocations = await locationsTable.selectRecordsAsync();
  if (allLocations.records.length === 0) {
    output.markdown("❌ No Locations found. Please create a location first.");
    return;
  }

  const locationChoices = allLocations.records.map((loc) => ({
    label: loc.name || "(Unnamed Location)",
    value: loc.id,
  }));

  const selectedLocationId = await input.buttonsAsync(
    "Select a Location:",
    locationChoices
  );

  const selectedLocation = allLocations.records.find(
    (loc) => loc.id === selectedLocationId
  );
  const sharedLocation = [{ id: selectedLocationId }];

  // Host name
  const addHostName = await input.buttonsAsync(
    "Do you want to add a host name?",
    ["Yes", "No"]
  );
  let sharedHostName = null;
  if (addHostName === "Yes") {
    sharedHostName = await input.textAsync("Host name:");
  }

  // Cohost name
  const addCohostName = await input.buttonsAsync(
    "Do you want to add a cohost name?",
    ["Yes", "No"]
  );
  let sharedCohostName = null;
  if (addCohostName === "Yes") {
    sharedCohostName = await input.textAsync("Cohost name:");
  }

  // Announcements
  const addAnnouncements = await input.buttonsAsync(
    "Do you want to add announcements?",
    ["Yes", "No"]
  );
  let sharedAnnouncements = null;
  if (addAnnouncements === "Yes") {
    sharedAnnouncements = await input.textAsync("Announcements:");
  }

  // Scoring mode
  const scoringMode = await input.buttonsAsync("Scoring mode:", [
    { label: "Pub", value: "Pub" },
    { label: "Pooled (static)", value: "Pooled (static)" },
    { label: "Pooled (adaptive)", value: "Pooled (adaptive)" },
  ]);

  let pubPoints = null;
  let poolPerQuestion = null;
  let poolContribution = null;

  if (scoringMode === "Pub") {
    const pubPointsInput = await input.textAsync(
      "Pub points per question (default: 10):"
    );
    pubPoints = parseFloat(pubPointsInput || "10");
  } else if (scoringMode === "Pooled (static)") {
    const poolPerQuestionInput = await input.textAsync(
      "Pool per question (default: 500):"
    );
    poolPerQuestion = parseFloat(poolPerQuestionInput || "500");
  } else if (scoringMode === "Pooled (adaptive)") {
    const poolContributionInput = await input.textAsync(
      "Pool contribution per team (default: 10):"
    );
    poolContribution = parseFloat(poolContributionInput || "10");
  }

  // Descriptions
  const addDescriptions = await input.buttonsAsync(
    "Do you want to add descriptions?",
    ["Yes", "No"]
  );

  let finalDescriptions = [];

  if (addDescriptions === "Yes") {
    const defaultDescriptions = [];
    for (let i = 1; i <= numShows; i++) {
      defaultDescriptions.push(`Game ${i}`);
    }

    output.markdown("## Show Descriptions");
    output.markdown("Default descriptions:");
    for (let i = 0; i < numShows; i++) {
      output.markdown(`- Show ${i + 1}: **${defaultDescriptions[i]}**`);
    }

    const editDescriptions = await input.buttonsAsync(
      "Do you want to customize the descriptions?",
      ["Use defaults", "Customize"]
    );

    finalDescriptions = [...defaultDescriptions];

    if (editDescriptions === "Customize") {
      for (let i = 0; i < numShows; i++) {
        const customDesc = await input.textAsync(
          `Description for Show ${i + 1} (default: ${defaultDescriptions[i]}):`
        );
        finalDescriptions[i] = customDesc || defaultDescriptions[i];
      }
    }
  } else {
    for (let i = 0; i < numShows; i++) {
      finalDescriptions.push("");
    }
  }

  // Summary for new shows
  output.markdown("## 📝 Summary");
  output.markdown(`**Template:** ${selectedTemplate.name}`);
  output.markdown(`**Number of Shows:** ${numShows}`);
  output.markdown(`**Date:** ${sharedDate}`);
  output.markdown(`**Location:** ${selectedLocation.name}`);
  if (sharedHostName) output.markdown(`**Host:** ${sharedHostName}`);
  if (sharedCohostName) output.markdown(`**Cohost:** ${sharedCohostName}`);
  output.markdown(`**Scoring mode:** ${scoringMode}`);
  if (pubPoints !== null) output.markdown(`**Pub points:** ${pubPoints}`);
  if (poolPerQuestion !== null)
    output.markdown(`**Pool per question:** ${poolPerQuestion}`);
  if (poolContribution !== null)
    output.markdown(`**Pool contribution:** ${poolContribution}`);
  if (sharedAnnouncements)
    output.markdown(`**Announcements:** ${sharedAnnouncements}`);

  if (addDescriptions === "Yes") {
    output.markdown("\n**Descriptions:**");
    for (let i = 0; i < numShows; i++) {
      output.markdown(`- Show ${i + 1}: ${finalDescriptions[i]}`);
    }
  }

  const confirmShows = await input.buttonsAsync(
    "Ready to create these Shows?",
    ["Yes, create them!", "Cancel"]
  );

  if (confirmShows !== "Yes, create them!") {
    output.markdown("↪️ Cancelled.");
    return;
  }

  // Create Shows
  output.markdown("## 🚀 Creating Shows...");

  const showRecordsToCreate = [];

  for (let i = 0; i < numShows; i++) {
    const showFields = {
      [SHOW_FIELDS.DATE]: sharedDate,
      [SHOW_FIELDS.LOCATION]: sharedLocation,
      [SHOW_FIELDS.TEMPLATE]: [{ id: selectedTemplateId }],
      [SHOW_FIELDS.SCORING_MODE]: { name: scoringMode },
    };

    if (finalDescriptions[i])
      showFields[SHOW_FIELDS.DESCRIPTION] = finalDescriptions[i];

    if (sharedHostName) showFields[SHOW_FIELDS.HOST_NAME] = sharedHostName;
    if (sharedCohostName)
      showFields[SHOW_FIELDS.COHOST_NAME] = sharedCohostName;
    if (sharedAnnouncements)
      showFields[SHOW_FIELDS.ANNOUNCEMENTS] = sharedAnnouncements;
    if (pubPoints !== null) showFields[SHOW_FIELDS.PUB_POINTS] = pubPoints;
    if (poolPerQuestion !== null)
      showFields[SHOW_FIELDS.POOL_PER_QUESTION] = poolPerQuestion;
    if (poolContribution !== null)
      showFields[SHOW_FIELDS.POOL_CONTRIBUTION] = poolContribution;

    showRecordsToCreate.push({ fields: showFields });
  }

  const createdShows = await showsTable.createRecordsAsync(showRecordsToCreate);
  targetShowIds = createdShows;

  // Set dates for all created shows
  for (const showId of targetShowIds) {
    targetShowDates[showId] = sharedDate;
  }

  output.markdown(`✅ Created ${targetShowIds.length} Show(s)`);
}

// === Ask about Trivia grab bag and tiebreaker (both modes) ===
let triviaGrabBagCategoryId = null;
let tiebreakerCategoryId = null;

const addTriviaGrabBag = await input.buttonsAsync(
  'Do you want "Trivia grab bag" as the first spoken category?',
  ["Yes", "No"]
);

if (addTriviaGrabBag === "Yes") {
  const categoriesTable = base.getTable(TABLES.CATEGORIES);
  const allCategories = await categoriesTable.selectRecordsAsync();
  const triviaGrabBag = allCategories.records.find(
    (cat) => cat.name && cat.name.toLowerCase().includes("trivia grab bag")
  );

  if (triviaGrabBag) {
    triviaGrabBagCategoryId = triviaGrabBag.id;
    output.markdown(
      `✅ Found "Trivia grab bag" category (${triviaGrabBag.name})`
    );
  } else {
    output.markdown(
      '⚠️ Could not find "Trivia grab bag" category. You\'ll need to add categories manually.'
    );
  }
}

const addTiebreaker = await input.buttonsAsync(
  "Do you want to include a tiebreaker?",
  ["Yes", "No"]
);

if (addTiebreaker === "Yes") {
  const categoriesTable = base.getTable(TABLES.CATEGORIES);
  const allCategories = await categoriesTable.selectRecordsAsync();
  const tiebreaker = allCategories.records.find(
    (cat) => cat.name && cat.name.toLowerCase().includes("tiebreaker")
  );

  if (tiebreaker) {
    tiebreakerCategoryId = tiebreaker.id;
    output.markdown(`✅ Found "Tiebreaker" category (${tiebreaker.name})`);
  } else {
    output.markdown(
      '⚠️ Could not find "Tiebreaker" category. You\'ll need to add categories manually.'
    );
  }
}

// === Create ShowCategories for all target Shows ===
output.markdown("## 📚 Creating ShowCategories...");

// Get template data
const numRounds = nz(selectedTemplate.getCellValue(ST_FIELDS.NUM_ROUNDS));

const countsR1 = {
  visual: nz(selectedTemplate.getCellValue(ST_FIELDS.V1)),
  spoken: nz(selectedTemplate.getCellValue(ST_FIELDS.S1)),
  audio: nz(selectedTemplate.getCellValue(ST_FIELDS.A1)),
};
const countsR2 = {
  visual: nz(selectedTemplate.getCellValue(ST_FIELDS.V2)),
  spoken: nz(selectedTemplate.getCellValue(ST_FIELDS.S2)),
  audio: nz(selectedTemplate.getCellValue(ST_FIELDS.A2)),
};

const perType = {
  visual: nz(selectedTemplate.getCellValue(ST_FIELDS.Q_PER_VISUAL)),
  spoken: nz(selectedTemplate.getCellValue(ST_FIELDS.Q_PER_SPOKEN)),
  audio: nz(selectedTemplate.getCellValue(ST_FIELDS.Q_PER_AUDIO)),
};

let totalCategoriesCreated = 0;

for (const showId of targetShowIds) {
  const showDate = targetShowDates[showId] || null;
  let toCreate = [];

  if (numRounds >= 1) {
    const round1Categories = buildRoundRecords(
      showId,
      1,
      countsR1,
      perType,
      showDate
    );

    // If Trivia grab bag is selected, assign it to the first spoken category
    if (triviaGrabBagCategoryId) {
      const firstSpokenCategory = round1Categories.find(
        (cat) => cat.fields[SC_FIELDS.QUESTION_TYPE]?.name === "Spoken"
      );

      if (firstSpokenCategory) {
        firstSpokenCategory.fields[SC_FIELDS.CATEGORY] = [
          { id: triviaGrabBagCategoryId },
        ];
      }
    }

    toCreate = toCreate.concat(round1Categories);
  }
  if (numRounds >= 2) {
    toCreate = toCreate.concat(
      buildRoundRecords(showId, 2, countsR2, perType, showDate)
    );
  }

  // Add tiebreaker as last category in final round
  if (addTiebreaker === "Yes" && tiebreakerCategoryId && numRounds > 0) {
    const finalRound = Math.max(1, numRounds);

    const finalRoundCategories = toCreate.filter(
      (c) => c.fields[SC_FIELDS.ROUND] === finalRound
    );
    const nextCategoryOrder =
      finalRoundCategories.length > 0
        ? Math.max(
            ...finalRoundCategories.map(
              (c) => c.fields[SC_FIELDS.CATEGORY_ORDER]
            )
          ) + 1
        : 1;

    toCreate.push({
      fields: {
        [SC_FIELDS.SHOW]: [{ id: showId }],
        [SC_FIELDS.ROUND]: finalRound,
        [SC_FIELDS.QUESTION_TYPE]: { name: "Tiebreaker" },
        [SC_FIELDS.CATEGORY]: [{ id: tiebreakerCategoryId }],
        [SC_FIELDS.CATEGORY_ORDER]: nextCategoryOrder,
        [SC_FIELDS.EXPECTED_COUNT]: 1,
        [SC_FIELDS.DATE]: showDate,
      },
    });
  }

  if (toCreate.length > 0) {
    const BATCH = 50;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      await showCategories.createRecordsAsync(toCreate.slice(i, i + BATCH));
    }
    totalCategoriesCreated += toCreate.length;
  }
}

output.markdown(`✅ Created ${totalCategoriesCreated} ShowCategories`);

// === Final summary ===
output.markdown("# 🎉 Complete!");
if (mode === "new") {
  output.markdown(
    `Successfully created **${targetShowIds.length}** Shows with **${totalCategoriesCreated}** ShowCategories.`
  );
} else {
  output.markdown(
    `Successfully added **${totalCategoriesCreated}** ShowCategories to **${targetShowIds.length}** existing Show(s).`
  );
}
output.markdown("\nYour Shows are ready to use!");
