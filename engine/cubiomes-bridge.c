/* Minimal Emscripten bridge for Cubiomes' Java Edition biome generator.
 * Cubiomes is a separate MIT-licensed upstream dependency; see README.md.
 * This bridge intentionally generates biomes only, not block-level terrain.
 */
#include <stdint.h>
#include <stdlib.h>
#include "generator.h"
#include "biomes.h"

static Generator g;
static int initialized = 0;
static int *map_data = NULL;
static size_t map_capacity = 0;

void worldgen_init(uint64_t seed) {
    setupGenerator(&g, MC_1_21_1, 0);
    applySeed(&g, DIM_OVERWORLD, seed);
    initialized = 1;
}

int worldgen_biome_at(int x, int y, int z) {
    if (!initialized) return none;
    return getBiomeAt(&g, 1, x, y, z);
}

/* Generates a top-down biome grid. x/z are the block coordinates of the
 * upper-left sample, step is blocks between samples, width/height are cells. */
int worldgen_generate_map(int x, int z, int width, int height, int step, int y) {
    if (!initialized || width < 1 || height < 1 || width > 1024 || height > 1024 || step < 1)
        return -1;
    size_t count = (size_t)width * (size_t)height;
    if (count > map_capacity) {
        int *next = (int *)realloc(map_data, count * sizeof(int));
        if (!next) return -2;
        map_data = next;
        map_capacity = count;
    }
    for (int row = 0; row < height; ++row) {
        for (int col = 0; col < width; ++col) {
            int id = getBiomeAt(&g, 1, x + col * step, y, z + row * step);
            map_data[(size_t)row * width + col] = id;
        }
    }
    return 0;
}

int worldgen_map_ptr(void) { return (int)(uintptr_t)map_data; }
