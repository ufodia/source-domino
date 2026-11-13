import { writeFile } from 'node:fs/promises';
import { collectSource } from './collector.ts';
import { validateSources } from '../src/core.ts';

const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) { console.log('Usage: npm run collect -- --out corpus.json https://example.org/a https://example.org/b\nFetches only the explicit public URLs. No crawling. Files are never overwritten.'); process.exit(args.includes('--help') ? 0 : 1); }
try {
  let output: string | undefined; const urls: string[] = [];
  for (let i = 0; i < args.length; i++) { if (args[i] === '--out' && args[i + 1]) output = args[++i]; else if (args[i].startsWith('--')) throw new Error(`Unknown or incomplete option: ${args[i]}`); else urls.push(args[i]); }
  if (!output || urls.length < 2 || urls.length > 20) throw new Error('Provide --out and 2–20 public HTTP(S) URLs.');
  const sources = [];
  for (let i = 0; i < urls.length; i++) { console.error(`Collecting ${i + 1}/${urls.length}`); sources.push(await collectSource(urls[i], i)); }
  const corpus = validateSources(sources);
  await writeFile(output, JSON.stringify({ schemaVersion: 1, collectedAt: new Date().toISOString(), sources: corpus }, null, 2) + '\n', { flag: 'wx' });
  console.error(`Saved ${corpus.length} sources to ${output}`);
} catch (error) { console.error(`SourceDomino collector: ${(error as Error).message}`); process.exitCode = 1; }
