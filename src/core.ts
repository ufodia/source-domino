export interface Source { id: string; url: string; title: string; content: string; publishedAt?: string }
export interface Edge { from: string; to: string; kind: 'citation' | 'overlap'; score: number; evidence: string; basis?: 'containment' | 'passage'; phraseCoverage?: { shared: number; fromTotal: number; toTotal: number } }
export interface Group { id: string; members: string[]; earliestCandidate: string | null; dateNote: string }
export interface Report { schemaVersion: 1; sources: Source[]; threshold: number; edges: Edge[]; groups: Group[]; caveat: string }
export const MAX_SOURCES = 20;
export const MAX_CONTENT = 100000;
export function normalizeUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Source URLs must be HTTP(S) without credentials.');
  url.hash = ''; url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.pathname === '/' && !url.search ? url.href.slice(0, -1) : url.href;
}
export function validateSources(value: unknown): Source[] {
  const raw = Array.isArray(value) ? value : value && typeof value === 'object' && 'sources' in value ? value.sources : null;
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_SOURCES) throw new Error('Provide 2–20 source records.');
  const urls = new Set<string>(); const ids = new Set<string>();
  return raw.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Source ${index + 1} is not an object.`);
    if (typeof item.url !== 'string' || item.url.length > 4096 || typeof item.content !== 'string' || !item.content.trim() || item.content.length > MAX_CONTENT || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 500) throw new Error(`Source ${index + 1} needs a URL, title, and 1–100,000 characters of content.`);
    const url = normalizeUrl(item.url);
    if (urls.has(url)) throw new Error(`Duplicate source URL: ${url}`); urls.add(url);
    const id = typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,60}$/.test(item.id) ? item.id : `source-${index + 1}`;
    if (ids.has(id)) throw new Error(`Duplicate source ID: ${id}`); ids.add(id);
    let publishedAt: string | undefined;
    if (item.publishedAt !== undefined && item.publishedAt !== '') {
      if (typeof item.publishedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt) || !Number.isFinite(Date.parse(item.publishedAt)) || new Date(item.publishedAt).toISOString().slice(0, 10) !== item.publishedAt) throw new Error(`Source ${index + 1} has an invalid date. Use YYYY-MM-DD or omit it.`);
      publishedAt = item.publishedAt;
    }
    return { id, url, title: item.title.trim(), content: item.content.trim(), ...(publishedAt ? { publishedAt } : {}) };
  });
}
export function parseSources(text: string): Source[] { if (text.length > 2_500_000) throw new Error('Corpus exceeds the 2.5 MB text limit.'); return validateSources(JSON.parse(text)); }
export function tokens(text: string): string[] { return text.toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu) ?? []; }
export function shingles(text: string, size = 5): Set<string> { const words = tokens(text); const set = new Set<string>(); for (let i = 0; i <= words.length - size; i++) set.add(words.slice(i, i + size).join(' ')); return set; }
export function overlap(left: string, right: string): { score: number; evidence: string } {
  const { score, evidence } = overlapShingles(shingles(left), shingles(right));
  return { score, evidence };
}
function overlapShingles(a: Set<string>, b: Set<string>): { score: number; evidence: string; shared: number; leftTotal: number; rightTotal: number } {
  if (!a.size || !b.size) return { score: 0, evidence: '', shared: 0, leftTotal: a.size, rightTotal: b.size };
  let common = 0; let witness = '';
  for (const phrase of a) if (b.has(phrase)) { common++; if (!witness) witness = phrase; }
  // Containment, not Jaccard: a short syndicated excerpt can overlap a long original.
  return { score: common / Math.min(a.size, b.size), evidence: witness, shared: common, leftTotal: a.size, rightTotal: b.size };
}
export function extractUrls(content: string): string[] {
  const raw = content.match(/https?:\/\/[^\s<>"']+/giu) ?? [];
  const values: string[] = [];
  for (const candidate of raw) try {
    const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
    const balance: Record<string, number> = { '(': 0, '[': 0, '{': 0 };
    for (const character of candidate) {
      if (Object.hasOwn(balance, character)) balance[character]++;
      else if (pairs[character]) balance[pairs[character]]--;
    }
    let end = candidate.length;
    while (end) {
      const last = candidate[end - 1];
      if (/[,.!?;]/.test(last)) { end--; continue; }
      const opening = pairs[last];
      if (opening && balance[opening] < 0) { end--; balance[opening]++; continue; }
      break;
    }
    values.push(normalizeUrl(candidate.slice(0, end)));
  } catch { /* Non-URL text is not evidence. */ }
  return [...new Set(values)];
}
export function analyzeSources(input: unknown, threshold = 0.55): Report {
  if (!Number.isFinite(threshold) || threshold < 0.1 || threshold > 1) throw new Error('Overlap threshold must be between 0.1 and 1.');
  const sources = validateSources(input); const edges: Edge[] = [];
  for (const source of sources) {
    for (const url of extractUrls(source.content)) {
      const target = sources.find(s => s.url === url);
      if (target && target.id !== source.id) edges.push({ from: source.id, to: target.id, kind: 'citation', score: 1, evidence: url });
    }
  }
  const phrases = sources.map(source => shingles(source.content));
  // Eight consecutive matching five-word shingles form a 12-word passage.
  // This length threshold is independent of total article size.
  const passages = sources.map(source => shingles(source.content, 12));
  for (let i = 0; i < sources.length; i++) for (let j = i + 1; j < sources.length; j++) {
    const match = overlapShingles(phrases[i], phrases[j]);
    let passage: string | undefined;
    for (const phrase of passages[i]) if (passages[j].has(phrase)) { passage = phrase; break; }
    if (passage || (match.score >= threshold && match.evidence)) edges.push({ from: sources[i].id, to: sources[j].id, kind: 'overlap', score: Number(match.score.toFixed(4)), evidence: passage || match.evidence, basis: passage ? 'passage' : 'containment', phraseCoverage: { shared: match.shared, fromTotal: match.leftTotal, toTotal: match.rightTotal } });
  }
  const parent = new Map(sources.map(s => [s.id, s.id]));
  function find(id: string): string { const p = parent.get(id)!; if (p === id) return p; const result = find(p); parent.set(id, result); return result; }
  for (const edge of edges.filter(e => e.kind === 'overlap')) parent.set(find(edge.from), find(edge.to));
  const sets = new Map<string, Source[]>();
  for (const source of sources) { const key = find(source.id); const list = sets.get(key) ?? []; list.push(source); sets.set(key, list); }
  const groups = [...sets.values()].map((members, index): Group => {
    const dated = members.filter(s => s.publishedAt).sort((a, b) => a.publishedAt!.localeCompare(b.publishedAt!));
    const missing = members.length - dated.length;
    const tied = dated.length > 1 && dated[0].publishedAt === dated[1].publishedAt;
    return { id: `group-${index + 1}`, members: members.map(s => s.id), earliestCandidate: dated.length && !tied ? dated[0].id : null, dateNote: !dated.length ? 'No dates supplied. Origin is unknown.' : tied ? 'Earliest supplied date is tied. Origin is unknown.' : `${missing ? `${missing} undated source(s). ` : ''}Earliest supplied date is a candidate only; dates are not verified.` };
  });
  return { schemaVersion: 1, sources, threshold, edges, groups, caveat: 'Citation and wording relationships in supplied text only. Similarity does not prove copying, independence, truth, or original authorship.' };
}
export const demoSources: Source[] = [
  { id: 'lab', url: 'https://lab.example/report', title: 'The original field report', publishedAt: '2026-10-03', content: 'Our controlled pilot included twelve volunteers using a document assistant over one week. Participants completed fewer repeated searches when the assistant linked each answer to the original paragraph. The pilot did not measure long term retention, commercial revenue, or performance outside this small group. Further testing with larger samples is needed before drawing broad conclusions.' },
  { id: 'wire', url: 'https://wire.example/story', title: 'A wire story repeats the pilot', publishedAt: '2026-10-04', content: 'Our controlled pilot included twelve volunteers using a document assistant over one week. Participants completed fewer repeated searches when the assistant linked each answer to the original paragraph. The pilot did not measure long term retention, commercial revenue, or performance outside this small group. Further testing with larger samples is needed before drawing broad conclusions. Source: https://lab.example/report' },
  { id: 'digest', url: 'https://digest.example/ai', title: 'The weekly AI digest', publishedAt: '2026-10-05', content: 'Our controlled pilot included twelve volunteers using a document assistant over one week. Participants completed fewer repeated searches when the assistant linked each answer to the original paragraph. The pilot did not measure long term retention, commercial revenue, or performance outside this small group. Further testing with larger samples is needed before drawing broad conclusions. Read the wire: https://wire.example/story' },
  { id: 'newsletter', url: 'https://letter.example/42', title: 'A newsletter with the same passage', content: 'Participants completed fewer repeated searches when the assistant linked each answer to the original paragraph. The pilot did not measure long term retention, commercial revenue, or performance outside this small group. Further testing with larger samples is needed before drawing broad conclusions. Via https://digest.example/ai' },
  { id: 'critique', url: 'https://review.example/notes', title: 'An independently worded critique', publishedAt: '2026-10-06', content: 'Twelve participants and seven days cannot establish that a product improves professional research in general. A useful next experiment would separate interface improvements from model quality and repeat the task with independent evaluators. The source deserves credit for its caveats: https://lab.example/report' },
  { id: 'unrelated', url: 'https://garden.example/soil', title: 'An unrelated source for comparison', publishedAt: '2026-10-01', content: 'Healthy soil supports roots through drainage and organic matter. Gardeners can compare beds by checking moisture at consistent depths throughout the growing season. Shade, rainfall, and local climate matter more than a universal watering schedule.' }
];
