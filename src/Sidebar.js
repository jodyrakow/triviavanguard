// Sidebar.js - Collapsible sidebar drawer with hamburger menu
import React, { useState } from "react";
import { colors as theme } from "./styles/index.js";

export default function Sidebar({ children, setShowDetails, setDisplayControlsOpen }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Sidebar with hamburger button always visible */}
      <div
        style={{
          position: "fixed",
          top: "80px", // Below the header
          left: 0,
          width: isOpen ? "280px" : "50px", // Narrow tab when closed
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
        >
          {isOpen ? "×" : "☰"}
        </button>

        {/* Ninja button - Show/hide all answers */}
        <button
          onClick={() => setShowDetails((prev) => !prev)}
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
          onClick={() => setDisplayControlsOpen((prev) => !prev)}
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
          aria-label="Toggle display controls"
          title="Show/hide display controls"
        >
          📺
        </button>

        {/* Menu content - only visible when open */}
        {isOpen && (
          <div style={{ padding: "9rem 1rem 1rem 1rem" }}>{children}</div>
        )}
      </div>

      {/* Overlay when drawer is open */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            top: "80px",
            left: "280px",
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            zIndex: 999,
          }}
        />
      )}
    </>
  );
}
