// Sidebar.js - Collapsible sidebar drawer with hamburger menu
import React, { useState, useMemo, useRef } from "react";
import Draggable from "react-draggable";
import { tokens, colors as theme } from "./styles/index.js";

export default function Sidebar({
  children,
  setShowDetails,
  displayControlsOpen,
  setDisplayControlsOpen,
  onOpenVenuePicker,
  showTimer,
  setShowTimer,
  showAnswerKey,
  setShowAnswerKey,
  refreshBundle,
  getClosestQuestionKey,
  questionRefs,
  showBundle,
  hostInfo,
  prizes,
  scoringMode,
  pubPoints,
  poolPerQuestion,
  poolContribution,
  sendToDisplay,
  scriptPanelOpen,
  setScriptPanelOpen,
  navIndex,
  navStarted,
  navRulesLength,
  onResetNav,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const scriptPanelRef = useRef(null);
  const [scriptPanelPosition, setScriptPanelPosition] = useState(() => {
    try {
      const saved = localStorage.getItem("scriptPanelPosition");
      return saved ? JSON.parse(saved) : { x: 80, y: 80 };
    } catch { return { x: 80, y: 80 }; }
  });

  // ========== HOST SCRIPT GENERATION (moved from QuestionsMode) ==========

  // Helper: check if question is tiebreaker
  const isTB = (q) => {
    const questionType = String(
      q?.questionType || q?.["Question type"] || "",
    ).toLowerCase();
    const questionOrder = String(
      q?.questionOrder || q?.["Question order"] || "",
    ).toUpperCase();
    return questionType === "tiebreaker" || questionOrder === "TB";
  };

  // Compute all rounds and total questions
  const allRounds = useMemo(
    () => showBundle?.rounds ?? [],
    [showBundle?.rounds],
  );

  const totalQuestions = useMemo(() => {
    let count = 0;
    for (const r of allRounds) {
      for (const q of r?.questions || []) {
        const typ = String(
          q?.questionType || q?.["Question type"] || "",
        ).toLowerCase();
        if (typ.includes("tiebreaker")) continue;
        count += 1;
      }
      for (const cat of r?.categories || []) {
        for (const q of cat?.questions || []) {
          const typ = String(
            q?.questionType || q?.["Question type"] || cat?.questionType || "",
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
    let spokenCategoryCount = 0;
    const spokenCategorySizes = [];

    for (const r of allRounds) {
      for (const cat of r?.categories || []) {
        const catQuestionType = String(
          cat?.questionType || cat?.["Question type"] || "",
        ).toLowerCase();

        const catQuestions = (cat?.questions || []).filter((q) => !isTB(q));

        if (catQuestionType.includes("visual")) {
          visualCategoryCount += 1;
          visualQuestionCount += catQuestions.length;
        } else if (catQuestionType.includes("audio")) {
          audioQuestionCount += catQuestions.length;
        } else if (catQuestions.length === 0) {
          // skip empty/tiebreaker-only categories
        } else {
          // Spoken category
          spokenCategoryCount += 1;
          spokenQuestionCount += catQuestions.length;
          spokenCategorySizes.push(catQuestions.length);
        }
      }
    }

    // Calculate questions per spoken category (most common size)
    const questionsPerSpokenCategory =
      spokenCategorySizes.length > 0
        ? Math.round(spokenQuestionCount / spokenCategoryCount)
        : 0;

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
          `${visualQuestionCount} visual question${visualQuestionCount === 1 ? "" : "s"}`,
        );
      }

      if (spokenQuestionCount > 0) {
        let spokenText = `${spokenQuestionCount} spoken word question${spokenQuestionCount === 1 ? "" : "s"}`;

        // Add category breakdown if there are spoken categories
        if (spokenCategoryCount > 0 && questionsPerSpokenCategory > 0) {
          spokenText += ` divided into categories of ${questionsPerSpokenCategory} question${questionsPerSpokenCategory === 1 ? "" : "s"} each`;
        }

        parts.push(spokenText);
      }

      if (audioQuestionCount > 0) {
        parts.push(
          `${audioQuestionCount} audio question${audioQuestionCount === 1 ? "" : "s"}`,
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
          visualCategoryCount > 1
            ? "the first visual round"
            : "the visual round";
      }

      if (hasCohost) {
        text += `${cName} is coming around with ${visualDescriptor}. That's your signal to put those phones away because the contest starts now. Good luck!`;
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

  // Which RULES_ITEMS index is currently highlighted (null if not in rules section)
  const activeRulesIndex = navStarted && navIndex < navRulesLength ? navIndex : null;

  // Split hostScript into segments for per-rule highlighting
  // The rules section starts with "\nNow before we get going"
  // Bullets map: 0→ruleIdx1, 1→ruleIdx2, 2→ruleIdx3, 3+4→ruleIdx4, 5→ruleIdx5, 6→ruleIdx5, closing→ruleIdx6
  const scriptSections = useMemo(() => {
    const rulesMarker = "\nNow before we get going";
    const rulesStart = hostScript.indexOf(rulesMarker);
    if (rulesStart === -1) return [{ text: hostScript, ruleIndex: null }];

    const preRules = hostScript.slice(0, rulesStart);
    const rulesBody = hostScript.slice(rulesStart);

    // Find all ● positions
    const bulletPos = [];
    let from = 0;
    while (true) {
      const pos = rulesBody.indexOf("●", from);
      if (pos === -1) break;
      bulletPos.push(pos);
      from = pos + 1;
    }

    if (bulletPos.length < 6) return [{ text: preRules, ruleIndex: null }, { text: rulesBody, ruleIndex: null }];

    const seg = (start, end) => rulesBody.slice(start, end);

    // ruleIndex 0 = "Get ready" (intro before first bullet)
    // ruleIndex 1 = No devices (bullet 0)
    // ruleIndex 2 = Don't shout (bullet 1)
    // ruleIndex 3 = Spelling (bullet 2)
    // ruleIndex 4 = Names (bullets 3+4)
    // ruleIndex 5 = Our answer + be generous (bullets 5+6)
    // ruleIndex 6 = Phones away (closing paragraph after last bullet)
    const sections = [
      { text: preRules, ruleIndex: null },
      { text: seg(0, bulletPos[0]), ruleIndex: 0 },
      { text: seg(bulletPos[0], bulletPos[1]), ruleIndex: 1 },
      { text: seg(bulletPos[1], bulletPos[2]), ruleIndex: 2 },
      { text: seg(bulletPos[2], bulletPos[3]), ruleIndex: 3 },
      { text: seg(bulletPos[3], bulletPos[5]), ruleIndex: 4 },
      { text: seg(bulletPos[5], undefined), ruleIndex: 5 },
    ];

    // If there's a closing paragraph (visual round text), split it off as ruleIndex 6
    const lastSec = sections[sections.length - 1];
    const closingMarker = "\n\n";
    const closingPos = lastSec.text.lastIndexOf(closingMarker);
    if (closingPos !== -1) {
      sections[sections.length - 1] = { text: lastSec.text.slice(0, closingPos), ruleIndex: 5 };
      sections.push({ text: lastSec.text.slice(closingPos), ruleIndex: 6 });
    }

    return sections;
  }, [hostScript]);

  return (
    <>
      {/* Sidebar with hamburger button always visible */}
      <div
        style={{
          position: "fixed",
          top: "80px", // Below the header
          left: 0,
          width: isOpen ? "250px" : "50px", // Narrow tab when closed
          height: "calc(100vh - 80px)",
          backgroundColor: theme.accent, // Orange
          color: "#fff",
          transition: "width 0.3s ease",
          zIndex: 1000,
          overflowY: isOpen ? "auto" : "hidden",
          boxShadow: isOpen ? "2px 0 8px rgba(0,0,0,0.2)" : "none",
        }}
      >
        {/* Hamburger button inside sidebar */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: "absolute",
            top: "10px",
            right: "8px",
            backgroundColor: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "4px",
            padding: "6px",
            cursor: "pointer",
            color: "#fff",
            fontSize: "20px",
            width: "35px",
            height: "35px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
          }}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          title={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? "×" : "☰"}
        </button>

        {/* Ninja button - Show/hide all answers */}
        <button
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
          style={{
            position: "absolute",
            top: "55px",
            right: "8px",
            backgroundColor: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "4px",
            padding: "6px",
            cursor: "pointer",
            color: "#fff",
            fontSize: "20px",
            width: "35px",
            height: "35px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
          }}
          aria-label="Toggle all answers"
          title="Show/hide all answers"
        >
          🥷
        </button>

        {/* TV button - Show/hide display controls */}
        <button
          onClick={() => {
            // Preserve scroll position
            const closestKey = getClosestQuestionKey?.();
            if (onOpenVenuePicker) {
              onOpenVenuePicker();
            } else {
              setDisplayControlsOpen((prev) => !prev);
            }
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
          style={{
            position: "absolute",
            top: "190px",
            right: "8px",
            backgroundColor: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "4px",
            padding: "6px",
            cursor: "pointer",
            color: "#fff",
            fontSize: "20px",
            width: "35px",
            height: "35px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
          }}
          aria-label="Toggle display controls"
          title="Show/hide display controls"
        >
          📺
        </button>

        {/* Stopwatch button - Show/hide timer */}
        <button
          onClick={() => setShowTimer((prev) => !prev)}
          style={{
            position: "absolute",
            top: "280px",
            right: "8px",
            backgroundColor: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "4px",
            padding: "6px",
            cursor: "pointer",
            color: "#fff",
            fontSize: "20px",
            width: "35px",
            height: "35px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
          }}
          aria-label="Toggle timer"
          title="Show/hide timer"
        >
          ⏱️
        </button>

        {/* Clipboard button - Show/hide answer key */}
        <button
          onClick={() => setShowAnswerKey((prev) => !prev)}
          style={{
            position: "absolute",
            top: "100px",
            right: "8px",
            backgroundColor: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "4px",
            padding: "6px",
            cursor: "pointer",
            color: "#fff",
            fontSize: "20px",
            width: "35px",
            height: "35px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
          }}
          aria-label="Toggle answer key"
          title="Show/hide answer key"
        >
          📋
        </button>

        {/* Refresh button - Refresh questions */}
        <button
          onClick={refreshBundle}
          style={{
            position: "absolute",
            top: "145px",
            right: "8px",
            backgroundColor: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "4px",
            padding: "6px",
            cursor: "pointer",
            color: "#fff",
            fontSize: "20px",
            width: "35px",
            height: "35px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
          }}
          aria-label="Refresh questions"
          title="Refresh questions"
        >
          🔄
        </button>

        {/* Speech bubble button - Show host script */}
        <button
          onClick={() => setScriptPanelOpen((prev) => !prev)}
          style={{
            position: "absolute",
            top: "235px",
            right: "8px",
            backgroundColor: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "4px",
            padding: "6px",
            cursor: "pointer",
            color: "#fff",
            fontSize: "20px",
            width: "35px",
            height: "35px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
          }}
          aria-label="Show script"
          title="Show script"
        >
          💬
        </button>

        {/* Menu content - only visible when open */}
        {isOpen && (
          <div style={{ padding: "12rem 3.5rem 1rem 1rem" }}>{children}</div>
        )}
      </div>

      {/* Overlay when drawer is open */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            top: "80px",
            left: "250px",
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            zIndex: 999,
          }}
        />
      )}

      {/* Script Panel — draggable, stays open while host uses Mission Control */}
      {scriptPanelOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9000 }}>
          <Draggable
            nodeRef={scriptPanelRef}
            position={scriptPanelPosition}
            onStop={(e, data) => {
              const pos = { x: data.x, y: data.y };
              setScriptPanelPosition(pos);
              localStorage.setItem("scriptPanelPosition", JSON.stringify(pos));
            }}
          >
            <div
              ref={scriptPanelRef}
              style={{
                position: "absolute",
                pointerEvents: "auto",
                width: "680px",
                maxWidth: "90vw",
                height: "70vh",
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#fff",
                borderRadius: ".6rem",
                border: `1px solid ${theme.accent}`,
                boxShadow: "0 10px 30px rgba(0,0,0,.25)",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div style={{
                background: theme.dark,
                color: "#fff",
                padding: ".5rem .75rem",
                borderBottom: `2px solid ${theme.accent}`,
                cursor: "grab",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                gap: ".5rem",
                flexShrink: 0,
              }}>
                <span style={{ opacity: 0.5, fontSize: ".9rem" }}>⋮⋮</span>
                <span style={{ flex: 1, fontFamily: tokens.font.display, fontSize: "1.1rem" }}>Host Script</span>
                <button
                  onClick={onResetNav}
                  title="Reset nav to start"
                  style={{
                    fontSize: ".78rem", padding: ".2rem .5rem", borderRadius: ".3rem",
                    border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.1)",
                    color: "#fff", cursor: "pointer",
                  }}
                >↺ Reset to start</button>
                <button
                  onClick={() => setScriptPanelOpen(false)}
                  title="Close"
                  style={{
                    fontSize: ".78rem", padding: ".2rem .45rem", borderRadius: ".3rem",
                    border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.1)",
                    color: "#fff", cursor: "pointer",
                  }}
                >✕</button>
              </div>

              {/* Script body with rule highlighting */}
              <div style={{
                flex: 1,
                overflow: "auto",
                padding: "1rem",
                fontFamily: tokens.font.body,
                fontSize: "1.15rem",
                lineHeight: 1.4,
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
              }}>
                {scriptSections.map((section, i) => (
                  <span
                    key={i}
                    style={
                      activeRulesIndex !== null && activeRulesIndex === section.ruleIndex
                        ? { background: "#ffe066", color: "#1a1a1a", borderRadius: "2px" }
                        : undefined
                    }
                  >{section.text}</span>
                ))}
              </div>
            </div>
          </Draggable>
        </div>
      )}
    </>
  );
}
