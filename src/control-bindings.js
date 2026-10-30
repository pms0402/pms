import { gameKey } from "./game-input.js";
export const DEFAULT_BINDINGS = Object.freeze({
  forward: "w",
  back: "s",
  left: "a",
  right: "d",
  light: "mouse0",
  heavy: "mouse2",
  skill0: "q",
  skill1: "e",
  skill2: "r",
  ultimate: "x",
  dash: "shift",
  parry: "f",
  inventory: "tab",
  pause: "escape",
  interact: "c",
  build: "b",
  view: "v",
  fullscreen: "f10",
});
export const CONTROL_NAMES = Object.freeze({
  forward: "앞으로",
  back: "뒤로",
  left: "왼쪽",
  right: "오른쪽",
  light: "일반 공격",
  heavy: "강공격",
  skill0: "스킬 1",
  skill1: "스킬 2",
  skill2: "스킬 3",
  ultimate: "궁극기",
  dash: "대시",
  parry: "패링",
  inventory: "장비·캐릭터",
  pause: "일시정지",
  interact: "교류",
  build: "빌드·스킬 배치",
  view: "시점",
  fullscreen: "전체화면",
});
export const controlKey = (e) =>
  e.type?.startsWith("pointer") || e.type?.startsWith("mouse")
    ? "mouse" + e.button
    : gameKey(e);
export function validBinding(key) {
  return (
    typeof key === "string" &&
    /^(?:[a-z0-9]|f(?:[1-9]|1[0-2])|arrow(?:up|down|left|right)|shift|tab|escape| |mouse[012])$/.test(
      key,
    )
  );
}
export function normalizeBindings(saved = {}) {
  const b = { ...DEFAULT_BINDINGS };
  if (!saved || typeof saved !== "object") return b;
  for (const id of Object.keys(b))
    if (validBinding(saved[id])) b[id] = saved[id];
  if (new Set(Object.values(b)).size !== Object.keys(b).length)
    return { ...DEFAULT_BINDINGS };
  return b;
}
export function rebind(bindings, id, key) {
  if (!Object.hasOwn(DEFAULT_BINDINGS, id) || !validBinding(key))
    return { ok: false, reason: "지원하지 않는 키입니다" };
  const conflict = Object.keys(bindings).find(
    (k) => k !== id && bindings[k] === key,
  );
  if (conflict)
    return {
      ok: false,
      reason: `${CONTROL_NAMES[conflict]}에서 사용하는 키입니다`,
    };
  return { ok: true, bindings: { ...bindings, [id]: key } };
}
export function keyLabel(key) {
  return key?.startsWith("mouse")
    ? ["좌클릭", "휠 클릭", "우클릭"][+key.slice(5)]
    : key === " "
      ? "SPACE"
      : key?.toUpperCase() || "—";
}
