# Arquitectura y plan de fidelidad vanilla — Java 1.21.1

Este documento operacionaliza el informe **“De Cubiomes a Bit-A-Bit”** para el código concreto de VoxelCraft. La regla principal es no mezclar dos objetivos diferentes: generar biomas compatibles con Cubiomes y generar los bloques exactos del mundo Java. La primera parte es abordable con Cubiomes; la segunda requiere reconstruir y validar el pipeline de worldgen de Mojang.

## Flujo del mundo

```text
Semilla Java de 64 bits + versión/dimensión
                  |
                  v
       Cubiomes C -> WebAssembly
                  |
                  v
      biomeGenerator / biomeWorker
                  |
        IDs de bioma por coordenada
                  |
                  v
   terrainGenerator / terrainWorker
                  |
      plan de bloques del chunk
                  |
                  v
      Three.js / InstancedMesh
```

En el estado actual, el flujo está parcialmente conectado: Cubiomes puede dar IDs de bioma si se construye y carga el WASM local; los workers de terreno agrupan en arrays tipados las posiciones de los bloques de la vista previa; Three.js crea las mallas en el hilo principal. Las alturas siguen procediendo del generador heredado, no del ruido vanilla.

## Responsabilidad de los módulos

| Módulo | Responsabilidad |
| --- | --- |
| `src/core/gameState.js` | Versión objetivo, capacidad de memoria compartida y estado honesto de compatibilidad. |
| `src/world/chunkScheduler.js` | Cola de generación: deduplicar, descartar solicitudes lejanas y evitar duplicados. |
| `src/generator/biomeGenerator.js` | API del cliente de biomas, preferencia por Worker, mensajes de error y límite de fallback. |
| `src/generator/biomeWorker.js` | Cargar el bridge WASM local, fijar la semilla y generar el mapa de IDs en hilo de trabajo. |
| `src/generator/terrainGenerator.js` | Enviar columnas al Worker de terreno y resolver/rechazar el trabajo asíncrono. |
| `src/generator/terrainWorker.js` | Convertir columnas de la vista previa en arrays de posiciones por material. |
| `src/renderer/voxelMaterials.js` | Texturas deterministas cacheadas y filtrado pixelado. |
| `src/controls/flyControls.js` | Estado y eje vertical de vuelo. |
| `engine/cubiomes-bridge.c` | Interfaz C pequeña y explícita alrededor de la API Cubiomes. |

La escena, el bucle, la física básica y parte de la construcción del chunk siguen en `index.html`; no se presenta aún como una separación completa del renderer ni de todo el estado de mundo.

## Compilación y memoria

El build genera un módulo ES6 con Emscripten y mantiene los símbolos C de un puente estable en vez de leer una estructura interna de Cubiomes desde JavaScript. Se activa memoria expandible y `emmalloc`; el modo `DEBUG=1` añade `-g4`.

Los workers entregan arrays mediante buffers transferibles. Son una alternativa compatible con hostings estáticos habituales. El informe también describe `SharedArrayBuffer`; activarlo requiere aislamiento cross-origin mediante encabezados COOP/COEP y un build WASM configurado para memoria compartida. No se debe forzar esa vía en GitHub Pages sin comprobar las cabeceras del alojamiento.

## Las piezas que faltan para la generación Java real

Una implementación fiel todavía necesita:

1. **Datos oficiales y versionados de worldgen.** El conjunto `minecraft-data` citado por el informe aporta datos de protocolo, bloques y otros catálogos, pero el directorio `data/pc/1.21.1` por sí solo no proporciona el pack completo `data/minecraft/worldgen` del servidor Java. Para reproducirlo deben obtenerse/extraerse los JSON de la versión objetivo del JAR o datapack oficial y documentar su procedencia/versionado.
2. **Ruido/densidad vanilla.** Implementar el grafo real de density functions para Overworld 1.21.1 (incluyendo entradas de ruido, splines/continents, aquifers y demás dependencias) y evaluar el volumen en coordenadas X/Y/Z. No basta con una función Perlin inventada basada en un ID de bioma.
3. **Reglas de superficie reales.** Evaluar las reglas versionadas según alturas, estados de superficie, agua, condiciones del bioma y vecinos; no elegir solo por el nombre del bioma.
4. **Subsuelo y minerales.** Replicar configuraciones de placed/configured features, distribución por altura, aleatoriedad y orden de aplicación.
5. **Referencias doradas.** Exportar muestras de un mundo Java 1.21.1 real para varias semillas/coordenadas y comparar IDs de bioma, alturas, bloque por bloque, bordes de chunk y determinismo.
6. **Prueba de semilla de cerezo.** Consultar Cubiomes real y guardar las coordenadas/IDs observados para `5890866665536842607`. `X=-508, Z=24` no es evidencia de bioma ni de spawn; es una coordenada de inspección heredada.

## Criterios antes de quitar PREVIEW

No cambiar `exact: false` en el contrato ni retirar el aviso de la UI hasta que:
- el WASM correcto compile y se cargue en navegador;
- el valor de versión/dimensión/semilla se verifique;
- existan tests deterministas de biomas;
- las densidades, reglas de superficie y features estén implementadas;
- las pruebas de referencia de chunks de Java 1.21.1 pasen con diferencias explicadas y reproducibles.

La validación sintáctica del JavaScript no sustituye estos criterios.
