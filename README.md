# Minecraft 3D Walk — integración de mapa de semillas Java 1.21.1

## Incluye

- `index.html`: juego original Three.js conservado, con botón de mapa de biomas, consulta de coordenadas y panel de diagnóstico.
- `js/cubiomes-adapter.js`: adaptador que carga el motor WebAssembly opcional cuando está compilado.
- `engine/cubiomes-bridge.c`: puente C para usar la API de biomas de Cubiomes fijada en `MC_1_21_1`.
- `scripts/build-cubiomes-wasm.sh`: compila Cubiomes con Emscripten y genera `engine/cubiomes.js` y `engine/cubiomes.wasm`.
- `docs/ENGINE_STATUS.md`: limitaciones verificadas y estado real.

## Cómo activar el mapa de biomas compatible

1. Instala y activa Emscripten SDK (`emcc`) y Git.
2. Ejecuta `scripts/build-cubiomes-wasm.sh` desde una terminal bash. El script descarga la dependencia pública `Cubitect/cubiomes` si no existe en `engine/vendor/cubiomes`.
3. Sirve la carpeta por HTTP local (por ejemplo, `python -m http.server 8000`) y abre `http://localhost:8000` apuntando a esta carpeta. No abras `index.html` con `file://`.
4. Pulsa **Mapa de biomas (preview)**. Cuando el WASM esté disponible, el panel indicará que Cubiomes está activo; si no, mostrará el mapa aproximado y explicará por qué.

## Importante: no afirmar más de lo que se ha verificado

Cubiomes reproduce biomas/características para versiones de Minecraft Java; no es el generador completo de bloques. El mapa exacto depende de compilar el WASM y verificar su salida. El terreno 3D de esta entrega continúa usando el generador aproximado anterior. No se ha validado igualdad bloque por bloque con Minecraft 1.21.1.

## Controles conservados

WASD para moverse, espacio para saltar, Shift según el comportamiento previo del proyecto, mouse para mirar, Escape para soltar el mouse. La barra de semilla y el botón de regeneración siguen disponibles.


## Corrección para la semilla 5890866665536842607

- El proyecto intenta cargar un build WASM de Cubiomes fijado a un commit para calcular biomas reales.
- El código usa `MC_1_21_1` (valor 26 en el enum upstream), no el número 21 como ordinal.
- La tabla de IDs de bioma fue corregida: el ID 185 corresponde a `cherry_grove`, no a océano.
- Para esta semilla, el mundo inicia en las coordenadas de referencia compartidas X=-508, Z=24, porque el enlace anterior estaba centrado ahí. Eso es un punto de inspección, no una afirmación de que sea el spawn vanilla oficial.
- Solo la selección de biomas usa Cubiomes; altura, costa y bloques siguen generándose con el sistema aproximado original. No debe considerarse un clon de terreno vanilla exacto.
- El motor remoto requiere conexión a Internet. Si no se carga, la interfaz debe indicar que está usando la vista previa aproximada.


## Mejoras recientes
- Texturas procedurales pixel-art 16×16 con filtro nearest y variación sutil; no dependen de descargas de imágenes.
- Consola de comandos: pulsa `T` o `/`, escribe `/tp x y z` (también `/tp @s x y z`) y pulsa Enter.
- Generación de árboles revisada para que la elección de posiciones no omita tan fácilmente los árboles de un bioma de cerezo.

**Límite importante:** el motor de terreno sigue siendo un prototipo aproximado. Los biomas y la presencia de cerezo solo se pueden considerar verificados si Cubiomes WASM carga correctamente y devuelve `CHERRY_GROVE` para las coordenadas inspeccionadas. La altura, las capas de bloques y el relieve no son equivalentes a Minecraft Java vanilla.
