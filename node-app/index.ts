import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../benchmark.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
run(resolve(__dirname, '..', 'input.json'));
