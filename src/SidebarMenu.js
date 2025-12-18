// SidebarMenu.js - Menu contents for the sidebar drawer
import { useEffect, useState } from "react";
import { tokens } from "./styles/index.js";

export default function SidebarMenu({
  showBundle,
  showTimer,
  setShowTimer,
  setTimerPosition,
  showDetails,
  setShowDetails,
  timerDuration,
  setTimerDuration,
  setScriptOpen,
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
}) {
  const [expandedSections, setExpandedSections] = useState({
    hostTools: false,
    showSettings: false,

    // nested inside Show settings:
    showDetailsSettings: false,
    scoringSettings: false,
    prizesSettings: false,
  });

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
    fontSize: "0.95rem",
    fontFamily: tokens.font.body,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "0.65rem",
    border: "1px solid rgba(255,255,255,0.10)",
  };

  const nestedContentStyle = {
    padding: "0.6rem 0.65rem 0.2rem",
    fontSize: "0.85rem",
  };

  const contentStyle = {
    padding: "0.5rem 0.75rem",
    fontSize: "0.9rem",
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
                  fontSize: "0.85rem",
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
                      max="300"
                      value={timerDuration}
                      onChange={(e) => setTimerDuration(Number(e.target.value))}
                      style={{
                        width: "35px",
                        padding: "0.25rem",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255,255,255,0.1)",
                        color: "#fff",
                        textAlign: "right",
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
                    fontSize: "0.8rem",
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
              onClick={() => setDisplayControlsOpen((prev) => !prev)}
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
                  fontSize: "0.85rem",
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
                    fontSize: "0.8rem",
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
              onClick={() => setShowDetails((prev) => !prev)}
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
          <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}>
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
                      fontSize: "0.85rem",
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
                      fontSize: "0.85rem",
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
                      fontSize: "0.85rem",
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
                      fontSize: "0.85rem",
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
                      fontSize: "0.85rem",
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
                      fontSize: "0.85rem",
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
                      fontSize: "0.85rem",
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
                        fontSize: "0.85rem",
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
                        fontSize: "0.85rem",
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
                        fontSize: "0.85rem",
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
                      fontSize: "0.85rem",
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
                      fontSize: "0.85rem",
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
                        fontSize: "0.85rem",
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
    </div>
  );
}
