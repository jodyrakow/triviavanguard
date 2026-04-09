// src/DisplayMode.js
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { colors as theme, tokens } from "./styles";
import triviaVanguardLogo from "./trivia-vanguard-logo-white.svg";
import { marked } from "marked";
import { supabase } from "./supabaseClient.js";
marked.setOptions({ breaks: true });
export default function DisplayMode() {
  const params = new URLSearchParams(window.location.search);
  const urlVenueShowId = params.get("venueShowId");

  const [displayState, setDisplayState] = useState({ type: "standby", content: null });
  const [fontSize, setFontSize] = useState(190); // percentage
  const [inlineImageIndex, setInlineImageIndex] = useState(0); // Current inline image index
  const [questionCarousel, setQuestionCarousel] = useState(null); // { questions: [], currentIndex: 0, autoCycle: true }

  const [showGuide, setShowGuide] = useState(false);

  // Read remaining params from URL
  const urlVenueName = decodeURIComponent(params.get("venueName") || "");
  const urlHostId = params.get("hostId");
  const urlHostName = decodeURIComponent(params.get("hostName") || "");
  const isViewer = params.get("viewer") === "1";

  // Set tab title
  useEffect(() => {
    document.title = "TriviaVanguard display";
  }, []);

  // Keep a ref to current displayState so the broadcast handler can respond with it without stale closures
  const displayStateRef = React.useRef(displayState);
  useEffect(() => { displayStateRef.current = displayState; }, [displayState]);

  // Listen for display updates via Supabase Realtime broadcast
  useEffect(() => {
    if (!supabase || !urlVenueShowId) return;

    const handleMessage = ({ type, content }) => {
      console.log("[DisplayMode] Received update:", type, content);

      if (type === "fontSize") {
        setFontSize(content.size);
      } else if (type === "toggleGuide") {
        setShowGuide((v) => !v);
      } else if (type === "setGuide") {
        setShowGuide(!!content?.show);
      } else if (type === "questionCarousel") {
        setQuestionCarousel(content);
      } else if (type === "closeQuestionCarousel") {
        setQuestionCarousel(null);
      } else if (type === "updateInlineImageIndex") {
        setInlineImageIndex(content.currentIndex || 0);
      } else {
        setDisplayState({ type, content });
        if (type === "question" && content?.currentInlineImageIndex != null) {
          setInlineImageIndex(content.currentInlineImageIndex);
        }
      }
    };

    // Subscribe to broadcast channel for display commands
    const broadcastCh = supabase
      .channel(`tv:display:${urlVenueShowId}`)
      .on("broadcast", { event: "display_update" }, (msg) => {
        handleMessage(msg.payload || {});
      })
      .on("broadcast", { event: "request_state" }, () => {
        // Another display/preview is asking what's currently showing — respond after a short delay
        // so any in-flight display_update broadcasts arrive first and win
        setTimeout(() => {
          const current = displayStateRef.current;
          if (current && current.type !== "standby") {
            broadcastCh.send({
              type: "broadcast",
              event: "display_update",
              payload: { type: current.type, content: current.content },
            });
          }
        }, 300);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Ask any existing display window what it's currently showing
          broadcastCh.send({
            type: "broadcast",
            event: "request_state",
            payload: {},
          });
        }
      });

    // Join shared presence channel — viewers are invisible (no track)
    let presenceCh = null;
    if (!isViewer) {
      presenceCh = supabase.channel("tv:displays");
      presenceCh.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceCh.track({ venueShowId: urlVenueShowId, venueName: urlVenueName, hostId: urlHostId, hostName: urlHostName });
        }
      });
    }

    return () => {
      supabase.removeChannel(broadcastCh);
      if (presenceCh) supabase.removeChannel(presenceCh);
    };
  }, [urlVenueShowId, urlHostId, urlHostName]);

  const displayContent = (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        backgroundColor: theme.bg,
        overflow: "hidden",
        fontFamily: tokens.font.body,
        fontSize: "32px",
        color: theme.dark,
      }}
    >
      {/* Logo - top right */}
      <img
        src={triviaVanguardLogo}
        alt="Trivia Vanguard"
        style={{
          position: "absolute",
          top: "4vh",
          right: "5vh",
          height: "8vh",
          zIndex: 100,
        }}
      />

      {displayState.type === "standby" && <StandbyScreen />}
      {displayState.type === "question" && (
        <QuestionDisplay
          content={displayState.content}
          fontSize={fontSize}
          inlineImageIndex={inlineImageIndex}
        />
      )}
      {displayState.type === "category" && (
        <CategoryDisplay content={displayState.content} fontSize={fontSize} />
      )}
      {displayState.type === "message" && (
        <MessageDisplay key={displayState.content?.text} content={displayState.content} fontSize={fontSize} />
      )}
      {displayState.type === "standings" && (
        <StandingsDisplay content={displayState.content} />
      )}
      {displayState.type === "results" && (
        <ResultsDisplay content={displayState.content} fontSize={fontSize} />
      )}
      {displayState.type === "results-splash" && (
        <ResultsSplashDisplay fontSize={fontSize} />
      )}
      {displayState.type === "results-tb-combined" && (
        <ResultsTbCombinedDisplay content={displayState.content} fontSize={fontSize} />
      )}

      {showGuide && <DesignGuideOverlay />}

      {/* Question carousel */}
      {questionCarousel &&
        questionCarousel.questions &&
        questionCarousel.questions.length > 0 && (
          <QuestionCarousel
            questions={questionCarousel.questions}
            currentIndex={questionCarousel.currentIndex || 0}
            autoCycle={questionCarousel.autoCycle || false}
            fontSize={fontSize}
            onClose={() => setQuestionCarousel(null)}
          />
        )}
    </div>
  );

  return displayContent;
}
function DesignGuideOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 999999,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100vw",
          maxHeight: "100vh",
          aspectRatio: "16 / 9",
          border: "3px dashed rgba(255,255,255,1)", // TEMP: red so you can see it
          borderRadius: 10,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function StandbyScreen() {
  return (
    <img
      src={triviaVanguardLogo}
      alt="Trivia Vanguard"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "60vw",
        height: "auto",
        objectFit: "contain",
      }}
    />
  );
}

function CategoryDisplay({ content, fontSize = 100 }) {
  const { categoryName, categoryDescription } = content || {};
  const scale = fontSize / 100;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,

        display: "flex",
        flexDirection: "column",
        alignItems: "center", // horizontal centering
        textAlign: "center",

        padding: "0 6vw",
      }}
    >
      {/* Spacer to push content down ~1/4–1/3 of screen */}
      <div style={{ height: "33vh" }} />

      {/* Category name */}
      {categoryName && (
        <div
          style={{
            fontSize: `${4.5 * scale}rem`,
            fontWeight: 700,
            color: theme.accent,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            marginBottom: "2vh",
          }}
          dangerouslySetInnerHTML={{
            __html: marked.parseInline(categoryName || ""),
          }}
        />
      )}

      {/* Category description */}
      {categoryDescription && (
        <div
          style={{
            fontSize: `${2.5 * scale}rem`,
            fontFamily: tokens.font.flavor,
            fontStyle: "italic",
            lineHeight: 1.25,
            color: theme.dark,
            maxWidth: "80vw",
          }}
          dangerouslySetInnerHTML={{
            __html: marked.parseInline(categoryDescription || ""),
          }}
        />
      )}
    </div>
  );
}

function AutoFitText({ html, maxRem = 2.8, minRem = 1.6, style = {} }) {
  const containerRef = React.useRef(null);
  const textRef = React.useRef(null);
  const [fontRem, setFontRem] = React.useState(maxRem);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    let size = maxRem;
    text.style.fontSize = `${size}rem`;

    while (size > minRem && text.scrollHeight > container.clientHeight) {
      size -= 0.1;
      text.style.fontSize = `${size}rem`;
    }

    setFontRem(size);
  }, [html, maxRem, minRem]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        ref={textRef}
        style={{
          fontSize: `${fontRem}rem`,
          lineHeight: 1.25,
          textAlign: "center",
          width: "100%", // Ensure text wraps within container width
          boxSizing: "border-box",
          ...style, // 👈 THIS is where color comes from
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function QuestionDisplay({ content, fontSize = 100, inlineImageIndex = 0 }) {
  const {
    questionNumber,
    questionText,
    categoryName,
    answer,
    pointsPerTeam,
    correctCount,
    totalTeams,
    inlineImages,
    bonusBreakdown,
    partialBreakdown,
  } = content || {};

  const scale = fontSize / 100;

  // Auto-shrink category name to fit one line in the gray bar
  const catNameRef = useRef(null);
  useLayoutEffect(() => {
    const el = catNameRef.current;
    if (!el || !categoryName) return;
    const maxSize = 2.5 * scale;
    el.style.fontSize = `${maxSize}rem`;
    let size = maxSize;
    while (el.scrollWidth > el.offsetWidth && size > 0.6) {
      size = Math.max(0.6, size - 0.05);
      el.style.fontSize = `${size}rem`;
    }
  }, [categoryName, scale]);

  // 16:9 grid (based on 900px tall mock)
  const H_CAT = "14vh"; // 125px
  const H_QNUM = "10vh"; // 75px
  const H_QBOX = "48vh"; // 450px
  const H_LINE = "8vh"; // 75px

  // Convenience: cumulative tops

  const TOP_QBOX = `calc(${H_CAT} + ${H_QNUM})`;
  const TOP_ANSWER = `calc(${H_CAT} + ${H_QNUM} + ${H_QBOX})`;
  const TOP_STATS1 = `calc(${TOP_ANSWER} + ${H_LINE})`;
  const TOP_STATS2 = `calc(${TOP_STATS1} + ${H_LINE})`;

  const GAP_AFTER_CAT = "0.75vh"; // ← adjust this number
  const TOP_QNUM = `calc(${H_CAT} + ${GAP_AFTER_CAT})`;

  return (
    <>
      {/* Category bar at top - gray bar behind logo */}
      {categoryName && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: H_CAT,
            backgroundColor: theme.gray.neutral,
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            paddingLeft: "3rem",
            zIndex: 50,
          }}
        >
          <div
            ref={catNameRef}
            style={{
              fontSize: `${2.5 * scale}rem`,
              fontWeight: 600,
              color: theme.dark,
              textTransform: "uppercase",
              paddingTop: "2rem",
              letterSpacing: "0.05rem",
              maxWidth: "calc(100% - 200px)",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
            dangerouslySetInnerHTML={{
              __html: marked.parseInline(categoryName || ""),
            }}
          />
        </div>
      )}

      {/* Question number */}
      {questionNumber && (
        <div
          style={{
            position: "absolute",
            top: TOP_QNUM,
            left: 0,
            right: 0,
            height: H_QNUM,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              fontSize: `${3.5 * scale}rem`,
              fontWeight: 800,
              color: theme.accent,
              textTransform: "uppercase",
            }}
          >
            {questionNumber === "TB" ? "TIEBREAKER" : questionNumber}
          </div>
        </div>
      )}

      {/* Question text or inline image for Visual questions */}
      {(questionText || (inlineImages && inlineImages.length > 0)) && (
        <div
          style={{
            position: "absolute",
            top: TOP_QBOX,
            left: 0,
            right: 0,
            height: H_QBOX,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            zIndex: 50,
            padding: "0 2vw",
          }}
        >
          {inlineImages && inlineImages.length > 0 && questionText ? (
            // Show both image and text side-by-side for numbered questions with images
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "100%",
                gap: "2vw",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Image on left (50%) */}
              <div
                style={{
                  width: "44vw",
                  height: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <img
                  src={inlineImages[inlineImageIndex]?.url}
                  alt={`Question ${questionNumber}`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
              {/* Text on right (50%) */}
              <div style={{ width: "44vw", height: "48vh" }}>
                <AutoFitText
                  html={marked.parseInline(questionText || "")}
                  maxRem={2.8 * scale}
                  minRem={1.0 * scale}
                  style={{
                    color: theme.dark,
                    fontWeight: 500,
                  }}
                />
              </div>
            </div>
          ) : inlineImages && inlineImages.length > 0 ? (
            // Show only inline image for Visual questions (no text)
            <img
              src={inlineImages[inlineImageIndex]?.url}
              alt={`Visual question ${questionNumber}`}
              style={{
                maxWidth: "90vw",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            // Show only question text for regular questions (no image)
            <div style={{ width: "90vw", height: "100%" }}>
              <AutoFitText
                html={marked.parseInline(questionText || "")}
                maxRem={2.8 * scale}
                minRem={1.0 * scale}
                style={{
                  color: theme.dark,
                  fontWeight: 500,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Answer (if provided) */}
      {answer && (
        <div
          style={{
            position: "absolute",
            top: TOP_ANSWER,
            left: 0,
            right: 0,
            height: H_LINE,
            display: "flex",

            justifyContent: "center",
            alignItems: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              fontSize: `${2.4 * scale}rem`,
              fontWeight: 800,
              color: theme.accent,
              textAlign: "center",
            }}
            dangerouslySetInnerHTML={{
              __html: marked.parseInline(answer || ""),
            }}
          />
        </div>
      )}

      {/* Stats for all scoring modes - only show if stats are actually provided */}
      {answer &&
        ((correctCount != null && totalTeams != null) ||
          pointsPerTeam != null) && (
          <div
            style={{
              position: "absolute",

              top: TOP_STATS1,
              left: 0,
              right: 0,
              height: H_LINE,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: `${2.25 * scale}rem`,
                color: theme.dark,
                fontFamily: tokens.font.body,
              }}
            >
              {correctCount} / {totalTeams} teams correct
            </div>
          </div>
        )}

      {/* Stats wrapper #2 (points per team / bonus breakdown / partial breakdown) */}
      {answer &&
        (pointsPerTeam != null ||
          (bonusBreakdown && bonusBreakdown.length > 0) ||
          (partialBreakdown && partialBreakdown.length > 0)) && (
          <div
            style={{
              position: "absolute",
              top: TOP_STATS2,
              left: 0,
              right: 0,
              height: H_LINE,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 100,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: `${((bonusBreakdown && bonusBreakdown.length > 1) || (partialBreakdown && partialBreakdown.length > 1) ? 1.8 : 2.25) * scale}rem`,
                color: theme.dark,
                fontFamily: tokens.font.body,
              }}
            >
              {bonusBreakdown && bonusBreakdown.length > 1 ? (
                bonusBreakdown.map((level, i) => (
                  <span key={level.bonusLevel}>
                    {i > 0 && " · "}
                    <span style={{ color: theme.accent, fontWeight: 700 }}>
                      {level.pointsPerTeam}
                    </span>
                    {" pts"}
                    {level.bonusLevel > 0 && (
                      <span style={{ opacity: 0.7 }}>
                        {" "}
                        ({level.bonusLevel}{" "}
                        {"bonus" + (level.bonusLevel > 1 ? "es" : "")})
                      </span>
                    )}
                  </span>
                ))
              ) : partialBreakdown && partialBreakdown.length > 0 ? (
                partialBreakdown.map((level, i) => (
                  <span key={level.partialCount}>
                    {i > 0 && " · "}
                    <span style={{ color: theme.accent, fontWeight: 700 }}>
                      {level.teamCount}
                    </span>
                    {" " + (level.teamCount === 1 ? "team" : "teams")}
                    <span style={{ opacity: 0.7 }}>
                      {" ("}
                      {level.partialCount === level.numParts
                        ? "full"
                        : `${level.partialCount}/${level.numParts}`}
                      {" · "}
                      {level.pointsPerTeam}
                      {" pts)"}
                    </span>
                  </span>
                ))
              ) : (
                <>
                  <span
                    style={{
                      color: theme.accent,
                      fontWeight: 700,
                    }}
                  >
                    {pointsPerTeam}
                  </span>{" "}
                  points per team
                </>
              )}
            </div>
          </div>
        )}
    </>
  );
}

function MessageDisplay({ content, fontSize = 100 }) {
  const { text, fontSize: customFontSize, imageUrl } = content || {};
  const scale = (customFontSize || fontSize) / 100;

  // If we have both text and image, show side-by-side layout
  if (imageUrl && text) {
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4vw",
          padding: "4vh 6vw",
        }}
      >
        {/* Image on left */}
        <div
          style={{
            width: "45vw",
            height: "80vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            src={imageUrl}
            alt=""
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        </div>
        {/* Text on right */}
        <div
          style={{
            width: "40vw",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            fontSize: `${4 * scale}rem`,
            fontWeight: 600,
            lineHeight: 1.2,
            color: theme.dark,
          }}
          dangerouslySetInnerHTML={{
            __html: marked.parseInline(text || ""),
          }}
        />
      </div>
    );
  }

  // Image only - center it large
  if (imageUrl) {
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "4vh",
        }}
      >
        <img
          src={imageUrl}
          alt=""
          style={{
            maxWidth: "90vw",
            maxHeight: "85vh",
            objectFit: "contain",
          }}
        />
      </div>
    );
  }

  // Text only (original behavior)
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,

        display: "flex",
        justifyContent: "center", // horizontal centering
        alignItems: "center", // vertical centering

        textAlign: "center",
        padding: "4vh",

        fontSize: `${5 * scale}rem`,
        fontWeight: 600,
        lineHeight: 1.2,
        color: theme.dark,
      }}
      dangerouslySetInnerHTML={{
        __html: marked.parseInline(text || ""),
      }}
    />
  );
}

function StandingsDisplay({ content }) {
  const { standings = [] } = content || {};

  return (
    <>
      <h1
        style={{
          fontSize: "3.5rem",
          fontWeight: 700,
          color: theme.accent,
          marginBottom: "2rem",
        }}
      >
        Current Standings
      </h1>
      <div style={{ fontSize: "2rem" }}>
        {standings.map((team, idx) => (
          <div
            key={team.showTeamId || idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1rem 2rem",
              marginBottom: "0.5rem",
              backgroundColor: theme.white,
              borderRadius: "8px",
              border: `2px solid ${theme.gray.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "2.5rem",
                  color: theme.accent,
                  minWidth: "60px",
                }}
              >
                {team.place}
              </div>
              <div style={{ fontWeight: 600 }}>{team.teamName}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: "2.5rem" }}>
              {team.total}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function QuestionCarousel({
  questions,
  currentIndex,
  autoCycle = false,
  fontSize = 100,
  onClose,
}) {
  const [idx, setIdx] = useState(currentIndex);

  // Update index when host changes the current question
  useEffect(() => {
    setIdx(currentIndex);
  }, [currentIndex, questions]);

  // Auto-cycle through questions every 8 seconds when autoCycle is true
  useEffect(() => {
    if (!autoCycle || questions.length <= 1) return;

    const interval = setInterval(() => {
      setIdx((prevIdx) => (prevIdx + 1) % questions.length);
    }, 8000); // 8 seconds

    return () => clearInterval(interval);
  }, [autoCycle, questions.length]);

  // Get current question
  const currentQuestion = questions[idx] || {};

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        backgroundColor: theme.bg,
        zIndex: 9999,
        cursor: "pointer",
      }}
    >
      {/* Display the question using QuestionDisplay component */}
      <QuestionDisplay
        content={currentQuestion}
        fontSize={fontSize}
        inlineImageIndex={currentQuestion.currentInlineImageIndex || 0}
      />
    </div>
  );
}

function ResultsDisplay({ content, fontSize = 100 }) {
  if (!content) return null;

  const { place, teams = [], prize, isTied, points } = content;
  const scale = fontSize / 100;

  // 16:9 grid bands (based on 900px tall mock style)
  // Total = 100vh
  const H_TOP = "4vh"; // breathing room
  const H_PLACE = "14vh"; // big place line
  const H_POINTS = "14vh"; // points line
  const H_TEAMS = "48vh"; // big teams box (auto-fit)
  const H_PRIZE = "14vh"; // prize line

  const TOP_PLACE = `calc(${H_TOP})`;
  const TOP_POINTS = `calc(${H_TOP} + ${H_PLACE})`;
  const TOP_TEAMS = `calc(${H_TOP} + ${H_PLACE} + ${H_POINTS})`;
  const TOP_PRIZE = `calc(${H_TOP} + ${H_PLACE} + ${H_POINTS} + ${H_TEAMS})`;

  // Build HTML for teams with line breaks; escape < >
  const teamsHtml = (teams || [])
    .map((t) => String(t).replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .join("<br/>");

  return (
    <>
      {/* PLACE */}
      {place != null && (
      <div
        style={{
          position: "absolute",
          top: TOP_PLACE,
          left: 0,
          right: 0,
          height: H_PLACE,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          zIndex: 50,
          padding: "0 4vw",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: `${4.75 * scale}rem`,
            fontFamily: tokens.font.display,
            color: theme.accent,
            textTransform: "uppercase",
            letterSpacing: "0.15rem",
            fontWeight: 800,
            lineHeight: 1.05,
          }}
        >
          {isTied
            ? `TIED FOR ${place} place`
            : `${place} place`}
        </div>
      </div>
      )}

      {/* POINTS */}
      {points != null && (
        <div
          style={{
            position: "absolute",
            top: TOP_POINTS,
            left: 0,
            right: 0,
            height: H_POINTS,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            zIndex: 50,
            padding: "0 4vw",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: `${3.75 * scale}rem`,
              fontFamily: tokens.font.body,
              color: theme.dark,
              fontWeight: 600,
              lineHeight: 1.1,
            }}
          >
            {points} {points === 1 ? "point" : "points"}
          </div>
        </div>
      )}

      {/* TEAM NAMES (AUTO-FIT inside fixed box) */}
      {teams && teams.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: TOP_TEAMS,
            left: 0,
            right: 0,
            height: H_TEAMS,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            zIndex: 50,
            padding: "0 6vw",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "90vw",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <AutoFitText
              html={teamsHtml}
              maxRem={4.75 * scale}
              minRem={1.5 * scale}
              style={{
                color: theme.dark,
                fontFamily: tokens.font.body,
                fontWeight: 700,
                lineHeight: 1.15,
                textAlign: "center",
              }}
            />
          </div>
        </div>
      )}

      {/* PRIZE */}
      {prize && (
        <div
          style={{
            position: "absolute",
            top: TOP_PRIZE,
            left: 0,
            right: 0,
            height: H_PRIZE,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            zIndex: 50,
            padding: "0 6vw",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: `${4 * scale}rem`,
              fontFamily: tokens.font.body,
              color: theme.accent,
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            {prize}
          </div>
        </div>
      )}
    </>
  );
}

function ResultsSplashDisplay({ fontSize = 100 }) {
  const scale = fontSize / 100;
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      zIndex: 50,
    }}>
      <div style={{
        fontSize: `${7 * scale}rem`,
        fontFamily: tokens.font.display,
        color: theme.accent,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.2rem",
        lineHeight: 1.05,
        textAlign: "center",
      }}>
        Results
      </div>
    </div>
  );
}

function ResultsTbCombinedDisplay({ content, fontSize = 100 }) {
  if (!content) return null;
  const { tbQuestion, tbAnswer, tbNumber, tbTeamsAndGuesses = [] } = content;
  const scale = fontSize / 100;

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      padding: "4vh 6vw",
      boxSizing: "border-box",
      zIndex: 50,
      gap: "3vh",
    }}>
      {/* TB Question */}
      {tbQuestion && (
        <div style={{
          fontSize: `${2.2 * scale}rem`,
          fontFamily: tokens.font.body,
          color: theme.dark,
          fontWeight: 600,
          textAlign: "center",
          lineHeight: 1.3,
        }}>
          {tbQuestion}
        </div>
      )}
      {/* TB Answer */}
      {tbAnswer && (
        <div style={{
          fontSize: `${3 * scale}rem`,
          fontFamily: tokens.font.display,
          color: theme.accent,
          fontWeight: 800,
          textAlign: "center",
        }}>
          {tbAnswer}{tbNumber != null ? ` (${tbNumber})` : ""}
        </div>
      )}
      {/* Teams and guesses */}
      {tbTeamsAndGuesses.length > 0 && (
        <div style={{
          display: "flex", flexDirection: "column", gap: "1vh",
          width: "100%", maxWidth: "80vw", alignItems: "center",
        }}>
          {tbTeamsAndGuesses.map((tg, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              width: "100%", gap: "2vw",
            }}>
              <span style={{
                fontSize: `${1.8 * scale}rem`,
                fontFamily: tokens.font.body,
                color: theme.dark,
                fontWeight: 600,
                flex: 1,
                textAlign: "right",
              }}>
                {tg.teamName}
              </span>
              <span style={{
                fontSize: `${1.6 * scale}rem`,
                fontFamily: tokens.font.body,
                color: theme.dark,
                fontStyle: "italic",
                flex: 1,
                textAlign: "left",
              }}>
                {tg.guess != null ? `Triviots guessed ${tg.guess}` : "no guess"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
