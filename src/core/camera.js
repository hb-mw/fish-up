// 2D camera with smooth follow, zoom and trauma-based shake. KERNEL FILE.
import { WORLD } from './config.js';
import { clamp, damp } from './math.js';
import { noise1 } from './rng.js';

/** Camera y that frames the boat nicely at zoom 1: waterline ≈ 42% down the screen. */
export const SURFACE_CAM_Y = 86;

export function createCamera(game) {
  const b = { left: 0, right: 0, top: 0, bottom: 0, w: 0, h: 0 };
  const cam = {
    x: WORLD.startX + 180,
    y: SURFACE_CAM_Y,
    zoom: 1,
    tx: WORLD.startX + 180,
    ty: SURFACE_CAM_Y,
    tzoom: 1,
    /** follow speed (1/s). Gameplay may tweak per situation. */
    stiffness: 3.0,
    zoomStiffness: 1.8,
    trauma: 0,
    shakeX: 0,
    shakeY: 0,
    /** Debug: when true the camera ignores targets (URL ?cam=x,y or debug keys). */
    free: false,

    /** Ask the camera to (smoothly) centre on a world point. Call every frame from gameplay. */
    setTarget(x, y, zoom = 1, snap = false) {
      if (cam.free) return;
      cam.tx = x;
      cam.ty = y;
      cam.tzoom = zoom;
      if (snap) {
        cam.x = x;
        cam.y = y;
        cam.zoom = zoom;
        clampCam();
      }
    },
    /** Add screen shake. amount 0..1 (0.2 = small thump, 0.6 = big hit). */
    addShake(amount) {
      cam.trauma = Math.min(1, cam.trauma + amount);
    },

    update(dt) {
      if (!cam.free) {
        cam.x = damp(cam.x, cam.tx, cam.stiffness, dt);
        cam.y = damp(cam.y, cam.ty, cam.stiffness, dt);
        cam.zoom = damp(cam.zoom, cam.tzoom, cam.zoomStiffness, dt);
      }
      clampCam();
      cam.trauma = Math.max(0, cam.trauma - dt * 1.3);
      const s = cam.trauma * cam.trauma;
      const t = game.time.real * 28;
      cam.shakeX = (noise1(t, 11) * 2 - 1) * 26 * s;
      cam.shakeY = (noise1(t, 23) * 2 - 1) * 20 * s;
      updateBounds();
    },

    /** Set ctx to the world→device transform (call ctx.save() first if you need to restore). */
    apply(ctx) {
      const v = game.view;
      const k = v.scale * cam.zoom;
      ctx.setTransform(
        k, 0, 0, k,
        v.scale * (v.w / 2 + cam.shakeX) - cam.x * k,
        v.scale * (v.h / 2 + cam.shakeY) - cam.y * k
      );
    },
    /** Set ctx to the plain logical-screen transform (0,0 top-left … view.w, view.h). */
    applyScreen(ctx) {
      const s = game.view.scale;
      ctx.setTransform(s, 0, 0, s, 0, 0);
    },

    /** world → logical screen coords */
    worldToScreen(wx, wy, out = {}) {
      const v = game.view;
      out.x = (wx - cam.x) * cam.zoom + v.w / 2 + cam.shakeX;
      out.y = (wy - cam.y) * cam.zoom + v.h / 2 + cam.shakeY;
      return out;
    },
    /** logical screen → world coords */
    screenToWorld(sx, sy, out = {}) {
      const v = game.view;
      out.x = (sx - v.w / 2 - cam.shakeX) / cam.zoom + cam.x;
      out.y = (sy - v.h / 2 - cam.shakeY) / cam.zoom + cam.y;
      return out;
    },
    /** Screen y (logical) of a world y — handy for horizon / waterline in screen-space layers. */
    screenY: (wy) => (wy - cam.y) * cam.zoom + game.view.h / 2 + cam.shakeY,
    screenX: (wx) => (wx - cam.x) * cam.zoom + game.view.w / 2 + cam.shakeX,

    /** Visible world rectangle {left,right,top,bottom,w,h} — refreshed every frame. Do not mutate. */
    bounds: b,
    /** Is a world-space circle (x,y,r) at least partly on screen? */
    sees(x, y, r = 0) {
      return x + r > b.left && x - r < b.right && y + r > b.top && y - r < b.bottom;
    },
  };

  function clampCam() {
    const v = game.view;
    cam.zoom = clamp(cam.zoom, 0.45, 1.6);
    const hw = v.w / 2 / cam.zoom;
    const hh = v.h / 2 / cam.zoom;
    cam.x = clamp(cam.x, hw, Math.max(hw, WORLD.width - hw));
    cam.y = clamp(cam.y, WORLD.skyTop + hh, WORLD.depth + 140 - hh);
  }
  function updateBounds() {
    const v = game.view;
    const hw = v.w / 2 / cam.zoom;
    const hh = v.h / 2 / cam.zoom;
    b.left = cam.x - hw - cam.shakeX / cam.zoom;
    b.right = cam.x + hw - cam.shakeX / cam.zoom;
    b.top = cam.y - hh - cam.shakeY / cam.zoom;
    b.bottom = cam.y + hh - cam.shakeY / cam.zoom;
    b.w = b.right - b.left;
    b.h = b.bottom - b.top;
  }
  cam.refresh = () => {
    clampCam();
    updateBounds();
  };
  return cam;
}
