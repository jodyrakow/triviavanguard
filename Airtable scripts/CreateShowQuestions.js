/***** Bulk-create ShowQuestions for ALL rounds in selected Show(s)
 *  + OPTIONAL post-step: prompt to create Questions based on "Create new" checkbox
 *****/

// ==== TABLE NAMES
const TABLES = {
  SHOWS: "Shows",
  SHOW_CATEGORIES: "ShowCategories",
  SHOW_QUESTIONS: "ShowQuestions",
  QUESTIONS: "Questions",
};

// ==== FIELD NAMES ON ShowCategories (source)
const SC = {
  SHOW: "Show", // link → Shows
  CATEGORY: "Category", // link → Categories
  SUPERSECRET: "Super secret", // checkbox
  QTYPE: "Question type", // single select: Visual | Spoken | Audio

  ROUND: "Round", // number
  CAT_ORDER: "Category order", // number
  EXPECTED: "Expected count", // number
  CREATE_NEW: "Create new", // checkbox
};

// ==== FIELD NAMES ON ShowQuestions (destination)
const SQ = {
  SHOW: "Show", // link → Shows
  SHOW_ID: "Show ID", // formula field with record ID
  SHOW_CATEGORY: "ShowCategory", // link → ShowCategories
  CATEGORY: "Category", // link → Categories
  SUPERSECRET: "Super secret", // checkbox
  QTYPE: "Question type", // single select
  ROUND: "Round", // number
  CAT_ORDER: "Category order", // number
  Q_ORDER: "Question order", // single line text
  SORT_ORDER: "Sort order", // number
};

// ==== FIELD NAMES ON Questions (we only create minimal rows)
const QN = {
  CATEGORY: "Categories", // ⚠️ your field name (multi-link → Categories)
  QTYPE: "Question type", // single select: Spoken | Audio | Visual
  SQ_BACKLINK: "ShowQuestions", // linked-record back to ShowQuestions
};

// ---------- Helpers
const nz = (n) => (typeof n === "number" && !isNaN(n) ? n : 0);

// spreadsheet-style letters: 1->A, 2->B, … 26->Z, 27->AA, etc
function numToLetters(n) {
  let s = "",
    x = n;
  while (x > 0) {
    x -= 1;
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26);
  }
  return s || "A";
}

try {
  const showsTbl = base.getTable(TABLES.SHOWS);
  const showCategoriesTbl = base.getTable(TABLES.SHOW_CATEGORIES);
  const showQuestionsTbl = base.getTable(TABLES.SHOW_QUESTIONS);
  const questionsTbl = base.getTable(TABLES.QUESTIONS);

  output.markdown("# 🎯 Bulk ShowQuestions Creator");

  // Load all Shows
  const allShows = await showsTbl.selectRecordsAsync({
    fields: ["Date"],
  });
  if (allShows.records.length === 0) {
    output.markdown("❌ No Shows found.");
    return;
  }

  // Filter out shows with dates in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  const futureShows = allShows.records.filter((show) => {
    const dateValue = show.getCellValue("Date");
    if (!dateValue) return true; // Include shows without dates
    const showDate = new Date(dateValue);
    return showDate >= today;
  });

  if (futureShows.length === 0) {
    output.markdown("❌ No future shows found.");
    return;
  }

  // Load all ShowQuestions to find shows that already have questions
  const sqQuery = await showQuestionsTbl.selectRecordsAsync({
    fields: [SQ.SHOW],
  });

  const showsWithQuestions = new Set();
  for (const sq of sqQuery.records) {
    const showLR = sq.getCellValue(SQ.SHOW) || [];
    if (showLR.length > 0) {
      showsWithQuestions.add(showLR[0].id);
    }
  }

  // Filter shows that don't have ShowQuestions yet
  const showsWithoutQuestions = futureShows.filter(
    (show) => !showsWithQuestions.has(show.id),
  );

  if (showsWithoutQuestions.length === 0) {
    output.markdown("ℹ️ All shows already have ShowQuestions created.");
    return;
  }

  output.markdown(
    `Found **${showsWithoutQuestions.length}** show(s) without ShowQuestions.`,
  );

  // Ask if user wants all shows or specific ones
  const selectionMode = await input.buttonsAsync(
    "Which shows do you want to process?",
    [
      { label: `✅ All ${showsWithoutQuestions.length} shows`, value: "ALL" },
      { label: "Select specific shows", value: "SPECIFIC" },
    ],
  );

  if (!selectionMode) {
    output.markdown("↪️ Cancelled.");
    return;
  }

  let selectedShows;

  if (selectionMode === "ALL") {
    selectedShows = showsWithoutQuestions;
  } else {
    // Let user select a specific show
    const showChoices = showsWithoutQuestions.map((show) => ({
      label: show.name || "(Unnamed Show)",
      value: show.id,
    }));

    const selectedShowId = await input.buttonsAsync(
      "Select a show to create ShowQuestions for:",
      showChoices,
    );

    if (!selectedShowId) {
      output.markdown("↪️ Cancelled or no show selected.");
      return;
    }

    selectedShows = showsWithoutQuestions.filter(
      (s) => s.id === selectedShowId,
    );
  }

  output.markdown(`\n✅ Selected: **${selectedShows.length}** show(s)\n`);

  // Create a Set of selected show IDs for filtering
  const selectedShowIds = new Set(selectedShows.map((s) => s.id));

  // Load ALL ShowCategories (needed fields only)
  const scFields = [
    SC.SHOW,
    SC.CATEGORY,
    SC.SUPERSECRET,
    SC.QTYPE,
    SC.ROUND,
    SC.CAT_ORDER,
    SC.EXPECTED,
    SC.CREATE_NEW,
  ];
  const scQuery = await showCategoriesTbl.selectRecordsAsync({
    fields: scFields,
  });

  // 👇 DEBUG: compare IDs
  output.markdown(
    `**DEBUG selectedShowIds:** ${[...selectedShowIds].join(", ")}`,
  );

  // Check first few ShowCategories to see what Show IDs they contain
  const first5 = scQuery.records.slice(0, 5);
  for (const r of first5) {
    const showLinks = r.getCellValue(SC.SHOW) || [];
    const raw = JSON.stringify(showLinks);
    output.markdown(`**SC record** "${r.name}" → Show field: \`${raw}\``);
  }

  // Filter to selected shows + positive Expected count
  const scForShows = scQuery.records
    .filter((r) =>
      (r.getCellValue(SC.SHOW) || []).some((x) => selectedShowIds.has(x?.id)),
    )
    .filter((r) => nz(r.getCellValue(SC.EXPECTED)) > 0);

  if (scForShows.length === 0) {
    output.markdown(
      "ℹ️ No categories with **Expected count > 0** for selected show(s).",
    );
    return;
  }

  output.markdown(`Found **${scForShows.length}** categories to process.\n`);

  // --- DEBUG BREAKDOWN
  const showNameById = new Map(
    selectedShows.map((s) => [s.id, s.name || s.id]),
  );

  const byShowRound = new Map();
  const keyCounts = new Map(); // composite key to spot duplicates

  for (const r of scForShows) {
    const showLinks = r.getCellValue(SC.SHOW) || [];
    const round = nz(r.getCellValue(SC.ROUND));
    const catOrder = nz(r.getCellValue(SC.CAT_ORDER));
    const qTypeName = r.getCellValue(SC.QTYPE)?.name || "";
    const catId = (r.getCellValue(SC.CATEGORY) || [])[0]?.id || "";

    for (const sh of showLinks) {
      if (!selectedShowIds.has(sh.id)) continue;

      const sr = `${showNameById.get(sh.id)} | Round ${round}`;
      byShowRound.set(sr, (byShowRound.get(sr) || 0) + 1);

      // “Duplicate” key definition: show+round+catOrder+qType+category
      const key = `${sh.id}|${round}|${catOrder}|${qTypeName}|${catId}`;
      keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
    }
  }

  output.markdown("### Debug: categories per show/round");
  for (const [k, v] of [...byShowRound.entries()].sort()) {
    output.markdown(`- ${k}: **${v}**`);
  }

  const dupes = [...keyCounts.entries()].filter(([, c]) => c > 1);
  if (dupes.length) {
    output.markdown("\n### Debug: duplicate ShowCategories keys (count > 1)");
    // show a few so the log doesn't explode
    for (const [k, c] of dupes.slice(0, 30)) {
      output.markdown(`- ${c}× ${k}`);
    }
    if (dupes.length > 30) output.markdown(`_(showing 30 of ${dupes.length})_`);
  } else {
    output.markdown(
      "\n### Debug: no duplicate keys detected by show+round+order+type+category",
    );
  }

  // Build creates for all selected shows
  const toCreate = []; // payloads for ShowQuestions.createRecordsAsync
  const needNewQuestions = []; // {catId, type, count}

  // Process each show separately
  for (const selectedShow of selectedShows) {
    const selectedShowId = selectedShow.id;

    // Filter categories for this specific show
    const scForShow = scForShows.filter((r) =>
      (r.getCellValue(SC.SHOW) || []).some((x) => x?.id === selectedShowId),
    );

    if (scForShow.length === 0) continue;

    // Group by Round for this show
    const byRound = new Map();
    for (const r of scForShow) {
      const round = nz(r.getCellValue(SC.ROUND));
      if (!byRound.has(round)) byRound.set(round, []);
      byRound.get(round).push(r);
    }

    // Process each round
    for (const [round, rows] of byRound.entries()) {
      // Order categories within round
      rows.sort((a, b) => {
        const ao = nz(a.getCellValue(SC.CAT_ORDER));
        const bo = nz(b.getCellValue(SC.CAT_ORDER));
        if (ao !== bo) return ao - bo;
        return (a.name || "").localeCompare(b.name || "");
      });

      // Starting counters for this round
      let nextLetterIndex = 1; // A=1
      let nextNumberIndex = 1; // 1..N
      let nextSort = 1; // 1..N

      for (const r of rows) {
        const catLR = r.getCellValue(SC.CATEGORY) || [];
        const categoryId = catLR[0]?.id || null;
        const superSecret = !!r.getCellValue(SC.SUPERSECRET);
        const qTypeCell = r.getCellValue(SC.QTYPE);
        const qTypeName = qTypeCell?.name || null;
        const catOrder = nz(r.getCellValue(SC.CAT_ORDER));
        const expected = nz(r.getCellValue(SC.EXPECTED));
        const createNew = !!r.getCellValue(SC.CREATE_NEW);

        if (
          !(
            qTypeName === "Visual" ||
            qTypeName === "Spoken" ||
            qTypeName === "Audio" ||
            qTypeName === "Tiebreaker"
          )
        )
          continue;

        if (createNew && expected > 0) {
          if (categoryId) {
            needNewQuestions.push({
              catId: categoryId,
              type: qTypeName,
              count: expected,
            });
          } else {
            output.markdown(
              `⚠️ "Create new" checked but Category is blank on ShowCategory "${r.name}". Skipping Question creation for this category.`,
            );
          }
        }

        for (let i = 0; i < expected; i++) {
          let qOrder;
          if (qTypeName === "Tiebreaker") {
            qOrder = "TB";
          } else if (qTypeName === "Visual") {
            qOrder = numToLetters(nextLetterIndex++);
          } else {
            qOrder = String(nextNumberIndex++);
          }

          toCreate.push({
            fields: {
              [SQ.SHOW]: [{ id: selectedShowId }],
              [SQ.SHOW_CATEGORY]: [{ id: r.id }],
              // Category is now a lookup field from ShowCategory, so don't set it directly
              [SQ.SUPERSECRET]: superSecret,
              [SQ.QTYPE]: { name: qTypeName },
              [SQ.ROUND]: round,
              [SQ.CAT_ORDER]: catOrder,
              [SQ.Q_ORDER]: qOrder,
              [SQ.SORT_ORDER]: nextSort++,
            },
          });
        }
      }
    }
  }

  if (toCreate.length === 0) {
    output.markdown(
      "ℹ️ Nothing to create (no valid categories or Expected count).",
    );
    return;
  }

  // Confirm before creating
  const confirm = await input.buttonsAsync(
    `Ready to create ${toCreate.length} ShowQuestions for ${selectedShows.length} show(s)?`,
    ["Yes, create them!", "Cancel"],
  );

  if (confirm !== "Yes, create them!") {
    output.markdown("↪️ Cancelled.");
    return;
  }

  output.markdown("\n## 🚀 Creating ShowQuestions...\n");

  // Create ShowQuestions in batches of 50
  const BATCH = 50;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    await showQuestionsTbl.createRecordsAsync(toCreate.slice(i, i + BATCH));
  }

  output.markdown(
    `✅ Created **${toCreate.length}** ShowQuestions for **${selectedShows.length}** show(s).\n`,
  );

  // ===== OPTIONAL POST-STEP: Create Questions based on "Create new" checkbox =====
  if (needNewQuestions.length === 0) {
    output.markdown("ℹ️ No categories have **Create new** checked.");
    output.markdown("\n# 🎉 Complete!");
    return;
  }

  const totalNewQuestions = needNewQuestions.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const choice = await input.buttonsAsync(
    `Create ${totalNewQuestions} new Questions for categories with "Create new" checked?`,
    ["Yes", "No"],
  );

  if (choice !== "Yes") {
    output.markdown("↪️ Skipped creating questions.");
    output.markdown("\n# 🎉 Complete!");
    return;
  }

  output.markdown("\n## 📝 Creating Questions...\n");

  // Create the requested Questions
  const toMake = [];
  const summary = [];

  for (const item of needNewQuestions) {
    for (let i = 0; i < item.count; i++) {
      toMake.push({
        fields: {
          [QN.CATEGORY]: [{ id: item.catId }],
          [QN.QTYPE]: { name: item.type },
        },
      });
    }
    summary.push({ type: item.type, made: item.count });
  }

  for (let i = 0; i < toMake.length; i += BATCH) {
    await questionsTbl.createRecordsAsync(toMake.slice(i, i + BATCH));
  }

  // Summarize by category & type
  const lines = [];
  for (const s of summary) {
    lines.push(`${s.made} ${s.type}`);
  }
  output.markdown(
    `✅ Created **${toMake.length}** Questions:\n\n- ` + lines.join("\n- "),
  );

  output.markdown("\n# 🎉 Complete!");
} catch (err) {
  output.markdown("❌ Error: " + (err?.message ?? String(err)));
}
