/* Cubiomes adapter for Java 1.21.1.
 * Uses a pinned precompiled Cubiomes WASM build when available; if unavailable,
 * it fails explicitly and the app labels its procedural preview as approximate.
 */
(function () {
  const CDN_BASE = 'https://cdn.jsdelivr.net/gh/iamdookie1/seedview@95b35217fb7e806f7973943d211e047349e83d44/public/wasm/';
  let modulePromise = null, moduleInstance = null, mode = null;
  let activeSeed = null, generatorPtr = 0;
  const API = {
    available: false,
    version: 'Minecraft Java 1.21.1 / Cubiomes',
    async load() {
      if (moduleInstance) return moduleInstance;
      if (!modulePromise) modulePromise = (async () => {
        // Prefer a locally built bridge if the user compiled it; otherwise use the pinned WASM build.
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = './engine/cubiomes.js'; s.async = true;
            s.onload = resolve; s.onerror = () => { s.remove(); reject(new Error('No hay motor local compilado')); };
            document.head.appendChild(s);
          });
          if (typeof window.createCubiomesModule === 'function') {
            moduleInstance = await window.createCubiomesModule(); mode = 'local-bridge'; API.available = true; return moduleInstance;
          }
        } catch (_) { /* try pinned remote engine below */ }
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = CDN_BASE + 'cubiomes.js'; s.async = true;
          s.onload = resolve;
          s.onerror = () => reject(new Error('No se pudo cargar el motor Cubiomes remoto. Comprueba tu conexión a Internet.'));
          document.head.appendChild(s);
        });
        if (typeof window.CubiomesModule !== 'function') throw new Error('El WASM remoto no expone CubiomesModule.');
        moduleInstance = await window.CubiomesModule({ locateFile: p => CDN_BASE + p });
        mode = 'upstream-wasm'; API.available = true; return moduleInstance;
      })();
      try { return await modulePromise; } catch (e) { modulePromise = null; API.available = false; throw e; }
    },
    async setSeed(seed) {
      const m = await API.load();
      const normalized = BigInt.asUintN(64, BigInt(seed));
      if (activeSeed === normalized) return true;
      if (mode === 'local-bridge') {
        m.ccall('worldgen_init', null, ['bigint'], [normalized]);
      } else {
        if (generatorPtr) { m._free(generatorPtr); generatorPtr = 0; }
        // sizeof(Generator) is well below this allocation for the supported Cubiomes build.
        generatorPtr = m._malloc(4 * 1024 * 1024);
        if (!generatorPtr) throw new Error('No se pudo reservar memoria para Cubiomes.');
        // Upstream MCVersion enum: MC_1_21_1 == 26. This is NOT the ordinal 21.
        m._setupGenerator(generatorPtr, 26, 0);
        m._applySeed(generatorPtr, 0, normalized);
      }
      activeSeed = normalized;
      return true;
    },
    async biomeAt(x, y, z, seed) {
      const m = await API.load(); await API.setSeed(seed);
      if (mode === 'local-bridge') return m.ccall('worldgen_biome_at', 'number', ['number','number','number'], [x,y,z]);
      return m._getBiomeAt(generatorPtr, 1, x, y, z);
    },
    async generateMap({x, z, width, height, step, y = 80, seed}) {
      const m = await API.load(); await API.setSeed(seed);
      if (mode === 'local-bridge') {
        const rc = m.ccall('worldgen_generate_map', 'number', ['number','number','number','number','number','number'], [x,z,width,height,step,y]);
        if (rc !== 0) throw new Error('Cubiomes local no pudo generar el mapa (código '+rc+').');
        const ptr = m.ccall('worldgen_map_ptr', 'number', [], []);
        return Array.from(new Int32Array(m.HEAP32.buffer, ptr, width * height));
      }
      const ids = new Array(width * height);
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          ids[row * width + col] = m._getBiomeAt(generatorPtr, 1, x + col * step, y, z + row * step);
        }
      }
      return ids;
    },
    get mode() { return mode; }
  };
  window.CubiomesAdapter = API;
})();
