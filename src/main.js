import {attr as writeAttr,style as writeStyle,text as writeText} from './dom-update.js';
import {createInteractionUi} from './interaction-ui.js';
import './interaction-ui.css';
import './style.css';
import './quality-ui.css';
import './action-ui.css';
import {createTacticalUi} from './tactical-ui.js';
import {objectiveFor,OBJECTIVE_TYPES} from './stage-objectives.js';
import './tactical-ui.css';
import {createActionUi} from './action-ui.js';
import { Game } from './game.js';
import { formatGold, getStageStats, SPELLS, STAGE_DURATION, BOSS_SPAWN_TIME, MAX_STAGES } from './balance.js';
import { createProgress, normalizeProgress, getPermanentUpgradeOffers, getPermanentBonuses, settleRun, purchasePermanentUpgrade, getUnlockOffers, purchaseUnlock, selectLoadout, CHARACTERS, WEAPONS } from './progression.js';
import { icon } from './icons.js';
import { RELICS, BOSS_REWARDS, RISK_PACTS, getRiskStats } from './content.js';
import { STAGES, BOSS_TYPES, ENEMY_TYPES, getStageDefinition, getBossDefinition } from './encounters.js';
import { getSwordProfile } from './sword.js';
import { SYNERGIES, getActiveSynergies } from './synergies.js';
import { CURSES, ROUTES } from './run-events.js';
import { createExpansionUi } from './expansion-ui.js';
import { normalizeEndgame, recordEndgame } from './abyss.js';
import { REGIONS, getRegion } from './regions.js';
import { MUTATIONS, MUTATION_ELITE } from './mutations.js';
import { createChronicleUi, analyticsMarkup } from './chronicle-ui.js';
import { DAMAGE_SOURCES, normalizeRunHistory } from './analytics.js';
import { normalizeStory } from './story.js';
import { CAMP_FACILITIES } from './camp.js';
import {keyLabel} from "./control-bindings.js";
import { gameKey, isGameShortcut } from './game-input.js';
import { VIEW_MODES, VIEW_LABELS } from './view.js';

const $ = (s) => document.querySelector(s);
const stageNames = STAGES.map(stage => stage.name);
const time = (seconds = 0) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } }
let prefs = readStorage('voidrun.preferences', { muted: true, quality: 'high', risk: 'none' });
if (!prefs || typeof prefs !== 'object') prefs = { muted: true, quality: 'high', risk: 'none' };
prefs.risk = RISK_PACTS.some(pact => pact.id === prefs.risk) ? prefs.risk : 'none';
let history = readStorage('voidrun.history', []);
history = normalizeRunHistory(history);
const savedProgress = readStorage('voidrun.progression', null);
let progress = savedProgress ? normalizeProgress(savedProgress) : createProgress(history);
function persistProgress() {
  try { localStorage.setItem('voidrun.progression', JSON.stringify(progress)); return true; }
  catch { return false; }
}
let progressionWritable = persistProgress();
let lastResult = null;
let campFromResult = false;
let expansionUI, chronicleUI;
let endgame = normalizeEndgame(readStorage('voidrun.endgame', {}), history);
let actionUi,interactionUi,tacticalUi;let game, latest, dialogName = '', pausedForDialog = false;
let lastKills = 0;
let toastTimeout, parryNoticeTimeout,impactTimeout,bossCueTimeout,lastBossCue='';
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const accessibility = () => ({cameraShake:prefs.cameraShake ?? (reducedMotion ? 0 : 1), effectIntensity:prefs.effectIntensity ?? (reducedMotion ? .35 : 1)});
let lastBuildSignature = '';
let lastRouteStage = 0;
let campTab = 'tree';
let theaterMode = false;
const hudElements = new Map();
const hudValues = new Map();
const choiceDialogs = new Set(['upgrade', 'skill-swap', 'relic', 'route', 'region', 'curse', 'equipment', 'npc', 'portal', 'room-choice']);
const isChoiceDialog = () => choiceDialogs.has(dialogName);
const swordNames = { default: '기본 검술', broadsword: '거인의 대검', twinblade: '질풍의 쌍검', wave: '공허의 검기' };
const decimal = (value, digits = 1) => Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: digits });
const percentGain = value => `${Number(value) >= 1 ? '+' : ''}${decimal((Number(value || 1) - 1) * 100)}%`;
const sourceName = DAMAGE_SOURCES;
function hud(selector, value, html = false) {
  const key = `${selector}:${html}`;
  if (hudValues.get(key) === value) return;
  const element = hudElements.get(selector) || $(selector);
  if (!element) return;
  hudElements.set(selector, element); hudValues.set(key, value);
  if (html) element.innerHTML = value; else element.textContent = value;
}
const upgradeIcons = { arcana: 'orbit', focus: 'bolt', bladeReach: 'target', blade_range: 'target', blade_broadsword: 'sword', blade_twinblade: 'bolt', blade_wave: 'move', spellArea: 'orbit', spell_power: 'orbit', spell_haste: 'bolt', power: 'sword', haste: 'bolt', vitality: 'heart', magnet: 'magnet', critical: 'diamond', armor: 'shield', regen: 'cross', speed: 'move', fireball: 'fire', frost: 'snow', lightning: 'bolt', orbit: 'orbit' };
const upgradeIcon = (choice) => upgradeIcons[choice.id] || upgradeIcons[choice.id.replace(/^(spell_|evolve_)/, '')] || ({ flame: 'fire', snowflake: 'snow' }[choice.icon]) || choice.icon || 'diamond';

$('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="#" aria-label="VOIDRUN 홈"><span class="brand-mark">${icon('bolt')}</span>VOID<span>RUN</span><sup>®</sup></a>
    <nav class="main-nav" aria-label="주 메뉴">
      <button class="nav-link active" data-nav="play">플레이<span class="nav-dot"></span></button>
      <button class="nav-link" data-nav="guide">게임 가이드</button>
      <button class="nav-link" data-nav="history">런 기록 <span class="nav-count" id="history-count">${history.length.toString().padStart(2, '0')}</span></button>
      <button class="nav-link" data-nav="permanent">영구 강화</button>
    </nav>
    <div class="header-actions"><span class="build-label"><i></i> BUILD YOUR LEGEND <b>v0.20.0</b></span><span class="header-divider"></span><button id="sound-toggle" class="icon-button" title="사운드 켜기" aria-label="사운드 켜기">${icon('muted')}</button><button id="settings" class="icon-button" title="설정" aria-label="설정">${icon('settings')}</button></div>
  </header>
  <main class="page">
    <section class="page-intro">
      <div><div class="eyebrow"><span class="tiny-cross">✳</span> SURVIVE. LOOT. REPEAT.</div><h1>살아남아라. <span>한계를 넘어라.</span></h1><p>끝없이 몰려오는 적, 폭발하는 보상. 당신의 다음 런은 어디까지?</p></div>
      <div class="personal-best">${icon('trophy')}<div><span>나의 최고 기록</span><strong id="personal-best">${history.length ? `${Math.max(...history.map(r => r.stage))} 스테이지` : '새로운 전설의 시작'}</strong></div><span class="best-line"></span></div>
    </section>
    <div class="progression-strip"><span class="progression-kicker">DEATH IS PROGRESS</span><div class="progression-cycle"><span>사냥</span>${icon('chevron')}<span>골드 회수</span>${icon('chevron')}<strong>영구 강화</strong>${icon('chevron')}<span>다시 도전</span></div><button class="bank-entry" data-nav="permanent">${icon('coin')}<span>보유 골드</span><strong id="bank-gold">${formatGold(progress.bank)}</strong>${icon('arrow')}</button></div>
    <section class="game-layout" aria-label="VOIDRUN 게임">
      <div class="arena" id="arena">
        <div id="game-canvas" role="application" tabindex="0" aria-label="3D 로그라이크 전장. WASD 이동, 스페이스 대시, Escape 일시정지."></div>
        <div class="arena-vignette"></div>
        <div class="arena-top">
          <button class="area-label region-info" id="region-info" aria-label="현재 지역 특성과 보상 보기"><span class="live-dot"></span><span id="area-name">잊혀진 성역</span><span class="area-divider">/</span><span id="area-stage">STAGE 01</span>${icon('chevron')}<small id="region-summary"></small></button>
          <div class="arena-top-actions"><span class="difficulty"><i></i> <span id="difficulty">고요한 시작</span></span><button id="camera-mode" class="glass-button" title="시점 변경 (V)" aria-label="시점 변경 (V)">3인칭</button><button id="game-speed" class="glass-button" title="게임 배속 변경 · 적과 공격도 함께 빨라집니다" aria-label="게임 배속 변경">1×</button><button id="pause-button" class="glass-button" title="일시정지 (Esc)" aria-label="일시정지" disabled>${icon('pause')}</button><button id="fullscreen" class="glass-button" title="전체 화면 (F10)" aria-label="전체 화면" aria-pressed="false">${icon('expand')}</button></div>
        </div>
        <div class="live-hud hidden" id="live-hud">
          <div class="health-block"><div class="health-label">${icon('heart')}<span>HP</span><span id="invuln-state"></span><strong id="health-value">100 <small>/ 100</small></strong></div><div class="health-track"><div id="health-fill"></div></div><div class="xp-row"><span id="level-value">LV. 1</span><div class="xp-track"><div id="xp-fill"></div></div><span id="xp-value">0 / 10</span></div></div>
          <div class="run-counters"><div>${icon('clock')}<strong id="run-time">00:00</strong></div><div>${icon('skull')}<strong id="kill-count">0</strong></div><div class="gold-counter">${icon('coin')}<strong id="gold-count">0</strong></div></div>
        </div>
        <div class="boss-hud hidden" id="boss-hud" role="meter" aria-label="보스 체력" aria-valuemin="0" aria-valuemax="100"><div><strong id="boss-name"></strong><span id="boss-combat-phase"></span><span id="boss-health-value"></span></div><div class="boss-health-track"><div id="boss-health-fill"></div></div><span id="boss-tactic" class="hidden"></span><span id="boss-stagger" class="hidden"></span></div>
        <div class="start-content" id="start-content">
          <div class="roguelike-tag"><span></span> 3D SURVIVAL ROGUELIKE</div>
          <h2>작은 시작.<br>거대한 <span>한 방.</span></h2>
          <p>쓰러져도, 번 골드는 남습니다.<br>영구 강화로 더 강하게 돌아오세요.</p>
          <div class="magic-preview"><span style="--spell:#ffac61">${icon('fire')}</span><span style="--spell:#80e6f8">${icon('snow')}</span><span style="--spell:#f0de75">${icon('bolt')}</span><span style="--spell:#c4a2ff">${icon('orbit')}</span><small>5 REGIONS · 7 BUILD COMBOS</small></div>
          <button class="start-loadout" id="start-loadout">${icon('sword')} <span id="selected-loadout">방랑자 · 공허의 검</span> ${icon('chevron')}</button>
          <div class="risk-selector"><span>이번 런의 계약</span><div id="risk-options" class="risk-options">${RISK_PACTS.map(pact => `<button data-risk="${pact.id}" aria-pressed="${prefs.risk === pact.id}" class="${prefs.risk === pact.id ? 'selected' : ''}">${pact.name.replace('의 계약','')}</button>`).join('')}</div><p id="risk-description"></p></div>
          <button class="primary-button start-button" id="start-button"><span>${icon('play')} 런 시작하기</span>${icon('arrow')}</button>
          <button class="secondary-button camp-entry" id="enter-camp">3D 야영지 · 시설과 기록관</button><div class="mode-actions"><button class="secondary-button" id="mode-button">일반 모드 · 1–10층</button><button class="secondary-button" id="abyss-records-button">심연 기록 · 업적</button></div><div class="start-footnote"><span class="live-dot"></span> 설치 없이 바로 플레이 <span>·</span> ${STAGE_DURATION / 60}분 × ${MAX_STAGES}층 · 층마다 다른 수호자</div>
        </div>
        <div class="camp-navigation hidden" id="camp-navigation"><strong id="camp-nearby"></strong><div>${CAMP_FACILITIES.map(f=>`<button data-camp-facility="${f.id}">${f.name}</button>`).join('')}<button id="leave-camp">메뉴</button></div><small>WASD / 드래그 이동 · 근처에서 C · 버튼으로 빠른 이용</small></div><div class="side-area-status hidden" id="side-area-status"></div><div class="passive-status"><span id="job-passive" class="hidden"></span><button id="set-passive" class="hidden" title="세트 효과 설명"></button></div>
        <div class="scene-coordinate">SECTOR_001 <span>35° 41′ N / 139° 41′ E</span></div>
        <div class="combo-display hidden" id="combo-display"><strong id="combo-value"></strong><span>CHAIN KILLS</span></div>
        <div class="parry-callout hidden" id="parry-callout" role="status" aria-live="polite"><strong>PERFECT PARRY</strong><small>2초 안 직접 공격 · 광역 반격</small></div>
        <div class="game-toast hidden" id="game-toast" role="status"></div>
        <div class="stage-banner hidden" id="stage-banner"><span id="banner-kicker">NEXT STAGE</span><strong id="banner-title"></strong><p>보상 ×10 <span>적 체력 ×1.7 · 피해 ×1.35</span></p></div>
        <div class="arena-bottom">
          <div class="character-loadout"><div class="weapon-icon">${icon('sword')}</div><div><span class="loadout-label">시작 무기</span><strong id="weapon-name">공허의 검 <span>I</span></strong></div><span class="loadout-divider"></span><div class="attack-type">${icon('target')} 수동 공격</div></div>
          <div class="dash-indicator hidden" id="dash-indicator"><kbd>SHIFT</kbd><div><strong id="dash-status">대시 준비</strong><div class="dash-track"><div id="dash-fill"></div></div></div>${icon('bolt')}</div>
          <div class="scene-tag" id="scene-tag"><span class="live-dot"></span> REAL-TIME 3D</div>
        </div>
        <div class="expedition-actions hidden" id="expedition-actions"><button id="guard-button">패링 · F</button><button id="equipment-button">장비 · TAB</button><button id="lock-toggle" aria-pressed="false">락온 · L</button><button id="lock-next" class="hidden">전환 · K</button><span id="lock-state"></span><span id="abyss-rule" class="hidden"></span></div><div class="growth-toolbar hidden" id="growth-toolbar"><div class="spell-loadout" id="spell-loadout" aria-label="보유 마법">${[0,1,2,3].map(index=>`<button class="spell-slot locked" data-action-slot="${index}" aria-label="수동 스킬 ${index+1}"><kbd>${['Q','E','R','X'][index]}</kbd><span class="spell-slot-icon">${icon('bolt')}</span><span class="spell-slot-rank">—</span><span class="spell-cooldown"></span></button>`).join('')}</div><div id="synergy-status" class="synergy-status hidden" aria-label="발동 중인 조합"></div><button id="run-build-button" class="shop-button">${icon('book')} 배치 · 빌드 <span id="reward-pending" class="reward-pending hidden" title="다음 레벨업의 선택 보상"></span><kbd>B</kbd></button></div>
        <button id="objective-panel" class="objective-panel hidden"><strong id="objective-name"></strong><span id="objective-summary"></span></button><div id="link-callout" class="link-callout hidden" role="status" aria-live="polite"></div><div id="training-controls" class="training-controls hidden"><span id="training-metrics"></span><button id="training-refill">재사용 초기화</button><button id="training-change">종목 선택</button><button id="training-exit">야영지</button></div><div id="interaction-prompt" class="interaction-prompt hidden" role="status" aria-live="polite"><button id="interact-npc" class="hidden" aria-label="상호작용"><kbd>C</kbd><span></span></button></div><div class="manual-combat-readout"><span id="manual-combo">좌클릭 · 일반 공격</span><span id="manual-heavy">우클릭 · 강공격</span></div><div class="mobile-actions" id="mobile-actions"><button id="mobile-light" aria-label="일반 공격">공격</button><button id="mobile-heavy" aria-label="강공격 차징">강공격</button><button id="mobile-parry" aria-label="패링">패링</button></div><div id="virtual-stick" class="virtual-stick hidden" aria-hidden="true"><i></i></div><div id="hit-direction" aria-hidden="true"></div><div id="view-reticle" class="hidden" aria-hidden="true"></div><div id="view-hint" class="hidden"><span class="desktop-look"></span><span class="mobile-look">왼쪽 이동 · 오른쪽 드래그 캐릭터 회전</span></div><div class="touch-controls hidden" id="touch-controls"><div class="dpad"><button data-move="0,-1" aria-label="위로 이동">↑</button><button data-move="-1,0" aria-label="왼쪽 이동">←</button><button data-move="0,1" aria-label="아래로 이동">↓</button><button data-move="1,0" aria-label="오른쪽 이동">→</button></div><button id="touch-dash" aria-label="대시">${icon('bolt')}</button></div>
        <div class="canvas-error hidden" id="canvas-error"><h2>3D 화면을 시작할 수 없어요</h2><p>브라우저의 하드웨어 가속을 켠 뒤 새로고침해 주세요.</p><button class="primary-button" id="reload">새로고침 ${icon('refresh')}</button></div>
      </div>
      <aside class="run-panel">
        <section class="camp-panel"><div class="panel-heading"><span>재건된 성역</span><span class="micro">CAMP</span></div><h3>다음 탐험을 준비하세요.</h3><p id="camp-hero-info"></p><div>${CAMP_FACILITIES.map(f=>`<button data-camp-facility="${f.id}"><strong>${f.name}</strong><small>${({smith:'시작 무기 · 장비',training:'직업 · 패링 연습',laboratory:'마법 진화 · 숨겨진 조합',archive:'도감 · 이야기 · 전투 기록',altar:'영구 강화 · 성장 트리',gate:'탐험 모드 · 위험 계약'})[f.id]}</small></button>`).join('')}</div><p>시설 근처에서 C 또는 빠른 메뉴.<br>번 골드와 영구 강화는 다음 런에도 남습니다.</p></section>
        <div class="panel-heading"><span>이번 런의 여정</span><span class="micro">THE RUN</span></div>
        <div class="stage-heading"><span class="stage-caption">CURRENT STAGE</span><div class="stage-number"><strong id="stage-number">01</strong><span>/ ${String(MAX_STAGES).padStart(2, '0')}</span><span class="stage-symbol">✳</span></div><h3 id="stage-name">잊혀진 초원</h3><p id="stage-english">THE FORGOTTEN GROVE</p></div>
        <div class="stage-time"><span id="stage-timer-label">보스 출현까지</span><strong id="stage-time">01:30</strong></div><div class="stage-track"><div id="stage-progress"></div></div>
        <div class="scaling-stats"><div><span>${icon('coin')} 처치 보상</span><strong id="reward-multiplier">×1</strong></div><div><span>${icon('skull')} 적 체력 · 피해</span><strong id="enemy-multiplier">×1</strong></div></div>
        <div class="stage-route" aria-label="전체 층 진행 경로" tabindex="0">${stageNames.map((name, i) => `<div class="route-stop ${i === 0 ? 'current' : ''}" data-stage="${i + 1}"><span class="route-point">${i === 0 ? '<i></i>' : `<b>${i + 1}</b>`}</span><span class="route-region-name">${i === 0 || i === MAX_STAGES - 1 ? name : '미지의 갈림길'}</span><span class="route-multiplier">${i === 0 ? '현재' : `×${formatGold(10 ** i)}`}</span></div>`).join('')}</div>
        <div class="build-summary"><div><span>이번 런의 빌드</span><button id="build-info" title="마법과 강화 설명">${icon('book')}</button></div><p id="build-summary">화염탄으로 시작합니다.<br>경험치를 모아 새 마법을 선택하세요.</p><div class="build-summary-foot"><span id="build-levels">마법 1종 · 진화 0종</span><span>LV. <b id="build-level">1</b></span></div></div>
        <div class="panel-tip"><span>${icon('bolt')} BIGGER GAINS. NEW POSSIBILITIES.</span><p>강력한 성장, 새로운 마법.<br>선택이 쌓여 <b>당신만의 빌드로.</b></p><div class="mini-bars">${Array.from({length: 22}, (_, i) => `<i style="--bar:${12 + Math.pow(i / 21, 2.5) * 38}px;--alpha:${.16 + i / 26}"></i>`).join('')}</div></div>
      </aside>
    </section>
    <section class="below-game">
      <div class="controls-guide"><span class="controls-title">HOW TO PLAY</span><span class="control-item"><span class="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> 이동</span><span class="control-item"><kbd class="wide-key">SHIFT</kbd> 대시</span><span class="control-item"><kbd>ESC</kbd> 일시정지</span><span class="control-item auto-hint">${icon('target')} 좌클릭 공격 · 우클릭 강공격</span></div>
      <button class="text-button" data-nav="guide">처음 플레이하시나요? ${icon('arrow')}</button>
    </section>
    <section class="feature-row"><div><span class="feature-index">01 /</span>${icon('coin')}<span><strong>죽음 뒤에도 남는 성장</strong><small>번 골드로 영구 강화하고, 다시 도전.</small></span><span class="feature-detail">↗</span></div><div><span class="feature-index">02 /</span>${icon('skull')}<span><strong>광활한 전장과 수호자</strong><small>4배 넓은 맵, 스테이지마다 보스.</small></span><span class="feature-detail waves">4×</span></div><div><span class="feature-index">03 /</span>${icon('diamond')}<span><strong>마법을 조합하고 진화</strong><small>이번 런의 선택, 다음 런의 새 빌드.</small></span><span class="feature-detail">∞</span></div></section>
    <footer><span>VOIDRUN <span class="footer-dot">/</span> ONE MORE RUN.</span><span>죽음은 끝이 아닌, 다음 런의 시작.</span><span>BUILT FOR THE THRILL <span class="lime">↗</span></span></footer>
  </main>
  <div class="modal-backdrop hidden" id="modal-backdrop"><section class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"></section></div>
`;

function sound(note = 440, duration = .08, volume = .04) {
  if(!prefs.muted)game?.sound('ui',null,{note,volume});
}

function syncSound() {
  $('#sound-toggle').innerHTML = icon(prefs.muted ? 'muted' : 'sound');
  $('#sound-toggle').title = $('#sound-toggle').ariaLabel = prefs.muted ? '사운드 켜기' : '사운드 끄기';
  game?.setMuted(prefs.muted);
  store('voidrun.preferences', prefs);
}
function showToast(message) {
  $('#game-toast').textContent = message; $('#game-toast').classList.remove('hidden');
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#game-toast').classList.add('hidden'), 2500);
}

function update(state) {
  latest = state;
  document.body.classList.toggle('boss-active',!!state.boss?.alive);document.body.classList.toggle('reduced-effects',accessibility().effectIntensity===0);
  const cue=state.boss?.alive?`${state.stage}:${state.boss.archetype}:${state.boss.combatPhase}`:'';
  if(cue&&lastBossCue&&cue!==lastBossCue){game.view.emphasize();$('#boss-hud').classList.add('phase-cue');clearTimeout(bossCueTimeout);bossCueTimeout=setTimeout(()=>$('#boss-hud').classList.remove('phase-cue'),650);}lastBossCue=cue;
  hud('#invuln-state',state.invulnerability>0?'보호':'');
  syncView(state.view);
  if (['menu','over','won','camp'].includes(state.phase)) $('#parry-callout').classList.add('hidden');
  const stunned = (state.boss?.parryStun || 0) > 0;
  $('#boss-stagger').classList.toggle('hidden', !stunned);
  if (stunned) hud('#boss-stagger', `공격 차단 · 경직 ${state.boss.parryStun.toFixed(1)}초`);
  expansionUI?.update(state);
  $('#expedition-actions').classList.toggle('hidden', ['menu','over','won'].includes(state.phase));
  hud('#game-speed', `${state.playbackSpeed || 1}×`);
  writeAttr($('#game-speed'), 'aria-label', `현재 ${state.playbackSpeed || 1}배속 · 눌러서 배속 변경`);
  const inRun = !['menu', 'over', 'won', 'camp'].includes(state.phase);
  $('#arena').classList.toggle('in-run', inRun);
  document.body.classList.toggle('run-active', inRun);
  document.body.classList.toggle('camp-active', state.phase === 'camp');
  $('#live-hud').classList.toggle('hidden', !inRun);
  $('#dash-indicator').classList.toggle('hidden', !inRun);
  $('#scene-tag').classList.toggle('hidden', inRun);
  $('#start-content').classList.toggle('hidden', state.phase !== 'menu');
  $('#touch-controls').classList.toggle('hidden', !inRun && state.phase !== 'camp');
  $('#touch-dash').classList.toggle('hidden', state.phase === 'camp');
  $('#growth-toolbar').classList.toggle('hidden', !inRun);
  $('#pause-button').disabled = !['playing', 'paused'].includes(state.phase);
  hud('#health-value', `${formatGold(Math.ceil(state.hp))} <small>/ ${formatGold(Math.round(state.maxHp))}</small>`, true);
  writeStyle($('#health-fill'), 'width', `${Math.max(0, state.hp / state.maxHp * 100)}%`);
  $('#health-fill').classList.toggle('low', state.hp < state.maxHp * .3);
  hud('#level-value', state.training ? '연습' : `LV. ${state.level}`);
  writeStyle($('#xp-fill'), 'width', `${Math.min(100, state.xp / state.xpNeeded * 100)}%`);
  hud('#xp-value', state.training ? '모험 경험치 미적용' : `${Math.floor(state.xp)} / ${state.xpNeeded}`);
  hud('#run-time', time(state.elapsed));
  hud('#kill-count', state.kills.toLocaleString());
  hud('#gold-count', formatGold(state.gold));
  hud('#stage-number', String(state.stage).padStart(2, '0'));
  const floor = getStageDefinition(state.stage);
  const region = state.region || getRegion(state.regionId || (state.stage === MAX_STAGES ? 'throne' : 'sanctum'));
  const inCamp = state.phase === 'camp';
  hud('#stage-name', state.training ? '성역 훈련장' : inCamp ? '재건된 성역' : region.title); hud('#area-name', state.training ? '성역 훈련장' : inCamp ? '재건된 성역 · 야영지' : region.title);
  hud('#stage-english', inCamp ? 'SANCTUARY CAMP' : region.english || floor.english);
  const regionHints = { sanctum: '탐험의 시작', volcano: '용암 예고', tundra: '서리 둔화', forest: '독성 장판', ruins: '마법 사선', void: '변이 · 균열', throne: '최종 수호자' };
  hud('#region-summary', state.training ? '실전 연습 · 모험 기록 제외' : inCamp ? `이동 · 시설 ${keyLabel(game.bindings.interact)} · 빠른 메뉴` : `${regionHints[region.id] || '지역 특성'} · 골드 ×${decimal(region.goldMultiplier || 1, 2)}`);
  $('#region-info').style.setProperty('--region', region.color || '#b9cda5');
  writeAttr($('#region-info'), 'title', `${region.title} · ${region.hazard} · ${region.reward}`);
  writeAttr($('#region-info'), 'aria-label', `${region.title} · 지역 특성 및 보상 보기`);
  hud('#area-stage', state.training?'TRAINING':inCamp ? 'CAMP' : `STAGE ${String(state.stage).padStart(2, '0')}`);
  const boss = state.boss;
  const bossAlive = !!boss && boss.hp > 0;
  const waitingForBoss = state.stageTime >= STAGE_DURATION && bossAlive;
  const beforeBoss = state.stageTime < BOSS_SPAWN_TIME && !boss?.spawned;
  const goal=state.objective,nonTimed=goal&&goal.type!=='survival'&&!state.sideArea?.active;
  hud('#stage-timer-label',state.training?'실전 훈련 · 모험 기록 제외':nonTimed?(goal.complete?'수호자 처치 후 다음 지역':goal.name):waitingForBoss ? '수호자를 처치해야 진행됩니다' : beforeBoss ? '보스 출현까지' : bossAlive ? '보스전 · 생존 목표까지' : '다음 스테이지까지');
  hud('#stage-time',state.training?time(state.elapsed):nonTimed?(goal.complete?(bossAlive?'보스전':goal.canSummon?'소환 준비':time(Math.ceil(Math.max(0,20-state.stageTime)))):`${Math.floor(goal.progress)} / ${goal.target}`):waitingForBoss ? '처치 대기' : time(Math.ceil((beforeBoss ? BOSS_SPAWN_TIME : STAGE_DURATION) - state.stageTime)));
  writeStyle($('#stage-progress'), 'width', `${nonTimed?Math.min(1,goal.progress/goal.target)*100:state.stageTime/STAGE_DURATION*100}%`);
  const risk = state.phase === 'menu' ? getRiskStats(prefs.risk) : state.risk || getRiskStats(prefs.risk);
  const goldBonus = (risk.goldMultiplier || 1) * (state.playerStats?.goldMultiplier || 1);
  const baseKillGold=(state.stageStats || getStageStats(state.stage)).coinValue*2.5;
  hud('#reward-multiplier', `${baseKillGold<1e4?decimal(baseKillGold,1):formatGold(baseKillGold)} G · ×${decimal(goldBonus, 2)}`);
  writeAttr($('#reward-multiplier'), 'title', `기본 처치 골드 × 계약 × 유물·영구 강화 × 제단·경로·지역. 현재 총 보상 배율 ×${decimal(goldBonus, 2)}`);
  const enemyStats = state.stageStats || getStageStats(state.stage), baseEnemyStats = getStageStats(1);
  hud('#enemy-multiplier', `×${decimal(enemyStats.enemyHealth / baseEnemyStats.enemyHealth * (risk.enemyHealth || 1))} / ×${decimal(enemyStats.enemyDamage / baseEnemyStats.enemyDamage * (risk.enemyDamage || 1))}`);
  writeAttr($('#enemy-multiplier'), 'title', '1층 기본 적 대비 체력 / 피해. 계약·유물·제단·현재 경로·지역을 포함합니다. 변이 개체는 별도 배율이 적용됩니다.');
  hud('#difficulty', bossAlive ? '수호자 출현' : state.stage >= 3 ? '원거리 몬스터 주의' : state.stageTime > 60 ? '몰려오는 적들' : '생존과 성장');
  $('#boss-hud').classList.toggle('hidden', !bossAlive);
  $('#arena').classList.toggle('has-boss', bossAlive);
  if (bossAlive) {
    hud('#boss-name', boss.name);
    const bossPercent = Math.max(0, Math.min(100, boss.hp / boss.maxHp * 100));
    hud('#boss-health-value', `${Math.ceil(bossPercent)}%`);
    writeStyle($('#boss-health-fill'), 'width', `${bossPercent}%`);
    writeAttr($('#boss-hud'), 'aria-valuenow', String(Math.ceil(bossPercent)));
    writeAttr($('#boss-hud'), 'aria-valuetext', `${boss.name} 체력 ${Math.ceil(bossPercent)}%`);
    writeAttr($('#boss-hud'), 'title', `${boss.name} · ${Math.ceil(boss.hp).toLocaleString('ko-KR')} / ${Math.ceil(boss.maxHp).toLocaleString('ko-KR')} · ${boss.hint || getBossDefinition(state.stage).hint}`);
  }
  const weapon = WEAPONS.find(item => item.id === (state.playerStats?.weaponId || progress.loadout?.weapon)) || WEAPONS[0];
  const sword = state.sword || getSwordProfile(state.playerStats || {});
  const swordName = swordNames[sword.mode] || swordNames.default;
  hud('#weapon-name', `${escapeHTML(sword.mode && sword.mode !== 'default' ? swordName : weapon.name)} <span>${decimal(sword.range)}m</span>`, true);
  writeAttr($('#weapon-name'), 'title', `${swordName} · 실제 타격 거리 ${decimal(sword.range, 2)}m · 전방 ${Math.round(sword.arc * 180 / Math.PI)}° · 범위 강화로 성장`);
  $('#weapon-name').style.setProperty('--blade-color', sword.color || '#c1ff66');
  $('#combo-display').classList.toggle('hidden', !inRun || state.combo < 3);
  hud('#combo-value', `${state.combo}×`);
  hud('.loadout-label', inRun ? `검 ${formatGold(state.damage)} · 마법 ${formatGold(state.spellDamage || state.playerStats?.spellDamage || 18)}` : '시작 무기');
  const cooldown = state.dashCooldown || 0;
  hud('#dash-status', cooldown <= 0 ? '대시 준비' : `${cooldown.toFixed(1)}초`);
  writeStyle($('#dash-fill'), 'width', `${Math.max(0, 1 - cooldown / 2.4) * 100}%`);
  $('#dash-indicator').classList.toggle('on-cooldown', cooldown > 0);
  const spells = getSpellStates(state);
  actionUi?.update(state);
  const owned = spells.filter(s => s.rank > 0);
  const activeSynergies = getActiveSynergies(state.playerStats || {});
  $('#synergy-status').classList.toggle('hidden', !inRun || !activeSynergies.length);
  hud('#synergy-status', activeSynergies.slice(0, 2).map(synergy => `<span style="--synergy:${escapeHTML(synergy.color)}" title="${escapeHTML(`${synergy.title} · ${synergy.description}`)}" aria-label="${escapeHTML(`${synergy.title} 발동 중`)}">${icon(synergy.icon)}<b>${escapeHTML(synergy.title)}</b></span>`).join('') + (activeSynergies.length > 2 ? `<button class="synergy-more" data-open-build title="${escapeHTML(activeSynergies.map(item => item.title).join(' · '))}" aria-label="추가 조합 ${activeSynergies.length - 2}개 · 전체 조합 보기">+${activeSynergies.length - 2}</button>` : ''), true);
  const relicIds = state.playerStats?.relics || [];
  const rewardTokens = Math.max(0, Math.floor(Number(state.rewardTokens) || 0));
  const pendingBossRewards = Array.isArray(state.pendingBossRewards) ? state.pendingBossRewards : [];
  const pendingRewards = rewardTokens + pendingBossRewards.length;
  $('#reward-pending').classList.toggle('hidden', !inRun || pendingRewards === 0);
  hud('#reward-pending', String(pendingRewards));
  const rewardHint = `다음 레벨업 선택 대기 · 유물 ${rewardTokens}개 · 보스 유산 ${pendingBossRewards.length}개`;
  writeAttr($('#reward-pending'), 'title', rewardHint);
  writeAttr($('#run-build-button'), 'title', pendingRewards ? rewardHint : '이번 런의 마법 · 유물 · 강화 보기');
  writeAttr($('#run-build-button'), 'aria-label', `이번 런 빌드${pendingRewards ? ` · ${rewardHint}` : ''}`);
  const buildSignature = `${state.level}:${sword.mode}:${sword.range}:${owned.map(s => `${s.id}:${s.rank}:${s.evolved}`).join(',')}:${relicIds.join(',')}:${activeSynergies.map(item => item.id).join(',')}`;
  if (buildSignature !== lastBuildSignature) {
    lastBuildSignature = buildSignature;
    $('#build-summary').innerHTML = `<span style="--spell:${escapeHTML(sword.color || '#c1ff66')}">${icon('sword')}${escapeHTML(swordName)}<b>${decimal(sword.range)}m</b></span>` + owned.map(s => `<span style="--spell:${escapeHTML(s.color || '#c2f568')}">${icon(upgradeIcons[s.id])} ${escapeHTML(s.evolved ? SPELLS.find(d => d.id === s.id)?.evolutionName || s.name : s.name)} <b>${s.evolved ? '★' : `Lv.${s.rank}`}</b></span>`).join('');
    $('#build-levels').textContent = `마법 ${owned.length}종 · 유물 ${relicIds.length}개`;
    $('#build-level').textContent = state.level;
  }
  if (state.stage !== lastRouteStage) {
  lastRouteStage = state.stage;
  for (const stop of document.querySelectorAll('.route-stop')) {
    const n = Number(stop.dataset.stage);
    const visited = state.runReport?.regionHistory?.find(entry => entry.stage === n);
    stop.querySelector('.route-region-name').textContent = visited ? getRegion(visited.regionId || visited.id).title : n === 1 || n === MAX_STAGES ? stageNames[n - 1] : '미지의 갈림길';
    stop.classList.toggle('current', n === state.stage);
    stop.classList.toggle('completed', n < state.stage);
    stop.querySelector('.route-point').innerHTML = n < state.stage ? icon('check') : n === state.stage ? '<i></i>' : `<b>${n}</b>`;
    stop.querySelector('.route-multiplier').textContent = n === state.stage ? '현재' : n < state.stage ? '완료' : `×${formatGold(10 ** (n - 1))}`;
  }
  const route = $('.stage-route'), currentStop = route?.querySelector('.current');
  if (route && currentStop) route.scrollTop = Math.max(0, currentStop.offsetTop - route.offsetTop - route.clientHeight / 2 + currentStop.clientHeight / 2);
  }

  lastKills = state.kills;
  chronicleUI?.update(state);
  interactionUi?.update();tacticalUi?.update(state);
}

function getSpellStates(state = latest) {
  return SPELLS.map(definition => {
    const live = state?.spellState?.find(spell => spell.id === definition.id);
    return { ...definition, rank: state?.playerStats?.spells?.[definition.id] || 0, evolved: !!state?.playerStats?.evolutions?.[definition.id], cooldown: 0, maxCooldown: 1, ...live };
  });
}

function handleControlAction(action){
 if(action==='pause'){if(dialogName)closeModal();else showPause();return true;}
 if(action==='inventory'){if(dialogName==='inventory')closeModal();else if(!dialogName)expansionUI?.inventory();else return false;return true;}
 if(dialogName)return false;
 if(action==='view'){game.view.cycle();game.actions.hasAim=false;$('#game-canvas').focus({preventScroll:true});return true;}
 if(action==='build'){actionUi?.loadout();return true;}
 if(action==='fullscreen'){toggleFullscreen();return true;}
 return false;
}
let returnFocus;
function openModal(name, content, { pause = true, closeable = true } = {}) {
  if (isChoiceDialog() && name !== dialogName && name !== 'result' && !(choiceDialogs.has(name) && game?._state.phase === name)) return false;
  game?.actions.clearInput();if(['inventory','skills','permanent'].includes(name))game?.actions.cancel();returnFocus = document.activeElement;
  game?.view.release();
  if (game?.camp.active) { game.camp.suspended = true; game.keys.clear(); game.touchMove = {x:0,y:0}; }
  if (pause && latest?.phase === 'playing') { pausedForDialog = true; game.pause(); }
  dialogName = name;
  $('#modal').className = `modal modal-${name}`;
  $('#modal').innerHTML = `${closeable ? `<button class="modal-close icon-button" id="modal-close" aria-label="닫기">${icon('close')}</button>` : ''}${content}`;
  $('#modal-backdrop').classList.remove('hidden');
  $('#modal').focus({ preventScroll: true });
  $('#modal-close')?.addEventListener('click', closeModal);
  return true;
}
function closeModal() {
  actionUi?.stopCapture();
  if (isChoiceDialog() || dialogName === 'result') return;
  if ((dialogName === 'permanent' && campFromResult && lastResult) || (['over','won'].includes(game?._state.phase) && lastResult && dialogName !== 'modes')) { showResult(); return; }
  $('#modal-backdrop').classList.add('hidden');
  dialogName = '';
  if (game?.camp.active) game.camp.suspended = false;
  if (pausedForDialog) { pausedForDialog = false; game.resume(); $('#game-canvas').focus({ preventScroll: true }); }
  else returnFocus?.focus();
}
function forceCloseModal() {
  actionUi?.stopCapture();
  $('#modal-backdrop').classList.add('hidden'); dialogName = ''; pausedForDialog = false;
  if (game?.camp.active) game.camp.suspended = false;
}
function startRun() {
  forceCloseModal(); lastKills = 0;
  game.setPermanentBonuses(getPermanentBonuses(progress));
  game.setRiskPact?.(prefs.risk);
  game.restart(); sound(320, .2);
  showToast('초록 경험치 조각을 모으세요. 레벨업마다 마법과 강화를 선택합니다.');
  $('#game-canvas').focus({ preventScroll: true });
}
function encounterGuide() {
  const enemyCounters = {
    0: '거리를 벌리고 직접 검격의 범위에 한꺼번에 모으세요.',
    1: '빠른 추격을 대시로 끊고, 낮은 체력을 먼저 공략하세요.',
    2: '느리지만 단단합니다. 둘러싸이기 전에 마법으로 체력을 깎으세요.',
    3: '발사 직전의 빛을 보고 옆으로 이동하면 탄환을 피할 수 있습니다.',
    5: '직선 돌진 예고가 고정되면 옆으로 이동하고 빈틈을 공격하세요.',
    6: '원형 예고 밖으로 빠지세요. 스스로 폭발한 적은 보상을 남기지 않습니다.',
    7: '쓰러진 뒤 작은 적 둘로 갈라집니다. 광역 마법으로 마무리하세요.',
    8: '긴 조준선이 고정된 뒤 옆으로 이동하거나 대시하세요.',
    9: '주변 적을 회복시키므로 먼저 처치하면 군단을 약화시킬 수 있습니다.',
  };
  const enemyIcons = { 0: 'skull', 1: 'move', 2: 'shield', 3: 'bolt', 5: 'sword', 6: 'fire', 7: 'diamond', 8: 'target', 9: 'cross' };
  const bossCounters = {
    warden: '직선 돌진은 옆으로 피하고, 원형 충격파는 범위 밖으로 빠지세요.',
    artillery: '거리를 유지하며 부채꼴 탄막을 쏩니다. 조준 방향이 고정되면 이동하세요.',
    plague: '플레이어 주변에 독 장판을 예고합니다. 표시된 원에서 빠져나와 싸우세요.',
    brood: '추종자를 소환하고 가까운 적을 충격파로 밀어냅니다. 광역 마법으로 소환수를 정리하세요.',
    storm: '회전하는 탄막과 충격파를 사용합니다. 탄막 사이의 틈을 따라 움직이세요.',
    reaper: '이동할 자리를 미리 표시한 뒤 순간이동합니다. 표식에서 떨어져 다음 공격을 피하세요.',
  };
  const enemies = Object.values(ENEMY_TYPES).filter(enemy => enemy.kind !== 4);
  const bosses = Object.values(BOSS_TYPES);
  return `<section class="encounter-reference" aria-label="적과 수호자 도감"><details class="encounter-section"><summary tabindex="0">${icon('skull')} 몬스터 도감 <span>${enemies.length}종</span>${icon('chevron')}</summary><p class="encounter-intro">층이 깊어지면 새 적이 기존 군단에 합류합니다. 서로 다른 예고를 구분해 우선순위를 정하세요.</p><div class="encounter-grid">${enemies.map(enemy => `<article class="encounter-card" data-enemy-kind="${enemy.kind}" style="--encounter:${escapeHTML(enemy.color || '#a5c681')}"><div class="encounter-symbol">${icon(enemyIcons[enemy.kind] || 'skull')}</div><div><small>${enemy.unlockStage}층부터 등장</small><h3>${escapeHTML(enemy.name)}</h3><p>${escapeHTML(enemy.description)}</p><strong>${escapeHTML(enemy.counterplay || enemyCounters[enemy.kind] || '')}</strong></div></article>`).join('')}</div></details><details class="encounter-section"><summary tabindex="0">${icon('trophy')} 수호자 공략 <span>${bosses.length}가지 전투 방식</span>${icon('chevron')}</summary><p class="encounter-intro">${MAX_STAGES}개 층마다 고유한 수호자가 기다립니다. 후반 수호자는 같은 계열의 전투 방식도 더 거세게 사용합니다.</p><div class="encounter-grid">${bosses.map(boss => { const floors = STAGES.map((_, index) => index + 1).filter(stage => getBossDefinition(stage).archetype === boss.id); return `<article class="encounter-card boss-reference-card" data-boss-archetype="${escapeHTML(boss.id)}" style="--encounter:${escapeHTML(boss.color || '#deac8d')}"><div class="encounter-symbol">${icon(boss.id === 'storm' ? 'bolt' : boss.id === 'plague' ? 'fire' : boss.id === 'artillery' ? 'target' : boss.id === 'brood' ? 'skull' : boss.id === 'reaper' ? 'orbit' : 'sword')}</div><div><small>${floors.join(' · ')}층 수호자</small><h3>${escapeHTML(boss.name)}</h3><p>${escapeHTML(boss.hint)}</p><strong>${escapeHTML(bossCounters[boss.id] || '')}</strong></div></article>`; }).join('')}</div></details></section>`;
}

function regionDetails(region) {
  return `<dl class="region-details"><div><dt>${icon('skull')} 위험</dt><dd>${escapeHTML(region.hazard)}</dd></div><div class="regional-reward"><dt>${icon('chest')} 보상</dt><dd>${escapeHTML(region.reward)}</dd></div><div><dt>${icon('shield')} 대응</dt><dd>${escapeHTML(region.counterplay)}</dd></div></dl>`;
}
function currentRegionMarkup() {
  const region = latest?.region || getRegion(latest?.regionId);
  return `<section class="current-region" data-current-region="${escapeHTML(region.id)}" style="--region:${escapeHTML(region.color)}"><div class="current-region-title">${icon(region.icon)}<div><small>CURRENT REGION</small><h3>${escapeHTML(region.title)}</h3></div><span>이번 층에 적용</span></div><p>${escapeHTML(region.description)}</p>${regionDetails(region)}</section>`;
}
function expansionGuide() {
  const mutations = [...MUTATIONS, MUTATION_ELITE];
  return `<section class="encounter-reference expansion-reference" aria-label="지역과 변이 도감"><details class="encounter-section"><summary>${icon('move')} 지역 도감 <span>5개 분기 · 고유 최종 지역</span>${icon('chevron')}</summary><p class="encounter-intro">다음 2–9층은 경로를 고른 뒤 제시된 세 지역 중 하나를 선택합니다. 지역 배율은 경로·계약·저주와 곱해 적용됩니다. 지역 선택만으로 능력치가 오르지 않으며, 유물은 제시된 카드에서 직접 골라야 적용됩니다.</p><div class="region-codex">${REGIONS.map(region => `<article data-region-codex="${escapeHTML(region.id)}" style="--region:${escapeHTML(region.color)}"><div class="current-region-title">${icon(region.icon)}<h3>${escapeHTML(region.title)}</h3><small>${escapeHTML(region.english)}</small></div><p>${escapeHTML(region.description)}</p>${regionDetails(region)}</article>`).join('')}</div></details><details class="encounter-section"><summary>${icon('skull')} 변이 도감 <span>6개 변이 · 복합 정예</span>${icon('chevron')}</summary><p class="encounter-intro">고유 색과 모양의 발밑 표식으로 능력을 구분합니다. 초반 출현율은 낮고 깊은 층으로 갈수록 높아집니다. 공허에서는 복합 변이가 늘어나며, 변이의 추가 골드·경험치는 기존 몬스터 보상에 곱해 지급됩니다.</p><div class="encounter-grid">${mutations.map(mutation => `<article class="encounter-card" data-mutation="${escapeHTML(mutation.id)}" style="--encounter:${escapeHTML(mutation.color)}"><div class="encounter-symbol">${icon(mutation.icon)}</div><div><small>${mutation.id === 'elite' ? '서로 다른 변이 2개' : '고유 표식 1개'}</small><h3>${escapeHTML(mutation.title)}</h3><p>${escapeHTML(mutation.description)}</p><strong>${escapeHTML(mutation.counterplay)}</strong></div></article>`).join('')}</div></details></section>`;
}

function showGuide() {
  if (isChoiceDialog()) return;
  const steps = [
    ['시점과 카메라', '기본은 3인칭입니다. <kbd>V</kbd> / 상단 시점 버튼으로 3인칭→1인칭→항공을 전환합니다. 자유 조준의 가까운 시점에서는 W/S로 전후진하고 A/D로 이동량에 비례해 부드럽게 선회합니다. PC는 전장 드래그로 시점을 돌리고 3인칭에서 휠로 거리를 바꿉니다. 1인칭에서는 전장을 클릭해 마우스를 잠글 수 있고 ESC/메뉴로 해제합니다. 모바일은 왼쪽 드래그·방향 버튼으로 이동, 오른쪽 드래그로 둘러봅니다. 공격은 직접 입력해야 발동하며 바라보는 방향으로 나갑니다. L로 락온/해제, K/J로 대상을 전환합니다. 락온 중 A/D는 적을 바라보며 옆으로 이동합니다. 모바일은 상단 락온·전환 버튼을 사용하세요. F(한글 ㄹ)는 패링, V(한글 ㅍ)는 시점 변경입니다.'],
    ['장비·탐험·정밀 방어', '장비는 <kbd>TAB</kbd> / 장비 버튼에서 비교·교체·버릴 수 있습니다. NPC 가까이에서 <kbd>C</kbd> / 교류로 대화하세요. <kbd>F</kbd> (한/영 무관) 패링은 전방 120°를 0.45초 방어하며 처음 0.16초는 완벽한 패링입니다. 성공하면 4m 충격파·0.1초 히트 스톱·공격한 보스 경직, 2초 안 다음 직접 검 공격은 180° 광역 250% 반격입니다. 재사용 4초, 보스 경직 저항 5초. 붉은 지면 공격은 방어 불가, 청색 직선·일반 탄환은 방어 가능.'],
    ['세 단계 수호자와 끝없는 심연', '보스 체력 70% 미만·35% 미만에서 새로운 패턴과 연계가 열립니다. 보스 장비는 하나 선택하거나 넘길 수 있습니다. 일반 10층 승리 후 모드 선택에서 11층부터 무한 심연을 탐험하세요. 5층마다 재앙 보스, 20층부터 10층마다 교대 제약이 등장합니다. 기록·업적은 이 브라우저에 저장됩니다.'],
    ['전장을 움직이고, 좌클릭 공격 · 우클릭 강공격', '<kbd>W A S D</kbd> / 방향키로 이동, <kbd>SHIFT</kbd>로 무적 대시. 모바일은 방향 버튼이나 전장 드래그를 사용합니다. 좌클릭은 3/5타 콤보, 우클릭은 강공격입니다. 대검은 우클릭을 누른 채 차징합니다. <kbd>Q/E/R</kbd> 배치 스킬, <kbd>X</kbd> 궁극기, <kbd>F</kbd> 패링. 클릭하면 시점이 잠기고, 잠금이 안 되면 휠 버튼 드래그로 시점을 바꿉니다.'],
    ['검 범위도 선택으로 성장합니다', '기본 검은 가까운 적을 베는 무기입니다. <b>검 범위 강화</b>를 고르면 거리 +12%, 최대 8단계까지 늘어납니다. 검 공격력·속도·범위 강화 합계 <b>3단계</b>부터 대검 / 쌍검 / 검기 진화가 등장합니다. 한 런에는 하나의 검 진화를 고릅니다.'],
    ['마법을 키우고 조합을 완성하세요', '레벨업마다 강화 하나를 고릅니다. 검·마법 공격력은 각각 <b>20%</b>, 모션·시전 가속 능력치는 <b>8%</b> (실제 가속 상한 적용), 최대 체력은 <b>15%</b>씩 곱해 성장합니다. 마법은 5단계 뒤 진화합니다. <b>서리 + 검 범위 2단계</b>, <b>화염구 + 검기</b>, <b>번개 + 궤도 룬</b> 조합은 추가 공격을 발동합니다. <kbd>B</kbd>에서 스킬을 배치하고, 이번 런 빌드 버튼에서 조합 조건을 확인하세요.'],
    ['순서와 타이밍으로 전투 연계', '서리로 둔화시킨 적에게 강공격은 추가 피해, 화염 적중 뒤 검격은 작은 폭발, 대시 후 0.8초 안 번개는 직선 관통, 완벽한 패링 후 2초 안 마법은 25% 강화됩니다. 연계는 별도 재사용 제한이 있고 숨겨진 진화 조합과 구분됩니다. B에서 조건과 정확한 수치를 확인하세요.'],
    ['야영지에서 부담 없이 연습하세요', '성역 훈련장에서 무기·마법 단계·몬스터를 골라 실제 전투를 연습하세요. 이미 만난 보스의 패턴도 연습할 수 있습니다. 훈련의 체력·스킬 대기시간·재화·통계는 모험과 분리되며 종료하면 원래 상태가 복원됩니다.'],
    ['언덕과 폐허를 탐험하세요', '넓어진 전장에 언덕과 성당·집·감시탑·관문이 있습니다. 언덕을 오르고 폐허의 문으로 들어갈 수 있습니다. 벽과 탑은 돌아가야 하며, 시야를 가리는 가까운 건물은 흐려집니다.'],
    ['상자는 열자마자 보상을 선택합니다', '수호 몬스터를 처치하고 상자에 가까이 가면 <b>골드를 즉시 받고, 유물 3개 중 하나를 바로 선택</b>합니다. 정예의 유물 선택권과 보스의 유산은 다음 레벨업의 네 번째 선택 후보가 됩니다. 고른 효과만 적용되며, 선택 중에는 전투가 멈춥니다.'],
    ['위험과 보상을 직접 고르세요', '전장에 나타난 <b>저주 제단</b>에서 적을 더 강하게 만드는 대신 골드 배율을 높일 수 있습니다. 저주는 이번 런 동안 누적되며, <b>받지 않고 지나갈 수도 있습니다.</b> 층을 돌파하면 다음 층의 일반 / 정예 / 보물 경로를 고릅니다. 경로를 고른 뒤 전투할 지역을 고릅니다. 경로·지역의 위험과 보상은 해당 층에만 적용됩니다.'],
    ['같은 층도 다른 지역에서', '경로를 고른 뒤, 서로 다른 <b>지역 3개 중 하나</b>를 선택합니다. 화산·설원·오염된 숲·유적·공허는 적 구성과 환경 위험, 유물 선택지가 다릅니다. 지역 카드에서 확정 보상과 위험을 비교하세요. 최종 10층은 종말의 왕좌입니다.'],
    ['표식으로 변이와 숨겨진 조합을 읽으세요', '변이 몬스터는 고유 색과 발밑 표식으로 구분합니다. 두 가지 표식을 가진 정예 변이는 보상도 커집니다. <b>검 진화 + 마법 진화 + 유물</b> 조건을 갖추면 숨겨진 조합이 해금됩니다. 아래 도감이나 <kbd>B</kbd>에서 조건을 확인하세요.'],
    ['층마다 다른 목표, 그리고 수호자 처치', `1층과 마지막 10층은 <b>90초에 보스 등장 · 2분 생존 + 보스 처치</b>입니다. 다른 층에서는 <b>정예 사냥 · 장치 방어 · 위험 지역 돌파 · 봉인 해제 · 강적 추적 · 소환 의식</b> 중 하나를 완료해야 보스가 등장합니다. 좌측 목표를 눌러 위치·조건·확정 보상을 확인하세요. 장치와 봉인은 가까이에서 C로 작동하며, 방어 실패 시 수리하고 재도전할 수 있습니다. 목표와 보스 처치를 마치면 다음 층으로 갑니다. 다음 층의 기본 골드는 <b>10배</b>, 적 체력은 <b>1.7배</b>, 피해는 <b>1.35배</b>가 됩니다. <b>플레이어 능력치와 체력은 층 이동으로 자동 증가하지 않습니다.</b> ${MAX_STAGES}층의 수호자를 모두 쓰러뜨리세요.`],
    ['죽고 번 골드로 다음 런을 준비하세요', '사망·완주·직접 런 종료 시 번 골드를 회수합니다. 결과에서 피해량과 사망 원인을 확인하고 <b>영구 강화하고 재도전</b>을 누르세요. 검술·마력 가지는 따로 성장하며, 구매 효과는 다음 런부터 적용됩니다. 같은 브라우저에 골드와 강화가 저장됩니다. 전장 오른쪽 위 전체 화면 버튼으로 화면을 넓힙니다.'],
  ];
  openModal('guide', `<div class="modal-eyebrow">FIELD MANUAL / 010</div><h2 id="modal-title">작은 선택이, 거대한 빌드로<span>.</span></h2><p class="modal-description">검의 진화, 마법 조합, 위험한 선택. 다음 런에 도전할 빌드를 찾아보세요.</p><div class="guide-steps">${steps.map(([title, description], index) => `<div><span>${String(index + 1).padStart(2, '0')}</span><div><h3>${title}</h3><p>${description}</p></div></div>`).join('')}</div><div class="guide-bottom">${icon('info')} 수치는 선택 전 카드에 표시됩니다. 저주는 런 전체, 경로와 지역은 다음 한 층에 적용됩니다.</div>${expansionGuide()}${encounterGuide()}`);
}

function pendingRewardSummary(state = latest) {
  const tokens = Math.max(0, Math.floor(Number(state?.rewardTokens) || 0));
  const bosses = Array.isArray(state?.pendingBossRewards) ? state.pendingBossRewards : [];
  if (!tokens && !bosses.length) return '<p class="reward-flow-note">상자는 즉시 유물을 고릅니다. 정예·보스 보상은 다음 레벨업에 추가 선택지를 엽니다.</p>';
  return `<div class="pending-rewards"><span>${icon('diamond')} 다음 레벨업 선택 대기</span><strong>유물 ${tokens}개 · 보스 유산 ${bosses.length}개</strong>${bosses.length ? `<small>${bosses.map(reward => escapeHTML(reward.title)).join(' · ')}</small>` : ''}</div><p class="reward-flow-note">보관한 보상은 레벨업 선택지에 차례로 등장하며, 선택한 효과가 능력치에 적용됩니다.</p>`;
}

function showBuild() {
  if (isChoiceDialog() || dialogName === 'result') return;
  const spells = getSpellStates();
  const stats = latest?.playerStats || {};
  const sword = latest?.sword || getSwordProfile(stats);
  const passiveNames = { power: '검 공격력', haste: '검 모션 가속', blade_range: '검 범위', spell_power: '마법 공격력', spell_haste: '마법 시전 속도', vitality: '생명력', magnet: '획득 범위', critical: '치명타', armor: '방어력', regen: '재생', speed: '이동 속도' };
  const collected = [...RELICS.filter(item => stats.relics?.includes(item.id)), ...BOSS_REWARDS.filter(item => stats.bossRewards?.includes(item.id))];
  const passives = Object.entries(stats.passiveLevels || {}).filter(([, n]) => n > 0);
  const active = new Set(getActiveSynergies(stats).map(item => item.id));
  const curses = CURSES.filter(curse => latest?.activeCurses?.includes(curse.id));
  const route = ROUTES.find(route => route.id === latest?.routeId) || ROUTES[0];
  openModal('build', `<div class="modal-eyebrow">YOUR BUILD / THIS RUN</div><h2 id="modal-title">검과 마법, 당신만의 조합<span>.</span></h2><p class="modal-description">선택한 강화와 유물은 이번 런에만 적용됩니다. 영구 강화는 다음 런에도 유지됩니다.</p><div class="sword-build" style="--blade-color:${escapeHTML(sword.color || '#c1ff66')}"><div class="sword-build-icon">${icon(sword.mode === 'twinblade' ? 'bolt' : sword.mode === 'wave' ? 'move' : 'sword')}</div><div><small>SWORD / ${sword.mode === 'default' ? '진화 전' : '진화 완료'}</small><h3>${escapeHTML(swordNames[sword.mode] || swordNames.default)}</h3><p>타격 거리 <b data-sword-range>${decimal(sword.range, 2)}m</b> · 전방 <b>${Math.round(sword.arc * 180 / Math.PI)}°</b> · 최대 <b>${sword.targets}명</b></p><span>검 공격력·속도·범위 강화 합계 3단계부터 진화 선택 · 한 런에 하나</span></div></div><div class="synergy-codex"><h3>검 · 마법 조합 <small>${active.size} / ${SYNERGIES.length} 발동 중</small></h3>${SYNERGIES.map(synergy => `<article class="synergy-card ${active.has(synergy.id) ? 'active' : ''}" data-synergy="${escapeHTML(synergy.id)}" style="--synergy:${escapeHTML(synergy.color)}"><div>${icon(synergy.icon)}</div><span><small>${active.has(synergy.id) ? '해금 완료 · ' : ''}${escapeHTML(synergy.requirement)}</small><strong>${escapeHTML(synergy.title)}</strong><p>${escapeHTML(synergy.description)}</p></span>${active.has(synergy.id) ? icon('check') : ''}</article>`).join('')}</div>${pendingRewardSummary()}<div class="spell-codex">${spells.map(s => `<div class="codex-card ${s.rank ? '' : 'unowned'}" style="--spell:${escapeHTML(s.color || '#c2f568')}"><div class="codex-icon">${icon(upgradeIcons[s.id])}</div><div><span>${s.evolved ? '진화 완료' : s.rank ? `${s.rank} / 5단계` : '레벨업으로 습득'}</span><h3>${escapeHTML(s.evolved ? s.evolutionName : s.name)}</h3><p>${escapeHTML(s.description)}</p><small>진화 → ${escapeHTML(s.evolutionName)}</small></div></div>`).join('')}</div>${currentRegionMarkup()}${expansionGuide()}<section class="run-conditions"><h3>${icon('skull')} 현재 경로 · 저주</h3><p><b>${escapeHTML(route.title)}</b> · ${escapeHTML(route.description)}</p>${curses.length ? curses.map(curse => `<p><b>${escapeHTML(curse.title)}</b> · ${escapeHTML(curse.description)}</p>`).join('') : '<p>받은 저주가 없습니다. 제단에서는 선택을 건너뛸 수 있습니다.</p>'}</section><div class="relic-build"><h3>유물 · 수호자의 유산</h3>${collected.length ? collected.map(item => `<div>${icon(({ flame: 'fire', snowflake: 'snow' })[item.icon] || item.icon)}<span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.description)}</small></span></div>`).join('') : '<p>상자는 즉시 유물을 고르고, 정예·보스 보상은 다음 레벨업에서 선택합니다.</p>'}</div><div class="passive-build"><h3>검 · 마법 · 생존 강화</h3>${passives.length ? passives.map(([id, n]) => `<span>${icon(upgradeIcons[id])}${escapeHTML(passiveNames[id] || id)} <b>Lv.${n}</b></span>`).join('') : '<p>레벨업으로 검·마법과 생존 능력을 키울 수 있습니다.</p>'}</div><div class="guide-bottom">${icon('info')} 층을 이동해도 플레이어 능력치는 자동으로 증가하지 않습니다.</div>`);
}

function syncBank() {
  $('#bank-gold').textContent = formatGold(progress.bank);
}
function showPermanentUpgrades(fromResult = false) {
  if (isChoiceDialog()) return;
  campFromResult = !!fromResult && !!lastResult;
  const readOnly = !['menu', 'over', 'won', 'camp'].includes(game?.state.phase);
  openModal('permanent', `<div class="modal-eyebrow">THE CAMP / GROW YOUR OWN WAY</div><h2 id="modal-title">당신의 성장에, 가지를 더하세요<span>.</span></h2><p class="modal-description">검술과 마력은 따로 성장합니다. 공격력은 단계마다 ×1.12, 체력은 ×1.10으로 커집니다. 초반 이후에는 강화 단계에 맞춰 비용도 크게 오릅니다. 구매한 강화와 해금은 죽어도 남습니다.</p><div class="permanent-wallet"><div>${icon('coin')}<span>보유 골드</span><strong id="permanent-gold">${formatGold(progress.bank)}</strong></div><span>누적 회수 <b id="lifetime-gold">${formatGold(progress.lifetimeGold)}</b> G</span></div>${readOnly ? `<p class="camp-readonly">${icon('info')} 생존 중에는 빌드를 확인할 수 있습니다. 이번 런의 ${formatGold(latest.gold)} G는 런 종료 후 회수되며, 구매와 장비 변경은 그때 가능합니다.</p>` : '<div class="camp-cycle"><span>런 종료</span> → <strong>골드 회수</strong> → <strong>성장 · 해금</strong> → <span>다시 도전</span></div>'}<div class="camp-tabs" role="tablist" aria-label="캠프 메뉴"><button class="camp-tab" data-camp-tab="tree" role="tab">${icon('orbit')} 성장 트리</button><button class="camp-tab" data-camp-tab="loadout" role="tab">${icon('sword')} 캐릭터 · 무기</button></div><div id="permanent-grid" class="permanent-grid"></div><p class="shop-feedback" id="permanent-feedback" role="status"></p><div class="camp-storage ${progressionWritable ? '' : 'storage-unavailable'}" id="camp-storage">${icon(progressionWritable ? 'check' : 'info')} ${progressionWritable ? '같은 브라우저에 자동 저장됩니다. 구매 효과와 선택 장비는 다음 런부터 적용됩니다.' : '이 창은 브라우저 저장소를 사용할 수 없어 닫으면 기록이 사라집니다. 일반 브라우저의 게임 사이트에서 플레이해 주세요.'}</div>${campFromResult ? `<div class="camp-actions"><button class="primary-button" id="camp-start">${icon('play')} 다음 런 시작 ${icon('arrow')}</button><button class="secondary-button" id="camp-resultback">결과 보기</button></div>` : ''}`, { closeable: true });
  for (const button of document.querySelectorAll('[data-camp-tab]')) button.addEventListener('click', () => { campTab = button.dataset.campTab; renderPermanentUpgrades(readOnly); });
  renderPermanentUpgrades(readOnly);
  $('#camp-start')?.addEventListener('click', startRun);
  $('#camp-resultback')?.addEventListener('click', showResult);
}
function saveCampProgress(next) {
  progress = next; progressionWritable = persistProgress();
  game.setPermanentBonuses(getPermanentBonuses(progress)); syncBank(); syncLoadout();
}
function renderPermanentUpgrades(readOnly) {
  $('#permanent-gold').textContent = formatGold(progress.bank);
  document.querySelectorAll('[data-camp-tab]').forEach(button => {
    button.classList.toggle('selected', button.dataset.campTab === campTab);
    button.setAttribute('aria-selected', String(button.dataset.campTab === campTab));
  });
  const grid = $('#permanent-grid');
  grid.className = 'permanent-grid camp-content';
  if (campTab === 'loadout') {
    const offers = getUnlockOffers(progress);
    grid.innerHTML = ['character', 'weapon'].map(type => `<section class="unlock-section"><div class="unlock-heading"><h3>${type === 'character' ? '캐릭터' : '시작 무기'}</h3><span>${type === 'character' ? '강점과 약점이 다른 전투 방식' : '속도 · 공격력 · 범위의 선택'}</span></div><div class="unlock-grid">${offers.filter(item => item.type === type).map(item => `<button class="unlock-card ${item.selected ? 'selected' : ''}" data-unlock-type="${item.type}" data-unlock-id="${item.id}" ${readOnly || item.selected || (!item.unlocked && !item.canAfford) ? 'disabled' : ''}><span class="unlock-icon">${icon(item.icon)}</span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.description)}</small><span class="unlock-action">${item.selected ? `${icon('check')} 선택 중` : item.unlocked ? '다음 런에 사용' : `${icon('coin')} ${formatGold(item.cost)} G · 해금`}</span></button>`).join('')}</div></section>`).join('');
    grid.querySelectorAll('[data-unlock-type]').forEach(button => button.addEventListener('click', () => {
      if (!['menu', 'over', 'won', 'camp'].includes(game.state.phase)) return;
      const { unlockType: type, unlockId: id } = button.dataset;
      const offer = getUnlockOffers(progress).find(item => item.type === type && item.id === id);
      const result = offer?.unlocked ? selectLoadout(progress, type, id) : purchaseUnlock(progress, type, id);
      if (result?.success) saveCampProgress(result.progress);
      renderPermanentUpgrades(readOnly);
      $('#permanent-feedback').textContent = result?.success ? offer.unlocked ? '장비 선택 완료. 다음 런부터 적용됩니다.' : '해금 완료. 한 번 더 눌러 다음 런에 사용할 수 있습니다.' : '해금할 골드가 부족합니다.';
      sound(result?.success ? 760 : 180, .15);
    }));
    return;
  }
  const offers = getPermanentUpgradeOffers(progress);
  const percent = value => Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  const card = offer => `<button class="permanent-card skill-node ${offer.locked ? 'locked' : ''} ${offer.level > 0 ? 'learned' : ''}" data-permanent-buy="${escapeHTML(offer.id)}" data-branch="${offer.branch}" ${readOnly || offer.locked || !offer.canAfford || offer.cost === null ? 'disabled' : ''}><span class="permanent-card-top"><span class="permanent-card-icon">${icon(upgradeIcons[offer.id] || offer.icon || 'diamond')}</span><span class="permanent-level">LV. ${offer.level}<small>/ ${offer.maxLevel}</small></span></span><strong>${escapeHTML(offer.name)}</strong><span class="permanent-description">${escapeHTML(offer.description)}</span>${offer.locked ? `<span class="node-requirement">${escapeHTML(offer.requirementsText || '앞의 뿌리 강화를 먼저 구매하세요')}</span>` : ''}<span class="permanent-bonus"><span>+${percent(offer.currentBonus)}${escapeHTML(offer.unit || '%')}</span>${icon('arrow')}<b>+${percent(offer.nextBonus)}${escapeHTML(offer.unit || '%')}</b></span><span class="permanent-price">${offer.locked ? '선행 강화 필요' : offer.cost === null ? `${icon('check')} 강화 완료` : `${icon('coin')} ${formatGold(offer.cost)} G`}</span></button>`;
  grid.innerHTML = `<div class="skill-tree"><div class="tree-origin">${icon('diamond')}<span>회수한 골드<strong>나만의 성장</strong></span></div><div class="tree-branches">${['sword', 'magic'].map(branch => { const branchOffers = offers.filter(offer => offer.branch === branch); return `<section class="skill-branch ${branch}"><h3>${icon(branch === 'sword' ? 'sword' : 'orbit')} ${branch === 'sword' ? '검술의 길' : '마력의 길'}</h3><div class="branch-root">${card(branchOffers[0])}</div><div class="branch-children">${branchOffers.slice(1).map(card).join('')}</div></section>`; }).join('')}</div><div class="core-heading"><span></span>${icon('heart')} 생존 · 탐험<span></span></div><div class="core-nodes">${offers.filter(offer => offer.branch === 'core').map(card).join('')}</div></div>`;
  grid.querySelectorAll('[data-permanent-buy]').forEach(button => button.addEventListener('click', () => {
    if (!['menu', 'over', 'won', 'camp'].includes(game.state.phase)) return;
    const id = button.dataset.permanentBuy;
    const result = purchasePermanentUpgrade(progress, id);
    if (result.success) saveCampProgress(result.progress);
    renderPermanentUpgrades(readOnly);
    $('#permanent-feedback').textContent = result.success ? '영구 강화 완료. 다음 런부터 적용되며 사망해도 유지됩니다.' : result.reason === 'prerequisite' ? '앞의 뿌리 강화를 먼저 구매하세요.' : '골드가 부족하거나 최대 단계에 도달했습니다.';
    if (!progressionWritable) { $('#camp-storage').classList.add('storage-unavailable'); $('#camp-storage').textContent = '브라우저 저장을 사용할 수 없습니다. 이 창을 닫으면 기록이 사라집니다.'; }
    sound(result.success ? 760 : 180, .15);
    document.querySelector(`[data-permanent-buy="${id}"]:not(:disabled)`)?.focus({ preventScroll: true });
  }));
}
function syncLoadout() {
  const character = CHARACTERS.find(item => item.id === progress.loadout?.character) || CHARACTERS[0];
  const weapon = WEAPONS.find(item => item.id === progress.loadout?.weapon) || WEAPONS[0];
  $('#selected-loadout').textContent = `${character.name} · ${weapon.name}`;
}
function syncRisk() {
  const pact = getRiskStats(prefs.risk);
  $('#risk-description').textContent = pact.description;
  document.querySelectorAll('[data-risk]').forEach(button => {
    const selected = button.dataset.risk === prefs.risk;
    button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
  });
}
function showHistory() {
  if (isChoiceDialog()) return;
  chronicleUI?.history();
}
function showSettings() {
  if (isChoiceDialog()) return;
  openModal('settings', `<div class="modal-eyebrow">MAKE IT YOURS</div><h2 id="modal-title">플레이 설정<span>.</span></h2><p class="modal-description">당신의 리듬에 맞춰 즐기세요.</p><div class="setting-row"><div><h3>${icon('sound')} 효과음</h3><p>처치, 레벨업, 스테이지 전환 효과음</p></div><button id="setting-sound" class="toggle ${!prefs.muted ? 'on' : ''}" role="switch" aria-checked="${!prefs.muted}" aria-label="효과음"><span></span></button></div><div class="setting-row"><div><h3>${icon('diamond')} 그래픽 품질</h3><p>낮음 모드는 그림자와 렌더링 해상도를 줄입니다.</p></div><div class="segmented"><button data-quality="low" class="${prefs.quality === 'low' ? 'selected' : ''}">낮음</button><button data-quality="medium" class="${prefs.quality === 'medium' ? 'selected' : ''}">중간</button><button data-quality="high" class="${prefs.quality === 'high' ? 'selected' : ''}">높음</button></div></div><div class="guide-bottom">${icon('check')} 설정은 자동으로 저장됩니다.</div>`);
  $('#setting-sound').addEventListener('click', (event) => {
    prefs.muted = !prefs.muted; syncSound(); sound(600);
    event.currentTarget.classList.toggle('on', !prefs.muted); event.currentTarget.setAttribute('aria-checked', String(!prefs.muted));
  });
  for (const button of document.querySelectorAll('[data-quality]')) button.addEventListener('click', () => {
    prefs.quality = button.dataset.quality; game.setQuality(prefs.quality); store('voidrun.preferences', prefs);
    document.querySelectorAll('[data-quality]').forEach(b => b.classList.toggle('selected', b.dataset.quality === prefs.quality));
  });
  $('#modal').insertAdjacentHTML('beforeend', `<div class="setting-row"><div><h3>카메라 흔들림</h3><p>피격·패링·반격의 흔들림 강도</p></div><div class="segmented" aria-label="카메라 흔들림">${[[0,'끄기'],[.5,'약하게'],[1,'기본']].map(([v,n])=>`<button data-camera-shake="${v}" aria-pressed="${accessibility().cameraShake===v}" class="${accessibility().cameraShake===v?'selected':''}">${n}</button>`).join('')}</div></div><div class="setting-row"><div><h3>패링 섬광·강한 효과</h3><p>끄면 밝은 빛을 제거합니다. 판정 표시는 유지됩니다.</p></div><div class="segmented" aria-label="패링 시각 효과">${[[0,'끄기'],[.35,'줄이기'],[1,'기본']].map(([v,n])=>`<button data-parry-effects="${v}" aria-pressed="${accessibility().effectIntensity===v}" class="${accessibility().effectIntensity===v?'selected':''}">${n}</button>`).join('')}</div></div>`);
  $('#modal').insertAdjacentHTML('beforeend', `<div class="setting-row"><div><h3>카메라 시점</h3><p>V키 · 한/영 무관 · 선택은 자동 저장</p></div><div class="segmented" aria-label="카메라 시점">${VIEW_MODES.map(mode=>`<button data-view-mode="${mode}" aria-pressed="${game.view.mode===mode}">${VIEW_LABELS[mode]}</button>`).join('')}</div></div>`);
  document.querySelectorAll('[data-view-mode]').forEach(b=>b.onclick=()=>game.setViewMode(b.dataset.viewMode));
  for (const [selector,key] of [['data-camera-shake','cameraShake'],['data-parry-effects','effectIntensity']]) document.querySelectorAll(`[${selector}]`).forEach(b=>b.onclick=()=>{prefs[key]=Number(b.getAttribute(selector));game.setAccessibility(accessibility());store('voidrun.preferences',prefs);document.querySelectorAll(`[${selector}]`).forEach(x=>{const on=Number(x.getAttribute(selector))===prefs[key];x.classList.toggle('selected',on);x.setAttribute('aria-pressed',String(on));});});
  $('#modal').insertAdjacentHTML('beforeend', `<div class="setting-row audio-mix"><div><h3>효과음 음량</h3><p>검·마법·피격·UI</p></div><label><input type="range" min="0" max="1" step="0.05" id="effects-volume" aria-label="효과음 음량" value="${game.soundscape.effectsVolume}"><output id="effects-volume-value">${Math.round(game.soundscape.effectsVolume*100)}%</output></label></div><div class="setting-row audio-mix"><div><h3>배경·환경음 음량</h3><p>지역별 바람과 낮은 화음</p></div><label><input type="range" min="0" max="1" step="0.05" id="background-volume" aria-label="배경 환경음 음량" value="${game.soundscape.backgroundVolume}"><output id="background-volume-value">${Math.round(game.soundscape.backgroundVolume*100)}%</output></label></div>`);
  for(const [id,key] of [['effects-volume','effectsVolume'],['background-volume','backgroundVolume']]) $('#'+id).addEventListener('input',e=>{prefs[key]=Number(e.target.value);$('#'+id+'-value').textContent=Math.round(prefs[key]*100)+'%';game.setAudioVolumes(prefs.effectsVolume??.7,prefs.backgroundVolume??.3);store('voidrun.preferences',prefs);});
  actionUi?.settings();
  const canReset = ['menu', 'over', 'won', 'camp'].includes(game.state.phase);
  $('#modal').insertAdjacentHTML('beforeend', `<div class="reset-settings"><h3>게임 저장 데이터 초기화</h3><p>보유 골드·영구 강화·캐릭터와 무기 해금·런 기록을 모두 삭제합니다. 사운드와 그래픽 설정은 유지됩니다.</p><button class="secondary-button reset-danger" id="reset-save" ${canReset ? '' : 'disabled'}>저장 데이터 초기화</button>${canReset ? '' : '<p>진행 중인 런을 종료한 뒤 초기화할 수 있습니다.</p>'}</div>`);
  $('#reset-save').addEventListener('click', showResetConfirmation);
}

function showResetConfirmation() {
  if (!['menu', 'over', 'won', 'camp'].includes(game.state.phase)) return;
  openModal('reset', `<div class="modal-eyebrow">START FRESH</div><h2 id="modal-title">정말 처음부터 시작할까요<span>?</span></h2><p class="modal-description">이 브라우저의 <b>골드·영구 강화·캐릭터와 무기 해금·선택 장비·모든 런 기록</b>이 삭제됩니다. 삭제한 데이터는 되돌릴 수 없습니다.</p><p id="reset-feedback" role="status"></p><button class="secondary-button" id="reset-cancel">취소하고 돌아가기</button><button class="secondary-button reset-danger" id="reset-confirm">모두 삭제하고 처음부터 시작</button>`);
  $('#reset-cancel').addEventListener('click', showSettings);
  // Put focus on the safe choice; opening the dialog never deletes anything.
  $('#reset-cancel').focus({ preventScroll: true });
  $('#reset-confirm').addEventListener('click', () => {
    if (!['menu', 'over', 'won', 'camp'].includes(game.state.phase)) return;
    const keys = ['voidrun.progression', 'voidrun.history', 'voidrun.endgame', 'voidrun.story'];
    let previous;
    try {
      previous = keys.map(key => localStorage.getItem(key));
      localStorage.setItem(keys[0], JSON.stringify(createProgress()));
      localStorage.setItem(keys[1], '[]');
      localStorage.setItem(keys[2], JSON.stringify(normalizeEndgame()));
      localStorage.setItem(keys[3], JSON.stringify(normalizeStory()));
    } catch {
      if (previous) for (let i = 0; i < keys.length; i++) {
        try { if (previous[i] === null) localStorage.removeItem(keys[i]); else localStorage.setItem(keys[i], previous[i]); } catch { /* Keep the dialog open if storage is unavailable. */ }
      }
      $('#reset-feedback').textContent = '저장소에 접근할 수 없어 초기화하지 못했습니다. 브라우저 저장 설정을 확인해 주세요.';
      return;
    }
    // Reload also discards ended-run receipts and temporary combat state in memory.
    location.reload();
  });
}
function showPause() {
  if (['playing', 'paused'].includes(latest?.phase) && !dialogName) {
    pausedForDialog = true;
    game.pause();
    openModal('pause', `<div class="modal-eyebrow">TAKE A BREATH</div><h2 id="modal-title">잠깐, 숨 고르기<span>.</span></h2><p class="modal-description">공허는 당신을 기다려줍니다.</p><div class="pause-stats"><div><span>스테이지</span><strong>${latest.stage} <small>/ ${latest.mode === 'abyss' ? '∞' : MAX_STAGES}</small></strong></div><div><span>생존 시간</span><strong>${time(latest.elapsed)}</strong></div><div><span>처치 수</span><strong>${latest.kills}</strong></div></div>${latest?.boss?.hp > 0 ? `<div class="pause-boss-tip">${icon('skull')}<span><strong>${escapeHTML(latest.boss.name)}</strong>${escapeHTML(latest.boss.hint || getBossDefinition(latest.stage).hint)}</span></div>` : ''}<button id="resume" class="primary-button">${icon('play')} 계속 플레이 ${icon('arrow')}</button><button id="pause-settings" class="secondary-button">${icon('settings')} 사운드 · 그래픽 설정</button><button id="pause-restart" class="secondary-button">${icon('refresh')} 런 종료하고 골드 회수</button>`, { pause: false });
    $('#resume').addEventListener('click', closeModal); $('#pause-settings').addEventListener('click', showSettings); $('#pause-restart').addEventListener('click', () => game.endRun());
  } else if (dialogName === 'pause') closeModal();
}
function onLevelUp(choices) {
  sound(880, .25, .08);
  const hasBonus = choices.some(choice => ['relic', 'boss'].includes(choice.category));
  const categoryLabel = choice => {
    if (choice.category === 'relic') return '유물 선택';
    if (choice.category === 'boss') return '보스 유산 선택';
    if (choice.category === 'evolution') return '마법 진화';
    if (choice.category === 'blade-evolution') return '검 진화 · 하나만 선택';
    if (choice.category === 'blade') return '검 전용 강화';
    if (choice.category === 'spell') return choice.spellId ? choice.rank === 1 ? '새 마법 습득' : '마법 강화' : '마법 전용 강화';
    return '생존 강화';
  };
  const sourceLabel = choice => {
    if (choice.category === 'boss') return `${choice.sourceStage || choice.stage || ''}층 수호자의 보관 유산`;
    if (choice.category !== 'relic') return '';
    return typeof choice.source === 'string' ? choice.source : choice.source?.name || '정예 보관 보상';
  };
  openModal('upgrade', `<div class="modal-eyebrow">LEVEL ${game?.state.level || latest?.level || ''} / CHOOSE YOUR GROWTH</div><h2 id="modal-title">이번 성장을, 직접 고르세요<span>.</span></h2><p class="modal-description">${hasBonus ? '강화와 보관 보상 중 하나를 선택하세요. 유물·보스 유산도 선택한 효과만 이번 런에 적용됩니다.' : '새 마법이나 강화를 하나 선택해 이번 런의 능력치를 키우세요.'}</p><div class="upgrade-grid ${choices.length > 3 ? 'has-bonus' : ''}">${choices.map((choice, index) => `<button class="upgrade-card ${escapeHTML(choice.rarity || 'rare')} ${escapeHTML(choice.category)} ${['relic', 'boss'].includes(choice.category) ? 'reward-choice' : ''}" data-upgrade="${escapeHTML(choice.id)}" data-upgrade-category="${escapeHTML(choice.category)}"><div class="upgrade-card-top"><span>${categoryLabel(choice)}</span><kbd>${index + 1}</kbd></div><div class="upgrade-icon">${icon(upgradeIcon(choice))}</div>${choice.maxRank && choice.rank ? `<div class="upgrade-rank">${choice.rank} / ${choice.maxRank}</div>` : ''}<h3>${escapeHTML(choice.title)}</h3>${sourceLabel(choice) ? `<small class="upgrade-source">${escapeHTML(sourceLabel(choice))}</small>` : ''}<p>${escapeHTML(choice.description)}</p><span class="upgrade-select">${['evolution', 'blade-evolution'].includes(choice.category) ? '진화시키기' : '선택하기'} ${icon('arrow')}</span></button>`).join('')}</div><div class="guide-bottom">${icon('info')} 선택 중에는 전투가 멈춥니다. 숫자 키 1–${choices.length} · 이번 레벨업에서 하나만 선택합니다.</div>`, { pause: false, closeable: false });
  $('#modal').classList.toggle('four-choices', choices.length > 3);
  document.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => {
    if (!game.chooseUpgrade(button.dataset.upgrade)) return;
    if(dialogName==='upgrade'){forceCloseModal();$('#game-canvas').focus({preventScroll:true});}else $('#modal').focus({preventScroll:true});sound(660,.15);
  }));
}
function commitEventChoice(button, selector, choose) {
  const previousDialog = dialogName;
  if (!choose(button.dataset[selector])) return;
  if (dialogName === previousDialog) {
    forceCloseModal();
    $('#game-canvas').focus({ preventScroll: true });
  }
  sound(720, .16);
}
function onChestReward(choices, metadata = {}) {
  sound(960, .22, .06);
  const gold = Number(metadata.gold) || 0;
  openModal('relic', `<div class="modal-eyebrow">CHEST OPENED / PICK YOUR RELIC</div><h2 id="modal-title">보물은, 지금 당신의 것<span>.</span></h2><p class="modal-description">${escapeHTML(metadata.source || '보물상자')}에서 유물 하나를 고르세요. 레벨업을 기다리지 않고 바로 적용됩니다.</p><div class="chest-gold-receipt">${icon('coin')}<span>상자 골드 획득 완료</span><strong>+${formatGold(gold)} G</strong></div><div class="upgrade-grid">${choices.map((choice, index) => `<button class="upgrade-card relic-card ${escapeHTML(choice.rarity || 'rare')}" data-chest-relic="${escapeHTML(choice.id)}"><div class="upgrade-card-top"><span>유물 · 이번 런에 적용</span><kbd>${index + 1}</kbd></div><div class="upgrade-icon">${icon(upgradeIcon(choice))}</div><h3>${escapeHTML(choice.title)}</h3><p>${escapeHTML(choice.description)}</p><span class="upgrade-select">이 유물 받기 ${icon('arrow')}</span></button>`).join('')}</div><div class="guide-bottom">${icon('info')} 골드는 이미 지급되었습니다. 유물은 하나만 선택하며, 선택 중에는 전투가 멈춥니다.</div>`, { pause: false, closeable: false });
  document.querySelectorAll('[data-chest-relic]').forEach(button => button.addEventListener('click', () => commitEventChoice(button, 'chestRelic', id => game.chooseChestReward(id))));
}
function eventMetrics(choice) {
  return `<dl class="event-metrics"><div class="reward"><dt>${icon('coin')} 골드</dt><dd>${percentGain(choice.goldMultiplier)}</dd></div><div><dt>적 체력</dt><dd>${percentGain(choice.enemyHealth)}</dd></div><div><dt>적 피해</dt><dd>${percentGain(choice.enemyDamage)}</dd></div></dl>`;
}
function onRoute(choices, metadata = {}) {
  const stage = metadata.stage || Math.min(MAX_STAGES, (latest?.stage || 1) + 1);
  openModal('route', `<div class="modal-eyebrow">FLOOR ${stage} / CHOOSE YOUR PATH</div><h2 id="modal-title">다음 전장, 어떤 길로 갈까<span>.</span></h2><p class="modal-description">다음 ${stage}층의 위험도를 고르세요. ${stage < MAX_STAGES ? '이어서 전투할 지역을 선택합니다.' : '최종 지역은 종말의 왕좌입니다.'} 현재 체력과 빌드를 이어 갑니다.</p><div class="upgrade-grid event-grid">${choices.map((choice, index) => `<button class="upgrade-card route-card ${choice.id === 'standard' ? 'standard' : choice.id === 'elite' ? 'epic' : 'legendary'}" data-route="${escapeHTML(choice.id)}"><div class="upgrade-card-top"><span>${choice.id === 'standard' ? '추가 위험 없음' : '위험과 보상 증가'}</span><kbd>${index + 1}</kbd></div><div class="upgrade-icon">${icon(choice.icon || (choice.id === 'elite' ? 'skull' : choice.id === 'treasure' ? 'diamond' : 'move'))}</div><h3>${escapeHTML(choice.title)}</h3><p>${escapeHTML(choice.description)}</p>${eventMetrics(choice)}<span class="upgrade-select">${stage < MAX_STAGES ? '지역 선택으로' : '최종 지역 진입'} ${icon('arrow')}</span></button>`).join('')}</div><div class="guide-bottom">${icon('info')} 경로 효과는 다음 한 층에만 적용됩니다. 이미 받은 저주와 출발 계약은 계속 유지됩니다.</div>`, { pause: false, closeable: false });
  document.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click', () => commitEventChoice(button, 'route', id => game.chooseRoute(id))));
}
function objectivePreview(stage, regionId) {
  const objective = OBJECTIVE_TYPES[objectiveFor(stage, regionId, game._state.runId)];
  return `<p class="region-objective"><b>층 목표 · ${escapeHTML(objective.name)}</b><br>${escapeHTML(objective.hint)}${objective.reward ? `<br>완료 보상 · 기본 골드 ×${objective.reward} 상당 (지역·위험 배율 적용)` : ''}</p>`;
}
function onRegion(choices, metadata = {}) {
  const stage = metadata.stage || Math.min(MAX_STAGES, (latest?.stage || 1) + 1);
  const route = ROUTES.find(item => item.id === metadata.routeId) || ROUTES[0];
  const opened = openModal('region', `<div class="modal-eyebrow">FLOOR ${stage} / CHOOSE YOUR REGION</div><h2 id="modal-title">세 갈래 전장, 하나의 선택<span>.</span></h2><p class="modal-description">전투 방식과 필요한 유물을 보고 다음 지역을 고르세요. <b>${escapeHTML(route.title)}</b>을 선택했습니다. 아래 지역 배율에 경로·계약·저주 배율이 함께 적용됩니다.</p><div class="region-choice-grid">${choices.map((region, index) => `<button class="region-choice" data-region="${escapeHTML(region.id)}" style="--region:${escapeHTML(region.color)}"><div class="region-preview region-preview-${escapeHTML(region.id)}" aria-hidden="true"><span class="region-preview-orb"></span><span class="region-preview-ridge"></span>${icon(region.icon)}</div><div class="region-choice-body"><div class="region-choice-kicker"><span>${escapeHTML(region.english)}</span><kbd>${index + 1}</kbd></div><h3>${escapeHTML(region.title)}</h3><p>${escapeHTML(region.description)}</p>${eventMetrics(region)}${regionDetails(region)}${objectivePreview(stage,region.id)}<span class="region-enter">이 지역으로 진입 ${icon('arrow')}</span></div></button>`).join('')}</div><div class="guide-bottom">${icon('info')} 지역은 다음 한 층에만 적용됩니다. 선택 중 전투는 멈추며, 체력과 빌드는 그대로 이어집니다.</div>`, { pause: false, closeable: false });
  if (!opened) return;
  document.querySelectorAll('[data-region]').forEach(button => button.addEventListener('click', () => commitEventChoice(button, 'region', id => game.chooseRegion(id))));
}

function onCurse(choices, metadata = {}) {
  const count = latest?.activeCurses?.length || 0;
  openModal('curse', `<div class="modal-eyebrow">CURSED ALTAR / RISK IS A CHOICE</div><h2 id="modal-title">더 위험하게, 더 탐욕스럽게<span>.</span></h2><p class="modal-description">저주를 받으면 지금 있는 적부터 강해집니다. 추가 골드와 위험은 <b>이번 런이 끝날 때까지</b> 유지됩니다.${count ? ` 이미 받은 저주 ${count}개와 곱해 적용됩니다.` : ''}</p><div class="upgrade-grid event-grid">${choices.map((choice, index) => `<button class="upgrade-card curse-card" data-curse="${escapeHTML(choice.id)}"><div class="upgrade-card-top"><span>런 종료까지 유지</span><kbd>${index + 1}</kbd></div><div class="upgrade-icon">${icon(choice.icon || 'skull')}</div><h3>${escapeHTML(choice.title)}</h3><p>${escapeHTML(choice.description)}</p>${eventMetrics(choice)}<span class="upgrade-select">이 저주 받기 ${icon('arrow')}</span></button>`).join('')}</div><button class="secondary-button curse-skip" data-curse="skip">${icon('shield')} 저주 없이 계속하기 <kbd>0</kbd></button><div class="guide-bottom">${icon('info')} 선택 중에는 전투가 멈춥니다. 저주는 강제가 아니며, 이 제단은 한 번만 사용할 수 있습니다.</div>`, { pause: false, closeable: false });
  document.querySelectorAll('[data-curse]').forEach(button => button.addEventListener('click', () => commitEventChoice(button, 'curse', id => game.chooseCurse(id))));
}

function finish(state, won) {
  endgame = recordEndgame(endgame, state, won); store('voidrun.endgame', endgame); game.abyssUnlocked = endgame.unlocked;
  const settlement = settleRun(progress, { runId: state.runId, gold: state.gold });
  progress = settlement.progress; progressionWritable = persistProgress(); syncBank();
  lastResult = { state, won, settlement };
  if (!settlement.duplicate) {
  const record = { analytics: state.analytics, mode: state.mode, runId: state.runId, stage: state.stage, elapsed: state.elapsed, kills: state.kills, gold: Math.floor(state.gold), level: state.level, won, date: new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date()) };
  history.unshift(record); history = history.slice(0, 30); store('voidrun.history', history);
  $('#history-count').textContent = String(history.length).padStart(2, '0');
  $('#personal-best').textContent = `${Math.max(...history.map(r => r.stage))} 스테이지`;
  }
  sound(won ? 1040 : 160, .5, .08);
  showResult();
}
function runReportMarkup(state) {
  const report = state.runReport || {};
  const rows = Object.entries(state.analytics?.damage || report.damageBySource || {}).map(([id, value]) => [id, Math.max(0, Number(value) || 0)]).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  const cause = typeof report.deathCause === 'string' ? report.deathCause : report.deathCause?.name || report.deathCause?.label || report.deathCause?.type;
  const conclusion = state.phase === 'won' ? '모든 수호자 격파' : state.endedReason === 'abandoned' ? '직접 런 종료' : cause || '전투 중 쓰러짐';
  const affordable = getPermanentUpgradeOffers(progress).filter(offer => offer.canAfford && !offer.locked && offer.cost !== null);
  const triggerCount = typeof report.synergyTriggers === 'number' ? report.synergyTriggers : Object.values(report.synergyTriggers || {}).reduce((sum, count) => sum + (Number(count) || 0), 0);
  const routeHistory = Array.isArray(report.routeHistory) ? report.routeHistory : [];
  const regionHistory = Array.isArray(report.regionHistory) ? report.regionHistory : [];
  return `<section class="run-report" aria-label="런 전투 분석"><div class="report-heading"><h3>${icon('target')} 이번 런 분석</h3><span>실제 준 피해 기준</span></div><div class="report-damage">${rows.length ? rows.map(([id, damage]) => `<div class="damage-row" data-damage-source="${escapeHTML(id)}"><div><span>${escapeHTML(sourceName[id] || '기타')}</span><strong>${formatGold(damage)} <small>${Math.round(damage / total * 100)}%</small></strong></div><div class="damage-track"><i style="width:${damage / total * 100}%;--damage-color:${({ sword: '#c1ff66', fireball: '#ffac61', frost: '#80e6f8', lightning: '#e3c0ff', orbit: '#a8ffc3', combo: '#ffd57c' })[id] || '#9fae8d'}"></i></div></div>`).join('') : '<p>적에게 피해를 주면 검·마법별 기여도가 기록됩니다.</p>'}</div><div class="report-facts"><div><span>받은 피해</span><strong>${decimal(report.damageTaken)}</strong></div><div><span>최고 연속 처치</span><strong>${Math.floor(report.peakCombo || state.combo || 0)}×</strong></div><div><span>조합 발동</span><strong>${Math.floor(triggerCount)}회</strong></div></div><p class="death-cause" data-death-cause>${icon(state.phase === 'won' ? 'trophy' : 'skull')}<span>런 종료 원인 <b>${escapeHTML(conclusion)}</b></span></p>${routeHistory.length ? `<details class="report-path"><summary>지역 · 경로 · 저주 기록 보기</summary>${regionHistory.length ? `<p data-region-history>지역: ${regionHistory.map((entry, index) => `${entry.stage || index + 1}층 ${escapeHTML(getRegion(entry.regionId || entry.id).title)}`).join(' → ')}</p>` : ''}<p>${routeHistory.map((entry, index) => { const id = typeof entry === 'string' ? entry : entry.routeId || entry.id || entry.route; const route = ROUTES.find(item => item.id === id); return `${typeof entry === 'object' ? entry.stage || index + 1 : index + 1}층 ${escapeHTML(route?.title || id || '일반 구역')}`; }).join(' → ')}</p><p>${(report.curseIds || []).map(id => escapeHTML(CURSES.find(curse => curse.id === id)?.title || id)).join(' · ') || '받은 저주 없음'}</p></details>` : ''}${analyticsMarkup(state.analytics,{damage:false})}</section><p class="affordable-upgrades" data-affordable-count="${affordable.length}">${icon('coin')}${affordable.length ? `현재 지갑으로 <b>${affordable.length}종</b>의 영구 강화를 구매할 수 있습니다.` : '회수한 골드를 모아 다음 영구 강화를 준비하세요.'}</p>`;
}

function showResult() {
  if (!lastResult) return;
  const { state, won, settlement } = lastResult;
  campFromResult = false;
  openModal('result', `<div class="result-emblem">${icon(won ? 'trophy' : 'skull')}</div><div class="modal-eyebrow">${won ? 'THE VOID IS YOURS' : 'DEATH IS PROGRESS'}</div><h2 id="modal-title">${won ? '공허를 정복했습니다' : state.endedReason === 'abandoned' ? '돌아와서, 더 강하게' : '쓰러져도, 성장은 남습니다'}<span>.</span></h2><p class="modal-description">${won ? `${MAX_STAGES}층의 모든 수호자를 돌파했습니다. 회수한 골드로 다음 도전을 준비하세요.` : `${getRegion(state.regionId).title}에서 여정을 마쳤습니다. 번 골드는 잃지 않았습니다.`}</p><div class="settlement-panel"><span>${icon('coin')} 이번 런 골드 회수</span><strong id="settlement-gold">+${formatGold(settlement.amount)} G</strong><small>보유 골드 <b id="result-bank">${formatGold(progress.bank)} G</b> · 영구 강화에 사용할 수 있습니다</small></div><div class="result-stats"><div><span>생존 시간</span><strong>${time(state.elapsed)}</strong></div><div><span>처치 수</span><strong>${state.kills}</strong></div><div><span>도달 스테이지</span><strong>${state.stage} / ${state.mode === 'abyss' ? '∞' : MAX_STAGES}</strong></div><div><span>도달 레벨</span><strong>LV. ${state.level}</strong></div></div>${runReportMarkup(state)}<button class="primary-button" id="result-permanent">${icon('coin')} 영구 강화하고 재도전 ${icon('arrow')}</button><button class="secondary-button" id="result-camp">3D 야영지로 돌아가기</button><button class="secondary-button" id="result-story">기록 · 엔딩 선택</button><button class="secondary-button" id="result-modes">탐험 모드 선택 · 심연</button><button class="secondary-button" id="result-records">심연 기록 · 업적</button><button class="secondary-button" id="retry">${icon('refresh')} 강화 없이 바로 재도전</button><button class="secondary-button" id="result-settings">설정 · 저장 데이터 초기화</button>`, { pause: false, closeable: false });
  $('#result-camp').addEventListener('click', () => {campFromResult = false; chronicleUI.enterCamp();});
  $('#result-story').addEventListener('click', () => chronicleUI.story());
  $('#result-modes').addEventListener('click', () => expansionUI.modes());
  $('#result-records').addEventListener('click', () => expansionUI.records());
  $('#result-permanent').addEventListener('click', () => showPermanentUpgrades(true));
  $('#retry').addEventListener('click', startRun);
  $('#result-settings').addEventListener('click', showSettings);
}
try {
  game = new Game($('#game-canvas'), {
    onRunStart:()=>forceCloseModal(),onUpdate: update,isUIBlocked:()=>!!dialogName,onControlAction:handleControlAction,onSkillSwap:()=>actionUi?.replacement(),onJoystick:data=>actionUi?.joystick(data),onSkillReady:id=>{const b=document.querySelector(`[data-spell="${id}"]`);if(b){b.classList.add('just-ready');setTimeout(()=>b.classList.remove('just-ready'),600);}},
    onPlayerImpact: ({source})=>{const angle=source?Math.atan2(-(source.x-game.player.position.x)*Math.cos(game.view.yaw)+(source.z-game.player.position.z)*Math.sin(game.view.yaw),(source.x-game.player.position.x)*Math.sin(game.view.yaw)+(source.z-game.player.position.z)*Math.cos(game.view.yaw)):0;const el=$('#hit-direction');el.style.setProperty('--hit-angle',`${angle*180/Math.PI}deg`);el.classList.add('active');clearTimeout(impactTimeout);impactTimeout=setTimeout(()=>el.classList.remove('active'),250);},
    onViewChange: view => {prefs.viewMode=view.mode;store('voidrun.preferences',prefs);syncView(view);},
    onLevelUp,
    onChestReward,
    onRoute,
    onRegion,
    onCurse,
    onParry: () => { clearTimeout(parryNoticeTimeout); const notice=$('#parry-callout'); notice.classList.remove('hidden'); notice.classList.toggle('quiet', accessibility().effectIntensity===0); parryNoticeTimeout=setTimeout(()=>notice.classList.add('hidden'),700); },
    onStory: data => store('voidrun.story', data),
    onCampFacility: id => chronicleUI.facility(id),onTrainingMenu:()=>tacticalUi.trainingMenu(),
    onPortal: choices => chronicleUI.portal(choices),
    onRoomChoice: () => chronicleUI.curseRoom(),
    onEquipmentReward: choices => expansionUI.reward(choices),
    onNpc: (type, choices) => expansionUI.npc(type, choices),
    onLoot: message => showToast(typeof message === 'string' ? message : message?.message || message?.title || '새로운 보상을 획득했습니다.'),
    onBoss: boss => {
      game?.view.emphasize();
      showToast(`${boss.name} · ${boss.hint || getBossDefinition(latest?.stage || 1).hint}`);
      sound(130, .5, .08);
    },
    onBossDefeat: () => {
      showToast(game.sideAreas.active ? '선택형 보스 격파! 제단에서 보상을 확인하세요.' : '수호자 격파! 유산은 다음 레벨업에서 선택할 수 있습니다.');
      sound(960, .3, .08);
    },
    onStage: stage => {
      const num = typeof stage === 'number' ? stage : stage.stage;
      $('#banner-title').textContent = getRegion(game?.regionId || (num === MAX_STAGES ? 'throne' : 'sanctum')).title;
      $('#banner-kicker').textContent = `STAGE ${String(num).padStart(2, '0')} / ${game?.mode === 'abyss' ? 'ABYSS · REWARD ' + formatGold(game.stageStats().coinValue) + ' G' : 'REWARD ×' + formatGold(10 ** (num - 1))}`;
      $('#stage-banner p').innerHTML = game?.mode === 'abyss' ? '심연의 깊이가 증가합니다 <span>적 체력 ×1.16 · 피해 ×1.09 · 기본 골드 ×1.22 (상한 적용)</span>' : '보상 ×10 <span>적 체력 ×1.7 · 피해 ×1.35</span>';
      $('#stage-banner').classList.remove('hidden');
      setTimeout(() => $('#stage-banner').classList.add('hidden'), 2600);
      sound(660, .35, .07);
    },
    onGameOver: state => finish(state, false),
    onWin: state => finish(state, true),
  });
  window.__game = game;actionUi=createActionUi({game,openModal,forceCloseModal,notify:showToast,prefs,save:()=>store('voidrun.preferences',prefs),icon,showBuild});actionUi.bind();interactionUi=createInteractionUi(game);$('#mobile-actions').appendChild($('#touch-dash'));game.setBindings(prefs.bindings);game.actions.hasAim=false;
  game.abyssUnlocked = endgame.unlocked;
  expansionUI = createExpansionUi({game, openModal, forceClose: forceCloseModal, closeModal, notify: showToast, readEndgame: () => endgame});
  chronicleUI = createChronicleUi({game, openModal, forceClose:forceCloseModal, closeModal, notify:showToast, showGuide, showBuild, showLoadout:()=>{campTab='loadout';showPermanentUpgrades();}, showTree:()=>{campTab='tree';showPermanentUpgrades();}, startRun, readHistory:()=>history, setRisk:id=>{prefs.risk=id;store('voidrun.preferences',prefs);game.setRiskPact(id);syncRisk();}});
  tacticalUi=createTacticalUi({game,openModal,forceCloseModal,notify:showToast});tacticalUi.bind();
  game.story.load(readStorage('voidrun.story',{}),history,endgame);
  const readyButton = $('#start-button'), readyLabel = readyButton.innerHTML;
  readyButton.disabled = true; readyButton.textContent = '전장 준비 중…'; $('#game-canvas').setAttribute('aria-busy', 'true');
  game.presentation.ready.finally(() => { readyButton.innerHTML = readyLabel; readyButton.disabled = false; $('#game-canvas').setAttribute('aria-busy', 'false'); });
  game.setPermanentBonuses(getPermanentBonuses(progress));
  game.setViewMode(VIEW_MODES.includes(prefs.viewMode)?prefs.viewMode:'third');
  game.setPlaybackSpeed([1, 2, 3].includes(prefs.speed) ? prefs.speed : 1);
  game.setAccessibility(accessibility());
  game.setAudioVolumes(Number.isFinite(prefs.effectsVolume)?prefs.effectsVolume:.7,Number.isFinite(prefs.backgroundVolume)?prefs.backgroundVolume:.3);
  game.setQuality(prefs.quality); syncSound(); syncRisk(); syncLoadout();
  game.setRiskPact?.(prefs.risk);
  if (game.state) update(game.state);
} catch (error) {
  console.error('Unable to initialize game:', error);
  $('#canvas-error').classList.remove('hidden');
  $('#start-button').disabled = true;
}

$('#reload').addEventListener('click', () => location.reload());
$('#start-button').addEventListener('click', startRun);
$('#mode-button').addEventListener('click', () => expansionUI?.modes());
$('#abyss-records-button').addEventListener('click', () => expansionUI?.records());
$('#equipment-button').addEventListener('click', () => { if (!isChoiceDialog()) expansionUI?.inventory(); });
$('#guard-button').addEventListener('pointerdown', e => {e.preventDefault();game?.parry.press();});
$('#interact-npc').addEventListener('click', () => game?.interact());
$('#enter-camp').addEventListener('click', () => {campFromResult = false;chronicleUI?.enterCamp();});
$('#leave-camp').addEventListener('click',()=>{game.camp.leave();game._state.phase='menu';game.emit();});
$('#set-passive').addEventListener('click',()=>{if(!isChoiceDialog())chronicleUI?.setGuide();});
document.querySelectorAll('[data-camp-facility]').forEach(b=>b.addEventListener('click',()=>game.camp.focus(b.dataset.campFacility)));
$('#start-loadout').addEventListener('click', () => { campTab = 'loadout'; showPermanentUpgrades(); });
for (const button of document.querySelectorAll('[data-risk]')) button.addEventListener('click', () => {
  if (!['menu', 'over', 'won', 'camp'].includes(game?.state.phase)) return;
  prefs.risk = button.dataset.risk; store('voidrun.preferences', prefs); game.setRiskPact?.(prefs.risk); syncRisk();
});
$('#sound-toggle').addEventListener('click', () => { prefs.muted = !prefs.muted; syncSound(); sound(600); });
function syncView(view=game?.view.getState()){
  if(!view)return;
  hud('#camera-mode',VIEW_LABELS[view.mode]);
  $('#camera-mode').setAttribute('aria-label',`현재 ${VIEW_LABELS[view.mode]} 시점 · 눌러서 변경 (V)`);
  $('#camera-mode').title='V: 3인칭 → 1인칭 → 항공 · 한/영 무관';
  const active=['playing','camp'].includes(game?._state.phase)&&!game?.camp.suspended;
  $('#view-hint').classList.toggle('hidden',!active||view.mode==='overhead');
  $('#view-reticle').classList.toggle('hidden',!active||view.mode!=='first');
  document.body.dataset.view=game?.view.effectiveMode()||view.mode;
  const targeting=!!game?.lockOn?.target;
  writeText($('#view-hint .desktop-look'), targeting?'락온 중 옆걸음 · 락온 키로 해제':view.locked?'마우스로 캐릭터 회전 · ESC 일시정지':'좌우 입력으로 부드러운 회전 · 클릭으로 조작');
  writeText($('#view-hint .mobile-look'), targeting?'왼쪽 이동 · 락온 버튼으로 해제':'왼쪽 이동 · 오른쪽 드래그 캐릭터 회전');
  document.querySelectorAll('[data-view-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.viewMode===view.mode)));
}
$('#camera-mode').addEventListener('click',event=>{event.preventDefault();game?.view.cycle();$('#game-canvas').focus({preventScroll:true});});
$('#settings').addEventListener('click', showSettings);
$('#pause-button').addEventListener('click', showPause);
$('#game-speed').addEventListener('click', () => {
  prefs.speed = (game.state.playbackSpeed || 1) % 3 + 1;
  game.setPlaybackSpeed(prefs.speed); store('voidrun.preferences', prefs);
});
$('#run-build-button').addEventListener('click',()=>actionUi.loadout());
$('#build-info').addEventListener('click', showBuild);
$('#region-info').addEventListener('click', showBuild);
$('#synergy-status').addEventListener('click', event => { if (event.target.closest('[data-open-build]')) showBuild(); });

function setTheaterMode(active) {
  theaterMode = active;
  document.body.classList.toggle('theater-mode', active);
  $('#fullscreen').setAttribute('aria-pressed', String(active));
  $('#fullscreen').ariaLabel = active ? '전체 화면 닫기' : '전체 화면';
  $('#fullscreen').title = active ? '전체 화면 닫기 (F10)' : '전체 화면 (F10)';
  requestAnimationFrame(() => game?.resize());
}
async function toggleFullscreen() {
  if (theaterMode) {
    setTheaterMode(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
    } catch { /* The viewport layout can always be closed without native support. */ }
    return;
  }
  setTheaterMode(true);
  try {
    const root = document.documentElement;
    if (root.requestFullscreen) await root.requestFullscreen();
    else root.webkitRequestFullscreen?.();
  } catch { /* Safari and embedded browsers retain the full viewport layout. */ }
}
$('#fullscreen').addEventListener('click', toggleFullscreen);
for (const eventName of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(eventName, () => {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) setTheaterMode(false);
});
window.visualViewport?.addEventListener('resize', () => game?.resize());
for (const button of document.querySelectorAll('[data-nav]')) button.addEventListener('click', () => {
  if (button.dataset.nav === 'guide') showGuide();
  else if (button.dataset.nav === 'history') showHistory();
  else if (button.dataset.nav === 'permanent') showPermanentUpgrades();
  else { if (dialogName && !isChoiceDialog() && dialogName !== 'result') closeModal(); $('#game-canvas').focus({ preventScroll: true }); }
});
$('.brand').addEventListener('click', (event) => { event.preventDefault(); $('#game-canvas').focus({ preventScroll: true }); });
$('#modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop') closeModal(); });
window.addEventListener('keydown', (event) => {
  if(game?.rebinding)return;
  if (isChoiceDialog() && /^[0-9]$/.test(event.key) && !event.repeat) {
    event.preventDefault();
    if (dialogName === 'curse' && event.key === '0') document.querySelector('[data-curse="skip"]')?.click();
    else {
      const selector = { 'skill-swap':'[data-skill-swap]', upgrade: '[data-upgrade]', relic: '[data-chest-relic]', route: '[data-route]', region: '[data-region]', equipment: '[data-equipment-choice]', npc: '[data-npc-choice]', portal:'[data-portal-choice]', 'room-choice':'[data-room-curse]', curse: '[data-curse]:not([data-curse="skip"])' }[dialogName];
      const choices = document.querySelectorAll(selector);
      const index = Number(event.key) - 1;
      if (index >= 0 && index < choices.length) choices[index]?.click();
    }
  }
  if (dialogName && event.key === 'Tab') {
    const items = [...$('#modal').querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    if (!items.length) return;
    if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === $('#modal'))) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  }
});
// Focus and visibility changes clear movement in Game, without silently pausing a run.
for (const button of document.querySelectorAll('[data-move]')) {
  const release = () => game?.setMoveInput?.(0, 0);
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); const [x, y] = button.dataset.move.split(',').map(Number); game?.setMoveInput?.(x, y); });
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}
$('#touch-dash').addEventListener('pointerdown', (event) => { event.preventDefault(); game?.dash?.(); });

document.addEventListener('click',event=>{const b=event.target.closest?.('button');if(b&&!b.disabled&&!prefs.muted)game?.sound('ui');});
