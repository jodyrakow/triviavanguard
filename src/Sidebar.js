// Sidebar.js - Collapsible sidebar drawer with hamburger menu
import React, { useState } from "react";
import { colors as theme } from "./styles/index.js";

export default function Sidebar({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          top: "70px", // Below the header
          left: isOpen ? "260px" : "10px",
          zIndex: 1001,
          backgroundColor: theme.accent, // Orange
          border: "none",
          borderRadius: "4px",
          padding: "8px 12px",
          cursor: "pointer",
          transition: "left 0.3s ease",
          color: "#fff",
          fontSize: "20px",
        }}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? "×" : "☰"}
      </button>

      {/* Sidebar drawer */}
      <div
        style={{
          position: "fixed",
          top: "60px", // Below the header
          left: isOpen ? "0" : "-280px",
          width: "280px",
          height: "calc(100vh - 60px)",
          backgroundColor: theme.accent, // Orange
          color: "#fff",
          transition: "left 0.3s ease",
          zIndex: 1000,
          overflowY: "auto",
          padding: "1rem",
          boxShadow: isOpen ? "2px 0 8px rgba(0,0,0,0.2)" : "none",
        }}
      >
        {children}
      </div>

      {/* Overlay when drawer is open */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            top: "60px",
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
