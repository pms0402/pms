import './style.css';
import { Game } from './game.js';
import { formatGold, getStageStats, STAGE_DURATION, MAX_STAGES } from './balance.js';
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

$('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="#" aria-label="VOIDRUN 홈"><span class="brand-mark">${icon('bolt')}</span>VOID<span>RUN</span><sup>®</sup></a>
    <nav class="main-nav" aria-label="주 메뉴">
      <button class="nav-link active" data-nav="play">플레이<span class="nav-dot"></span></button>
      <button class="nav-link" data-nav="guide">게임 가이드</button>
      <button class="nav-link" data-nav="history">런 기록 <span class="nav-count" id="history-count">${history.length.toString().padStart(2, '0')}</span></button>
    </nav>
    <div class="header-actions"><span class="build-label"><i></i> EARLY ACCESS <b>v0.1</b></span><span class="header-divider"></span><button id="sound-toggle" class="icon-button" title="사운드 켜기" aria-label="사운드 켜기">${icon('muted')}</button><button id="settings" class="icon-button" title="설정" aria-label="설정">${icon('settings')}</button></div>
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
        <div class="start-content" id="start-content">
          <div class="roguelike-tag"><span></span> 3D SURVIVAL ROGUELIKE</div>
          <h2>작은 시작.<br>거대한 <span>한 방.</span></h2>
          <p>쓰러질 때까지 강해지세요.<br>이번엔, 당신이 압도할 차례.</p>
          <button class="primary-button start-button" id="start-button"><span>${icon('play')} 런 시작하기</span>${icon('arrow')}</button>
          <div class="start-footnote"><span class="live-dot"></span> 설치 없이 바로 플레이 <span>·</span> 약 4분 / 런</div>
        </div>
        <div class="scene-coordinate">SECTOR_001 <span>35° 41′ N / 139° 41′ E</span></div>
        <div class="game-toast hidden" id="game-toast" role="status"></div>
        <div class="stage-banner hidden" id="stage-banner"><span id="banner-kicker">NEXT STAGE</span><strong id="banner-title"></strong><p>보상 ×10 <span>몬스터 ×3.2</span></p></div>
        <div class="arena-bottom">
          <div class="character-loadout"><div class="weapon-icon">${icon('sword')}</div><div><span class="loadout-label">시작 무기</span><strong id="weapon-name">공허의 검 <span>I</span></strong></div><span class="loadout-divider"></span><div class="attack-type">${icon('target')} 자동 공격</div></div>
          <div class="dash-indicator hidden" id="dash-indicator"><kbd>SPACE</kbd><div><strong id="dash-status">대시 준비</strong><div class="dash-track"><div id="dash-fill"></div></div></div>${icon('bolt')}</div>
          <div class="scene-tag" id="scene-tag"><span class="live-dot"></span> REAL-TIME 3D</div>
        </div>
        <div class="touch-controls hidden" id="touch-controls"><div class="dpad"><button data-move="0,-1" aria-label="위로 이동">↑</button><button data-move="-1,0" aria-label="왼쪽 이동">←</button><button data-move="0,1" aria-label="아래로 이동">↓</button><button data-move="1,0" aria-label="오른쪽 이동">→</button></div><button id="touch-dash" aria-label="대시">${icon('bolt')}</button></div>
        <div class="canvas-error hidden" id="canvas-error"><h2>3D 화면을 시작할 수 없어요</h2><p>브라우저의 하드웨어 가속을 켠 뒤 새로고침해 주세요.</p><button class="primary-button" id="reload">새로고침 ${icon('refresh')}</button></div>
      </div>
      <aside class="run-panel">
        <div class="panel-heading"><span>이번 런의 여정</span><span class="micro">THE RUN</span></div>
        <div class="stage-heading"><span class="stage-caption">CURRENT STAGE</span><div class="stage-number"><strong id="stage-number">01</strong><span>/ 0${MAX_STAGES}</span><span class="stage-symbol">✳</span></div><h3 id="stage-name">잊혀진 초원</h3><p id="stage-english">THE FORGOTTEN GROVE</p></div>
        <div class="stage-time"><span>다음 스테이지까지</span><strong id="stage-time">00:45</strong></div><div class="stage-track"><div id="stage-progress"></div></div>
        <div class="scaling-stats"><div><span>${icon('coin')} 처치 보상</span><strong id="reward-multiplier">×1</strong></div><div><span>${icon('skull')} 몬스터 위력</span><strong id="enemy-multiplier">×1</strong></div></div>
        <div class="stage-route">${stageNames.map((name, i) => `<div class="route-stop ${i === 0 ? 'current' : ''}" data-stage="${i + 1}"><span class="route-point">${i === 0 ? '<i></i>' : `<b>${i + 1}</b>`}</span><span>${name}</span><span class="route-multiplier">${i === 0 ? '현재' : `×${formatGold(10 ** i)}`}</span></div>`).join('')}</div>
        <div class="panel-tip"><span>${icon('bolt')} THE HIGHER, THE WILDER</span><p>스테이지마다 보상은 <b>10배.</b><br>위험할수록, 더 달콤하게.</p><div class="mini-bars">${Array.from({length: 22}, (_, i) => `<i style="--bar:${12 + Math.pow(i / 21, 2.5) * 38}px;--alpha:${.16 + i / 26}"></i>`).join('')}</div></div>
      </aside>
    </section>
    <section class="below-game">
      <div class="controls-guide"><span class="controls-title">HOW TO PLAY</span><span class="control-item"><span class="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> 이동</span><span class="control-item"><kbd class="wide-key">SPACE</kbd> 대시</span><span class="control-item"><kbd>ESC</kbd> 일시정지</span><span class="control-item auto-hint">${icon('target')} 공격은 자동으로</span></div>
      <button class="text-button" data-nav="guide">처음 플레이하시나요? ${icon('arrow')}</button>
    </section>
    <section class="feature-row"><div><span class="feature-index">01 /</span>${icon('coin')}<span><strong>쏟아지는 보상</strong><small>매 스테이지, 골드가 10배로.</small></span><span class="feature-detail">×10</span></div><div><span class="feature-index">02 /</span>${icon('skull')}<span><strong>끝없이 거세지는 웨이브</strong><small>고요한 초반, 압도적인 후반.</small></span><span class="feature-detail waves">≋</span></div><div><span class="feature-index">03 /</span>${icon('diamond')}<span><strong>매번 다른 빌드</strong><small>업그레이드를 조합해 한계를 돌파.</small></span><span class="feature-detail">∞</span></div></section>
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
  $('#stage-time').textContent = time(Math.ceil(STAGE_DURATION - state.stageTime));
  $('#stage-progress').style.width = `${state.stageTime / STAGE_DURATION * 100}%`;
  $('#reward-multiplier').textContent = `×${formatGold(getStageStats(state.stage).coinValue)}`;
  $('#enemy-multiplier').textContent = `×${(3.2 ** (state.stage - 1)).toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  $('#difficulty').textContent = state.stage > 3 ? '끝없는 군단' : state.stage > 1 ? '거세지는 공세' : state.stageTime > 25 ? '몰려오는 적들' : '고요한 시작';
  $('#weapon-name').innerHTML = `공허의 검 <span>${['I', 'II', 'III', 'IV', 'V'][Math.min(4, Math.floor((state.level - 1) / 3))]}</span>`;
  $('.loadout-label').textContent = inRun ? `공격력 ${Math.round(state.damage)} · LV. ${state.level}` : '시작 무기';
  const cooldown = state.dashCooldown || 0;
  $('#dash-status').textContent = cooldown <= 0 ? '대시 준비' : `${cooldown.toFixed(1)}초`;
  $('#dash-fill').style.width = `${Math.max(0, 1 - cooldown / 3) * 100}%`;
  $('#dash-indicator').classList.toggle('on-cooldown', cooldown > 0);
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
  showToast('이동하며 적을 처치하고, 경험치 조각을 모으세요.');
  $('#game-canvas').focus({ preventScroll: true });
}
function showGuide() {
  openModal('guide', `<div class="modal-eyebrow">FIELD MANUAL / 001</div><h2 id="modal-title">첫 런을 위한 가이드<span>.</span></h2><p class="modal-description">움직임은 간단하게. 성장의 선택은 대담하게.</p><div class="guide-steps"><div><span>01</span><div><h3>움직이고, 피하세요</h3><p><kbd>W A S D</kbd> 또는 방향키로 이동하고, <kbd>SPACE</kbd>로 대시하세요. 대시 중에는 적의 공격을 피할 수 있습니다.</p></div></div><div><span>02</span><div><h3>전투는 자동, 선택은 당신의 몫</h3><p>가까운 적을 자동으로 공격합니다. 초록색 경험치 조각을 모으면 레벨이 오르고, 세 가지 업그레이드 중 하나를 선택할 수 있어요.</p></div></div><div><span>03</span><div><h3>더 위험하게, 더 부유하게</h3><p>45초마다 다음 스테이지로 이동합니다. 골드 보상은 <b>10배</b>, 몬스터 체력과 공격력은 <b>3.2배</b>. 스테이지 돌파 시 공격력이 함께 성장하고 체력이 회복됩니다.</p></div></div><div><span>04</span><div><h3>공허의 심장까지 살아남으세요</h3><p>5개 스테이지를 모두 돌파하면 승리합니다. 사망하면 새 빌드로 다시 도전하세요. 런 기록은 이 브라우저에 저장됩니다.</p></div></div></div><div class="guide-bottom">${icon('info')} 잠깐 쉬고 싶을 땐 <kbd>ESC</kbd>로 일시정지</div>`);
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
  const choiceIcons = { power: 'sword', haste: 'bolt', vitality: 'heart', magnet: 'magnet', multishot: 'target', critical: 'diamond', armor: 'shield', regen: 'cross' };
  openModal('upgrade', `<div class="modal-eyebrow">A LITTLE STRONGER. A LOT DEADLIER.</div><h2 id="modal-title">한계를 한 단계 더<span>.</span></h2><p class="modal-description">레벨 업! 이번 런을 바꿀 힘을 선택하세요.</p><div class="upgrade-grid">${choices.map((choice, i) => `<button class="upgrade-card ${escapeHTML(choice.rarity)}" data-upgrade="${escapeHTML(choice.id)}"><div class="upgrade-card-top"><span>${escapeHTML(({rare:'레어',epic:'에픽',legendary:'전설',common:'일반'})[choice.rarity] || '업그레이드')}</span><kbd>${i + 1}</kbd></div><div class="upgrade-icon">${icon(choiceIcons[choice.id] || 'bolt')}</div><h3>${escapeHTML(choice.title)}</h3><p>${escapeHTML(choice.description)}</p><span class="upgrade-select">선택하기 ${icon('arrow')}</span></button>`).join('')}</div><div class="guide-bottom">${icon('info')} 선택하는 동안 전투는 일시정지됩니다. 숫자 키 1–3으로도 선택할 수 있어요.</div>`, { pause: false, closeable: false });
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
