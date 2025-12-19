#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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
  'recbE4mTjJYIZIhAk': '2025-12-05',
  'recGhDR7ivfj5ArEY': '2025-12-05',
  'recynezay65GOYXqk': '2025-12-12',
  'rec9Lk7Oy2G0zKk5C': '2025-12-12',
};

const EXCLUDED_SHOWS = new Set([
  'rechoYY8jUZHHd172',
  'recL43xd7OXE3iGe6',
]);

const TARGET_TEAMS = [
  'Artful Codgers',
  'The Leftovers',
  'Shortbus',
  'We Will School You',
  'What Are the Jeopardy Rejects',
  'Space Mountain',
  'Triviots',
];

function normalizeTeamName(name) {
  if (!name) return '';
  return name.toLowerCase().trim()
    .replace(/^the\s+/, '')
    .replace(/^(what|who)\s+are\s+/, '')
    .replace(/[?!.,;:]$/g, '');
}

function isTargetTeam(teamName) {
  const normalized = normalizeTeamName(teamName);
  return TARGET_TEAMS.some(target => normalizeTeamName(target) === normalized);
}

function getCanonicalTeamName(teamName) {
  const normalized = normalizeTeamName(teamName);
  const match = TARGET_TEAMS.find(target => normalizeTeamName(target) === normalized);
  return match || teamName;
}

const archiveDir = path.join(__dirname, 'archived-shows-data');
const files = fs.readdirSync(archiveDir).filter(f => f.endsWith('.json') && !f.includes('error'));

const showScores = [];

files.forEach(filename => {
  const showId = filename.replace('.json', '');

  if (EXCLUDED_SHOWS.has(showId)) return;

  const filepath = path.join(archiveDir, filename);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

  if (!data.scoringData || data.scoringData.length === 0) return;

  const showDate = SHOW_DATE_CORRECTIONS[showId] || data.showDate;

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

  if (!gridData || !teamsData) return;

  const teamLookup = {};
  teamsData.forEach(t => {
    const teamName = getCanonicalTeamName(t.teamName);
    teamLookup[t.showTeamId] = {
      name: teamName,
      isTarget: isTargetTeam(teamName),
      showBonus: t.showBonus || 0,
    };
  });

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

  const teamTotals = {};
  TARGET_TEAMS.forEach(team => teamTotals[team] = null);

  Object.keys(gridData).forEach(showTeamId => {
    const teamInfo = teamLookup[showTeamId];
    if (!teamInfo) return;

    let total = 0;
    const questionGrid = gridData[showTeamId];

    Object.keys(questionGrid).forEach(questionId => {
      const cell = questionGrid[questionId];

      if (cell.isCorrect) {
        let points = 0;

        if (cell.overridePoints !== null && cell.overridePoints !== undefined) {
          points = cell.overridePoints;
        } else {
          const correctCount = questionCorrectCounts[questionId] || 1;
          if (scoringConfig.mode === 'pooled') {
            points = Math.round(scoringConfig.poolPerQuestion / correctCount);
          } else {
            points = scoringConfig.pubPoints;
          }
        }

        points += (cell.questionBonus || 0);
        total += points;
      }
    });

    total += teamInfo.showBonus;

    if (teamInfo.isTarget) {
      teamTotals[teamInfo.name] = total;
    }
  });

  showScores.push({
    date: showDate,
    showId,
    scores: teamTotals,
  });
});

// Sort by date
showScores.sort((a, b) => a.date.localeCompare(b.date));

// Output as CSV
console.log('Date,Show ID,' + TARGET_TEAMS.join(','));
showScores.forEach(show => {
  const scores = TARGET_TEAMS.map(team => show.scores[team] === null ? '-' : show.scores[team]);
  console.log(`${show.date},${show.showId},${scores.join(',')}`);
});
