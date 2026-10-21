# Estado real de compatibilidad — VoxelCraft

Objetivo declarado: Minecraft Java 1.21.1. Este archivo distingue funciones conectadas de las partes aún pendientes; no declara paridad vanilla sin una prueba con el generador real.

## Ya conectado en el repositorio

- Contrato de versión/estado en `src/core/gameState.js`; la interfaz mantiene el estado PREVIEW en lugar de prometer fidelidad que no se verificó.
- Adaptador de Cubiomes y puente C (`js/cubiomes-adapter.js`, `engine/cubiomes-bridge.c`).
- Cliente de biomas con Worker (`src/generator/biomeGenerator.js`, `src/generator/biomeWorker.js`); la API del worker utiliza las funciones puente documentadas, no reserva directamente una estructura interna `Generator`.
- Constructor de plan de superficie en Worker con arrays tipados transferibles (`src/generator/terrainWorker.js`) y cliente (`src/generator/terrainGenerator.js`).
- Cola de chunks deduplicada y que descarta solicitudes lejanas (`src/world/chunkScheduler.js`).
- Materiales pixel-art compartidos (`src/renderer/voxelMaterials.js`) y controles de vuelo (`src/controls/flyControls.js`).
- Tabla de IDs de biomas ajustada para los IDs modernos de Cubiomes, incluido Cherry Grove (185), y desconocidos expresados como desconocidos.
- Script de compilación Emscripten ES-module con `MODULARIZE`, `EXPORT_ES6`, memoria expandible, `emmalloc` y modo de depuración opcional.

## Pendiente / no verificado

- `engine/cubiomes.js` y `engine/cubiomes.wasm` deben generarse en un entorno con Emscripten. No se han compilado dentro de este cambio.
- Sin un WASM que cargue correctamente, los biomas se ven en modo preview y no pueden considerarse válidos para la semilla.
- El relieve 3D continúa apoyándose en `HeightGen` heredado. El worker actual construye arrays de superficie a partir de esas alturas; no replica la densidad `final_density` de Minecraft.
- Aún no están implementados todos los datos de ruido de Overworld, reglas completas de superficie, generación de subsuelo y colocación de minerales de Java 1.21.1.
- La semilla `5890866665536842607` no ha sido confirmada con una ejecución de Cubiomes real; `X=-508, Z=24` solo es una coordenada de inspección heredada.
- No se ejecutó el juego en un navegador real ni se comparó un chunk con una instalación vanilla de Java 1.21.1 en este entorno.

## Memoria y rendimiento

Los Workers devuelven/copian arrays tipados mediante transferibles. Esto evita pasar la generación de mapas y la preparación de bloques al hilo principal, sin exigir `SharedArrayBuffer`. Si se añade memoria realmente compartida, el alojamiento debe activar aislamiento cross-origin (COOP/COEP) y el módulo Wasm debe compilarse explícitamente para esa memoria compartida; no se asume que esas condiciones existan en GitHub Pages u otro hosting.

## Pruebas realizadas

- Parseo sintáctico de los scripts obtenidos del repositorio mediante el parser de JavaScript: correcto en los archivos revisados.
- Comprobaciones estáticas de que el plan de superficie/biomas llama a los nuevos clientes Worker y que no quedan referencias a la cola antigua.
- No es una prueba de ejecución del juego, de compilación de Emscripten, ni de fidelidad vanilla.
