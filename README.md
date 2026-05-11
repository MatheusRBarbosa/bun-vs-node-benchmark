# Bun vs Node.js benchmark

A small experiment comparing **memory and CPU usage** between [Bun](https://bun.sh) and [Node.js](https://nodejs.org) on a realistic workload: load a large JSON array, group records by `site_id`, then by `type`, retaining all rows in the grouped structure.

## What this measures

Both runtimes execute the **same TypeScript source** (`benchmark.ts`) against the **same input file** (`input.json`). The only variable is the runtime.

Per phase, the script captures:

- **Wall-clock time** via `performance.now()`
- **CPU time** via `process.cpuUsage()` (user + system)
- **Memory** via `process.memoryUsage()` (rss / heapUsed / heapTotal / external)

Phases:

1. **Load** — `readFileSync` + `JSON.parse` of the full input.
2. **Group** — single pass building `Map<site_id, Map<type, Row[]>>`.

## Layout

```
bun-vs-node/
├── generate-input.js     # streams N records (default 1,000,000) to input.json
├── benchmark.ts          # shared load + group + metrics logic
├── bun-app/              # Bun entry point
│   ├── index.ts
│   └── package.json      # `bun run index.ts`
├── node-app/             # Node entry point
│   ├── index.ts
│   └── package.json      # `node --experimental-strip-types index.ts`
├── example_input.json    # schema reference only (not read at runtime)
├── input.json            # generated, gitignored (~359 MB at 1M records)
└── .gitignore
```

## Record schema

```ts
type Row = {
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
```

## How to run

Requires **Bun** and **Node.js 22.6+** (for `--experimental-strip-types`).

```sh
# 1. Generate the input file (default 1,000,000 rows; override with --count=N)
node generate-input.js

# 2. Run on Node
cd node-app && npm start

# 3. Run on Bun
cd ../bun-app && bun start
```

Run each app 2–3 times and discard the cold first run (filesystem cache effects).

## Results

**Workload:** 1,000,000 records, ~359 MB JSON. Run on macOS, single iteration per runtime.

| Metric            | Node v22.16.0 | Bun 1.2.15   |
|-------------------|---------------|--------------|
| Load time         | 1313.65 ms    | 326.61 ms    |
| Group time        | 75.18 ms      | 51.20 ms     |
| Total time        | 1388.83 ms    | 377.81 ms    |
| CPU user (total)  | 1428.63 ms    | 333.05 ms    |
| Peak RSS          | 1.67 GB       | 937.92 MB    |

Both runtimes produced identical correctness: `1,000,000 rows across 10 sites and 20 type-groups`.

### Takeaway

On this workload Bun was **~3.7× faster** end-to-end and used **~44% less peak RSS** than Node. The load phase (`JSON.parse` of a large string) dominates total time; the grouping pass is a small slice.

## Caveats

- Single-shot, single-machine, in-process measurements. Absolute numbers will vary across runs and hardware — treat the comparison as illustrative, not authoritative.
- Bun's `process.memoryUsage().heapUsed` is reported differently than V8's and sometimes shows `0`. For cross-runtime comparison, **`rss`** is the most apples-to-apples number.
- `example_input.json` is included only as a schema reference; it is **not valid JSON** (missing the enclosing `[ ]`) and is never read at runtime.
- The grouped structure retains the full rows, so peak memory reflects parsed JSON + grouping overhead. A "counts only" variant would have a very different memory profile.
