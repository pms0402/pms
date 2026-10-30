import { NPC_TYPES } from "./exploration.js";

/** Shares the real dispatcher priority and exact reach tests with its prompt. */
export function interactionTarget(game) {
  const phase = game._state.phase;
  if (game.callbacks.isUIBlocked?.()) return null;
  if (phase === "camp" && game.camp.active && !game.camp.suspended) {
    const f = game.camp.nearest();
    return f && f.distance <= 3.4
      ? { kind: "camp", id: f.id, name: f.name, verb: "이용하기" }
      : null;
  }
  if (phase !== "playing" || game.camp.active) return null;
  const side = game.sideAreas,
    p = game.player.position,
    a = side.active;
  if (a) {
    if (Math.hypot(p.x, p.z - 10) < 3.2)
      return { kind: "exit", name: "원래 전장", verb: "돌아가기" };
    if (Math.hypot(p.x, p.z + 3) >= 3.2) return null;
    if (a.type === "ancient" && !a.claimed)
      return { kind: "room", name: "고대 기록", verb: "읽기" };
    if (a.type === "curse" && !a.accepted && !a.claimed)
      return { kind: "room", name: "저주의 제단", verb: "시련 확인" };
    if (a.complete && !a.claimed)
      return { kind: "room", name: "시련 보상 제단", verb: "보상 받기" };
    return null;
  }
  const portal = side.portal;
  if (portal && !portal.used && portal.group.position.distanceTo(p) <= 3.5)
    return { kind: "portal", name: "비밀 공간 입구", verb: "살펴보기" };
  const npc = game.exploration.npc;
  if (npc && !npc.used && npc.group.position.distanceTo(p) <= 3.2)
    return {
      kind: "npc",
      name: NPC_TYPES[npc.type] || "낯선 방문자",
      verb: "대화하기",
    };
  return null;
}
