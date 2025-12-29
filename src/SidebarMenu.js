// SidebarMenu.js - Menu contents for the sidebar drawer
import { useEffect, useState, useMemo } from "react";
import { tokens, colors as theme } from "./styles/index.js";

export default function SidebarMenu({
  showBundle,
  showTimer,
  setShowTimer,
  setTimerPosition,
  showDetails,
  setShowDetails,
  timerDuration,
  setTimerDuration,
  hostInfo,
  setHostInfo,
  displayControlsOpen,
  setDisplayControlsOpen,
  setDisplayControlsPosition,
  setShowAnswerKey,
  refreshBundle,
  scoringMode,
  setScoringMode,
  pubPoints,
  setPubPoints,
  poolPerQuestion,
  setPoolPerQuestion,
  poolContribution,
  setPoolContribution,
  prizes,
  setPrizes,
  getClosestQuestionKey,
  questionRefs,
}) {
  const [expandedSections, setExpandedSections] = useState({
    hostTools: false,
    showSettings: false,

    // nested inside Show settings:
    showDetailsSettings: false,
    scoringSettings: false,
    prizesSettings: false,
  });

  // Script modal state (moved from QuestionsMode)
  const [scriptOpen, setScriptOpen] = useState(false);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const sectionStyle = {
    marginBottom: "0.75rem",
  };

  const headerStyle = {
    cursor: "pointer",
    padding: "0.75rem",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "4px",
    fontWeight: "bold",
    fontSize: "1.1rem",
    fontFamily: tokens.font.body,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  const nestedHeaderStyle = {
    cursor: "pointer",
    padding: "0.55rem 0.6rem",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: "4px",
    fontWeight: "bold",
    fontSize: "1rem",
    fontFamily: tokens.font.body,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "0.65rem",
    border: "1px solid rgba(255,255,255,0.10)",
  };

  const nestedContentStyle = {
    padding: "0.6rem 0.65rem 0.2rem",
    fontSize: "1rem",
  };

  const contentStyle = {
    padding: "0.5rem 0.75rem",
    fontSize: "1rem",
    fontFamily: tokens.font.body,
  };

  const itemStyle = {
    padding: "0.5rem 0",
    cursor: "pointer",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    fontFamily: tokens.font.body,
  };

  // --- Prizes editor (shared newline string) ---
  const normalizedPrizeLines = (prizes || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const [prizeCount, setPrizeCount] = useState(normalizedPrizeLines.length);
  const [prizeDrafts, setPrizeDrafts] = useState(normalizedPrizeLines);

  useEffect(() => {
    setPrizeCount(normalizedPrizeLines.length);
    setPrizeDrafts(normalizedPrizeLines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prizes]);

  const commitPrizes = (nextDrafts) => {
    const next = (nextDrafts || [])
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .join("\n");
    setPrizes?.(next);
  };

  // ========== HOST SCRIPT GENERATION (moved from QuestionsMode) ==========

  // Helper: check if question is tiebreaker
  const isTB = (q) => {
    const questionType = String(
      q?.questionType || q?.["Question type"] || ""
    ).toLowerCase();
    const questionOrder = String(
      q?.questionOrder || q?.["Question order"] || ""
    ).toUpperCase();
    return questionType === "tiebreaker" || questionOrder === "TB";
  };

  // Compute all rounds and total questions
  const allRounds = useMemo(
    () => showBundle?.rounds ?? [],
    [showBundle?.rounds]
  );

  const totalQuestions = useMemo(() => {
    let count = 0;
    for (const r of allRounds) {
      for (const q of r?.questions || []) {
        const typ = String(
          q?.questionType || q?.["Question type"] || ""
        ).toLowerCase();
        if (typ.includes("tiebreaker")) continue;
        count += 1;
      }
      for (const cat of r?.categories || []) {
        for (const q of cat?.questions || []) {
          const typ = String(
            q?.questionType || q?.["Question type"] || cat?.questionType || ""
          ).toLowerCase();
          const order = String(q?.questionOrder || "").toUpperCase();
          if (typ.includes("tiebreaker") || order === "TB") continue;
          count += 1;
        }
      }
    }
    return count;
  }, [allRounds]);

  // Detect multi-game metadata from show name
  const multiGameMeta = useMemo(() => {
    const showName =
      (showBundle?.Show && showBundle?.Show?.Show) ||
      showBundle?.showName ||
      "";
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
  }, [showBundle?.Show, showBundle?.showName]);

  // Prize list from prizes string
  const prizeList = useMemo(() => {
    const raw = (prizes || "").toString();
    const parts = raw.includes("\n") ? raw.split(/\r?\n/) : raw.split(/,\s*/);
    return parts.map((s) => s.trim()).filter(Boolean);
  }, [prizes]);

  // Ordinal helper
  const ordinal = (n) => {
    const j = n % 10,
      k = n % 100;
    if (j === 1 && k !== 11) return `${n}st`;
    if (j === 2 && k !== 12) return `${n}nd`;
    if (j === 3 && k !== 13) return `${n}rd`;
    return `${n}th`;
  };

  // Generate host script
  const hostScript = useMemo(() => {
    const X = totalQuestions;

    const hName = (
      hostInfo.host ||
      showBundle?.config?.hostName ||
      "your host"
    ).trim();
    const cName = (
      hostInfo.cohost ||
      showBundle?.config?.cohostName ||
      "your co-host"
    ).trim();

    const loc = (
      hostInfo.location ||
      showBundle?.config?.location ||
      multiGameMeta.venue ||
      "your venue"
    ).trim();

    const totalGamesFromConfig = showBundle?.config?.totalGamesThisNight;
    const totalGamesInput = Number(hostInfo.totalGames);
    const totalGames =
      Number.isFinite(totalGamesFromConfig) && totalGamesFromConfig > 0
        ? totalGamesFromConfig
        : Number.isFinite(totalGamesInput) && totalGamesInput > 0
          ? totalGamesInput
          : 1;

    const isMultiGame = totalGames >= 2;

    const configStartTimes = showBundle?.config?.allStartTimes || [];
    const manualStartTimes = (hostInfo.startTimesText || "")
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const startTimes =
      configStartTimes.length > 0 ? configStartTimes : manualStartTimes;

    const timeOfDay = "tonight";

    const showTemplate = showBundle?.config?.showTemplate || "";
    const isTipsy = showTemplate.toLowerCase().includes("tipsy");

    // Count question types (visual, spoken, audio)
    let visualQuestionCount = 0;
    let spokenQuestionCount = 0;
    let audioQuestionCount = 0;
    let visualCategoryCount = 0;

    for (const r of allRounds) {
      for (const cat of r?.categories || []) {
        const catQuestionType = String(
          cat?.questionType || cat?.["Question type"] || ""
        ).toLowerCase();

        if (catQuestionType.includes("visual")) {
          visualCategoryCount += 1;
          visualQuestionCount += (cat?.questions || []).filter(
            (q) => !isTB(q)
          ).length;
        } else if (catQuestionType.includes("audio")) {
          audioQuestionCount += (cat?.questions || []).filter(
            (q) => !isTB(q)
          ).length;
        } else {
          spokenQuestionCount += (cat?.questions || []).filter(
            (q) => !isTB(q)
          ).length;
        }
      }
    }

    // --- Intro ---
    const triviaType = isTipsy ? "tipsy team trivia" : "team trivia";
    let text =
      `Hey, everybody! It's time for ${triviaType} at ${loc}!\n\n` +
      `I'm ${hName} and this is ${cName}, and we're your hosts ${timeOfDay} as you play for trivia glory and some pretty awesome prizes.\n`;

    // --- Announcements ---
    if (hostInfo.announcements && hostInfo.announcements.trim()) {
      text += `\n${hostInfo.announcements.trim()}\n`;
    }

    // --- Multi-game intro ---
    const isFirstGame =
      multiGameMeta.gameIndex === 1 || multiGameMeta.gameIndex === null;
    if (isMultiGame && isFirstGame) {
      const time1 = startTimes[0] || "[TIME1]";
      const time2 = startTimes[1] || "[TIME2]";

      text += `\nWe'll be playing ${totalGames} games of trivia ${timeOfDay} - one starting right now at ${time1}, and the next starting right around ${time2}. The slate will be wiped clean after the first game; that means you can play one OR both games with us. How long you choose to hang out with us ${timeOfDay} is up to you.\n`;
    }

    // --- Question count ---
    if (isMultiGame) {
      text += `\nWe'll be asking you ${X} questions in each game ${timeOfDay}.\n`;
    } else {
      text += `\nWe'll be asking you ${X} questions ${timeOfDay}.\n`;
    }

    // --- Question breakdown ---
    if (
      visualQuestionCount > 0 ||
      spokenQuestionCount > 0 ||
      audioQuestionCount > 0
    ) {
      const parts = [];

      if (visualQuestionCount > 0) {
        parts.push(
          `${visualQuestionCount} visual question${visualQuestionCount === 1 ? "" : "s"}`
        );
      }

      if (spokenQuestionCount > 0) {
        parts.push(
          `${spokenQuestionCount} spoken word question${spokenQuestionCount === 1 ? "" : "s"}`
        );
      }

      if (audioQuestionCount > 0) {
        parts.push(
          `${audioQuestionCount} audio question${audioQuestionCount === 1 ? "" : "s"}`
        );
      }

      if (parts.length > 0) {
        let breakdown = "";
        if (parts.length === 1) {
          breakdown = parts[0];
        } else if (parts.length === 2) {
          breakdown = `${parts[0]} and ${parts[1]}`;
        } else {
          breakdown =
            parts.slice(0, -1).join(", ") + `, and ${parts[parts.length - 1]}`;
        }
        text += `\nThere will be ${breakdown}.\n`;
      }
    }

    // --- Scoring ---
    if (scoringMode === "pub") {
      const perQuestion = Number.isFinite(pubPoints) ? pubPoints : 10;
      const totalPossible = X * perQuestion;
      text += `\nEach question is worth ${perQuestion} point${perQuestion === 1 ? "" : "s"}, for a total of ${totalPossible} possible points${isMultiGame ? " in each game" : ""}.\n`;
    } else if (scoringMode === "pooled") {
      const poolSize = Number.isFinite(poolPerQuestion) ? poolPerQuestion : 150;
      text += `\nEach question ${timeOfDay} has a point pool of ${poolSize} points that will be divided up evenly among the teams that answer it correctly; in other words, you'll be rewarded if you know stuff that nobody else knows.\n`;
    } else if (scoringMode === "pooled-adaptive") {
      const contribution = Number.isFinite(poolContribution)
        ? poolContribution
        : 10;
      text += `\nEach question ${timeOfDay} has a point pool that contains ${contribution} point${contribution === 1 ? "" : "s"} for each team that is playing the game. The pool for each question will be divided up evenly among the teams that answer it correctly; in other words, you'll be rewarded if you know stuff that nobody else knows.\n`;
    }

    // --- Prizes ---
    if (prizeList.length > 0) {
      text += `\n${loc} is awarding prizes for the top ${prizeList.length} team${prizeList.length === 1 ? "" : "s"}:\n`;
      prizeList.forEach((p, i) => {
        text += `  • ${ordinal(i + 1)}: ${p}\n`;
      });
    }

    // --- Rules ---
    text +=
      `\nNow before we get going with the game, here are the rules.\n` +
      `● To keep things fair, no electronic devices may be out during the round. And that's not just when you're with your team at your table. If you have to step away from your table for any reason, please return with only your charming personality, and NOT with answers that you looked up while you were away. Because there are prizes at stake, if it looks like cheating, we have to treat it like cheating.\n` +
      `● Don't shout out the answers; you might accidentally give answers away to other teams. Use those handy dandy notepads to share ideas with your team instead.\n` +
      `● Spelling doesn't count unless we say it does.\n` +
      `● Unless we say otherwise, when we ask for someone's name, we want their last name. Give us the first name, too, if you like, but just remember that if any part of your answer is wrong, the whole thing is wrong. It's always safest to just give us last names.\n` +
      `● For fictional characters, either the first or last name is okay unless we say otherwise.\n` +
      `● Our answer is the correct answer. Dispute if you like and we'll consider it, but our decisions are final.\n` +
      `● Finally, be generous to the staff; they're working hard to ensure you have a great time. Don't be afraid to ask them for answers to our questions; they may know some that you don't.`;

    // --- Closing: Passing out visual round ---
    if (visualQuestionCount > 0) {
      text += "\n\n";

      const hasCohost = cName && cName !== "your co-host";

      let visualDescriptor;
      if (isMultiGame) {
        visualDescriptor =
          visualCategoryCount > 1
            ? "the first visual round for game #1"
            : "the visual round for game #1";
      } else {
        visualDescriptor =
          visualCategoryCount > 1 ? "the first visual round" : "the visual round";
      }

      if (hasCohost) {
        text += `${cName} is coming around ${visualDescriptor}. That's your signal to put those phones away because the contest starts now. Good luck!`;
      } else {
        text += `I'll be coming around in just a moment with ${visualDescriptor}. That's your signal to put those phones away because the contest starts now. Good luck!`;
      }
    }

    return text;
  }, [
    totalQuestions,
    prizeList,
    hostInfo,
    multiGameMeta,
    showBundle,
    scoringMode,
    pubPoints,
    poolPerQuestion,
    poolContribution,
    allRounds,
  ]);

  return (
    <div style={{ color: "#fff" }}>
      {/* Host tools */}
      <div style={sectionStyle}>
        <div style={headerStyle} onClick={() => toggleSection("hostTools")}>
          <span>Host tools</span>
          <span>{expandedSections.hostTools ? "▼" : "▶"}</span>
        </div>
        {expandedSections.hostTools && (
          <div style={contentStyle}>
            {/* Timer controls */}
            <div
              style={{
                ...itemStyle,
                paddingBottom: showTimer ? "0.75rem" : "0.5rem",
              }}
              onClick={() => setShowTimer((prev) => !prev)}
            >
              ⏱️ {showTimer ? "Hide timer" : "Show timer"}
            </div>

            {showTimer && (
              <div
                style={{
                  padding: "0.5rem 0.75rem",

                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ opacity: 0.9 }}>Default time</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <input
                      type="number"
                      min="5"
                      max="999"
                      value={timerDuration}
                      onChange={(e) => setTimerDuration(Number(e.target.value))}
                      style={{
                        width: "50px",
                        padding: "0.25rem",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255,255,255,0.1)",
                        color: "#fff",
                        textAlign: "right",
                        fontSize: "1rem",
                      }}
                    />
                    <span style={{ opacity: 0.85 }}>sec</span>
                  </div>
                </label>
                <button
                  onClick={() => {
                    setTimerPosition({ x: 0, y: 0 });
                    localStorage.removeItem("timerPosition");
                  }}
                  style={{
                    width: "100%",
                    padding: "0.35rem",
                    marginTop: "0.5rem",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontSize: "1rem",
                    cursor: "pointer",
                    fontFamily: tokens.font.body,
                  }}
                >
                  Reset timer position
                </button>
              </div>
            )}

            {/* Answer key */}
            <div
              style={itemStyle}
              onClick={() => setShowAnswerKey((prev) => !prev)}
            >
              📋 Answer key
            </div>

            {/* Show script */}
            <div style={itemStyle} onClick={() => setScriptOpen(true)}>
              🎤 Script
            </div>

            {/* Refresh questions */}
            {refreshBundle && (
              <div style={itemStyle} onClick={refreshBundle}>
                🔄 Refresh questions
              </div>
            )}

            {/* Display controls toggle */}
            <div
              style={{
                ...itemStyle,
                paddingBottom: displayControlsOpen ? "0.75rem" : "0.5rem",
              }}
              onClick={() => {
                // Preserve scroll position
                const closestKey = getClosestQuestionKey?.();
                setDisplayControlsOpen((prev) => !prev);
                if (closestKey && questionRefs?.current?.[closestKey]?.current) {
                  // Use requestAnimationFrame to wait for DOM update, then scroll instantly
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      questionRefs.current[closestKey]?.current?.scrollIntoView({
                        behavior: "instant",
                        block: "center",
                      });
                    });
                  });
                }
              }}
            >
              📺{" "}
              {displayControlsOpen
                ? "Hide display controls"
                : "Show display controls"}
            </div>

            {displayControlsOpen && (
              <div
                style={{
                  padding: "0.5rem 0.75rem",

                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <button
                  onClick={() => {
                    setDisplayControlsPosition({ x: 0, y: 0 });
                    localStorage.removeItem("displayControlsPosition");
                  }}
                  style={{
                    width: "100%",
                    padding: "0.35rem",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontSize: "1rem",
                    cursor: "pointer",
                    fontFamily: tokens.font.body,
                  }}
                >
                  Reset display controls position
                </button>
              </div>
            )}

            {/* Show/hide all answers */}
            <div
              style={itemStyle}
              onClick={() => {
                // Preserve scroll position
                const closestKey = getClosestQuestionKey?.();
                setShowDetails((prev) => !prev);
                if (closestKey && questionRefs?.current?.[closestKey]?.current) {
                  // Use requestAnimationFrame to wait for DOM update, then scroll instantly
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      questionRefs.current[closestKey]?.current?.scrollIntoView({
                        behavior: "instant",
                        block: "center",
                      });
                    });
                  });
                }
              }}
            >
              🥷 {showDetails ? "Hide all answers" : "Show all answers"}
            </div>
          </div>
        )}
      </div>

      {/* Show settings */}
      <div style={sectionStyle}>
        <div style={headerStyle} onClick={() => toggleSection("showSettings")}>
          <span>Show settings</span>
          <span>{expandedSections.showSettings ? "▼" : "▶"}</span>
        </div>

        {expandedSections.showSettings && (
          <div style={{ padding: "0.5rem 0.75rem" }}>
            {/* === Show details (nested) === */}
            <div
              style={nestedHeaderStyle}
              onClick={() => toggleSection("showDetailsSettings")}
            >
              <span>🧾 Show details</span>
              <span>{expandedSections.showDetailsSettings ? "▼" : "▶"}</span>
            </div>

            {expandedSections.showDetailsSettings && (
              <div style={nestedContentStyle}>
                <label style={{ display: "block", marginBottom: "0.5rem" }}>
                  <span style={{ display: "block", marginBottom: "0.25rem" }}>
                    Location:
                  </span>
                  <input
                    type="text"
                    value={hostInfo?.location || ""}
                    onChange={(e) =>
                      setHostInfo({ ...hostInfo, location: e.target.value })
                    }
                    placeholder="From show config"
                    style={{
                      width: "100%",
                      padding: "0.35rem",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "1rem",
                      fontFamily: tokens.font.body,
                    }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: "0.5rem" }}>
                  <span style={{ display: "block", marginBottom: "0.25rem" }}>
                    Host name:
                  </span>
                  <input
                    type="text"
                    value={hostInfo?.host || ""}
                    onChange={(e) =>
                      setHostInfo({ ...hostInfo, host: e.target.value })
                    }
                    placeholder="From show config"
                    style={{
                      width: "100%",
                      padding: "0.35rem",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "1rem",
                      fontFamily: tokens.font.body,
                    }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: "0.5rem" }}>
                  <span style={{ display: "block", marginBottom: "0.25rem" }}>
                    Co-host name:
                  </span>
                  <input
                    type="text"
                    value={hostInfo?.cohost || ""}
                    onChange={(e) =>
                      setHostInfo({ ...hostInfo, cohost: e.target.value })
                    }
                    placeholder="From show config"
                    style={{
                      width: "100%",
                      padding: "0.35rem",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "1rem",
                      fontFamily: tokens.font.body,
                    }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: "0.5rem" }}>
                  <span style={{ display: "block", marginBottom: "0.25rem" }}>
                    Total games tonight:
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={hostInfo?.totalGames || ""}
                    onChange={(e) =>
                      setHostInfo({ ...hostInfo, totalGames: e.target.value })
                    }
                    placeholder="1"
                    style={{
                      width: "90px",
                      padding: "0.35rem",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "1rem",
                      fontFamily: tokens.font.body,
                    }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: "0.5rem" }}>
                  <span style={{ display: "block", marginBottom: "0.25rem" }}>
                    Start times:
                  </span>
                  <input
                    type="text"
                    value={hostInfo?.startTimesText || ""}
                    onChange={(e) =>
                      setHostInfo({
                        ...hostInfo,
                        startTimesText: e.target.value,
                      })
                    }
                    placeholder="7:00, 8:30"
                    style={{
                      width: "100%",
                      padding: "0.35rem",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "1rem",
                      fontFamily: tokens.font.body,
                    }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: "0.65rem" }}>
                  <span style={{ display: "block", marginBottom: "0.25rem" }}>
                    Announcements:
                  </span>
                  <textarea
                    value={hostInfo?.announcements || ""}
                    onChange={(e) =>
                      setHostInfo({
                        ...hostInfo,
                        announcements: e.target.value,
                      })
                    }
                    placeholder="Specials, birthdays, upcoming events, etc."
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "0.35rem",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "1rem",
                      fontFamily: tokens.font.body,
                      resize: "vertical",
                    }}
                  />
                </label>
              </div>
            )}

            {/* === Scoring (nested) === */}
            <div
              style={nestedHeaderStyle}
              onClick={() => toggleSection("scoringSettings")}
            >
              <span>🎯 Scoring</span>
              <span>{expandedSections.scoringSettings ? "▼" : "▶"}</span>
            </div>

            {expandedSections.scoringSettings && (
              <div style={nestedContentStyle}>
                <div style={{ marginBottom: "0.6rem" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.25rem",
                      fontWeight: "bold",
                    }}
                  >
                    Scoring type
                  </label>
                  <select
                    value={scoringMode}
                    onChange={(e) => setScoringMode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.35rem",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "1rem",
                      fontFamily: tokens.font.body,
                    }}
                  >
                    <option value="pub" style={{ backgroundColor: "#2B394A" }}>
                      Pub (fixed points)
                    </option>
                    <option
                      value="pooled"
                      style={{ backgroundColor: "#2B394A" }}
                    >
                      Pooled (static)
                    </option>
                    <option
                      value="pooled-adaptive"
                      style={{ backgroundColor: "#2B394A" }}
                    >
                      Adaptive (pooled per team)
                    </option>
                  </select>
                </div>

                {scoringMode === "pub" && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.25rem",
                        fontWeight: "bold",
                      }}
                    >
                      Points per question
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={pubPoints}
                      onChange={(e) => setPubPoints(Number(e.target.value))}
                      style={{
                        width: "90px",
                        padding: "0.35rem",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255,255,255,0.1)",
                        color: "#fff",
                        fontSize: "1rem",
                        fontFamily: tokens.font.body,
                      }}
                    />
                  </div>
                )}

                {scoringMode === "pooled" && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.25rem",
                        fontWeight: "bold",
                      }}
                    >
                      Pool per question
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={poolPerQuestion}
                      onChange={(e) =>
                        setPoolPerQuestion(Number(e.target.value))
                      }
                      style={{
                        width: "110px",
                        padding: "0.35rem",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255,255,255,0.1)",
                        color: "#fff",
                        fontSize: "1rem",
                        fontFamily: tokens.font.body,
                      }}
                    />
                  </div>
                )}

                {scoringMode === "pooled-adaptive" && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.25rem",
                        fontWeight: "bold",
                      }}
                    >
                      Pool contribution per team
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={poolContribution}
                      onChange={(e) =>
                        setPoolContribution(Number(e.target.value))
                      }
                      style={{
                        width: "110px",
                        padding: "0.35rem",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255,255,255,0.1)",
                        color: "#fff",
                        fontSize: "1rem",
                        fontFamily: tokens.font.body,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* === Prizes (nested inside show settings) === */}
            <div
              style={nestedHeaderStyle}
              onClick={() => toggleSection("prizesSettings")}
            >
              <span>🏆 Prizes</span>
              <span>{expandedSections.prizesSettings ? "▼" : "▶"}</span>
            </div>

            {expandedSections.prizesSettings && (
              <div style={nestedContentStyle}>
                <label style={{ display: "block", marginBottom: "0.5rem" }}>
                  <span style={{ display: "block", marginBottom: "0.25rem" }}>
                    Prize provider:
                  </span>
                  <input
                    type="text"
                    value={hostInfo?.prizeProvider || ""}
                    onChange={(e) =>
                      setHostInfo({
                        ...hostInfo,
                        prizeProvider: e.target.value,
                      })
                    }
                    placeholder="e.g., Ciao Thyme"
                    style={{
                      width: "100%",
                      padding: "0.35rem",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "1rem",
                      fontFamily: tokens.font.body,
                    }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: "0.65rem" }}>
                  <span style={{ display: "block", marginBottom: "0.25rem" }}>
                    Number of prizes:
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={prizeCount}
                    onChange={(e) => {
                      const n = Math.max(0, Number(e.target.value || 0));
                      setPrizeCount(n);

                      const nextDrafts = [...prizeDrafts];
                      while (nextDrafts.length < n) nextDrafts.push("");
                      while (nextDrafts.length > n) nextDrafts.pop();

                      setPrizeDrafts(nextDrafts);
                      commitPrizes(nextDrafts);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.35rem",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "1rem",
                      fontFamily: tokens.font.body,
                    }}
                  />
                </label>

                {Array.from({ length: prizeCount }).map((_, idx) => (
                  <label
                    key={idx}
                    style={{ display: "block", marginBottom: "0.5rem" }}
                  >
                    <span style={{ display: "block", marginBottom: "0.25rem" }}>
                      Prize {idx + 1}:
                    </span>
                    <input
                      type="text"
                      value={prizeDrafts[idx] || ""}
                      onChange={(e) => {
                        const next = [...prizeDrafts];
                        next[idx] = e.target.value;
                        setPrizeDrafts(next);
                        commitPrizes(next);
                      }}
                      placeholder={
                        idx === 0
                          ? "e.g., $25 gift card"
                          : "e.g., $10 gift card"
                      }
                      style={{
                        width: "100%",
                        padding: "0.35rem",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255,255,255,0.1)",
                        color: "#fff",
                        fontSize: "1rem",
                        fontFamily: tokens.font.body,
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Script Modal */}
      {scriptOpen && (
        <div
          onMouseDown={() => setScriptOpen(false)}
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
              width: "75vw",
              height: "75vh",
              maxWidth: "100vw",
              maxHeight: "100vh",
              background: "#fff",
              borderRadius: ".6rem",
              border: `1px solid ${theme.accent}`,
              overflow: "auto",
              resize: "both",
              boxShadow: "0 10px 30px rgba(0,0,0,.25)",
              fontFamily: tokens.font.body,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                background: theme.dark,
                color: "#fff",
                padding: ".6rem .8rem",
                borderBottom: `2px solid ${theme.accent}`,
                fontFamily: tokens.font.display,
                fontSize: "1.5rem",
                letterSpacing: ".01em",
              }}
            >
              Host Script
            </div>

            <textarea
              readOnly
              value={hostScript}
              style={{
                width: "100%",
                flex: 1,
                resize: "none",
                padding: "1rem",
                border: "none",
                borderTop: "1px solid #ddd",
                borderBottom: "1px solid #ddd",
                fontFamily: tokens.font.body,
                lineHeight: 1.35,
                fontSize: "1.25rem",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                boxSizing: "border-box",
              }}
            />

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
                onClick={() => setScriptOpen(false)}
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
    </div>
  );
}
