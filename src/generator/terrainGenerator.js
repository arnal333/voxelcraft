/* Main-thread client for chunk terrain planning. Falls back to the legacy builder if Worker fails. */
(function (root) {
  'use strict';
  let worker = null;
  let nextId = 1;
  const pending = new Map();
  function rejectPending(error) {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  }
  function ensureWorker() {
    if (worker) return worker;
    if (typeof Worker !== 'function') throw new Error('Este navegador no admite Web Workers.');
    worker = new Worker('./src/generator/terrainWorker.js');
    worker.onmessage = function (event) {
      const msg = event.data || {};
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(msg.error));
      else entry.resolve({ groups: msg.groups || [] });
    };
    worker.onerror = function (event) {
      const err = new Error(event.message || 'Falló el worker de terreno.');
      try { worker.terminate(); } catch (_) {}
      worker = null;
      rejectPending(err);
    };
    return worker;
  }
  function buildSurfacePlan(columns, options) {
    const w = ensureWorker();
    const id = nextId++;
    return new Promise(function (resolve, reject) {
      pending.set(id, { resolve: resolve, reject: reject });
      try {
        w.postMessage({
          type: 'build-surface-plan',
          id: id,
          columns: columns,
          seaLevel: options && options.seaLevel || 63,
          stoneDepth: options && options.stoneDepth || 6
        });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }
  root.VoxelCraftTerrainGenerator = Object.freeze({ buildSurfacePlan: buildSurfacePlan });
})(window);
