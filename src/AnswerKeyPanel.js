// src/AnswerKeyPanel.js
import React from "react";
import { Button, tokens, colors as theme } from "./styles/index.js";

// match ScoringMode's sorting (letters A..Z first, then numbers)
function sortQuestionsForKey(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return [...list].sort((a, b) => {
    const sa = Number(a.sortOrder ?? 9999);
    const sb = Number(b.sortOrder ?? 9999);
    if (sa !== sb) return sa - sb;

    const cvt = (val) => {
      if (typeof val === "string" && /^[A-Z]$/i.test(val)) {
        return val.toUpperCase().charCodeAt(0) - 64; // A=1
      }
      const n = parseInt(val, 10);
      return Number.isNaN(n) ? 9999 : 100 + n;
    };
    return cvt(a.questionOrder) - cvt(b.questionOrder);
  });
}

// detect tiebreaker (skip it for the key)
function detectTB(list) {
  return (
    list.find((q) => (q.questionType || "").toLowerCase() === "tiebreaker") ||
    list.find((q) => String(q.questionOrder).toUpperCase() === "TB") ||
    list.find((q) => String(q.id || "").startsWith("tb-")) ||
    null
  );
}

// Flatten questions from hierarchical structure (rounds → categories → questions)
function flattenQuestions(round) {
  const allQuestions = [];
  const categories = round?.categories || [];
  for (const cat of categories) {
    const catQuestions = cat.questions || [];
    allQuestions.push(...catQuestions);
  }
  return allQuestions;
}

// Build the answer key text for ONE round
function buildRoundAnswerKeyText(round, { withLabels = true } = {}) {
  if (!round) return "";
  const all = flattenQuestions(round);
  const tb = detectTB(all);
  const nonTB = tb ? all.filter((q) => q !== tb) : all;

  const qs = sortQuestionsForKey(nonTB);

  const lines = [];
  for (const q of qs) {
    const label = String(q.questionOrder ?? "").trim();
    const ans = (q.answer ?? "").toString().trim();
    const line = withLabels && label ? `${label}. ${ans}` : ans;
    lines.push(line);
  }

  const head = `Round ${round.round}`;
  return [head, ...lines].join("\n");
}

// Build a full-show text (separated by rounds)
function buildShowAnswerKeyText(showBundle, { withLabels = true } = {}) {
  const rounds = Array.isArray(showBundle?.rounds) ? showBundle.rounds : [];
  const parts = [];
  for (const r of rounds) {
    const txt = buildRoundAnswerKeyText(r, { withLabels });
    if (txt.trim()) parts.push(txt);
  }
  return parts.join("\n\n"); // blank line between rounds
}

export default function AnswerKeyPanel({ showBundle, showName, onClose }) {
  const [akIncludeLabels, setAkIncludeLabels] = React.useState(true);

  const answerKeyText = React.useMemo(() => {
    return buildShowAnswerKeyText(showBundle, { withLabels: akIncludeLabels });
  }, [showBundle, akIncludeLabels]);

  const copyAnswerKey = async () => {
    const text = answerKeyText;
    try {
      await navigator.clipboard.writeText(text);
      alert("Answer key copied to clipboard.");
    } catch {
      window.prompt("Copy the answer key:", text);
    }
  };

  const downloadAnswerKey = () => {
    const text = answerKeyText;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // If there's one round, use its number; otherwise "all-rounds"
    const rounds = Array.isArray(showBundle?.rounds) ? showBundle.rounds : [];
    const filename =
      rounds.length === 1
        ? `answer-key-round-${rounds[0]?.round ?? "x"}.txt`
        : "answer-key-all-rounds.txt";
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  };

  const printAnswerKey = () => {
    try {
      // Store showBundle and showName in localStorage for the print page
      localStorage.setItem(
        "printAnswerKeyData",
        JSON.stringify({ showBundle, showName })
      );
      // Open print page in new tab
      window.open(window.location.origin + "/?print-answer-key", "_blank");
    } catch (err) {
      console.error("Failed to open print window:", err);
      alert("Failed to open print window: " + err.message);
    }
  };

  return (
    <div
      style={{
        marginTop: "0.75rem",
        marginBottom: "0.75rem",
        padding: "0.75rem",
        background: "#fff",
        border: `1px solid ${theme.gray.borderLight}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: tokens.spacing.sm,
          flexWrap: "wrap",
          marginBottom: "0.5rem",
        }}
      >
        <strong style={{ marginRight: 8, color: theme.dark }}>
          Answer Key
        </strong>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: theme.gray.text,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: "0.5rem",
          color: theme.dark,
        }}
      >
        <input
          type="checkbox"
          checked={akIncludeLabels}
          onChange={(e) => setAkIncludeLabels(e.target.checked)}
        />
        Include labels (A., 1., etc.)
      </label>

      <div
        style={{
          display: "flex",
          gap: tokens.spacing.sm,
          marginBottom: "0.5rem",
        }}
      >
        <Button onClick={copyAnswerKey}>Copy</Button>
        <Button onClick={downloadAnswerKey}>Download .txt</Button>
        <Button onClick={printAnswerKey}>Print</Button>
      </div>

      {/* Preview */}
      <pre
        style={{
          marginTop: 8,
          marginBottom: 0,
          background: theme.gray.bgLightest,
          border: `1px solid ${theme.gray.borderLighter}`,
          borderRadius: 6,
          padding: "0.5rem",
          fontSize: "0.9rem",
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
          maxHeight: "300px",
          overflowY: "auto",
          color: theme.dark,
        }}
      >
        {answerKeyText || "(No questions to display)"}
      </pre>
    </div>
  );
}
