import React from "react";
import { colors, tokens } from "./styles/theme";

// A self-contained style-guide preview, not the legacy audience-display implementation.
export default function Display({ state = { mode: "standby" } }) {
  const { mode, item = {}, stats } = state;
  const showAnswer = mode.includes("answer");
  const image = item.imageAttachments?.[0]?.url;
  return (
    <div style={{ width: 1920, height: 1080, background: colors.dark, color: colors.white, padding: 90, display: "flex", flexDirection: "column", fontFamily: tokens.font.body }}>
      <div style={{ fontFamily: tokens.font.display, fontSize: 66, color: colors.accent, letterSpacing: 3 }}>TRIVIAVANGUARD</div>
      {mode === "standby" ? (
        <div style={{ margin: "auto", textAlign: "center", fontFamily: tokens.font.display, fontSize: 110 }}>Get ready for trivia!</div>
      ) : (
        <>
          <div style={{ marginTop: 75, fontFamily: tokens.font.display, fontSize: 86 }}>{item.category}</div>
          {mode !== "category" && (
            <div style={{ display: "flex", flex: 1, gap: 60, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: colors.accent, fontSize: 40, marginBottom: 25 }}>QUESTION {item.label}</div>
                <div style={{ fontSize: 64, lineHeight: 1.25 }}>{item.text}</div>
                {showAnswer && <div style={{ marginTop: 60, color: colors.accent, fontSize: 72, fontWeight: 700 }}>{item.answer}</div>}
                {stats && <div style={{ marginTop: 40, fontSize: 36 }}>{stats.correct} of {stats.total} teams correct · {stats.pointValue} points</div>}
              </div>
              {image && <div style={{ width: 560, height: 410, border: "5px solid white", display: "grid", placeItems: "center", fontSize: 36, textAlign: "center", padding: 30, color: colors.accent }}>Image preview</div>}
            </div>
          )}
          {mode === "category" && <div style={{ fontSize: 55, lineHeight: 1.4, marginTop: 65 }}>{item.text}</div>}
        </>
      )}
    </div>
  );
}
