// src/scoring/compute.js

/**
 * cell: {
 *   isCorrect: boolean | undefined,
 *   bonusPoints?: number | null,   // per-question bonus for this team (optional)
 *   partialCredit?: number | null  // override points for this question/team (optional)
 * }
 * grid: { [showTeamId]: { [showQuestionId]: cell } }
 * teams: [{ showTeamId, teamName, showBonus?: number }]
 * questions: [{ showQuestionId, order }]
 * scoring: { mode: "pub" | "pooled" | "pooled-adaptive", pubPoints: number, poolPerQuestion: number, poolContribution: number, teamCount: number }
 */

export function buildAnsweredAllMap(teams, questions, grid) {
  const out = {};
  for (const q of questions) {
    const sqid = q.showQuestionId;
    let allAnswered = true;
    for (const t of teams) {
      const cell = grid[t.showTeamId]?.[sqid];
      const answered = cell && typeof cell.isCorrect === "boolean";
      if (!answered) {
        allAnswered = false;
        break;
      }
    }
    out[sqid] = allAnswered;
  }
  return out;
}

export function buildCorrectCountMap(teams, questions, grid) {
  const out = {};
  for (const q of questions) {
    const sqid = q.showQuestionId;
    let c = 0;
    for (const t of teams) {
      const cell = grid[t.showTeamId]?.[sqid];
      if (cell?.isCorrect) c++;
    }
    out[sqid] = c;
  }
  return out;
}

export function buildSoloMap(teams, questions, grid) {
  const out = {};
  for (const q of questions) {
    const sqid = q.showQuestionId;
    // Count how many teams answered correctly (regardless of whether all teams answered)
    let soloTeamId = null,
      count = 0;
    for (const t of teams) {
      const cell = grid[t.showTeamId]?.[sqid];
      if (cell?.isCorrect === true) {
        count++;
        soloTeamId = t.showTeamId;
        if (count > 1) break;
      }
    }
    out[sqid] = count === 1 ? soloTeamId : null;
  }
  return out;
}

export function computeAutoEarned(cell, scoring, correctCount) {
  if (!cell?.isCorrect) return 0;
  if (scoring.mode === "pub") {
    return Number(scoring.pubPoints) || 0;
  }

  const n = Math.max(1, Number(correctCount) || 0);

  // Pooled-adaptive: pool size = teamCount × poolContribution
  if (scoring.mode === "pooled-adaptive") {
    const teamCount = Number(scoring.teamCount) || 0;
    const contribution = Number(scoring.poolContribution) || 0;
    const pool = teamCount * contribution;
    return Math.round(pool / n);
  }

  // Pooled-static: fixed pool size
  return Math.round((Number(scoring.poolPerQuestion) || 0) / n);
}

export function computeCellPoints(
  cell,
  scoring,
  correctCount,
  questionBonus = null
) {
  if (!cell) return 0;

  // Only score if marked correct
  if (!cell.isCorrect) return 0;

  const isPooled =
    scoring.mode === "pooled" || scoring.mode === "pooled-adaptive";

  // Base points from scoring mode
  const auto = computeAutoEarned(cell, scoring, correctCount);

  // Click-cycle bonus system (from question's bonusValue and cell's bonusCount)
  const bonusCount = cell.bonusCount || 0;
  if (questionBonus && bonusCount > 0) {
    const bonusValue = Number(questionBonus.bonusValue) || 0;
    if (isPooled) {
      // Pooled: bonusValue is a percentage multiplier
      // Formula: base * (1 + bonusValue * bonusCount / 100)
      const multiplier = 1 + (bonusValue * bonusCount) / 100;
      return Math.round(auto * multiplier);
    } else {
      // Pub: bonusValue is added directly for each bonus applied
      return auto + (bonusValue * bonusCount);
    }
  }

  return auto;
}

export function buildTeamTotals(
  teams,
  questions,
  grid,
  scoring,
  correctCountMap
) {
  const totals = {};
  for (const t of teams) {
    let sum = Number(t.showBonus || 0);
    for (const q of questions) {
      const cell = grid[t.showTeamId]?.[q.showQuestionId];
      const correctCount = correctCountMap[q.showQuestionId] || 0;
      // Pass question bonus info for click-cycle bonus calculation
      const questionBonus = q.bonusAvailable
        ? { bonusValue: q.bonusValue, maxBonuses: q.maxBonuses }
        : null;
      sum += computeCellPoints(cell, scoring, correctCount, questionBonus);
    }
    totals[t.showTeamId] = sum;
  }
  return totals;
}

/**
 * Compute solo statistics for a round
 * @param {Array} teams - teams array
 * @param {Array} questions - questions for the round
 * @param {Object} grid - answer grid
 * @returns {{ count: number, teams: Array<{showTeamId: string, teamName: string, questionLabels: string[]}> }}
 */
export function computeSolosForRound(teams, questions, grid) {
  const soloMap = buildSoloMap(teams, questions, grid);

  let count = 0;
  // Map of showTeamId -> array of question labels
  const teamSoloQuestions = new Map();

  for (const q of questions) {
    const sqid = q.showQuestionId;
    const soloTeamId = soloMap[sqid];
    if (soloTeamId) {
      count++;
      // Get question label (order number or letter)
      const order = q.order ?? q.questionOrder ?? 0;
      const label = String(order);

      if (!teamSoloQuestions.has(soloTeamId)) {
        teamSoloQuestions.set(soloTeamId, []);
      }
      teamSoloQuestions.get(soloTeamId).push(label);
    }
  }

  // Build list of teams with their solo question labels
  const soloTeamsList = Array.from(teamSoloQuestions.entries()).map(([showTeamId, labels]) => {
    const team = teams.find((t) => t.showTeamId === showTeamId);
    return {
      showTeamId,
      teamName: team?.teamName || "(Unknown)",
      questionLabels: labels,
    };
  });

  return { count, teams: soloTeamsList };
}

/**
 * Compute social statistics for a round (questions where zero teams answered correctly)
 * @param {Array} teams - teams array
 * @param {Array} questions - questions for the round
 * @param {Object} grid - answer grid
 * @returns {{ count: number, questionLabels: string[] }}
 */
export function computeSocialsForRound(teams, questions, grid) {
  const correctCountMap = buildCorrectCountMap(teams, questions, grid);
  const socialLabels = [];

  // First, check if any scoring has happened in this round at all
  // (if no cells exist, we can't determine socials yet)
  let roundHasAnyCells = false;
  for (const q of questions) {
    const sqid = q.showQuestionId;
    for (const t of teams) {
      if (grid[t.showTeamId]?.[sqid]) {
        roundHasAnyCells = true;
        break;
      }
    }
    if (roundHasAnyCells) break;
  }

  // If no scoring has happened yet, return empty
  if (!roundHasAnyCells) {
    return { count: 0, questionLabels: [] };
  }

  // Build a sorted list of question orders
  const questionOrders = questions.map((q) => ({
    sqid: q.showQuestionId,
    order: q.order ?? q.questionOrder ?? 0,
  }));
  questionOrders.sort((a, b) => a.order - b.order);

  // Find max and second-max question orders in the round
  const uniqueOrders = [...new Set(questionOrders.map((q) => q.order))].sort((a, b) => b - a);
  const maxQuestionOrder = uniqueOrders[0] ?? -1;
  const secondMaxOrder = uniqueOrders[1] ?? -Infinity;

  // Find the highest question order that has any cells
  let maxScoredOrder = -1;
  for (const { sqid, order } of questionOrders) {
    for (const t of teams) {
      if (grid[t.showTeamId]?.[sqid]) {
        maxScoredOrder = Math.max(maxScoredOrder, order);
        break;
      }
    }
  }

  for (const q of questions) {
    const sqid = q.showQuestionId;
    const correctCount = correctCountMap[sqid] || 0;
    const order = q.order ?? q.questionOrder ?? 0;

    // A "social" is when:
    // 1. Zero teams got it correct
    // 2. This question has been "passed" (a later question has scoring data)
    //    OR this question itself has at least one cell (someone clicked and cycled back)
    //    OR this is the last question and we've scored up to the second-to-last
    if (correctCount === 0 && teams.length > 0) {
      // Check if this question has been passed (later question has cells)
      const hasBeenPassed = order < maxScoredOrder;

      // Edge case: last question with no cells - consider it passed if
      // we've scored at least the second-to-last question
      const isLastQuestion = order === maxQuestionOrder;
      const penultimateScored = maxScoredOrder >= secondMaxOrder;
      const lastQuestionPassed = isLastQuestion && penultimateScored;

      // Also check if this question itself has any cells (host cycled through)
      let thisQuestionHasCells = false;
      for (const t of teams) {
        if (grid[t.showTeamId]?.[sqid]) {
          thisQuestionHasCells = true;
          break;
        }
      }

      if (hasBeenPassed || thisQuestionHasCells || lastQuestionPassed) {
        socialLabels.push(String(order));
      }
    }
  }

  return { count: socialLabels.length, questionLabels: socialLabels };
}

/**
 * Compute places/rankings from team totals
 * @param {Object} teamTotals - map of showTeamId -> total points
 * @returns {Object} map of showTeamId -> place (1, 2, 3, etc.)
 */
export function computePlaces(teamTotals) {
  // Convert to array and sort by total (descending)
  const entries = Object.entries(teamTotals).map(([showTeamId, total]) => ({
    showTeamId,
    total,
  }));

  entries.sort((a, b) => b.total - a.total);

  const places = {};
  let currentPlace = 1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Handle ties: if total matches previous, use same place
    if (i > 0 && entry.total === entries[i - 1].total) {
      places[entry.showTeamId] = places[entries[i - 1].showTeamId];
    } else {
      places[entry.showTeamId] = currentPlace;
    }

    currentPlace++;
  }

  return places;
}
