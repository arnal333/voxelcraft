/* First-person free-flight state. Pointer Lock remains owned by the game canvas. */
(function (root) {
  'use strict';
  let flying = false;
  root.VoxelCraftFlyControls = Object.freeze({
    isFlying: function () { return flying; },
    toggle: function () { flying = !flying; return flying; },
    disable: function () { flying = false; },
    verticalAxis: function (keys) {
      const up = keys.Space ? 1 : 0;
      const down = (keys.ControlLeft || keys.ControlRight || keys.KeyC) ? 1 : 0;
      return up - down;
    }
  });
})(window);
