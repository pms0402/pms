import {text,attr,style,toggle} from './dom-update.js';
import { SPELLS } from "./balance.js";
import {
  CONTROL_NAMES,
  keyLabel,
  rebind,
  controlKey,
  DEFAULT_BINDINGS,
} from "./control-bindings.js";
export function createActionUi({
  game,
  openModal,
  forceCloseModal,
  notify,
  prefs,
  save,
  icon,
  showBuild,
}) {
  const $ = (s) => document.querySelector(s);
  let stopCapture = () => {};
  const spellName = (id) => SPELLS.find((s) => s.id === id)?.name || "빈 슬롯";
  function finishSwap(index) {
    if (!game.chooseSkillReplacement(index)) return;
    forceCloseModal();
    $("#game-canvas").focus({ preventScroll: true });
  }
  function replacement() {
    const id = game.pendingSkill,
      slots = game.actions.syncSlots();
    openModal(
      "skill-swap",
      `<div class="modal-eyebrow">MANUAL SKILL LOADOUT</div><h2 id="modal-title">${spellName(id)} 배치</h2><p class="modal-description">스킬은 배웠습니다. 교체해도 기존 스킬의 단계·진화·조합 조건과 재사용 시간은 유지됩니다.</p><div class="skill-replacements">${slots.map((s, i) => `<button class="secondary-button" data-skill-swap="${i}">${i + 1} · ${spellName(s)} → ${spellName(id)}</button>`).join("")}<button class="secondary-button" data-skill-swap="-1">보관하기 · 지금 배치 유지</button></div>`,
      { pause: false, closeable: false },
    );
    document
      .querySelectorAll("[data-skill-swap]")
      .forEach((b) => (b.onclick = () => finishSwap(+b.dataset.skillSwap)));
  }
  function loadout() {
    const slots = game.actions.syncSlots(),
      known = SPELLS.filter((s) => game.magic.rank(s.id));
    openModal(
      "skills",
      `<div class="modal-eyebrow">THREE SKILLS / ONE ULTIMATE</div><h2 id="modal-title">직접 사용할 기술</h2><p class="modal-description">배운 마법 중 3개를 배치합니다. 기술별 재사용 시간은 교체해도 유지됩니다. 궁극기는 배치한 속성으로 강화됩니다.</p>${slots.map((id, i) => `<label class="skill-equip-row"><strong>${keyLabel(game.bindings["skill" + i])} · 스킬 ${i + 1}</strong><select data-skill-equip="${i}" aria-label="스킬 ${i + 1} 배치">${!id ? '<option value="" disabled selected>미배치</option>' : ""}${known.map((s) => `<option value="${s.id}" ${s.id === id ? "selected" : ""}>${s.name} · ${game.magic.rank(s.id)}단계 ${game.magic.evolved(s.id) ? "진화" : ""}</option>`).join("")}</select></label>`).join("")}${known.map((s) => `<article class="manual-skill-description"><h3>${spellName(s.id)} · ${game.magic.evolved(s.id) ? s.evolutionName : game.magic.rank(s.id) + "단계"}</h3><p>${s.description}</p><small>현재 재사용 ${game.magic.maxCooldown(s.id).toFixed(1)}초 · ${s.id === "lightning" ? "전방 22m" : "실제 반경 " + game.magic.radius(s.id).toFixed(1) + "m"}</small></article>`).join("")}<div class="ultimate-detail"><h3>${keyLabel(game.bindings.ultimate)} · 공허 붕괴</h3><p>재사용 45초 · ${game.magic.radius("ultimate").toFixed(1)}m. 조준 위치에 강력한 광역 피해. 장착한 화염/서리 속성을 반영합니다. 시전 중 이동 15% · 대시/피격으로 취소하면 재사용 시간은 유지됩니다.</p></div><button class="secondary-button" id="skill-build-details">조합 조건 · 유물 · 도감 보기</button>`,
    );
    $("#skill-build-details").onclick = showBuild;
    document.querySelectorAll("[data-skill-equip]").forEach(
      (e) =>
        (e.onchange = () => {
          if (!game.actions.equip(+e.dataset.skillEquip, e.value))
            notify("배치를 바꿀 수 없습니다");
          else loadout();
        }),
    );
  }
  function settings() {
    stopCapture();
    const root = $("#modal");
    root.insertAdjacentHTML(
      "beforeend",
      `<section class="control-settings"><h3>키 설정</h3><p>버튼을 누른 뒤 키 또는 마우스 버튼을 입력하세요. 중복 배치는 막습니다. ESC는 입력 취소입니다.</p><div class="binding-grid">${Object.entries(
        CONTROL_NAMES,
      )
        .map(
          ([id, name]) =>
            `<button data-bind="${id}" class="binding-button"><span>${name}</span><kbd>${keyLabel(game.bindings[id])}</kbd></button>`,
        )
        .join(
          "",
        )}</div><p id="binding-status" role="status"></p><button class="secondary-button" id="bindings-reset">기본 조작으로 복원</button><h3>모바일 버튼 크기·위치</h3>${[
        ["touchScale", "크기", 0.8, 1.15, 0.05, 1],
        ["touchX", "오른쪽 여백", 0, 40, 2, 0],
        ["touchY", "위로 이동", 0, 60, 2, 0],
      ]
        .map(
          ([id, name, min, max, step, def]) =>
            `<label class="touch-setting">${name}<input data-touch-setting="${id}" aria-label="모바일 ${name}" type="range" min="${min}" max="${max}" step="${step}" value="${Math.max(min, Math.min(max, Number(prefs[id]) || def))}"></label>`,
        )
        .join("")}</section>`,
    );
    const persist = () => {
      prefs.bindings = { ...game.bindings };
      save();
    };
    root.querySelectorAll("[data-bind]").forEach(
      (button) =>
        (button.onclick = () => {
          stopCapture();
          game.rebinding = true;
          $("#binding-status").textContent =
            CONTROL_NAMES[button.dataset.bind] + " · 새 키를 입력하세요";
          const capture = (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (event.key === "Escape") {
              stopCapture();
              $("#binding-status").textContent = "키 입력 취소";
              return;
            }
            const result = rebind(
              game.bindings,
              button.dataset.bind,
              controlKey(event),
            );
            if (!result.ok) {
              $("#binding-status").textContent = result.reason;
              return;
            }
            game.setBindings(result.bindings);
            persist();
            button.querySelector("kbd").textContent = keyLabel(
              game.bindings[button.dataset.bind],
            );
            stopCapture();
            $("#binding-status").textContent = "저장되었습니다";
          };
          stopCapture = () => {
            game.rebinding = false;
            document.removeEventListener("keydown", capture, true);
            document.removeEventListener("pointerdown", capture, true);
          };
          document.addEventListener("keydown", capture, true);
          document.addEventListener("pointerdown", capture, true);
        }),
    );
    $("#bindings-reset").onclick = () => {
      stopCapture();
      game.setBindings(DEFAULT_BINDINGS);
      persist();
      root
        .querySelectorAll("[data-bind]")
        .forEach(
          (b) =>
            (b.querySelector("kbd").textContent = keyLabel(
              game.bindings[b.dataset.bind],
            )),
        );
      $("#binding-status").textContent = "기본 조작 복원";
    };
    root.querySelectorAll("[data-touch-setting]").forEach(
      (input) =>
        (input.oninput = () => {
          prefs[input.dataset.touchSetting] = Number(input.value);
          save();
          touchLayout();
        }),
    );
  }
  function touchLayout() {
    const root = $("#arena");
    root.style.setProperty(
      "--touch-scale",
      Math.max(0.8, Math.min(1.15, prefs.touchScale || 1)),
    );
    root.style.setProperty(
      "--touch-x",
      Math.max(0, Math.min(40, prefs.touchX || 0)) + "px",
    );
    root.style.setProperty(
      "--touch-y",
      Math.max(0, Math.min(60, prefs.touchY || 0)) + "px",
    );
  }
  const slots=[...document.querySelectorAll('[data-action-slot]')].map(button=>({button,index:+button.dataset.actionSlot,icon:button.querySelector('.spell-slot-icon'),rank:button.querySelector('.spell-slot-rank'),key:button.querySelector('kbd'),iconId:null}));
  const hudNodes=new Map();
  const node=selector=>{let n=hudNodes.get(selector);if(!n){n=$(selector);hudNodes.set(selector,n);}return n;};
  function update(state) {
    const a=state.action;if(!a)return;
    const all=state.spellState||game.magic.getState();
    for(const slot of slots){
      const {button,index:i}=slot,id=i===3?'ultimate':a.slots[i],spell=all.find(s=>s.id===id),cd=i===3?a.ultimateCooldown:spell?.cooldown||0,max=i===3?45:spell?.maxCooldown||1,ready=!!id&&cd<=0;
      attr(button,'data-spell',id||'');toggle(button,'locked',!id);toggle(button,'skill-ready',ready);toggle(button,'on-cooldown',cd>0);
      style(button,'--spell',i===3?'#e0c17c':spell?.color||'#66746d');style(button,'--cooldown',Math.max(0,Math.min(1,cd/max)));
      const iconId=i===3?'bolt':SPELLS.find(s=>s.id===id)?.icon||'plus';
      if(slot.iconId!==iconId){slot.icon.innerHTML=icon(iconId);slot.iconId=iconId;}
      text(slot.rank,cd>0?cd.toFixed(1)+'s':i===3?'궁극기':spell?.rank?spell.evolved?'진화':'LV.'+spell.rank:'빈 슬롯');
      text(slot.key,keyLabel(game.bindings[i===3?'ultimate':'skill'+i]));
      const label=(i===3?'공허 붕괴':spellName(id))+' · '+(ready?'사용 가능':cd>0?cd.toFixed(1)+'초':'미배치');attr(button,'aria-label',label);attr(button,'title',label);
    }
    text(node('#dash-indicator kbd'),keyLabel(game.bindings.dash));
    text(node('#manual-combo'),a.phase==='charging'?'차징 '+Math.round(a.charge*100)+'%':`${keyLabel(game.bindings.light)} · ${a.combo||0}/${a.comboMax}연계`);
    text(node('#manual-heavy'),a.heavyCooldown>0?`강공격 ${a.heavyCooldown.toFixed(1)}s`:`${keyLabel(game.bindings.heavy)} · 강공격`);
    text(node('#mobile-heavy'),a.phase==='charging'?Math.round(a.charge*100)+'%':a.heavyCooldown>0?a.heavyCooldown.toFixed(1):'강공격');
    text(node('#mobile-parry'),state.parry?.counterReady?'반격':state.parry?.cooldown>0?state.parry.cooldown.toFixed(1):'패링');
    const guard=node('#guard-button'),label=state.parry?.counterReady?'반격 · '+keyLabel(game.bindings.light):state.parry?.cooldown>0?'패링 '+state.parry.cooldown.toFixed(1)+'s':'패링 · '+keyLabel(game.bindings.parry);
    text(guard,label);attr(guard,'title',keyLabel(game.bindings.parry)+' · 전방 120° · 첫 0.16초 완벽한 패링 · 성공 후 직접 공격으로 반격 · 붉은 지면 공격 방어 불가');attr(guard,'aria-label',label);
    text(node('#equipment-button'),'장비 · '+keyLabel(game.bindings.inventory));
  }
  function bind() {
    document.querySelectorAll("[data-action-slot]").forEach((b) =>
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        game.actions.press(
          +b.dataset.actionSlot === 3
            ? "ultimate"
            : "skill" + b.dataset.actionSlot,
        );
      }),
    );
    $("#mobile-light").addEventListener("pointerdown", (e) => {
      e.preventDefault();
      game.actions.press("light");
    });
    const heavy = $("#mobile-heavy");
    heavy.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      heavy.setPointerCapture(e.pointerId);
      game.actions.press("heavy");
    });
    heavy.addEventListener("pointerup", (e) => {
      e.preventDefault();
      game.actions.releaseHeavy();
    });
    heavy.addEventListener("pointercancel", () => game.actions.clearInput());
    heavy.addEventListener("lostpointercapture", (event) => {
      if (event.buttons > 0) game.actions.clearInput();
    });
    $("#mobile-parry").addEventListener("pointerdown", (e) => {
      e.preventDefault();
      game.actions.cancel();
      game.parry.press();
    });
    touchLayout();
  }
  function joystick(data) {
    const root = $("#virtual-stick");
    root.classList.toggle("hidden", !data);
    if (data) {
      root.style.left = data.x + "px";
      root.style.top = data.y + "px";
      const d = Math.max(1, Math.hypot(data.dx, data.dy) / 32);
      root.firstElementChild.style.transform = `translate(${data.dx / d}px,${data.dy / d}px)`;
    }
  }
  return {
    bind,
    update,
    settings,
    loadout,
    replacement,
    joystick,
    stopCapture,
  };
}
