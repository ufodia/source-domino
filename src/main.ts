import './style.css';
import { analyzeSources, demoSources, parseSources, validateSources, type Report, type Source } from './core';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header><a class="brand" href="./" aria-label="SourceDomino home"><span class="brand-mark" aria-hidden="true">▰</span>Source<span>Domino</span></a><nav aria-label="Project"><span class="local-badge"><i></i> Local evidence, no uploads</span><a href="https://github.com/ufodia/source-domino" target="_blank" rel="noreferrer">GitHub ↗</a><a class="support" href="https://buymeacoffee.com/ufodia" target="_blank" rel="noreferrer">Support the project ↗</a></nav></header>
<main><section class="hero"><div><p class="eyebrow">A CITATION IS A STARTING POINT.</p><h1>Six links.<br><em>How many stories?</em></h1><p class="lede">Follow citations and shared wording upstream. See the relationships behind a stack of sources before you count them as independent evidence.</p></div><div class="hero-aside"><span class="domino" aria-hidden="true"><i></i><i></i></span><p>Follow the chain.<br>Keep the uncertainty.</p><span class="version">OPEN SOURCE / V0.1</span></div></section>
<section class="desk" aria-label="Source genealogy workbench"><div class="desk-toolbar"><div><span class="signal-dot"></span><strong id="corpus-title">The small-study echo</strong><span id="corpus-label">SYNTHETIC DEMO</span></div><button id="demo">Load demo</button><button id="import-open">Import corpus</button><button id="export">Export report ↗</button></div><div class="summary"><div><span class="metric" id="source-count">6</span><p>source records</p></div><div><span class="metric" id="citation-count">5</span><p>declared citations</p></div><div><span class="metric" id="family-count">3</span><p>wording families</p></div><p class="summary-note">A family groups overlapping text.<br>It does not establish who copied whom.</p></div>
<div class="work-grid"><section class="graph-panel"><div class="section-head"><div><p class="eyebrow">01 / FOLLOW THE CHAIN</p><h2>Source map</h2></div><button id="collapse" aria-pressed="false">Collapse families</button></div><div class="legend"><span><i class="line citation"></i> Declared citation →</span><span><i class="line echo"></i> Shared wording</span></div><svg id="graph" viewBox="0 0 750 490" aria-label="Source relationship graph" role="group"></svg><div class="graph-footer"><label for="threshold">Wording overlap threshold <output id="threshold-value">55%</output></label><input id="threshold" type="range" min="10" max="100" step="5" value="55"><p>The threshold applies to five-word containment. A shared 12-word passage also creates a link. Select a node to inspect evidence.</p></div></section><aside class="inspector"><p class="eyebrow">02 / LOOK CLOSER</p><div id="inspector-content"></div></aside></div>
<section class="sources-panel"><div class="section-head"><div><p class="eyebrow">03 / YOUR SOURCE MATERIAL</p><h2>Corpus</h2></div><button id="add" class="primary">+ Add source</button></div><div id="source-list"></div><p class="corpus-note">Paste source text or import a JSON corpus. The browser does not fetch websites. Use the optional local collector CLI for public URLs.</p></section></section>
<p id="message" class="message" role="status" aria-live="polite"></p><footer><p>Good evidence has a history. Follow it.</p><span>MIT © 2026 Ufodia</span><a href="https://github.com/ufodia/source-domino/blob/main/docs/user-guide.md" target="_blank" rel="noreferrer">Read the field guide ↗</a></footer></main>
<dialog id="edit-dialog" aria-labelledby="edit-title"><form id="source-form"><div class="dialog-heading"><div><p class="eyebrow">SOURCE RECORD</p><h2 id="edit-title">Add source</h2></div><button type="button" class="close" data-close="edit-dialog" aria-label="Close source editor">×</button></div><label for="source-title">Title</label><input id="source-title" maxlength="500" required><label for="source-url">Canonical URL</label><input id="source-url" type="url" maxlength="4096" required placeholder="https://example.org/article"><label for="source-date">Published date <span>(optional, not independently verified)</span></label><input id="source-date" type="date"><label for="source-content">Source text <span>Include citation URLs to preserve visible links.</span></label><textarea id="source-content" rows="9" maxlength="100000" required></textarea><p id="edit-error" class="error" role="alert"></p><button type="submit" class="primary">Save source</button></form></dialog>
<dialog id="import-dialog" aria-labelledby="import-title"><div class="dialog-heading"><div><p class="eyebrow">LOCAL JSON IMPORT</p><h2 id="import-title">Bring your own corpus</h2></div><button class="close" data-close="import-dialog" aria-label="Close corpus import">×</button></div><p>Provide 2–20 records with url, title, content, and an optional publishedAt date.</p><label class="file-label">Select JSON file<input id="import-file" type="file" accept=".json,application/json"></label><label for="import-text">Or paste JSON</label><textarea id="import-text" rows="9" placeholder='{"sources":[{"url":"https://example.org/a","title":"A source","content":"Source text…"}]}'></textarea><p id="import-error" class="error" role="alert"></p><button id="import-apply" class="primary">Import corpus</button></dialog>`;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let sources = demoSources.map(s => ({ ...s })); let report: Report; let selected = 'lab'; let collapsed = false; let threshold = 0.55; let editing: string | null = null;
let importVersion = 0;
function message(text: string, error = false) { el('message').textContent = text; el('message').classList.toggle('error', error); }
function refresh() { report = analyzeSources(sources, threshold); el('source-count').textContent = `${sources.length}`; el('citation-count').textContent = `${report.edges.filter(e => e.kind === 'citation').length}`; el('family-count').textContent = `${report.groups.length}`; renderGraph(); renderInspector(); renderSources(); }
function node<T extends keyof SVGElementTagNameMap>(tag: T, attributes: Record<string, string> = {}, text?: string): SVGElementTagNameMap[T] { const item = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attributes)) item.setAttribute(key, value); if (text !== undefined) item.textContent = text; return item; }
function renderGraph() {
  const svg = document.getElementById('graph') as unknown as SVGSVGElement; svg.replaceChildren();
  const defs = node('defs'); const marker = node('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' }); marker.append(node('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#678a97' })); defs.append(marker); svg.append(defs);
  const items = collapsed ? report.groups.map(group => ({ id: group.id, label: group.members.length > 1 ? `${group.members.length} overlapping sources` : sources.find(s => s.id === group.members[0])!.title, source: group.earliestCandidate ?? group.members[0], count: group.members.length })) : sources.map(source => ({ id: source.id, label: source.title, source: source.id, count: 1 }));
  const points = new Map<string, { x: number; y: number }>();
  const graphHeight = items.length > 8 ? Math.ceil(items.length / 3) * 115 + 50 : 490;
  svg.setAttribute('viewBox', `0 0 750 ${graphHeight}`);
  items.forEach((item, index) => { const angle = -Math.PI / 2 + index / items.length * Math.PI * 2; points.set(item.id, items.length > 8 ? { x: 125 + (index % 3) * 250, y: 75 + Math.floor(index / 3) * 115 } : { x: 375 + Math.cos(angle) * (items.length <= 3 ? 202 : 238), y: 245 + Math.sin(angle) * 162 }); });
  const familyFor = (source: string) => report.groups.find(g => g.members.includes(source))!.id;
  const drawn = new Set<string>();
  for (const edge of report.edges) {
    const from = collapsed ? familyFor(edge.from) : edge.from; const to = collapsed ? familyFor(edge.to) : edge.to;
    const key = `${edge.kind}-${from}-${to}`; if (from === to || drawn.has(key)) continue; drawn.add(key);
    const a = points.get(from)!, b = points.get(to)!; const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy); const offset = edge.kind === 'citation' ? -6 : 6;
    const path = node('path', { d: `M${a.x + dx / length * 48} ${a.y + dy / length * 25} Q${(a.x + b.x) / 2 - dy / length * offset} ${(a.y + b.y) / 2 + dx / length * offset} ${b.x - dx / length * 50} ${b.y - dy / length * 26}`, fill: 'none', stroke: edge.kind === 'citation' ? '#617e8a' : '#9a6b3b', 'stroke-width': edge.kind === 'citation' ? '1.7' : '1.3', ...(edge.kind === 'overlap' ? { 'stroke-dasharray': '5 5' } : { 'marker-end': 'url(#arrow)' }) });
    path.append(node('title', {}, `${edge.kind}: ${edge.evidence}`)); svg.append(path);
  }
  items.forEach((item, index) => {
    const p = points.get(item.id)!; const active = item.source === selected || (collapsed && report.groups.find(g => g.id === item.id)!.members.includes(selected));
    const group = node('g', { class: `map-node ${active ? 'active' : ''}`, transform: `translate(${p.x},${p.y})`, tabindex: '0', role: 'button', 'data-source': item.source, 'aria-describedby': `source-description-${index}` });
    group.append(node('desc', { id: `source-description-${index}` }, `Inspect ${item.label}`));
    group.append(node('rect', { x: '-97', y: '-34', width: '194', height: '68', rx: '7', fill: active ? '#143947' : '#fffdf8', stroke: active ? '#143947' : '#728b8b', 'stroke-width': '1.4' }));
    group.append(node('text', { x: '-79', y: '-10', 'font-size': '10', fill: active ? '#a9d0cf' : '#526b70', 'font-family': 'monospace' }, `SOURCE ${String(index + 1).padStart(2, '0')}${item.count > 1 ? ` / ×${item.count}` : ''}`));
    group.append(node('text', { x: '-79', y: '12', 'font-size': '11', fill: active ? '#fffdf5' : '#2d4852', 'font-family': 'Arial,sans-serif' }, item.label.length > 26 ? item.label.slice(0, 25) + '…' : item.label));
    const choose = () => { selected = item.source; renderGraph(); renderInspector(); renderSources(); svg.querySelector<SVGGElement>(`[data-source="${CSS.escape(item.source)}"]`)?.focus(); }; group.addEventListener('click', choose); group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } }); svg.append(group);
  });
  if (items.length <= 8) { const center = node('text', { x: '375', y: '246', 'text-anchor': 'middle', fill: '#526b70', 'font-family': 'monospace', 'font-size': '9', 'letter-spacing': '2' }, collapsed ? 'WORDING FAMILIES' : 'FOLLOW THE EVIDENCE'); svg.append(center); }
}
function renderInspector() {
  const panel = el('inspector-content'); panel.replaceChildren(); const source = sources.find(s => s.id === selected) ?? sources[0]; selected = source.id;
  const group = report.groups.find(g => g.members.includes(source.id))!;
  const tag = document.createElement('span'); tag.className = 'source-tag'; tag.textContent = `${group.members.length > 1 ? 'SHARED WORDING FAMILY' : 'SEPARATE WORDING'} / ${group.members.length} RECORD${group.members.length > 1 ? 'S' : ''}`;
  const heading = document.createElement('h2'); heading.textContent = source.title; heading.tabIndex = -1;
  const link = document.createElement('a'); link.className = 'source-link'; link.href = source.url; link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = new URL(source.url).hostname + ' ↗';
  const date = document.createElement('p'); date.className = 'date'; date.textContent = source.publishedAt ? `Supplied date · ${source.publishedAt}` : 'No publication date supplied';
  const note = document.createElement('div'); note.className = 'origin-note'; const earliest = sources.find(s => s.id === group.earliestCandidate); note.textContent = `${earliest ? `Earliest dated candidate: ${earliest.title}. ` : ''}${group.dateNote}`;
  panel.append(tag, heading, link, date, note);
  const label = document.createElement('h3'); label.textContent = 'Observed relationships'; panel.append(label);
  const edges = report.edges.filter(e => e.from === source.id || e.to === source.id);
  if (!edges.length) { const p = document.createElement('p'); p.className = 'explanation'; p.textContent = 'No configured relationships found in this supplied text. This does not establish independence.'; panel.append(p); }
  edges.forEach(edge => {
    const other = sources.find(s => s.id === (edge.from === source.id ? edge.to : edge.from))!;
    const box = document.createElement('div'); box.className = `relationship ${edge.kind}`;
    const kind = document.createElement('span'); kind.className = 'relationship-kind'; kind.textContent = edge.kind === 'citation' ? (edge.from === source.id ? 'CITES →' : '← CITED BY') : `SHARED WORDING · ${Math.round(edge.score * 100)}% FIVE-WORD CONTAINMENT`;
    const title = document.createElement('button'); title.textContent = other.title; title.onclick = () => { selected = other.id; refresh(); el('inspector-content').querySelector<HTMLElement>('h2')?.focus(); };
    const evidence = document.createElement('p'); evidence.textContent = edge.kind === 'citation' ? edge.evidence : `${edge.basis === 'passage' ? 'Shared 12-word passage (normalized)' : 'Shared five-word phrase'}: “${edge.evidence}”`;
    box.append(kind, title, evidence); panel.append(box);
  });
  const excerpt = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Read supplied source text'; const content = document.createElement('p'); content.className = 'source-text'; content.textContent = source.content; excerpt.append(summary, content); panel.append(excerpt);
}
function renderSources() {
  const list = el('source-list'); list.replaceChildren();
  sources.forEach((source, index) => {
    const row = document.createElement('div'); row.className = `source-row ${source.id === selected ? 'selected' : ''}`;
    const number = document.createElement('span'); number.className = 'row-number'; number.textContent = String(index + 1).padStart(2, '0');
    const info = document.createElement('button'); info.className = 'source-info'; info.dataset.source = source.id; const title = document.createElement('strong'); title.textContent = source.title; const domain = document.createElement('span'); domain.textContent = new URL(source.url).hostname; info.append(title, domain); info.onclick = () => { selected = source.id; refresh(); el('source-list').querySelector<HTMLButtonElement>(`.source-info[data-source="${CSS.escape(source.id)}"]`)?.focus(); };
    const date = document.createElement('span'); date.className = 'row-date'; date.textContent = source.publishedAt ?? 'Date unknown';
    const edit = document.createElement('button'); edit.className = 'row-action'; edit.textContent = 'Edit'; edit.setAttribute('aria-label', `Edit ${source.title}`); edit.onclick = () => openEditor(source);
    const remove = document.createElement('button'); remove.className = 'row-action remove'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${source.title}`); remove.disabled = sources.length <= 2; remove.onclick = () => { sources = sources.filter(s => s.id !== source.id); if (selected === source.id) selected = sources[0].id; markCustom(); refresh(); el('source-list').querySelector<HTMLButtonElement>(`.source-info[data-source="${CSS.escape(selected)}"]`)?.focus(); message('Source removed from the local corpus.'); };
    row.append(number, info, date, edit, remove); list.append(row);
  });
  el<HTMLButtonElement>('add').disabled = sources.length >= 20;
}
function markCustom() { importVersion++; el('corpus-title').textContent = 'Your source investigation'; el('corpus-label').textContent = 'LOCAL CORPUS'; }
function openEditor(source?: Source) {
  editing = source?.id ?? null; el('edit-title').textContent = source ? 'Edit source' : 'Add source';
  el<HTMLInputElement>('source-title').value = source?.title ?? ''; el<HTMLInputElement>('source-url').value = source?.url ?? ''; el<HTMLInputElement>('source-date').value = source?.publishedAt ?? ''; el<HTMLTextAreaElement>('source-content').value = source?.content ?? ''; el('edit-error').textContent = ''; el<HTMLDialogElement>('edit-dialog').showModal();
}
el<HTMLFormElement>('source-form').onsubmit = event => {
  event.preventDefault(); const source: Source = { id: editing ?? `custom-${crypto.randomUUID()}`, url: el<HTMLInputElement>('source-url').value, title: el<HTMLInputElement>('source-title').value, content: el<HTMLTextAreaElement>('source-content').value, ...(el<HTMLInputElement>('source-date').value ? { publishedAt: el<HTMLInputElement>('source-date').value } : {}) };
  try { const updated = editing ? sources.map(s => s.id === editing ? source : s) : [...sources, source]; sources = validateSources(updated); selected = source.id; markCustom(); refresh(); el<HTMLDialogElement>('edit-dialog').close(); el('source-list').querySelector<HTMLButtonElement>(`.source-info[data-source="${CSS.escape(selected)}"]`)?.focus(); message('Source saved. Relationships recalculated from the supplied text.'); } catch (error) { el('edit-error').textContent = (error instanceof SyntaxError ? 'This is not valid SourceDomino corpus JSON. Choose a JSON file exported in the documented format.' : (error as Error).message); }
};
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-close]')) button.onclick = () => { if (button.dataset.close === 'import-dialog') importVersion++; el<HTMLDialogElement>(button.dataset.close!).close(); };
el<HTMLDialogElement>('import-dialog').addEventListener('cancel', () => { importVersion++; });
el('add').onclick = () => openEditor();
el('collapse').onclick = () => { collapsed = !collapsed; el('collapse').textContent = collapsed ? 'Expand families' : 'Collapse families'; el('collapse').setAttribute('aria-pressed', String(collapsed)); renderGraph(); };
el<HTMLInputElement>('threshold').oninput = event => { el('threshold-value').textContent = `${(event.target as HTMLInputElement).value}%`; };
el<HTMLInputElement>('threshold').onchange = event => { threshold = +(event.target as HTMLInputElement).value / 100; refresh(); message('Wording families recalculated. Citations do not change with the threshold.'); };
el('demo').onclick = () => { importVersion++; sources = demoSources.map(s => ({ ...s })); selected = 'lab'; threshold = 0.55; el<HTMLInputElement>('threshold').value = '55'; el('threshold-value').textContent = '55%'; el('corpus-title').textContent = 'The small-study echo'; el('corpus-label').textContent = 'SYNTHETIC DEMO'; refresh(); message('Synthetic six-source corpus loaded. No demo URLs are fetched.'); };
el('import-open').onclick = () => { importVersion++; el<HTMLInputElement>('import-file').value = ''; el('import-error').textContent = ''; el<HTMLDialogElement>('import-dialog').showModal(); };
function applyImport(text: string) { importVersion++; try { sources = parseSources(text); selected = sources[0].id; markCustom(); refresh(); el<HTMLDialogElement>('import-dialog').close(); message(`Imported ${sources.length} sources. Text was analyzed locally.`); } catch (error) { el('import-error').textContent = (error instanceof SyntaxError ? 'This is not valid SourceDomino corpus JSON. Choose a JSON file exported in the documented format.' : (error as Error).message); } }
el('import-apply').onclick = () => applyImport(el<HTMLTextAreaElement>('import-text').value);
el<HTMLInputElement>('import-file').onchange = async event => { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; const version = ++importVersion; if (file.size > 2_500_000) { el('import-error').textContent = 'Corpus exceeds the 2.5 MB limit.'; input.value = ''; return; } try { const text = await file.text(); if (version !== importVersion) return; applyImport(text); input.value = ''; } catch (error) { if (version === importVersion) { el('import-error').textContent = (error instanceof SyntaxError ? 'This is not valid SourceDomino corpus JSON. Choose a JSON file exported in the documented format.' : (error as Error).message); input.value = ''; } } };
el('export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'source-domino-report.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('Report downloaded. It contains your supplied source text.'); };
refresh(); message('Synthetic demo ready. Solid arrows are citations; dashed lines show shared wording.');
