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
import { buildCorrectCountMap, computeAutoEarned, computeBonusBreakdown } from "./scoring/compute.js";
marked.setOptions({ breaks: true });
export default function QuestionsMode({
  showBundle = { rounds: [], teams: [] },
  selectedRoundId,
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
  sendToDisplay,        // for non-question sends (category, carousel, etc.)
  pushDisplayQuestion,  // for question sends — single unified path
  displayControlsOpen = false,
  refreshBundle,
  carouselActive = false,
  setCarouselActive,
}) {
  // Unified question editor modal state
  const [editingQuestion, setEditingQuestion] = React.useState(null);

  // Track which showQuestionId has inline visual images active on display
  const [inlineVisualQuestionId, setInlineVisualQuestionId] =
    React.useState(null);

  // Add Tiebreaker modal state
  const [addingTiebreaker, setAddingTiebreaker] = React.useState(false);
  const [tbQuestion, setTbQuestion] = React.useState("");
  const [tbAnswer, setTbAnswer] = React.useState("");

  const [hostModalOpen, setHostModalOpen] = React.useState(false);
  // Use hostInfo from props (synced to Supabase), with local state for immediate UI updates
  const [hostInfo, setHostInfo] = React.useState(hostInfoProp);

  // Track progressive reveal state: which question is active and what stage it's at
  const [progressiveRevealState, setProgressiveRevealState] = React.useState({
    activeQuestionId: null,
    stage: 0,
    activeQuestionIdWithImgs: null,
    stageWithImgs: 0,
  });

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
    const multiRe = /^\s*\d{4}-\d{2}-\d{2}\s+Game\s+(\d+)\s*@\s*(.+)\s*$/i;
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
    [multiGameMeta.venue],
  );

  // Auto-fill location from show name if empty
  React.useEffect(() => {
    if (inferredLocation && !hostInfo.location) {
      const next = { ...hostInfo, location: inferredLocation };
      setHostInfo(next);
      setHostInfoProp?.(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inferredLocation]);

  // keep local textarea in sync with shared prizes
  const [prizesText, setPrizesText] = React.useState(
    Array.isArray(prizes) ? prizes.join("\n") : String(prizes || ""),
  );
  React.useEffect(() => {
    setPrizesText(
      Array.isArray(prizes) ? prizes.join("\n") : String(prizes || ""),
    );
  }, [prizes]);

  const prizeLines = React.useMemo(
    () =>
      (prizesText || "")
        .toString()
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [prizesText],
  );
  const [prizeCountInput, setPrizeCountInput] = React.useState(
    prizeLines.length,
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
    setHostInfo(next);
    setHostInfoProp?.(next);
  };

  // ✅ make allRounds stable
  const allRounds = React.useMemo(
    () => showBundle?.rounds ?? [],
    [showBundle?.rounds],
  );

  // ✅ make displayRounds stable too
  const displayRounds = React.useMemo(() => {
    if (!selectedRoundId) return allRounds;
    const sel = Number(selectedRoundId);
    return allRounds.filter((r) => Number(r.round) === sel);
  }, [allRounds, selectedRoundId]);

  // Is a question a tiebreaker? Uses bundle field names directly.
  const isTB = (q) => {
    const questionType = String(q?.questionType || "").toLowerCase();
    const questionOrder = String(q?.questionOrder || "").toUpperCase();
    return questionType === "tiebreaker" || questionOrder === "TB";
  };

  // Check if current round has a tiebreaker
  const hasTiebreaker = React.useMemo(() => {
    for (const round of displayRounds) {
      for (const cat of round.categories || []) {
        for (const q of cat.questions || []) {
          if (isTB(q)) return true;
        }
      }
    }
    return false;
  }, [displayRounds]);

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
    ],
  );

  // Helper to calculate points per team for a question
  const calculatePointsPerTeam = React.useCallback(
    (correctCount, activeTeamCount) => {
      if (!correctCount || correctCount === 0) return null;
      if (scoringMode === "pooled" || scoringMode === "pooled-adaptive") {
        const mockCell = { isCorrect: true };
        const config =
          scoringMode === "pooled-adaptive"
            ? { ...scoringConfig, teamCount: activeTeamCount }
            : scoringConfig;
        return computeAutoEarned(mockCell, config, correctCount);
      }
      return null;
    },
    [scoringMode, scoringConfig],
  );

  // Calculate statistics for each question (teams correct, points per team, etc.)
  const statsByRoundAndQuestion = React.useMemo(() => {
    if (!cachedState?.teams || !cachedState?.grid) return {};

    const teams = cachedState.teams;
    const grid = cachedState.grid;

    const teamNames = new Map(
      teams.map((t) => [t.showTeamId, t.teamName || "(Unnamed team)"]),
    );

    const result = {}; // { [roundId]: { [showQuestionId]: stats } }

    const rounds = showBundle?.rounds || [];
    for (const round of rounds) {
      const roundId = String(round.round);

      const roundQuestions = [];
      for (const cat of round?.categories || []) {
        for (const q of cat?.questions || []) {
          roundQuestions.push({
            showQuestionId: q.showQuestionId,
            questionId: q.questionId,
            order: q.questionOrder,
            bonusAvailable: !!q.bonusAvailable,
            bonusValue: q.bonusValue || null,
            maxBonuses: typeof q.maxBonuses === "number" ? q.maxBonuses : null,
          });
        }
      }

      const adaptedGrid = {};
      for (const teamId in grid) {
        adaptedGrid[teamId] = {};
        for (const questionId in grid[teamId]) {
          const cell = grid[teamId][questionId];
          adaptedGrid[teamId][questionId] = {
            isCorrect: cell.isCorrect,
            bonusCount: cell.bonusCount || 0,
            partialCount: cell.partialCount || 0,
          };
        }
      }

      const correctCountMap = buildCorrectCountMap(
        teams,
        roundQuestions,
        adaptedGrid,
      );

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

        for (const t of teams) {
          const cell = grid[t.showTeamId]?.[showQuestionId];
          if (cell?.isCorrect) {
            const nm = teamNames.get(t.showTeamId);
            if (nm) correctTeams.push(nm);
          }
        }

        let bonusBreakdown = [];
        if (q.bonusAvailable && q.bonusValue) {
          const questionBonus = { bonusValue: q.bonusValue, maxBonuses: q.maxBonuses };
          bonusBreakdown = computeBonusBreakdown(
            teams, adaptedGrid, showQuestionId, scoringConfig, correctCount, questionBonus
          );
        }

        roundStats[showQuestionId] = {
          totalTeams,
          activeTeamCount,
          correctCount,
          correctTeams,
          bonusBreakdown,
        };
      }

      result[roundId] = roundStats;
    }

    return result;
  }, [cachedState, showBundle, scoringMode, scoringConfig]);

  // Flat sorted list of { round, cat } — visuals first within each round, then by categoryOrder
  const sortedCategories = React.useMemo(() => {
    const result = [];
    for (const round of displayRounds) {
      const sortedCats = [...(round.categories || [])].sort((a, b) => {
        const av = (a.questionType || "").toLowerCase().includes("visual") ? 0 : 1;
        const bv = (b.questionType || "").toLowerCase().includes("visual") ? 0 : 1;
        if (av !== bv) return av - bv; // visuals first
        return (a.categoryOrder ?? 999) - (b.categoryOrder ?? 999);
      });
      for (const cat of sortedCats) {
        result.push({ round, cat });
      }
    }
    return result;
  }, [displayRounds]);

  // Sequential category number per round (null for visual/tiebreaker categories)
  const categoryNumbers = React.useMemo(() => {
    const perRound = new Map();
    const result = new Map();
    for (const { round, cat } of sortedCategories) {
      const qType = (cat.questionType || "").toLowerCase();
      if (qType.includes("visual") || qType.includes("tiebreaker")) {
        result.set(cat, null);
        continue;
      }
      const rNum = round.round;
      const next = (perRound.get(rNum) || 0) + 1;
      perRound.set(rNum, next);
      result.set(cat, next);
    }
    return result;
  }, [sortedCategories]);

  return (
    <>
      {/* Add Tiebreaker button (if applicable) */}
      {sortedCategories.length > 0 &&
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

      {sortedCategories.map(({ round, cat }, index) => {
        const categoryName = (cat.categoryName || "").trim() || "Uncategorized";
        const categoryDescription = (cat.categoryDescription || "").trim();
        const categoryNotes = (cat.categoryNotes || "").trim();
        const isSuperSecret = !!cat.superSecret;

        // Category images
        const groupKey = `${categoryName}|||${categoryDescription}`;
        const catImagesArr = Array.isArray(cat.categoryImages) ? cat.categoryImages : [];

        // Category audio
        const catAudioArr = Array.isArray(cat.categoryAudio) ? cat.categoryAudio : [];

        // Category question type
        const categoryQuestionType = (cat.questionType || "").toLowerCase();
        const isVisualCategory = categoryQuestionType.includes("visual");

        // All questions in this category (for carousel)
        const categoryQuestions = cat.questions || [];

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
                  `${Number.isFinite(number) ? `${number}. ` : ""}${categoryName || ""}`,
                ),
              }}
            />
            <p
              style={{
                color: "#fff",
                fontFamily: tokens.font.flavor,
                margin: "0 0 0.5rem 0",
                textAlign: "left",
                paddingLeft: "1rem",
              }}
              dangerouslySetInnerHTML={{
                __html: marked.parseInline(categoryDescription || ""),
              }}
            />

            {/* Category notes (host-only, not pushed to display) */}
            {categoryNotes && (
              <div
                style={{
                  fontFamily: tokens.font.body,
                  color: "#fff",
                  fontSize: "1rem",
                  display: "flex",
                  alignItems: "baseline",
                  paddingLeft: "1rem",
                  paddingTop: "0.25rem",
                  marginTop: 0,
                  marginBottom: "0.5rem",
                }}
              >
                <span
                  style={{
                    marginRight: "0.35rem",
                    flexShrink: 0,
                    fontSize: "0.9rem",
                  }}
                >
                  💭
                </span>
                <span
                  dangerouslySetInnerHTML={{
                    __html: marked.parseInline(categoryNotes),
                  }}
                />
              </div>
            )}

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

            {/* Question carousel button (for Visual categories only) */}
            {isVisualCategory &&
              categoryQuestions.length > 0 &&
              sendToDisplay &&
              displayControlsOpen && (
                <div style={{ marginTop: "0.5rem", marginLeft: "1rem" }}>
                  <Button
                    onClick={() => {
                      if (carouselActive) {
                        sendToDisplay("closeQuestionCarousel", null);
                        setCarouselActive(false);
                      } else {
                        const questionsForCarousel = categoryQuestions.map(
                          (q) => ({
                            questionNumber: q.questionOrder,
                            questionText: q.questionText || "",
                            categoryName: categoryName,
                            inlineImages:
                              Array.isArray(q.questionImages) && q.questionImages.length > 0
                                ? q.questionImages.map((img) => ({ url: img.url }))
                                : [],
                            currentInlineImageIndex: 0,
                          }),
                        );
                        sendToDisplay("questionCarousel", {
                          questions: questionsForCarousel,
                          currentIndex: 0,
                          autoCycle: true,
                        });
                        setCarouselActive(true);
                      }
                    }}
                    style={{
                      fontSize: tokens.font.size,
                      fontFamily: tokens.font.body,
                    }}
                    title={
                      carouselActive
                        ? "Close question carousel on display"
                        : "Push question carousel to display (auto-cycles every 8 seconds)"
                    }
                  >
                    {carouselActive
                      ? "Close carousel"
                      : "Push question carousel to display"}
                  </Button>
                </div>
              )}

            {/* Inline image navigation controls */}
            {sendToDisplay &&
              displayControlsOpen &&
              inlineVisualQuestionId &&
              (() => {
                const currentQuestion = sortedCategories
                  .flatMap(({ cat: c }) => c.questions || [])
                  .find((q) => q.showQuestionId === inlineVisualQuestionId);

                if (
                  !currentQuestion ||
                  !Array.isArray(currentQuestion.questionImages) ||
                  currentQuestion.questionImages.length <= 1
                ) {
                  return null;
                }

                const currentIdx =
                  currentImageIndex[inlineVisualQuestionId] || 0;
                const totalImages = currentQuestion.questionImages.length;

                return (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      marginLeft: "1rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.85rem",
                        marginBottom: "0.25rem",
                        color: theme.accent,
                        fontWeight: 600,
                      }}
                    >
                      Inline Image Navigation ({currentIdx + 1} of {totalImages})
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Button
                        onClick={() => {
                          const newIdx =
                            (currentIdx - 1 + totalImages) % totalImages;
                          setCurrentImageIndex((prev) => ({
                            ...prev,
                            [inlineVisualQuestionId]: newIdx,
                          }));
                          sendToDisplay("updateInlineImageIndex", {
                            currentIndex: newIdx,
                          });
                        }}
                        style={{
                          fontSize: tokens.font.size,
                          fontFamily: tokens.font.body,
                        }}
                        title="Show previous inline image"
                      >
                        ◀ Previous
                      </Button>
                      <Button
                        onClick={() => {
                          const newIdx = (currentIdx + 1) % totalImages;
                          setCurrentImageIndex((prev) => ({
                            ...prev,
                            [inlineVisualQuestionId]: newIdx,
                          }));
                          sendToDisplay("updateInlineImageIndex", {
                            currentIndex: newIdx,
                          });
                        }}
                        style={{
                          fontSize: tokens.font.size,
                          fontFamily: tokens.font.body,
                        }}
                        title="Show next inline image"
                      >
                        Next ▶
                      </Button>
                    </div>
                  </div>
                );
              })()}

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
                    ),
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

        const sortedQuestions = [...(cat.questions || [])].sort((a, b) => {
          if (isTB(a) && !isTB(b)) return 1;
          if (!isTB(a) && isTB(b)) return -1;
          return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
        });

        return (
          <div
            key={`${round.round}-${cat.categoryOrder}`}
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
                  number={categoryNumbers.get(cat)}
                />
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
              <CategoryHeader number={categoryNumbers.get(cat)} />
            )}

            {sortedQuestions.map((q, qIndex) => {
              const qKey = q.showQuestionId;
              if (!questionRefs.current[qKey]) {
                questionRefs.current[qKey] = React.createRef();
              }

              const hasImages =
                Array.isArray(q.questionImages) && q.questionImages.length > 0;

              return (
                <React.Fragment key={qKey}>
                  <div ref={questionRefs.current[qKey]}>
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
                          <>Question {q.questionOrder}:</>
                        )}
                      </strong>
                      {pushDisplayQuestion &&
                        displayControlsOpen &&
                        (() => {
                          if (q.showImageByDefault) {
                            // Single "Push to display" button — images always included
                            return (
                              <Button
                                onClick={() => {
                                  pushDisplayQuestion(q.showQuestionId, 0, hasImages);
                                  setInlineVisualQuestionId(
                                    hasImages ? q.showQuestionId : null,
                                  );
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
                            );
                          }

                          // For other questions — show both buttons if images exist
                          return (
                            <>
                              <Button
                                onClick={() => {
                                  pushDisplayQuestion(q.showQuestionId, 0, false);
                                  setInlineVisualQuestionId(null);
                                }}
                                style={{
                                  marginLeft: ".5rem",
                                  fontSize: ".75rem",
                                  padding: ".25rem .5rem",
                                  verticalAlign: "middle",
                                }}
                                title="Push this question to the display (without images)"
                              >
                                Push to display
                              </Button>
                              {hasImages && (
                                <Button
                                  onClick={() => {
                                    pushDisplayQuestion(q.showQuestionId, 0, true);
                                    setInlineVisualQuestionId(q.showQuestionId);
                                  }}
                                  style={{
                                    marginLeft: ".5rem",
                                    fontSize: ".75rem",
                                    padding: ".25rem .5rem",
                                    verticalAlign: "middle",
                                  }}
                                  title="Push this question to the display with inline images"
                                >
                                  Push with images
                                </Button>
                              )}
                            </>
                          );
                        })()}
                      <br />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          paddingLeft: editQuestionField ? "0" : "1.5rem",
                          paddingTop: "0.25rem",
                        }}
                      >
                        {editQuestionField && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingQuestion({
                                showQuestionId: q.showQuestionId,
                                questionText: q.questionText || "",
                                questionNotes: q.questionNotes || "",
                                questionPronunciationGuide:
                                  q.questionPronunciationGuide || "",
                                answer: q.answer || "",
                              });
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "0",
                              marginRight: "0.35rem",
                              fontSize: "0.9rem",
                              color: q._edited ? theme.accent : "#8B9DC3",
                              opacity: q._edited ? 1 : 0.4,
                              transition: "opacity 0.2s, color 0.2s",
                              flexShrink: 0,
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
                            __html: marked.parseInline(q.questionText || ""),
                          }}
                        />
                      </div>
                    </div>

                    {/* NOTES */}
                    {q.questionNotes?.trim() && showDetails && (
                      <div
                        style={{
                          fontFamily: tokens.font.body,
                          fontSize: "1rem",
                          display: "flex",
                          alignItems: "baseline",
                          paddingLeft: "1.5rem",
                          paddingTop: "0.25rem",
                          marginTop: 0,
                          marginBottom: 0,
                        }}
                      >
                        <span
                          style={{
                            marginRight: "0.35rem",
                            flexShrink: 0,
                            fontSize: "0.9rem",
                          }}
                        >
                          💭
                        </span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: marked.parseInline(q.questionNotes),
                          }}
                        />
                      </div>
                    )}

                    {/* PRONUNCIATION GUIDE */}
                    {q.questionPronunciationGuide?.trim() && showDetails && (
                      <div
                        style={{
                          fontFamily: tokens.font.body,
                          fontSize: "1rem",
                          display: "flex",
                          alignItems: "baseline",
                          paddingLeft: "1.5rem",
                          paddingTop: "0.25rem",
                          marginTop: 0,
                          marginBottom: 0,
                        }}
                      >
                        <span
                          style={{
                            marginRight: "0.35rem",
                            flexShrink: 0,
                            fontSize: "0.9rem",
                          }}
                        >
                          🗣️
                        </span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: marked.parseInline(
                              q.questionPronunciationGuide,
                            ),
                          }}
                        />
                      </div>
                    )}

                    {/* IMAGE POPUP TOGGLE */}
                    {hasImages && (
                      <div style={{ marginTop: "0.25rem" }}>
                        <Button
                          onClick={() => {
                            setVisibleImages((prev) => ({
                              ...prev,
                              [q.showQuestionId]: true,
                            }));
                            setCurrentImageIndex((prev) => ({
                              ...prev,
                              [q.showQuestionId]: 0,
                            }));
                          }}
                          style={{
                            marginBottom: "0.25rem",
                            marginLeft: "1.5rem",
                          }}
                        >
                          Show image
                        </Button>
                        {/* Arrow buttons for inline images on display */}
                        {sendToDisplay &&
                          displayControlsOpen &&
                          inlineVisualQuestionId === q.showQuestionId &&
                          q.questionImages.length > 1 && (
                            <div
                              style={{
                                display: "inline-block",
                                marginLeft: "0.5rem",
                              }}
                            >
                              <button
                                onClick={() => {
                                  const currentIdx =
                                    currentImageIndex[q.showQuestionId] || 0;
                                  const newIdx =
                                    (currentIdx - 1 + q.questionImages.length) %
                                    q.questionImages.length;
                                  setCurrentImageIndex({
                                    ...currentImageIndex,
                                    [q.showQuestionId]: newIdx,
                                  });
                                  sendToDisplay("updateInlineImageIndex", {
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
                                    currentImageIndex[q.showQuestionId] || 0;
                                  const newIdx =
                                    (currentIdx + 1) % q.questionImages.length;
                                  setCurrentImageIndex({
                                    ...currentImageIndex,
                                    [q.showQuestionId]: newIdx,
                                  });
                                  sendToDisplay("updateInlineImageIndex", {
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

                        {visibleImages[q.showQuestionId] && (
                          <div
                            onClick={() =>
                              setVisibleImages((prev) => ({
                                ...prev,
                                [q.showQuestionId]: false,
                              }))
                            }
                            style={overlayStyle}
                          >
                            <img
                              src={
                                q.questionImages[
                                  currentImageIndex[q.showQuestionId] || 0
                                ]?.url
                              }
                              alt={
                                q.questionImages[
                                  currentImageIndex[q.showQuestionId] || 0
                                ]?.Name || "Attached image"
                              }
                              style={overlayImg}
                            />

                            {q.questionImages.length > 1 && (
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
                                        prev[q.showQuestionId] || 0;
                                      return {
                                        ...prev,
                                        [q.showQuestionId]:
                                          (curr - 1 + q.questionImages.length) %
                                          q.questionImages.length,
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
                                        prev[q.showQuestionId] || 0;
                                      return {
                                        ...prev,
                                        [q.showQuestionId]:
                                          (curr + 1) % q.questionImages.length,
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
                    {Array.isArray(q.questionAudio) && q.questionAudio.length > 0 && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          marginLeft: "1.5rem",
                          marginRight: "1.5rem",
                        }}
                      >
                        {q.questionAudio.map(
                          (audioObj, audioIdx) =>
                            audioObj.url && (
                              <div
                                key={audioIdx}
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
                                      "",
                                    )}
                                  </div>
                                )}
                              </div>
                            ),
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
                              `<span style="font-size:0.7em; position: relative; top: -1px;">🟢</span> **Answer:** ${q.answer}`,
                            ),
                          }}
                        />
                        {pushDisplayQuestion &&
                          displayControlsOpen &&
                          (() => {
                            const qStats =
                              statsByRoundAndQuestion[String(round.round)]?.[
                                q.showQuestionId
                              ];
                            const qPointsPerTeam = qStats
                              ? calculatePointsPerTeam(
                                  qStats.correctCount,
                                  qStats.activeTeamCount,
                                )
                              : null;

                            if (q.showImageByDefault) {
                              // Single cycling button: Q → A → Stats, always with images
                              const questionId = q.showQuestionId;
                              const isActiveQuestion =
                                progressiveRevealState.activeQuestionId ===
                                questionId;
                              const currentStage = isActiveQuestion
                                ? progressiveRevealState.stage
                                : 0;

                              return (
                                <Button
                                  onClick={() => {
                                    const nextStage = isActiveQuestion
                                      ? (currentStage + 1) % 3
                                      : 0;
                                    pushDisplayQuestion(
                                      q.showQuestionId,
                                      nextStage,
                                      hasImages,
                                    );
                                    setInlineVisualQuestionId(
                                      hasImages ? q.showQuestionId : null,
                                    );
                                    setProgressiveRevealState({
                                      activeQuestionId: questionId,
                                      stage: nextStage,
                                    });
                                  }}
                                  style={{
                                    marginLeft: ".5rem",
                                    fontSize: ".75rem",
                                    padding: ".25rem .5rem",
                                    verticalAlign: "middle",
                                  }}
                                  title={
                                    !isActiveQuestion || currentStage === 2
                                      ? "Click to reveal question"
                                      : currentStage === 0
                                        ? "Click to reveal answer"
                                        : "Click to reveal statistics"
                                  }
                                >
                                  {!isActiveQuestion || currentStage === 2
                                    ? "📺 Reveal Q"
                                    : currentStage === 0
                                      ? "📺 Reveal A"
                                      : "📺 Reveal Stats"}
                                </Button>
                              );
                            }

                            // For numbered questions — two buttons (without/with images)
                            const questionId = q.showQuestionId;
                            const isActiveQuestion =
                              progressiveRevealState.activeQuestionId ===
                              questionId;
                            const currentStage = isActiveQuestion
                              ? progressiveRevealState.stage
                              : 0;
                            const isActiveQuestionWithImgs =
                              progressiveRevealState.activeQuestionIdWithImgs ===
                              questionId;
                            const currentStageWithImgs =
                              isActiveQuestionWithImgs
                                ? progressiveRevealState.stageWithImgs
                                : 0;

                            return (
                              <>
                                {/* Progressive reveal WITHOUT images */}
                                <Button
                                  onClick={() => {
                                    const nextStage = isActiveQuestion
                                      ? (currentStage + 1) % 3
                                      : 0;
                                    pushDisplayQuestion(
                                      q.showQuestionId,
                                      nextStage,
                                      false,
                                    );
                                    setInlineVisualQuestionId(null);
                                    setProgressiveRevealState((prev) => ({
                                      ...prev,
                                      activeQuestionId: questionId,
                                      stage: nextStage,
                                    }));
                                  }}
                                  style={{
                                    marginLeft: ".5rem",
                                    fontSize: ".75rem",
                                    padding: ".25rem .5rem",
                                    verticalAlign: "middle",
                                  }}
                                  title={
                                    !isActiveQuestion || currentStage === 2
                                      ? "Click to reveal question"
                                      : currentStage === 0
                                        ? "Click to reveal answer"
                                        : "Click to reveal statistics"
                                  }
                                >
                                  {!isActiveQuestion || currentStage === 2
                                    ? "📺 Reveal Q"
                                    : currentStage === 0
                                      ? "📺 Reveal A"
                                      : "📺 Reveal Stats"}
                                </Button>

                                {/* Progressive reveal WITH images (only if images exist) */}
                                {hasImages && (
                                  <Button
                                    onClick={() => {
                                      const nextStage =
                                        isActiveQuestionWithImgs
                                          ? (currentStageWithImgs + 1) % 3
                                          : 0;
                                      pushDisplayQuestion(
                                        q.showQuestionId,
                                        nextStage,
                                        true,
                                      );
                                      setInlineVisualQuestionId(q.showQuestionId);
                                      setProgressiveRevealState((prev) => ({
                                        ...prev,
                                        activeQuestionIdWithImgs: questionId,
                                        stageWithImgs: nextStage,
                                      }));
                                    }}
                                    style={{
                                      marginLeft: ".5rem",
                                      fontSize: ".75rem",
                                      padding: ".25rem .5rem",
                                      verticalAlign: "middle",
                                    }}
                                    title={
                                      !isActiveQuestionWithImgs ||
                                      currentStageWithImgs === 2
                                        ? "Click to reveal question with images"
                                        : currentStageWithImgs === 0
                                          ? "Click to reveal answer with images"
                                          : "Click to reveal statistics with images"
                                    }
                                  >
                                    {!isActiveQuestionWithImgs ||
                                    currentStageWithImgs === 2
                                      ? "📺🖼️ Reveal Q"
                                      : currentStageWithImgs === 0
                                        ? "📺🖼️ Reveal A"
                                        : "📺🖼️ Reveal Stats"}
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                      </p>
                    )}

                    {/* STATS PILL (teams correct, points) */}
                    {(() => {
                      const qStats =
                        statsByRoundAndQuestion[String(round.round)]?.[
                          q.showQuestionId
                        ];
                      const qPointsPerTeam = qStats
                        ? calculatePointsPerTeam(
                            qStats.correctCount,
                            qStats.activeTeamCount,
                          )
                        : null;

                      if (!qStats || isTB(q)) return null;

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

                          {qStats.bonusBreakdown && qStats.bonusBreakdown.length > 1 ? (
                            <span style={{ marginLeft: ".6rem", fontSize: "1rem" }}>
                              {qStats.bonusBreakdown.map((level, i) => (
                                <span key={level.bonusLevel}>
                                  {i > 0 && " · "}
                                  <span style={{ color: theme.accent, fontWeight: 700 }}>
                                    {level.pointsPerTeam}
                                  </span>
                                  {" pts"}
                                  {level.bonusLevel > 0 && (
                                    <span style={{ fontSize: ".9rem", opacity: 0.8 }}>
                                      {" "}({level.bonusLevel} {"bonus" + (level.bonusLevel > 1 ? "es" : "")})
                                    </span>
                                  )}
                                </span>
                              ))}
                            </span>
                          ) : qPointsPerTeam !== null ? (
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
                          ) : null}

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

                  {qIndex < sortedQuestions.length - 1 && (
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
                  what's shown)
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
                      safeTrim(editingQuestion.questionText),
                    );
                    editQuestionField(
                      editingQuestion.showQuestionId,
                      "notes",
                      safeTrim(editingQuestion.questionNotes),
                    );
                    editQuestionField(
                      editingQuestion.showQuestionId,
                      "answer",
                      safeTrim(editingQuestion.answer),
                    );
                    editQuestionField(
                      editingQuestion.showQuestionId,
                      "pronunciationGuide",
                      safeTrim(editingQuestion.pronunciationGuide),
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
