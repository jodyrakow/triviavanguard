// src/DisplayMode.js
import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { colors as theme, tokens } from "./styles";
import triviaVanguardLogo from "./trivia-vanguard-logo-white.png";
import { marked } from "marked";

export default function DisplayMode() {
  const [displayState, setDisplayState] = useState({
    type: "standby", // "standby" | "question" | "standings" | "message" | "break"
    content: null,
  });
  const [fontSize, setFontSize] = useState(100); // percentage
  const [imageOverlay, setImageOverlay] = useState(null); // { images: [], currentIndex: 0 }

  // Choose a design resolution for the display canvas
  const DESIGN_WIDTH = 1920;
  const DESIGN_HEIGHT = 1080;

  // How much to scale the canvas to fit the actual window
  const [, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const { innerWidth, innerHeight } = window;
      const scaleX = innerWidth / DESIGN_WIDTH;
      const scaleY = innerHeight / DESIGN_HEIGHT;
      setScale(Math.min(scaleX, scaleY)); // fit within both width & height
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Helper to request browser fullscreen
  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  };

  const [isFullscreen, setIsFullscreen] = useState(
    !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    )
  );

  useEffect(() => {
    const handleFsChange = () => {
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;

      setIsFullscreen(!!fsEl);
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    document.addEventListener("mozfullscreenchange", handleFsChange);
    document.addEventListener("MSFullscreenChange", handleFsChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      document.removeEventListener("mozfullscreenchange", handleFsChange);
      document.removeEventListener("MSFullscreenChange", handleFsChange);
    };
  }, []);

  // Listen for display updates via BroadcastChannel
  useEffect(() => {
    const channel = new BroadcastChannel("tv:display");

    channel.onmessage = (event) => {
      const { type, content } = event.data || {};
      console.log("[DisplayMode] Received update:", type, content);

      if (type === "fontSize") {
        setFontSize(content.size);
      } else if (type === "imageOverlay") {
        setImageOverlay(content);
      } else if (type === "closeImageOverlay") {
        setImageOverlay(null);
      } else {
        setDisplayState({ type, content });
      }
    };

    return () => channel.close();
  }, []);

  return (
    // Outer viewport wrapper – fills the browser window / TV
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000", // black bars if aspect ratios don't match
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Inner 16:9 canvas that auto-scales */}
      <div
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "100vw",
          maxHeight: "100vh",
          aspectRatio: "16 / 9",
          backgroundColor: theme.bg,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: tokens.font.body,
          color: theme.dark,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Logo - top right */}
        <img
          src={triviaVanguardLogo}
          alt="Trivia Vanguard"
          title={isFullscreen ? "Exit full screen" : "Go full screen"}
          onClick={(e) => {
            e.stopPropagation();
            if (isFullscreen) {
              exitFullscreen();
            } else {
              enterFullscreen();
            }
          }}
          style={{
            position: "absolute",
            top: "10px",
            right: "20px",
            height: "80px",
            zIndex: 100,
            cursor: "pointer",
          }}
        />

        {/* Main content area */}
        <div
          style={{
            width: "100%",
            height: "100%",
            textAlign: "center",
            position: "relative",
          }}
        >
          {displayState.type === "standby" && <StandbyScreen />}
          {displayState.type === "question" && (
            <QuestionDisplay
              content={displayState.content}
              fontSize={fontSize}
            />
          )}
          {displayState.type === "questionWithAnswer" && (
            <QuestionDisplay
              content={displayState.content}
              fontSize={fontSize}
            />
          )}
          {displayState.type === "category" && (
            <CategoryDisplay
              content={displayState.content}
              fontSize={fontSize}
            />
          )}
          {displayState.type === "message" && (
            <MessageDisplay
              content={displayState.content}
              fontSize={fontSize}
            />
          )}
          {displayState.type === "standings" && (
            <StandingsDisplay content={displayState.content} />
          )}
          {displayState.type === "results" && (
            <ResultsDisplay
              content={displayState.content}
              fontSize={fontSize}
            />
          )}
        </div>

        {/* Image overlay */}
        {imageOverlay &&
          imageOverlay.images &&
          imageOverlay.images.length > 0 && (
            <ImageOverlay
              images={imageOverlay.images}
              currentIndex={imageOverlay.currentIndex || 0}
              onClose={() => setImageOverlay(null)}
            />
          )}
      </div>
    </div>
  );
}

function StandbyScreen() {
  return (
    <img
      src={triviaVanguardLogo}
      alt="Trivia Vanguard"
      style={{
        maxWidth: "60%",
        maxHeight: "60%",
        objectFit: "contain",
      }}
    />
  );
}

function CategoryDisplay({ content, fontSize = 100 }) {
  const { categoryName, categoryDescription } = content || {};
  const scale = fontSize / 100;

  return (
    <div>
      {/* Category name - large, uppercase, same style as question display but bigger */}
      {categoryName && (
        <div
          style={{
            fontSize: `${5 * scale}rem`,
            fontWeight: 700,
            color: theme.accent,

            textTransform: "uppercase",
            letterSpacing: "0.025rem",
          }}
        >
          {categoryName}
        </div>
      )}

      {/* Category description - italic serif font for contrast */}
      {categoryDescription && (
        <div
          style={{
            fontSize: `${2.5 * scale}rem`,
            fontFamily: tokens.font.flavor,
            fontStyle: "italic",
            lineHeight: 1.5,
            color: theme.dark,
            maxWidth: "900px",
            margin: "0 auto",
          }}
          dangerouslySetInnerHTML={{
            __html: marked.parseInline(categoryDescription || ""),
          }}
        />
      )}
    </div>
  );
}

function QuestionDisplay({ content, fontSize = 100 }) {
  const {
    questionNumber,
    questionText,
    categoryName,
    images = [],
    answer,
    pointsPerTeam,
    correctCount,
    totalTeams,
  } = content || {};

  const scale = fontSize / 100;

  const [currentImageIndex] = useState(0);

  // fixed “reserved” heights in vh so layout doesn’t jump
  const TOP_BAR_H = categoryName ? 100 : 0; // px, matches your bar
  const STAGE_H = "90vh";

  const ANSWER_BOTTOM = "10vh";

  // Reserve a bottom "safe area" so question text can never overlap answer/stats
  const STATS_H = `${6.5 * scale}rem`; // your existing stats reserve
  const ANSWER_H = `${4.0 * scale}rem`; // reserve ~1–2 lines for answer
  const BOTTOM_PAD = `calc(${ANSWER_H} + ${STATS_H} + ${ANSWER_BOTTOM})`;

  const showStats =
    (correctCount != null && totalTeams != null) || pointsPerTeam != null;

  const textRef = useRef(null);
  const [fitTextScale, setFitTextScale] = useState(1);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    // Reset before measuring
    el.style.fontSize = `${2.6 * scale}rem`;
    setFitTextScale(1);

    requestAnimationFrame(() => {
      const node = textRef.current;
      if (!node) return;

      const fits = () => node.scrollHeight <= node.clientHeight + 1;

      if (fits()) return;

      let s = 1;
      const MIN = 0.72;
      const STEP = 0.04;

      while (s > MIN && !fits()) {
        s = Math.max(MIN, s - STEP);
        node.style.fontSize = `${2.6 * scale * s}rem`;
      }

      setFitTextScale(s);
    });
  }, [questionText, categoryName, images?.length, fontSize]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: STAGE_H,
        maxHeight: STAGE_H,
        overflow: "hidden",
        paddingTop: categoryName ? `${TOP_BAR_H}px` : "0px",
      }}
    >
      {/* Category bar at top - gray bar behind logo */}
      {categoryName && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: `${TOP_BAR_H}px`,
            backgroundColor: theme.gray.border,
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            paddingLeft: "2rem",
            zIndex: 50,
          }}
        >
          <div
            style={{
              fontSize: `${2 * scale}rem`,
              fontWeight: 600,
              color: theme.dark,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              maxWidth: "calc(100% - 200px)",
              lineHeight: 1.2,
            }}
          >
            {categoryName}
          </div>
        </div>
      )}

      {/* Question number */}
      {questionNumber && (
        <div
          style={{
            position: "absolute",
            top: categoryName ? `${TOP_BAR_H + 18}px` : "18px",
            left: "50%",
            transform: "translateX(-50%)",
            textAlign: "center",
            whiteSpace: "nowrap",
            fontSize: `${4.25 * scale}rem`,
            fontWeight: 800,
            color: theme.accent,
            zIndex: 10,
          }}
        >
          {questionNumber === "TB" ? "TIEBREAKER" : questionNumber}
        </div>
      )}

      {/* Question text */}
      {questionText && (
        <div
          ref={textRef}
          style={{
            position: "absolute",
            top: categoryName ? `${TOP_BAR_H + 120}px` : "120px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%",
            maxWidth: "1400px",
            textAlign: "center",
            fontSize: `${2.6 * scale * fitTextScale}rem`,
            fontWeight: 500,
            lineHeight: 1.35,
            color: theme.dark,
            zIndex: 10,
            maxHeight: `calc(${STAGE_H} - ${TOP_BAR_H}px - ${BOTTOM_PAD} - 140px)`,
            overflow: "hidden",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
          dangerouslySetInnerHTML={{
            __html: marked.parseInline(questionText || ""),
          }}
        />
      )}

      {/* ANSWER + STATS BAND (pinned to bottom; height stays constant) */}
      {(answer || showStats) && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: ANSWER_BOTTOM,
            width: "92%",
            maxWidth: "1400px",
            textAlign: "center",
            zIndex: 20,
          }}
        >
          {/* Answer text — stays in the same place */}
          {answer && (
            <div
              style={{
                fontSize: `${2.75 * scale}rem`,
                fontWeight: 800,
                lineHeight: 1.25,
                color: theme.accent,
                marginBottom: "1rem", // always the same
              }}
              dangerouslySetInnerHTML={{
                __html: marked.parseInline(answer || ""),
              }}
            />
          )}

          {/* Stats area — ALWAYS takes space, even when empty */}
          <div
            style={{
              minHeight: STATS_H,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              fontSize: `${2.3 * scale}rem`,
              color: theme.dark,
              fontFamily: tokens.font.body,
              lineHeight: 1.2,

              // hide when not showing, but keep reserved space:
              visibility: showStats ? "visible" : "hidden",
            }}
          >
            {correctCount != null && totalTeams != null && (
              <div
                style={{ marginBottom: pointsPerTeam != null ? "0.5rem" : 0 }}
              >
                {correctCount} / {totalTeams} teams correct
              </div>
            )}

            {pointsPerTeam != null && (
              <div>
                <span
                  style={{
                    color: theme.accent,
                    fontWeight: 900,
                    fontSize: `${2.4 * scale}rem`,
                  }}
                >
                  {pointsPerTeam}
                </span>{" "}
                points per team
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageDisplay({ content, fontSize = 100 }) {
  const { text } = content || {};
  const scale = fontSize / 100;

  return (
    <div
      style={{
        fontSize: `${3 * scale}rem`,
        fontWeight: 600,
        lineHeight: 1.5,
        color: theme.dark,
        padding: "2rem",
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
    <div>
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
    </div>
  );
}

function ImageOverlay({ images, currentIndex, onClose }) {
  const [idx, setIdx] = useState(currentIndex);

  // Update index when new images are pushed
  useEffect(() => {
    setIdx(currentIndex);
  }, [currentIndex, images]);

  const handlePrev = (e) => {
    e.stopPropagation();
    setIdx((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setIdx((prev) => (prev + 1) % images.length);
  };

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
        backgroundColor: "rgba(43, 57, 74, 0.7)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        cursor: "pointer",
      }}
    >
      <img
        src={images[idx]?.url}
        alt={`${idx + 1} of ${images.length}`}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          border: `4px solid ${theme.white}`,
          boxShadow: "0 0 20px rgba(0,0,0,0.5)",
          marginBottom: "1rem",
        }}
      />

      {/* Navigation buttons for multiple images */}
      {images.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            fontFamily: tokens.font.body,
          }}
        >
          <button
            onClick={handlePrev}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "1rem",
              borderRadius: "0.25rem",
              border: `1px solid ${theme.accent}`,
              background: theme.white,
              color: theme.dark,
              cursor: "pointer",
            }}
          >
            Previous
          </button>
          <span style={{ color: theme.white, fontSize: "1.2rem" }}>
            {idx + 1} / {images.length}
          </span>
          <button
            onClick={handleNext}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "1rem",
              borderRadius: "0.25rem",
              border: `1px solid ${theme.accent}`,
              background: theme.white,
              color: theme.dark,
              cursor: "pointer",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// Results display for showing final placements
function ResultsDisplay({ content, fontSize = 100 }) {
  if (!content) return null;

  const { place, teams, prize, isTied, points } = content;
  const scale = fontSize / 100;

  const teamCount = Array.isArray(teams) ? teams.length : 0;

  // Auto-scale the TEAMS font to fit more names (aim: 5+ comfortably)
  const teamScale = (() => {
    if (teamCount <= 1) return 1.0;
    if (teamCount === 2) return 0.95;
    if (teamCount === 3) return 0.88;
    if (teamCount === 4) return 0.8;
    if (teamCount === 5) return 0.72; // target: 5 fits nicely
    if (teamCount === 6) return 0.66;
    if (teamCount === 7) return 0.6;
    if (teamCount === 8) return 0.55;
    if (teamCount === 9) return 0.5;
    if (teamCount === 10) return 0.46;
    // 11+ keep shrinking gently, but clamp so it doesn't become microscopic
    return Math.max(0.34, 0.46 - (teamCount - 10) * 0.03);
  })();

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "90vh", // key: fixed stage height so nothing re-centers
        maxHeight: "90vh",
        overflow: "hidden",
      }}
    >
      {/* PLACE (pinned) */}
      <div
        style={{
          position: "absolute",
          top: "0vh",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          whiteSpace: "nowrap",
          fontSize: `${5 * scale}rem`,
          fontFamily: tokens.font.display,
          color: theme.accent,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 700,
        }}
      >
        {isTied ? `TIED for ${place}` : place}
      </div>

      {/* POINTS (pinned) */}
      {points != null && (
        <div
          style={{
            position: "absolute",
            top: "18vh",
            left: "50%",
            transform: "translateX(-50%)",
            textAlign: "center",
            whiteSpace: "nowrap",
            fontSize: `${3.75 * scale}rem`,
            fontFamily: tokens.font.body,
            color: theme.accent,
            fontWeight: 600,
          }}
        >
          {points} {points === 1 ? "point" : "points"}
        </div>
      )}

      {/* TEAMS (pinned; can grow without moving place/points) */}
      {teams && teams.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "30vh", // starts below points
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%",
            textAlign: "center",
            fontSize: `${5 * scale * teamScale}rem`,
            fontFamily: tokens.font.body,
            color: theme.dark,
            lineHeight: teamCount >= 7 ? 1.05 : 1.15,
            maxHeight: "42vh", // keep it from running into prize
            overflow: "hidden", // or "auto" if you prefer scroll
          }}
        >
          {teams.map((team, idx) => (
            <div
              key={idx}
              style={{ marginBottom: teamCount >= 7 ? "0.18rem" : "0.35rem" }}
            >
              {team}
            </div>
          ))}
        </div>
      )}

      {/* PRIZE (pinned to bottom) */}
      {prize && (
        <div
          style={{
            position: "absolute",
            bottom: "6vh",
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%",
            textAlign: "center",
            fontSize: `${4 * scale}rem`,
            fontFamily: tokens.font.body,
            color: theme.accent,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {prize}
        </div>
      )}
    </div>
  );
}
