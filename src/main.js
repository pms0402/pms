import './style.css';
import { Game } from './game.js';
import { formatGold, getStageStats, SPELLS, STAGE_DURATION, BOSS_SPAWN_TIME, MAX_STAGES } from './balance.js';
import { createProgress, normalizeProgress, getPermanentUpgradeOffers, getPermanentBonuses, settleRun, purchasePermanentUpgrade, getUnlockOffers, purchaseUnlock, selectLoadout, CHARACTERS, WEAPONS } from './progression.js';
import { icon } from './icons.js';
import { RELICS, BOSS_REWARDS, RISK_PACTS, getRiskStats } from './content.js';
import { STAGES, BOSS_TYPES, ENEMY_TYPES, getStageDefinition, getBossDefinition } from './encounters.js';

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
if (!Array.isArray(history)) history = [];
const savedProgress = readStorage('voidrun.progression', null);
let progress = savedProgress ? normalizeProgress(savedProgress) : createProgress(history);
function persistProgress() {
  try { localStorage.setItem('voidrun.progression', JSON.stringify(progress)); return true; }
  catch { return false; }
}
let progressionWritable = persistProgress();
let lastResult = null;
let campFromResult = false;
let game, latest, dialogName = '', pausedForDialog = false, audioContext;
let lastKills = 0;
let toastTimeout;
let lastBuildSignature = '';
let lastRouteStage = 0;
let campTab = 'tree';
let theaterMode = false;
const hudElements = new Map();
const hudValues = new Map();
function hud(selector, value, html = false) {
  const key = `${selector}:${html}`;
  if (hudValues.get(key) === value) return;
  const element = hudElements.get(selector) || $(selector);
  if (!element) return;
  hudElements.set(selector, element); hudValues.set(key, value);
  if (html) element.innerHTML = value; else element.textContent = value;
}
const upgradeIcons = { arcana: 'orbit', focus: 'bolt', bladeReach: 'target', spellArea: 'orbit', spell_power: 'orbit', spell_haste: 'bolt', power: 'sword', haste: 'bolt', vitality: 'heart', magnet: 'magnet', critical: 'diamond', armor: 'shield', regen: 'cross', speed: 'move', fireball: 'fire', frost: 'snow', lightning: 'bolt', orbit: 'orbit' };
const upgradeIcon = (choice) => upgradeIcons[choice.id] || upgradeIcons[choice.id.replace(/^(spell_|evolve_)/, '')] || choice.icon || 'diamond';

$('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="#" aria-label="VOIDRUN 홈"><span class="brand-mark">${icon('bolt')}</span>VOID<span>RUN</span><sup>®</sup></a>
    <nav class="main-nav" aria-label="주 메뉴">
      <button class="nav-link active" data-nav="play">플레이<span class="nav-dot"></span></button>
      <button class="nav-link" data-nav="guide">게임 가이드</button>
      <button class="nav-link" data-nav="history">런 기록 <span class="nav-count" id="history-count">${history.length.toString().padStart(2, '0')}</span></button>
      <button class="nav-link" data-nav="permanent">영구 강화</button>
    </nav>
    <div class="header-actions"><span class="build-label"><i></i> BUILD YOUR LEGEND <b>v0.6</b></span><span class="header-divider"></span><button id="sound-toggle" class="icon-button" title="사운드 켜기" aria-label="사운드 켜기">${icon('muted')}</button><button id="settings" class="icon-button" title="설정" aria-label="설정">${icon('settings')}</button></div>
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
          <div class="area-label"><span class="live-dot"></span><span id="area-name">잊혀진 초원</span><span class="area-divider">/</span><span id="area-stage">STAGE 01</span></div>
          <div class="arena-top-actions"><span class="difficulty"><i></i> <span id="difficulty">고요한 시작</span></span><button id="pause-button" class="glass-button" title="일시정지 (Esc)" aria-label="일시정지" disabled>${icon('pause')}</button><button id="fullscreen" class="glass-button" title="전체 화면 (F)" aria-label="전체 화면" aria-pressed="false">${icon('expand')}</button></div>
        </div>
        <div class="live-hud hidden" id="live-hud">
          <div class="health-block"><div class="health-label">${icon('heart')}<span>HP</span><strong id="health-value">100 <small>/ 100</small></strong></div><div class="health-track"><div id="health-fill"></div></div><div class="xp-row"><span id="level-value">LV. 1</span><div class="xp-track"><div id="xp-fill"></div></div><span id="xp-value">0 / 10</span></div></div>
          <div class="run-counters"><div>${icon('clock')}<strong id="run-time">00:00</strong></div><div>${icon('skull')}<strong id="kill-count">0</strong></div><div class="gold-counter">${icon('coin')}<strong id="gold-count">0</strong></div></div>
        </div>
        <div class="boss-hud hidden" id="boss-hud" role="meter" aria-label="보스 체력" aria-valuemin="0" aria-valuemax="100"><div><strong id="boss-name"></strong><span id="boss-health-value"></span></div><div class="boss-health-track"><div id="boss-health-fill"></div></div></div>
        <div class="start-content" id="start-content">
          <div class="roguelike-tag"><span></span> 3D SURVIVAL ROGUELIKE</div>
          <h2>작은 시작.<br>거대한 <span>한 방.</span></h2>
          <p>쓰러져도, 번 골드는 남습니다.<br>영구 강화로 더 강하게 돌아오세요.</p>
          <div class="magic-preview"><span style="--spell:#ffac61">${icon('fire')}</span><span style="--spell:#80e6f8">${icon('snow')}</span><span style="--spell:#f0de75">${icon('bolt')}</span><span style="--spell:#c4a2ff">${icon('orbit')}</span><small>4 MAGIC CLASSES · 4 EVOLUTIONS</small></div>
          <button class="start-loadout" id="start-loadout">${icon('sword')} <span id="selected-loadout">방랑자 · 공허의 검</span> ${icon('chevron')}</button>
          <div class="risk-selector"><span>이번 런의 계약</span><div id="risk-options" class="risk-options">${RISK_PACTS.map(pact => `<button data-risk="${pact.id}" aria-pressed="${prefs.risk === pact.id}" class="${prefs.risk === pact.id ? 'selected' : ''}">${pact.name.replace('의 계약','')}</button>`).join('')}</div><p id="risk-description"></p></div>
          <button class="primary-button start-button" id="start-button"><span>${icon('play')} 런 시작하기</span>${icon('arrow')}</button>
          <div class="start-footnote"><span class="live-dot"></span> 설치 없이 바로 플레이 <span>·</span> ${STAGE_DURATION / 60}분 × ${MAX_STAGES}층 · 층마다 다른 수호자</div>
        </div>
        <div class="scene-coordinate">SECTOR_001 <span>35° 41′ N / 139° 41′ E</span></div>
        <div class="combo-display hidden" id="combo-display"><strong id="combo-value"></strong><span>CHAIN KILLS</span></div>
        <div class="game-toast hidden" id="game-toast" role="status"></div>
        <div class="stage-banner hidden" id="stage-banner"><span id="banner-kicker">NEXT STAGE</span><strong id="banner-title"></strong><p>보상 ×10 <span>몬스터 ×3.2</span></p></div>
        <div class="arena-bottom">
          <div class="character-loadout"><div class="weapon-icon">${icon('sword')}</div><div><span class="loadout-label">시작 무기</span><strong id="weapon-name">공허의 검 <span>I</span></strong></div><span class="loadout-divider"></span><div class="attack-type">${icon('target')} 자동 공격</div></div>
          <div class="dash-indicator hidden" id="dash-indicator"><kbd>SPACE</kbd><div><strong id="dash-status">대시 준비</strong><div class="dash-track"><div id="dash-fill"></div></div></div>${icon('bolt')}</div>
          <div class="scene-tag" id="scene-tag"><span class="live-dot"></span> REAL-TIME 3D</div>
        </div>
        <div class="growth-toolbar hidden" id="growth-toolbar"><div class="spell-loadout" id="spell-loadout" aria-label="보유 마법">${['fireball', 'frost', 'lightning', 'orbit'].map(id => `<button class="spell-slot locked" data-spell="${id}" title="마법 빌드 보기" aria-label="${id} 마법 정보"><span class="spell-slot-icon">${icon(upgradeIcons[id])}</span><span class="spell-slot-rank">—</span><span class="spell-cooldown"></span></button>`).join('')}</div><button id="run-build-button" class="shop-button">${icon('book')} 이번 런 빌드 <kbd>B</kbd></button></div>
        <div class="touch-controls hidden" id="touch-controls"><div class="dpad"><button data-move="0,-1" aria-label="위로 이동">↑</button><button data-move="-1,0" aria-label="왼쪽 이동">←</button><button data-move="0,1" aria-label="아래로 이동">↓</button><button data-move="1,0" aria-label="오른쪽 이동">→</button></div><button id="touch-dash" aria-label="대시">${icon('bolt')}</button></div>
        <div class="canvas-error hidden" id="canvas-error"><h2>3D 화면을 시작할 수 없어요</h2><p>브라우저의 하드웨어 가속을 켠 뒤 새로고침해 주세요.</p><button class="primary-button" id="reload">새로고침 ${icon('refresh')}</button></div>
      </div>
      <aside class="run-panel">
        <div class="panel-heading"><span>이번 런의 여정</span><span class="micro">THE RUN</span></div>
        <div class="stage-heading"><span class="stage-caption">CURRENT STAGE</span><div class="stage-number"><strong id="stage-number">01</strong><span>/ ${String(MAX_STAGES).padStart(2, '0')}</span><span class="stage-symbol">✳</span></div><h3 id="stage-name">잊혀진 초원</h3><p id="stage-english">THE FORGOTTEN GROVE</p></div>
        <div class="stage-time"><span id="stage-timer-label">보스 출현까지</span><strong id="stage-time">01:30</strong></div><div class="stage-track"><div id="stage-progress"></div></div>
        <div class="scaling-stats"><div><span>${icon('coin')} 처치 보상</span><strong id="reward-multiplier">×1</strong></div><div><span>${icon('skull')} 몬스터 위력</span><strong id="enemy-multiplier">×1</strong></div></div>
        <div class="stage-route" aria-label="전체 층 진행 경로" tabindex="0">${stageNames.map((name, i) => `<div class="route-stop ${i === 0 ? 'current' : ''}" data-stage="${i + 1}"><span class="route-point">${i === 0 ? '<i></i>' : `<b>${i + 1}</b>`}</span><span>${name}</span><span class="route-multiplier">${i === 0 ? '현재' : `×${formatGold(10 ** i)}`}</span></div>`).join('')}</div>
        <div class="build-summary"><div><span>이번 런의 빌드</span><button id="build-info" title="마법과 강화 설명">${icon('book')}</button></div><p id="build-summary">화염탄으로 시작합니다.<br>경험치를 모아 새 마법을 선택하세요.</p><div class="build-summary-foot"><span id="build-levels">마법 1종 · 진화 0종</span><span>LV. <b id="build-level">1</b></span></div></div>
        <div class="panel-tip"><span>${icon('bolt')} BIGGER GAINS. NEW POSSIBILITIES.</span><p>강력한 성장, 새로운 마법.<br>선택이 쌓여 <b>당신만의 빌드로.</b></p><div class="mini-bars">${Array.from({length: 22}, (_, i) => `<i style="--bar:${12 + Math.pow(i / 21, 2.5) * 38}px;--alpha:${.16 + i / 26}"></i>`).join('')}</div></div>
      </aside>
    </section>
    <section class="below-game">
      <div class="controls-guide"><span class="controls-title">HOW TO PLAY</span><span class="control-item"><span class="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> 이동</span><span class="control-item"><kbd class="wide-key">SPACE</kbd> 대시</span><span class="control-item"><kbd>ESC</kbd> 일시정지</span><span class="control-item auto-hint">${icon('target')} 공격은 자동으로</span></div>
      <button class="text-button" data-nav="guide">처음 플레이하시나요? ${icon('arrow')}</button>
    </section>
    <section class="feature-row"><div><span class="feature-index">01 /</span>${icon('coin')}<span><strong>죽음 뒤에도 남는 성장</strong><small>번 골드로 영구 강화하고, 다시 도전.</small></span><span class="feature-detail">↗</span></div><div><span class="feature-index">02 /</span>${icon('skull')}<span><strong>광활한 전장과 수호자</strong><small>4배 넓은 맵, 스테이지마다 보스.</small></span><span class="feature-detail waves">4×</span></div><div><span class="feature-index">03 /</span>${icon('diamond')}<span><strong>마법을 조합하고 진화</strong><small>이번 런의 선택, 다음 런의 새 빌드.</small></span><span class="feature-detail">∞</span></div></section>
    <footer><span>VOIDRUN <span class="footer-dot">/</span> ONE MORE RUN.</span><span>죽음은 끝이 아닌, 다음 런의 시작.</span><span>BUILT FOR THE THRILL <span class="lime">↗</span></span></footer>
  </main>
  <div class="modal-backdrop hidden" id="modal-backdrop"><section class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"></section></div>
`;

function sound(note = 440, duration = .08, volume = .04) {
  if (prefs.muted) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(note, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(note / 2, audioContext.currentTime + duration);
    gain.gain.setValueAtTime(volume, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional on browsers without Web Audio. */ }
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
  const inRun = !['menu', 'over', 'won'].includes(state.phase);
  $('#arena').classList.toggle('in-run', inRun);
  document.body.classList.toggle('run-active', inRun);
  $('#live-hud').classList.toggle('hidden', !inRun);
  $('#dash-indicator').classList.toggle('hidden', !inRun);
  $('#scene-tag').classList.toggle('hidden', inRun);
  $('#start-content').classList.toggle('hidden', state.phase !== 'menu');
  $('#touch-controls').classList.toggle('hidden', !inRun);
  $('#growth-toolbar').classList.toggle('hidden', !inRun);
  $('#pause-button').disabled = !['playing', 'paused'].includes(state.phase);
  hud('#health-value', `${Math.ceil(state.hp)} <small>/ ${Math.round(state.maxHp)}</small>`, true);
  $('#health-fill').style.width = `${Math.max(0, state.hp / state.maxHp * 100)}%`;
  $('#health-fill').classList.toggle('low', state.hp < state.maxHp * .3);
  hud('#level-value', `LV. ${state.level}`);
  $('#xp-fill').style.width = `${Math.min(100, state.xp / state.xpNeeded * 100)}%`;
  hud('#xp-value', `${Math.floor(state.xp)} / ${state.xpNeeded}`);
  hud('#run-time', time(state.elapsed));
  hud('#kill-count', state.kills.toLocaleString());
  hud('#gold-count', formatGold(state.gold));
  hud('#stage-number', String(state.stage).padStart(2, '0'));
  const floor = getStageDefinition(state.stage);
  hud('#stage-name', floor.name); hud('#area-name', floor.name);
  hud('#stage-english', floor.english);
  hud('#area-stage', `STAGE ${String(state.stage).padStart(2, '0')}`);
  const boss = state.boss;
  const bossAlive = !!boss && boss.hp > 0;
  const waitingForBoss = state.stageTime >= STAGE_DURATION && bossAlive;
  const beforeBoss = state.stageTime < BOSS_SPAWN_TIME && !boss?.spawned;
  hud('#stage-timer-label', waitingForBoss ? '수호자를 처치해야 진행됩니다' : beforeBoss ? '보스 출현까지' : bossAlive ? '보스전 · 생존 목표까지' : '다음 스테이지까지');
  hud('#stage-time', waitingForBoss ? '처치 대기' : time(Math.ceil((beforeBoss ? BOSS_SPAWN_TIME : STAGE_DURATION) - state.stageTime)));
  $('#stage-progress').style.width = `${state.stageTime / STAGE_DURATION * 100}%`;
  const risk = state.phase === 'menu' ? getRiskStats(prefs.risk) : state.risk || getRiskStats(prefs.risk);
  hud('#reward-multiplier', `×${formatGold(getStageStats(state.stage).coinValue)} · 계약 ×${risk.goldMultiplier || 1}`);
  hud('#enemy-multiplier', `×${(3.2 ** (state.stage - 1)).toLocaleString('en-US', { maximumFractionDigits: 1 })}`);
  hud('#difficulty', bossAlive ? '수호자 출현' : state.stage >= 3 ? '원거리 몬스터 주의' : state.stageTime > 60 ? '몰려오는 적들' : '생존과 성장');
  $('#boss-hud').classList.toggle('hidden', !bossAlive);
  $('#arena').classList.toggle('has-boss', bossAlive);
  if (bossAlive) {
    hud('#boss-name', boss.name);
    const bossPercent = Math.max(0, Math.min(100, boss.hp / boss.maxHp * 100));
    hud('#boss-health-value', `${Math.ceil(bossPercent)}%`);
    $('#boss-health-fill').style.width = `${bossPercent}%`;
    $('#boss-hud').setAttribute('aria-valuenow', String(Math.ceil(bossPercent)));
    $('#boss-hud').setAttribute('aria-valuetext', `${boss.name} 체력 ${Math.ceil(bossPercent)}%`);
    $('#boss-hud').title = `${boss.name} · ${Math.ceil(boss.hp).toLocaleString('ko-KR')} / ${Math.ceil(boss.maxHp).toLocaleString('ko-KR')} · ${boss.hint || getBossDefinition(state.stage).hint}`;
  }
  const weapon = WEAPONS.find(item => item.id === (state.playerStats?.weaponId || progress.loadout?.weapon)) || WEAPONS[0];
  hud('#weapon-name', `${escapeHTML(weapon.name)} <span>${['I', 'II', 'III', 'IV', 'V'][Math.min(4, Math.floor((state.level - 1) / 3))]}</span>`, true);
  $('#combo-display').classList.toggle('hidden', !inRun || state.combo < 3);
  hud('#combo-value', `${state.combo}×`);
  $('.loadout-label').textContent = inRun ? `검 ${formatGold(state.damage)} · 마법 ${formatGold(state.spellDamage || state.playerStats?.spellDamage || 18)}` : '시작 무기';
  const cooldown = state.dashCooldown || 0;
  hud('#dash-status', cooldown <= 0 ? '대시 준비' : `${cooldown.toFixed(1)}초`);
  $('#dash-fill').style.width = `${Math.max(0, 1 - cooldown / 3) * 100}%`;
  $('#dash-indicator').classList.toggle('on-cooldown', cooldown > 0);
  const spells = getSpellStates(state);
  for (const spell of spells) {
    const slot = document.querySelector(`[data-spell="${spell.id}"]`);
    if (!slot) continue;
    slot.classList.toggle('locked', !spell.rank);
    slot.classList.toggle('evolved', !!spell.evolved);
    slot.style.setProperty('--spell', spell.color || '#c2f568');
    slot.style.setProperty('--cooldown', spell.rank && spell.maxCooldown > 0 ? Math.min(1, Math.max(0, spell.cooldown / spell.maxCooldown)) : 0);
    slot.querySelector('.spell-slot-rank').textContent = spell.evolved ? '진화' : spell.rank ? `${spell.rank}/5` : '잠김';
    slot.title = slot.ariaLabel = spell.rank ? `${spell.name} ${spell.evolved ? '진화 완료' : `${spell.rank}단계`} · 빌드 보기` : `${spell.name} 미습득 · 레벨업으로 습득`;
  }
  const owned = spells.filter(s => s.rank > 0);
  const relicIds = state.playerStats?.relics || [];
  const buildSignature = `${state.level}:${owned.map(s => `${s.id}:${s.rank}:${s.evolved}`).join(',')}:${relicIds.join(',')}`;
  if (buildSignature !== lastBuildSignature) {
    lastBuildSignature = buildSignature;
    $('#build-summary').innerHTML = owned.map(s => `<span style="--spell:${escapeHTML(s.color || '#c2f568')}">${icon(upgradeIcons[s.id])} ${escapeHTML(s.evolved ? SPELLS.find(d => d.id === s.id)?.evolutionName || s.name : s.name)} <b>${s.evolved ? '★' : `Lv.${s.rank}`}</b></span>`).join('');
    $('#build-levels').textContent = `마법 ${owned.length}종 · 유물 ${relicIds.length}개`;
    $('#build-level').textContent = state.level;
  }
  if (state.stage !== lastRouteStage) {
  lastRouteStage = state.stage;
  for (const stop of document.querySelectorAll('.route-stop')) {
    const n = Number(stop.dataset.stage);
    stop.classList.toggle('current', n === state.stage);
    stop.classList.toggle('completed', n < state.stage);
    stop.querySelector('.route-point').innerHTML = n < state.stage ? icon('check') : n === state.stage ? '<i></i>' : `<b>${n}</b>`;
    stop.querySelector('.route-multiplier').textContent = n === state.stage ? '현재' : n < state.stage ? '완료' : `×${formatGold(10 ** (n - 1))}`;
  }
  const route = $('.stage-route'), currentStop = route?.querySelector('.current');
  if (route && currentStop) route.scrollTop = Math.max(0, currentStop.offsetTop - route.offsetTop - route.clientHeight / 2 + currentStop.clientHeight / 2);
  }
  if (state.kills > lastKills) sound(520 + Math.random() * 200, .06, .025);
  lastKills = state.kills;
}

function getSpellStates(state = latest) {
  return SPELLS.map(definition => {
    const live = state?.spellState?.find(spell => spell.id === definition.id);
    return { ...definition, rank: state?.playerStats?.spells?.[definition.id] || 0, evolved: !!state?.playerStats?.evolutions?.[definition.id], cooldown: 0, maxCooldown: 1, ...live };
  });
}

let returnFocus;
function openModal(name, content, { pause = true, closeable = true } = {}) {
  returnFocus = document.activeElement;
  if (pause && latest?.phase === 'playing') { pausedForDialog = true; game.pause(); }
  dialogName = name;
  $('#modal').className = `modal modal-${name}`;
  $('#modal').innerHTML = `${closeable ? `<button class="modal-close icon-button" id="modal-close" aria-label="닫기">${icon('close')}</button>` : ''}${content}`;
  $('#modal-backdrop').classList.remove('hidden');
  $('#modal').focus();
  $('#modal-close')?.addEventListener('click', closeModal);
}
function closeModal() {
  if (['upgrade', 'relic', 'result'].includes(dialogName)) return;
  if (dialogName === 'permanent' && campFromResult && lastResult) { showResult(); return; }
  $('#modal-backdrop').classList.add('hidden');
  dialogName = '';
  if (pausedForDialog) { pausedForDialog = false; game.resume(); $('#game-canvas').focus({ preventScroll: true }); }
  else returnFocus?.focus();
}
function forceCloseModal() {
  $('#modal-backdrop').classList.add('hidden'); dialogName = ''; pausedForDialog = false;
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
    0: '거리를 벌리고 자동 검격의 범위에 한꺼번에 모으세요.',
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

function showGuide() {
  openModal('guide', `<div class="modal-eyebrow">FIELD MANUAL / 002</div><h2 id="modal-title">작은 선택이, 거대한 빌드로<span>.</span></h2><p class="modal-description">네 가지 마법, ${MAX_STAGES}개의 층과 서로 다른 수호자. 도감에서 다음 위협의 공략법을 확인하세요.</p><div class="guide-steps"><div><span>01</span><div><h3>4배 넓어진 전장을 누비세요</h3><p><kbd>W A S D</kbd> / 방향키로 이동, <kbd>SPACE</kbd>로 무적 대시. 모바일은 방향 버튼이나 전장 드래그를 사용합니다. 검과 보유 마법은 자동으로 공격합니다.</p></div></div><div><span>02</span><div><h3>경험치 → 선택 → 마법 진화</h3><p>초록 조각을 모으면 3개 강화 중 하나를 선택합니다. 검·마법 공격력은 각각 <b>20%</b>, 공격·시전 속도는 <b>8%</b>, 최대 체력은 <b>15%</b>씩 곱해 성장합니다. 마법은 <b>5단계</b>까지 강화하고, 다음 선택에서 진화시킬 수 있습니다. 마법 선택지가 남아 있다면 레벨업에 반드시 하나 이상 등장합니다.</p></div></div><div><span>03</span><div><h3>죽고 번 골드로 영구 강화하세요</h3><p>사망하거나 완주하면 모은 골드가 보유 지갑으로 들어옵니다. 결과 화면에서 <b>영구 강화하고 재도전</b>을 눌러 검·마법 공격력을 단계마다 <b>12%</b>, 최대 체력을 <b>10%</b>씩 곱해 키우세요. 가격의 급격한 폭증은 낮췄고 기본 골드 수입은 <b>5배</b> 늘렸습니다. 검술·마력 가지를 따로 키우거나 캐릭터·무기를 해금하세요. 구매한 강화와 남은 골드는 <b>다음 런에도 유지</b>됩니다. <kbd>B</kbd>는 이번 런의 마법 빌드를 보여줍니다.</p></div></div><div><span>04</span><div><h3>${STAGE_DURATION / 60}분 생존, 그리고 수호자 처치</h3><p>스테이지마다 <b>90초</b>에 보스가 등장합니다. <b>2분 생존 + 보스 처치</b>를 모두 달성해야 다음 단계로 진행됩니다. 층이 깊어질수록 돌진병·폭탄병·분열체·저격수·주술사가 합류합니다. 붉은 조준선과 원형 예고를 보고 먼저 움직이세요.</p></div></div><div><span>05</span><div><h3>더 강한 적, 더 큰 보상</h3><p>다음 단계의 골드는 <b>10배</b>, 몬스터 능력치는 <b>3.2배</b>. 보스 돌파 축복은 검·마법 공격력과 최대 체력을 각각 <b>3.2배</b>로 키우고 완전히 회복시킵니다. 몬스터가 기하급수적으로 성장하는 만큼 플레이어도 함께 성장합니다. 군세·광란 계약을 선택하면 골드와 함께 적 체력·피해·출현 빈도도 올라갑니다.</p></div></div><div><span>06</span><div><h3>정예와 상자에서 유물을 찾으세요</h3><p>정예는 더 높은 체력과 피해를 가집니다. 상자의 수호병을 처치하면 보상에 접근할 수 있습니다. 황금 몬스터는 도망가기 전에 추격하세요. <kbd>F</kbd>나 전장 오른쪽 위 버튼으로 전체 화면을 켜고 끕니다.</p></div></div></div><div class="guide-bottom">${icon('info')} ${STAGE_DURATION / 60}분 × ${MAX_STAGES}층. 시간이 끝나도 살아 있는 보스는 처치해야 합니다.</div>${encounterGuide()}`);
}

function showBuild() {
  if (['upgrade', 'relic', 'result'].includes(dialogName)) return;
  const spells = getSpellStates();
  const passiveNames = { power: '검 공격력', haste: '검 공격 속도', spell_power: '마법 공격력', spell_haste: '마법 시전 속도', vitality: '생명력', magnet: '획득 범위', critical: '치명타', armor: '방어력', regen: '재생', speed: '이동 속도' };
  const collected = [...RELICS.filter(item => latest?.playerStats?.relics?.includes(item.id)), ...BOSS_REWARDS.filter(item => latest?.playerStats?.bossRewards?.includes(item.id))];
  const passives = Object.entries(latest?.playerStats?.passiveLevels || {}).filter(([, n]) => n > 0);
  openModal('build', `<div class="modal-eyebrow">YOUR BUILD / THIS RUN</div><h2 id="modal-title">마법은 조합할수록 강하게<span>.</span></h2><p class="modal-description">마법은 5단계 후 진화할 수 있습니다. 여기 표시된 마법과 레벨업 강화는 이번 런의 빌드입니다. 영구 강화는 다음 런에도 유지됩니다.</p><div class="spell-codex">${spells.map(s => `<div class="codex-card ${s.rank ? '' : 'unowned'}" style="--spell:${escapeHTML(s.color || '#c2f568')}"><div class="codex-icon">${icon(upgradeIcons[s.id])}</div><div><span>${s.evolved ? '진화 완료' : s.rank ? `${s.rank} / 5단계` : '레벨업으로 습득'}</span><h3>${escapeHTML(s.evolved ? s.evolutionName : s.name)}</h3><p>${escapeHTML(s.description)}</p><small>진화 → ${escapeHTML(s.evolutionName)}</small></div></div>`).join('')}</div><div class="relic-build"><h3>유물 · 수호자의 유산</h3>${collected.length ? collected.map(item => `<div>${icon(item.icon)}<span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.description)}</small></span></div>`).join('') : '<p>정예와 보물상자를 공략하면 28종의 유물 중 하나를 선택할 수 있습니다.</p>'}</div><div class="passive-build"><h3>검 · 마법 · 생존 강화</h3>${passives.length ? passives.map(([id, n]) => `<span>${icon(upgradeIcons[id])}${passiveNames[id] || id} <b>Lv.${n}</b></span>`).join('') : '<p>레벨업으로 검·마법 공격력과 체력을 복리로 키울 수 있습니다.</p>'}</div><div class="guide-bottom">${icon('info')} 여러 마법을 함께 보유할 수 있고, 재도전하면 새 빌드로 시작합니다.</div>`);
}

function syncBank() {
  $('#bank-gold').textContent = formatGold(progress.bank);
}
function showPermanentUpgrades(fromResult = false) {
  if (['upgrade', 'relic'].includes(dialogName)) return;
  campFromResult = !!fromResult && !!lastResult;
  const readOnly = !['menu', 'over', 'won'].includes(game?.state.phase);
  openModal('permanent', `<div class="modal-eyebrow">THE CAMP / GROW YOUR OWN WAY</div><h2 id="modal-title">당신의 성장에, 가지를 더하세요<span>.</span></h2><p class="modal-description">검술과 마력은 따로 성장합니다. 공격력은 단계마다 ×1.12, 체력은 ×1.10으로 커집니다. 구매한 강화와 해금은 죽어도 남습니다.</p><div class="permanent-wallet"><div>${icon('coin')}<span>보유 골드</span><strong id="permanent-gold">${formatGold(progress.bank)}</strong></div><span>누적 회수 <b id="lifetime-gold">${formatGold(progress.lifetimeGold)}</b> G</span></div>${readOnly ? `<p class="camp-readonly">${icon('info')} 생존 중에는 빌드를 확인할 수 있습니다. 이번 런의 ${formatGold(latest.gold)} G는 런 종료 후 회수되며, 구매와 장비 변경은 그때 가능합니다.</p>` : '<div class="camp-cycle"><span>런 종료</span> → <strong>골드 회수</strong> → <strong>성장 · 해금</strong> → <span>다시 도전</span></div>'}<div class="camp-tabs" role="tablist" aria-label="캠프 메뉴"><button class="camp-tab" data-camp-tab="tree" role="tab">${icon('orbit')} 성장 트리</button><button class="camp-tab" data-camp-tab="loadout" role="tab">${icon('sword')} 캐릭터 · 무기</button></div><div id="permanent-grid" class="permanent-grid"></div><p class="shop-feedback" id="permanent-feedback" role="status"></p><div class="camp-storage ${progressionWritable ? '' : 'storage-unavailable'}" id="camp-storage">${icon(progressionWritable ? 'check' : 'info')} ${progressionWritable ? '같은 브라우저에 자동 저장됩니다. 구매 효과와 선택 장비는 다음 런부터 적용됩니다.' : '이 창은 브라우저 저장소를 사용할 수 없어 닫으면 기록이 사라집니다. 일반 브라우저의 게임 사이트에서 플레이해 주세요.'}</div>${campFromResult ? `<div class="camp-actions"><button class="primary-button" id="camp-start">${icon('play')} 다음 런 시작 ${icon('arrow')}</button><button class="secondary-button" id="camp-resultback">결과 보기</button></div>` : ''}`, { closeable: true });
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
      if (!['menu', 'over', 'won'].includes(game.state.phase)) return;
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
    if (!['menu', 'over', 'won'].includes(game.state.phase)) return;
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
function onRelic(choices, source = '유물 발견') {
  const label = typeof source === 'string' ? source : source?.name || source?.title || '유물 발견';
  openModal('relic', `<div class="modal-eyebrow">RELIC FOUND / ${escapeHTML(label)}</div><h2 id="modal-title">이번 런을 바꿀, 하나의 유물<span>.</span></h2><p class="modal-description">유물은 이번 런에 유지됩니다. 마법 조합과 조건을 살펴보고 선택하세요.</p><div class="upgrade-grid">${choices.map((choice, index) => `<button class="upgrade-card relic-card ${escapeHTML(choice.rarity || 'rare')}" data-relic="${escapeHTML(choice.id)}"><div class="upgrade-card-top"><span>${['greed', 'alchemy'].includes(choice.id) ? '위험 · 보상 동시 증가' : choice.synergy ? '마법 조합 유물' : '런 전용 유물'}</span><kbd>${index + 1}</kbd></div><div class="upgrade-icon">${icon(choice.icon)}</div><h3>${escapeHTML(choice.title)}</h3><p>${escapeHTML(choice.description)}</p><span class="upgrade-select">유물 선택 ${icon('arrow')}</span></button>`).join('')}</div><div class="guide-bottom">${icon('info')} 선택 중에는 전투가 멈춥니다. 숫자 키 1–3.</div>`, { pause: false, closeable: false });
  document.querySelectorAll('[data-relic]').forEach(button => button.addEventListener('click', () => {
    if (game.chooseRelic?.(button.dataset.relic)) { forceCloseModal(); $('#game-canvas').focus({ preventScroll: true }); sound(880, .2); }
  }));
}
function showHistory() {
  const records = history.slice(0, 12);
  openModal('history', `<div class="modal-eyebrow">YOUR JOURNEY</div><h2 id="modal-title">모든 런은 흔적을 남긴다<span>.</span></h2><p class="modal-description">다시 도전할 때마다, 조금 더 멀리.</p>${records.length ? `<div class="history-table"><div class="history-row history-head"><span>결과 / 스테이지</span><span>시간</span><span>처치</span><span>골드</span></div>${records.map(r => `<div class="history-row"><span><i class="record-dot ${r.won ? 'won' : ''}"></i><strong>${r.won ? '완주' : `STAGE ${r.stage}`}</strong><small>${escapeHTML(r.date)}</small></span><span>${time(r.elapsed)}</span><span>${r.kills}</span><span class="gold-text">${formatGold(r.gold)}</span></div>`).join('')}</div>` : `<div class="empty-history">${icon('trophy')}<h3>첫 번째 기록을 기다리는 중</h3><p>런을 마치면 생존 시간과 처치 수, 획득 골드가 여기에 남습니다.</p><button class="primary-button" id="history-start">첫 런 시작하기 ${icon('arrow')}</button></div>`}<div class="guide-bottom">${icon('info')} 기록은 현재 브라우저에 최대 30개까지 보관됩니다.</div>`);
  $('#history-start')?.addEventListener('click', startRun);
}
function showSettings() {
  openModal('settings', `<div class="modal-eyebrow">MAKE IT YOURS</div><h2 id="modal-title">플레이 설정<span>.</span></h2><p class="modal-description">당신의 리듬에 맞춰 즐기세요.</p><div class="setting-row"><div><h3>${icon('sound')} 효과음</h3><p>처치, 레벨업, 스테이지 전환 효과음</p></div><button id="setting-sound" class="toggle ${!prefs.muted ? 'on' : ''}" role="switch" aria-checked="${!prefs.muted}" aria-label="효과음"><span></span></button></div><div class="setting-row"><div><h3>${icon('diamond')} 그래픽 품질</h3><p>낮음 모드는 그림자와 렌더링 해상도를 줄입니다.</p></div><div class="segmented"><button data-quality="low" class="${prefs.quality === 'low' ? 'selected' : ''}">낮음</button><button data-quality="high" class="${prefs.quality === 'high' ? 'selected' : ''}">높음</button></div></div><div class="guide-bottom">${icon('check')} 설정은 자동으로 저장됩니다.</div>`);
  $('#setting-sound').addEventListener('click', (event) => {
    prefs.muted = !prefs.muted; syncSound(); sound(600);
    event.currentTarget.classList.toggle('on', !prefs.muted); event.currentTarget.setAttribute('aria-checked', String(!prefs.muted));
  });
  for (const button of document.querySelectorAll('[data-quality]')) button.addEventListener('click', () => {
    prefs.quality = button.dataset.quality; game.setQuality(prefs.quality); store('voidrun.preferences', prefs);
    document.querySelectorAll('[data-quality]').forEach(b => b.classList.toggle('selected', b.dataset.quality === prefs.quality));
  });
}
function showPause() {
  if (['playing', 'paused'].includes(latest?.phase) && !dialogName) {
    pausedForDialog = true;
    game.pause();
    openModal('pause', `<div class="modal-eyebrow">TAKE A BREATH</div><h2 id="modal-title">잠깐, 숨 고르기<span>.</span></h2><p class="modal-description">공허는 당신을 기다려줍니다.</p><div class="pause-stats"><div><span>스테이지</span><strong>${latest.stage} <small>/ ${MAX_STAGES}</small></strong></div><div><span>생존 시간</span><strong>${time(latest.elapsed)}</strong></div><div><span>처치 수</span><strong>${latest.kills}</strong></div></div>${latest?.boss?.hp > 0 ? `<div class="pause-boss-tip">${icon('skull')}<span><strong>${escapeHTML(latest.boss.name)}</strong>${escapeHTML(latest.boss.hint || getBossDefinition(latest.stage).hint)}</span></div>` : ''}<button id="resume" class="primary-button">${icon('play')} 계속 플레이 ${icon('arrow')}</button><button id="pause-settings" class="secondary-button">${icon('settings')} 사운드 · 그래픽 설정</button><button id="pause-restart" class="secondary-button">${icon('refresh')} 런 종료하고 골드 회수</button>`, { pause: false });
    $('#resume').addEventListener('click', closeModal); $('#pause-settings').addEventListener('click', showSettings); $('#pause-restart').addEventListener('click', () => game.endRun());
  } else if (dialogName === 'pause') closeModal();
}
function onLevelUp(choices) {
  sound(880, .25, .08);
  openModal('upgrade', `<div class="modal-eyebrow">LEVEL ${game?.state.level || latest?.level || ''} / SHAPE YOUR BUILD</div><h2 id="modal-title">작은 선택, 새로운 가능성<span>.</span></h2><p class="modal-description">새로운 마법을 습득하거나, 보유 마법과 능력치를 강화하세요.</p><div class="upgrade-grid">${choices.map((choice, i) => `<button class="upgrade-card ${escapeHTML(choice.rarity)} ${escapeHTML(choice.category)}" data-upgrade="${escapeHTML(choice.id)}"><div class="upgrade-card-top"><span>${choice.category === 'evolution' ? '마법 진화' : choice.category === 'spell' ? choice.spellId ? choice.rank === 1 ? '새 마법 습득' : '마법 강화' : '마법 전용 강화' : choice.category === 'blade' ? '검 전용 강화' : choice.id.startsWith('spell_') ? '마법 전용 강화' : '생존 강화'}</span><kbd>${i + 1}</kbd></div><div class="upgrade-icon">${icon(upgradeIcon(choice))}</div><div class="upgrade-rank">${choice.maxRank ? `${choice.rank} / ${choice.maxRank}` : 'PASSIVE'}</div><h3>${escapeHTML(choice.title)}</h3><p>${escapeHTML(choice.description)}</p><span class="upgrade-select">${choice.category === 'evolution' ? '진화시키기' : '선택하기'} ${icon('arrow')}</span></button>`).join('')}</div><div class="guide-bottom">${icon('info')} 선택 중에는 전투가 멈춥니다. 숫자 키 1–3 · 모든 강화는 이번 런에만 적용됩니다.</div>`, { pause: false, closeable: false });
  document.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => {
    forceCloseModal(); game.chooseUpgrade(button.dataset.upgrade); $('#game-canvas').focus({ preventScroll: true }); sound(660, .15);
  }));
}
function finish(state, won) {
  const settlement = settleRun(progress, { runId: state.runId, gold: state.gold });
  progress = settlement.progress; progressionWritable = persistProgress(); syncBank();
  lastResult = { state, won, settlement };
  if (!settlement.duplicate) {
  const record = { runId: state.runId, stage: state.stage, elapsed: state.elapsed, kills: state.kills, gold: Math.floor(state.gold), level: state.level, won, date: new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date()) };
  history.unshift(record); history = history.slice(0, 30); store('voidrun.history', history);
  $('#history-count').textContent = String(history.length).padStart(2, '0');
  $('#personal-best').textContent = `${Math.max(...history.map(r => r.stage))} 스테이지`;
  }
  sound(won ? 1040 : 160, .5, .08);
  showResult();
}
function showResult() {
  if (!lastResult) return;
  const { state, won, settlement } = lastResult;
  campFromResult = false;
  openModal('result', `<div class="result-emblem">${icon(won ? 'trophy' : 'skull')}</div><div class="modal-eyebrow">${won ? 'THE VOID IS YOURS' : 'DEATH IS PROGRESS'}</div><h2 id="modal-title">${won ? '공허를 정복했습니다' : state.endedReason === 'abandoned' ? '돌아와서, 더 강하게' : '쓰러져도, 성장은 남습니다'}<span>.</span></h2><p class="modal-description">${won ? `${MAX_STAGES}층의 모든 수호자를 돌파했습니다. 회수한 골드로 다음 도전을 준비하세요.` : `${getStageDefinition(state.stage).name}에서 여정을 마쳤습니다. 번 골드는 잃지 않았습니다.`}</p><div class="settlement-panel"><span>${icon('coin')} 이번 런 골드 회수</span><strong id="settlement-gold">+${formatGold(settlement.amount)} G</strong><small>보유 골드 <b id="result-bank">${formatGold(progress.bank)} G</b> · 영구 강화에 사용할 수 있습니다</small></div><div class="result-stats"><div><span>생존 시간</span><strong>${time(state.elapsed)}</strong></div><div><span>처치 수</span><strong>${state.kills}</strong></div><div><span>도달 스테이지</span><strong>${state.stage} / ${MAX_STAGES}</strong></div><div><span>도달 레벨</span><strong>LV. ${state.level}</strong></div></div><button class="primary-button" id="result-permanent">${icon('coin')} 영구 강화하고 재도전 ${icon('arrow')}</button><button class="secondary-button" id="retry">${icon('refresh')} 강화 없이 바로 재도전</button>`, { pause: false, closeable: false });
  $('#result-permanent').addEventListener('click', () => showPermanentUpgrades(true));
  $('#retry').addEventListener('click', startRun);
}
try {
  game = new Game($('#game-canvas'), {
    onUpdate: update,
    onLevelUp,
    onRelic,
    onLoot: message => showToast(typeof message === 'string' ? message : message?.message || message?.title || '새로운 보상을 획득했습니다.'),
    onBoss: boss => {
      showToast(`${boss.name} · ${boss.hint || getBossDefinition(latest?.stage || 1).hint}`);
      sound(130, .5, .08);
    },
    onBossDefeat: () => {
      showToast('수호자 격파! 보상 조각을 모으고 남은 시간까지 살아남으세요.');
      sound(960, .3, .08);
    },
    onStage: stage => {
      const num = typeof stage === 'number' ? stage : stage.stage;
      $('#banner-title').textContent = getStageDefinition(num).name;
      $('#banner-kicker').textContent = `STAGE ${String(num).padStart(2, '0')} / REWARD ×${formatGold(10 ** (num - 1))}`;
      $('#stage-banner').classList.remove('hidden');
      setTimeout(() => $('#stage-banner').classList.add('hidden'), 2600);
      sound(660, .35, .07);
    },
    onGameOver: state => finish(state, false),
    onWin: state => finish(state, true),
  });
  window.__game = game;
  game.setPermanentBonuses(getPermanentBonuses(progress));
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
$('#start-loadout').addEventListener('click', () => { campTab = 'loadout'; showPermanentUpgrades(); });
for (const button of document.querySelectorAll('[data-risk]')) button.addEventListener('click', () => {
  if (!['menu', 'over', 'won'].includes(game?.state.phase)) return;
  prefs.risk = button.dataset.risk; store('voidrun.preferences', prefs); game.setRiskPact?.(prefs.risk); syncRisk();
});
$('#sound-toggle').addEventListener('click', () => { prefs.muted = !prefs.muted; syncSound(); sound(600); });
$('#settings').addEventListener('click', showSettings);
$('#pause-button').addEventListener('click', showPause);
$('#run-build-button').addEventListener('click', showBuild);
$('#build-info').addEventListener('click', showBuild);
document.querySelectorAll('[data-spell]').forEach(button => button.addEventListener('click', showBuild));
function setTheaterMode(active) {
  theaterMode = active;
  document.body.classList.toggle('theater-mode', active);
  $('#fullscreen').setAttribute('aria-pressed', String(active));
  $('#fullscreen').ariaLabel = active ? '전체 화면 닫기' : '전체 화면';
  $('#fullscreen').title = active ? '전체 화면 닫기 (F)' : '전체 화면 (F)';
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
  else { if (dialogName && !['upgrade', 'relic', 'result'].includes(dialogName)) closeModal(); $('#game-canvas').focus({ preventScroll: true }); }
});
$('.brand').addEventListener('click', (event) => { event.preventDefault(); $('#game-canvas').focus({ preventScroll: true }); });
$('#modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop') closeModal(); });
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.preventDefault(); if (dialogName) closeModal(); else if (theaterMode) toggleFullscreen(); else showPause(); }
  if (event.key.toLowerCase() === 'f' && !event.repeat && !event.target?.closest?.('input,textarea,select')) { event.preventDefault(); toggleFullscreen(); }
  if (event.key.toLowerCase() === 'b' && !event.repeat && !event.target?.closest?.('input,textarea,select')) { event.preventDefault(); if (dialogName === 'build') closeModal(); else if (!dialogName) showBuild(); }
  if (dialogName === 'relic' && ['1', '2', '3'].includes(event.key)) document.querySelectorAll('[data-relic]')[Number(event.key) - 1]?.click();
  if (dialogName === 'upgrade' && ['1', '2', '3'].includes(event.key)) document.querySelectorAll('[data-upgrade]')[Number(event.key) - 1]?.click();
  if (dialogName && event.key === 'Tab') {
    const items = [...$('#modal').querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    if (!items.length) return;
    if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === $('#modal'))) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && latest?.phase === 'playing') showPause(); });
for (const button of document.querySelectorAll('[data-move]')) {
  const release = () => game?.setMoveInput?.(0, 0);
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); const [x, y] = button.dataset.move.split(',').map(Number); game?.setMoveInput?.(x, y); });
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}
$('#touch-dash').addEventListener('pointerdown', (event) => { event.preventDefault(); game?.dash?.(); });
