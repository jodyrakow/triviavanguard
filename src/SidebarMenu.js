// SidebarMenu.js - Menu contents for the sidebar drawer
import { useState } from "react";
import { tokens } from "./styles/index.js";

export default function SidebarMenu({
  showBundle,
  showTimer,
  setShowTimer,
  showDetails,
  setShowDetails,
  timerDuration,
  setTimerDuration,
  setScriptOpen,
  hostInfo,
  setHostInfo,
  displayControlsOpen,
  setDisplayControlsOpen,
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
}) {
  const [expandedSections, setExpandedSections] = useState({
    hostTools: false,
    showSettings: false,
    scoringOptions: false,
    prizes: false,
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
            {/* Host details (editable) */}
            <div
              style={{ ...itemStyle, borderBottom: "none", paddingBottom: 0 }}
            >
              <strong>👤 Host Details</strong>
            </div>
            <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}>
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
                    width: "80px",
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
                    setHostInfo({ ...hostInfo, startTimesText: e.target.value })
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
              <label style={{ display: "block", marginBottom: "0.75rem" }}>
                <span style={{ display: "block", marginBottom: "0.25rem" }}>
                  Announcements:
                </span>
                <textarea
                  value={hostInfo?.announcements || ""}
                  onChange={(e) =>
                    setHostInfo({ ...hostInfo, announcements: e.target.value })
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

            {/* Timer controls */}
            <div
              style={{ ...itemStyle, borderBottom: "none", paddingBottom: 0 }}
            >
              <strong>⏱️ Timer</strong>
            </div>
            <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={showTimer}
                  onChange={(e) => setShowTimer(e.target.checked)}
                />
                Show timer
              </label>
              <label
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <span>Default time:</span>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={timerDuration}
                  onChange={(e) => setTimerDuration(Number(e.target.value))}
                  style={{
                    width: "60px",
                    padding: "0.25rem",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255,255,255,0.1)",
                    color: "#fff",
                  }}
                />
                <span>seconds</span>
              </label>
            </div>

            {/* Answer key */}
            <div
              style={itemStyle}
              onClick={() => setShowAnswerKey((prev) => !prev)}
            >
              📋 Answer key
            </div>

            {/* Show script */}
            <div style={itemStyle} onClick={() => setScriptOpen(true)}>
              🎤 Show script
            </div>

            {/* Refresh questions */}
            {refreshBundle && (
              <div style={itemStyle} onClick={refreshBundle}>
                🔄 Refresh questions
              </div>
            )}

            {/* Display controls toggle */}
            <div
              style={itemStyle}
              onClick={() => setDisplayControlsOpen((prev) => !prev)}
            >
              📺{" "}
              {displayControlsOpen
                ? "Hide display controls"
                : "Show display controls"}
            </div>

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
            {/* Scoring mode */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.25rem",
                  fontWeight: "bold",
                }}
              >
                🎯 Scoring type
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
                <option value="pooled" style={{ backgroundColor: "#2B394A" }}>
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

            {/* Pub points per question (only show if pub mode) */}
            {scoringMode === "pub" && (
              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                    fontWeight: "bold",
                  }}
                >
                  💰 Points per question
                </label>
                <input
                  type="number"
                  min="1"
                  value={pubPoints}
                  onChange={(e) => setPubPoints(Number(e.target.value))}
                  style={{
                    width: "80px",
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

            {/* Pool per question (only show if pooled static mode) */}
            {scoringMode === "pooled" && (
              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                    fontWeight: "bold",
                  }}
                >
                  💰 Points in pool per question
                </label>
                <input
                  type="number"
                  min="1"
                  value={poolPerQuestion}
                  onChange={(e) => setPoolPerQuestion(Number(e.target.value))}
                  style={{
                    width: "80px",
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

            {/* Pool contribution per team (only show if adaptive mode) */}
            {scoringMode === "pooled-adaptive" && (
              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                    fontWeight: "bold",
                  }}
                >
                  💰 Points contributed per team
                </label>
                <input
                  type="number"
                  min="1"
                  value={poolContribution}
                  onChange={(e) => setPoolContribution(Number(e.target.value))}
                  style={{
                    width: "80px",
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

            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.1)",
                marginTop: "0.75rem",
                paddingTop: "0.75rem",
              }}
            />

            {/* Location (read-only from show config) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.25rem",
                  fontWeight: "bold",
                }}
              >
                📍 Location
              </label>
              <div
                style={{
                  padding: "0.35rem",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                }}
              >
                {showBundle?.config?.location || "Not set"}
              </div>
            </div>

            {/* Host name (read-only from show config) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.25rem",
                  fontWeight: "bold",
                }}
              >
                👤 Host name
              </label>
              <div
                style={{
                  padding: "0.35rem",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                }}
              >
                {showBundle?.config?.hostName || "Not set"}
              </div>
            </div>

            {/* Cohost name (read-only from show config) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.25rem",
                  fontWeight: "bold",
                }}
              >
                👥 Cohost name
              </label>
              <div
                style={{
                  padding: "0.35rem",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                }}
              >
                {showBundle?.config?.cohostName || "Not set"}
              </div>
            </div>

            {/* Total games (from Airtable, read-only) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.25rem",
                  fontWeight: "bold",
                }}
              >
                🎮 Total games tonight
              </label>
              <div
                style={{
                  padding: "0.35rem",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                }}
              >
                {showBundle?.config?.totalGamesThisNight || 1}
              </div>
            </div>

            {/* Start time (from Airtable, read-only) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.25rem",
                  fontWeight: "bold",
                }}
              >
                ⏰ Start time
              </label>
              <div
                style={{
                  padding: "0.35rem",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                }}
              >
                {showBundle?.config?.startTime || "Not set"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prizes */}
      <div style={sectionStyle}>
        <div style={headerStyle} onClick={() => toggleSection("prizes")}>
          <span>Prizes</span>
          <span>{expandedSections.prizes ? "▼" : "▶"}</span>
        </div>
        {expandedSections.prizes && (
          <div style={contentStyle}>
            <div style={itemStyle}>🏆 Prize provider</div>
            <div style={itemStyle}>🎁 Prize details</div>
          </div>
        )}
      </div>
    </div>
  );
}
