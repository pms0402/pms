import * as THREE from "three";
/** One reversible scene context. Original actors and simulation owners remain intact. */
export class SceneContext {
  constructor(game) {
    this.game = game;
    this.saved = null;
  }
  hide() {
    const g = this.game,
      keep = new Set([
        g.player,
        g.playerShadow, g.swordTrail?.mesh,
        g.defeats?.root,g.enemyStates?.mesh,
        g.atmosphere?.sky,
        g.actorShadows?.mesh,
        g.parry?.mesh, g.parry?.feedback.root,
        g.setSystem?.mesh,
        g.classes?.pet,
      ]);
    this.saved = {
      visibility: new Map(),
      background: g.scene.background.clone(),
      fog: g.scene.fog.color.clone(),
      density: g.scene.fog.density,
      mood: g.moodTarget.map((c) => c.clone()),
      camera: g.camera.position.clone(),
    };
    for (const o of g.scene.children)
      if (!o.isLight && !o.isCamera && !keep.has(o)) {
        this.saved.visibility.set(o, o.visible);
        o.visible = false;
      }
    g.enemyRenderer.reset();
  }
  mood(colors) {
    const g = this.game;
    g.moodTarget = colors.map((c) => new THREE.Color(c));
    g.updateMood(100);
  }
  restore() {
    if (!this.saved) return;
    const g = this.game,
      s = this.saved;
    for (const [o, v] of s.visibility) o.visible = v;
    g.scene.background.copy(s.background);
    g.scene.fog.color.copy(s.fog);
    g.scene.fog.density = s.density;
    g.moodTarget = s.mood;
    g.camera.position.copy(s.camera);
    this.saved = null;
  }
}
export function clearCosmetics(g) {
  g.parry.feedback.reset(); g.parry.hitStop = 0;
  g.enemyRenderer.reset();
  g.swordTrail?.reset();
  g.defeats?.reset();
  g.enemyStates?.reset();
  g.combatArt.reset();
  while (g.floatingTexts.length) g.removeFloatingText(0);
  for (const e of g.effects) g.releaseEffect(e);
  g.effects.length = 0;
  while (g.magic?.effects.length) g.magic.removeEffect(0);
}
