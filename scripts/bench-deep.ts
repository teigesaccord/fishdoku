/**
 * Benchmark the Deep Water generator over consecutive daily seeds.
 *
 *   npx vite-node scripts/bench-deep.ts [days] [startDate]
 *
 * Reports success rate, attempts (restarts + 1), repairs, and p50/p95/max time
 * per tank. Desktop numbers should sit well under the 1000 ms phone budget
 * (aim for <= 250 ms) to leave room for slower phones.
 */
import { generateDeepV1 } from "../src/core/deep/generator";
import type { DeepGenStats } from "../src/core/deep/generator";

const days = Number(process.argv[2] ?? 200);
const start = process.argv[3] ?? "2026-12-01";
const SIZE = 8;

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

const times: number[] = [];
const attempts: number[] = [];
const repairs: number[] = [];
let failures = 0;

for (let i = 0; i < days; i++) {
  const date = addDays(start, i);
  const stats: DeepGenStats = { attempts: 0, repairs: 0 };
  const t0 = performance.now();
  try {
    generateDeepV1(`fishdoku:deep-v1:${date}`, SIZE, stats);
  } catch {
    failures++;
  }
  times.push(performance.now() - t0);
  attempts.push(stats.attempts);
  repairs.push(stats.repairs);
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

console.log(`deep-v1 ${SIZE}x${SIZE}, ${days} days from ${start}`);
console.log(`  success   ${days - failures}/${days}`);
console.log(`  time ms   p50 ${pct(times, 50).toFixed(1)}  p95 ${pct(times, 95).toFixed(1)}  max ${Math.max(...times).toFixed(1)}`);
console.log(`  attempts  mean ${mean(attempts).toFixed(2)}  max ${Math.max(...attempts)}`);
console.log(`  repairs   mean ${mean(repairs).toFixed(2)}  max ${Math.max(...repairs)}`);
