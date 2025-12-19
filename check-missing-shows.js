#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const TARGET_TEAMS = [
  'Artful Codgers',
  'The Leftovers',
  'Shortbus',
  'We Will School You',
  'What Are the Jeopardy Rejects',
  'Space Mountain',
  'Triviots',
];

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

const teamShows = {};
TARGET_TEAMS.forEach(team => {
  teamShows[team] = [];
});

const archiveDir = path.join(__dirname, 'archived-shows-data');
const files = fs.readdirSync(archiveDir).filter(f => f.endsWith('.json') && !f.includes('error'));

files.forEach(filename => {
  const showId = filename.replace('.json', '');
  const filepath = path.join(archiveDir, filename);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

  if (!data.scoringData || data.scoringData.length === 0) return;

  const showDate = SHOW_DATE_CORRECTIONS[showId] || data.showDate;
  let teamsData = null;

  data.scoringData.forEach((roundData) => {
    const { payload } = roundData;
    if (payload && payload.teams) {
      teamsData = payload.teams;
    }
  });

  if (!teamsData) return;

  const teamsInShow = new Set();
  teamsData.forEach(t => {
    const teamName = getCanonicalTeamName(t.teamName);
    if (isTargetTeam(teamName)) {
      teamsInShow.add(teamName);
    }
  });

  teamsInShow.forEach(teamName => {
    teamShows[teamName].push({ date: showDate, showId });
  });
});

console.log('Shows per team:\n');
TARGET_TEAMS.forEach(team => {
  console.log(`${team}: ${teamShows[team].length} shows`);
});

console.log('\n\nMissing shows by team:\n');
const allShows = Array.from(new Set(Object.values(teamShows).flat().map(s => s.date))).sort();
console.log(`Total unique dates: ${allShows.length}`);
console.log(`Dates: ${allShows.join(', ')}\n`);

TARGET_TEAMS.forEach(team => {
  const teamDates = new Set(teamShows[team].map(s => s.date));
  const missing = allShows.filter(d => !teamDates.has(d));
  if (missing.length > 0) {
    console.log(`${team} missing ${missing.length} shows: ${missing.join(', ')}`);
  }
});
