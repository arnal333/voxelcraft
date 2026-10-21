/* Shared deterministic pixel textures for the Three.js voxel renderer. */
(function (root) {
  'use strict';
  const textureCache = new Map();
  function makePixelTexture(THREE, hex) {
    const cacheKey = String(hex >>> 0);
    if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d', { alpha: false });
    let seed = (hex >>> 0) ^ 0x6d2b79f5;
    const rand = function () {
      seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
      return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
    };
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        let value = Math.floor(174 + rand() * 82);
        if ((x + y) % 7 === 0) value = Math.max(145, value - 25);
        if (rand() > 0.94) value = 255;
        ctx.fillStyle = 'rgb(' + value + ',' + value + ',' + value + ')';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.generateMipmaps = true;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    textureCache.set(cacheKey, texture);
    return texture;
  }
  root.VoxelCraftVoxelMaterials = Object.freeze({ makePixelTexture: makePixelTexture });
})(window);
