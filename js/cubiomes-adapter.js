/* Safe adapter around the project's own Cubiomes C bridge.
 * Does not allocate undocumented Generator structs or call unstable upstream symbols.
 * Requires engine/cubiomes.js + engine/cubiomes.wasm built with scripts/build-cubiomes-wasm.sh.
 */
(function () {
  'use strict';

  let modulePromise = null;
  let moduleInstance = null;
  let activeSeed = null;
  let mode = null;

  const API = {
    available: false,
    version: 'Minecraft Java 1.21.1 / Cubiomes bridge',
    async load() {
      if (moduleInstance) return moduleInstance;
      if (!modulePromise) {
        modulePromise = (async function () {
          let imported;
          try {
            imported = await import('../engine/cubiomes.js');
          } catch (error) {
            throw new Error(
              'No se encontró el WASM local de Cubiomes. Ejecuta scripts/build-cubiomes-wasm.sh. ' +
              String(error && error.message || error)
            );
          }
          const factory = imported.default || imported.createCubiomesModule;
          if (typeof factory !== 'function') {
            throw new Error('El módulo Emscripten no exporta createCubiomesModule.');
          }
          const mod = await factory({
            locateFile: function (path) { return new URL('./engine/' + path, document.baseURI).href; }
          });
          if (!mod || typeof mod.ccall !== 'function' || !mod.HEAP32) {
            throw new Error('Cubiomes WASM se cargó sin la API puente esperada.');
          }
          moduleInstance = mod;
          mode = 'local-bridge';
          API.available = true;
          return mod;
        })();
      }
      try {
        return await modulePromise;
      } catch (error) {
        modulePromise = null;
        moduleInstance = null;
        mode = null;
        API.available = false;
        throw error;
      }
    },
    async setSeed(seed) {
      const mod = await API.load();
      const normalized = BigInt.asUintN(64, BigInt(seed));
      if (activeSeed === normalized) return true;
      mod.ccall('worldgen_init', null, ['bigint'], [normalized]);
      activeSeed = normalized;
      return true;
    },
    async biomeAt(x, y, z, seed) {
      const mod = await API.load();
      await API.setSeed(seed);
      return mod.ccall('worldgen_biome_at', 'number',
        ['number', 'number', 'number'], [Math.trunc(x), Math.trunc(y), Math.trunc(z)]);
    },
    async generateMap(options) {
      const mod = await API.load();
      const width = Number(options && options.width);
      const height = Number(options && options.height);
      const x = Number(options && options.x);
      const z = Number(options && options.z);
      const step = Number(options && options.step);
      const y = Number(options && options.y == null ? 80 : options.y);
      if (!Number.isInteger(width) || !Number.isInteger(height) ||
          width < 1 || height < 1 || width > 1024 || height > 1024 ||
          !Number.isInteger(step) || step < 1 ||
          ![x, z, y].every(Number.isFinite)) {
        throw new Error('Parámetros inválidos para generar el mapa de biomas.');
      }
      await API.setSeed(options.seed);
      const rc = mod.ccall('worldgen_generate_map', 'number',
        ['number', 'number', 'number', 'number', 'number', 'number'],
        [Math.trunc(x), Math.trunc(z), width, height, step, Math.trunc(y)]);
      if (rc !== 0) throw new Error('Cubiomes devolvió código ' + rc + ' al generar el mapa.');
      const ptr = mod.ccall('worldgen_map_ptr', 'number', [], []);
      const count = width * height;
      if (!ptr || ptr < 0 || (ptr + count * 4) > mod.HEAP32.buffer.byteLength) {
        throw new Error('Cubiomes devolvió un puntero de mapa fuera de la memoria WASM.');
      }
      // Copy the WASM view: the bridge may reuse/reallocate its map on the next call.
      return new Int32Array(mod.HEAP32.buffer, ptr, count).slice();
    },
    get mode() { return mode; }
  };

  window.CubiomesAdapter = API;
})();
