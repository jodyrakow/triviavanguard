// src/DisplayMode.js
import React, { useState, useEffect } from "react";
import { colors as theme, tokens } from "./styles";
import triviaVanguardLogo from "./trivia-vanguard-logo-white.svg";
import { marked } from "marked";
marked.setOptions({ breaks: true });
export default function DisplayMode() {
  const [displayState, setDisplayState] = useState({
    type: "standby", // "standby" | "question" | "standings" | "message" | "break"
    content: null,
  });
  const [fontSize, setFontSize] = useState(170); // percentage
  const [imageOverlay, setImageOverlay] = useState(null); // { images: [], currentIndex: 0 }

  const [showGuide, setShowGuide] = useState(true);

  // Listen for display updates via BroadcastChannel
  useEffect(() => {
    const channel = new BroadcastChannel("tv:display");

    channel.onmessage = (event) => {
      const { type, content } = event.data || {};
      console.log("[DisplayMode] Received update:", type, content);

      if (type === "fontSize") {
        setFontSize(content.size);
      } else if (type === "toggleGuide") {
        setShowGuide((v) => !v);
      } else if (type === "setGuide") {
        setShowGuide(!!content?.show);
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
        <QuestionDisplay content={displayState.content} fontSize={fontSize} />
      )}
      {displayState.type === "category" && (
        <CategoryDisplay content={displayState.content} fontSize={fontSize} />
      )}
      {displayState.type === "message" && (
        <MessageDisplay content={displayState.content} fontSize={fontSize} />
      )}
      {displayState.type === "standings" && (
        <StandingsDisplay content={displayState.content} />
      )}
      {displayState.type === "results" && (
        <ResultsDisplay content={displayState.content} fontSize={fontSize} />
      )}

      {showGuide && <DesignGuideOverlay />}

      {/* Image overlay */}
      {imageOverlay &&
        imageOverlay.images &&
        imageOverlay.images.length > 0 && (
          <ImageOverlay
            images={imageOverlay.images}
            currentIndex={imageOverlay.currentIndex || 0}
            autoCycle={imageOverlay.autoCycle || false}
            onClose={() => setImageOverlay(null)}
          />
        )}
    </div>
  );
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
        >
          {categoryName}
        </div>
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
          ...style, // 👈 THIS is where color comes from
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function QuestionDisplay({ content, fontSize = 100 }) {
  const {
    questionNumber,
    questionText,
    categoryName,
    answer,
    pointsPerTeam,
    correctCount,
    totalTeams,
  } = content || {};

  const scale = fontSize / 100;

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
            style={{
              fontSize: `${2.5 * scale}rem`,
              fontWeight: 600,
              color: theme.dark,
              textTransform: "uppercase",
              paddingTop: "2rem",
              letterSpacing: "0.05rem",
              maxWidth: "calc(100% - 200px)",
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

      {/* Question text */}
      {questionText && (
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
          }}
        >
          <div style={{ width: "90vw", height: "100%" }}>
            <AutoFitText
              html={marked.parseInline(questionText || "")}
              maxRem={2.8 * scale}
              minRem={1.8 * scale}
              style={{
                color: theme.dark,
                fontWeight: 500,
              }}
            />
          </div>
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

      {/* Stats wrapper #2 (points per team) */}
      {answer && pointsPerTeam != null && (
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
              fontSize: `${2.25 * scale}rem`,
              color: theme.dark,
              fontFamily: tokens.font.body,
            }}
          >
            <span
              style={{
                color: theme.accent,
                fontWeight: 700,
              }}
            >
              {pointsPerTeam}
            </span>{" "}
            points per team
          </div>
        </div>
      )}
    </>
  );
}

function MessageDisplay({ content, fontSize = 100 }) {
  const { text } = content || {};
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
        justifyContent: "center", // horizontal centering
        alignItems: "center", // vertical centering

        textAlign: "center",
        padding: "4vh",

        fontSize: `${5 * scale}rem`,
        fontWeight: 600,
        lineHeight: 1.5,
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

function ImageOverlay({ images, currentIndex, autoCycle = false, onClose }) {
  const [idx, setIdx] = useState(currentIndex);

  // Update index when host changes the current image
  useEffect(() => {
    setIdx(currentIndex);
  }, [currentIndex, images]);

  // Auto-cycle through images every 10 seconds when autoCycle is true
  useEffect(() => {
    if (!autoCycle || images.length <= 1) return;

    const interval = setInterval(() => {
      setIdx((prevIdx) => (prevIdx + 1) % images.length);
    }, 8000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoCycle, images.length]);

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
        }}
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
            : `${place} place` || "".toUpperCase()}
        </div>
      </div>

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
