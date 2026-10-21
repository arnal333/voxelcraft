/* Worker: converts already-sampled preview columns into compact grouped voxel positions.
 * This is deliberately a rendering-plan stage, not a claim of vanilla 1.21.1 worldgen.
 */
'use strict';
function materialKey(hex, transparent, opacity) {
  return String((hex >>> 0)) + '_' + (transparent ? 'true' : '0') + '_' + String(opacity || 1);
}
function buildSurfacePlan(columns, seaLevel, stoneDepth) {
  const groups = new Map();
  function add(hex, x, y, z, transparent, opacity) {
    const key = materialKey(hex, !!transparent, opacity || 1);
    let positions = groups.get(key);
    if (!positions) { positions = []; groups.set(key, positions); }
    positions.push(x + 0.5, y + 0.5, z + 0.5);
  }
  const WATER = { hex: 0x2e86c1, transparent: true, opacity: 0.75 };
  const ICE = { hex: 0xb3d9f0, transparent: true, opacity: 0.85 };
  const SAND = 0xf5e6a3;
  const SNOW = 0xeef5ff;
  const BEDROCK = 0x333333;
  for (const c of columns) {
    add(BEDROCK, c.x, 0, c.z, false, 1);
    const stone = c.stone || 0x888888;
    const stoneTop = c.h - 3;
    const stoneBottom = Math.max(1, stoneTop - stoneDepth);
    for (let y = stoneBottom; y <= stoneTop; y++) add(stone, c.x, y, c.z, false, 1);
    if (c.water) {
      const oceanDirt = 0x1a5276;
      for (let y = c.h - 2; y <= c.h; y++) add(oceanDirt, c.x, y, c.z, false, 1);
      for (let y = c.h + 1; y <= seaLevel; y++) {
        if (c.biomeKey === 'FROZEN_OCEAN' && y === seaLevel) add(ICE.hex, c.x, y, c.z, ICE.transparent, ICE.opacity);
        else add(WATER.hex, c.x, y, c.z, WATER.transparent, WATER.opacity);
      }
    } else {
      const dirt = c.dirt || 0x8B6343;
      for (let y = c.h - 2; y < c.h; y++) add(dirt, c.x, y, c.z, false, 1);
      if (c.desert || c.beach) {
        add(SAND, c.x, c.h - 1, c.z, false, 1);
        add(SAND, c.x, c.h, c.z, false, 1);
      } else if (c.snow) {
        add(c.grass || 0x7dbb6b, c.x, c.h, c.z, false, 1);
        add(SNOW, c.x, c.h + 1, c.z, false, 1);
      } else {
        add(c.grass || 0x7dbb6b, c.x, c.h, c.z, false, 1);
      }
    }
  }
  const result = [];
  const transfer = [];
  for (const entry of groups.entries()) {
    const positions = new Float32Array(entry[1]);
    result.push({ key: entry[0], positions: positions });
    transfer.push(positions.buffer);
  }
  return { groups: result, transfer: transfer };
}
self.onmessage = function (event) {
  const message = event.data || {};
  if (message.type !== 'build-surface-plan') return;
  try {
    const result = buildSurfacePlan(message.columns || [], message.seaLevel || 63, message.stoneDepth || 6);
    self.postMessage({ id: message.id, groups: result.groups }, result.transfer);
  } catch (error) {
    self.postMessage({ id: message.id, error: String(error && error.message || error) });
  }
};
