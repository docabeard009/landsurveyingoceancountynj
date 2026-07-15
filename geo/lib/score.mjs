// geo/lib/score.mjs
// Turns raw per-(query,assistant) answers into a visibility scoreboard and a
// ranked list of gaps (queries where the client is invisible), which is the
// output that tells content where to go.

import { toDomain } from './assistants.mjs';

// Did this single answer surface the client? Returns flags + competitor hits.
export function evaluateAnswer(answer, config) {
  const clientDomain = toDomain(config.clientDomain);
  const aliases = [config.brand, ...(config.brandAliases || [])]
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  const competitors = (config.competitors || []).map(toDomain).filter(Boolean);

  const domains = answer.domains || [];
  const text = (answer.text || '').toLowerCase();

  const domainCited = domains.includes(clientDomain);
  const brandMentioned = aliases.some((a) => a && text.includes(a));
  const competitorsCited = competitors.filter((c) => domains.includes(c));

  return {
    ok: !!answer.ok,
    error: answer.error || null,
    domainCited,
    brandMentioned,
    surfaced: domainCited || brandMentioned, // cited OR named
    competitorsCited,
    domains,
  };
}

// pct helper
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// Aggregate a full run (rows of {clusterId, query, results:{assistant:eval}}).
export function aggregate(rows, config) {
  const assistants = Object.keys(config.assistants || {}).filter(
    (a) => config.assistants[a]?.enabled !== false
  );

  // Per-assistant citation rate (only counting answers that returned ok).
  const byAssistant = {};
  for (const a of assistants) {
    let cited = 0, surfaced = 0, answered = 0;
    for (const row of rows) {
      const ev = row.results[a];
      if (!ev || !ev.ok) continue;
      answered++;
      if (ev.domainCited) cited++;
      if (ev.surfaced) surfaced++;
    }
    byAssistant[a] = {
      answered,
      cited,
      surfaced,
      citedPct: pct(cited, answered),
      surfacedPct: pct(surfaced, answered),
    };
  }

  // Per-cluster: how many assistants surfaced the client, averaged.
  const byCluster = {};
  for (const row of rows) {
    const c = row.clusterId;
    byCluster[c] ||= { queries: 0, surfacedSlots: 0, totalSlots: 0 };
    byCluster[c].queries++;
    for (const a of assistants) {
      const ev = row.results[a];
      if (!ev || !ev.ok) continue;
      byCluster[c].totalSlots++;
      if (ev.surfaced) byCluster[c].surfacedSlots++;
    }
  }
  for (const c of Object.keys(byCluster)) {
    byCluster[c].surfacedPct = pct(byCluster[c].surfacedSlots, byCluster[c].totalSlots);
  }

  // Gaps: queries where the client was surfaced by ZERO assistants.
  // Priority boosted when competitors were cited on the same query.
  const gaps = [];
  for (const row of rows) {
    const evs = assistants.map((a) => row.results[a]).filter((e) => e && e.ok);
    if (!evs.length) continue;
    const anySurfaced = evs.some((e) => e.surfaced);
    if (anySurfaced) continue;
    const competitorHits = [...new Set(evs.flatMap((e) => e.competitorsCited))];
    gaps.push({
      clusterId: row.clusterId,
      query: row.query,
      missedBy: assistants.filter((a) => row.results[a]?.ok),
      competitorHits,
      priority: competitorHits.length ? 'high' : 'open',
    });
  }
  gaps.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1));

  const totalQueries = rows.length;
  const overallSurfaced = rows.filter((row) =>
    assistants.some((a) => row.results[a]?.ok && row.results[a].surfaced)
  ).length;

  return {
    assistants,
    totalQueries,
    overallSurfacedPct: pct(overallSurfaced, totalQueries),
    byAssistant,
    byCluster,
    gaps,
  };
}
