import { chromium } from 'playwright';

// Optional development probe, not a pass/fail balance test. Uses real combat,
// starting HP/damage, enemy HP, pickups, earned upgrades and boss mechanics.
// Only time, RNG and input are controlled. There is no rendering benchmark here.
// This one movement/choice policy does not represent player skill, device FPS,
// all possible builds or balance across the later four stages.
//
// node scripts/balance-probe.mjs
// node scripts/balance-probe.mjs --risk swarm --seed 14123 --duration 240
// BASE_URL=http://127.0.0.1:5173 node scripts/balance-probe.mjs --risk none,fury

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : args[index + 1];
}
const risks = String(option('risk', 'none,swarm,fury')).split(',');
const seed = Number(option('seed', 14123));
const duration = Number(option('duration', 240));
if (!risks.length || risks.some(risk => !['none', 'swarm', 'fury'].includes(risk))) throw new Error('--risk must contain none, swarm or fury');
if (!Number.isSafeInteger(seed) || seed < 1 || seed >= 2147483647) throw new Error('--seed must be an integer from 1 to 2147483646');
if (!Number.isFinite(duration) || duration <= 0 || duration > 1800) throw new Error('--duration must be between 0 and 1800 seconds');

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
const results = [];
try {
  for (const risk of risks) {
    // A fresh browser storage origin ensures zero permanent upgrades or unlocks.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push({ risk, message: error.message }));
      await page.goto(option('url', process.env.BASE_URL || 'http://127.0.0.1:5173'));
      await page.waitForFunction(() => window.__game?.frames > 1);
      results.push(await page.evaluate(({ risk, seed, duration }) => {
        const game = window.__game;
        cancelAnimationFrame(game.raf);
        const originalRandom = Math.random;
        let state = seed;
        Math.random = () => { state = state * 16807 % 2147483647; return (state - 1) / 2147483646; };
        try {
          if (!game.setRiskPact(risk)) throw new Error(`Cannot select risk ${risk}`);
          game.start(); game.frames = 0;
          const startingStats = { hp: game.stats.maxHp, swordDamage: game.stats.damage, magicDamage: game.stats.spellDamage };
          let minHp = game._state.hp;
          for (let frame = 0; frame < Math.ceil(duration * 60); frame++) {
            if (game._state.phase === 'upgrade') {
              const priorities = ['spell_fireball', 'evolve_fireball', 'spell_frost', 'spell_lightning', 'spell_orbit', 'spell_power', 'spell_haste', 'power', 'haste', 'armor', 'vitality', 'regen'];
              const choice = priorities.map(id => game.upgradeChoices.find(candidate => candidate.id === id)).find(Boolean) || game.upgradeChoices[0];
              if (!choice || !game.chooseUpgrade(choice.id)) throw new Error('Invalid earned upgrade choice');
            } else if (game._state.phase === 'relic') {
              const choice = game.relicChoices.find(candidate => candidate.id === 'frostfire') || game.relicChoices.find(candidate => candidate.id === 'blast') || game.relicChoices[0];
              if (!choice || !game.chooseRelic(choice.id)) throw new Error('Invalid earned relic choice');
            }
            if (game._state.phase !== 'playing' || game._state.stage > 1) break;
            const boss = game.boss, elapsed = game._state.elapsed;
            let dx, dz;
            if (boss?.hp > 0) {
              const rx = game.player.position.x - boss.group.position.x, rz = game.player.position.z - boss.group.position.z;
              const radius = Math.hypot(rx, rz) || 1;
              const wanted = boss.mode === 'pulse-warning' ? 10 : 4.7;
              const correction = Math.max(-2, Math.min(2, (wanted - radius) * 0.6));
              dx = rx / radius * correction - rz / radius;
              dz = rz / radius * correction + rx / radius;
            } else {
              dx = Math.cos(elapsed * 0.23) * 18 - game.player.position.x;
              dz = Math.sin(elapsed * 0.23) * 18 - game.player.position.z;
            }
            const length = Math.hypot(dx, dz) || 1;
            // Invert the game's isometric input transform; do not teleport.
            game.setMoveInput((dx - dz) / length * Math.SQRT1_2, (dx + dz) / length * Math.SQRT1_2);
            if (boss?.mode === 'charge' && game.dashCooldown <= 0) game.dash();
            game.frames++; game.tick(1 / 60); game.animateEffects(1 / 60);
            minHp = Math.min(minHp, game._state.hp);
          }
          const result = {
            risk, seed, policy: 'circle_then_orbit_boss', startingStats,
            outcome: game._state.stage > 1 ? 'stage_one_cleared' : game._state.phase === 'over' ? 'died' : 'time_limit',
            elapsed: Number(game._state.elapsed.toFixed(3)), phase: game._state.phase, stage: game._state.stage,
            hp: Number(game._state.hp.toFixed(3)), minHp: Number(minHp.toFixed(3)),
            level: game._state.level, kills: game._state.kills, gold: game._state.gold,
            boss: game.boss ? { hp: Math.max(0, Number(game.boss.hp.toFixed(3))), maxHp: game.boss.maxHp } : null,
            relics: [...game.stats.relics], spells: { ...game.stats.spells },
          };
          game.setMoveInput(0, 0);
          return result;
        } finally { Math.random = originalRandom; }
      }, { risk, seed, duration }));
    } finally { await context.close(); }
  }
  console.log(JSON.stringify({
    note: 'One seeded input/choice policy using unmodified starting stats and actual combat. This is not a full-run balance or FPS guarantee.',
    results, errors,
  }, null, 2));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
