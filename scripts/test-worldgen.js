#!/usr/bin/env node
'use strict';

/*
 * Smoke tests for the modular world-generation infrastructure.
 * Run from the repository root: node scripts/test-worldgen.js
 * These tests do not replace a browser run or a vanilla Java 1.21.1 comparison.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const passed = [];
const failed = [];

function test(name, run) {
  try {
    run();
    passed.push(name);
    console.log('PASS  ' + name);
  } catch (error) {
    failed.push({ name, error: error && error.message ? error.message : String(error) });
    console.error('FAIL  ' + name + ': ' + (error && error.stack ? error.stack : error));
  }
}

// Parse inline JavaScript from the HTML without executing browser APIs.
test('index.html inline JavaScript parses', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((source) => source.trim().length > 0);
  assert.ok(scripts.length > 0, 'No inline script was found.');
  for (const source of scripts) new Function(source); // eslint-disable-line no-new-func
});

test('all modular JavaScript files parse', () => {
  const files = [
    'js/cubiomes-adapter.js',
    'src/core/gameState.js',
    'src/renderer/voxelMaterials.js',
    'src/world/chunkScheduler.js',
    'src/generator/biomeGenerator.js',
    'src/generator/biomeWorker.js',
    'src/generator/terrainGenerator.js',
    'src/generator/terrainWorker.js',
    'src/controls/flyControls.js'
  ];
  for (const file of files) new Function(read(file)); // eslint-disable-line no-new-func
});

test('chunk scheduler deduplicates and drops distant work', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(read('src/world/chunkScheduler.js'), sandbox);
  const scheduler = new sandbox.window.VoxelCraftChunkScheduler();
  assert.equal(scheduler.enqueue({ key: '1|2' }), true);
  assert.equal(scheduler.enqueue({ key: '1|2' }), false);
  assert.equal(scheduler.enqueue({ key: '2|2' }), true);
  scheduler.retain(new Set(['2|2']));
  assert.equal(scheduler.length, 1);
  assert.equal(scheduler.take().key, '2|2');
  assert.equal(scheduler.take(), null);
});

test('terrain worker groups positions into transferable typed arrays', () => {
  const replies = [];
  const sandbox = {
    self: { postMessage: (message, transfer) => replies.push({ message, transfer }) }
  };
  vm.runInNewContext(read('src/generator/terrainWorker.js'), sandbox);
  sandbox.self.onmessage({
    data: {
      type: 'build-surface-plan',
      id: 7,
      seaLevel: 63,
      stoneDepth: 2,
      columns: [
        { x: 0, z: 0, h: 3, biomeKey: 'PLAINS', grass: 0x7dbb6b, dirt: 0x8b6343, stone: 0x888888 },
        { x: 1, z: 0, h: 60, biomeKey: 'OCEAN', grass: 0x3d7dbf, dirt: 0x1a5276, stone: 0x2c3e50, water: true }
      ]
    }
  });
  assert.equal(replies.length, 1);
  const reply = replies[0];
  assert.equal(reply.message.id, 7);
  assert.ok(reply.message.groups.length >= 4);
  assert.equal(reply.transfer.length, reply.message.groups.length);
  for (const group of reply.message.groups) {
    assert.ok(group.positions instanceof Float32Array || Object.prototype.toString.call(group.positions) === '[object Float32Array]');
    assert.equal(group.positions.length % 3, 0);
  }
});

test('fly controller toggles and returns the expected vertical input', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(read('src/controls/flyControls.js'), sandbox);
  const flight = sandbox.window.VoxelCraftFlyControls;
  assert.equal(flight.isFlying(), false);
  assert.equal(flight.toggle(), true);
  assert.equal(flight.isFlying(), true);
  assert.equal(flight.verticalAxis({ Space: true }), 1);
  assert.equal(flight.verticalAxis({ ControlLeft: true }), -1);
  assert.equal(flight.verticalAxis({ Space: true, KeyC: true }), 0);
  flight.disable();
  assert.equal(flight.isFlying(), false);
});

test('Cubiomes biome IDs stay explicit and cherry is not fabricated by fallback', () => {
  const html = read('index.html');
  const line = html.split('\n').find((entry) => entry.startsWith('const CUBIOMES_BIOME_KEYS = '));
  assert.ok(line, 'Biome mapping missing.');
  const entries = [...line.matchAll(/(\d+):'([^']+)'/g)];
  const ids = Object.fromEntries(entries.map((match) => [Number(match[1]), match[2]]));
  assert.equal(ids[185], 'CHERRY_GROVE');
  assert.equal(ids[186], 'UNKNOWN_BIOME');
  assert.equal(ids[12], 'SNOWY_PLAINS');
  assert.equal(ids[11], 'FROZEN_RIVER');
  assert.equal(ids[170], undefined, 'Nether biome must not be mislabeled as an Overworld biome.');
  assert.ok(html.includes('searchIds[row * searchSize + col] !== 185'));
  assert.ok(!html.includes("return 'CHERRY_GROVE';"), 'The approximate fallback must not invent Cherry Grove.');
});

test('WASM build pins Cubiomes and exports the stable bridge API', () => {
  const build = read('scripts/build-cubiomes-wasm.sh');
  const bridge = read('engine/cubiomes-bridge.c');
  assert.ok(build.includes('e61f90580cbdd883214a8054670dacae655e59c0'));
  assert.ok(build.includes('-sMODULARIZE=1'));
  assert.ok(build.includes('-sEXPORT_ES6=1'));
  assert.ok(build.includes('-sALLOW_MEMORY_GROWTH=1'));
  assert.ok(build.includes('-sMALLOC=emmalloc'));
  for (const symbol of ['worldgen_init', 'worldgen_biome_at', 'worldgen_generate_map', 'worldgen_map_ptr']) {
    assert.ok(bridge.includes(symbol), 'Missing bridge symbol: ' + symbol);
    assert.ok(build.includes('_' + symbol), 'Missing Emscripten export: ' + symbol);
  }
});

console.log('\n' + passed.length + ' passed, ' + failed.length + ' failed.');
if (failed.length) process.exitCode = 1;
else console.log('NOTE  Browser runtime, WASM build, and vanilla seed parity must still be tested separately.');
