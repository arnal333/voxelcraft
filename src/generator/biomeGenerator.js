/* Biome generator orchestration: worker first; compatibility adapter is explicit fallback. */
(function (root) {
  'use strict';
  let worker = null;
  let nextId = 1;
  let workerFailed = false;
  let lastMode = 'not-initialized';
  const pending = new Map();
  function stopWorker(error) {
    if (worker) {
      try { worker.terminate(); } catch (_) {}
      worker = null;
    }
    workerFailed = true;
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  }
  function ensureWorker() {
    if (workerFailed) throw new Error('Worker local de Cubiomes no disponible.');
    if (worker) return worker;
    if (typeof Worker !== 'function') throw new Error('Este navegador no admite Web Workers.');
    worker = new Worker('./src/generator/biomeWorker.js', { type: 'module' });
    worker.onmessage = function (event) {
      const msg = event.data || {};
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(msg.error));
      else entry.resolve(msg.ids);
    };
    worker.onerror = function (event) {
      stopWorker(new Error(event.message || 'Falló el worker local de Cubiomes.'));
    };
    return worker;
  }
  async function generateMap(options) {
    try {
      const w = ensureWorker();
      const id = nextId++;
      const ids = await new Promise(function (resolve, reject) {
        pending.set(id, { resolve: resolve, reject: reject });
        try {
          w.postMessage({
            type: 'map',
            id: id,
            x: options.x,
            z: options.z,
            width: options.width,
            height: options.height,
            step: options.step,
            y: options.y == null ? 80 : options.y,
            seed: String(options.seed)
          });
        } catch (error) {
          pending.delete(id);
          reject(error);
        }
      });
      lastMode = 'local-cubiomes-worker';
      return ids;
    } catch (workerError) {
      if (worker && !workerFailed) stopWorker(workerError);
      if (root.CubiomesAdapter) {
        lastMode = 'main-thread-adapter-fallback';
        return await root.CubiomesAdapter.generateMap(options);
      }
      lastMode = 'preview-only';
      throw workerError;
    }
  }
  root.VoxelCraftBiomeGenerator = Object.freeze({
    generateMap: generateMap,
    get mode() { return lastMode; }
  });
})(window);
