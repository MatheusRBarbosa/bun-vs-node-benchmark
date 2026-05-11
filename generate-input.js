const { createWriteStream, statSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');

const countArg = process.argv.find((a) => a.startsWith('--count='));
const TOTAL = countArg ? Number(countArg.split('=')[1]) : 1_000_000;

const SITE_POOL_SIZE = 10;
const ASSET_POOL_SIZE = 5;

const OUT_PATH = resolve(__dirname, 'input.json');

const SITES = Array.from({ length: SITE_POOL_SIZE }, () => randomUUID());
const ASSETS = Array.from({ length: ASSET_POOL_SIZE }, () => randomUUID());

const TYPES = ['generation', 'consumption', 'export', 'import'];
const SOURCE_CATEGORIES = ['automated', 'manual'];
const SOURCES = ['measured', 'estimated'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const START_MS = Date.UTC(2025, 7, 6, 0, 0, 0); // 2025-08-06T00:00:00Z
const STEP_MS = 30 * 60 * 1000; // 30 minutes

async function main() {
  const out = createWriteStream(OUT_PATH, { encoding: 'utf8' });
  const writeChunk = (s) =>
    new Promise((res) => {
      if (out.write(s)) res();
      else out.once('drain', () => res());
    });

  const startedAt = Date.now();
  console.log(`Generating ${TOTAL.toLocaleString()} records -> ${OUT_PATH}`);

  await writeChunk('[\n');

  const BATCH = 5_000;
  let buf = '';

  for (let i = 0; i < TOTAL; i++) {
    const ts = new Date(START_MS + i * STEP_MS).toISOString();
    const record = {
      site_id: SITES[i % SITES.length],
      connected_asset_reading_id: randomUUID(),
      connected_asset_id: pick(ASSETS),
      type: TYPES[i % TYPES.length],
      source_category: pick(SOURCE_CATEGORIES),
      source: pick(SOURCES),
      interval_date: ts,
      time: ts,
      cumulative_value_wh: 7_000_000 + Math.floor(Math.random() * 1_000_000),
      delta_value_wh: Math.floor(Math.random() * 5000),
    };

    buf += '  ' + JSON.stringify(record) + (i === TOTAL - 1 ? '\n' : ',\n');

    if ((i + 1) % BATCH === 0) {
      await writeChunk(buf);
      buf = '';
    }

    if ((i + 1) % 100_000 === 0) {
      console.log(`  ${((i + 1) / 1000).toFixed(0)}k records...`);
    }
  }

  if (buf.length) await writeChunk(buf);
  await writeChunk(']\n');

  await new Promise((res, rej) => {
    out.end((err) => (err ? rej(err) : res()));
  });

  const size = statSync(OUT_PATH).size;
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log(
    `Done. ${TOTAL.toLocaleString()} records, ${(size / 1024 / 1024).toFixed(2)} MB, ${elapsed}s`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
