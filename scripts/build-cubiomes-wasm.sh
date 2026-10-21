#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/engine/vendor/cubiomes"
mkdir -p "$ROOT/engine/vendor"
if ! command -v emcc >/dev/null 2>&1; then
  echo "ERROR: emcc no está instalado. Instala/activa Emscripten SDK y vuelve a ejecutar este script." >&2
  exit 1
fi
if [ ! -f "$VENDOR/generator.c" ]; then
  git clone --depth 1 https://github.com/Cubitect/cubiomes.git "$VENDOR"
fi
cd "$VENDOR"
emcc -O3 -fwrapv -I. \
  "$ROOT/engine/cubiomes-bridge.c" \
  finders.c generator.c layers.c biomenoise.c biomes.c noise.c util.c quadbase.c \
  -o "$ROOT/engine/cubiomes.js" \
  -sMODULARIZE=1 -sEXPORT_NAME=createCubiomesModule \
  -sENVIRONMENT=web -sALLOW_MEMORY_GROWTH=1 -sWASM_BIGINT=1 \
  -sEXPORTED_FUNCTIONS='["_worldgen_init","_worldgen_biome_at","_worldgen_generate_map","_worldgen_map_ptr"]' \
  -sEXPORTED_RUNTIME_METHODS='["ccall"]' --no-entry
printf '\nBuild OK: %s\n' "$ROOT/engine/cubiomes.js"
echo "Sirve el proyecto mediante un servidor HTTP local; no lo abras con file://."
