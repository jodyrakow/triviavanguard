/***** Bulk Create Shows from Template
 * Creates multiple Shows at once from a selected ShowTemplate,
 * with customizable descriptions and automatic ShowCategories creation.
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
  TEMPLATE: "ShowTemplate",
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
};

function nz(n) {
  return typeof n === "number" && !isNaN(n) ? n : 0;
}

function buildRoundRecords(showId, roundNumber, counts, perTypeQuestionCounts) {
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

output.markdown("# 🎯 Bulk Show Creator");
output.markdown(
  "Create multiple Shows at once from a template with automatic ShowCategories generation."
);

// 1. Select ShowTemplate
const allTemplates = await showTemplates.selectRecordsAsync();
if (allTemplates.records.length === 0) {
  output.markdown("❌ No ShowTemplates found. Please create a template first.");
  return;
}

const templateChoices = allTemplates.records.map((t) => ({
  label: t.name || "(Unnamed Template)",
  value: t.id,
}));

const selectedTemplateId = await input.buttonsAsync(
  "Select a ShowTemplate:",
  templateChoices
);

const selectedTemplate = allTemplates.records.find(
  (t) => t.id === selectedTemplateId
);
if (!selectedTemplate) {
  output.markdown("❌ Template not found.");
  return;
}

output.markdown(`✅ Selected template: **${selectedTemplate.name}**`);

// 2. How many Shows to create?
// Default is 2 for "Tipsy: 1 round, 1 visual", otherwise 1
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

// 3. Collect shared fields
output.markdown("## Shared Information");

// Date input - convert to proper format
const dateInput = await input.textAsync("Date (e.g., 2025-01-15):");
const sharedDate = dateInput;

// Location dropdown from Locations table
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

// Host name - optional with button prompt
const addHostName = await input.buttonsAsync(
  "Do you want to add a host name?",
  ["Yes", "No"]
);

let sharedHostName = null;
if (addHostName === "Yes") {
  sharedHostName = await input.textAsync("Host name:");
}

// Cohost name - optional with button prompt
const addCohostName = await input.buttonsAsync(
  "Do you want to add a cohost name?",
  ["Yes", "No"]
);

let sharedCohostName = null;
if (addCohostName === "Yes") {
  sharedCohostName = await input.textAsync("Cohost name:");
}

// Announcements - optional with button prompt
const addAnnouncements = await input.buttonsAsync(
  "Do you want to add announcements?",
  ["Yes", "No"]
);

let sharedAnnouncements = null;
if (addAnnouncements === "Yes") {
  sharedAnnouncements = await input.textAsync("Announcements:");
}

// 4. Scoring mode and related fields
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

// 5. Ask about "Trivia grab bag" as first category
const addTriviaGrabBag = await input.buttonsAsync(
  'Do you want "Trivia grab bag" as the first category in each show?',
  ["Yes", "No, I'll choose different categories"]
);

let triviaGrabBagCategoryId = null;
if (addTriviaGrabBag === "Yes") {
  // Load Categories table to find "Trivia grab bag"
  const categoriesTable = base.getTable(TABLES.CATEGORIES);
  const allCategories = await categoriesTable.selectRecordsAsync();
  const triviaGrabBag = allCategories.records.find(
    (cat) => cat.name && cat.name.toLowerCase().includes("trivia grab bag")
  );

  if (triviaGrabBag) {
    triviaGrabBagCategoryId = triviaGrabBag.id;
    output.markdown(`✅ Found "Trivia grab bag" category (${triviaGrabBag.name})`);
  } else {
    output.markdown('⚠️ Could not find "Trivia grab bag" category. You\'ll need to add categories manually.');
  }
}

// 6. Ask about tiebreaker
const addTiebreaker = await input.buttonsAsync(
  "Do you want to include a tiebreaker in each show?",
  ["Yes", "No"]
);

// 7. Generate default descriptions
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
  // Leave descriptions blank
  for (let i = 0; i < numShows; i++) {
    finalDescriptions.push("");
  }
}

// 6. Confirmation
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
output.markdown(`**Include tiebreaker:** ${addTiebreaker}`);

if (addDescriptions === "Yes") {
  output.markdown("\n**Descriptions:**");
  for (let i = 0; i < numShows; i++) {
    output.markdown(`- Show ${i + 1}: ${finalDescriptions[i]}`);
  }
}

const confirm = await input.buttonsAsync("Ready to create these Shows?", [
  "Yes, create them!",
  "Cancel",
]);

if (confirm !== "Yes, create them!") {
  output.markdown("↪️ Cancelled.");
  return;
}

// 7. Create Shows
output.markdown("## 🚀 Creating Shows...");

const createdShowIds = [];
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
  if (sharedCohostName) showFields[SHOW_FIELDS.COHOST_NAME] = sharedCohostName;
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
createdShowIds.push(...createdShows);

output.markdown(`✅ Created ${createdShowIds.length} Show(s)`);

// 8. Create ShowCategories for all new Shows
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

for (const showId of createdShowIds) {
  let toCreate = [];

  if (numRounds >= 1) {
    const round1Categories = buildRoundRecords(showId, 1, countsR1, perType);

    // If Trivia grab bag is selected, assign it to the first spoken category
    if (triviaGrabBagCategoryId) {
      // Find the first Spoken category in round 1
      const firstSpokenCategory = round1Categories.find(
        cat => cat.fields[SC_FIELDS.QUESTION_TYPE]?.name === "Spoken"
      );

      if (firstSpokenCategory) {
        // Assign the Trivia grab bag category to this ShowCategory
        firstSpokenCategory.fields[SC_FIELDS.CATEGORY] = [{ id: triviaGrabBagCategoryId }];
      }
    }

    toCreate = toCreate.concat(round1Categories);
  }
  if (numRounds >= 2) {
    toCreate = toCreate.concat(buildRoundRecords(showId, 2, countsR2, perType));
  }

  // Add tiebreaker as last category in final round
  if (addTiebreaker === "Yes" && numRounds > 0) {
    const finalRound = Math.max(1, numRounds);

    // Find the highest category order in the final round
    const finalRoundCategories = toCreate.filter(
      c => c.fields[SC_FIELDS.ROUND] === finalRound
    );
    const nextCategoryOrder = finalRoundCategories.length > 0
      ? Math.max(...finalRoundCategories.map(c => c.fields[SC_FIELDS.CATEGORY_ORDER])) + 1
      : 1;

    toCreate.push({
      fields: {
        [SC_FIELDS.SHOW]: [{ id: showId }],
        [SC_FIELDS.ROUND]: finalRound,
        [SC_FIELDS.QUESTION_TYPE]: { name: "Tiebreaker" },
        [SC_FIELDS.CATEGORY_ORDER]: nextCategoryOrder,
        [SC_FIELDS.EXPECTED_COUNT]: 1,
      }
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

// 9. Final summary
output.markdown("# 🎉 Complete!");
output.markdown(
  `Successfully created **${createdShowIds.length}** Shows with **${totalCategoriesCreated}** ShowCategories.`
);
output.markdown("\nYour Shows are ready to use!");
