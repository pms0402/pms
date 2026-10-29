export const RECORDS = Object.freeze([
  {
    id: "sanctuary",
    title: "성역의 잔향",
    text: "성역은 공허를 막는 감옥이자 세계를 이어 주는 다리였다. 수호자들은 무너진 뒤에도 그 문을 지키고 있었다.",
  },
  {
    id: "royalOath",
    title: "잊힌 왕의 맹세",
    text: "왕은 균열을 봉인하기 위해 이름을 버렸다. 고대의 방에 남은 검은 왕의 귀환을 기다린다.",
  },
  {
    id: "voidLens",
    title: "관측자의 렌즈",
    text: "공허는 허무가 아니었다. 수없이 갈라진 세계를 바라보는 눈이었다.",
  },
  {
    id: "buriedTruth",
    title: "매몰된 진실",
    text: "숨겨진 던전의 수호자는 재앙을 만들던 자가 아니라 반복되는 실험에서 벗어나려던 자였다.",
  },
  {
    id: "cycle",
    title: "순환의 기록",
    text: "심연에서 죽은 세계는 다시 성역으로 태어났다. 기록만이 반복을 건너 살아남았다.",
  },
  {
    id: "firstRift",
    title: "최초의 균열",
    text: "성역이 완벽한 균형을 강요한 순간, 배제된 가능성들이 최초의 균열이 되었다. 세계를 살릴 길은 봉인도 계승도 아닌 공존이었다.",
  },
  ...Object.entries({
    volcano: "잿불",
    tundra: "설원",
    forest: "오염된 숲",
    ruins: "유적",
    void: "공허",
  }).map(([id, title]) => ({
    id: `zone_${id}`,
    title: `${title}의 기억`,
    text: `${title}의 수호자가 쓰러지자 갈라진 성역의 흔적이 드러났다. 이 지역도 한때 같은 세계의 일부였다.`,
  })),
  {
    id: "kingEcho",
    title: "왕의 마지막 이름",
    text: "잊혀진 왕은 검을 내려놓았다. 오랜 맹세는 사슬이 아니라 돌아갈 집을 기억하는 약속이었다.",
  },
  {
    id: "observerEcho",
    title: "눈을 감은 관측자",
    text: "관측자는 마지막 순간 단 하나의 세계를 택했다. 당신이 돌아갈 수 있는 세계였다.",
  },
]);
export const HIDDEN_BOSSES = Object.freeze([
  {
    id: "king",
    name: "잊혀진 왕",
    condition: "고대의 방에서 왕의 맹세 발견 + 일반 2층 보스 처치",
    hint: "청색 검격은 정면 패링 가능. 붉은 원에서 이동하세요.",
    color: "#d5bd7b",
  },
  {
    id: "observer",
    name: "공허의 관측자",
    condition: "공허 NPC 이벤트 완료 + 숨겨진 던전 클리어",
    hint: "도착 균열을 피하고 탄막의 빈틈으로 이동하세요.",
    color: "#bf85ef",
  },
  {
    id: "primordial",
    name: "태초의 심연",
    condition: "심연 25층 도달 + 왕·관측자 처치 기록",
    hint: "고리 안쪽의 빈 원이 안전지대입니다. 파문은 방어할 수 없습니다.",
    color: "#e79a9c",
  },
]);
export const ENDINGS = Object.freeze([
  {
    id: "guardian",
    name: "성역의 수호자",
    choice: "성역을 복구한다",
    condition: "일반 10층 클리어",
    text: "당신은 무너진 성역의 빛을 다시 이었다. 분열된 지역들은 길을 되찾고, 공허를 기억하는 새 질서가 시작되었다.",
  },
  {
    id: "heir",
    name: "공허의 계승자",
    choice: "공허의 힘을 받아들인다",
    condition: "렌즈·매몰된 진실 기록 + 관측자 처치",
    text: "당신은 관측자의 자리를 이었다. 공허는 새로운 가능성의 바다가 되었고, 세계는 당신의 선택을 따라 다른 미래로 흘러갔다.",
  },
  {
    id: "cycle",
    name: "끝없는 순환",
    choice: "다음 순환으로 향한다",
    condition: "순환의 기록 + 심연 30층 도달",
    text: "끝이 없는 심연의 문을 닫는 대신 당신은 다음 세계에 기억을 남겼다. 돌아올 전사는 같은 길에서 다른 선택을 할 수 있을 것이다.",
  },
  {
    id: "origin",
    name: "최초의 균열",
    choice: "균열의 진실을 세상에 전한다",
    condition: "주요 기록 6개 + 히든 보스 3종 처치",
    text: "완벽한 봉인이 세계를 구할 수는 없었다. 당신은 성역과 공허가 함께 존재하는 길을 열었다. 최초의 균열은 마지막 상처가 아니라 새로운 세계의 입구가 되었다.",
  },
]);
const unique = (items, ids) =>
  Array.isArray(items)
    ? [...new Set(items.filter((x) => ids.includes(x)))]
    : [];
export function normalizeStory(input = {}) {
  const s = input && typeof input === "object" ? input : {};
  return {
    version: 1,
    records: unique(
      s.records,
      RECORDS.map((r) => r.id),
    ),
    defeated: unique(
      s.defeated,
      HIDDEN_BOSSES.map((b) => b.id),
    ),
    endings: unique(
      s.endings,
      ENDINGS.map((e) => e.id),
    ),
    normalClear: s.normalClear === true,
    normalBossStages: unique(
      s.normalBossStages,
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    ),
    abyssHighest: Math.min(
      Number.MAX_SAFE_INTEGER,
      Math.max(0, Math.floor(Number(s.abyssHighest) || 0)),
    ),
  };
}
export function bossUnlocked(p, id) {
  return id === "king"
    ? p.records.includes("royalOath") && p.normalBossStages.includes(2)
    : id === "observer"
      ? p.records.includes("voidLens") && p.records.includes("buriedTruth")
      : id === "primordial"
        ? p.abyssHighest >= 25 &&
          ["king", "observer"].every((x) => p.defeated.includes(x))
        : false;
}
export function endingUnlocked(p, id) {
  return id === "guardian"
    ? p.normalClear
    : id === "heir"
      ? ["voidLens", "buriedTruth"].every((x) => p.records.includes(x)) &&
        p.defeated.includes("observer")
      : id === "cycle"
        ? p.abyssHighest >= 30 && p.records.includes("cycle")
        : id === "origin"
          ? RECORDS.slice(0, 6).every((x) => p.records.includes(x.id)) &&
            HIDDEN_BOSSES.every((x) => p.defeated.includes(x.id))
          : false;
}
export class StorySystem {
  constructor(game) {
    this.game = game;
    this.progress = normalizeStory();
  }
  load(data, history = [], endgame = {}) {
    this.progress = normalizeStory(data);
    for (const r of history)
      if (r.mode !== "abyss") {
        const completed = r.won
          ? Math.min(10, r.stage)
          : Math.min(10, (r.stage || 1) - 1);
        for (let n = 1; n <= completed; n++)
          if (!this.progress.normalBossStages.includes(n))
            this.progress.normalBossStages.push(n);
        if (r.won && r.stage >= 10) this.progress.normalClear = true;
      }
    this.progress.abyssHighest = Math.max(
      this.progress.abyssHighest,
      endgame.bestFloor || 0,
    );
    if (
      this.progress.normalBossStages.includes(1) &&
      !this.progress.records.includes("sanctuary")
    )
      this.progress.records.push("sanctuary");
    this.save();
  }
  save() {
    this.game.callbacks.onStory?.(structuredClone(this.progress));
  }
  find(id) {
    if (!RECORDS.some((r) => r.id === id) || this.progress.records.includes(id))
      return false;
    this.progress.records.push(id);
    this.save();
    this.game.callbacks.onLoot?.(
      `기록 발견 · ${RECORDS.find((r) => r.id === id).title} · 기록관에서 다시 읽기`,
    );
    return true;
  }
  onBoss(stage, region, mode) {
    if (mode !== "abyss" && !this.progress.normalBossStages.includes(stage))
      this.progress.normalBossStages.push(stage);
    if (stage === 1 && mode !== "abyss") this.find("sanctuary");
    if (region && RECORDS.some((r) => r.id === `zone_${region}`))
      this.find(`zone_${region}`);
    this.save();
  }
  onFloor(stage, mode) {
    if (mode === "abyss") {
      this.progress.abyssHighest = Math.max(this.progress.abyssHighest, stage);
      if (stage >= 20) this.find("cycle");
      this.save();
    }
  }
  defeat(id) {
    if (
      !HIDDEN_BOSSES.some((b) => b.id === id) ||
      this.progress.defeated.includes(id)
    )
      return false;
    this.progress.defeated.push(id);
    this.find(
      id === "king"
        ? "kingEcho"
        : id === "observer"
          ? "observerEcho"
          : "firstRift",
    );
    this.save();
    return true;
  }
  canBoss(id) {
    return bossUnlocked(this.progress, id);
  }
  canEnding(id) {
    return endingUnlocked(this.progress, id);
  }
  chooseEnding(id) {
    if (
      !["menu", "over", "won", "camp"].includes(this.game._state.phase) ||
      !this.canEnding(id)
    )
      return false;
    if (!this.progress.endings.includes(id)) {
      this.progress.endings.push(id);
      this.save();
    }
    return true;
  }
  normalWin() {
    this.progress.normalClear = true;
    this.save();
  }
  state() {
    return {
      ...structuredClone(this.progress),
      bosses: HIDDEN_BOSSES.map((b) => ({
        ...b,
        unlocked: this.canBoss(b.id),
        defeated: this.progress.defeated.includes(b.id),
      })),
      endingChoices: ENDINGS.map((e) => ({
        ...e,
        unlocked: this.canEnding(e.id),
        seen: this.progress.endings.includes(e.id),
      })),
    };
  }
}
