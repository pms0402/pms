import * as THREE from "three";
import {
  CAMERA_SOLIDS,
  ROOM_SOLIDS,
  cameraArmFraction,
} from "./camera-collision.js";
import { CAMP_FACILITIES } from "./camp.js";

export const VIEW_MODES = Object.freeze(["third", "first", "overhead"]);
export const VIEW_LABELS = Object.freeze({
  third: "3인칭",
  first: "1인칭",
  overhead: "항공",
});
export function viewMovement(x, y, yaw, out = new THREE.Vector3()) {
  return out.set(
    -Math.cos(yaw) * x - Math.sin(yaw) * y,
    0,
    Math.sin(yaw) * x - Math.cos(yaw) * y,
  );
}
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const CAMP_SOLIDS = CAMP_FACILITIES.map((f) => ({
  x: f.x,
  z: f.z,
  hx: 1.7,
  hz: 1.7,
  minY: 0,
  maxY: 3.4,
}));

/** Camera-only orbit, collision and first-person presentation. No combat stat changes. */
export class ViewController {
  constructor(game) {
    this.game = game;
    this.mode = "overhead";
    this.yaw = Math.PI * 1.25;
    this.pitch = { third: 0.24, first: 0.04 };
    this.distance = 9.2;
    this.snap = true;
    this.anchor = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.lastPlayer = new THREE.Vector3(Infinity, 0, 0);
    this.direction = new THREE.Vector3();
    this.suppressed = [];
    this.canvas = game.renderer.domElement;
    this.onMouseMove = (e) => {
      if (document.pointerLockElement === this.canvas && this.canLook())
        this.rotate(e.movementX, e.movementY);
    };
    this.onLockChange = () => {
      if (
        document.pointerLockElement === this.canvas &&
        (!this.firstPerson() || !this.canLook())
      ) {
        this.release();
        return;
      }
      this.drag = null;
      this.game.callbacks.onViewChange?.(this.getState());
    };
    this.onContextMenu = (e) => {
      if (this.mode !== "overhead") e.preventDefault();
    };
    this.onWheel = (e) => {
      if (this.mode !== "third" || !this.canLook()) return;
      e.preventDefault();
      this.distance = clamp(this.distance + e.deltaY * 0.008, 5.5, 13.2);
    };
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onLockChange);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }
  effectiveMode() {
    return this.mode === "first" &&
      ["menu", "over", "won"].includes(this.game._state.phase)
      ? "third"
      : this.mode;
  }
  firstPerson() {
    return this.effectiveMode() === "first";
  }
  canLook() {
    return (
      ["playing", "camp"].includes(this.game._state.phase) &&
      !this.game.camp?.suspended
    );
  }
  setMode(mode) {
    if (!VIEW_MODES.includes(mode)) return false;
    this.release();
    this.restoreBody();
    this.mode = mode;
    this.snap = true;
    this.game.swordTrail?.reset();
    this.update(0);
    this.game.callbacks.onViewChange?.(this.getState());
    return true;
  }
  cycle() {
    this.setMode(
      VIEW_MODES[(VIEW_MODES.indexOf(this.mode) + 1) % VIEW_MODES.length],
    );
  }
  rotate(dx, dy, touch = false) {
    if (!this.canLook() || this.mode === "overhead") return;
    const scale = touch ? 0.005 : 0.0028;
    this.yaw = THREE.MathUtils.euclideanModulo(
      this.yaw - dx * scale,
      Math.PI * 2,
    );
    const mode = this.effectiveMode();
    this.pitch[mode] = clamp(
      this.pitch[mode] + dy * scale,
      mode === "first" ? -1.2 : -0.1,
      1.15,
    );
  }
  pointerDown(e) {
    if (this.mode === "overhead" || !this.canLook()) return false;
    const rect = this.canvas.getBoundingClientRect();
    if (e.pointerType === "touch" && e.clientX < rect.left + rect.width * 0.5)
      return false;
    if (this.drag) return true;
    this.game.container.focus?.({ preventScroll: true });
    this.drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      touch: e.pointerType === "touch",
    };
    this.canvas.setPointerCapture?.(e.pointerId);
    if (
      e.pointerType !== "touch" &&
      e.button === 0 &&
      this.firstPerson() &&
      this.canvas.requestPointerLock
    ) {
      try {
        this.canvas.requestPointerLock()?.catch?.(() => {});
      } catch {
        /* Drag remains available in embedded browsers. */
      }
    }
    e.preventDefault();
    return true;
  }
  pointerMove(e) {
    if (document.pointerLockElement === this.canvas) return true;
    if (this.drag?.id !== e.pointerId) return false;
    this.rotate(
      e.clientX - this.drag.x,
      e.clientY - this.drag.y,
      this.drag.touch,
    );
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    return true;
  }
  pointerUp(e) {
    if (this.drag?.id === e.pointerId) {
      this.drag = null;
      return true;
    }
    return false;
  }
  release() {
    this.drag = null;
    if (document.pointerLockElement === this.canvas)
      document.exitPointerLock?.();
  }
  getState() {
    return {
      mode: this.mode,
      label: VIEW_LABELS[this.mode],
      yaw: this.yaw,
      pitch: this.pitch[this.effectiveMode()] || 0,
      distance: this.distance,
      locked: document.pointerLockElement === this.canvas,
    };
  }
  fov() {
    const portrait = this.game.camera.aspect < 0.9;
    return this.effectiveMode() === "overhead"
      ? portrait
        ? 56
        : 43
      : this.firstPerson()
        ? portrait
          ? 86
          : 78
        : portrait
          ? 74
          : 66;
  }
  clip(position) {
    const g = this.game,
      room = g.sideAreas?.active,
      camp = g.camp?.active;
    const t = cameraArmFraction(
      this.anchor,
      position,
      room ? ROOM_SOLIDS : camp ? CAMP_SOLIDS : CAMERA_SOLIDS,
      (x, z) => g.groundHeight(x, z),
      0.24,
      room ? 12 : camp ? 18 : Infinity,
    );
    if (t < 1) position.lerpVectors(this.anchor, position, t);
  }
  update(dt) {
    const g = this.game,
      camera = g.camera,
      mode = this.effectiveMode(),
      p = g.player.position;
    if (!this.canLook()) this.release();
    if (this.lastPlayer.distanceToSquared(p) > 64) this.snap = true;
    this.lastPlayer.copy(p);
    const fov = this.fov(),
      near = mode === "first" ? 0.07 : 0.1;
    if (camera.fov !== fov || camera.near !== near) {
      camera.fov = fov;
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    this.anchor.copy(p);
    this.anchor.y += (mode === "first" ? 2.105 : 1.2) * g.player.scale.y;
    if (mode === "overhead") {
      const menu = g._state.phase === "menu" ? 3.5 : 0;
      this.desired.set(p.x + 20 - menu, p.y + 26, p.z + 25 + menu);
      this.look.set(p.x - menu, p.y + 0.5, p.z + menu);
    } else {
      const pitch = this.pitch[mode],
        sy = Math.sin(this.yaw),
        cy = Math.cos(this.yaw),
        cp = Math.cos(pitch),
        sp = Math.sin(pitch);
      this.direction.set(sy * cp, -sp, cy * cp);
      if (mode === "first") {
        this.desired.copy(this.anchor);
        this.desired.x += sy * 0.1;
        this.desired.z += cy * 0.1;
        this.look.copy(this.desired).add(this.direction);
      } else {
        this.desired
          .copy(this.anchor)
          .addScaledVector(this.direction, -this.distance);
        this.clip(this.desired);
        this.look.copy(this.anchor);
      }
    }
    if (this.snap || mode === "first") camera.position.copy(this.desired);
    else
      camera.position.lerp(
        this.desired,
        1 - Math.exp(-Math.max(0, dt) * (mode === "overhead" ? 4 : 12)),
      );
    if (mode === "third") this.clip(camera.position);
    const shakeScale = mode === "overhead" ? 1 : mode === "first" ? 0.18 : 0.45;
    if (g.shake > 0 && g.cameraShake > 0) {
      const shake = g.shake * g.cameraShake * shakeScale;
      camera.position.x += (Math.random() * 2 - 1) * shake;
      camera.position.z += (Math.random() * 2 - 1) * shake;
      if (mode === "third") this.clip(camera.position);
    }
    camera.lookAt(this.look);
    camera.updateMatrixWorld();
    this.snap = false;
    if (g.sunlight) {
      g.sunlight.position.set(p.x - 15, p.y + 35, p.z + 12);
      g.sunlight.target.position.copy(p);
      g.sunlight.target.updateMatrixWorld();
    }
  }
  maskBody() {
    this.restoreBody();
    const g = this.game;
    if (
      !this.firstPerson() &&
      !(
        this.effectiveMode() === "third" &&
        g.camera.position.distanceTo(this.anchor) < 2.3
      )
    )
      return;
    for (const child of g.playerVisual.children)
      if (child !== g.rightShoulder && child !== g.leftShoulder) {
        this.suppressed.push([child, child.visible]);
        child.visible = false;
      }
  }
  restoreBody() {
    for (const [part, visible] of this.suppressed) part.visible = visible;
    this.suppressed.length = 0;
  }
  reset() {
    this.release();
    this.restoreBody();
    this.snap = true;
  }
  dispose() {
    this.reset();
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.canvas.removeEventListener("wheel", this.onWheel);
  }
}
