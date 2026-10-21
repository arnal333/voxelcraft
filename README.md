# VoxelCraft / Minecraft 3D Walk — pipeline modular de generación

Este repositorio conserva el prototipo jugable Three.js e incorpora la arquitectura descrita en el informe **“De Cubiomes a Bit-A-Bit”**. El objetivo de compatibilidad es **Minecraft Java 1.21.1**. El estado actual es un prototipo híbrido y **no** un generador vanilla bit-a-bit.

## Arquitectura incorporada

- `index.html`: entrada del juego, escena Three.js, HUD, chunks, consola `/tp` y controles de vuelo.
- `src/core/gameState.js`: contrato de versión y estado de compatibilidad explícito.
- `src/renderer/voxelMaterials.js`: texturas pixel-art deterministas compartidas.
- `src/world/chunkScheduler.js`: cola de chunks con deduplicación y descarte de trabajo que quedó fuera del radio.
- `src/generator/biomeGenerator.js`: API de alto nivel para calcular biomas, priorizando un Web Worker.
- `src/generator/biomeWorker.js`: inicializa el puente WASM local dentro de un worker y copia los IDs a un `Int32Array` transferible.
- `src/generator/terrainGenerator.js`: cliente de worker para construir planes de bloques por chunk.
- `src/generator/worldGenerator.js`: coordinador de las dos etapas, biomas y preparación de terreno.
- `src/generator/terrainWorker.js`: calcula arrays de posiciones agrupadas por material fuera del hilo de renderizado.
- `src/controls/flyControls.js`: estado de vuelo; `F` alterna el vuelo, espacio sube, `Ctrl`/`C` baja y `Shift` acelera.
- `js/cubiomes-adapter.js`: adaptador de compatibilidad con inicialización asíncrona y errores visibles.
- `engine/cubiomes-bridge.c`: superficie C estable que expone inicialización por semilla y cálculo de biomas/mapas.
- `scripts/build-cubiomes-wasm.sh`: compilación modular ES de Cubiomes con Emscripten.
- `docs/WORLDGEN_ARCHITECTURE.md`: qué ya está conectado y qué falta para la fidelidad exacta.

## Construir el WASM local

Se necesitan Git y Emscripten SDK con `emcc` activado. En una terminal que tenga activado Emscripten:

```bash
bash scripts/build-cubiomes-wasm.sh
python -m http.server 8000
```

Abre `http://localhost:8000` en el navegador. **No** abras el HTML mediante `file://`: los módulos ES y Workers necesitan un servidor HTTP. El script descarga Cubiomes desde su repositorio upstream si aún no existe bajo `engine/vendor/cubiomes`.

También hay un entorno reproducible con Docker (usa la etiqueta de Emscripten fijada en `Dockerfile.emscripten`):

```bash
docker build -f Dockerfile.emscripten -t voxelcraft-emsdk .
docker run --rm -v "${PWD}:/workspace" -w /workspace voxelcraft-emsdk
```

En Windows PowerShell, sustituye `"${PWD}:/workspace"` por `"${PWD}:/workspace"` si Docker resuelve correctamente la ruta actual; si no, usa una ruta absoluta como `"C:/ruta/a/voxelcraft:/workspace"`.

Para generar información de depuración de Emscripten/source maps:

```bash
DEBUG=1 bash scripts/build-cubiomes-wasm.sh
```

## Pruebas de humo

Desde la raíz del repositorio, con Node.js:

```bash
node scripts/test-worldgen.js
```

Estas pruebas comprueban sintaxis, cola de chunks, arrays transferibles del worker, controles de vuelo, mapeo de IDs y símbolos del puente. Después de compilar el WASM, ejecuta también `node scripts/test-cubiomes-wasm.mjs`: valida la API WASM real y busca Cherry Grove para la semilla indicada. La suite no sustituye una prueba visual en navegador ni la comparación bloque por bloque del terreno con Java 1.21.1.

El archivo compilado `engine/cubiomes.js` y el correspondiente `engine/cubiomes.wasm` se generan localmente; no se suben en este cambio. Si no están construidos, el juego puede entrar en modo aproximado y avisar de ello.

## Controles

WASD para moverse, mouse para mirar, espacio para saltar (o subir en vuelo), `F` para activar/desactivar vuelo, `Ctrl`/`C` para bajar durante el vuelo, `Shift` para el comportamiento de velocidad, `T` o `/` para abrir comandos, y `Esc` para liberar el mouse. `/tp x y z` y `/teleport x y z` siguen disponibles.

## Preparar los JSON vanilla para desarrollar el generador exacto

El informe propone usar configuraciones versionadas del juego para ruido y reglas de superficie. Como el directorio `data/pc/1.21.1` de `minecraft-data` no contiene por sí solo el paquete de datos completo de worldgen del servidor, el repositorio incluye un extractor que trabaja con un JAR local de Minecraft Java 1.21.1:

```bash
python scripts/extract-worldgen-data.py "/ruta/al/server.jar"
```

El script busca los archivos en el JAR y en JAR anidados, copia solo los JSON de `data/minecraft/worldgen/` y `data/minecraft/tags/worldgen/`, valida que sean JSON y crea un manifiesto SHA-256. Los archivos extraídos se guardan en `data/vanilla-1.21.1/`, que está excluido de Git para no incluir activos del juego en el repositorio.

**Importante:** esta extracción prepara una fuente de referencia local; el código actual todavía no interpreta el grafo completo de densidad, las reglas de superficie ni las configuraciones de minerales. No significa que el terreno ya sea vanilla exacto.

## Estado de fidelidad (importante)

La arquitectura es ahora modular y las tareas de biomas/plan de bloques se pueden ejecutar en Workers. Sin embargo:

1. **Biomas:** requieren que el bridge de Cubiomes WASM 1.21.1 se compile y cargue para considerarse calculados por Cubiomes. Los IDs no reconocidos no se disfrazan como llanuras.
2. **Altura y forma del terreno:** todavía utilizan el generador simplificado heredado; el worker de terreno solo traslada esas columnas a una estructura eficiente. No calcula aún la densidad vanilla `final_density`.
3. **Reglas de superficie, subsuelo y minerales:** las reglas completas de Minecraft 1.21.1 no están implementadas.
4. **Paridad bit-a-bit:** no está validada. Se necesitan datos correctos de la versión y pruebas comparativas contra el mundo Java real en coordenadas conocidas.
5. **Semilla `5890866665536842607`:** la CI compiló el WASM real de Cubiomes y confirmó el ID `185` (Cherry Grove) en la muestra `X=-32, Z=96` usando la misma cuadrícula de búsqueda del juego (`X/Z ±2048`, paso de 16). El juego vuelve a buscar al iniciar y usa esa zona como punto de inspección; no es el spawn vanilla oficial. Si el WASM local no está compilado/disponible, se indica que no se pudo confirmar y se usa el inicio de vista previa `X=8, Z=8`.

Se conservó el juego funcional en lugar de reemplazarlo por una demo nueva. Las comprobaciones hechas a los archivos fuente son análisis sintácticos; no equivalen a una prueba visual de ejecución en navegador.
