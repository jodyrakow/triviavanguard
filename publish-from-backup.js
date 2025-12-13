#!/usr/bin/env node
// Script to publish show results from a backup JSON file

const fs = require('fs');
const path = require('path');
const {
  buildCorrectCountMap,
  computeCellPoints,
} = require('./src/scoring/compute.js');

// Read backup file path from command line
const backupPath = process.argv[2];
if (!backupPath) {
  console.error('Usage: node publish-from-backup.js <path-to-backup.json>');
  process.exit(1);
}

console.log(`📖 Reading backup from: ${backupPath}`);
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const {
  showId,
  showName,
  showDate,
  scoringMode,
  pubPoints,
  poolPerQuestion,
  showBundle,
  cachedByRound,
  standings
} = backup;

console.log(`\n📊 Show Info:`);
console.log(`   Name: ${showName}`);
console.log(`   Date: ${showDate}`);
console.log(`   ID: ${showId}`);
console.log(`   Teams: ${standings.length}`);
console.log(`   Scoring: ${scoringMode}`);

// Build questions list (all questions from all rounds, excluding tiebreakers)
const allQuestions = [];
for (const round of showBundle.rounds || []) {
  for (const cat of round.categories || []) {
    for (const q of cat.questions || []) {
      const questionType = (q.questionType || '').toLowerCase();
      const isTB = questionType === 'tiebreaker' ||
                   String(q.questionOrder).toUpperCase() === 'TB' ||
                   String(q.showQuestionId || '').startsWith('tb-');

      if (!isTB && q.questionId && q.showQuestionId) {
        allQuestions.push({
          showQuestionId: q.showQuestionId,
          questionId: q.questionId,
          pubPerQuestion: typeof q.pointsPerQuestion === 'number' ? q.pointsPerQuestion : null,
        });
      }
    }
  }
}

console.log(`   Questions (non-TB): ${allQuestions.length}`);

// Build teams payload from standings
const teams = cachedByRound.teams || [];
const teamsPayload = standings.map((s) => {
  const team = teams.find(t => t.showTeamId === s.showTeamId || t.teamName === s.teamName);

  // Extract teamId from array if needed (Airtable link fields are arrays)
  let teamId = team?.teamId || null;
  if (Array.isArray(teamId)) {
    teamId = teamId[0] || null;
  }

  return {
    showTeamId: team?.showTeamId || null,
    teamId: teamId,
    teamName: s.teamName,
    finalTotal: s.total,
    finalPlace: s.place,
    isLeague: !!team?.isLeague,
  };
});

console.log(`\n👥 Teams to publish: ${teamsPayload.length}`);
teamsPayload.slice(0, 3).forEach(t => {
  console.log(`   ${t.finalPlace}. ${t.teamName} - ${t.finalTotal} pts`);
});
if (teamsPayload.length > 3) console.log(`   ... and ${teamsPayload.length - 3} more`);

// Build scores payload
const grid = cachedByRound.grid || {};

// Adapt grid format for utility (utility uses bonusPoints/partialCredit)
const adaptedGrid = {};
for (const teamId in grid) {
  adaptedGrid[teamId] = {};
  for (const questionId in grid[teamId]) {
    const cell = grid[teamId][questionId];
    adaptedGrid[teamId][questionId] = {
      isCorrect: cell.isCorrect,
      bonusPoints: cell.questionBonus,
      partialCredit: cell.overridePoints,
    };
  }
}

// Build scoring config for utility
const scoringConfig = {
  mode: scoringMode,
  pubPoints: Number(pubPoints || 0),
  poolPerQuestion: Number(poolPerQuestion || 0),
  poolContribution: Number(poolContribution || 0),
  teamCount: teams.length,
};

// Use utility to build correct count map
const nCorrectByQ = buildCorrectCountMap(teams, allQuestions, adaptedGrid);

const scoresPayload = [];
for (const team of teams) {
  for (const q of allQuestions) {
    const cell = grid[team.showTeamId]?.[q.showQuestionId];
    if (!cell) continue;

    // Adapt cell for utility format
    const adaptedCell = {
      isCorrect: cell.isCorrect,
      bonusPoints: cell.questionBonus,
      partialCredit: cell.overridePoints,
    };

    // Handle per-question pub points
    let config = scoringConfig;
    if (scoringConfig.mode === 'pub') {
      const perQPub = q.pubPerQuestion;
      if (perQPub !== null && perQPub !== undefined) {
        config = { ...scoringConfig, pubPoints: perQPub };
      }
    }

    const correctCount = nCorrectByQ[q.showQuestionId] || 0;
    const pointsEarned = computeCellPoints(adaptedCell, config, correctCount);

    scoresPayload.push({
      showTeamId: team.showTeamId,
      questionId: q.questionId,
      showQuestionId: q.showQuestionId,
      isCorrect: !!cell.isCorrect,
      pointsEarned: Number(pointsEarned || 0),
    });
  }
}

console.log(`\n📝 Scores to publish: ${scoresPayload.length}`);

// Build the final payload
const payload = {
  showId,
  teams: teamsPayload,
  scores: scoresPayload,
};

// Write payload to file for inspection
const payloadPath = path.join(path.dirname(backupPath), 'publish-payload.json');
fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));
console.log(`\n💾 Payload written to: ${payloadPath}`);
console.log(`\n✅ Ready to publish!`);
console.log(`\nTo publish, run:`);
console.log(`curl -X POST https://triviavanguard-show-mode.netlify.app/.netlify/functions/writeShowResults \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d @"${payloadPath}"`);
