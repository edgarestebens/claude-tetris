'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const RECORDS_KEY = 'tetris-records';
const TOP_N = 5;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#90a4ae', // Nut - metallic
  '#ff1744', // Bomb - red
];

const THEME_GRID = {
  dark: '#22222e',
  light: '#d0d0dc'
};

let currentTheme = 'dark';

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut
];

const BOMB_TYPE = 9;
const POWERUP_EVERY = 5;
const LINE_SCORES = [0, 100, 300, 500, 800];
const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 15;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const newRecordMsg = document.getElementById('new-record-msg');
const nameEntry = document.getElementById('name-entry');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const recordsPanel = document.getElementById('records-panel');
const recordsList = document.getElementById('records-list');
const statBestCombo = document.getElementById('stat-best-combo');
const statMaxLines = document.getElementById('stat-max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const mainView = document.getElementById('main-view');
const pauseView = document.getElementById('pause-view');
const pauseMain = document.getElementById('pause-main');
const controlsPanel = document.getElementById('controls-panel');
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const levelDownBtn = document.getElementById('level-down');
const levelUpBtn = document.getElementById('level-up');
const startLevelValue = document.getElementById('start-level-value');
const ssLevelDownBtn = document.getElementById('ss-level-down');
const ssLevelUpBtn = document.getElementById('ss-level-up');
const ssStartLevelValue = document.getElementById('ss-start-level-value');

let board, current, next, score, lines, level, combo, maxCombo, paused, gameOver, lastTime, dropAccum, dropInterval, animId, bombsQueued;
let started = false;
let pendingHighlightIndex = -1;
let scoreSaved = false;
let startLevel = 1;
let pauseShowingControls = false;

function emptyRecords() {
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return emptyRecords();
    const data = JSON.parse(raw);
    return {
      scores: Array.isArray(data.scores) ? data.scores.slice(0, TOP_N) : [],
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0
    };
  } catch {
    return emptyRecords();
  }
}

function saveRecords(data) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(data));
}

function qualifiesForTop(points) {
  if (points <= 0) return false;
  const { scores } = loadRecords();
  return scores.length < TOP_N || points > scores[scores.length - 1].score;
}

function updateCareerStats(sessionCombo, sessionLines) {
  const data = loadRecords();
  let changed = false;
  if (sessionCombo > data.bestCombo) {
    data.bestCombo = sessionCombo;
    changed = true;
  }
  if (sessionLines > data.maxLines) {
    data.maxLines = sessionLines;
    changed = true;
  }
  if (changed) saveRecords(data);
  return data;
}

function addScoreEntry(name, points, sessionLines, sessionCombo) {
  const data = loadRecords();
  const entry = {
    name: (name || '').trim().slice(0, 12) || 'Anónimo',
    score: points,
    lines: sessionLines,
    combo: sessionCombo
  };
  data.scores.push(entry);
  data.scores.sort((a, b) => b.score - a.score || b.lines - a.lines);
  data.scores = data.scores.slice(0, TOP_N);
  data.bestCombo = Math.max(data.bestCombo, sessionCombo);
  data.maxLines = Math.max(data.maxLines, sessionLines);
  saveRecords(data);
  return data.scores.findIndex(s => s === entry);
}

function renderRecords(highlightIndex = -1) {
  const data = loadRecords();
  recordsList.innerHTML = '';

  if (!data.scores.length) {
    const empty = document.createElement('li');
    empty.className = 'records-empty';
    empty.textContent = 'Sin records todavía';
    recordsList.appendChild(empty);
  } else {
    data.scores.forEach((entry, i) => {
      const li = document.createElement('li');
      if (i === highlightIndex) li.classList.add('highlight');
      li.innerHTML =
        `<span class="rank">${i + 1}.</span>` +
        `<span class="player-name"></span>` +
        `<span class="player-score"></span>`;
      li.querySelector('.player-name').textContent = entry.name;
      li.querySelector('.player-score').textContent = entry.score.toLocaleString();
      recordsList.appendChild(li);
    });
  }

  statBestCombo.textContent = String(data.bestCombo);
  statMaxLines.textContent = String(data.maxLines);
}

function setOverlayExtras({ showRecords, showNameEntry, showNewRecord, buttonText }) {
  recordsPanel.classList.toggle('hidden', !showRecords);
  nameEntry.classList.toggle('hidden', !showNameEntry);
  newRecordMsg.classList.toggle('hidden', !showNewRecord);
  restartBtn.textContent = buttonText;
}

function hideOverlayViews() {
  mainView.classList.add('hidden');
  pauseView.classList.add('hidden');
  pauseMain.classList.remove('hidden');
  controlsPanel.classList.add('hidden');
  pauseShowingControls = false;
}

function showMainOverlay() {
  hideOverlayViews();
  mainView.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function showPauseOverlay() {
  hideOverlayViews();
  updateStartLevelUI();
  pauseView.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
  hideOverlayViews();
}

function updateStartLevelUI() {
  const label = String(startLevel);
  const atMin = startLevel <= MIN_START_LEVEL;
  const atMax = startLevel >= MAX_START_LEVEL;
  startLevelValue.textContent = label;
  ssStartLevelValue.textContent = label;
  levelDownBtn.disabled = atMin;
  ssLevelDownBtn.disabled = atMin;
  levelUpBtn.disabled = atMax;
  ssLevelUpBtn.disabled = atMax;
}

function setStartLevel(nextLevel) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(MIN_START_LEVEL, nextLevel));
  updateStartLevelUI();
}

function showControlsInPause() {
  pauseShowingControls = true;
  pauseMain.classList.add('hidden');
  controlsPanel.classList.remove('hidden');
}

function hideControlsInPause() {
  pauseShowingControls = false;
  controlsPanel.classList.add('hidden');
  pauseMain.classList.remove('hidden');
}

function showStartScreen() {
  started = false;
  gameOver = false;
  paused = false;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  pendingHighlightIndex = -1;
  scoreSaved = false;
  setOverlayExtras({
    showRecords: true,
    showNameEntry: false,
    showNewRecord: false,
    buttonText: 'Jugar'
  });
  updateStartLevelUI();
  renderRecords();
  showMainOverlay();
  drawEmptyBoard();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function createBombPiece() {
  const shape = [[BOMB_TYPE]];
  return {
    type: BOMB_TYPE,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0
  };
}

function randomPiece() {
  if (bombsQueued > 0) {
    bombsQueued--;
    return createBombPiece();
  }
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function dropIntervalForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    const prevLines = lines;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = dropIntervalForLevel(level);
    const prevTier = Math.floor(prevLines / POWERUP_EVERY);
    const newTier = Math.floor(lines / POWERUP_EVERY);
    if (newTier > prevTier) bombsQueued += newTier - prevTier;
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function explodeBomb() {
  const cx = current.x;
  const cy = current.y;
  let destroyed = 0;
  for (let r = cy - 1; r <= cy + 1; r++) {
    for (let c = cx - 1; c <= cx + 1; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (board[r][c]) {
        board[r][c] = 0;
        destroyed++;
      }
    }
  }
  score += destroyed * 10;
}

function lockPiece() {
  if (current.type === BOMB_TYPE) {
    explodeBomb();
  } else {
    merge();
  }
  const cleared = clearLines();
  if (!cleared) combo = 0;
  updateHUD();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  if (colorIndex === BOMB_TYPE) {
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.beginPath();
    context.arc(x * size + size / 2, y * size + size / 2, size * 0.18, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEME_GRID[currentTheme];
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function drawEmptyBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function resumeGame() {
  if (!paused || gameOver) return;
  paused = false;
  hideOverlay();
  lastTime = performance.now();
  dropAccum = 0;
  animId = requestAnimationFrame(loop);
}

function pauseGame() {
  if (!started || paused || gameOver) return;
  paused = true;
  cancelAnimationFrame(animId);
  showPauseOverlay();
}

function togglePause() {
  if (!started || gameOver) return;
  if (paused) {
    if (pauseShowingControls) {
      hideControlsInPause();
      return;
    }
    resumeGame();
  } else {
    pauseGame();
  }
}

function endGame() {
  gameOver = true;
  paused = false;
  cancelAnimationFrame(animId);
  updateCareerStats(maxCombo, lines);

  const isTop = qualifiesForTop(score);
  pendingHighlightIndex = -1;
  scoreSaved = false;

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · Combo máx: ${maxCombo} · Líneas: ${lines}`;
  setOverlayExtras({
    showRecords: true,
    showNameEntry: isTop,
    showNewRecord: isTop,
    buttonText: 'Reiniciar'
  });
  if (isTop) {
    playerNameInput.value = '';
    setTimeout(() => playerNameInput.focus(), 0);
  }
  updateStartLevelUI();
  renderRecords();
  showMainOverlay();
}

function loop(ts) {
  if (gameOver || paused) return;

  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver || paused) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  started = true;
  scoreSaved = false;
  pendingHighlightIndex = -1;
  dropInterval = dropIntervalForLevel(level);
  dropAccum = 0;
  bombsQueued = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  hideOverlay();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function savePendingScore() {
  if (scoreSaved || !qualifiesForTop(score)) return;
  pendingHighlightIndex = addScoreEntry(playerNameInput.value, score, lines, maxCombo);
  scoreSaved = true;
  setOverlayExtras({
    showRecords: true,
    showNameEntry: false,
    showNewRecord: true,
    buttonText: 'Reiniciar'
  });
  renderRecords(pendingHighlightIndex);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    togglePause();
    return;
  }

  if (!nameEntry.classList.contains('hidden') && document.activeElement === playerNameInput) {
    if (e.code === 'Enter') {
      e.preventDefault();
      savePendingScore();
    }
    return;
  }

  if (!started || paused || gameOver) {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    return;
  }

  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', showControlsInPause);
controlsBackBtn.addEventListener('click', hideControlsInPause);
levelDownBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
levelUpBtn.addEventListener('click', () => setStartLevel(startLevel + 1));
ssLevelDownBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
ssLevelUpBtn.addEventListener('click', () => setStartLevel(startLevel + 1));

saveScoreBtn.addEventListener('click', savePendingScore);

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  saveRecords(emptyRecords());
  pendingHighlightIndex = -1;
  scoreSaved = false;
  if (gameOver && qualifiesForTop(score)) {
    setOverlayExtras({
      showRecords: true,
      showNameEntry: true,
      showNewRecord: true,
      buttonText: 'Reiniciar'
    });
  }
  renderRecords();
});

const themeToggle = document.getElementById('theme-toggle-input');
const themeSwitch = themeToggle.parentElement;

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  themeToggle.checked = theme === 'light';
  themeSwitch.setAttribute('aria-checked', theme === 'light');
  if (started && board && current && !gameOver) {
    draw();
    drawNext();
  } else {
    drawEmptyBoard();
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('tetris-theme');
  applyTheme(savedTheme || 'dark');
}

themeToggle.addEventListener('change', () => {
  const newTheme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem('tetris-theme', newTheme);
  applyTheme(newTheme);
});

initTheme();
showStartScreen();
