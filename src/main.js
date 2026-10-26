import './style.css';
import { Game } from './game.js';
import { formatGold, getStageStats, getShopOffers, SPELLS, STAGE_DURATION, BOSS_SPAWN_TIME, MAX_STAGES } from './balance.js';
import { icon } from './icons.js';

const $ = (s) => document.querySelector(s);
const stageNames = ['잊혀진 초원', '황혼의 폐허', '독안개의 숲', '심연의 성채', '공허의 심장'];
const stageEnglish = ['THE FORGOTTEN GROVE', 'TWILIGHT RUINS', 'POISONWOOD', 'ABYSSAL CITADEL', 'HEART OF THE VOID'];
const time = (seconds = 0) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } }
let prefs = readStorage('voidrun.preferences', { muted: true, quality: 'high' });
let history = readStorage('voidrun.history', []);
if (!Array.isArray(history)) history = [];
let game, latest, dialogName = '', pausedForDialog = false, audioContext;
let lastKills = 0;
let toastTimeout;
let lastBuildSignature = '';
const upgradeIcons = { power: 'sword', haste: 'bolt', vitality: 'heart', magnet: 'magnet', critical: 'diamond', armor: 'shield', regen: 'cross', speed: 'move', fireball: 'fire', frost: 'snow', lightning: 'bolt', orbit: 'orbit' };
const upgradeIcon = (choice) => upgradeIcons[choice.id.replace(/^(spell_|evolve_)/, '')] || choice.icon || 'diamond';

$('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="#" aria-label="VOIDRUN 홈"><span class="brand-mark">${icon('bolt')}</span>VOID<span>RUN</span><sup>®</sup></a>
    <nav class="main-nav" aria-label="주 메뉴">
      <button class="nav-link active" data-nav="play">플레이<span class="nav-dot"></span></button>
      <button class="nav-link" data-nav="guide">게임 가이드</button>
      <button class="nav-link" data-nav="history">런 기록 <span class="nav-count" id="history-count">${history.length.toString().padStart(2, '0')}</span></button>
    </nav>
    <div class="header-actions"><span class="build-label"><i></i> SPELLS & TITANS <b>v0.2</b></span><span class="header-divider"></span><button id="sound-toggle" class="icon-button" title="사운드 켜기" aria-label="사운드 켜기">${icon('muted')}</button><button id="settings" class="icon-button" title="설정" aria-label="설정">${icon('settings')}</button></div>
  </header>
  <main class="page">
    <section class="page-intro">
      <div><div class="eyebrow"><span class="tiny-cross">✳</span> SURVIVE. LOOT. REPEAT.</div><h1>살아남아라. <span>한계를 넘어라.</span></h1><p>끝없이 몰려오는 적, 폭발하는 보상. 당신의 다음 런은 어디까지?</p></div>
      <div class="personal-best">${icon('trophy')}<div><span>나의 최고 기록</span><strong id="personal-best">${history.length ? `${Math.max(...history.map(r => r.stage))} 스테이지` : '새로운 전설의 시작'}</strong></div><span class="best-line"></span></div>
    </section>
    <section class="game-layout" aria-label="VOIDRUN 게임">
      <div class="arena" id="arena">
        <div id="game-canvas" role="application" tabindex="0" aria-label="3D 로그라이크 전장. WASD 이동, 스페이스 대시, Escape 일시정지."></div>
        <div class="arena-vignette"></div>
        <div class="arena-top">
          <div class="area-label"><span class="live-dot"></span><span id="area-name">잊혀진 초원</span><span class="area-divider">/</span><span id="area-stage">STAGE 01</span></div>
          <div class="arena-top-actions"><span class="difficulty"><i></i> <span id="difficulty">고요한 시작</span></span><button id="pause-button" class="glass-button" title="일시정지 (Esc)" aria-label="일시정지" disabled>${icon('pause')}</button><button id="fullscreen" class="glass-button" title="전체 화면" aria-label="전체 화면">${icon('expand')}</button></div>
        </div>
        <div class="live-hud hidden" id="live-hud">
          <div class="health-block"><div class="health-label">${icon('heart')}<span>HP</span><strong id="health-value">100 <small>/ 100</small></strong></div><div class="health-track"><div id="health-fill"></div></div><div class="xp-row"><span id="level-value">LV. 1</span><div class="xp-track"><div id="xp-fill"></div></div><span id="xp-value">0 / 10</span></div></div>
          <div class="run-counters"><div>${icon('clock')}<strong id="run-time">00:00</strong></div><div>${icon('skull')}<strong id="kill-count">0</strong></div><div class="gold-counter">${icon('coin')}<strong id="gold-count">0</strong></div></div>
        </div>
        <div class="boss-hud hidden" id="boss-hud" aria-live="polite"><div><span>${icon('skull')} STAGE GUARDIAN</span><strong id="boss-name"></strong><span id="boss-health-value"></span></div><div class="boss-health-track"><div id="boss-health-fill"></div></div><small id="boss-hint">붉은 예고 범위를 벗어나세요</small></div>
        <div class="start-content" id="start-content">
          <div class="roguelike-tag"><span></span> 3D SURVIVAL ROGUELIKE</div>
          <h2>작은 시작.<br>거대한 <span>한 방.</span></h2>
          <p>검과 네 가지 마법으로 완성하는 나만의 빌드.<br>광활한 전장 끝, 다섯 수호자를 쓰러뜨리세요.</p>
          <div class="magic-preview"><span style="--spell:#ffac61">${icon('fire')}</span><span style="--spell:#80e6f8">${icon('snow')}</span><span style="--spell:#f0de75">${icon('bolt')}</span><span style="--spell:#c4a2ff">${icon('orbit')}</span><small>4 MAGIC CLASSES · 4 EVOLUTIONS</small></div>
          <button class="primary-button start-button" id="start-button"><span>${icon('play')} 런 시작하기</span>${icon('arrow')}</button>
          <div class="start-footnote"><span class="live-dot"></span> 설치 없이 바로 플레이 <span>·</span> 2분 × 5 스테이지 + 보스</div>
        </div>
        <div class="scene-coordinate">SECTOR_001 <span>35° 41′ N / 139° 41′ E</span></div>
        <div class="game-toast hidden" id="game-toast" role="status"></div>
        <div class="stage-banner hidden" id="stage-banner"><span id="banner-kicker">NEXT STAGE</span><strong id="banner-title"></strong><p>보상 ×10 <span>몬스터 ×3.2</span></p></div>
        <div class="arena-bottom">
          <div class="character-loadout"><div class="weapon-icon">${icon('sword')}</div><div><span class="loadout-label">시작 무기</span><strong id="weapon-name">공허의 검 <span>I</span></strong></div><span class="loadout-divider"></span><div class="attack-type">${icon('target')} 자동 공격</div></div>
          <div class="dash-indicator hidden" id="dash-indicator"><kbd>SPACE</kbd><div><strong id="dash-status">대시 준비</strong><div class="dash-track"><div id="dash-fill"></div></div></div>${icon('bolt')}</div>
          <div class="scene-tag" id="scene-tag"><span class="live-dot"></span> REAL-TIME 3D</div>
        </div>
        <div class="growth-toolbar hidden" id="growth-toolbar"><div class="spell-loadout" id="spell-loadout" aria-label="보유 마법">${['fireball', 'frost', 'lightning', 'orbit'].map(id => `<button class="spell-slot locked" data-spell="${id}" title="마법 빌드 보기" aria-label="${id} 마법 정보"><span class="spell-slot-icon">${icon(upgradeIcons[id])}</span><span class="spell-slot-rank">—</span><span class="spell-cooldown"></span></button>`).join('')}</div><button id="shop-button" class="shop-button">${icon('coin')} 강화 상점 <kbd>B</kbd></button></div>
        <div class="touch-controls hidden" id="touch-controls"><div class="dpad"><button data-move="0,-1" aria-label="위로 이동">↑</button><button data-move="-1,0" aria-label="왼쪽 이동">←</button><button data-move="0,1" aria-label="아래로 이동">↓</button><button data-move="1,0" aria-label="오른쪽 이동">→</button></div><button id="touch-dash" aria-label="대시">${icon('bolt')}</button></div>
        <div class="canvas-error hidden" id="canvas-error"><h2>3D 화면을 시작할 수 없어요</h2><p>브라우저의 하드웨어 가속을 켠 뒤 새로고침해 주세요.</p><button class="primary-button" id="reload">새로고침 ${icon('refresh')}</button></div>
      </div>
      <aside class="run-panel">
        <div class="panel-heading"><span>이번 런의 여정</span><span class="micro">THE RUN</span></div>
        <div class="stage-heading"><span class="stage-caption">CURRENT STAGE</span><div class="stage-number"><strong id="stage-number">01</strong><span>/ 0${MAX_STAGES}</span><span class="stage-symbol">✳</span></div><h3 id="stage-name">잊혀진 초원</h3><p id="stage-english">THE FORGOTTEN GROVE</p></div>
        <div class="stage-time"><span id="stage-timer-label">보스 출현까지</span><strong id="stage-time">01:30</strong></div><div class="stage-track"><div id="stage-progress"></div></div>
        <div class="scaling-stats"><div><span>${icon('coin')} 처치 보상</span><strong id="reward-multiplier">×1</strong></div><div><span>${icon('skull')} 몬스터 위력</span><strong id="enemy-multiplier">×1</strong></div></div>
        <div class="stage-route">${stageNames.map((name, i) => `<div class="route-stop ${i === 0 ? 'current' : ''}" data-stage="${i + 1}"><span class="route-point">${i === 0 ? '<i></i>' : `<b>${i + 1}</b>`}</span><span>${name}</span><span class="route-multiplier">${i === 0 ? '현재' : `×${formatGold(10 ** i)}`}</span></div>`).join('')}</div>
        <div class="build-summary"><div><span>이번 런의 빌드</span><button id="build-info" title="마법과 강화 설명">${icon('book')}</button></div><p id="build-summary">화염탄으로 시작합니다.<br>경험치를 모아 새 마법을 선택하세요.</p><div class="build-summary-foot"><span id="build-levels">마법 1종 · 진화 0종</span><span>LV. <b id="build-level">1</b></span></div></div>
        <div class="panel-tip"><span>${icon('bolt')} SMALL GAINS. NEW POSSIBILITIES.</span><p>작은 강화, 새로운 마법.<br>선택이 쌓여 <b>당신만의 빌드로.</b></p><div class="mini-bars">${Array.from({length: 22}, (_, i) => `<i style="--bar:${12 + Math.pow(i / 21, 2.5) * 38}px;--alpha:${.16 + i / 26}"></i>`).join('')}</div></div>
      </aside>
    </section>
    <section class="below-game">
      <div class="controls-guide"><span class="controls-title">HOW TO PLAY</span><span class="control-item"><span class="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> 이동</span><span class="control-item"><kbd class="wide-key">SPACE</kbd> 대시</span><span class="control-item"><kbd>ESC</kbd> 일시정지</span><span class="control-item auto-hint">${icon('target')} 공격은 자동으로</span></div>
      <button class="text-button" data-nav="guide">처음 플레이하시나요? ${icon('arrow')}</button>
    </section>
    <section class="feature-row"><div><span class="feature-index">01 /</span>${icon('coin')}<span><strong>보상을 성장으로</strong><small>10배의 골드, 이번 런의 강화 상점.</small></span><span class="feature-detail">×10</span></div><div><span class="feature-index">02 /</span>${icon('skull')}<span><strong>광활한 전장과 수호자</strong><small>4배 넓은 맵, 스테이지마다 보스.</small></span><span class="feature-detail waves">4×</span></div><div><span class="feature-index">03 /</span>${icon('diamond')}<span><strong>마법을 조합하고 진화</strong><small>작은 강화 위에 쌓는 네 가지 마법.</small></span><span class="feature-detail">∞</span></div></section>
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
  $('#live-hud').classList.toggle('hidden', !inRun);
  $('#dash-indicator').classList.toggle('hidden', !inRun);
  $('#scene-tag').classList.toggle('hidden', inRun);
  $('#start-content').classList.toggle('hidden', state.phase !== 'menu');
  $('#touch-controls').classList.toggle('hidden', !inRun);
  $('#growth-toolbar').classList.toggle('hidden', !inRun);
  $('#shop-button').disabled = !['playing', 'paused'].includes(state.phase);
  $('#pause-button').disabled = !['playing', 'paused'].includes(state.phase);
  $('#health-value').innerHTML = `${Math.ceil(state.hp)} <small>/ ${Math.round(state.maxHp)}</small>`;
  $('#health-fill').style.width = `${Math.max(0, state.hp / state.maxHp * 100)}%`;
  $('#health-fill').classList.toggle('low', state.hp < state.maxHp * .3);
  $('#level-value').textContent = `LV. ${state.level}`;
  $('#xp-fill').style.width = `${Math.min(100, state.xp / state.xpNeeded * 100)}%`;
  $('#xp-value').textContent = `${Math.floor(state.xp)} / ${state.xpNeeded}`;
  $('#run-time').textContent = time(state.elapsed);
  $('#kill-count').textContent = state.kills.toLocaleString();
  $('#gold-count').textContent = formatGold(state.gold);
  $('#stage-number').textContent = String(state.stage).padStart(2, '0');
  $('#stage-name').textContent = $('#area-name').textContent = stageNames[state.stage - 1];
  $('#stage-english').textContent = stageEnglish[state.stage - 1];
  $('#area-stage').textContent = `STAGE ${String(state.stage).padStart(2, '0')}`;
  const boss = state.boss;
  const bossAlive = !!boss && boss.hp > 0;
  const waitingForBoss = state.stageTime >= STAGE_DURATION && bossAlive;
  const beforeBoss = state.stageTime < BOSS_SPAWN_TIME && !boss?.spawned;
  $('#stage-timer-label').textContent = waitingForBoss ? '수호자를 처치해야 진행됩니다' : beforeBoss ? '보스 출현까지' : bossAlive ? '보스전 · 생존 목표까지' : '다음 스테이지까지';
  $('#stage-time').textContent = waitingForBoss ? '처치 대기' : time(Math.ceil((beforeBoss ? BOSS_SPAWN_TIME : STAGE_DURATION) - state.stageTime));
  $('#stage-progress').style.width = `${state.stageTime / STAGE_DURATION * 100}%`;
  $('#reward-multiplier').textContent = `×${formatGold(getStageStats(state.stage).coinValue)}`;
  $('#enemy-multiplier').textContent = `×${(3.2 ** (state.stage - 1)).toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  $('#difficulty').textContent = bossAlive ? '수호자 출현' : state.stage >= 3 ? '원거리 몬스터 주의' : state.stageTime > 60 ? '몰려오는 적들' : '생존과 성장';
  $('#boss-hud').classList.toggle('hidden', !bossAlive);
  if (bossAlive) {
    $('#boss-name').textContent = boss.name;
    $('#boss-health-value').textContent = `${Math.ceil(boss.hp).toLocaleString()} / ${Math.ceil(boss.maxHp).toLocaleString()}`;
    $('#boss-health-fill').style.width = `${Math.max(0, Math.min(100, boss.hp / boss.maxHp * 100))}%`;
    $('#boss-hint').textContent = waitingForBoss ? '시간이 끝나도 보스를 처치해야 돌파할 수 있습니다' : '붉은 예고 범위를 벗어나고, 돌진은 대시로 피하세요';
  }
  $('#weapon-name').innerHTML = `공허의 검 <span>${['I', 'II', 'III', 'IV', 'V'][Math.min(4, Math.floor((state.level - 1) / 3))]}</span>`;
  $('.loadout-label').textContent = inRun ? `공격력 ${Math.round(state.damage)} · LV. ${state.level}` : '시작 무기';
  const cooldown = state.dashCooldown || 0;
  $('#dash-status').textContent = cooldown <= 0 ? '대시 준비' : `${cooldown.toFixed(1)}초`;
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
    slot.title = slot.ariaLabel = spell.rank ? `${spell.name} ${spell.evolved ? '진화 완료' : `${spell.rank}단계`} · 빌드 보기` : `${spell.name} 미습득 · 레벨업 또는 강화 상점에서 획득`;
  }
  const owned = spells.filter(s => s.rank > 0);
  const buildSignature = `${state.level}:${owned.map(s => `${s.id}:${s.rank}:${s.evolved}`).join(',')}`;
  if (buildSignature !== lastBuildSignature) {
    lastBuildSignature = buildSignature;
    $('#build-summary').innerHTML = owned.map(s => `<span style="--spell:${escapeHTML(s.color || '#c2f568')}">${icon(upgradeIcons[s.id])} ${escapeHTML(s.evolved ? SPELLS.find(d => d.id === s.id)?.evolutionName || s.name : s.name)} <b>${s.evolved ? '★' : `Lv.${s.rank}`}</b></span>`).join('');
    $('#build-levels').textContent = `마법 ${owned.length}종 · 진화 ${owned.filter(s => s.evolved).length}종`;
    $('#build-level').textContent = state.level;
  }
  for (const stop of document.querySelectorAll('.route-stop')) {
    const n = Number(stop.dataset.stage);
    stop.classList.toggle('current', n === state.stage);
    stop.classList.toggle('completed', n < state.stage);
    stop.querySelector('.route-point').innerHTML = n < state.stage ? icon('check') : n === state.stage ? '<i></i>' : `<b>${n}</b>`;
    stop.querySelector('.route-multiplier').textContent = n === state.stage ? '현재' : n < state.stage ? '완료' : `×${formatGold(10 ** (n - 1))}`;
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
  if (dialogName === 'upgrade' || dialogName === 'result') return;
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
  game.restart(); sound(320, .2);
  showToast('초록 경험치 조각을 모으세요. 레벨업마다 마법과 강화를 선택합니다.');
  $('#game-canvas').focus({ preventScroll: true });
}
function showGuide() {
  openModal('guide', `<div class="modal-eyebrow">FIELD MANUAL / 002</div><h2 id="modal-title">작은 선택이, 거대한 빌드로<span>.</span></h2><p class="modal-description">네 가지 마법과 다섯 수호자. 오래 살아남을수록 더 깊어집니다.</p><div class="guide-steps"><div><span>01</span><div><h3>4배 넓어진 전장을 누비세요</h3><p><kbd>W A S D</kbd> / 방향키로 이동, <kbd>SPACE</kbd>로 무적 대시. 모바일은 방향 버튼이나 전장 드래그를 사용합니다. 검과 보유 마법은 자동으로 공격합니다.</p></div></div><div><span>02</span><div><h3>경험치 → 선택 → 마법 진화</h3><p>초록 조각을 모으면 3개 강화 중 하나를 선택합니다. 공격력·공격 속도는 <b>5%</b>씩 미세하게 성장합니다. 마법은 <b>5단계</b>까지 강화하고, 다음 선택에서 진화시킬 수 있습니다. 마법 선택지가 남아 있다면 레벨업에 반드시 하나 이상 등장합니다.</p></div></div><div><span>03</span><div><h3>골드를 아끼지만 말고, 투자하세요</h3><p><kbd>B</kbd> 또는 하단의 <b>강화 상점</b>을 눌러 골드로 이번 런의 능력치·마법을 강화하세요. 상점을 여는 동안 전투는 멈추고, 재도전하면 모든 강화가 초기화됩니다.</p></div></div><div><span>04</span><div><h3>2분 생존, 그리고 수호자 처치</h3><p>스테이지마다 <b>90초</b>에 보스가 등장합니다. <b>2분 생존 + 보스 처치</b>를 모두 달성해야 다음 단계로 진행됩니다. 3스테이지부터는 원거리 몬스터가 공격합니다. 돌진과 장판의 붉은 예고를 피하세요.</p></div></div><div><span>05</span><div><h3>더 강한 적, 더 큰 보상</h3><p>다음 단계의 골드는 <b>10배</b>, 몬스터 능력치는 <b>3.2배</b>. 보스 돌파 축복은 공격력 <b>1.8배</b>·최대 체력 <b>2배</b>와 완전 회복을 줍니다. 이는 작은 레벨업 강화와 별도로 주어지는 스테이지 보정입니다.</p></div></div></div><div class="guide-bottom">${icon('info')} ${STAGE_DURATION / 60}분 × ${MAX_STAGES} 스테이지. 시간이 끝나도 살아 있는 보스는 처치해야 합니다.</div>`);
}

function showBuild() {
  if (['upgrade', 'result'].includes(dialogName)) return;
  const spells = getSpellStates();
  const passiveNames = { power: '공격력', haste: '공격 속도', vitality: '생명력', magnet: '획득 범위', critical: '치명타', armor: '방어력', regen: '재생', speed: '이동 속도' };
  const passives = Object.entries(latest?.playerStats?.passiveLevels || {}).filter(([, n]) => n > 0);
  openModal('build', `<div class="modal-eyebrow">YOUR BUILD / THIS RUN</div><h2 id="modal-title">마법은 조합할수록 강하게<span>.</span></h2><p class="modal-description">마법은 5단계 후 진화할 수 있습니다. 기본 능력치와 모든 강화는 이번 런에 적용됩니다.</p><div class="spell-codex">${spells.map(s => `<div class="codex-card ${s.rank ? '' : 'unowned'}" style="--spell:${escapeHTML(s.color || '#c2f568')}"><div class="codex-icon">${icon(upgradeIcons[s.id])}</div><div><span>${s.evolved ? '진화 완료' : s.rank ? `${s.rank} / 5단계` : '레벨업 · 상점에서 습득'}</span><h3>${escapeHTML(s.evolved ? s.evolutionName : s.name)}</h3><p>${escapeHTML(s.description)}</p><small>진화 → ${escapeHTML(s.evolutionName)}</small></div></div>`).join('')}</div><div class="passive-build"><h3>미세 강화</h3>${passives.length ? passives.map(([id, n]) => `<span>${icon(upgradeIcons[id])}${passiveNames[id] || id} <b>Lv.${n}</b></span>`).join('') : '<p>레벨업 또는 강화 상점에서 기본 능력치를 조금씩 올릴 수 있습니다.</p>'}</div><div class="guide-bottom">${icon('info')} 여러 마법을 함께 보유할 수 있고, 재도전하면 새 빌드로 시작합니다.</div>`);
}

function showShop() {
  if (dialogName === 'shop') { closeModal(); return; }
  if (dialogName || !['playing', 'paused'].includes(latest?.phase)) return;
  if (latest.phase === 'paused') pausedForDialog = true;
  openModal('shop', `<div class="modal-eyebrow">INVEST IN THIS RUN</div><h2 id="modal-title">작은 투자가, 다음 생존으로<span>.</span></h2><div class="shop-heading"><p class="modal-description">기본 능력치는 조금씩, 마법은 한 단계씩.</p><span>${icon('coin')}<strong id="shop-gold"></strong></span></div><div id="shop-grid" class="shop-grid"></div><p class="shop-feedback" id="shop-feedback" role="status"></p><div class="guide-bottom">${icon('info')} 전투가 일시정지되었습니다. 가격은 스테이지·강화 단계에 따라 오르며 모든 강화는 이번 런에만 적용됩니다.</div>`);
  renderShop();
}
function renderShop() {
  $('#shop-gold').textContent = formatGold(latest.gold);
  const offers = getShopOffers(latest.playerStats, latest.stage);
  $('#shop-grid').innerHTML = offers.length ? offers.map(offer => `<button class="shop-card ${escapeHTML(offer.category)}" data-buy="${escapeHTML(offer.id)}" ${latest.gold < offer.price ? 'disabled' : ''}><span class="shop-card-icon">${icon(upgradeIcon(offer))}</span><span class="shop-card-body"><small>${offer.category === 'evolution' ? '마법 진화' : offer.category === 'spell' ? '마법 습득 / 강화' : '미세 강화'}</small><strong>${escapeHTML(offer.title)}</strong><span>${escapeHTML(offer.description)}</span></span><span class="shop-price">${icon('coin')} ${formatGold(offer.price)}</span></button>`).join('') : '<p class="shop-maxed">이번 런의 모든 강화와 마법을 완성했습니다.</p>';
  document.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.buy;
    const selected = offers.find(offer => offer.id === id);
    const bought = game.purchaseUpgrade(id);
    renderShop();
    $('#shop-feedback').textContent = bought ? `${selected.title} 적용 완료 · 이번 런의 빌드가 강화되었습니다.` : '골드가 부족하거나 더 이상 강화할 수 없습니다.';
    sound(bought ? 760 : 180, .15);
    document.querySelector(`[data-buy="${id}"]:not(:disabled)`)?.focus();
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
    openModal('pause', `<div class="modal-eyebrow">TAKE A BREATH</div><h2 id="modal-title">잠깐, 숨 고르기<span>.</span></h2><p class="modal-description">공허는 당신을 기다려줍니다.</p><div class="pause-stats"><div><span>스테이지</span><strong>${latest.stage} <small>/ 5</small></strong></div><div><span>생존 시간</span><strong>${time(latest.elapsed)}</strong></div><div><span>처치 수</span><strong>${latest.kills}</strong></div></div><button id="resume" class="primary-button">${icon('play')} 계속 플레이 ${icon('arrow')}</button><button id="pause-restart" class="secondary-button">${icon('refresh')} 처음부터 다시</button>`, { pause: false });
    $('#resume').addEventListener('click', closeModal); $('#pause-restart').addEventListener('click', startRun);
  } else if (dialogName === 'pause') closeModal();
}
function onLevelUp(choices) {
  sound(880, .25, .08);
  openModal('upgrade', `<div class="modal-eyebrow">LEVEL ${game?.state.level || latest?.level || ''} / SHAPE YOUR BUILD</div><h2 id="modal-title">작은 선택, 새로운 가능성<span>.</span></h2><p class="modal-description">새로운 마법을 습득하거나, 보유 마법과 능력치를 강화하세요.</p><div class="upgrade-grid">${choices.map((choice, i) => `<button class="upgrade-card ${escapeHTML(choice.rarity)} ${escapeHTML(choice.category)}" data-upgrade="${escapeHTML(choice.id)}"><div class="upgrade-card-top"><span>${choice.category === 'evolution' ? '마법 진화' : choice.category === 'spell' ? choice.rank === 1 ? '새 마법 습득' : '마법 강화' : '미세 강화'}</span><kbd>${i + 1}</kbd></div><div class="upgrade-icon">${icon(upgradeIcon(choice))}</div><div class="upgrade-rank">${choice.maxRank ? `${choice.rank} / ${choice.maxRank}` : 'PASSIVE'}</div><h3>${escapeHTML(choice.title)}</h3><p>${escapeHTML(choice.description)}</p><span class="upgrade-select">${choice.category === 'evolution' ? '진화시키기' : '선택하기'} ${icon('arrow')}</span></button>`).join('')}</div><div class="guide-bottom">${icon('info')} 선택 중에는 전투가 멈춥니다. 숫자 키 1–3 · 모든 강화는 이번 런에만 적용됩니다.</div>`, { pause: false, closeable: false });
  document.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => {
    forceCloseModal(); game.chooseUpgrade(button.dataset.upgrade); $('#game-canvas').focus({ preventScroll: true }); sound(660, .15);
  }));
}
function finish(state, won) {
  const record = { stage: state.stage, elapsed: state.elapsed, kills: state.kills, gold: state.gold, level: state.level, won, date: new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date()) };
  history.unshift(record); history = history.slice(0, 30); store('voidrun.history', history);
  $('#history-count').textContent = String(history.length).padStart(2, '0');
  $('#personal-best').textContent = `${Math.max(...history.map(r => r.stage))} 스테이지`;
  sound(won ? 1040 : 160, .5, .08);
  openModal('result', `<div class="result-emblem">${icon(won ? 'trophy' : 'skull')}</div><div class="modal-eyebrow">${won ? 'THE VOID IS YOURS' : 'EVERY END IS A NEW BEGINNING'}</div><h2 id="modal-title">${won ? '공허를 정복했습니다' : '다음 런은, 더 멀리'}<span>.</span></h2><p class="modal-description">${won ? '5개의 스테이지를 모두 돌파했습니다. 다음엔 다른 빌드로 도전해 보세요.' : `${stageNames[state.stage - 1]}에서 여정을 마쳤습니다. 새로운 조합이 기다리고 있어요.`}</p><div class="result-stats"><div><span>생존 시간</span><strong>${time(state.elapsed)}</strong></div><div><span>처치 수</span><strong>${state.kills}</strong></div><div><span>획득 골드</span><strong class="gold-text">${formatGold(state.gold)}</strong></div><div><span>도달 레벨</span><strong>LV. ${state.level}</strong></div></div><button class="primary-button" id="retry">${icon('refresh')} 한 번 더 도전 ${icon('arrow')}</button>`, { pause: false, closeable: false });
  $('#retry').addEventListener('click', startRun);
}
try {
  game = new Game($('#game-canvas'), {
    onUpdate: update,
    onLevelUp,
    onBoss: boss => {
      showToast(`${boss.name} 출현! 붉은 공격 예고를 피하세요.`);
      sound(130, .5, .08);
    },
    onBossDefeat: () => {
      showToast('수호자 격파! 보상 조각을 모으고 남은 시간까지 살아남으세요.');
      sound(960, .3, .08);
    },
    onStage: stage => {
      const num = typeof stage === 'number' ? stage : stage.stage;
      $('#banner-title').textContent = stageNames[num - 1];
      $('#banner-kicker').textContent = `STAGE ${String(num).padStart(2, '0')} / REWARD ×${formatGold(10 ** (num - 1))}`;
      $('#stage-banner').classList.remove('hidden');
      setTimeout(() => $('#stage-banner').classList.add('hidden'), 2600);
      sound(660, .35, .07);
    },
    onGameOver: state => finish(state, false),
    onWin: state => finish(state, true),
  });
  window.__game = game;
  game.setQuality(prefs.quality); syncSound();
  if (game.state) update(game.state);
} catch (error) {
  console.error('Unable to initialize game:', error);
  $('#canvas-error').classList.remove('hidden');
  $('#start-button').disabled = true;
}

$('#reload').addEventListener('click', () => location.reload());
$('#start-button').addEventListener('click', startRun);
$('#sound-toggle').addEventListener('click', () => { prefs.muted = !prefs.muted; syncSound(); sound(600); });
$('#settings').addEventListener('click', showSettings);
$('#pause-button').addEventListener('click', showPause);
$('#shop-button').addEventListener('click', showShop);
$('#build-info').addEventListener('click', showBuild);
document.querySelectorAll('[data-spell]').forEach(button => button.addEventListener('click', showBuild));
$('#fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('.game-layout').requestFullscreen(); }
  catch { showToast('이 브라우저에서는 전체 화면을 지원하지 않습니다.'); }
});
for (const button of document.querySelectorAll('[data-nav]')) button.addEventListener('click', () => {
  if (button.dataset.nav === 'guide') showGuide();
  else if (button.dataset.nav === 'history') showHistory();
  else { if (dialogName && !['upgrade', 'result'].includes(dialogName)) closeModal(); $('#arena').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
});
$('.brand').addEventListener('click', (event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('#modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop') closeModal(); });
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.preventDefault(); if (dialogName) closeModal(); else showPause(); }
  if (event.key.toLowerCase() === 'b' && !event.repeat && !event.target?.closest?.('input,textarea,select')) { event.preventDefault(); showShop(); }
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
