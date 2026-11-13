import { describe, expect, it } from 'vitest';
import { analyzeSources, demoSources, extractUrls, normalizeUrl, overlap, parseSources, validateSources } from './core';

describe('corpus validation', () => {
  it('normalizes tracking-only URL variants without dropping content query parameters', () => {
    expect(normalizeUrl('https://EXAMPLE.org/a/?utm_source=x&mode=1#part')).toBe('https://example.org/a/?mode=1');
    expect(normalizeUrl('https://example.org/')).toBe('https://example.org');
    expect(normalizeUrl('https://example.org/page?next=/')).toBe('https://example.org/page?next=%2F');
    expect(normalizeUrl('https://example.org/path/')).toBe('https://example.org/path/');
  });
  it('rejects credentials, dangerous schemes, duplicate IDs and URLs', () => {
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow();
    expect(() => normalizeUrl('https://user:pass@example.org')).toThrow();
    expect(() => validateSources([demoSources[0], demoSources[0]])).toThrow();
    expect(() => validateSources([demoSources[0], { ...demoSources[1], id: 'lab' }])).toThrow();
  });
  it('requires 2–20 records and real calendar dates', () => {
    expect(() => validateSources([demoSources[0]])).toThrow();
    expect(() => validateSources([demoSources[0], { ...demoSources[1], publishedAt: '2026-02-30' }])).toThrow();
    expect(() => validateSources([demoSources[0], { ...demoSources[1], content: '' }])).toThrow();
  });
  it('reads a report as a new corpus while preserving literal hostile text', () => {
    const sources = parseSources(JSON.stringify({ sources: [demoSources[0], { ...demoSources[1], title: '<img src=x onerror=alert(1)>' }] }));
    expect(sources[1].title).toContain('<img');
  });
});
describe('relationship evidence', () => {
  it('distinguishes declared citations from shared wording', () => {
    const report = analyzeSources(demoSources);
    expect(report.edges.filter(e => e.kind === 'citation')).toHaveLength(4);
    expect(report.groups).toHaveLength(3);
    expect(report.groups.find(g => g.members.includes('lab'))?.members).toHaveLength(4);
  });
  it('links exact canonical URLs, not substring lookalikes', () => {
    const sources = [demoSources[0], { ...demoSources[1], content: 'Read https://lab.example/report-extra for more.' }];
    expect(analyzeSources(sources).edges.filter(e => e.kind === 'citation')).toHaveLength(0);
  });
  it('extracts unique citation URLs from markdown and plain text', () => {
    expect(extractUrls('Read [this](https://example.org/a). Also https://example.org/a#part')).toEqual(['https://example.org/a']);
  });
  it('finds a syndicated excerpt inside a longer source', () => {
    const excerpt = 'Participants completed fewer repeated searches when the assistant linked each answer to the original paragraph.';
    expect(overlap(demoSources[0].content, excerpt).score).toBe(1);
    expect(overlap(demoSources[0].content, demoSources[5].content).score).toBe(0);
  });
  it('does not group sources merely because they cite each other', () => {
    const report = analyzeSources([demoSources[0], demoSources[4]]);
    expect(report.edges[0].kind).toBe('citation'); expect(report.groups).toHaveLength(2);
  });
  it('expresses missing dates and ties without claiming an origin', () => {
    const inputs = [{ ...demoSources[0], publishedAt: '2026-10-03' }, { ...demoSources[1], publishedAt: '2026-10-03' }];
    expect(analyzeSources(inputs).groups[0].earliestCandidate).toBeNull();
    const undated = inputs.map(({ publishedAt: _, ...source }) => source);
    expect(analyzeSources(undated).groups[0].dateNote).toContain('No dates');
    expect(analyzeSources(demoSources).groups[0].dateNote).toContain('undated');
  });
  it('rejects threshold values outside its contract', () => {
    for (const threshold of [NaN, 0, 1.1]) expect(() => analyzeSources(demoSources, threshold)).toThrow();
  });
});
