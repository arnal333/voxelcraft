#!/usr/bin/env node
'use strict';

/*
 * Real WASM smoke test for the specific seed whose Cherry Grove was not loading.
 * The reported coordinates identify a sampled Cherry Grove biome, not vanilla's
 * spawn point. The browser chooses this location only as a biome inspection start.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const seed = 5890866665536842607n;
const start = -2048;
const step = 16;
const size = 257;
const y = 80;
const modulePath = resolve('engine/cubiomes.js');
const wasmPath = resolve('engine/cubiomes.wasm');
const imported = await import(pathToFileURL(modulePath).href);
const factory = imported.default || imported.createCubiomesModule;
assert.equal(typeof factory, 'function', 'Emscripten factory export not found');

const wasmBinary = new Uint8Array(await readFile(wasmPath));
const mod = await factory({ wasmBinary });
assert.equal(typeof mod.ccall, 'function', 'Emscripten ccall export not found');

mod.ccall('worldgen_init', null, ['bigint'], [BigInt.asUintN(64, seed)]);
const result = mod.ccall(
  'worldgen_generate_map',
  'number',
  ['number', 'number', 'number', 'number', 'number', 'number'],
  [start, start, size, size, step, y]
);
assert.equal(result, 0, 'Cubiomes worldgen_generate_map did not succeed');

const pointer = mod.ccall('worldgen_map_ptr', 'number', [], []);
assert.ok(pointer > 0, 'Cubiomes returned an invalid map pointer');
assert.ok(pointer + size * size * 4 <= mod.HEAP32.buffer.byteLength, 'Biome map falls outside WASM memory');
const ids = new Int32Array(mod.HEAP32.buffer, pointer, size * size).slice();

let best = null;
let validIds = 0;
for (let row = 0; row < size; row++) {
  for (let col = 0; col < size; col++) {
    const id = ids[row * size + col];
    if (id >= 0) validIds++;
    if (id !== 185) continue; // Cubiomes enum: cherry_grove.
    const x = start + col * step;
    const z = start + row * step;
    const distanceSquared = x * x + z * z;
    if (!best || distanceSquared < best.distanceSquared) {
      best = { x, z, distanceSquared, biomeId: id };
    }
  }
}
assert.ok(validIds > 0, 'Cubiomes returned no valid biome IDs');
assert.ok(best, 'No Cherry Grove (biome ID 185) was found in the +/-2048 block search area.');

console.log(
  'PASS  Cubiomes WASM found Cherry Grove for seed ' + seed.toString() +
  ' at sampled coordinates X=' + best.x + ', Z=' + best.z +
  ' (biome ID ' + best.biomeId + '). This is an inspection start, not vanilla spawn.'
);
