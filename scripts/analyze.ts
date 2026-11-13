import { readFile, writeFile } from 'node:fs/promises';
import { analyzeSources, parseSources } from '../src/core.ts';

const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('Usage: npm run analyze -- corpus.json [--threshold 0.55] [--out report.json]');
  process.exit(args.includes('--help') ? 0 : 1);
}
try {
  const input = args[0]; let threshold = 0.55; let output: string | undefined;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--threshold' && args[i + 1]) threshold = Number(args[++i]);
    else if (args[i] === '--out' && args[i + 1]) output = args[++i];
    else throw new Error(`Unknown or incomplete option: ${args[i]}`);
  }
  const sources = parseSources(await readFile(input, 'utf8'));
  const result = JSON.stringify(analyzeSources(sources, threshold), null, 2) + '\n';
  if (output) await writeFile(output, result, { flag: 'wx' }); else process.stdout.write(result);
} catch (error) { console.error(`SourceDomino: ${(error as Error).message}`); process.exitCode = 1; }
