/* Deduplicated, bounded-by-distance chunk work queue. Rendering remains on the main thread. */
(function (root) {
  'use strict';
  class ChunkScheduler {
    constructor() {
      this._queue = [];
      this._queued = new Set();
    }
    get length() { return this._queue.length; }
    has(key) { return this._queued.has(key); }
    enqueue(item) {
      if (!item || !item.key || this._queued.has(item.key)) return false;
      this._queue.push(item);
      this._queued.add(item.key);
      return true;
    }
    take() {
      const item = this._queue.shift();
      if (item) this._queued.delete(item.key);
      return item || null;
    }
    retain(requiredKeys) {
      for (let i = this._queue.length - 1; i >= 0; i--) {
        if (!requiredKeys.has(this._queue[i].key)) {
          this._queued.delete(this._queue[i].key);
          this._queue.splice(i, 1);
        }
      }
    }
    clear() {
      this._queue.length = 0;
      this._queued.clear();
    }
  }
  root.VoxelCraftChunkScheduler = ChunkScheduler;
})(window);
