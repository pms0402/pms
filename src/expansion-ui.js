import {keyLabel} from './control-bindings.js';
import { setsMarkup } from './chronicle-ui.js';
import { SETS } from './sets.js';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_GRADES,
  EQUIPMENT_OPTIONS,
} from "./equipment.js";
import { NPC_TYPES } from "./exploration.js";
import { formatGold, SPELLS } from "./balance.js";
import { CHARACTERS, WEAPONS } from "./progression.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const baseName = {
  weapon: "검 피해",
  armor: "최대 체력",
  ring: "마법 피해",
  necklace: "최대 체력",
};
export function itemMarkup(item, old) {
  const grade =
      EQUIPMENT_GRADES.find((g) => g.id === item.grade) || EQUIPMENT_GRADES[0],
    power = item.power * (1 + 0.12 * item.level),
    prior = old ? old.power * (1 + 0.12 * old.level) : 0;
  return `<article class="gear-card" style="--gear:${grade.color}"><small>${grade.name} · ${EQUIPMENT_SLOTS[item.slot]} · 강화 ${item.level}/5</small><h3>${esc(item.title)}</h3><strong>${baseName[item.slot]} +${(power * 100).toFixed(1)}%</strong>${old ? `<p class="gear-compare">현재 ${esc(old.title)} +${(prior * 100).toFixed(1)}% → <b>${((power - prior) * 100).toFixed(1)}%p</b></p>` : ""}<ul>${item.options.map((id) => `<li>${esc(EQUIPMENT_OPTIONS.find((o) => o.id === id)?.name)}${id === "element" ? ` (${esc(SPELLS.find(s => s.id === item.element)?.name || item.element)})` : ""}</li>`).join("")}</ul>${item.setId ? `<p class="gear-set" style="color:${SETS.find(s=>s.id===item.setId)?.color||'#c6acff'}">세트 · ${esc(SETS.find(s=>s.id===item.setId)?.name||item.setId)}</p>` : ""}${item.unique ? '<p class="gear-unique">고유 · 공명: 숨겨진 조합 피해 +12%</p>' : ""}</article>`;
}
export function createExpansionUi({
  game,
  openModal,
  forceClose,
  closeModal,
  notify,
  readEndgame,
}) {
  const ui = {
    inventory() {
      if (
        !["playing", "paused", "menu", "over", "won"].includes(
          game._state.phase,
        )
      )
        return;
      const gear = game.equipment;
      openModal(
        "inventory",
        `<div class="modal-eyebrow">RUN EQUIPMENT / ${gear.bag.length} OF 16</div><h2 id="modal-title">장비를 비교하고, 빌드를 완성하세요.</h2><p class="modal-description">현재 런에만 적용됩니다. 장착은 자동 회복하지 않습니다. 드롭은 근처에서 수집하며, 가방이 가득 차면 먼저 버려 주세요. 전설 공명은 조합 피해를 강화합니다.</p><div class="gear-slots">${Object.entries(
          EQUIPMENT_SLOTS,
        )
          .map(([id, title]) => {
            const item = gear.equipped.find((i) => i.slot === id);
            return `<div><small>${title}</small><strong>${esc(item?.title || "비어 있음")}</strong></div>`;
          })
          .join("")}</div>${setsMarkup(gear.bonuses().sets)}<div class="gear-grid">${
          gear.bag.length
            ? gear.bag
                .map(
                  (item) =>
                    `<section>${itemMarkup(
                      item,
                      gear.equipped.find(
                        (i) => i.slot === item.slot && i.id !== item.id,
                      ),
                    )}<div class="gear-actions"><button class="secondary-button" data-equip="${esc(item.id)}" ${gear.slots[item.slot] === item.id ? "disabled" : ""}>${gear.slots[item.slot] === item.id ? "장착 중" : "장착 / 교체"}</button><button class="secondary-button" data-discard="${esc(item.id)}">버리기</button></div></section>`,
                )
                .join("")
            : "<p>적 처치·보스 보상·NPC에게 장비를 획득하세요.</p>"
        }</div>`,
      );
      document.querySelectorAll("[data-equip]").forEach(
        (b) =>
          (b.onclick = () => {
            if (gear.equip(b.dataset.equip)) {
              game.emit();
              ui.inventory();
            }
          }),
      );
      document.querySelectorAll("[data-discard]").forEach(
        (b) =>
          (b.onclick = () => {
            if (gear.discard(b.dataset.discard)) {
              game.emit();
              ui.inventory();
            }
          }),
      );
    },
    reward(choices) {
      openModal(
        "equipment",
        `<div class="modal-eyebrow">GUARDIAN EQUIPMENT</div><h2 id="modal-title">수호자의 장비를 하나 고르세요.</h2><p class="modal-description">가방에 보관한 뒤 Tab / 장비에서 비교·장착하세요. 가방 ${game.equipment.bag.length}/16. 선택 중 전투가 멈춥니다.</p><div class="gear-grid">${choices
          .map(
            (item) =>
              `<section>${itemMarkup(
                item,
                game.equipment.equipped.find((i) => i.slot === item.slot),
              )}<button class="secondary-button" data-equipment-choice="${esc(item.id)}" ${game.equipment.bag.length >= 16 ? "disabled" : ""}>이 장비 받기</button></section>`,
          )
          .join(
            "",
          )}</div><button class="secondary-button" data-equipment-choice="skip">장비 없이 계속하기</button>`,
        { pause: false, closeable: false },
      );
      document.querySelectorAll("[data-equipment-choice]").forEach(
        (b) =>
          (b.onclick = () => {
            if (game.equipment.choose(b.dataset.equipmentChoice)) forceClose();
          }),
      );
    },
    npc(type, choices) {
      openModal(
        "npc",
        `<div class="modal-eyebrow">EXPLORATION / ${esc(type)}</div><h2 id="modal-title">${NPC_TYPES[type]}</h2><p class="modal-description">대화 중 전투가 멈춥니다. 한 번만 선택할 수 있습니다. 구매는 <b>이번 런에서 수집한 골드</b>를 사용하며, 사용한 만큼 런 종료 후 영구 정산액에서 빠집니다. 기존 영구 지갑에서는 차감하지 않습니다.</p><p>이번 런 잔액 <b>${formatGold(game._state.gold)} G</b></p><div class="npc-choices">${choices.map((c) => `<button class="npc-choice" data-npc-choice="${esc(c.id)}" ${game._state.gold < c.cost ? "disabled" : ""}><strong>${esc(c.title)}</strong><p>${esc(c.description)}</p><small>${c.cost ? `${formatGold(c.cost)} G` : "골드 비용 없음"}</small></button>`).join("")}</div><p id="npc-feedback" role="status"></p><button class="secondary-button" data-npc-choice="skip">이벤트 포기하고 계속</button>`,
        { pause: false, closeable: false },
      );
      document.querySelectorAll("[data-npc-choice]").forEach(
        (b) =>
          (b.onclick = () => {
            if (game.exploration.choose(b.dataset.npcChoice)) forceClose();
            else
              document.querySelector("#npc-feedback").textContent =
                "가방 공간·골드·강화 상한·전장 인원 조건을 확인하세요. 현재 선택은 소비되지 않았습니다.";
          }),
      );
    },
    modes() {
      if (!["menu", "over", "won", "camp"].includes(game._state.phase)) return;
      const end = readEndgame();
      openModal(
        "modes",
        `<div class="modal-eyebrow">CHOOSE YOUR DESCENT</div><h2 id="modal-title">탐험 모드</h2><div class="npc-choices"><button class="npc-choice" data-mode="normal"><strong>일반 · 1–10층</strong><p>기존 성장과 분기 경로. 종말의 왕좌를 돌파하면 심연 해금.</p></button><button class="npc-choice" data-mode="abyss" ${end.unlocked ? "" : "disabled"}><strong>무한 심연 · 11층부터 ${end.unlocked ? "" : "🔒"}</strong><p>새 런으로 시작하며 장비는 계승하지 않습니다. 기본 검·마법 피해 ×5, 최대 체력 ×2.5의 심연 출발 보정. 층 이동 자동 성장은 없습니다. 5층마다 재앙 보스, 20층부터 10층마다 교대 제약.</p></button></div><p>선택 후 런 시작 / 재도전을 누르세요.</p>`,
      );
      document.querySelectorAll("[data-mode]").forEach(
        (b) =>
          (b.onclick = () => {
            game.abyssUnlocked = end.unlocked;
            if (game.setMode(b.dataset.mode)) {
              document.querySelector("#mode-button").textContent =
                game.mode === "abyss"
                  ? "무한 심연 · 11층 출발"
                  : "일반 모드 · 1–10층";
              closeModal();
              notify("탐험 모드를 선택했습니다.");
              if (["over", "won"].includes(game._state.phase)) {
                game._state.phase = "menu";
                game.emit();
              }
            }
          }),
      );
    },
    records() {
      const end = readEndgame(),
        best = end.bestRun;
      openModal(
        "abyss-records",
        `<div class="modal-eyebrow">THIS BROWSER ONLY / NO ONLINE RANKING</div><h2 id="modal-title">심연 기록과 업적</h2><p class="modal-description">이 브라우저에 저장된 개인 기록입니다. 온라인 순위표가 아닙니다. 장비·임시 강화는 기록으로만 보관됩니다.</p><div class="gear-slots"><div>최고 층<strong>${end.bestFloor || "—"}</strong></div><div>최고 처치<strong>${end.bestKills}</strong></div><div>최고 총 획득 골드<strong>${formatGold(end.bestGold)}</strong></div><div>최고 생존 시간<strong>${Math.floor(end.bestTime)}초</strong></div></div><div class="achievement-list">${[
          [end.unlocked, "왕좌의 정복자"],
          [end.bestFloor >= 15, "재앙과의 조우"],
          [end.bestFloor >= 25, "심연의 탐험가"],
          [end.bestFloor >= 50, "끝없는 추락"],
        ]
          .map(
            ([on, name]) =>
              `<span class="${on ? "earned" : ""}">${on ? "✓" : "🔒"} ${name}</span>`,
          )
          .join("")}</div>${
          best
            ? `<h3>최고 층 빌드 · ${esc(CHARACTERS.find(c => c.id === best.character)?.name || best.character)} / ${esc(WEAPONS.find(w => w.id === best.weapon)?.name || best.weapon)}</h3><p>검 ${esc(best.build.sword || "기본")} · 마법 ${esc(
                Object.entries(best.build.spells)
                  .map(([id, n]) => `${SPELLS.find(s => s.id === id)?.name || id} ${n}`)
                  .join(" · "),
              )} · 유물 ${best.build.relics.length}개</p><div class="gear-grid">${best.build.equipment.map((i) => itemMarkup(i)).join("")}</div>`
            : "<p>심연 런을 종료하면 최종 빌드가 기록됩니다.</p>"
        }`,
      );
    },
    update(state) {
      const parry = state.parry || {},
        npc = state.exploration?.npc;
      const guard = document.querySelector("#guard-button");
      if (guard) {
        guard.textContent =
          parry.counterTime > 0
            ? `광역 반격 ${parry.counterTime.toFixed(1)}초`
            : parry.cooldown > 0
              ? `패링 ${parry.cooldown.toFixed(1)}초`
              : `패링 · ${keyLabel(game.bindings.parry)}`;
        guard.style.setProperty('--parry-ready',String(parry.counterTime>0 ? 1 : Math.max(0,1-(parry.cooldown||0)/(parry.maxCooldown||4))));
        guard.classList.toggle('counter-ready',parry.counterTime>0);
        guard.title=keyLabel(game.bindings.parry)+' 물리 키 · 한글 입력 상태에서도 사용 가능 · 전방 120° · 첫 0.16초 완벽한 패링 · 청색 직선/일반 탄환 가능 · 지면 공격 방어 불가';
        guard.setAttribute('aria-label',parry.counterTime>0 ? `광역 반격 가능 ${parry.counterTime.toFixed(1)}초. 다음 직접 검 공격에 발동` : `패링 ${keyLabel(game.bindings.parry)}. ${parry.cooldown>0 ? '재사용 '+parry.cooldown.toFixed(1)+'초' : '사용 가능'}`);
        guard.disabled =
          (state.phase !== "playing" && !(state.phase==='camp'&&state.camp?.practice&&!game.camp.suspended)) ||
          (parry.cooldown > 0 && !parry.counterTime);
      }
      const interact = document.querySelector("#interact-npc");
      if (interact) {
        interact.classList.toggle("hidden", !npc || npc.used);
        interact.disabled =
          !npc || state.phase !== "playing" || npc.distance > 3.2;
        interact.textContent = npc
          ? `${npc.name} · ${npc.distance <= 3.2 ? `교류 ${keyLabel(game.bindings.interact)}` : `${npc.distance.toFixed(0)}m`}`
          : `교류 ${keyLabel(game.bindings.interact)}`;
      }
      const phase = document.querySelector("#boss-combat-phase");
      if (phase)
        phase.textContent = state.boss?.alive
          ? `${state.boss.combatPhase || 1} / 3페이즈`
          : "";
      const rule = document.querySelector("#abyss-rule");
      if (rule) {
        rule.classList.toggle("hidden", state.mode !== "abyss");
        rule.textContent =
          state.mode === "abyss"
            ? `심연 ${state.stage}층 · ${state.abyssConstraint?.title || "심연 탐사"}`
            : "";
        rule.title =
          state.abyssConstraint?.description ||
          "5층마다 재앙 보스 · 10층마다 제약 교대";
      }
    },
  };
  return ui;
}
