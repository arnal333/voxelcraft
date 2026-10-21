/* Coordinates biome sampling and terrain planning without coupling either stage to Three.js. */
(function (root) {
  'use strict';

  async function generateBiomeMap(options) {
    if (!root.VoxelCraftBiomeGenerator ||
        typeof root.VoxelCraftBiomeGenerator.generateMap !== 'function') {
      throw new Error('El módulo de biomas no está inicializado.');
    }
    return root.VoxelCraftBiomeGenerator.generateMap(options);
  }

  async function buildSurfacePlan(columns, options) {
    if (!root.VoxelCraftTerrainGenerator ||
        typeof root.VoxelCraftTerrainGenerator.buildSurfacePlan !== 'function') {
      throw new Error('El módulo de terreno no está inicializado.');
    }
    return root.VoxelCraftTerrainGenerator.buildSurfacePlan(columns, options);
  }

  root.VoxelCraftWorldGenerator = Object.freeze({
    target: root.VoxelCraftCore ? root.VoxelCraftCore.target : { edition: 'Java', version: '1.21.1' },
    status: root.VoxelCraftCore ? root.VoxelCraftCore.status : { exact: false, stage: 'uninitialized' },
    generateBiomeMap: generateBiomeMap,
    buildSurfacePlan: buildSurfacePlan
  });
})(window);
