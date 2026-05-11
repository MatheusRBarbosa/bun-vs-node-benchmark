import { readFileSync } from 'node:fs';

export type Row = {
  site_id: string;
  connected_asset_reading_id: string;
  connected_asset_id: string;
  type: string;
  source_category: string;
  source: string;
  interval_date: string;
  time: string;
  cumulative_value_wh: number;
  delta_value_wh: number;
};

const fmtBytes = (n: number): string => {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1024 ** 3) return `${sign}${(abs / 1024 ** 3).toFixed(2)} GB`;
  if (abs >= 1024 ** 2) return `${sign}${(abs / 1024 ** 2).toFixed(2)} MB`;
  if (abs >= 1024) return `${sign}${(abs / 1024).toFixed(2)} KB`;
  return `${sign}${abs} B`;
};

const fmtMs = (n: number): string => `${n.toFixed(2)} ms`;

const memDelta = (
  a: NodeJS.MemoryUsage,
  b: NodeJS.MemoryUsage,
): Record<string, string> => ({
  rss: fmtBytes(b.rss - a.rss),
  heapUsed: fmtBytes(b.heapUsed - a.heapUsed),
  heapTotal: fmtBytes(b.heapTotal - a.heapTotal),
  external: fmtBytes(b.external - a.external),
});

const cpuDeltaMs = (
  a: NodeJS.CpuUsage,
  b: NodeJS.CpuUsage,
): { userMs: number; systemMs: number } => ({
  userMs: (b.user - a.user) / 1000,
  systemMs: (b.system - a.system) / 1000,
});

const runtimeLabel = (): string => {
  // @ts-expect-error - bun is set only on Bun
  if (typeof process.versions.bun === 'string') {
    // @ts-expect-error
    return `Bun ${process.versions.bun}`;
  }
  return `Node ${process.version}`;
};

export function run(inputPath: string): void {
  console.log(`Runtime: ${runtimeLabel()}`);
  console.log(`Input:   ${inputPath}`);
  console.log('');

  const t0 = performance.now();
  const cpu0 = process.cpuUsage();
  const mem0 = process.memoryUsage();

  // Load phase
  const raw = readFileSync(inputPath, 'utf8');
  const rows = JSON.parse(raw) as Row[];

  const t1 = performance.now();
  const cpu1 = process.cpuUsage();
  const mem1 = process.memoryUsage();

  // Group phase: Map<site_id, Map<type, Row[]>>
  const grouped = new Map<string, Map<string, Row[]>>();
  let typeGroupCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let bySite = grouped.get(row.site_id);
    if (bySite === undefined) {
      bySite = new Map<string, Row[]>();
      grouped.set(row.site_id, bySite);
    }
    let bucket = bySite.get(row.type);
    if (bucket === undefined) {
      bucket = [];
      bySite.set(row.type, bucket);
      typeGroupCount++;
    }
    bucket.push(row);
  }

  const t2 = performance.now();
  const cpu2 = process.cpuUsage();
  const mem2 = process.memoryUsage();

  const siteCount = grouped.size;

  console.log(
    `Processed ${rows.length.toLocaleString()} rows across ${siteCount} sites and ${typeGroupCount} type-groups`,
  );
  console.log('');

  console.log('--- Load phase (readFileSync + JSON.parse) ---');
  console.log(`  time:        ${fmtMs(t1 - t0)}`);
  console.log(`  cpu user:    ${fmtMs(cpuDeltaMs(cpu0, cpu1).userMs)}`);
  console.log(`  cpu system:  ${fmtMs(cpuDeltaMs(cpu0, cpu1).systemMs)}`);
  const dLoad = memDelta(mem0, mem1);
  console.log(
    `  mem delta:   rss=${dLoad.rss}, heapUsed=${dLoad.heapUsed}, heapTotal=${dLoad.heapTotal}, external=${dLoad.external}`,
  );
  console.log('');

  console.log('--- Group phase (site -> type -> rows) ---');
  console.log(`  time:        ${fmtMs(t2 - t1)}`);
  console.log(`  cpu user:    ${fmtMs(cpuDeltaMs(cpu1, cpu2).userMs)}`);
  console.log(`  cpu system:  ${fmtMs(cpuDeltaMs(cpu1, cpu2).systemMs)}`);
  const dGroup = memDelta(mem1, mem2);
  console.log(
    `  mem delta:   rss=${dGroup.rss}, heapUsed=${dGroup.heapUsed}, heapTotal=${dGroup.heapTotal}, external=${dGroup.external}`,
  );
  console.log('');

  console.log('--- Totals ---');
  console.log(`  time:        ${fmtMs(t2 - t0)}`);
  console.log(`  cpu user:    ${fmtMs(cpuDeltaMs(cpu0, cpu2).userMs)}`);
  console.log(`  cpu system:  ${fmtMs(cpuDeltaMs(cpu0, cpu2).systemMs)}`);
  const dTotal = memDelta(mem0, mem2);
  console.log(
    `  mem delta:   rss=${dTotal.rss}, heapUsed=${dTotal.heapUsed}, heapTotal=${dTotal.heapTotal}, external=${dTotal.external}`,
  );
  console.log(
    `  final RSS:   ${fmtBytes(mem2.rss)} (peak in-process snapshot)`,
  );
}
