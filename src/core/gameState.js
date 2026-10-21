/* Core runtime contract: keep the requested target explicit and never claim vanilla parity without reference tests. */
(function (root) {
  'use strict';
  const target = Object.freeze({ edition: 'Java', version: '1.21.1' });
  const status = Object.freeze({
    exact: false,
    stage: 'cubiomes-biomes-worker-preview-terrain',
    reason: 'Cubiomes can provide biome IDs; block density, vanilla noise settings, surface rules, and ore placement still require exact implementation and reference validation.'
  });
  root.VoxelCraftCore = Object.freeze({
    target: target,
    status: status,
    crossOriginIsolated: !!root.crossOriginIsolated,
    sharedArrayBufferAvailable: typeof root.SharedArrayBuffer === 'function' && !!root.crossOriginIsolated
  });
})(window);
