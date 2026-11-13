/** Optional, explicit public-web collection. This module never runs in the browser. */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { normalizeUrl, type Source } from '../src/core.ts';

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 12_000;
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 88 && c === 99) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return false;
    return true;
  }
  if (family === 6) {
    const first = parseInt(address.split(':')[0], 16);
    if (!Number.isFinite(first) || first < 0x2000 || first > 0x3fff) return false;
    const lower = address.toLowerCase();
    // Conservatively exclude transition, protocol-assignment and documentation ranges.
    if (lower.startsWith('2002:') || lower.startsWith('3fff:')) return false;
    if (lower.startsWith('2001:')) { const second = parseInt(address.split(':')[1] || '0', 16); if (second <= 0x1ff || second === 0xdb8) return false; }
    return true;
  }
  return false;
}
export function validateTarget(value: string): URL {
  const url = new URL(normalizeUrl(value));
  if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) throw new Error('Only standard HTTP(S) ports are supported.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|localhost\.|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error('Local or internal hostnames are blocked.');
  if (isIP(host) && !isPublicAddress(host)) throw new Error('Private, reserved, and non-public addresses are blocked.');
  return url;
}
async function requestPinned(url: URL): Promise<{ body: string; redirect?: string }> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('DNS resolution timed out.')), TIMEOUT_MS); });
  let addresses: { address: string; family: number }[];
  try { addresses = await Promise.race([lookup(hostname, { all: true, verbatim: true }), timeout]); } finally { if (timer) clearTimeout(timer); }
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('DNS includes a private, reserved, or non-public address.');
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(url, {
      method: 'GET', agent: false, family: pinned.family,
      lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
      headers: { Accept: 'text/html,text/plain;q=0.9', 'Accept-Encoding': 'identity', 'User-Agent': 'SourceDomino/0.1 (explicit local source collection)' },
    }, response => {
      if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        response.destroy();
        if (!location) { reject(new Error('Redirect has no destination.')); return; }
        try { resolve({ body: '', redirect: new URL(location, url).href }); }
        catch { reject(new Error('Redirect has an invalid destination.')); }
        return;
      }
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) { response.destroy(); reject(new Error(`HTTP ${response.statusCode ?? 'unknown'}`)); return; }
      const type = response.headers['content-type'] ?? '';
      if (!/^(text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/i.test(type)) { response.destroy(); reject(new Error('Only HTML and plain-text responses are supported.')); return; }
      const encoding = response.headers['content-encoding'];
      if (encoding && encoding !== 'identity') { response.destroy(); reject(new Error('Compressed HTTP responses are not supported by the bounded collector.')); return; }
      const length = Number(response.headers['content-length']);
      if (Number.isFinite(length) && length > MAX_BYTES) { response.destroy(); reject(new Error('Response exceeds the 2 MB limit.')); return; }
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > MAX_BYTES) { response.destroy(new Error('Response exceeds the 2 MB limit.')); return; } chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8') }));
    });
    const deadline = setTimeout(() => request.destroy(new Error('Request exceeded the 12-second time limit.')), TIMEOUT_MS);
    request.on('error', reject); request.on('close', () => clearTimeout(deadline)); request.end();
  });
}
function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi, entity => {
    const known: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' };
    if (known[entity.toLowerCase()] !== undefined) return known[entity.toLowerCase()];
    const code = entity.toLowerCase().startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  });
}
export function htmlToText(html: string, baseUrl: string): { title: string; content: string } {
  const title = decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/<[^>]*>/g, '').trim() ?? new URL(baseUrl).hostname);
  const clean = html.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const linked = clean.replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi, (_, href: string, text: string) => { try { const url = new URL(decodeEntities(href), baseUrl); return ` ${text} (${normalizeUrl(url.href)}) `; } catch { return text; } });
  const content = decodeEntities(linked.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  return { title: title.slice(0, 500), content: content.slice(0, 100000) };
}
export async function collectSource(value: string, index: number): Promise<Source> {
  let url = validateTarget(value);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const result = await requestPinned(url);
    if (result.redirect) { if (redirects === 3) throw new Error('More than three redirects.'); url = validateTarget(result.redirect); continue; }
    const parsed = htmlToText(result.body, url.href);
    if (!parsed.content) throw new Error('Source has no readable text.');
    return { id: `source-${index + 1}`, url: normalizeUrl(url.href), ...parsed };
  }
  throw new Error('Collection failed.');
}
