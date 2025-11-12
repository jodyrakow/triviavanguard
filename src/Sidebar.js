// Sidebar.js - Collapsible sidebar drawer with hamburger menu
import React, { useState } from "react";
import { colors as theme } from "./styles/index.js";

export default function Sidebar({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Sidebar with hamburger button always visible */}
      <div
        style={{
          position: "fixed",
          top: "60px", // Below the header
          left: 0,
          width: isOpen ? "280px" : "50px", // Narrow tab when closed
          height: "calc(100vh - 60px)",
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
            left: "10px",
            backgroundColor: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: "4px",
            padding: "8px 12px",
            cursor: "pointer",
            color: "#fff",
            fontSize: "20px",
            width: "35px",
            height: "35px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? "×" : "☰"}
        </button>

        {/* Menu content - only visible when open */}
        {isOpen && (
          <div style={{ padding: "3rem 1rem 1rem 1rem" }}>
            {children}
          </div>
        )}
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
