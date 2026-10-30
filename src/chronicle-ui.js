import {text,disabled} from './dom-update.js';
import {keyLabel} from './control-bindings.js';
import { DAMAGE_SOURCES } from "./analytics.js";
import { CHARACTERS, WEAPONS } from "./progression.js";
import { SPELLS, formatGold } from "./balance.js";
import { RECORDS, ENDINGS } from "./story.js";
import { SETS } from "./sets.js";
import { CAMP_FACILITIES } from "./camp.js";
import { RISK_PACTS } from "./content.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const n = (v) =>
  Number(v || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
const clock = (v) =>
  `${Math.floor((v || 0) / 60)}:${String(Math.floor((v || 0) % 60)).padStart(2, "0")}`;
const job = (id) =>
  CHARACTERS.find((c) => c.id === id)?.name || id || "기록 없음";
const weapon = (id) =>
  WEAPONS.find((w) => w.id === id)?.name || id || "기록 없음";
const colors = [
  "#c1ff66",
  "#ffac61",
  "#80e6f8",
  "#e6ccff",
  "#a8ffc3",
  "#ffd57c",
  "#dfb7ed",
  "#c4eaff",
  "#78cfbd",
  "#c6acff",
  "#cdb084",
  "#98aa9c",
];
export function analyticsMarkup(a, { damage = true } = {}) {
  if (!a)
    return '<p class="archive-note">이전 버전 기록입니다. 생존 시간·처치·골드는 유지되며 상세 분석은 새 런부터 수집합니다.</p>';
  const entries = Object.entries(a.damage || {})
      .filter(([, v]) => v > 0)
      .sort((x, y) => y[1] - x[1]),
    total = entries.reduce((sum, [, v]) => sum + v, 0);
  const metric = (title, v) =>
    `<div><span>${title}</span><strong>${v}</strong></div>`;
  const bins = a.dps || [],
    max = Math.max(1, ...bins.map((b) => b.dps)),
    width = 560,
    height = 96,
    points = bins
      .map(
        (b, i) =>
          `${(i / Math.max(1, bins.length - 1)) * width},${height - (b.dps / max) * (height - 6)}`,
      )
      .join(" ");
  const floors = a.floors || [],
    maxKills = Math.max(1, ...floors.map((f) => f.kills)),
    maxHurt = Math.max(1, ...floors.map((f) => f.taken));
  return `<section class="analytics-detail" data-analytics><h3>전투와 최종 빌드</h3><p class="archive-note">${esc(job(a.character))} · ${esc(weapon(a.weapon))} · ${a.mode === "abyss" ? "무한 심연" : "일반"} ${a.stage}층 · ${clock(a.time)}</p><div class="analytics-metrics">${metric("실제 가한 피해", formatGold(total))}${metric("초과 피해 · 합계 제외", formatGold(a.overkill))}${metric("받은 피해", formatGold(a.received))}${metric("실제 회복", formatGold(a.healed))}${metric("일반 / 정예 / 보스", `${a.kills?.normal || 0} / ${a.kills?.elite || 0} / ${a.kills?.boss || 0}`)}${metric("대시 / 패링 성공·시도", `${a.dashes || 0} / ${a.parrySuccesses || 0}·${a.parryAttempts || 0}`)}${metric("패링 성공률", `${n((a.parrySuccessRate??((a.parrySuccesses||0)/Math.max(1,a.parryAttempts||0)))*100)}%`)}${metric("방어한 피해", formatGold(a.parryBlocked))}${metric("반격 실제 피해", formatGold(a.damage?.counter))}${metric("보스 경직", `${a.parryBossStuns||0}회`)}${metric("총 획득 / 회수 골드", `${formatGold(a.gold)} / ${formatGold(a.netGold)}`)}${metric("획득 장비", `${a.gearCount || 0}개`)}</div>${damage ? `<div class="report-damage">${entries.map(([id, v]) => `<div class="damage-row" data-analytics-source="${esc(id)}"><div><span>${esc(DAMAGE_SOURCES[id] || id)}</span><strong>${formatGold(v)} <small>${n((v / Math.max(1, total)) * 100)}%</small></strong></div><div class="damage-track"><i style="width:${(v / Math.max(1, total)) * 100}%;--damage-color:${colors[Object.keys(DAMAGE_SOURCES).indexOf(id)] || colors[0]}"></i></div></div>`).join("") || "<p>기록된 피해가 없습니다.</p>"}</div>` : ""}<div class="analysis-chart" data-dps-chart><h4>시간에 따른 DPS <small>구간 ${a.binSeconds}초 · 최고 ${formatGold(max)}</small></h4>${bins.length ? `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="시간별 초당 피해 변화. 최고 ${n(max)}"><path d="M0 ${height}H${width}"/><polyline points="${points}"/></svg><div class="chart-axis"><span>0:00</span><span>${clock(a.time)}</span></div>` : "<p>전투 후 그래프가 표시됩니다.</p>"}</div><details class="floor-analysis" open><summary>층별 처치와 받은 피해</summary><div class="floor-chart" data-floor-chart>${floors.map((f) => `<div><b>${f.stage}층</b><span class="floor-bars"><i style="width:${(f.kills / maxKills) * 100}%" title="처치 ${f.kills}"></i><i style="width:${(f.taken / maxHurt) * 100}%" title="받은 피해 ${n(f.taken)}"></i></span><small>${f.kills}처치 / ${formatGold(f.taken)}피해</small></div>`).join("") || "<p>층 기록이 없습니다.</p>"}</div><p class="archive-note">초록: 처치 · 분홍: 받은 피해 · 각 항목의 최고 층을 기준으로 표시</p></details><details class="final-build"><summary>최종 능력치 · 장착 장비 · 획득 목록</summary><div class="analytics-metrics">${Object.entries(
    {
      damage: "검 피해",
      spellDamage: "마법 피해",
      maxHp: "최대 체력",
      attackRate: "검 속도",
      spellRate: "마법 속도",
      critChance: "치명타",
      armor: "피해 감소",
      speed: "이동 속도",
    },
  )
    .map(([id, title]) =>
      metric(
        title,
        ["critChance", "armor"].includes(id)
          ? `${n((a.finalStats?.[id] || 0) * 100)}%`
          : formatGold(a.finalStats?.[id]),
      ),
    )
    .join(
      "",
    )}</div><p>검 진화: ${esc({ broadsword: "거인의 대검", twinblade: "질풍의 쌍검", wave: "공허의 검기" }[a.build?.sword] || "기본 검술")}</p><p>${
    Object.entries(a.build?.spells || {})
      .filter(([, v]) => v > 0)
      .map(
        ([id, v]) =>
          `${esc(SPELLS.find((s) => s.id === id)?.name || id)} ${a.build?.evolutions?.[id] ? "진화" : v}`,
      )
      .join(" · ") || "마법 없음"
  } · 유물 ${a.build?.relics?.length || 0}개</p><p>장착: ${(a.build?.equipment || []).map((i) => `${esc(i.title)}${i.setId ? ` [${esc(SETS.find((s) => s.id === i.setId)?.name || "")}]` : ""}`).join(" · ") || "없음"}</p><p>획득한 장비${a.gearCount > 32 ? " · 최근 32개" : ""}: ${(a.gear || []).map((i) => esc(i.title)).join(" · ") || "없음"}</p></details></section>`;
}
export function setsMarkup(sets = []) {
  return `<section class="set-codex"><h3>장비 세트 · 장착 기준</h3>${SETS.map(
    (s) => {
      const count = sets.find((x) => x.id === s.id)?.count || 0;
      return `<article style="--set:${s.color}" data-set-codex="${s.id}"><div><strong>${s.name}</strong><b>${count}/4</b></div><p class="${count >= 2 ? "set-on" : ""}">2개 · ${s.two}</p><p class="${count >= 4 ? "set-on" : ""}">4개 · ${s.four}</p></article>`;
    },
  ).join(
    "",
  )}<p class="archive-note">장비 기본 배율·유물과 곱한 뒤 세트 피해 배율을 적용합니다. 추가 공격은 세트·장비·숨겨진 조합을 다시 발동하지 않습니다. 교체 시 즉시 다시 계산하며 최대 체력 증가는 현재 체력을 회복하지 않습니다.</p></section>`;
}
export function createChronicleUi({
  game,
  openModal,
  forceClose,
  closeModal,
  notify,
  showGuide,
  showBuild,
  showLoadout,
  showTree,
  startRun,
  readHistory,
  setRisk,
}) {
  const $ = (s) => document.querySelector(s);
  const ui = {
    enterCamp() {
      forceClose();
      if (game.camp.enter()) $("#game-canvas").focus({ preventScroll: true });
    },
    facility(id) {
      if (!game.camp.active) return;
      game.keys.clear();
      game.touchMove = { x: 0, y: 0 };
      if (id === "laboratory") return showBuild();
      if (id === "altar") return showTree();
      if (id === "archive") return ui.archive();
      const f = CAMP_FACILITIES.find((f) => f.id === id);
      let body = "";
      if (id === "smith")
        body = `<p class="modal-description">이번 런의 시작 검을 선택합니다. 영구 골드로 한 번 해금하면 다음 런에도 선택할 수 있습니다.</p><div class="npc-choices">${WEAPONS.map((w) => `<article class="npc-choice"><strong>${w.name}</strong><p>${w.description}</p><small>${w.cost ? `${w.cost} G 해금` : "기본 무기"}</small></article>`).join("")}</div><button class="primary-button" id="facility-loadout">시작 무기 선택 · 해금</button><button class="secondary-button" id="facility-guide">장비·세트 설명</button>`;
      if (id === "training")
        body =
          '<p class="modal-description">직업의 강점과 약점을 비교하고 해금하세요. 패링 연습에서는 체력을 잃지 않고 런 통계도 수집하지 않습니다.</p><button class="primary-button" id="facility-loadout">직업 선택 · 영구 해금</button><button class="secondary-button" id="training-open">실전 전투 훈련 선택</button><button class="secondary-button" id="practice-start">패링 연습 시작</button><button class="secondary-button" id="facility-guide">기본 조작·전투 가이드</button>';
      if (id === "gate")
        body = `<p class="modal-description">장비와 임시 강화는 새로 시작합니다. 야영지에서 구매한 영구 강화와 선택 직업·무기가 적용됩니다.</p><div class="npc-choices"><button class="npc-choice ${game.mode === "normal" ? "selected" : ""}" data-gate-mode="normal"><strong>일반 · 1–10층 ${game.mode === "normal" ? "✓" : ""}</strong><p>지역 분기를 골라 종말의 왕좌로 향합니다.</p></button><button class="npc-choice ${game.mode === "abyss" ? "selected" : ""}" data-gate-mode="abyss" ${game.abyssUnlocked ? "" : "disabled"}><strong>무한 심연 · 11층부터 ${game.mode === "abyss" ? "✓" : ""}</strong><p>${game.abyssUnlocked ? "왕좌 이후의 끝없는 도전. 출발 보정과 교대 제약." : "일반 10층 클리어 후 해금"}</p></button></div><h3>위험 계약</h3><div class="npc-choices">${RISK_PACTS.map((p) => `<button class="npc-choice ${game.selectedRisk === p.id ? "selected" : ""}" data-gate-risk="${p.id}"><strong>${p.name} ${game.selectedRisk === p.id ? "✓" : ""}</strong><p>${p.description}</p></button>`).join("")}</div><button class="primary-button" id="gate-start">${game.mode === "abyss" ? "심연" : "일반"} 탐험 시작</button>`;
      openModal(
        "facility",
        `<div class="modal-eyebrow">SANCTUARY CAMP / ${id.toUpperCase()}</div><h2 id="modal-title">${f.name}</h2>${body}`,
      );
      $("#facility-loadout")?.addEventListener("click", showLoadout);
      $("#facility-guide")?.addEventListener(
        "click",
        id === "smith" ? ui.setGuide : showGuide,
      );
      $("#training-open")?.addEventListener("click",()=>game.callbacks.onTrainingMenu?.());
      $("#practice-start")?.addEventListener("click", () => {
        closeModal();
        game.camp.train();
        game.emit();
      });
      $("#gate-start")?.addEventListener("click", startRun);
      document.querySelectorAll("[data-gate-mode]").forEach(
        (b) =>
          (b.onclick = () => {
            if (game.setMode(b.dataset.gateMode)) ui.facility("gate");
          }),
      );
      document.querySelectorAll("[data-gate-risk]").forEach(
        (b) =>
          (b.onclick = () => {
            setRisk(b.dataset.gateRisk);
            ui.facility("gate");
          }),
      );
    },
    archive() {
      openModal(
        "archive",
        `<div class="modal-eyebrow">SANCTUARY ARCHIVE</div><h2 id="modal-title">세계의 흔적을 모으는 곳.</h2><p class="modal-description">발견한 기록과 결말은 이 브라우저에 남습니다. 이야기를 읽지 않고도 탐험을 계속할 수 있습니다.</p><div class="npc-choices"><button class="npc-choice" id="archive-guide"><strong>몬스터 · 지역 · 마법 도감</strong><p>기존 수호자, 변이, 숨겨진 조합 조건</p></button><button class="npc-choice" id="archive-story"><strong>이야기 · 히든 보스 · 엔딩</strong><p>발견 기록과 조건, 열람·다시 보기</p></button><button class="npc-choice" id="archive-history"><strong>런 통계 · 빌드 분석</strong><p>최근 30개 런, 직업·모드 비교</p></button><button class="npc-choice" id="archive-sets"><strong>세트 장비 도감</strong><p>다섯 세트의 2개·4개 효과</p></button></div>`,
      );
      $("#archive-guide").onclick = showGuide;
      $("#archive-story").onclick = ui.story;
      $("#archive-history").onclick = () => ui.history();
      $("#archive-sets").onclick = ui.setGuide;
    },
    setGuide() {
      openModal(
        "sets",
        `<div class="modal-eyebrow">EQUIPMENT SETS</div><h2 id="modal-title">네 조각으로 완성하는 빌드.</h2>${setsMarkup(game.equipment.bonuses().sets)}`,
      );
    },
    story() {
      const p = game.story.state(),
        canChoose = ["menu", "over", "won", "camp"].includes(game._state.phase);
      openModal(
        "story",
        `<div class="modal-eyebrow">RECORDS / ${p.records.length} OF ${RECORDS.length}</div><h2 id="modal-title">갈라진 세계의 기억.</h2><p class="modal-description">고대 성역이 무너진 뒤 세계는 여러 지역으로 갈라졌습니다. 기록은 비밀 방, NPC, 지역 보스와 심연의 탐험에서 발견합니다.</p><div class="story-records">${RECORDS.map((r) => `<details data-story-record="${r.id}" ${p.records.includes(r.id) ? "" : 'class="undiscovered"'}><summary>${p.records.includes(r.id) ? r.title : "미발견 기록"}</summary><p>${p.records.includes(r.id) ? r.text : "세계 탐험을 계속해 이 기록을 발견하세요."}</p></details>`).join("")}</div><h3>선택형 히든 보스</h3><div class="npc-choices">${p.bosses.map((b) => `<article class="npc-choice" data-hidden-condition="${b.id}"><strong>${b.name} · ${b.defeated ? "처치 기록" : b.unlocked ? "도전 가능" : "미해금"}</strong><p>${b.condition}</p><small>${b.hint}</small></article>`).join("")}</div><p class="archive-note">조건을 달성한 뒤 전장의 균열에서 보스 전용 공간을 선택합니다. 일반 층의 보스와는 별개입니다.</p><h3>세계의 결말 · 선택 후에도 탐험 가능</h3><div class="npc-choices">${p.endingChoices.map((e) => `<article class="npc-choice"><strong>${e.name} ${e.seen ? "· 열람 완료" : ""}</strong><p>${e.condition}</p><button class="secondary-button" data-ending="${e.id}" ${e.unlocked && canChoose ? "" : "disabled"}>${e.seen ? "다시 보기" : e.unlocked ? "선택 · " + e.choice : "조건 미달"}</button></article>`).join("")}</div>${canChoose ? "" : '<p class="archive-note">현재 런을 마친 뒤 야영지나 결과 화면에서 결말을 선택하세요.</p>'}`,
      );
      document
        .querySelectorAll("[data-ending]")
        .forEach((b) => (b.onclick = () => ui.ending(b.dataset.ending)));
    },
    ending(id) {
      if (!game.story.chooseEnding(id)) return;
      const e = ENDINGS.find((e) => e.id === id);
      openModal(
        "ending",
        `<div class="modal-eyebrow">VOIDRUN / ${id === "origin" ? "TRUE ENDING" : "ENDING"}</div><h2 id="modal-title">${e.name}</h2><p class="ending-story">${e.text}</p><p class="archive-note">선택과 기록이 저장되었습니다. 야영지와 다음 런은 계속 이용할 수 있습니다.</p><button class="primary-button" id="ending-back">기록관으로 · 이야기 건너뛰기</button>`,
      );
      $("#ending-back").onclick = ui.story;
    },
    history(mode = "all", character = "all") {
      const all = readHistory().slice(0, 30),
        rows = all.filter(
          (r) =>
            (mode === "all" || (r.mode || "normal") === mode) &&
            (character === "all" || r.analytics?.character === character),
        ),
        best = rows.length ? Math.max(...rows.map((r) => r.stage || 1)) : 0;
      const jobRows = CHARACTERS.map((c) => {
        const r = rows.filter((x) => x.analytics?.character === c.id);
        return { c, r };
      }).filter((x) => x.r.length);
      openModal(
        "history",
        `<div class="modal-eyebrow">LAST 30 RUNS / BUILD ANALYSIS</div><h2 id="modal-title">선택이 남긴 전투 기록.</h2><div class="analysis-filters"><label>탐험 모드<select id="history-mode"><option value="all">전체 모드</option><option value="normal">일반</option><option value="abyss">무한 심연</option></select></label><label>직업<select id="history-job"><option value="all">전체 직업</option>${CHARACTERS.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select></label></div><div class="analytics-metrics"><div><span>필터 내 최고 층</span><strong>${best || "—"}</strong></div><div><span>최고 처치 / 골드</span><strong>${Math.max(0, ...rows.map((r) => r.kills || 0))} / ${formatGold(Math.max(0, ...rows.map((r) => r.gold || 0)))}</strong></div></div>${jobRows.length ? `<div class="job-comparison"><h3>직업별 비교 · 현재 필터</h3>${jobRows.map(({ c, r }) => `<p><b>${c.name}</b><span>${r.length}런 · 최고 ${Math.max(...r.map((x) => x.stage))}층 · 평균 실제 DPS ${formatGold(r.reduce((sum, x) => sum + Object.values(x.analytics.damage || {}).reduce((s, v) => s + v, 0) / Math.max(1, x.elapsed), 0) / r.length)}</span></p>`).join("")}</div>` : ""}<div class="history-table">${rows.length ? rows.map((r) => `<details class="history-detail history-row"><summary><span>${r.won ? "완주" : r.stage + "층"} · ${(r.mode || "normal") === "abyss" ? "심연" : "일반"} · ${esc(job(r.analytics?.character))}</span><small>${esc(r.date)} · ${clock(r.elapsed)} · ${r.kills}처치 · ${formatGold(r.gold)} G</small></summary>${analyticsMarkup(r.analytics)}</details>`).join("") : '<p class="archive-note empty-history">해당하는 기록이 없습니다. 런을 종료하면 통계가 저장됩니다.</p><button class="primary-button" id="history-start">첫 런 시작하기</button>'}</div><p class="archive-note">현재 브라우저의 최근 30런. 직업 평균은 실제 총 피해 / 플레이 시간이며, 서로 다른 성장 단계와 층의 기록이 포함됩니다. 심연의 상세 층 통계는 최근 200층, DPS는 최대 180구간으로 제한합니다.</p>`,
      );
      $("#history-start")?.addEventListener("click", startRun);
      $("#history-mode").value = mode;
      $("#history-job").value = character;
      $("#history-mode").onchange = () =>
        ui.history($("#history-mode").value, $("#history-job").value);
      $("#history-job").onchange = () =>
        ui.history($("#history-mode").value, $("#history-job").value);
    },
    portal(choices) {
      openModal(
        "portal",
        `<div class="modal-eyebrow">HIDDEN PASSAGE</div><h2 id="modal-title">균열 너머로 향할까요?</h2><p class="modal-description">원래 층의 시간과 적·보스·탄환 상태가 보존됩니다. 방 안의 아래쪽 황금 문에서 ${keyLabel(game.bindings.interact)} / 복귀. 보상 없이도 언제든 돌아올 수 있습니다.</p><div class="npc-choices">${choices.map((c) => `<button class="npc-choice" data-portal-choice="${c.id}"><strong>${c.title}</strong><p>${c.description}</p></button>`).join("")}</div><p id="portal-feedback" role="status"></p><button class="secondary-button" data-portal-choice="skip">원래 전투 계속</button>`,
        { pause: false, closeable: false },
      );
      document.querySelectorAll("[data-portal-choice]").forEach(
        (b) =>
          (b.onclick = () => {
            if (game.sideAreas.choose(b.dataset.portalChoice)) forceClose();
            else
              $("#portal-feedback").textContent =
                "주변 적과 탄막을 정리한 뒤 입장하세요. 시도는 소비되지 않습니다.";
          }),
      );
    },
    curseRoom() {
      openModal(
        "room-choice",
        `<div class="modal-eyebrow">A CURSE FOR A REWARD</div><h2 id="modal-title">좁은 방의 저주를 받겠습니까?</h2><p class="modal-description">정예 3마리와 전투합니다. 적 체력·피해가 정예 기본값에서 추가로 ×1.3. 모두 처치하면 영웅 이상 장비 선택과 기본 처치 골드 35배를 받습니다. 진행 중 언제든 황금 문으로 복귀할 수 있습니다.</p><button class="primary-button" data-room-curse="yes">저주 수락 · 정예와 전투</button><button class="secondary-button" data-room-curse="no">포기하고 안전하게 나가기</button>`,
        { pause: false, closeable: false },
      );
      document.querySelectorAll("[data-room-curse]").forEach(
        (b) =>
          (b.onclick = () => {
            if (game.sideAreas.chooseCurse(b.dataset.roomCurse === "yes"))
              forceClose();
          }),
      );
    },
    update(s) {
      const camp = s.phase === "camp",
        a = s.sideArea?.active;
      $("#camp-navigation").classList.toggle("hidden", !camp);
      $("#arena").classList.toggle("in-camp", camp);
      text($("#camp-nearby"), camp
        ? `${s.camp?.nearest?.name || "야영지"} ${s.camp?.nearest?.distance <= 3.4 ? "· 시설 이용 "+keyLabel(game.bindings.interact) : "· " + Math.round(s.camp?.nearest?.distance || 0) + "m"}`
        : "");
      $("#arena").classList.toggle("has-side-area",!!a);
      if (camp) {
        text($("#camp-hero-info"), `${job(s.playerStats?.characterId)} · ${weapon(s.playerStats?.weaponId)} · 최대 체력 ${n(s.maxHp)}`);
        disabled($("#guard-button"), !s.camp.practice ||
          game.camp.suspended ||
          (s.parry.cooldown > 0 && !s.parry.counterTime));
      }
      $("#side-area-status").classList.toggle("hidden", !a);
      if (a)
        text($("#side-area-status"), `${a.title} · ${a.claimed ? "보상 확인 완료" : a.complete ? "위쪽 제단에서 "+keyLabel(game.bindings.interact) : "남은 적 " + a.remaining} · 아래쪽 황금 문 ${keyLabel(game.bindings.interact)} 복귀`);
      const j = s.job,
        sets = s.sets?.sets || [],
        passive = $("#job-passive");
      passive.classList.toggle(
        "hidden",
        !j?.name || ["menu", "over", "won", "camp"].includes(s.phase),
      );
      if (j?.name) {
        const detail =
          j.id === "summoner"
            ? `마력 ${j.magicHits}/8 · 소환수 1.2초`
            : j.id === "warlock"
              ? `마력 ${j.stacks}/6`
              : j.id === "paladin"
                ? `보호막 ${n(j.shield)} · 생성 ${n(j.shieldCooldown)}초 · 회복 ${n(j.healCooldown)}초`
                : `대시 검격 ${n(j.dashBoost)}초 · 처치 가속 ${n(j.haste)}초`;
        text(passive, `${j.name} · ${detail}`);
        passive.title = j.passive;
      }
      const set = $("#set-passive");
      set.classList.toggle(
        "hidden",
        !sets.length || ["menu", "over", "won", "camp"].includes(s.phase),
      );
      text(set, sets.map((x) => `${x.name} ${x.count}/4`).join(" · ") +
        (s.sets?.shield ? ` · 방패 ${n(s.sets.shield)}` : ""));
    },
  };
  return ui;
}
