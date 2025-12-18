// src/DisplayMode.js
import React, { useState, useEffect } from "react";
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
            width: "90%",
            maxWidth: "1400px",
            textAlign: "center",
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
              autoCycle={imageOverlay.autoCycle || false}
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

  return (
    <div>
      {/* Category bar at top - gray bar behind logo */}
      {categoryName && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "100px",
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
            fontSize: `${4 * scale}rem`,
            fontWeight: 700,
            color: theme.accent,
            marginBottom: "1rem",
            marginTop: categoryName ? "80px" : "0",
          }}
        >
          {questionNumber === "TB" ? "TIEBREAKER" : questionNumber}
        </div>
      )}

      {/* Images */}
      {images && images.length > 0 && (
        <div
          style={{
            marginBottom: "1rem", // less extra space under the image
            display: "flex",
            justifyContent: "center",
          }}
        >
          <img
            src={images[currentImageIndex].url}
            alt={`Question ${currentImageIndex + 1}`}
            style={{
              maxWidth: "90%",
              maxHeight: "65vh",
              borderRadius: "12px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              objectFit: "contain",
            }}
          />
          {/* Image indicators */}
          {images.length > 1 && (
            <div
              style={{
                marginTop: "1rem",
                display: "flex",
                gap: "8px",
                justifyContent: "center",
              }}
            >
              {images.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor:
                      idx === currentImageIndex
                        ? theme.accent
                        : theme.gray.border,
                    transition: "background-color 0.3s",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question text */}
      {questionText && (
        <div
          style={{
            fontSize: `${2.5 * scale}rem`,
            fontWeight: 500,
            lineHeight: 1.4,
            color: theme.dark,
          }}
          dangerouslySetInnerHTML={{
            __html: marked.parseInline(questionText || ""),
          }}
        />
      )}

      {/* Answer (if provided) */}
      {answer && (
        <>
          <div
            style={{
              fontSize: `${2.5 * scale}rem`,
              fontWeight: 600,
              lineHeight: 1.4,
              color: theme.accent,
              marginTop: "2rem",
            }}
            dangerouslySetInnerHTML={{
              __html: marked.parseInline(answer || ""),
            }}
          />

          {/* Stats for all scoring modes - only show if stats are actually provided */}
          {((correctCount != null && totalTeams != null) ||
            pointsPerTeam != null) && (
            <div
              style={{
                marginTop: "2rem",
                fontSize: `${2.5 * scale}rem`,
                color: theme.dark,
                fontFamily: tokens.font.body,
              }}
            >
              {correctCount != null && totalTeams != null && (
                <div
                  style={{
                    marginBottom: pointsPerTeam != null ? "0.5rem" : "0",
                  }}
                >
                  {correctCount} / {totalTeams} teams correct
                </div>
              )}
              {pointsPerTeam != null && (
                <div>
                  <span
                    style={{
                      color: theme.accent,
                      fontWeight: 700,
                      fontSize: `${2.5 * scale}rem`,
                    }}
                  >
                    {pointsPerTeam}
                  </span>{" "}
                  points per team
                </div>
              )}
            </div>
          )}
        </>
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

// Results display for showing final placements
function ResultsDisplay({ content, fontSize = 100 }) {
  if (!content) return null;

  const { place, teams, prize, isTied, points } = content;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        padding: "2rem",
      }}
    >
      {/* Place heading with points underneath */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            fontSize: `${5 * (fontSize / 100)}rem`,
            fontFamily: tokens.font.display,
            color: theme.accent,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 700,
          }}
        >
          {isTied ? `TIED for ${place}` : place}
        </div>

        {/* Points displayed underneath place in slightly smaller font */}
        {points != null && (
          <div
            style={{
              fontSize: `${4 * (fontSize / 100)}rem`,
              fontFamily: tokens.font.body,
              color: theme.dark,
              fontWeight: 600,
            }}
          >
            {points} {points === 1 ? "point" : "points"}
          </div>
        )}
      </div>

      {/* Team names (only show if teams array is provided) */}
      {teams && teams.length > 0 && (
        <div
          style={{
            fontSize: `${5 * (fontSize / 100)}rem`,
            fontFamily: tokens.font.body,
            color: theme.dark,
            lineHeight: 1.5,
          }}
        >
          {teams.map((team, idx) => (
            <div key={idx} style={{ marginBottom: "0.5rem" }}>
              {team}
            </div>
          ))}
        </div>
      )}

      {/* Prize (if provided) */}
      {prize && (
        <div
          style={{
            fontSize: `${4 * (fontSize / 100)}rem`,
            fontFamily: tokens.font.body,
            color: theme.accent,
            fontWeight: 600,
            marginTop: "1rem",
          }}
        >
          {prize}
        </div>
      )}
    </div>
  );
}
