#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/engine/vendor/cubiomes"
mkdir -p "$ROOT/engine/vendor"

if ! command -v emcc >/dev/null 2>&1; then
  echo "ERROR: emcc no está instalado. Activa Emscripten SDK y vuelve a ejecutar este script." >&2
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git es necesario para descargar Cubiomes upstream." >&2
  exit 1
fi
# Pin the upstream source snapshot so biome/version enum behavior does not drift.
CUBIOMES_COMMIT="e61f90580cbdd883214a8054670dacae655e59c0"
if [ ! -d "$VENDOR/.git" ]; then
  if [ -e "$VENDOR" ]; then
    echo "ERROR: $VENDOR existe pero no es un repositorio Git. Muévelo o elimínalo y vuelve a ejecutar." >&2
    exit 1
  fi
  mkdir -p "$VENDOR"
  git -C "$VENDOR" init
  git -C "$VENDOR" remote add origin https://github.com/Cubitect/cubiomes.git
else
  git -C "$VENDOR" remote set-url origin https://github.com/Cubitect/cubiomes.git
fi
git -C "$VENDOR" fetch --depth 1 origin "$CUBIOMES_COMMIT"
git -C "$VENDOR" checkout --force --detach FETCH_HEAD

cd "$VENDOR"
DEBUG_FLAGS=()
if [[ "${DEBUG:-0}" == "1" ]]; then
  DEBUG_FLAGS=(-g4)
fi

# A single, explicit bridge API is exported. JavaScript never allocates an
# undocumented Generator struct or calls Cubiomes private symbols directly.
emcc -O3 -fwrapv -I. \
  "$ROOT/engine/cubiomes-bridge.c" \
  finders.c generator.c layers.c biomenoise.c biomes.c noise.c util.c quadbase.c \
  -o "$ROOT/engine/cubiomes.js" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createCubiomesModule \
  -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 -sWASM_BIGINT=1 \
  -sMALLOC=emmalloc \
  -sEXPORTED_FUNCTIONS='["_worldgen_init","_worldgen_biome_at","_worldgen_generate_map","_worldgen_map_ptr"]' \
  -sEXPORTED_RUNTIME_METHODS='["ccall"]' --no-entry "${DEBUG_FLAGS[@]}"

printf '\nBuild OK:\n  %s\n  %s\n' "$ROOT/engine/cubiomes.js" "$ROOT/engine/cubiomes.wasm"
cp "$VENDOR/LICENSE" "$ROOT/engine/CUBIOMES-LICENSE.txt"
echo "El worker carga engine/cubiomes.js como ES module. Sirve la carpeta por HTTP; no abras index.html con file://."
echo "Para depuración con source maps: DEBUG=1 bash scripts/build-cubiomes-wasm.sh"
