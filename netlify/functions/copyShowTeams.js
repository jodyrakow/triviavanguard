// List source shows and copy selected existing Airtable teams into a destination show.
// Team identity is preserved; scoring data is never copied.
const Airtable = require("airtable");
const { createClient } = require("@supabase/supabase-js");

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base("appnwzfwa2Bl6V2jX");
const validId = (id) => typeof id === "string" && /^rec[A-Za-z0-9]{14}$/.test(id);
const json = (statusCode, value) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
const linked = (record, field) => Array.isArray(record.fields[field]) ? record.fields[field] : [];
const showIds = (record) => {
  const raw = record.fields["Show ID"];
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String);
};
// Match the working fetchShowBundle filter, not the returned lookup value.
const showTeamRowsFor = (showId) => base("ShowTeams").select({
  filterByFormula: "FIND('" + showId + "', ARRAYJOIN({Show ID}))",
  pageSize: 100
}).all();
const teamIdsOf = (record) => {
  const linkedIds = linked(record, "Team");
  return linkedIds.length ? linkedIds : (Array.isArray(record.fields["Team ID"]) ? record.fields["Team ID"] : [record.fields["Team ID"]].filter(Boolean));
};
const teamNameOfShowTeam = (record) => {
  const raw = record.fields["Team name"];
  if (Array.isArray(raw)) return String(raw[0] || "(Unnamed team)");
  if (typeof raw === "string" && raw.startsWith("[")) {
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return String(parsed[0] || "(Unnamed team)"); } catch (_) {}
  }
  return String(raw || "(Unnamed team)");
};
const nameOf = (record) => String(record.fields["Team"] || "(Unnamed team)");

exports.handler = async (event) => {
  try {
    if (!process.env.AIRTABLE_TOKEN) return json(500, { error: "Airtable is not configured" });
    if (event.httpMethod === "GET") {
      const destination = event.queryStringParameters?.destinationShowId;
      const source = event.queryStringParameters?.sourceShowId;
      if (!validId(destination)) return json(400, { error: "Invalid destination show" });
      if (!source) {
        const shows = await base("Shows").select({ fields: ["Show", "Date"], sort: [{ field: "Date", direction: "desc" }], maxRecords: 100 }).all();
        return json(200, { shows: shows.filter((s) => s.id !== destination).map((s) => ({ id: s.id, label: String(s.fields.Show || s.fields.Date || s.id) })) });
      }
      if (!validId(source) || source === destination) return json(400, { error: "Invalid source show" });
      const [sourceRows, destinationRows] = await Promise.all([
        showTeamRowsFor(source), showTeamRowsFor(destination)
      ]);
      const sourceTeamIds = [...new Set(sourceRows.flatMap(teamIdsOf))];
      const destinationTeamIds = new Set(destinationRows.flatMap(teamIdsOf));
      const teams = await Promise.all(sourceTeamIds.map(async (id) => {
        const row = sourceRows.find((item) => teamIdsOf(item).includes(id));
        return { teamId: id, teamName: row ? teamNameOfShowTeam(row) : nameOf(await base("Teams").find(id)), alreadyInDestination: destinationTeamIds.has(id) };
      }));
      return json(200, { teams: teams.sort((a, b) => a.teamName.localeCompare(b.teamName)), diagnostics: { matchingShowTeamRecords: sourceRows.length + destinationRows.length, sourceRecords: sourceRows.length, sourceTeamIds: sourceTeamIds.length } });
    }
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
    const { sourceShowId, destinationShowId, teamIds } = JSON.parse(event.body || "{}");
    if (!validId(sourceShowId) || !validId(destinationShowId) || sourceShowId === destinationShowId ||
        !Array.isArray(teamIds) || teamIds.length > 250 || !teamIds.every(validId)) {
      return json(400, { error: "Invalid copy request" });
    }
    if (!process.env.REACT_APP_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      return json(500, { error: "Supabase is not configured" });

    const [sourceRows, destinationRows] = await Promise.all([
      showTeamRowsFor(sourceShowId), showTeamRowsFor(destinationShowId)
    ]);
    const sourceIds = new Set(sourceRows.flatMap(teamIdsOf));
    const existing = new Map(destinationRows.flatMap((row) =>
      teamIdsOf(row).map((teamId) => [teamId, row.id])));
    const requested = [...new Set(teamIds)];
    if (requested.some((id) => !sourceIds.has(id))) return json(400, { error: "Selected team does not belong to the source show" });

    const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: current, error: loadError } = await supabase.from("show_teams").select("show_team_id,entry_order,is_removed").eq("show_id", destinationShowId);
    if (loadError) throw loadError;
    const supaRows = new Map((current || []).map((row) => [row.show_team_id, row]));
    let nextOrder = Math.max(-1, ...(current || []).map((row) => Number(row.entry_order) || 0)) + 1;
    const results = { added: 0, restored: 0, skipped: 0 };
    for (const teamId of requested) {
      let showTeamId = existing.get(teamId);
      if (!showTeamId) {
        const created = await base("ShowTeams").create({ Show: [destinationShowId], Team: [teamId] });
        showTeamId = created.id;
        existing.set(teamId, showTeamId);
      }
      const supaRow = supaRows.get(showTeamId);
      if (supaRow && !supaRow.is_removed) { results.skipped++; continue; }
      if (supaRow?.is_removed) {
        const { error } = await supabase.from("show_teams").update({ is_removed: false }).eq("show_id", destinationShowId).eq("show_team_id", showTeamId);
        if (error) throw error;
        results.restored++;
      } else {
        const team = await base("Teams").find(teamId);
        const { error } = await supabase.from("show_teams").upsert({
          show_id: destinationShowId, show_team_id: showTeamId, team_id: teamId,
          team_name: nameOf(team), show_bonus: 0, is_league: false,
          entry_order: nextOrder++, is_removed: false
        }, { onConflict: "show_id,show_team_id", ignoreDuplicates: true });
        if (error) throw error;
        results.added++;
      }
    }
    return json(200, results);
  } catch (error) {
    console.error("copyShowTeams failed", error);
    return json(500, { error: error.message || "Unable to copy teams" });
  }
};
