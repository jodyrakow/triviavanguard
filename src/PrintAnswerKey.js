import React, { useEffect, useState, useRef } from "react";
import "./PrintAnswerKey.css";

// Reuse sorting logic from AnswerKeyPanel
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
  const categories = round?.categories || [];
  for (const cat of categories) {
    const catQuestions = cat.questions || [];
    allQuestions.push(...catQuestions);
  }
  return allQuestions;
}

function isLettered(q) {
  const order = String(q.questionOrder || "").trim().toUpperCase();
  return /^[A-J]$/i.test(order);
}

function getAnswer(q) {
  return (q.answer || q.Answer || "").toString().trim();
}

function getLabel(q) {
  return String(q.questionOrder || "").trim();
}

export default function PrintAnswerKey() {
  const [loading, setLoading] = useState(true);
  const [showBundle, setShowBundle] = useState(null);
  const [error, setError] = useState("");
  const hasLoadedData = useRef(false);

  useEffect(() => {
    // Prevent double-loading in React StrictMode
    if (hasLoadedData.current) return;
    hasLoadedData.current = true;

    try {
      setLoading(true);
      setError("");

      const dataStr = localStorage.getItem("printAnswerKeyData");
      if (!dataStr) {
        throw new Error("No print data found in storage.");
      }

      const data = JSON.parse(dataStr);
      if (!data.showBundle) {
        throw new Error("Invalid print data: missing showBundle.");
      }

      setShowBundle(data.showBundle);
      localStorage.removeItem("printAnswerKeyData");
    } catch (e) {
      setError(e?.message || "Failed to load print data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-open print dialog
  useEffect(() => {
    if (!loading && !error && showBundle) {
      const t = setTimeout(() => window.print(), 350);
      return () => clearTimeout(t);
    }
  }, [loading, error, showBundle]);

  if (loading) return <div className="printLoading">Loading...</div>;
  if (error) return <div className="printError">Error: {error}</div>;
  if (!showBundle) return <div className="printError">No show data found.</div>;

  // Parse rounds and questions
  const rounds = Array.isArray(showBundle?.rounds) ? showBundle.rounds : [];
  const roundData = rounds.map((round) => {
    const all = flattenQuestions(round);
    const tb = detectTB(all);
    const nonTB = tb ? all.filter((q) => q !== tb) : all;
    const sorted = sortQuestionsForKey(nonTB);

    const lettered = sorted.filter(isLettered);
    const numbered = sorted.filter((q) => !isLettered(q));

    return {
      roundNum: round.round,
      lettered,
      numbered,
    };
  });

  // Build columns (skip empty columns)
  const columns = [];
  for (const rd of roundData) {
    if (rd.lettered.length > 0) {
      columns.push({
        type: "lettered",
        roundNum: rd.roundNum,
        questions: rd.lettered,
        isFirstForRound: true,
      });
    }
    if (rd.numbered.length > 0) {
      columns.push({
        type: "numbered",
        roundNum: rd.roundNum,
        questions: rd.numbered,
        isFirstForRound: rd.lettered.length === 0, // First column if no lettered
      });
    }
  }

  const columnCount = columns.length;
  const isLandscape = columnCount === 4;

  // Show name for title
  const showName =
    showBundle?.Show?.Show || showBundle?.showName || "Unknown Show";

  return (
    <div className={`printPage ${isLandscape ? "landscape" : "portrait"}`}>
      <div className="printToolbar noPrint">
        <button onClick={() => window.print()}>Print</button>
        <button onClick={() => window.close()}>Close</button>
      </div>

      <div className="printContent">
        <h1 className="printTitle">Answer Key — {showName}</h1>

        <div className="printColumns" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
          {columns.map((col, idx) => (
            <div key={idx} className="printColumn">
              {col.isFirstForRound ? (
                <div className="columnHeader">Round {col.roundNum}</div>
              ) : (
                <div className="columnHeader columnHeaderSpacer">&nbsp;</div>
              )}
              <div className="questionList">
                {col.questions.map((q, qIdx) => {
                  const label = getLabel(q);
                  const answer = getAnswer(q);
                  return (
                    <div key={qIdx} className="questionLine">
                      {label}. {answer}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
