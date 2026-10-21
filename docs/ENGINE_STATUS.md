# Estado real de compatibilidad

- El juego 3D conserva el generador aproximado existente para alturas, superficies y chunks.
- Se agregó una vista de mapa de biomas y una interfaz adaptadora para Cubiomes.
- `engine/cubiomes-bridge.c` está preparada para usar `MC_1_21_1` de Cubiomes y generar una cuadrícula de biomas.
- El binario `engine/cubiomes.wasm` y su glue `engine/cubiomes.js` no se incluyen todavía: en el entorno de creación no está instalado Emscripten y no hay acceso de red desde la terminal para compilar/descargar la dependencia.
- Por esa razón, el mapa funciona en modo preview aproximado hasta construir el WASM; no se declara compatibilidad vanilla en esta entrega.
- Aunque Cubiomes se compile, su alcance es generación de biomas/características, no generación completa de bloques del terreno. La escena 3D seguirá siendo aproximada hasta implementar un motor de terreno compatible y validarlo contra mundos de Java 1.21.1.
