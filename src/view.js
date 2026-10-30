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
export function usesTouchSteering({ fine = false, coarse = false, touches = 0, mouseObserved = false } = {}) {
  return !fine && !mouseObserved && (coarse || touches > 0);
}
export function viewMovement(x, y, yaw, out = new THREE.Vector3()) {
  return out.set(
    -Math.cos(yaw) * x - Math.sin(yaw) * y,
    0,
    Math.sin(yaw) * x - Math.cos(yaw) * y,
  );
}
// Integrate a continuous turn rate rather than targeting cardinal headings.
// Exact exponential integration keeps acceleration consistent across frame rates.
export class MovementSteering {
  constructor() { this.reset(); }
  reset() { this.speed = 0; }
  step(input, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    const target = -Math.max(-1,Math.min(1,Number(input)||0))*Math.PI*100/180;
    const decay = Math.exp(-dt/.075), previous = this.speed;
    this.speed = target+(previous-target)*decay;
    return target*dt+(previous-target)*.075*(1-decay);
  }
  direction(x,y,facing,out=new THREE.Vector3()) {
    const throttle=Math.hypot(x,y)*(y>0?-1:1);
    return out.set(Math.sin(facing),0,Math.cos(facing)).multiplyScalar(throttle);
  }
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

/** Character-aligned first/third person follow with camera-only collision. */
export class ViewController {
  constructor(game) {
    this.game = game;
    this.mode = "overhead";
    this.movement = new MovementSteering();
    this.yaw = Math.PI * 1.25;
    this.pitch = { third: 0.24, first: 0.04 };
    this.distance = 9.2;
    this.snap = true;
    this.anchor = new THREE.Vector3();
    this.followAnchor = new THREE.Vector3();
    this.lockOffset=new THREE.Vector3();this.lockDistance=this.distance;
    this.desired = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.lastPlayer = new THREE.Vector3(Infinity, 0, 0);
    this.direction = new THREE.Vector3();
    this.suppressed = [];
    this.canvas = game.renderer.domElement;
    this.finePointer = window.matchMedia('(any-pointer: fine)');
    this.coarsePointer = window.matchMedia('(any-pointer: coarse)');
    this.mouseObserved = false;
    this.onInputChange = event => {
      if (event.media === this.finePointer.media && !event.matches) this.mouseObserved = false;
      this.movement.reset();
      this.game.callbacks.onViewChange?.(this.getState());
    };
    this.onPointerObserved = event => {
      if (event.pointerType !== 'mouse' || !this.touchSteering()) return;
      this.mouseObserved = true;
      this.movement.reset();
      this.game.callbacks.onViewChange?.(this.getState());
    };
    // Observe the old UI state before handlers, then capture after the choice.
    // Chained mandatory choices keep their cursor until the final selection.
    this.resumeClicks = new WeakSet();
    this.onResumeIntent = event => {
      if (!event.isTrusted || this.game.rebinding || event.repeat ||
        event.key === 'Escape' || event.ctrlKey || event.metaKey || event.altKey ||
        event.target?.closest?.('input,select,textarea,[contenteditable="true"]')) return;
      const leavingUI = this.game._state.phase !== 'playing' || this.game.callbacks.isUIBlocked?.();
      if (!leavingUI) return;
      if (event.type === 'click') this.resumeClicks.add(event);
      else this.resumeKey = event.code || event.key;
    };
    this.onResumeGesture = event => {
      if (!event.isTrusted || this.disposed) return;
      const finishing = event.type === 'click' ? this.resumeClicks.has(event) :
        this.resumeKey && this.resumeKey === (event.code || event.key);
      if (event.type === 'keyup') this.resumeKey = null;
      if (finishing && this.game._state.phase === 'playing') this.capture();
    };
    this.onLockError = () => { this.lockPending = false; };
    this.onMouseMove = (e) => {
      if (document.pointerLockElement === this.canvas && this.canLook())
        {this.rotate(e.movementX, e.movementY);}
    };
    this.onLockChange = () => {
      const locked=document.pointerLockElement===this.canvas;if(!locked&&this.wasLocked&&!this.releasing&&this.game._state.phase==='playing'&&!this.game.callbacks.isUIBlocked?.()){this.game.unlockPauseAt=performance.now();this.game.callbacks.onControlAction?.('pause');}this.wasLocked=locked;this.releasing=false;this.lockPending=false;

      if (
        document.pointerLockElement === this.canvas &&
        !this.canCapture()
      ) {
        this.release();
        return;
      }
      this.drag = null;
      if (!locked && this.captureQueued) { this.captureQueued = false; this.capture(); }
      this.game.callbacks.onViewChange?.(this.getState());
    };
    this.onContextMenu = (e) => {
      e.preventDefault();
    };
    this.onWheel = (e) => {
      if (this.mode !== "third" || !this.canLook()) return;
      e.preventDefault();
      this.distance = clamp(this.distance + e.deltaY * 0.008, 5.5, 13.2);
    };
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    document.addEventListener('pointerdown', this.onPointerObserved, true);
    document.addEventListener('pointermove', this.onPointerObserved, true);
    document.addEventListener('click', this.onResumeIntent, true);
    document.addEventListener('click', this.onResumeGesture);
    window.addEventListener('keydown', this.onResumeIntent, true);
    window.addEventListener('keyup', this.onResumeGesture);
    this.finePointer.addEventListener('change', this.onInputChange);
    this.coarsePointer.addEventListener('change', this.onInputChange);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }
  effectiveMode() {
    return this.mode === "first" &&
      ["menu", "over", "won"].includes(this.game._state.phase)
      ? "third"
      : this.mode;
  }
  following(){return this.mode!=='overhead'&&!['menu','over','won'].includes(this.game._state.phase);}
  touchSteering() {
    return usesTouchSteering({fine:this.finePointer.matches,coarse:this.coarsePointer.matches,
      touches:navigator.maxTouchPoints,mouseObserved:this.mouseObserved});
  }
  canCapture() {
    return !this.touchSteering() && this.mode !== 'overhead' && this.canLook() &&
      !this.game.callbacks.isUIBlocked?.();
  }
  capture() {
    if (!this.canCapture() || !this.canvas.requestPointerLock) return false;
    if (this.releasing) { this.captureQueued = true; return false; }
    if (document.pointerLockElement === this.canvas || this.lockPending) return true;
    this.canvas.focus({preventScroll:true});
    try {
      this.lockPending = true;
      this.canvas.requestPointerLock()?.catch?.(() => { this.lockPending = false; });
      return true;
    } catch { this.lockPending = false; return false; }
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
    this.movement.reset();
    this.snap = true;
    this.game.swordTrail?.reset();
    this.update(0);
    if(this.following()&&!this.game.lockOn?.target)this.game.aimFromView?.();
    this.game.callbacks.onViewChange?.(this.getState());
    return true;
  }
  cycle() {
    this.setMode(
      VIEW_MODES[(VIEW_MODES.indexOf(this.mode) + 1) % VIEW_MODES.length],
    );
    this.capture();
  }
  rotate(dx, dy, touch = false) {
    if (!this.canLook() || this.mode === "overhead") return;
    const scale = touch ? 0.005 : 0.0028;
    const actions=this.game.actions,base=actions?.hasAim?Math.atan2(actions.aim.x,actions.aim.z):this.game.player.rotation.y;
    const requestedYaw=THREE.MathUtils.euclideanModulo(base-dx*scale,Math.PI*2);
    const mode = this.effectiveMode();
    this.pitch[mode] = clamp(
      this.pitch[mode] + dy * scale,
      mode === "first" ? -1.2 : -0.1,
      1.15,
    );
    if(this.game.lockOn?.target)return;
    this.game.aimFromView?.(requestedYaw);
    this.yaw=this.game.player.rotation.y;
  }
  pointerDown(e) {
    if (this.mode === "overhead" || !this.canLook()) return false;
    if(e.pointerType!=="touch"&&e.button!==1)return false;
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
    if (document.pointerLockElement !== this.canvas) this.canvas.setPointerCapture?.(e.pointerId);
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
    this.captureQueued = false;
    if (document.pointerLockElement === this.canvas){this.releasing=true;document.exitPointerLock?.();}
  }
  getState() {
    return {
      mode: this.mode,
      label: VIEW_LABELS[this.mode],
      yaw: this.yaw,
      pitch: this.pitch[this.effectiveMode()] || 0,
      distance: this.distance,
      locked: document.pointerLockElement === this.canvas,
      following:this.following(),
      inputMode:this.touchSteering()?'touch':'mouse',
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
      camp = g.camp?.active,training=g.training?.active;
    const t = cameraArmFraction(
      this.anchor,
      position,
      training?g.training.cameraSolids:room ? ROOM_SOLIDS : camp ? CAMP_SOLIDS : CAMERA_SOLIDS,
      (x, z) => g.groundHeight(x, z),
      0.24,
      training?17:room ? 12 : camp ? 18 : Infinity,
    );
    if (t < 1) position.lerpVectors(this.anchor, position, t);
  }
  update(dt) {
    const g = this.game,
      camera = g.camera,
      mode = this.effectiveMode(),
      p = g.player.position;
    if (!this.canLook()) this.release();
    const following=this.following();if(following)this.yaw=g.player.rotation.y;
    if (this.lastPlayer.distanceToSquared(p) > 64) this.snap = true;
    this.lastPlayer.copy(p);
    this.cueTime=Math.max(0,(this.cueTime||0)-dt);
    const cue=this.effectiveMode()!=='first'&&g.cameraShake>0?Math.sin((this.cueTime||0)/(this.cueTotal||1)*Math.PI)*(g.effectIntensity??1)*1.8:0;
    const fov = this.fov()+cue,
      near = mode === "first" ? 0.07 : 0.1;
    if (camera.fov !== fov || camera.near !== near) {
      camera.fov = fov;
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    this.anchor.copy(p);
    this.anchor.y += (mode === "first" ? 2.105 : following?2.35:1.2) * g.player.scale.y;
    if(this.snap||mode!=='third')this.followAnchor.copy(this.anchor);
    else this.followAnchor.lerp(this.anchor,1-Math.exp(-Math.max(0,dt)*12));
    const lockedTarget=g.lockOn?.target;
    const lockOffset=lockedTarget?lockedTarget.group.position.clone().sub(p).multiplyScalar(.25):new THREE.Vector3();lockOffset.y=0;
    this.lockOffset.lerp(lockOffset,1-Math.exp(-Math.max(0,dt)*6));
    const lockDistance=lockedTarget?Math.min(12,Math.max(this.distance,5+p.distanceTo(lockedTarget.group.position)*.35)):this.distance;
    this.lockDistance+= (lockDistance-this.lockDistance)*(1-Math.exp(-Math.max(0,dt)*6));
    if(this.snap){this.lockOffset.copy(lockOffset);this.lockDistance=lockDistance;}
    if (mode === "overhead") {
      const menu = g._state.phase === "menu" ? 3.5 : 0;
      this.desired.set(p.x + 20 - menu, p.y + 26, p.z + 25 + menu);
      this.desired.add(this.lockOffset);
      this.look.set(p.x - menu, p.y + 0.5, p.z + menu).add(this.lockOffset);
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
          .copy(following?this.followAnchor:this.anchor)
          .addScaledVector(this.direction, -this.lockDistance);
        const shoulder = following?0:camera.aspect < .9 ? .55 : 1.15;
        this.desired.x -= cy * shoulder;this.desired.z += sy * shoulder;
        this.clip(this.desired);
        this.look.copy(this.anchor);
        this.look.x -= cy * shoulder;this.look.z += sy * shoulder;
      }
    }
    if (this.snap || mode === "first" || following) camera.position.copy(this.desired);
    else
      camera.position.lerp(
        this.desired,
        1 - Math.exp(-Math.max(0, dt) * (mode === "overhead" ? 4 : 12)),
      );
    if (mode === "third" && !following) this.clip(camera.position);
    const shakeScale = mode === "overhead" ? 1 : mode === "first" ? 0.18 : 0.45;
    if (g.shake > 0 && g.cameraShake > 0) {
      const shake = g.shake * g.cameraShake * shakeScale;
      camera.position.x += (Math.random() * 2 - 1) * shake;
      camera.position.z += (Math.random() * 2 - 1) * shake;
      if (mode === "third") this.clip(camera.position);
    }
    if(following)this.look.copy(camera.position).add(this.direction);
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
    this.movement.reset();
    this.cueTime=0;
    this.release();
    this.restoreBody();
    this.snap = true;
  }
  dispose() {
    this.disposed = true;
    this.reset();
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener('pointerlockerror', this.onLockError);
    document.removeEventListener('pointerdown', this.onPointerObserved, true);
    document.removeEventListener('pointermove', this.onPointerObserved, true);
    document.removeEventListener('click', this.onResumeIntent, true);
    document.removeEventListener('click', this.onResumeGesture);
    window.removeEventListener('keydown', this.onResumeIntent, true);
    window.removeEventListener('keyup', this.onResumeGesture);
    this.finePointer.removeEventListener('change', this.onInputChange);
    this.coarsePointer.removeEventListener('change', this.onInputChange);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.canvas.removeEventListener("wheel", this.onWheel);
  }
  emphasize(){if((this.cueTime||0)>.4)return;this.cueTime=this.cueTotal=1.1;}
}
