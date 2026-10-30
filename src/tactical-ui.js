import { text, attr, toggle, disabled } from "./dom-update.js";
import { keyLabel } from "./control-bindings.js";
import { TRAINING_MODES } from "./training.js";
import { COMBAT_LINKS } from "./combat-links.js";
import { ENEMY_TYPES } from "./encounters.js";
import { formatGold } from "./balance.js";

export const linkMarkup = () =>
  `<section class="tactical-recipes"><h3>순서와 타이밍 · 전투 연계</h3>${COMBAT_LINKS.map((l) => `<article><strong>${l.name}</strong><p>${l.condition}</p><small>${l.effect}</small></article>`).join("")}<p>진화·유물의 숨겨진 조합과 별도입니다. 추가 폭발은 검·연계를 다시 발동하지 않습니다.</p></section>`;
export function createTacticalUi({ game, openModal, forceCloseModal, notify }) {
  const $ = (s) => document.querySelector(s);
  function trainingMenu() {
    if (!game.camp.active && !game.training.active) return;
    const bosses = game.training.seenBosses();
    openModal(
      "training",
      `<div class="modal-eyebrow">SANCTUARY COMBAT PRACTICE</div><h2 id="modal-title">실전 훈련장</h2><p class="modal-description">실제 전투 판정과 적 패턴을 연습합니다. 훈련의 체력·스킬 재사용·재화·통계는 모험과 별개이며 나가면 원래 상태로 돌아갑니다.</p><div class="training-options"><label>연습 무기<select id="training-weapon"><option value="voidblade">공허의 검</option><option value="greatsword">파쇄 대검</option><option value="tempest">질풍의 검</option></select></label><label>훈련 마법 단계<select id="training-rank"><option value="1">1단계</option><option value="3">3단계</option><option value="5">5단계 · 진화 미리보기</option></select></label><label>몬스터 패턴<select id="training-kind">${ENEMY_TYPES.filter(
        (e) => e.kind !== 4,
      )
        .map((e) => `<option value="${e.kind}">${e.name}</option>`)
        .join(
          "",
        )}</select></label><label>만난 보스<select id="training-boss">${bosses.map((b) => `<option value="${b.hidden ? "hidden:" + b.hidden : b.stage}">${b.hidden ? "히든" : b.stage + "층"} · ${b.name}</option>`).join("") || '<option value="">모험에서 보스를 먼저 만나세요</option>'}</select></label></div><div class="training-modes">${Object.entries(
        TRAINING_MODES,
      )
        .map(
          ([id, name]) =>
            `<button class="secondary-button" data-training-mode="${id}" ${id === "boss" && !bosses.length ? "disabled" : ""}>${name}</button>`,
        )
        .join(
          "",
        )}</div><p class="archive-note">스킬은 Q/E/R, B에서 설치 룬도 배치할 수 있습니다. 훈련 중 ‘재사용 초기화’로 반복하고 ‘야영지’로 나옵니다. 락온과 연속 회전도 그대로 연습합니다.</p>${linkMarkup()}`,
    );
    $("#training-weapon").value = game.stats.weaponId;
    document.querySelectorAll("[data-training-mode]").forEach(
      (button) =>
        (button.onclick = () => {
          const boss = $("#training-boss").value,
            options = {
              weapon: $("#training-weapon").value,
              rank: +$("#training-rank").value,
              kind: +$("#training-kind").value,
              stage: +boss || 1,
              hidden: boss.startsWith("hidden:") ? boss.slice(7) : null,
            };
          forceCloseModal();
          if (!game.training.start(button.dataset.trainingMode, options))
            notify("아직 만난 적 없는 보스는 연습할 수 없습니다");
          $("#game-canvas").focus({ preventScroll: true });
        }),
    );
  }
  function objectiveInfo() {
    const a = game.objectives.state();
    if (!a) return;
    openModal(
      "objective",
      `<div class="modal-eyebrow">FLOOR OBJECTIVE</div><h2 id="modal-title">${a.name}</h2><p class="modal-description">${a.hint}</p><p>${a.complete ? "목표 완료 · 수호자를 처치하세요" : `${Math.floor(a.progress)} / ${a.target}`} · 현재 표식 ${Math.ceil(a.distance)}m</p><p>${a.reward ? `목표 완료 골드: 이 층 기본 코인 ×${a.reward}. 계약·지역·보유 골드 배율을 적용합니다. 목표와 보스 처치를 모두 마치면 다음 지역을 선택합니다.` : "생존 목표와 보스 처치를 모두 마치면 다음 지역을 선택합니다."}</p>`,
    );
  }
  function bind() {
    $("#lock-toggle").onclick = () => {
      game.lockOn.toggle();
      $("#game-canvas").focus({ preventScroll: true });
    };
    $("#lock-next").onclick = () => {
      game.lockOn.cycle(1);
      $("#game-canvas").focus({ preventScroll: true });
    };
    $("#objective-panel").onclick = objectiveInfo;
    $("#training-refill").onclick = () => game.training.refill();
    $("#training-change").onclick = trainingMenu;
    $("#training-exit").onclick = () => {
      forceCloseModal();
      game.training.leave();
      $("#game-canvas").focus({ preventScroll: true });
    };
  }
  function update(s) {
    const lock = s.lockOn || {},
      active = s.phase === "playing",
      objective = s.objective,
      practice = s.training;
    text(
      $("#lock-toggle"),
      `${lock.active ? "해제" : "락온"} · ${keyLabel(game.bindings.lockon)}`,
    );
    attr($("#lock-toggle"), "aria-pressed", lock.active ? "true" : "false");
    disabled($("#lock-toggle"), !active);
    text($("#lock-next"), `전환 · ${keyLabel(game.bindings.targetNext)}`);
    toggle($("#lock-next"), "hidden", !lock.active);
    disabled($("#lock-next"), !active);
    text(
      $("#lock-state"),
      lock.active ? `${lock.name} · ${Math.ceil(lock.distance)}m` : "",
    );
    attr(
      $("#lock-toggle"),
      "title",
      `락온/해제 ${keyLabel(game.bindings.lockon)} · 다음 ${keyLabel(game.bindings.targetNext)} / 이전 ${keyLabel(game.bindings.targetPrev)} · 벽에 가려지거나 멀어지면 해제`,
    );
    const showObjective =
      active &&
      !practice &&
      !s.sideArea?.active &&
      objective &&
      objective.type !== "survival";
    toggle($("#objective-panel"), "hidden", !showObjective);
    if (showObjective) {
      text($("#objective-name"), objective.name);
      text(
        $("#objective-summary"),
        objective.complete
          ? "목표 완료 · 수호자 처치"
          : objective.broken
            ? "장치 복구 후 재시도"
            : `${Math.floor(objective.progress)} / ${objective.target} · ${Math.ceil(objective.distance)}m${objective.maxHp ? " · 결계 " + Math.ceil((objective.hp / objective.maxHp) * 100) + "%" : ""}`,
      );
      attr($("#objective-panel"), "title", objective.hint);
    }
    toggle($("#training-controls"), "hidden", !practice);
    document.body.classList.toggle(
      "has-tactical-panel",
      !!showObjective || !!practice,
    );
    if (practice)
      text(
        $("#training-metrics"),
        `${practice.name} · ${practice.hits}적중 · ${practice.kills}처치 · 마지막 ${formatGold(practice.lastDamage)} · DPS ${formatGold(practice.dps)} · 피격 ${formatGold(practice.received)} · 재개 ${practice.downs}회`,
      );
    const links = s.combatLinks || {};
    text(
      $("#link-callout"),
      links.last ||
        (links.parryWindow > 0
          ? `반전 시전 ${links.parryWindow.toFixed(1)}s`
          : links.dashWindow > 0
            ? "대시 → 번개"
            : ""),
    );
    toggle(
      $("#link-callout"),
      "hidden",
      !active || !$("#link-callout").textContent,
    );
    const boss = s.boss;
    toggle($("#boss-tactic"), "hidden", !boss?.alive);
    if (boss?.alive)
      text(
        $("#boss-tactic"),
        boss.chainRemaining > 0
          ? "연계 중 · 다음 예고 확인"
          : boss.recoveryTime > 0
            ? `반격 기회 ${boss.recoveryTime.toFixed(1)}s · 받는 피해 +20%`
            : "푸른 공격 패링 가능 · 붉은 지면은 회피",
      );
  }
  return { bind, update, trainingMenu };
}
