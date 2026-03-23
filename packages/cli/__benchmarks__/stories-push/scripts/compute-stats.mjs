#!/usr/bin/env node

/**
 * Compute statistics from benchmark run timings and output results.
 *
 * Called by run-benchmark.sh with timing arrays as comma-separated values.
 * Outputs a JSON result file and prints a formatted table to stdout.
 */

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  args[key] = process.argv[i + 1];
}

const createTimes = args['create-times'].split(',').map(Number).filter(n => !Number.isNaN(n));
const updateTimes = args['update-times'].split(',').map(Number).filter(n => !Number.isNaN(n));
const totalTimes = createTimes.map((c, i) => c + updateTimes[i]);

function sorted(arr) {
  return [...arr].sort((a, b) => a - b);
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) { return 0; }
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

function stats(values) {
  if (values.length === 0) {
    return { median: 0, mean: 0, stddev: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
  }
  const s = sorted(values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  return {
    median: percentile(s, 50),
    mean: Math.round(mean),
    stddev: Math.round(stddev),
    min: s[0],
    max: s[s.length - 1],
    p50: percentile(s, 50),
    p95: percentile(s, 95),
    p99: percentile(s, 99),
  };
}

function fmtMs(ms) {
  if (ms < 1000) { return `${Math.round(ms)}ms`; }
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtThroughput(ms, count) {
  if (ms === 0) { return 'N/A'; }
  return `${((count / ms) * 1000).toFixed(1)} stories/s`;
}

// Compute
const storyCount = Number(args.stories) || 500;
const createStats = stats(createTimes);
const updateStats = stats(updateTimes);
const totalStats = stats(totalTimes);

const createThroughputs = createTimes.map(t => t > 0 ? (storyCount / t) * 1000 : 0);
const updateThroughputs = updateTimes.map(t => t > 0 ? (storyCount / t) * 1000 : 0);
const createThroughputStats = stats(createThroughputs);
const updateThroughputStats = stats(updateThroughputs);

const result = {
  config: {
    label: args.label || 'unnamed',
    storyCount,
    runs: Number(args.runs) || createTimes.length,
    spaceId: args.space || 'unknown',
  },
  timestamp: new Date().toISOString(),
  rawTimes: {
    createMs: createTimes,
    updateMs: updateTimes,
    totalMs: totalTimes,
  },
  summary: {
    create: createStats,
    update: updateStats,
    total: totalStats,
    createThroughput: createThroughputStats,
    updateThroughput: updateThroughputStats,
  },
};

// Write JSON
const fs = await import('node:fs/promises');
if (args.output) {
  await fs.writeFile(args.output, JSON.stringify(result, null, 2));
}

// Print table
console.log('');
console.log('  Phase Timings (median / mean +/- stddev):');
console.log(`  ${'-'.repeat(68)}`);

const phases = [
  ['Total', totalStats],
  ['Create (fresh)', createStats],
  ['Update (re-push)', updateStats],
];

for (const [name, s] of phases) {
  console.log(
    `  ${name.padEnd(20)} ${fmtMs(s.median).padStart(8)} / ${fmtMs(s.mean).padStart(8)} +/- ${fmtMs(s.stddev).padStart(8)}   [${fmtMs(s.min)} - ${fmtMs(s.max)}]`,
  );
}

console.log('');
console.log('  Throughput (median):');
console.log(`  ${'-'.repeat(68)}`);
console.log(`  ${'Create'.padEnd(20)} ${fmtThroughput(createStats.median, storyCount)}`);
console.log(`  ${'Update'.padEnd(20)} ${fmtThroughput(updateStats.median, storyCount)}`);

console.log('');
console.log('  Individual runs:');
console.log(`  ${'-'.repeat(68)}`);
for (let i = 0; i < createTimes.length; i++) {
  console.log(
    `  Run ${String(i + 1).padStart(2)}:  create ${fmtMs(createTimes[i]).padStart(8)}  update ${fmtMs(updateTimes[i]).padStart(8)}  total ${fmtMs(totalTimes[i]).padStart(8)}`,
  );
}

// Compare mode: read a baseline file and print deltas
if (args.compare) {
  try {
    const baselineContent = await fs.readFile(args.compare, 'utf-8');
    const baseline = JSON.parse(baselineContent);

    console.log('');
    console.log('  Comparison vs baseline:');
    console.log(`  ${'-'.repeat(68)}`);

    const comparisons = [
      ['Total', baseline.summary.total, totalStats],
      ['Create', baseline.summary.create, createStats],
      ['Update', baseline.summary.update, updateStats],
    ];

    console.log(`  ${'Metric'.padEnd(20)} ${'Baseline'.padStart(10)} ${'Current'.padStart(10)} ${'Delta'.padStart(10)} ${'Delta %'.padStart(10)}`);
    for (const [name, base, curr] of comparisons) {
      const delta = curr.median - base.median;
      const deltaPercent = base.median !== 0 ? (delta / base.median) * 100 : 0;
      const sign = delta <= 0 ? '' : '+';
      console.log(
        `  ${name.padEnd(20)} ${fmtMs(base.median).padStart(10)} ${fmtMs(curr.median).padStart(10)} ${(sign + fmtMs(Math.abs(delta))).padStart(10)} ${(`${sign + deltaPercent.toFixed(1)}%`).padStart(10)}`,
      );
    }
  }
  catch {
    console.log(`  Could not load baseline: ${args.compare}`);
  }
}

console.log('');
