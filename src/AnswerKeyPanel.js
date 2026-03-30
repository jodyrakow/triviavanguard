// src/AnswerKeyPanel.js
import React from "react";
import { Button, tokens, colors as theme } from "./styles/index.js";

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

function detectTB(list) {
  return (
    list.find((q) => (q.questionType || "").toLowerCase() === "tiebreaker") ||
    list.find((q) => String(q.questionOrder).toUpperCase() === "TB") ||
    list.find((q) => String(q.id || "").startsWith("tb-")) ||
    null
  );
}

function flattenQuestions(round) {
  const allQuestions = [];
  for (const cat of round?.categories || []) {
    allQuestions.push(...(cat.questions || []));
  }
  return allQuestions;
}

function isLettered(q) {
  return /^[A-Z]$/i.test(String(q.questionOrder || "").trim());
}

function getLabel(q) {
  return String(q.questionOrder || "").trim();
}

function getAnswer(q) {
  return (q.answer ?? q.Answer ?? "").toString().trim();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Build a standalone HTML document for printing
function buildPrintHTML(showBundle, showName, { includeLabels, gameLabel }) {
  const rounds = Array.isArray(showBundle?.rounds) ? showBundle.rounds : [];
  const isSingleRound = rounds.length === 1;

  const roundSections = rounds.map((round, idx) => {
    const all = flattenQuestions(round);
    const tb = detectTB(all);
    const nonTB = tb ? all.filter((q) => q !== tb) : all;
    const sorted = sortQuestionsForKey(nonTB);

    const lettered = sorted.filter(isLettered);
    const numbered = sorted.filter((q) => !isLettered(q));

    const header =
      isSingleRound && gameLabel ? gameLabel : `Round ${round.round}`;

    let questionsHTML = "";
    lettered.forEach((q) => {
      const prefix = includeLabels ? `${getLabel(q)}. ` : "";
      questionsHTML += `<div class="qline">${escapeHtml(prefix + getAnswer(q))}</div>`;
    });
    if (lettered.length > 0 && numbered.length > 0) {
      // Two blank lines between lettered (J) and numbered (1) sections
      questionsHTML += `<div style="height:2.4em"></div>`;
    }
    numbered.forEach((q) => {
      const prefix = includeLabels ? `${getLabel(q)}. ` : "";
      questionsHTML += `<div class="qline">${escapeHtml(prefix + getAnswer(q))}</div>`;
    });

    const isLastRound = idx === rounds.length - 1;
    const pageBreak = !isLastRound
      ? "page-break-after:always;break-after:page;"
      : "";

    return `<div style="${pageBreak}"><div class="rhead">${escapeHtml(header)}</div>${questionsHTML}</div>`;
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Answer Key${showName ? " \u2014 " + showName : ""}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Arial, sans-serif;
  font-size: 12pt;
  color: #000;
  background: #fff;
  padding: 0.5in;
}
.rhead {
  font-size: 12pt;
  font-weight: bold;
  margin-bottom: 0.3in;
}
.qline {
  line-height: 1.5;
  white-space: nowrap;
}
@page { margin: 0.5in; size: 8.5in 11in; }
@media print { body { padding: 0; } }
</style>
</head>
<body>${roundSections.join("")}</body>
</html>`;
}

// Build plain text preview
function buildShowAnswerKeyText(showBundle, { withLabels = true } = {}) {
  const rounds = Array.isArray(showBundle?.rounds) ? showBundle.rounds : [];
  const parts = [];
  for (const round of rounds) {
    const all = flattenQuestions(round);
    const tb = detectTB(all);
    const nonTB = tb ? all.filter((q) => q !== tb) : all;
    const qs = sortQuestionsForKey(nonTB);

    const lines = [`Round ${round.round}`];
    for (const q of qs) {
      const label = String(q.questionOrder ?? "").trim();
      const ans = (q.answer ?? "").toString().trim();
      lines.push(withLabels && label ? `${label}. ${ans}` : ans);
    }
    parts.push(lines.join("\n"));
  }
  return parts.join("\n\n");
}

export default function AnswerKeyPanel({ showBundle, showName, onClose }) {
  const [akIncludeLabels, setAkIncludeLabels] = React.useState(true);
  const [gameLabel, setGameLabel] = React.useState(null); // null = "Round X"

  const rounds = Array.isArray(showBundle?.rounds) ? showBundle.rounds : [];
  const isSingleRound = rounds.length === 1;

  const answerKeyText = React.useMemo(() => {
    return buildShowAnswerKeyText(showBundle, { withLabels: akIncludeLabels });
  }, [showBundle, akIncludeLabels]);

  const copyAnswerKey = async () => {
    try {
      await navigator.clipboard.writeText(answerKeyText);
      alert("Answer key copied to clipboard.");
    } catch {
      window.prompt("Copy the answer key:", answerKeyText);
    }
  };

  const printAnswerKey = () => {
    const html = buildPrintHTML(showBundle, showName, {
      includeLabels: akIncludeLabels,
      gameLabel: isSingleRound ? gameLabel : null,
    });

    // Use a hidden iframe so no new tab opens
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;opacity:0;border:none;";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        // Fallback: open in new tab if iframe print is blocked
        window.open(url, "_blank");
      }
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 60000);
    };
  };

  const defaultLabel = `Round ${rounds[0]?.round ?? 1}`;
  const gameLabelOptions = [
    { value: null, label: defaultLabel },
    { value: "Game 1", label: "Game 1" },
    { value: "Game 2", label: "Game 2" },
  ];

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

      {/* Game label selector — single-round shows only */}
      {isSingleRound && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            marginBottom: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: ".85rem", color: theme.dark }}>Header:</span>
          {gameLabelOptions.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setGameLabel(opt.value)}
              style={{
                fontSize: ".82rem",
                padding: ".2rem .5rem",
                border: `1px solid ${gameLabel === opt.value ? theme.accent : theme.gray.border || "#ccc"}`,
                borderRadius: ".4rem",
                background: gameLabel === opt.value ? theme.accent : "#fff",
                color: gameLabel === opt.value ? "#fff" : theme.dark,
                cursor: "pointer",
                fontWeight: gameLabel === opt.value ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: tokens.spacing.sm,
          marginBottom: "0.5rem",
        }}
      >
        <Button onClick={copyAnswerKey}>Copy</Button>
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
