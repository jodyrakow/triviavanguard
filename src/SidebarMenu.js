// SidebarMenu.js - Menu contents for the sidebar drawer
import React, { useState } from "react";
import { tokens } from "./styles/index.js";

export default function SidebarMenu() {
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
    marginBottom: "1rem",
  };

  const headerStyle = {
    cursor: "pointer",
    padding: "0.75rem",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "4px",
    fontWeight: "bold",
    fontSize: "1rem",
    fontFamily: tokens.font.display,
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
      <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem", fontFamily: tokens.font.display }}>Menu</h2>

      {/* Host Tools */}
      <div style={sectionStyle}>
        <div style={headerStyle} onClick={() => toggleSection("hostTools")}>
          <span>Host Tools</span>
          <span>{expandedSections.hostTools ? "▼" : "▶"}</span>
        </div>
        {expandedSections.hostTools && (
          <div style={contentStyle}>
            <div style={itemStyle}>⏱️ Timer</div>
            <div style={itemStyle}>📋 Answer Key</div>
            <div style={itemStyle}>🖥️ Display</div>
            <div style={itemStyle}>👁️ Show/Hide All Answers</div>
          </div>
        )}
      </div>

      {/* Show Settings */}
      <div style={sectionStyle}>
        <div style={headerStyle} onClick={() => toggleSection("showSettings")}>
          <span>Show Settings</span>
          <span>{expandedSections.showSettings ? "▼" : "▶"}</span>
        </div>
        {expandedSections.showSettings && (
          <div style={contentStyle}>
            <div style={itemStyle}>📍 Location</div>
            <div style={itemStyle}>👤 Host Name</div>
            <div style={itemStyle}>👥 Cohost Name</div>
            <div style={itemStyle}>🎮 Total Games</div>
            <div style={itemStyle}>⏰ Start Times</div>
          </div>
        )}
      </div>

      {/* Scoring Options */}
      <div style={sectionStyle}>
        <div style={headerStyle} onClick={() => toggleSection("scoringOptions")}>
          <span>Scoring Options</span>
          <span>{expandedSections.scoringOptions ? "▼" : "▶"}</span>
        </div>
        {expandedSections.scoringOptions && (
          <div style={contentStyle}>
            <div style={itemStyle}>⚙️ Scoring Mode</div>
            <div style={itemStyle}>🎯 Pub Points</div>
            <div style={itemStyle}>💰 Pool Points</div>
            <div style={itemStyle}>💵 Team Contribution</div>
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
            <div style={itemStyle}>🏆 Prize Provider</div>
            <div style={itemStyle}>🎁 Prize Details</div>
          </div>
        )}
      </div>
    </div>
  );
}
