import { useEffect, useRef, useState } from "react";
import { tokens } from "./styles/index.js";

const inputStyle = {
  width: "100%",
  padding: "0.25rem 0.35rem",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: "4px",
  backgroundColor: "rgba(255,255,255,0.1)",
  color: "#fff",
  fontSize: ".8rem",
  fontFamily: tokens.font.body,
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  fontSize: ".72rem",
  color: "rgba(255,255,255,0.6)",
  marginBottom: ".15rem",
  fontFamily: tokens.font.body,
};

const fieldStyle = {
  marginBottom: ".45rem",
};

const sectionLabelStyle = {
  fontSize: ".65rem",
  fontWeight: 700,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
  fontFamily: tokens.font.body,
  marginTop: ".6rem",
  marginBottom: ".35rem",
  paddingTop: ".4rem",
  borderTop: "1px solid rgba(255,255,255,0.1)",
};

const resetBtnStyle = {
  width: "100%",
  padding: "0.3rem 0.5rem",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: "4px",
  backgroundColor: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: ".78rem",
  cursor: "pointer",
  fontFamily: tokens.font.body,
  marginBottom: ".35rem",
  textAlign: "left",
};

export default function SidebarMenu({
  showTimer,
  setTimerPosition,
  hostInfo,
  setHostInfo,
  scoringMode,
  setScoringMode,
  pubPoints,
  setPubPoints,
  poolPerQuestion,
  setPoolPerQuestion,
  poolContribution,
  setPoolContribution,
  factionBonus,
  setFactionBonus,
  prizes,
  setPrizes,
}) {
  const normalizedPrizeLines = (prizes || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const [prizeCount, setPrizeCount] = useState(normalizedPrizeLines.length);
  const [prizeDrafts, setPrizeDrafts] = useState(normalizedPrizeLines);

  const hasInitializedPrizes = useRef(false);
  useEffect(() => {
    if (hasInitializedPrizes.current) return;
    hasInitializedPrizes.current = true;
    setPrizeCount(normalizedPrizeLines.length);
    setPrizeDrafts(normalizedPrizeLines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitPrizes = (nextDrafts) => {
    const next = (nextDrafts || [])
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .join("\n");
    setPrizes?.(next);
  };

  return (
    <div style={{ color: "#fff", fontSize: ".8rem", fontFamily: tokens.font.body }}>

      {/* Details */}
      <div style={sectionLabelStyle}>Details</div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Location</label>
        <input style={inputStyle} type="text" value={hostInfo?.location || ""}
          onChange={(e) => setHostInfo({ ...hostInfo, location: e.target.value })}
          placeholder="From show config" />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Host name</label>
        <input style={inputStyle} type="text" value={hostInfo?.host || ""}
          onChange={(e) => setHostInfo({ ...hostInfo, host: e.target.value })}
          placeholder="From show config" />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Co-host name</label>
        <input style={inputStyle} type="text" value={hostInfo?.cohost || ""}
          onChange={(e) => setHostInfo({ ...hostInfo, cohost: e.target.value })}
          placeholder="From show config" />
      </div>

      <div style={{ display: "flex", gap: ".5rem" }}>
        <div style={{ ...fieldStyle, flex: 1 }}>
          <label style={labelStyle}>Total games tonight</label>
          <input style={{ ...inputStyle, width: "80px" }} type="number" min="1"
            value={hostInfo?.totalGames || ""}
            onChange={(e) => setHostInfo({ ...hostInfo, totalGames: e.target.value })}
            placeholder="1" />
        </div>
        <div style={{ ...fieldStyle, flex: 2 }}>
          <label style={labelStyle}>Start times</label>
          <input style={inputStyle} type="text"
            value={hostInfo?.startTimesText || ""}
            onChange={(e) => setHostInfo({ ...hostInfo, startTimesText: e.target.value })}
            placeholder="7:00, 8:30" />
        </div>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Announcements</label>
        <textarea style={{ ...inputStyle, resize: "vertical" }} rows={2}
          value={hostInfo?.announcements || ""}
          onChange={(e) => setHostInfo({ ...hostInfo, announcements: e.target.value })}
          placeholder="Specials, birthdays, upcoming events…" />
      </div>

      {/* Scoring */}
      <div style={sectionLabelStyle}>Scoring</div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Scoring type</label>
        <select style={inputStyle} value={scoringMode} onChange={(e) => setScoringMode(e.target.value)}>
          <option value="pub" style={{ backgroundColor: "#2B394A" }}>Pub (fixed points)</option>
          <option value="pooled" style={{ backgroundColor: "#2B394A" }}>Pooled (static)</option>
          <option value="pooled-adaptive" style={{ backgroundColor: "#2B394A" }}>Adaptive (pooled per team)</option>
        </select>
      </div>

      {scoringMode === "pub" && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Points per question</label>
          <input style={{ ...inputStyle, width: "80px" }} type="number" min="1"
            value={pubPoints} onChange={(e) => setPubPoints(Number(e.target.value))} />
        </div>
      )}

      {scoringMode === "pooled" && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Pool per question</label>
          <input style={{ ...inputStyle, width: "100px" }} type="number" min="1"
            value={poolPerQuestion} onChange={(e) => setPoolPerQuestion(Number(e.target.value))} />
        </div>
      )}

      {scoringMode === "pooled-adaptive" && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Pool contribution per team</label>
          <input style={{ ...inputStyle, width: "100px" }} type="number" min="1"
            value={poolContribution} onChange={(e) => setPoolContribution(Number(e.target.value))} />
        </div>
      )}

      {/* Prizes */}
      <div style={sectionLabelStyle}>Prizes</div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Number of prizes</label>
        <input style={{ ...inputStyle, width: "80px" }} type="number" min={0}
          value={prizeCount}
          onChange={(e) => {
            const n = Math.max(0, Number(e.target.value || 0));
            setPrizeCount(n);
            const nextDrafts = [...prizeDrafts];
            while (nextDrafts.length < n) nextDrafts.push("");
            while (nextDrafts.length > n) nextDrafts.pop();
            setPrizeDrafts(nextDrafts);
            commitPrizes(nextDrafts);
          }} />
      </div>

      {Array.from({ length: prizeCount }).map((_, idx) => (
        <div key={idx} style={fieldStyle}>
          <label style={labelStyle}>Prize {idx + 1}</label>
          <input style={inputStyle} type="text"
            value={prizeDrafts[idx] || ""}
            onChange={(e) => {
              const next = [...prizeDrafts];
              next[idx] = e.target.value;
              setPrizeDrafts(next);
              commitPrizes(next);
            }}
            placeholder={idx === 0 ? "e.g., $25 gift card" : "e.g., $10 gift card"} />
        </div>
      ))}

      {showTimer && (
        <>
          <div style={sectionLabelStyle}>Reset positions</div>
          <button style={resetBtnStyle} onClick={() => {
            setTimerPosition({ x: 0, y: 0 });
            localStorage.removeItem("timerPosition");
          }}>
            Reset timer position
          </button>
        </>
      )}
    </div>
  );
}
