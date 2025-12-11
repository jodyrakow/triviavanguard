// SidebarMenu.js - Menu contents for the sidebar drawer
import React, { useState } from "react";
import { tokens } from "./styles/index.js";
import AnswerKeyPanel from "./AnswerKeyPanel.js";

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
}) {
  const [expandedSections, setExpandedSections] = useState({
    hostTools: false,
    showSettings: false,
    scoringOptions: false,
    prizes: false,
  });

  const [showAnswerKey, setShowAnswerKey] = useState(false);

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
      {/* Answer Key Panel (modal-style) */}
      {showAnswerKey && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setShowAnswerKey(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "600px",
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <AnswerKeyPanel
              showBundle={showBundle}
              onClose={() => setShowAnswerKey(false)}
            />
          </div>
        </div>
      )}

      {/* Host tools */}
      <div style={sectionStyle}>
        <div style={headerStyle} onClick={() => toggleSection("hostTools")}>
          <span>Host tools</span>
          <span>{expandedSections.hostTools ? "▼" : "▶"}</span>
        </div>
        {expandedSections.hostTools && (
          <div style={contentStyle}>
            {/* Timer controls */}
            <div style={{ ...itemStyle, borderBottom: "none", paddingBottom: 0 }}>
              <strong>⏱️ Timer</strong>
            </div>
            <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={showTimer}
                  onChange={(e) => setShowTimer(e.target.checked)}
                />
                Show timer
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
            <div
              style={itemStyle}
              onClick={() => setScriptOpen(true)}
            >
              📜 Show script
            </div>

            {/* Display - placeholder for now */}
            <div style={{ ...itemStyle, opacity: 0.5, cursor: "not-allowed" }}>
              🖥️ Display (coming soon)
            </div>

            {/* Show/hide all answers */}
            <div
              style={itemStyle}
              onClick={() => setShowDetails((prev) => !prev)}
            >
              👁️ {showDetails ? "Hide all answers" : "Show all answers"}
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
            {/* Location (read-only from show config) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold" }}>
                📍 Location
              </label>
              <div style={{
                padding: "0.35rem",
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: "4px",
                fontSize: "0.85rem",
              }}>
                {showBundle?.config?.location || "Not set"}
              </div>
            </div>

            {/* Host name (read-only from show config) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold" }}>
                👤 Host name
              </label>
              <div style={{
                padding: "0.35rem",
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: "4px",
                fontSize: "0.85rem",
              }}>
                {showBundle?.config?.hostName || "Not set"}
              </div>
            </div>

            {/* Cohost name (read-only from show config) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold" }}>
                👥 Cohost name
              </label>
              <div style={{
                padding: "0.35rem",
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: "4px",
                fontSize: "0.85rem",
              }}>
                {showBundle?.config?.cohostName || "Not set"}
              </div>
            </div>

            {/* Total games (from Airtable, read-only) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold" }}>
                🎮 Total games tonight
              </label>
              <div style={{
                padding: "0.35rem",
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: "4px",
                fontSize: "0.85rem",
              }}>
                {showBundle?.config?.totalGamesThisNight || 1}
              </div>
            </div>

            {/* Start time (from Airtable, read-only) */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold" }}>
                ⏰ Start time
              </label>
              <div style={{
                padding: "0.35rem",
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: "4px",
                fontSize: "0.85rem",
              }}>
                {showBundle?.config?.startTime || "Not set"}
              </div>
            </div>

            {/* Announcements */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: "bold" }}>
                📢 Announcements
              </label>
              <textarea
                value={hostInfo?.announcements || ""}
                onChange={(e) => setHostInfo({ ...hostInfo, announcements: e.target.value })}
                placeholder="From Airtable"
                rows={3}
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
