// src/QuestionsMode.js
import React, { useMemo } from "react";
import AudioPlayer from "react-h5-audio-player";
import { marked } from "marked";
import {
  Button,
  ButtonPrimary,
  overlayStyle,
  overlayImg,
  colors as theme,
  tokens,
} from "./styles";
import { buildCorrectCountMap, computeAutoEarned } from "./scoring/compute.js";
marked.setOptions({ breaks: true });
export default function QuestionsMode({
  showBundle = { rounds: [], teams: [] },
  selectedRoundId,
  groupedQuestions: groupedQuestionsProp,
  showDetails,
  setshowDetails,
  questionRefs,
  visibleImages,
  setVisibleImages,
  currentImageIndex,
  setCurrentImageIndex,
  visibleCategoryImages,
  setVisibleCategoryImages,
  getClosestQuestionKey,
  scoringMode = "pub",
  pubPoints = 10,
  poolPerQuestion = 100,
  poolContribution = 10,
  prizes = "",
  setPrizes,
  cachedState = null, // { teams, grid, entryOrder } from unified cache
  hostInfo: hostInfoProp = {
    host: "",
    cohost: "",
    location: "",
    totalGames: "",
    startTimesText: "",
    announcements: "",
  },
  setHostInfo: setHostInfoProp,
  editQuestionField,
  addTiebreaker,
  sendToDisplay,
  displayControlsOpen = false,
  refreshBundle,
}) {
  // Unified question editor modal state
  const [editingQuestion, setEditingQuestion] = React.useState(null);
  // { showQuestionId, questionText, notes, pronunciationGuide, answer }

  // Track if image overlay is active on display
  const [imageOverlayActive, setImageOverlayActive] = React.useState(false);

  // Track which question ID has inline visual images active on display
  const [inlineVisualQuestionId, setInlineVisualQuestionId] = React.useState(null);

  // Track current image index for category images
  const [currentCategoryImageIndex, setCurrentCategoryImageIndex] =
    React.useState({});

  // Add Tiebreaker modal state
  const [addingTiebreaker, setAddingTiebreaker] = React.useState(false);
  const [tbQuestion, setTbQuestion] = React.useState("");
  const [tbAnswer, setTbAnswer] = React.useState("");

  // under other React.useState(...) lines near the top:
  const [hostModalOpen, setHostModalOpen] = React.useState(false);
  // Use hostInfo from props (synced to Supabase), with local state for immediate UI updates
  const [hostInfo, setHostInfo] = React.useState(hostInfoProp);

  // Sync prop changes to local state (when other hosts update)
  React.useEffect(() => {
    setHostInfo(hostInfoProp);
  }, [hostInfoProp]);

  // show name (best-effort)
  const showName =
    (showBundle?.Show && showBundle?.Show?.Show) || showBundle?.showName || "";

  // Detects "YYYY-MM-DD Game N @ Venue" vs "YYYY-MM-DD @ Venue"
  const multiGameMeta = useMemo(() => {
    const s = (showName || "").trim();

    // 2025-09-23 Game 1 @ Venue
    const multiRe = /^\s*\d{4}-\d{2}-\d{2}\s+Game\s+(\d+)\s*@\s*(.+)\s*$/i;

    // 2025-09-23 @ Venue
    const singleRe = /^\s*\d{4}-\d{2}-\d{2}\s*@\s*(.+)\s*$/;

    let gameIndex = null;
    let venue = "";

    const m1 = s.match(multiRe);
    if (m1) {
      gameIndex = parseInt(m1[1], 10);
      venue = m1[2].trim();
      return { isMultiNight: true, gameIndex, venue };
    }

    const m2 = s.match(singleRe);
    if (m2) {
      venue = m2[1].trim();
    }
    return { isMultiNight: false, gameIndex, venue };
  }, [showName]);

  const inferredLocation = useMemo(
    () => multiGameMeta.venue || "",
    [multiGameMeta.venue]
  );

  // Auto-fill location from show name if empty
  React.useEffect(() => {
    if (inferredLocation && !hostInfo.location) {
      const next = { ...hostInfo, location: inferredLocation };
      setHostInfo(next);
      setHostInfoProp?.(next); // Save to Supabase
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inferredLocation]);

  // keep local textarea in sync with shared prizes
  const [prizesText, setPrizesText] = React.useState(
    Array.isArray(prizes) ? prizes.join("\n") : String(prizes || "")
  );
  React.useEffect(() => {
    setPrizesText(
      Array.isArray(prizes) ? prizes.join("\n") : String(prizes || "")
    );
  }, [prizes]);

  const prizeLines = React.useMemo(
    () =>
      (prizesText || "")
        .toString()
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [prizesText]
  );
  const [prizeCountInput, setPrizeCountInput] = React.useState(
    prizeLines.length
  );
  React.useEffect(() => {
    setPrizeCountInput(prizeLines.length);
  }, [prizeLines.length]);

  // Pre-populate announcements from Airtable config (if available and not already set)
  React.useEffect(() => {
    if (showBundle?.config?.announcements && !hostInfo.announcements) {
      const next = {
        ...hostInfo,
        announcements: showBundle.config.announcements,
      };
      setHostInfo(next);
      setHostInfoProp?.(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBundle?.config?.announcements]);

  const saveHostInfo = (next) => {
    setHostInfo(next); // Update local state immediately for UI responsiveness
    setHostInfoProp?.(next); // Save to Supabase (synced across hosts)
  };

  // ✅ make allRounds stable
  const allRounds = React.useMemo(
    () => showBundle?.rounds ?? [],
    [showBundle?.rounds]
  );

  // ✅ make displayRounds stable too
  const displayRounds = React.useMemo(() => {
    if (!selectedRoundId) return allRounds;
    const sel = Number(selectedRoundId);
    return allRounds.filter((r) => Number(r.round) === sel);
  }, [allRounds, selectedRoundId]);

  // --- Adapter: build groupedQuestions shape from bundle rounds ---
  const groupedQuestionsFromRounds = React.useMemo(() => {
    const grouped = {};
    for (const r of displayRounds || []) {
      const rNum = r?.round ?? 0;
      const categories = r?.categories || [];

      for (const cat of categories) {
        const catName = (cat?.categoryName || "").trim();
        const catDesc = (cat?.categoryDescription || "").trim();
        const catOrder = cat?.categoryOrder ?? 999;
        const key = `${rNum}::${catOrder}::${catName || "Uncategorized"}`;

        if (!grouped[key]) {
          grouped[key] = {
            categoryInfo: {
              "Category name": catName,
              "Category description": catDesc,
              "Category order": catOrder,
              "Super secret": !!cat?.superSecret,
              questionType: cat?.questionType || null, // ✅ Add questionType from category
              "Category image": Array.isArray(cat?.categoryImages)
                ? cat.categoryImages
                : [],
              // hold category-level audio
              "Category audio": Array.isArray(cat?.categoryAudio)
                ? cat.categoryAudio
                : [],
              // hold image carousel
              "Image carousel": Array.isArray(cat?.imageCarousel)
                ? cat.imageCarousel
                : [],
            },
            questions: {},
          };
        }

        const questions = cat?.questions || [];
        for (const q of questions) {
          grouped[key].questions[q.showQuestionId || q.id] = {
            "Show Question ID": q.showQuestionId || q.id,
            "Question ID": q?.questionId || q?.id,
            "Question order": q?.questionOrder,
            "Question text": q?.questionText || "",
            "Question notes": q?.questionNotes || "",
            "Question pronunciation guide": q?.questionPronunciationGuide || "",
            Answer: q?.answer || "",
            "Question type": q?.questionType || "",
            Images: Array.isArray(q?.questionImages) ? q.questionImages : [],
            Audio: Array.isArray(q?.questionAudio) ? q.questionAudio : [],
            _edited: q._edited || false, // flag if question has been edited
          };
        }
      }
    }
    return grouped;
  }, [displayRounds]);

  const isTB = (q) => {
    const questionType = String(
      q?.questionType || q?.["Question type"] || ""
    ).toLowerCase();
    const questionOrder = String(
      q?.questionOrder || q?.["Question order"] || ""
    ).toUpperCase();
    return questionType === "tiebreaker" || questionOrder === "TB";
  };

  // Prefer upstream if provided
  const groupedQuestions =
    groupedQuestionsProp && Object.keys(groupedQuestionsProp).length
      ? groupedQuestionsProp
      : groupedQuestionsFromRounds;

  // Check if current round has a tiebreaker
  const hasTiebreaker = React.useMemo(() => {
    const entries = Object.entries(groupedQuestions);
    for (const [, catData] of entries) {
      const hasT = Object.values(catData?.questions || {}).some((q) => isTB(q));
      if (hasT) return true;
    }
    return false;
  }, [groupedQuestions]);

  // Check if current round is the final round
  const isFinalRound = React.useMemo(() => {
    const rounds = showBundle?.rounds || [];
    if (rounds.length === 0) return false;
    const maxRound = Math.max(...rounds.map((r) => Number(r.round)));
    return Number(selectedRoundId) === maxRound;
  }, [showBundle, selectedRoundId]);

  // Build scoring config for utility functions
  const scoringConfig = React.useMemo(
    () => ({
      mode: scoringMode,
      pubPoints: Number(pubPoints || 0),
      poolPerQuestion: Number(poolPerQuestion || 0),
      poolContribution: Number(poolContribution || 0),
      teamCount: cachedState?.teams?.length || 0,
    }),
    [
      scoringMode,
      pubPoints,
      poolPerQuestion,
      poolContribution,
      cachedState?.teams?.length,
    ]
  );

  // Helper to calculate points per team for a question
  const calculatePointsPerTeam = React.useCallback(
    (correctCount, activeTeamCount) => {
      if (!correctCount || correctCount === 0) return null;

      // For pooled modes, use the utility to calculate points
      if (scoringMode === "pooled" || scoringMode === "pooled-adaptive") {
        // Create a mock correct cell to get the base points
        const mockCell = { isCorrect: true };

        // For adaptive mode, override teamCount with activeTeamCount
        const config =
          scoringMode === "pooled-adaptive"
            ? { ...scoringConfig, teamCount: activeTeamCount }
            : scoringConfig;

        return computeAutoEarned(mockCell, config, correctCount);
      }

      return null; // Pub mode doesn't show points per team
    },
    [scoringMode, scoringConfig]
  );

  // Calculate statistics for each question (teams correct, points per team, etc.)
  const statsByRoundAndQuestion = React.useMemo(() => {
    if (!cachedState?.teams || !cachedState?.grid) return {};

    const teams = cachedState.teams;
    const grid = cachedState.grid;

    const teamNames = new Map(
      teams.map((t) => [t.showTeamId, t.teamName || "(Unnamed team)"])
    );

    const result = {}; // { [roundId]: { [showQuestionId]: stats } }

    // Process each round
    const rounds = showBundle?.rounds || [];
    for (const round of rounds) {
      const roundId = String(round.round);

      // Flatten questions from categories
      const roundQuestions = [];
      for (const cat of round?.categories || []) {
        for (const q of cat?.questions || []) {
          roundQuestions.push({
            showQuestionId: q.showQuestionId || q.id,
            questionId: q.questionId,
            order: q.questionOrder,
          });
        }
      }

      // Adapt grid format for utility (utility uses bonusPoints/partialCredit)
      const adaptedGrid = {};
      for (const teamId in grid) {
        adaptedGrid[teamId] = {};
        for (const questionId in grid[teamId]) {
          const cell = grid[teamId][questionId];
          adaptedGrid[teamId][questionId] = {
            isCorrect: cell.isCorrect,
            bonusPoints: cell.questionBonus,
            partialCredit: cell.overridePoints,
          };
        }
      }

      // Use utility to get correct counts
      const correctCountMap = buildCorrectCountMap(
        teams,
        roundQuestions,
        adaptedGrid
      );

      // For adaptive pooled mode: count only teams active in THIS round
      let activeTeamCount = teams.length;
      if (scoringMode === "pooled-adaptive") {
        const activeTeams = new Set();
        for (const t of teams) {
          for (const q of roundQuestions) {
            if (grid[t.showTeamId]?.[q.showQuestionId]) {
              activeTeams.add(t.showTeamId);
              break;
            }
          }
        }
        activeTeamCount = activeTeams.size;
      }

      const totalTeams = teams.length;
      const roundStats = {};

      for (const q of roundQuestions) {
        const showQuestionId = q.showQuestionId;
        const correctCount = correctCountMap[showQuestionId] || 0;
        const correctTeams = [];

        // Build list of correct team names
        for (const t of teams) {
          const cell = grid[t.showTeamId]?.[showQuestionId];
          if (cell?.isCorrect) {
            const nm = teamNames.get(t.showTeamId);
            if (nm) correctTeams.push(nm);
          }
        }

        roundStats[showQuestionId] = {
          totalTeams,
          activeTeamCount,
          correctCount,
          correctTeams,
        };
      }

      result[roundId] = roundStats;
    }

    return result;
  }, [cachedState, showBundle, scoringMode]);

  const sortedGroupedEntries = React.useMemo(() => {
    const entries = Object.entries(groupedQuestions);
    const hasVisual = (cat) =>
      Object.values(cat?.questions || {}).some((q) =>
        (q?.["Question type"] || "").includes("Visual")
      );

    return entries.sort(([, a], [, b]) => {
      const av = hasVisual(a) ? 1 : 0;
      const bv = hasVisual(b) ? 1 : 0;
      if (av !== bv) return bv - av; // visuals first
      const ao = a?.categoryInfo?.["Category order"] ?? 999;
      const bo = b?.categoryInfo?.["Category order"] ?? 999;
      return ao - bo;
    });
  }, [groupedQuestions]);

  const categoryNumberByKey = React.useMemo(() => {
    const perRound = new Map(); // round -> running count
    const out = {};
    for (const [key, cat] of sortedGroupedEntries) {
      const m = /^(\d+)/.exec(String(key));
      const roundNum = m ? Number(m[1]) : 0;

      // Check the category's Question type field (stored at category level, not question level)
      const catQuestionType = String(
        cat?.categoryInfo?.questionType ||
          cat?.categoryInfo?.["Question type"] ||
          ""
      ).toLowerCase();

      // Visual categories don't get a number
      if (catQuestionType.includes("visual")) {
        out[key] = null;
        continue;
      }

      // Tiebreaker categories don't get a number
      if (catQuestionType.includes("tiebreaker")) {
        out[key] = null;
        continue;
      }

      // All other question types get numbered
      const next = (perRound.get(roundNum) || 0) + 1;
      perRound.set(roundNum, next);
      out[key] = next;
    }
    return out;
  }, [sortedGroupedEntries]);



  return (
    <>
      {/* Add Tiebreaker button (if applicable) */}
      {Object.keys(groupedQuestions).length > 0 &&
        !hasTiebreaker &&
        isFinalRound &&
        addTiebreaker && (
          <div
            style={{
              position: "fixed",
              left: "1rem",
              top: "1rem",
              zIndex: 1000,
              pointerEvents: "auto",
            }}
          >
            <ButtonPrimary
              onClick={() => setAddingTiebreaker(true)}
              title="Add a tiebreaker question to the final round"
            >
              + Add Tiebreaker
            </ButtonPrimary>
          </div>
        )}

      {sortedGroupedEntries.map(([categoryId, catData], index) => {
        const { categoryInfo, questions } = catData;
        const categoryName =
          categoryInfo?.["Category name"]?.trim() || "Uncategorized";
        const categoryDescription =
          categoryInfo?.["Category description"]?.trim() || "";
        const isSuperSecret = !!categoryInfo?.["Super secret"];

        // Category images
        const groupKey = `${categoryName}|||${categoryDescription}`;
        const catImages = categoryInfo?.["Category image"];
        const catImagesArr = Array.isArray(catImages)
          ? catImages
          : catImages
            ? [catImages]
            : [];

        // Category audio
        const catAudio = categoryInfo?.["Category audio"];
        const catAudioArr = Array.isArray(catAudio)
          ? catAudio
          : catAudio
            ? [catAudio]
            : [];

        // Image carousel
        const imageCarousel = categoryInfo?.["Image carousel"];
        const imageCarouselArr = Array.isArray(imageCarousel)
          ? imageCarousel
          : imageCarousel
            ? [imageCarousel]
            : [];

        const CategoryHeader = ({ secret, number }) => (
          <div style={{ backgroundColor: theme.dark, padding: 0 }}>
            <hr
              style={{
                border: "none",
                borderTop: `2px solid ${theme.accent}`,
                margin: "0 0 0.3rem 0",
              }}
            />
            <h2
              style={{
                color: theme.accent,
                fontFamily: tokens.font.display,
                fontSize: "1.85rem",
                margin: 0,
                textAlign: "left",
                letterSpacing: "0.015em",
                textIndent: "0.5rem",
              }}
              dangerouslySetInnerHTML={{
                __html: marked.parseInline(
                  `${Number.isFinite(number) ? `${number}. ` : ""}${categoryName || ""}`
                ),
              }}
            />
            <p
              style={{
                color: "#fff",
                fontStyle: "italic",
                fontFamily: tokens.font.flavor,
                margin: "0 0 0.5rem 0",
                textAlign: "left",
                paddingLeft: "1rem",
              }}
              dangerouslySetInnerHTML={{
                __html: marked.parseInline(categoryDescription || ""),
              }}
            />

            {/* Push category to display button */}
            {sendToDisplay && displayControlsOpen && (
              <div style={{ marginLeft: "1rem", marginBottom: "0.5rem" }}>
                <Button
                  onClick={() => {
                    sendToDisplay("category", {
                      categoryName: categoryName,
                      categoryDescription: categoryDescription,
                    });
                  }}
                  style={{
                    fontSize: tokens.font.size,
                    fontFamily: tokens.font.body,
                  }}
                  title="Push category name and description to display"
                >
                  Push category to display
                </Button>
              </div>
            )}

            {/* Category images (optional) */}
            {catImagesArr.length > 0 && (
              <div style={{ marginTop: "0.25rem", marginLeft: "1rem" }}>
                <Button
                  onClick={() =>
                    setVisibleCategoryImages((prev) => ({
                      ...prev,
                      [groupKey]: true,
                    }))
                  }
                  style={{
                    fontSize: tokens.font.size,
                    fontFamily: tokens.font.body,
                    marginBottom: "0.25rem",
                  }}
                >
                  Show category image{catImagesArr.length > 1 ? "s" : ""}
                </Button>
                {sendToDisplay && displayControlsOpen && (
                  <>
                    <Button
                      onClick={() => {
                        if (imageOverlayActive) {
                          // Close the image overlay
                          sendToDisplay("closeImageOverlay", null);
                          setImageOverlayActive(false);
                        } else {
                          // Send image to display
                          const idx = currentCategoryImageIndex[groupKey] || 0;
                          sendToDisplay("imageOverlay", {
                            images: catImagesArr.map((img) => ({
                              url: img.url,
                            })),
                            currentIndex: idx,
                          });
                          setImageOverlayActive(true);
                        }
                      }}
                      style={{
                        fontSize: tokens.font.size,
                        fontFamily: tokens.font.body,
                        marginBottom: "0.25rem",
                        marginLeft: "0.5rem",
                      }}
                      title={
                        imageOverlayActive
                          ? "Close image on display"
                          : "Push category image to display"
                      }
                    >
                      {imageOverlayActive
                        ? "Close image"
                        : "Push image to display"}
                    </Button>
                    {imageOverlayActive && catImagesArr.length > 1 && (
                      <div
                        style={{
                          display: "inline-block",
                          marginLeft: "0.5rem",
                        }}
                      >
                        <button
                          onClick={() => {
                            const currentIdx =
                              currentCategoryImageIndex[groupKey] || 0;
                            const newIdx =
                              (currentIdx - 1 + catImagesArr.length) %
                              catImagesArr.length;
                            setCurrentCategoryImageIndex((prev) => ({
                              ...prev,
                              [groupKey]: newIdx,
                            }));
                            sendToDisplay("imageOverlay", {
                              images: catImagesArr.map((img) => ({
                                url: img.url,
                              })),
                              currentIndex: newIdx,
                            });
                          }}
                          style={{
                            fontSize: "1rem",
                            padding: "0.25rem 0.5rem",
                            cursor: "pointer",
                            border: `1px solid ${theme.accent}`,
                            background: theme.white,
                            borderRadius: "0.25rem 0 0 0.25rem",
                          }}
                        >
                          ←
                        </button>
                        <button
                          onClick={() => {
                            const currentIdx =
                              currentCategoryImageIndex[groupKey] || 0;
                            const newIdx =
                              (currentIdx + 1) % catImagesArr.length;
                            setCurrentCategoryImageIndex((prev) => ({
                              ...prev,
                              [groupKey]: newIdx,
                            }));
                            sendToDisplay("imageOverlay", {
                              images: catImagesArr.map((img) => ({
                                url: img.url,
                              })),
                              currentIndex: newIdx,
                            });
                          }}
                          style={{
                            fontSize: "1rem",
                            padding: "0.25rem 0.5rem",
                            cursor: "pointer",
                            border: `1px solid ${theme.accent}`,
                            background: theme.white,
                            borderRadius: "0 0.25rem 0.25rem 0",
                            marginLeft: "-1px",
                          }}
                        >
                          →
                        </button>
                      </div>
                    )}
                  </>
                )}

                {visibleCategoryImages[groupKey] && (
                  <div
                    onClick={() =>
                      setVisibleCategoryImages((prev) => ({
                        ...prev,
                        [groupKey]: false,
                      }))
                    }
                    style={overlayStyle}
                  >
                    {catImagesArr.map((img, idx) => (
                      <img
                        key={idx}
                        src={img.url}
                        alt={img.filename || "Category image"}
                        style={overlayImg}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Image carousel button */}
            {imageCarouselArr.length > 0 &&
              sendToDisplay &&
              displayControlsOpen && (
                <div style={{ marginTop: "0.5rem", marginLeft: "1rem" }}>
                  <Button
                    onClick={() => {
                      if (imageOverlayActive) {
                        sendToDisplay("closeImageOverlay", null);
                        setImageOverlayActive(false);
                      } else {
                        sendToDisplay("imageOverlay", {
                          images: imageCarouselArr.map((img) => ({
                            url: img.url,
                          })),
                          currentIndex: 0,
                          autoCycle: true,
                        });
                        setImageOverlayActive(true);
                      }
                    }}
                    style={{
                      fontSize: tokens.font.size,
                      fontFamily: tokens.font.body,
                    }}
                    title={
                      imageOverlayActive
                        ? "Close image carousel on display"
                        : "Push image carousel to display (auto-cycles every 10 seconds)"
                    }
                  >
                    {imageOverlayActive
                      ? "Close image carousel"
                      : "Push image carousel to display"}
                  </Button>
                </div>
              )}

            {/* Category audio (optional) */}
            {catAudioArr.length > 0 && (
              <div
                style={{
                  marginTop: "0.5rem",
                  marginLeft: "1rem",
                  marginRight: "1rem",
                }}
              >
                {catAudioArr.map(
                  (audioObj, i) =>
                    audioObj?.url && (
                      <div
                        key={i}
                        className="audio-player-wrapper"
                        style={{
                          marginTop: "0.5rem",
                          maxWidth: "600px",
                          border: "1px solid #ccc",
                          borderRadius: "1.5rem",
                          overflow: "hidden",
                          backgroundColor: theme.bg,
                          boxShadow: "0 0 10px rgba(0, 0, 0, 0.15)",
                        }}
                      >
                        <AudioPlayer
                          src={audioObj.url}
                          showJumpControls={false}
                          layout="horizontal"
                          style={{
                            borderRadius: "1.5rem 1.5rem 0 0",
                            width: "100%",
                          }}
                        />
                        {showDetails && (
                          <div
                            style={{
                              textAlign: "center",
                              fontSize: ".9rem",
                              fontFamily: tokens.font.body,
                              padding: "0.4rem 0.6rem",
                              backgroundColor: theme.bg,
                              borderTop: "1px solid #ccc",
                            }}
                          >
                            🎵{" "}
                            {(audioObj.filename || "").replace(/\.[^/.]+$/, "")}
                          </div>
                        )}
                      </div>
                    )
                )}
              </div>
            )}

            <hr
              style={{
                border: "none",
                borderTop: `2px solid ${theme.accent}`,
                margin: "0.3rem 0 0 0",
              }}
            />
          </div>
        );

        return (
          <div
            key={categoryId}
            style={{ marginTop: index === 0 ? "1rem" : "4rem" }}
          >
            {isSuperSecret ? (
              <div
                style={{
                  borderStyle: "dashed",
                  borderWidth: "3px",
                  borderColor: theme.accent,
                  backgroundColor: "rgba(220,106,36,0.15)",
                  borderRadius: ".75rem",
                  padding: "0.5rem",
                }}
              >
                <CategoryHeader
                  secret
                  number={categoryNumberByKey[categoryId]}
                />
                {/* Secret category explainer box */}
                <div
                  style={{
                    margin: "0.5rem 1rem",
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "#fff",
                    border: `1px solid ${theme.accent}`,
                    borderRadius: "0.5rem",
                    fontFamily: tokens.font.body,
                    color: theme.dark,
                    fontSize: tokens.font.size,
                    textAlign: "center",
                  }}
                >
                  🔎{" "}
                  <em>
                    <strong>
                      This is the Super secret category of the week!
                    </strong>
                  </em>
                  <br />
                  <div style={{ marginTop: "0.25rem" }}>
                    If you follow us on Facebook, you'll see a post at the start
                    of each week letting you know where around central Minnesota
                    you can find us that week. That post also tells you the
                    super secret category for the week, so that you can study up
                    before the contest to have a leg up on the competition!
                  </div>
                </div>
              </div>
            ) : (
              <CategoryHeader number={categoryNumberByKey[categoryId]} />
            )}

            {Object.values(questions)
              .sort((a, b) => {
                // Always put the tiebreaker last
                if (isTB(a) && !isTB(b)) return 1;
                if (!isTB(a) && isTB(b)) return -1;

                const convert = (val) => {
                  if (typeof val === "string" && /^[A-Z]$/i.test(val)) {
                    return val.toUpperCase().charCodeAt(0) - 64; // A=1, B=2...
                  }
                  const num = parseInt(val, 10);
                  return isNaN(num) ? 999 : num;
                };
                return (
                  convert(a["Question order"]) - convert(b["Question order"])
                );
              })
              .map((q, qIndex) => {
                const questionKey =
                  q["Question ID"] || `${categoryName}-${q["Question order"]}`;
                if (!questionRefs.current[questionKey]) {
                  questionRefs.current[questionKey] = React.createRef();
                }

                return (
                  <React.Fragment key={q["Question ID"] || q["Question order"]}>
                    <div ref={questionRefs.current[questionKey]}>
                      {/* QUESTION TEXT */}
                      <div
                        style={{
                          fontFamily: tokens.font.body,
                          fontSize: "1.125rem",
                          marginTop: "1.75rem",
                          marginBottom: 0,
                        }}
                      >
                        <strong>
                          {isTB(q) ? (
                            <>
                              <span
                                aria-hidden="true"
                                style={{
                                  display: "inline-block",
                                  transform: "translateY(-2px)",
                                }}
                              >
                                🎯
                              </span>{" "}
                              Question:
                            </>
                          ) : (
                            <>Question {q["Question order"]}:</>
                          )}
                        </strong>
                        {sendToDisplay && displayControlsOpen && (
                          <Button
                            onClick={() => {
                              const isVisual = (q?.["Question type"] || "").toLowerCase().includes("visual");
                              const hasImages = Array.isArray(q.Images) && q.Images.length > 0;

                              // For Visual questions with images, send as inline images
                              if (isVisual && hasImages) {
                                sendToDisplay("question", {
                                  questionNumber: q["Question order"],
                                  questionText: q["Question text"] || "",
                                  categoryName: categoryName,
                                  inlineImages: q.Images.map((img) => ({ url: img.url })),
                                  currentInlineImageIndex: currentImageIndex[q["Question ID"]] || 0,
                                });
                                setInlineVisualQuestionId(q["Question ID"]);
                              } else {
                                // Regular questions
                                sendToDisplay("question", {
                                  questionNumber: q["Question order"],
                                  questionText: q["Question text"] || "",
                                  categoryName: categoryName,
                                  images: [],
                                });
                                setInlineVisualQuestionId(null);
                              }
                            }}
                            style={{
                              marginLeft: ".5rem",
                              fontSize: ".75rem",
                              padding: ".25rem .5rem",
                              verticalAlign: "middle",
                            }}
                            title="Push this question to the display"
                          >
                            Push to display
                          </Button>
                        )}
                        <br />
                        <div
                          style={{
                            display: "block",
                            paddingLeft: "1.5rem",
                            paddingTop: "0.25rem",
                            position: "relative",
                          }}
                        >
                          {editQuestionField && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingQuestion({
                                  showQuestionId: q["Show Question ID"],
                                  questionText: q["Question text"] || "",
                                  questionNotes: q["Question notes"] || "",
                                  questionPronunciationGuide:
                                    q["Question pronunciation guide"] || "",
                                  answer: q["Answer"] || "",
                                });
                              }}
                              style={{
                                position: "absolute",
                                left: "0.1rem",
                                top: "0.3rem",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "0",
                                fontSize: "0.9rem",
                                color: q._edited ? theme.accent : "#8B9DC3",
                                opacity: q._edited ? 1 : 0.4,
                                transition: "opacity 0.2s, color 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = "1";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = q._edited
                                  ? "1"
                                  : "0.7";
                              }}
                              title={
                                q._edited
                                  ? "Edit this question (edited)"
                                  : "Edit this question"
                              }
                            >
                              ✏️
                            </button>
                          )}
                          <span
                            dangerouslySetInnerHTML={{
                              __html: marked.parseInline(
                                q["Question text"] || ""
                              ),
                            }}
                          />
                        </div>
                      </div>

                      {/* NOTES */}
                      {q["Question notes"]?.trim() && showDetails && (
                        <p
                          style={{
                            fontFamily: tokens.font.flavor,
                            fontSize: "1rem",
                            fontStyle: "italic",
                            display: "block",
                            paddingLeft: "1.5rem",
                            paddingTop: "0.25rem",
                            marginTop: 0,
                            marginBottom: "0.01rem",
                          }}
                        >
                          <span
                            dangerouslySetInnerHTML={{
                              __html: marked.parseInline(
                                `<span style="font-size:1em; position: relative; top: 1px; margin-right:-1px;">💭</span> ${q["Question notes"]}`
                              ),
                            }}
                          />
                        </p>
                      )}

                      {/* PRONUNCIATION GUIDE */}
                      {q["Question pronunciation guide"]?.trim() &&
                        showDetails && (
                          <p
                            style={{
                              fontFamily: tokens.font.flavor,
                              fontSize: "1rem",
                              fontStyle: "italic",
                              display: "block",
                              paddingLeft: "1.5rem",
                              paddingTop: "0.25rem",
                              marginTop: 0,
                              marginBottom: "0.01rem",
                            }}
                          >
                            <span
                              dangerouslySetInnerHTML={{
                                __html: marked.parseInline(
                                  `<span style="font-size:1em; position: relative; top: 1px; margin-right:-1px;">🗣️</span> ${q["Question pronunciation guide"]}`
                                ),
                              }}
                            />
                          </p>
                        )}

                      {/* IMAGE POPUP TOGGLE */}
                      {Array.isArray(q.Images) && q.Images.length > 0 && (
                        <div style={{ marginTop: "0.25rem" }}>
                          <Button
                            onClick={() => {
                              setVisibleImages((prev) => ({
                                ...prev,
                                [q["Question ID"]]: true,
                              }));
                              setCurrentImageIndex((prev) => ({
                                ...prev,
                                [q["Question ID"]]: 0,
                              }));
                            }}
                            style={{
                              marginBottom: "0.25rem",
                              marginLeft: "1.5rem",
                            }}
                          >
                            Show image
                          </Button>
                          {sendToDisplay && displayControlsOpen && (
                            <>
                              <Button
                                onClick={() => {
                                  if (imageOverlayActive) {
                                    // Close the image overlay
                                    sendToDisplay("closeImageOverlay", null);
                                    setImageOverlayActive(false);
                                  } else {
                                    // Send image to display
                                    const idx =
                                      currentImageIndex[q["Question ID"]] || 0;
                                    sendToDisplay("imageOverlay", {
                                      images: q.Images.map((img) => ({
                                        url: img.url,
                                      })),
                                      currentIndex: idx,
                                    });
                                    setImageOverlayActive(true);
                                  }
                                }}
                                style={{
                                  marginBottom: "0.25rem",
                                  marginLeft: "0.5rem",
                                }}
                                title={
                                  imageOverlayActive
                                    ? "Close image on display"
                                    : "Push image to display"
                                }
                              >
                                {imageOverlayActive
                                  ? "Close image"
                                  : "Push image to display"}
                              </Button>
                              {((imageOverlayActive || inlineVisualQuestionId === q["Question ID"]) && q.Images.length > 1) && (
                                <div
                                  style={{
                                    display: "inline-block",
                                    marginLeft: "0.5rem",
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      const currentIdx =
                                        currentImageIndex[q["Question ID"]] ||
                                        0;
                                      const newIdx =
                                        (currentIdx - 1 + q.Images.length) %
                                        q.Images.length;
                                      setCurrentImageIndex({
                                        ...currentImageIndex,
                                        [q["Question ID"]]: newIdx,
                                      });

                                      // Update overlay or inline image depending on which is active
                                      if (imageOverlayActive) {
                                        sendToDisplay("imageOverlay", {
                                          images: q.Images.map((img) => ({
                                            url: img.url,
                                          })),
                                          currentIndex: newIdx,
                                        });
                                      } else if (inlineVisualQuestionId === q["Question ID"]) {
                                        sendToDisplay("updateInlineImageIndex", {
                                          currentIndex: newIdx,
                                        });
                                      }
                                    }}
                                    style={{
                                      fontSize: "1rem",
                                      padding: "0.25rem 0.5rem",
                                      cursor: "pointer",
                                      border: `1px solid ${theme.accent}`,
                                      background: theme.white,
                                      borderRadius: "0.25rem 0 0 0.25rem",
                                    }}
                                  >
                                    ←
                                  </button>
                                  <button
                                    onClick={() => {
                                      const currentIdx =
                                        currentImageIndex[q["Question ID"]] ||
                                        0;
                                      const newIdx =
                                        (currentIdx + 1) % q.Images.length;
                                      setCurrentImageIndex({
                                        ...currentImageIndex,
                                        [q["Question ID"]]: newIdx,
                                      });

                                      // Update overlay or inline image depending on which is active
                                      if (imageOverlayActive) {
                                        sendToDisplay("imageOverlay", {
                                          images: q.Images.map((img) => ({
                                            url: img.url,
                                          })),
                                          currentIndex: newIdx,
                                        });
                                      } else if (inlineVisualQuestionId === q["Question ID"]) {
                                        sendToDisplay("updateInlineImageIndex", {
                                          currentIndex: newIdx,
                                        });
                                      }
                                    }}
                                    style={{
                                      fontSize: "1rem",
                                      padding: "0.25rem 0.5rem",
                                      cursor: "pointer",
                                      border: `1px solid ${theme.accent}`,
                                      background: theme.white,
                                      borderRadius: "0 0.25rem 0.25rem 0",
                                      marginLeft: "-1px",
                                    }}
                                  >
                                    →
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                          {visibleImages[q["Question ID"]] && (
                            <div
                              onClick={() =>
                                setVisibleImages((prev) => ({
                                  ...prev,
                                  [q["Question ID"]]: false,
                                }))
                              }
                              style={overlayStyle}
                            >
                              <img
                                src={
                                  q.Images[
                                    currentImageIndex[q["Question ID"]] || 0
                                  ]?.url
                                }
                                alt={
                                  q.Images[
                                    currentImageIndex[q["Question ID"]] || 0
                                  ]?.Name || "Attached image"
                                }
                                style={overlayImg}
                              />

                              {q.Images.length > 1 && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "1rem",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    fontFamily: tokens.font.body,
                                  }}
                                >
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCurrentImageIndex((prev) => {
                                        const curr =
                                          prev[q["Question ID"]] || 0;
                                        return {
                                          ...prev,
                                          [q["Question ID"]]:
                                            (curr - 1 + q.Images.length) %
                                            q.Images.length,
                                        };
                                      });
                                    }}
                                  >
                                    Previous
                                  </Button>

                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCurrentImageIndex((prev) => {
                                        const curr =
                                          prev[q["Question ID"]] || 0;
                                        return {
                                          ...prev,
                                          [q["Question ID"]]:
                                            (curr + 1) % q.Images.length,
                                        };
                                      });
                                    }}
                                  >
                                    Next
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* QUESTION-LEVEL AUDIO */}
                      {Array.isArray(q.Audio) && q.Audio.length > 0 && (
                        <div
                          style={{
                            marginTop: "0.5rem",
                            marginLeft: "1.5rem",
                            marginRight: "1.5rem",
                          }}
                        >
                          {q.Audio.map(
                            (audioObj, index) =>
                              audioObj.url && (
                                <div
                                  key={index}
                                  className="audio-player-wrapper"
                                  style={{
                                    marginTop: "0.5rem",
                                    maxWidth: "600px",
                                    border: "1px solid #ccc",
                                    borderRadius: "1.5rem",
                                    overflow: "hidden",
                                    backgroundColor: theme.bg,
                                    boxShadow: "0 0 10px rgba(0, 0, 0, 0.15)",
                                  }}
                                >
                                  <AudioPlayer
                                    src={audioObj.url}
                                    showJumpControls={false}
                                    layout="horizontal"
                                    style={{
                                      borderRadius: "1.5rem 1.5rem 0 0",
                                      width: "100%",
                                    }}
                                  />
                                  {showDetails && (
                                    <div
                                      style={{
                                        textAlign: "center",
                                        fontSize: ".9rem",
                                        fontFamily: tokens.font.body,
                                        padding: "0.4rem 0.6rem",
                                        backgroundColor: theme.bg,
                                        borderTop: "1px solid #ccc",
                                      }}
                                    >
                                      🎵{" "}
                                      {(audioObj.filename || "").replace(
                                        /\.[^/.]+$/,
                                        ""
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                          )}
                        </div>
                      )}

                      {/* ANSWER */}
                      {showDetails && (
                        <p
                          style={{
                            fontFamily: tokens.font.body,
                            fontSize: "1.125rem",
                            marginTop: "0.5rem",
                            marginBottom: "1rem",
                            marginLeft: "1.5rem",
                            marginRight: "1.5rem",
                          }}
                        >
                          <span
                            dangerouslySetInnerHTML={{
                              __html: marked.parseInline(
                                `<span style="font-size:0.7em; position: relative; top: -1px;">🟢</span> **Answer:** ${q["Answer"]}`
                              ),
                            }}
                          />
                          {sendToDisplay &&
                            displayControlsOpen &&
                            (() => {
                              // Calculate stats for this question (same logic as STATS PILL below)
                              const m = /^(\d+)/.exec(String(categoryId));
                              const roundNum = m ? Number(m[1]) : 0;
                              const qStats =
                                statsByRoundAndQuestion[roundNum]?.[
                                  q["Show Question ID"]
                                ];

                              // Calculate points for pooled scoring modes
                              const qPointsPerTeam = qStats
                                ? calculatePointsPerTeam(
                                    qStats.correctCount,
                                    qStats.activeTeamCount
                                  )
                                : null;

                              const isVisual = (q?.["Question type"] || "").toLowerCase().includes("visual");
                              const hasImages = Array.isArray(q.Images) && q.Images.length > 0;

                              return (
                                <>
                                  <Button
                                    onClick={() => {
                                      // Push answer only (no stats) - explicitly set stats to undefined to clear any old values
                                      console.log(
                                        "[QuestionsMode] Question object:",
                                        q
                                      );
                                      const payload = {
                                        questionNumber: q["Question order"],
                                        questionText: q["Question text"] || "",
                                        categoryName: categoryName,
                                        images: [],
                                        answer: q["Answer"] || "",
                                        pointsPerTeam: null,
                                        correctCount: null,
                                        totalTeams: null,
                                      };

                                      // Preserve inline images for Visual questions
                                      if (isVisual && hasImages) {
                                        payload.inlineImages = q.Images.map((img) => ({ url: img.url }));
                                        payload.currentInlineImageIndex = currentImageIndex[q["Question ID"]] || 0;
                                        setInlineVisualQuestionId(q["Question ID"]);
                                      } else {
                                        setInlineVisualQuestionId(null);
                                      }

                                      console.log(
                                        "[QuestionsMode] Push answer - sending:",
                                        payload
                                      );
                                      sendToDisplay("question", payload);
                                    }}
                                    style={{
                                      marginLeft: ".5rem",
                                      fontSize: ".75rem",
                                      padding: ".25rem .5rem",
                                      verticalAlign: "middle",
                                    }}
                                    title="Push answer to display (no statistics)"
                                  >
                                    Push answer
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      // Push answer WITH statistics
                                      const payload = {
                                        questionNumber: q["Question order"],
                                        questionText: q["Question text"] || "",
                                        categoryName: categoryName,
                                        images: [],
                                        answer: q["Answer"] || "",
                                        pointsPerTeam: qPointsPerTeam,
                                        correctCount:
                                          qStats?.correctCount ?? null,
                                        totalTeams: qStats?.totalTeams ?? null,
                                      };

                                      // Preserve inline images for Visual questions
                                      if (isVisual && hasImages) {
                                        payload.inlineImages = q.Images.map((img) => ({ url: img.url }));
                                        payload.currentInlineImageIndex = currentImageIndex[q["Question ID"]] || 0;
                                        setInlineVisualQuestionId(q["Question ID"]);
                                      } else {
                                        setInlineVisualQuestionId(null);
                                      }

                                      console.log(
                                        "[QuestionsMode] Push stats - sending:",
                                        payload
                                      );
                                      sendToDisplay("question", payload);
                                    }}
                                    style={{
                                      marginLeft: ".5rem",
                                      fontSize: ".75rem",
                                      padding: ".25rem .5rem",
                                      verticalAlign: "middle",
                                    }}
                                    title="Push answer with statistics to display"
                                  >
                                    Push stats
                                  </Button>
                                </>
                              );
                            })()}
                        </p>
                      )}

                      {/* STATS PILL (teams correct, points) */}
                      {(() => {
                        // Extract round number from categoryId
                        const m = /^(\d+)/.exec(String(categoryId));
                        const roundNum = m ? Number(m[1]) : 0;
                        const qStats =
                          statsByRoundAndQuestion[roundNum]?.[
                            q["Show Question ID"]
                          ];

                        // Calculate points for pooled scoring modes (not pub)
                        const qPointsPerTeam = qStats
                          ? calculatePointsPerTeam(
                              qStats.correctCount,
                              qStats.activeTeamCount
                            )
                          : null;

                        const isTiebreaker =
                          (q["Question type"] || "") === "Tiebreaker";

                        if (!qStats || isTiebreaker) return null;

                        return (
                          <div
                            style={{
                              marginLeft: tokens.spacing.lg,
                              marginBottom: ".75rem",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.2rem 0.75rem",
                                borderRadius: tokens.radius.pill,
                                background: theme.white,
                                fontSize: "1.05rem",
                                border: `${tokens.borders.medium} ${theme.accent}`,
                                fontFamily: tokens.font.body,
                              }}
                            >
                              {qStats.correctCount} / {qStats.totalTeams} teams
                              correct
                            </span>

                            {qPointsPerTeam !== null && (
                              <span
                                style={{
                                  marginLeft: ".6rem",
                                  fontSize: "1rem",
                                }}
                              >
                                <span
                                  style={{
                                    color: theme.accent,
                                    fontWeight: 700,
                                  }}
                                >
                                  {qPointsPerTeam}
                                </span>{" "}
                                points per team
                              </span>
                            )}

                            {qStats.correctCount === 1 &&
                              qStats.correctTeams[0] && (
                                <span style={{ marginLeft: ".6rem" }}>
                                  <span
                                    style={{
                                      color: theme.accent,
                                      fontWeight: 700,
                                    }}
                                  >
                                    SOLO:
                                  </span>{" "}
                                  <strong>{qStats.correctTeams[0]}</strong>
                                </span>
                              )}
                          </div>
                        );
                      })()}
                    </div>

                    {qIndex < Object.values(questions).length - 1 && (
                      <hr className="question-divider" />
                    )}
                  </React.Fragment>
                );
              })}
          </div>
        );
      })}

      {hostModalOpen && (
        <div
          onMouseDown={() => setHostModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(43,57,74,.65)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "min(92vw, 560px)",
              background: "#fff",
              borderRadius: ".6rem",
              border: `1px solid ${theme.accent}`,
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,.25)",
              fontFamily: tokens.font.body,
            }}
          >
            <div
              style={{
                background: theme.dark,
                color: "#fff",
                padding: ".6rem .8rem",
                borderBottom: `2px solid ${theme.accent}`,
                fontFamily: tokens.font.display,
                fontSize: "1.25rem",
                letterSpacing: ".01em",
              }}
            >
              Show details
            </div>

            <div style={{ padding: ".9rem .9rem 0" }}>
              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4 }}>Host name</div>
                <input
                  type="text"
                  value={hostInfo.host}
                  onChange={(e) =>
                    saveHostInfo({ ...hostInfo, host: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: ".45rem .55rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                  }}
                />
              </label>

              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4 }}>Co-host name</div>
                <input
                  type="text"
                  value={hostInfo.cohost}
                  onChange={(e) =>
                    saveHostInfo({ ...hostInfo, cohost: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: ".45rem .55rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                  }}
                />
              </label>

              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4 }}>Location</div>
                <input
                  type="text"
                  value={hostInfo.location}
                  onChange={(e) =>
                    saveHostInfo({ ...hostInfo, location: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: ".45rem .55rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                  }}
                />
              </label>
              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4 }}>Total games tonight</div>
                <input
                  type="number"
                  min={1}
                  value={hostInfo.totalGames}
                  onChange={(e) =>
                    saveHostInfo({ ...hostInfo, totalGames: e.target.value })
                  }
                  style={{
                    width: "120px",
                    padding: ".45rem .55rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                  }}
                />
                <div
                  style={{
                    fontSize: ".85rem",
                    opacity: 0.8,
                    marginTop: ".25rem",
                  }}
                >
                  (Leave blank if single show)
                </div>
              </label>

              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4 }}>
                  Start times (comma- or line-separated)
                </div>
                <textarea
                  value={hostInfo.startTimesText}
                  onChange={(e) =>
                    saveHostInfo({
                      ...hostInfo,
                      startTimesText: e.target.value,
                    })
                  }
                  placeholder={`7:00, 8:30`}
                  rows={2}
                  style={{
                    width: "100%",
                    padding: ".55rem .65rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                    resize: "vertical",
                    fontFamily: tokens.font.body,
                  }}
                />
              </label>

              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4 }}>
                  Beginning-of-show announcements (optional)
                </div>
                <textarea
                  value={hostInfo.announcements}
                  onChange={(e) =>
                    saveHostInfo({
                      ...hostInfo,
                      announcements: e.target.value,
                    })
                  }
                  placeholder="Tonight's specials, birthdays, upcoming events, etc."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: ".55rem .65rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                    resize: "vertical",
                    fontFamily: tokens.font.body,
                  }}
                />
              </label>

              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4 }}>Number of prizes</div>
                <input
                  type="number"
                  min={0}
                  value={prizeCountInput}
                  onChange={(e) =>
                    setPrizeCountInput(Number(e.target.value || 0))
                  }
                  style={{
                    width: "120px",
                    padding: ".45rem .55rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                  }}
                />
                <div
                  style={{
                    fontSize: ".85rem",
                    opacity: 0.8,
                    marginTop: ".25rem",
                  }}
                >
                  (Optional – for your reference; prize lines below control
                  what’s shown)
                </div>
              </label>

              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4 }}>
                  Prize details (one per line)
                </div>
                <textarea
                  value={prizesText}
                  onChange={(e) => setPrizesText(e.target.value)}
                  placeholder={`$100 bar tab\nSwag basket\nFree pizza`}
                  rows={4}
                  style={{
                    width: "100%",
                    padding: ".55rem .65rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                    resize: "vertical",
                    fontFamily: tokens.font.body,
                  }}
                />
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: ".5rem",
                justifyContent: "flex-end",
                padding: ".8rem .9rem .9rem",
                borderTop: "1px solid #eee",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  // Normalize: newline-separated string → array or string, your shared state stores string
                  // We’ll store as string (joined by newlines).
                  const normalized = (prizesText || "")
                    .split(/\r?\n/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .join("\n");
                  setPrizes?.(normalized);
                  setHostModalOpen(false);
                }}
                style={{
                  padding: ".5rem .75rem",
                  border: `1px solid ${theme.accent}`,
                  background: theme.accent,
                  color: "#fff",
                  borderRadius: ".35rem",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setHostModalOpen(false)}
                style={{
                  padding: ".5rem .75rem",
                  border: "1px solid #ccc",
                  background: "#f7f7f7",
                  borderRadius: ".35rem",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Question Editor Modal */}
      {editingQuestion && (
        <div
          onClick={() => setEditingQuestion(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(43,57,74,.65)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(92vw, 720px)",
              background: "#fff",
              borderRadius: ".6rem",
              border: `1px solid ${theme.accent}`,
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,.25)",
              fontFamily: tokens.font.body,
            }}
          >
            {/* Header */}
            <div
              style={{
                background: theme.dark,
                color: "#fff",
                padding: ".6rem .8rem",
                borderBottom: `2px solid ${theme.accent}`,
                fontFamily: tokens.font.display,
                fontSize: "1.25rem",
                letterSpacing: ".01em",
              }}
            >
              Edit Question
            </div>

            {/* Body */}
            <div style={{ padding: ".9rem .9rem .2rem" }}>
              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>
                  Question text
                </div>
                <textarea
                  value={editingQuestion.questionText ?? ""}
                  onChange={(e) =>
                    setEditingQuestion((prev) => ({
                      ...prev,
                      questionText: e.target.value,
                    }))
                  }
                  rows={3}
                  style={{
                    width: "100%",
                    padding: ".55rem .65rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                    resize: "vertical",
                    fontFamily: tokens.font.body,
                    fontSize: "1rem",
                  }}
                />
              </label>

              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>
                  Notes (optional)
                </div>
                <textarea
                  value={editingQuestion.questionNotes ?? ""}
                  onChange={(e) =>
                    setEditingQuestion((prev) => ({
                      ...prev,
                      questionNotes: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Optional context or additional info..."
                  style={{
                    width: "100%",
                    padding: ".55rem .65rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                    resize: "vertical",
                    fontFamily: tokens.font.body,
                    fontSize: "1rem",
                    fontStyle: "italic",
                  }}
                />
              </label>

              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>
                  Pronunciation guide (optional)
                </div>
                <textarea
                  value={editingQuestion.pronunciationGuide || ""}
                  onChange={(e) =>
                    setEditingQuestion((prev) => ({
                      ...prev,
                      pronunciationGuide: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Optional: how to say tricky names/words..."
                  style={{
                    width: "100%",
                    padding: ".55rem .65rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                    resize: "vertical",
                    fontFamily: tokens.font.body,
                    fontSize: "1rem",
                    fontStyle: "italic",
                  }}
                />
              </label>

              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>Answer</div>
                <textarea
                  value={editingQuestion.answer ?? ""}
                  onChange={(e) =>
                    setEditingQuestion((prev) => ({
                      ...prev,
                      answer: e.target.value,
                    }))
                  }
                  rows={2}
                  style={{
                    width: "100%",
                    padding: ".55rem .65rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                    resize: "vertical",
                    fontFamily: tokens.font.body,
                    fontSize: "1rem",
                  }}
                />
              </label>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                gap: ".5rem",
                justifyContent: "flex-end",
                padding: ".8rem .9rem .9rem",
                borderTop: "1px solid #eee",
              }}
            >
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                style={{
                  padding: ".5rem .75rem",
                  border: "1px solid #ccc",
                  background: "#f7f7f7",
                  borderRadius: ".35rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editQuestionField) {
                    const safeTrim = (v) => String(v ?? "").trim();

                    editQuestionField(
                      editingQuestion.showQuestionId,
                      "question",
                      safeTrim(editingQuestion.questionText)
                    );
                    editQuestionField(
                      editingQuestion.showQuestionId,
                      "notes",
                      safeTrim(editingQuestion.questionNotes)
                    );
                    editQuestionField(
                      editingQuestion.showQuestionId,
                      "answer",
                      safeTrim(editingQuestion.answer)
                    );
                    editQuestionField(
                      editingQuestion.showQuestionId,
                      "pronunciationGuide",
                      safeTrim(editingQuestion.pronunciationGuide)
                    );
                  }
                  setEditingQuestion(null);
                }}
                style={{
                  padding: ".5rem .75rem",
                  border: `1px solid ${theme.accent}`,
                  background: theme.accent,
                  color: "#fff",
                  borderRadius: ".35rem",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tiebreaker Modal */}
      {addingTiebreaker && (
        <div
          onClick={() => setAddingTiebreaker(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(43,57,74,.65)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(92vw, 620px)",
              background: "#fff",
              borderRadius: ".6rem",
              border: `1px solid ${theme.accent}`,
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,.25)",
              fontFamily: tokens.font.body,
            }}
          >
            {/* Header */}
            <div
              style={{
                background: theme.dark,
                color: "#fff",
                padding: ".6rem .8rem",
                borderBottom: `2px solid ${theme.accent}`,
                fontFamily: tokens.font.display,
                fontSize: "1.25rem",
                letterSpacing: ".01em",
              }}
            >
              Add Tiebreaker Question
            </div>

            {/* Body */}
            <div style={{ padding: ".9rem .9rem .2rem" }}>
              <div
                style={{
                  marginBottom: ".75rem",
                  fontSize: ".95rem",
                  opacity: 0.9,
                }}
              >
                Add a tiebreaker question for this round. Teams will guess a
                number, and the closest answer wins if there's a tie.
              </div>

              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>
                  Tiebreaker Question
                </div>
                <textarea
                  autoFocus
                  value={tbQuestion}
                  onChange={(e) => setTbQuestion(e.target.value)}
                  placeholder="e.g., How many feet tall is the Statue of Liberty?"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: ".55rem .65rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                    resize: "vertical",
                    fontFamily: tokens.font.body,
                    fontSize: "1rem",
                  }}
                />
              </label>

              <label style={{ display: "block", marginBottom: ".6rem" }}>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>
                  Answer (number)
                </div>
                <input
                  type="text"
                  value={tbAnswer}
                  onChange={(e) => setTbAnswer(e.target.value)}
                  placeholder="e.g., 305"
                  style={{
                    width: "200px",
                    padding: ".45rem .55rem",
                    border: "1px solid #ccc",
                    borderRadius: ".35rem",
                    fontFamily: tokens.font.body,
                    fontSize: "1rem",
                  }}
                />
              </label>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                gap: ".5rem",
                justifyContent: "flex-end",
                padding: ".8rem .9rem .9rem",
                borderTop: "1px solid #eee",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setAddingTiebreaker(false);
                  setTbQuestion("");
                  setTbAnswer("");
                }}
                style={{
                  padding: ".5rem .75rem",
                  border: "1px solid #ccc",
                  background: "#f7f7f7",
                  borderRadius: ".35rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!tbQuestion.trim()) {
                    alert("Please enter a tiebreaker question.");
                    return;
                  }
                  if (!tbAnswer.trim()) {
                    alert("Please enter the answer.");
                    return;
                  }
                  addTiebreaker(tbQuestion.trim(), tbAnswer.trim());
                  setAddingTiebreaker(false);
                  setTbQuestion("");
                  setTbAnswer("");
                }}
                style={{
                  padding: ".5rem .75rem",
                  border: `1px solid ${theme.accent}`,
                  background: theme.accent,
                  color: "#fff",
                  borderRadius: ".35rem",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Add Tiebreaker
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
