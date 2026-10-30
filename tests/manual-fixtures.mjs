/** Domain fixtures explicitly issue an aimed action and advance its marker.
 * Timing, buffering and native inputs are tested independently by action-smoke.
 * Nothing is installed into the production Game and no update loop is automatic. */
export async function manualPage(owner, options) {
  const page = await owner.newPage(options);
  await page.addInitScript(() => {
    window.testStrike = (g, aim = { x: 0, z: 1 }) => {
      if (g.actions.current)
        g.actions.update(
          g.actions.current.duration - g.actions.current.elapsed + 1e-8,
        );
      g.actions.clearInput();
      g.actions.setAim(g.player.position.clone().set(aim.x, 0, aim.z));
      const accepted = g.attack();
      if (!accepted) return false;
      const a = g.actions.current;
      g.actions.update(a.duration * a.markers[0] + 1e-8);
      if (a.style === "wave" && !a.counter)
        for (let t = 0; t < a.profile.range / 25 + 0.04; t += 0.02)
          g.updateProjectiles(0.02);
      return true;
    };
    window.testEnemyStrike = (g, e) => {
      e.tactics = { phase: "circle", timer: 0, angle: 0 };
      g.updateEnemies(0.01);
      g.updateEnemies(1);
      g.stepForTest(0.02); // Run normal death/settlement handling after the warned hit.
    };
    window.testCast = (g, id, aim = { x: 1, z: 0 }, target = null) =>
      g.magic.castManual(
        id,
        g.player.position.clone().set(aim.x, 0, aim.z),
        target ||
          (id === "fireball"
            ? g.player.position
                .clone()
                .addScaledVector(
                  g.player.position.clone().set(aim.x, 0, aim.z),
                  12,
                )
            : g.player.position.clone()),
      );
  });
  return page;
}
