/* Module worker for the project's local Cubiomes/Emscripten bridge.
 * No undocumented Generator struct allocation or internal function exports are used.
 */
let modulePromise = null;
let activeSeed = null;
let queue = Promise.resolve();
async function getModule() {
  if (!modulePromise) {
    modulePromise = (async function () {
      const imported = await import('../../engine/cubiomes.js');
      const factory = imported.default || imported.createCubiomesModule;
      if (typeof factory !== 'function') throw new Error('engine/cubiomes.js no exporta la fábrica Emscripten.');
      return await factory({ locateFile: function (path) { return new URL('../../engine/' + path, self.location.href).href; } });
    })();
  }
  return modulePromise;
}
async function handleMap(message) {
  const width = Number(message.width), height = Number(message.height);
  const step = Number(message.step), x = Number(message.x), z = Number(message.z);
  const y = Number(message.y == null ? 80 : message.y);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 512 || height > 512)
    throw new Error('Dimensiones inválidas para el mapa de biomas.');
  if (!Number.isInteger(step) || step < 1 || ![x, z, y].every(Number.isFinite))
    throw new Error('Coordenadas o escala inválidas.');
  const mod = await getModule();
  const seed = BigInt.asUintN(64, BigInt(message.seed));
  if (activeSeed !== seed) {
    mod.ccall('worldgen_init', null, ['bigint'], [seed]);
    activeSeed = seed;
  }
  const rc = mod.ccall('worldgen_generate_map', 'number',
    ['number', 'number', 'number', 'number', 'number', 'number'],
    [x, z, width, height, step, y]);
  if (rc !== 0) throw new Error('Cubiomes devolvió el código ' + rc + '.');
  const ptr = mod.ccall('worldgen_map_ptr', 'number', [], []);
  const count = width * height;
  const view = new Int32Array(mod.HEAP32.buffer, ptr, count);
  const ids = new Int32Array(count);
  ids.set(view);
  self.postMessage({ id: message.id, ids: ids }, [ids.buffer]);
}
async function handle(message) {
  try {
    if (message.type === 'map') await handleMap(message);
  } catch (error) {
    self.postMessage({ id: message.id, error: String(error && error.message || error) });
  }
}
self.onmessage = function (event) {
  const message = event.data || {};
  queue = queue.then(function () { return handle(message); }, function () { return handle(message); });
};
