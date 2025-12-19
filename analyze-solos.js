#!/usr/bin/env node
// analyze-solos.js - Extract solo stats and score ranges for specific teams

const fs = require('fs');
const path = require('path');

// Correct show dates (from user's screenshot)
const SHOW_DATE_CORRECTIONS = {
  'rec8YMRvwPh7S1wSC': '2025-10-03',
  'reczwxHSA7vdki1GS': '2025-10-03',
  'rec77iOrjAs4PTyAP': '2025-10-10',
  'recXTQTpA9ci5N8Gd': '2025-10-10',
  'recnDymnQAko2qQKT': '2025-10-17',
  'recIO1y5uPmNofrBf': '2025-10-17',
  'recJFUX8QFSZf62Ro': '2025-10-24',
  'recrMACfmWG7gqOBD': '2025-10-24',
  'recFZOmryydr7Z5Cg': '2025-11-07',
  'recQvSHw1j45D60uu': '2025-11-07',
  'recfCrRrk8n2sNnFs': '2025-11-15',
  'recG5PTnC30R8LNcr': '2025-11-15',
  'recDBH9a3oL0mFLpf': '2025-11-21',
  'recNDIB0Rt3oBOjPp': '2025-11-21',
  'rechoYY8jUZHHd172': '2025-11-28',
  'recL43xd7OXE3iGe6': '2025-11-28',
  'recbE4mTjJYIZIhAk': '2025-12-05',
  'recGhDR7ivfj5ArEY': '2025-12-05',
  'recynezay65GOYXqk': '2025-12-12',
  'rec9Lk7Oy2G0zKk5C': '2025-12-12',
};

// Target teams (case-insensitive matching)
const TARGET_TEAMS = [
  'Artful Codgers',
  'The Leftovers',
  'Shortbus',
  'We Will School You',
  'What Are the Jeopardy Rejects',
  'Space Mountain',
  'Triviots',
];

// Normalize team name for matching (case-insensitive, trim "the", remove punctuation)
function normalizeTeamName(name) {
  if (!name) return '';
  return name.toLowerCase().trim()
    .replace(/^the\s+/, '')
    .replace(/[?!.,;:]$/g, ''); // Remove trailing punctuation
}

// Check if team matches any target team
function isTargetTeam(teamName) {
  const normalized = normalizeTeamName(teamName);
  return TARGET_TEAMS.some(target => normalizeTeamName(target) === normalized);
}

// Get canonical team name
function getCanonicalTeamName(teamName) {
  const normalized = normalizeTeamName(teamName);
  const match = TARGET_TEAMS.find(target => normalizeTeamName(target) === normalized);
  return match || teamName;
}

// Main analysis
function analyzeShows() {
  const archiveDir = path.join(__dirname, 'archived-shows-data');
  const files = fs.readdirSync(archiveDir)
    .filter(f => f.endsWith('.json') && !f.includes('error'));

  // Data structures for tracking
  const teamSolos = {}; // { teamName: [{ date, questionId, points }, ...] }
  const teamScores = {}; // { teamName: [{ date, showId, score }, ...] }

  // Initialize data structures for target teams
  TARGET_TEAMS.forEach(team => {
    teamSolos[team] = [];
    teamScores[team] = [];
  });

  console.log('📊 Analyzing archived shows...\n');

  // Process each show
  files.forEach(filename => {
    const showId = filename.replace('.json', '');
    const filepath = path.join(archiveDir, filename);
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    // Skip if no scoring data
    if (!data.scoringData || data.scoringData.length === 0) {
      console.log(`⚠️  Skipping ${showId} - no scoring data`);
      return;
    }

    // Get correct date
    const showDate = SHOW_DATE_CORRECTIONS[showId] || data.showDate;

    console.log(`Processing ${showId} (${showDate})...`);

    // Find the grid data and teams data in scoringData array
    let gridData = null;
    let teamsData = null;
    let scoringConfig = null;

    data.scoringData.forEach((roundData) => {
      const { payload } = roundData;
      if (!payload) return;

      if (payload.grid) {
        gridData = payload.grid;
      }
      if (payload.teams) {
        teamsData = payload.teams;
        scoringConfig = {
          mode: payload.scoringMode || 'pooled',
          poolPerQuestion: payload.poolPerQuestion || 150,
          pubPoints: payload.pubPoints || 10,
        };
      }
    });

    if (!gridData || !teamsData) {
      console.log(`⚠️  Skipping ${showId} - missing grid or teams data`);
      return;
    }

    // Build team lookup by showTeamId
    const teamLookup = {};
    teamsData.forEach(t => {
      const teamName = getCanonicalTeamName(t.teamName);
      teamLookup[t.showTeamId] = {
        name: teamName,
        isTarget: isTargetTeam(teamName),
        showBonus: t.showBonus || 0,
      };
    });

    // First pass: count correct answers per question to calculate points
    const questionCorrectCounts = {};
    Object.keys(gridData).forEach(showTeamId => {
      const questionGrid = gridData[showTeamId];
      Object.keys(questionGrid).forEach(questionId => {
        const cell = questionGrid[questionId];
        if (cell.isCorrect) {
          questionCorrectCounts[questionId] = (questionCorrectCounts[questionId] || 0) + 1;
        }
      });
    });

    // Second pass: calculate actual points for each team/question
    const teamTotals = {};
    Object.keys(gridData).forEach(showTeamId => {
      const teamInfo = teamLookup[showTeamId];
      if (!teamInfo) return;

      let total = 0;
      const questionGrid = gridData[showTeamId];

      Object.keys(questionGrid).forEach(questionId => {
        const cell = questionGrid[questionId];

        if (cell.isCorrect) {
          let points = 0;

          // Check for override points first
          if (cell.overridePoints !== null && cell.overridePoints !== undefined) {
            points = cell.overridePoints;
          } else {
            // Calculate based on scoring mode
            const correctCount = questionCorrectCounts[questionId] || 1;
            if (scoringConfig.mode === 'pooled') {
              points = Math.round(scoringConfig.poolPerQuestion / correctCount);
            } else {
              // For other modes, use pubPoints
              points = scoringConfig.pubPoints;
            }
          }

          // Add question bonus
          points += (cell.questionBonus || 0);

          total += points;
        }
      });

      // Add show bonus
      total += teamInfo.showBonus;

      if (teamInfo.isTarget) {
        teamTotals[teamInfo.name] = total;
      }
    });

    // Store team scores for this show
    Object.keys(teamTotals).forEach(teamName => {
      if (!teamScores[teamName]) {
        teamScores[teamName] = [];
      }
      teamScores[teamName].push({
        date: showDate,
        showId,
        score: teamTotals[teamName],
      });
    });

    // Identify solos
    Object.keys(questionCorrectCounts).forEach(questionId => {
      const correctCount = questionCorrectCounts[questionId];

      // Solo = exactly one team got it correct
      if (correctCount === 1) {
        // Find which team got it correct
        Object.keys(gridData).forEach(showTeamId => {
          const teamInfo = teamLookup[showTeamId];
          if (!teamInfo || !teamInfo.isTarget) return;

          const cell = gridData[showTeamId][questionId];
          if (cell && cell.isCorrect) {
            // Calculate points for this solo
            let points = 0;
            if (cell.overridePoints !== null && cell.overridePoints !== undefined) {
              points = cell.overridePoints;
            } else {
              points = scoringConfig.poolPerQuestion; // Full pool for solo
            }
            points += (cell.questionBonus || 0);

            teamSolos[teamInfo.name].push({
              date: showDate,
              showId,
              questionId,
              points,
            });
          }
        });
      }
    });
  });

  return { teamSolos, teamScores };
}

// Run analysis
const { teamSolos, teamScores } = analyzeShows();

console.log('\n=== RESULTS ===\n');

// Output solos
console.log('📍 SOLOS BY TEAM:\n');
TARGET_TEAMS.forEach(team => {
  const solos = teamSolos[team];
  console.log(`\n${team}:`);
  console.log(`  Total solos: ${solos.length}`);
  if (solos.length > 0) {
    console.log(`  Details:`);
    solos.forEach(solo => {
      console.log(`    - ${solo.date}: ${solo.points} points`);
    });
  }
});

// Output score ranges
console.log('\n\n📊 SCORE RANGES BY TEAM:\n');
TARGET_TEAMS.forEach(team => {
  const scores = teamScores[team];

  if (!scores || scores.length === 0) {
    console.log(`\n${team}:`);
    console.log(`  No scores recorded`);
    return;
  }

  // Find highest and lowest scores
  const scoreValues = scores.map(s => s.score);
  const highestScore = Math.max(...scoreValues);
  const lowestScore = Math.min(...scoreValues);
  const difference = highestScore - lowestScore;

  // Find the dates for high and low scores
  const highScoreEntry = scores.find(s => s.score === highestScore);
  const lowScoreEntry = scores.find(s => s.score === lowestScore);

  console.log(`\n${team}:`);
  console.log(`  Highest score: ${highestScore} (on ${highScoreEntry.date})`);
  console.log(`  Lowest score: ${lowestScore} (on ${lowScoreEntry.date})`);
  console.log(`  Difference: ${difference}`);
  console.log(`  Total shows played: ${scores.length}`);
});
