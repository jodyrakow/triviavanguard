import React, { useState, useEffect } from "react";
import { colors, tokens } from "./styles/index.js";

// Formats seconds as M:SS
function fmt(s) {
  if (!s || isNaN(s) || !isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function SharedAudioPlayer({ url, filename, sharedUrl, sharedPlaying, audioRef, onPlay, onToggle }) {
  const isActive = url === sharedUrl;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Poll time/duration while this player is active
  useEffect(() => {
    if (!isActive) {
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      setCurrentTime(a.currentTime);
      setDuration(isNaN(a.duration) || !isFinite(a.duration) ? 0 : a.duration);
    };
    tick();
    if (!sharedPlaying) return;
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [isActive, sharedPlaying, audioRef]);

  const handleSeek = (e) => {
    if (!isActive || !audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const progress = duration ? Math.min((currentTime / duration) * 100, 100) : 0;
  const label = filename || url.split("/").pop().split("?")[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
        <button
          onClick={() => (isActive ? onToggle() : onPlay(url))}
          style={{
            flexShrink: 0,
            padding: ".2rem .45rem",
            fontSize: ".82rem",
            fontFamily: tokens.font.body,
            borderRadius: ".35rem",
            border: `1px solid ${isActive && sharedPlaying ? colors.accent : colors.gray?.border || "#ccc"}`,
            background: isActive && sharedPlaying ? colors.accent : "transparent",
            color: isActive && sharedPlaying ? "#fff" : colors.dark,
            cursor: "pointer",
            minWidth: "1.8rem",
            textAlign: "center",
          }}
        >
          {isActive && sharedPlaying ? "■" : "▶"}
        </button>
        <span
          style={{
            flex: 1,
            fontSize: ".75rem",
            fontFamily: tokens.font.body,
            color: colors.gray?.text || "#666",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={label}
        >
          {label}
        </span>
        <span style={{ fontSize: ".72rem", fontFamily: tokens.font.body, color: colors.gray?.text || "#888", whiteSpace: "nowrap", flexShrink: 0 }}>
          {fmt(currentTime)}{duration ? ` / ${fmt(duration)}` : ""}
        </span>
      </div>
      {/* Progress bar — clickable to seek */}
      <div
        onClick={handleSeek}
        style={{
          height: 4,
          background: colors.gray?.border || "#e0e0e0",
          borderRadius: 2,
          cursor: isActive ? "pointer" : "default",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: isActive ? colors.accent : (colors.gray?.border || "#ccc"),
            borderRadius: 2,
            transition: "width 0.25s linear",
          }}
        />
      </div>
    </div>
  );
}
