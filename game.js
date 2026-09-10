'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKIN_STORAGE_KEY = 'tetris-skin';

function drawBombMark(context, x, y, size) {
  context.fillStyle = 'rgba(255,255,255,0.85)';
  context.beginPath();
  context.arc(x * size + size / 2, y * size + size / 2, size * 0.18, 0, Math.PI * 2);
  context.fill();
}

function fillRoundRect(context, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
  context.fill();
}

function shadeColor(hex, amount) {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map(c => c + c).join('') : n, 16);
  const clamp = v => Math.max(0, Math.min(255, v));
  const r = clamp(((num >> 16) & 255) + amount);
  const g = clamp(((num >> 8) & 255) + amount);
  const b = clamp((num & 255) + amount);
  return `rgb(${r},${g},${b})`;
}

const SKINS = {
  retro: {
    id: 'retro',
    label: 'Retro',
    colors: [
      null,
      '#4dd0e1',
      '#ffd54f',
      '#ba68c8',
      '#81c784',
      '#e57373',
      '#90caf9',
      '#ffb74d',
      '#90a4ae',
      '#ff1744',
    ],
    grid: { dark: '#22222e', light: '#d0d0dc' },
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      if (colorIndex === BOMB_TYPE) {
        drawBombMark(context, x, y, size);
      } else {
        context.fillStyle = 'rgba(255,255,255,0.12)';
        context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      }
      context.globalAlpha = 1;
    },
  },
  neon: {
    id: 'neon',
    label: 'Neon',
    colors: [
      null,
      '#00fff2',
      '#ffe600',
      '#d500f9',
      '#39ff14',
      '#ff073a',
      '#00b7ff',
      '#ff9100',
      '#b0bec5',
      '#ff1744',
    ],
    grid: { dark: '#111118', light: '#1a1a22' },
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      const px = x * size + 2;
      const py = y * size + 2;
      const s = size - 4;
      context.save();
      context.globalAlpha = alpha ?? 1;
      context.shadowBlur = alpha != null && alpha < 1 ? 6 : 14;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      context.shadowBlur = 0;
      if (colorIndex === BOMB_TYPE) {
        drawBombMark(context, x, y, size);
      } else {
        context.fillStyle = 'rgba(255,255,255,0.35)';
        context.fillRect(px, py, s, 3);
        context.fillStyle = 'rgba(0,0,0,0.25)';
        context.fillRect(px, py + s - 3, s, 3);
      }
      context.restore();
    },
  },
  pastel: {
    id: 'pastel',
    label: 'Pastel',
    colors: [
      null,
      '#a8e6cf',
      '#ffe66d',
      '#d4a5ff',
      '#b5ead7',
      '#ffb3ba',
      '#a2d2ff',
      '#ffd6a5',
      '#cfd8dc',
      '#ff8a80',
    ],
    grid: { dark: '#2a2a36', light: '#e0dce8' },
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      const px = x * size + 1.5;
      const py = y * size + 1.5;
      const s = size - 3;
      const radius = Math.max(4, size * 0.22);
      context.save();
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      fillRoundRect(context, px, py, s, s, radius);
      if (colorIndex === BOMB_TYPE) {
        drawBombMark(context, x, y, size);
      } else {
        context.fillStyle = 'rgba(255,255,255,0.35)';
        fillRoundRect(context, px + 2, py + 2, s - 4, Math.max(3, s * 0.22), radius * 0.6);
      }
      context.restore();
    },
  },
  pixel: {
    id: 'pixel',
    label: 'Pixel art',
    colors: [
      null,
      '#22d3ee',
      '#facc15',
      '#c084fc',
      '#4ade80',
      '#f87171',
      '#60a5fa',
      '#fb923c',
      '#94a3b8',
      '#ef4444',
    ],
    grid: { dark: '#1e1e28', light: '#c8c8d4' },
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      const dark = shadeColor(color, -40);
      const light = shadeColor(color, 35);
      const cells = 4;
      const cell = (size - 2) / cells;
      const ox = x * size + 1;
      const oy = y * size + 1;
      context.save();
      context.globalAlpha = alpha ?? 1;
      for (let py = 0; py < cells; py++) {
        for (let px = 0; px < cells; px++) {
          const edge = px === 0 || py === 0 || px === cells - 1 || py === cells - 1;
          const checker = (px + py) % 2 === 0;
          if (edge) context.fillStyle = dark;
          else context.fillStyle = checker ? light : color;
          context.fillRect(
            Math.floor(ox + px * cell),
            Math.floor(oy + py * cell),
            Math.ceil(cell),
            Math.ceil(cell)
          );
        }
      }
      if (colorIndex === BOMB_TYPE) {
        drawBombMark(context, x, y, size);
      }
      context.restore();
    },
  },
};

let activeSkin = SKINS.retro;

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

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, bombsQueued;
let currentTheme = 'dark';

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
    const prevLines = lines;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    const prevTier = Math.floor(prevLines / POWERUP_EVERY);
    const newTier = Math.floor(lines / POWERUP_EVERY);
    if (newTier > prevTier) bombsQueued += newTier - prevTier;
    updateHUD();
  }
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
  clearLines();
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
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  activeSkin.drawBlock(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  const themeKey = activeSkin.id === 'neon' ? 'dark' : currentTheme;
  ctx.strokeStyle = activeSkin.grid[themeKey] || activeSkin.grid.dark;
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

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  bombsQueued = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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

const themeToggle = document.getElementById('theme-toggle-input');
const themeSwitch = themeToggle.parentElement;

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  themeToggle.checked = theme === 'light';
  themeSwitch.setAttribute('aria-checked', theme === 'light');
  if (board) {
    draw();
    drawNext();
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

function applySkin(skinId) {
  const skin = SKINS[skinId] || SKINS.retro;
  activeSkin = skin;
  document.documentElement.dataset.skin = skin.id;
  if (skinSelect) skinSelect.value = skin.id;
  if (board) {
    draw();
    drawNext();
  } else if (next) {
    drawNext();
  }
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_STORAGE_KEY);
  applySkin(saved && SKINS[saved] ? saved : 'retro');
}

if (skinSelect) {
  for (const skin of Object.values(SKINS)) {
    const option = document.createElement('option');
    option.value = skin.id;
    option.textContent = skin.label;
    skinSelect.appendChild(option);
  }
  skinSelect.addEventListener('change', () => {
    localStorage.setItem(SKIN_STORAGE_KEY, skinSelect.value);
    applySkin(skinSelect.value);
  });
}

initTheme();
initSkin();
init();
