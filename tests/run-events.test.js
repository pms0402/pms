import test from 'node:test';
import assert from 'node:assert/strict';
import { CURSES, ROUTES, getRunModifiers, getCurseChoices } from '../src/run-events.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≈ ${expected}`);
const pressure = modifiers => modifiers.enemyHealth * modifiers.enemyDamage * modifiers.spawnMultiplier;

test('optional curses exchange bonus gold for at least as much combined combat pressure', () => {
  assert.equal(CURSES.length, 3);
  assert.equal(new Set(CURSES.map(curse => curse.id)).size, 3);
  for (const curse of CURSES) {
    assert.ok(curse.title && curse.description && curse.icon);
    assert.ok(curse.enemyHealth > 1 && curse.enemyDamage > 1 && curse.goldMultiplier > 1);
    assert.ok(pressure(curse) + 1e-10 >= curse.goldMultiplier);
    assert.ok(Object.isFrozen(curse));
    assert.equal(curse.chestBonus, 0);
    assert.equal(curse.eliteMultiplier, 1);
  }
});

test('standard is always a neutral route while harder routes increase reward and pressure', () => {
  assert.deepEqual(ROUTES.map(route => route.id), ['standard', 'elite', 'treasure']);
  assert.deepEqual(getRunModifiers(), { enemyHealth: 1, enemyDamage: 1, goldMultiplier: 1, spawnMultiplier: 1, eliteMultiplier: 1, chestBonus: 0 });
  for (const route of ROUTES) {
    assert.ok(route.title && route.description && route.icon);
    assert.ok(pressure(route) + 1e-10 >= route.goldMultiplier);
    assert.ok(Object.isFrozen(route));
  }
  assert.equal(getRunModifiers([], 'elite').eliteMultiplier, 2);
  assert.equal(getRunModifiers([], 'treasure').chestBonus, 1);
  assert.ok(getRunModifiers([], 'elite').enemyHealth > getRunModifiers().enemyHealth);
});

test('curses compound once each and a route is replaced rather than accumulated', () => {
  const owned = CURSES.map(curse => curse.id);
  const initial = [...owned];
  const baseline = getRunModifiers(owned);
  const elite = getRunModifiers(owned, 'elite');
  close(baseline.enemyHealth, 1.5 * 1.2 * 1.8);
  close(baseline.enemyDamage, 1.2 * 1.35 * 1.3);
  close(baseline.goldMultiplier, 1.8 * 1.65 * 2.1);
  close(baseline.spawnMultiplier, 1.2);
  close(elite.enemyHealth, baseline.enemyHealth * 1.35);
  close(elite.enemyDamage, baseline.enemyDamage * 1.2);
  close(elite.goldMultiplier, baseline.goldMultiplier * 1.65);
  close(elite.spawnMultiplier, baseline.spawnMultiplier * 1.15);
  assert.equal(elite.eliteMultiplier, 2);
  const treasure = getRunModifiers(owned, 'treasure');
  close(treasure.enemyHealth, baseline.enemyHealth * 1.2);
  assert.equal(treasure.eliteMultiplier, 1, 'leaving the elite route clears its modifier');
  assert.equal(treasure.chestBonus, 1);
  assert.deepEqual(getRunModifiers(owned, 'standard'), baseline);
  assert.deepEqual(owned, initial, 'calculating modifiers leaves owned IDs intact');
  assert.deepEqual(getRunModifiers([...owned, ...owned, ...owned]), baseline);
});

test('invalid saved or supplied IDs cannot bypass the unique three-curse cap', () => {
  const ids = ['bloodDebt', 'bloodDebt', '__proto__', 'constructor', null, 42, {}, 'missing'];
  assert.deepEqual(getRunModifiers(ids, '__proto__'), getRunModifiers(['bloodDebt']));
  for (const value of [null, {}, '', false, 42]) {
    assert.deepEqual(getRunModifiers(value), getRunModifiers());
  }
  const longInput = Array.from({ length: 10000 }, (_, index) => CURSES[index % 3].id);
  const capped = getRunModifiers(longInput, 'elite');
  assert.deepEqual(capped, getRunModifiers(CURSES.map(curse => curse.id), 'elite'));
  assert.ok(Object.values(capped).every(Number.isFinite));
  assert.ok(capped.enemyHealth < 5 && capped.enemyDamage < 3 && capped.goldMultiplier < 11);
});

test('altar choices exclude acquired curses, exhaust safely and return isolated copies', () => {
  const before = getCurseChoices();
  assert.equal(before.length, 3);
  const remaining = getCurseChoices(['bloodDebt', 'bloodDebt', 'not-a-curse']);
  assert.deepEqual(remaining.map(curse => curse.id), ['frenzy', 'titans']);
  assert.deepEqual(getCurseChoices(CURSES.map(curse => curse.id)), []);
  before[0].enemyHealth = 0;
  before[0].description = 'overwritten';
  assert.equal(getCurseChoices()[0].enemyHealth, 1.5);
  assert.notEqual(getCurseChoices()[0].description, 'overwritten');
  const modifiers = getRunModifiers(); modifiers.enemyHealth = 0;
  assert.equal(getRunModifiers().enemyHealth, 1);
  assert.ok(Object.isFrozen(CURSES) && Object.isFrozen(ROUTES));
});
