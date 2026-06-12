const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const levelText = document.querySelector("#levelText");
const streakText = document.querySelector("#streakText");
const playsText = document.querySelector("#playsText");
const overlay = document.querySelector("#overlay");
const overlayKicker = document.querySelector("#overlayKicker");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayCopy = document.querySelector("#overlayCopy");
const primaryBtn = document.querySelector("#primaryBtn");
const adPlayBtn = document.querySelector("#adPlayBtn");

const W = canvas.width;
const H = canvas.height;
const COLS = 7;
const ROW_H = 58;
const GAP = 7;
const CELL = (W - GAP * (COLS + 1)) / COLS;
const TOP = 74;
const RED_LINE = H - 82;
const SHOOT_Y = H - 42;
const BALL_R = 5;
const MAX_SPEED = 8.9;
const COUNTDOWN_MS = 3000;

const state = {
  mode: "menu",
  level: 1,
  streak: 0,
  plays: 3,
  ballsPerVolley: 9,
  bricks: [],
  balls: [],
  particles: [],
  floatTexts: [],
  aim: { active: false, x: W / 2, y: H / 2 },
  countdownUntil: 0,
  nextVolleyId: 1,
  volleyLive: new Map(),
  comboCount: 0,
  comboUntil: 0,
  lastHitBrick: null,
};

function updateHud() {
  levelText.textContent = state.level;
  streakText.textContent = state.streak;
  playsText.textContent = state.plays;
}

function showOverlay(kicker, title, copy, primary, action, secondary = "看广告 +1 局", secondaryAction = grantPlay) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  primaryBtn.textContent = primary;
  primaryBtn.onclick = action;
  adPlayBtn.textContent = secondary;
  adPlayBtn.onclick = secondaryAction;
  overlay.classList.add("is-visible");
}

function hideOverlay() {
  overlay.classList.remove("is-visible");
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function brickColor(value) {
  if (value > 22) return "#ef476f";
  if (value > 13) return "#ff9f1c";
  if (value > 6) return "#35d0ba";
  return "#7ad66d";
}

function rowY(row) {
  return TOP + row * ROW_H;
}

function createId() {
  const randomId = globalThis.crypto && globalThis.crypto.randomUUID;
  return randomId ? randomId.call(globalThis.crypto) : `${Date.now()}-${Math.random()}`;
}

function createBrick(col, row, bonus = 0) {
  const base = 2 + state.level + row * 2 + bonus;
  return {
    id: createId(),
    x: GAP + col * (CELL + GAP),
    y: rowY(row),
    w: CELL,
    h: ROW_H - GAP,
    value: Math.ceil(rand(base, base + 6 + state.level * 1.5)),
    hitFlash: 0,
    squash: 0,
    squashAxis: "y",
  };
}

function spawnRow(row, density, bonus = 0) {
  const bricks = [];
  let guaranteed = Math.floor(rand(0, COLS));
  for (let c = 0; c < COLS; c += 1) {
    if (Math.random() < density || c === guaranteed) bricks.push(createBrick(c, row, bonus));
  }
  return bricks;
}

function spawnLevel() {
  state.bricks = [];
  state.balls = [];
  state.particles = [];
  state.floatTexts = [];
  state.volleyLive.clear();
  state.nextVolleyId = 1;
  state.comboCount = 0;
  state.lastHitBrick = null;
  state.ballsPerVolley = Math.min(9 + Math.floor(state.level / 2), 18);

  const rows = Math.min(3 + Math.floor(state.level / 3), 6);
  const density = Math.min(0.34 + state.level * 0.035, 0.7);
  for (let r = 0; r < rows; r += 1) {
    state.bricks.push(...spawnRow(r, density, r));
  }
}

function enterCountdown() {
  hideOverlay();
  state.mode = "countdown";
  state.countdownUntil = performance.now() + COUNTDOWN_MS;
  state.aim.active = false;
}

function startRun() {
  if (state.plays <= 0) {
    showOverlay("局数不足", "看广告续局", "每次挑战消耗 1 局。看完激励广告即可继续爬塔。", "看广告 +1 局", grantPlay);
    return;
  }
  state.plays -= 1;
  spawnLevel();
  updateHud();
  enterCountdown();
}

function resetRun() {
  state.level = 1;
  state.streak = 0;
  startRun();
}

function grantPlay() {
  state.plays += 1;
  updateHud();
  showOverlay("奖励到账", "获得 1 局", "看广告换一次挑战机会，失败复活同样走激励广告。", "开始挑战", startRun);
}

function revive() {
  state.bricks.forEach((brick) => {
    brick.y = Math.max(TOP, brick.y - ROW_H * 2);
  });
  state.balls = [];
  state.volleyLive.clear();
  enterCountdown();
}

function winLevel() {
  state.mode = "won";
  state.level += 1;
  state.streak += 1;
  updateHud();
  showOverlay("通关", `第 ${state.level - 1} 关已清空`, "连胜继续累积，下一层会更硬，但每条球流也会更密。", "继续爬塔", () => {
    spawnLevel();
    enterCountdown();
  });
}

function failLevel() {
  state.mode = "failed";
  showOverlay(
    "失败",
    "红线被触碰",
    "看广告复活可把方块上移 2 格；放弃则连胜和进度清零重来。",
    "看广告复活",
    revive,
    "放弃重来",
    resetRun,
  );
}

function pointerPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H,
  };
}

function beginAim(event) {
  if (state.mode !== "playing") return;
  const pos = pointerPos(event);
  state.aim.active = true;
  state.aim.x = Math.max(18, Math.min(W - 18, pos.x));
  state.aim.y = Math.max(24, Math.min(RED_LINE - 28, pos.y));
  event.preventDefault();
}

function moveAim(event) {
  if (!state.aim.active) return;
  const pos = pointerPos(event);
  state.aim.x = Math.max(18, Math.min(W - 18, pos.x));
  state.aim.y = Math.max(24, Math.min(RED_LINE - 28, pos.y));
  event.preventDefault();
}

function endAim(event) {
  if (state.mode !== "playing") return;
  if (!state.aim.active) beginAim(event);
  state.aim.active = false;
  fireVolley(state.aim.x, state.aim.y);
}

function fireVolley(targetX, targetY) {
  const dx = targetX - W / 2;
  const dy = Math.min(targetY - SHOOT_Y, -80);
  const len = Math.hypot(dx, dy) || 1;
  const vx = (dx / len) * MAX_SPEED;
  const vy = (dy / len) * MAX_SPEED;
  const volleyId = state.nextVolleyId;

  state.nextVolleyId += 1;
  state.volleyLive.set(volleyId, state.ballsPerVolley);

  for (let i = 0; i < state.ballsPerVolley; i += 1) {
    setTimeout(() => {
      if (state.mode !== "playing") return;
      state.balls.push({
        x: W / 2,
        y: SHOOT_Y,
        vx: vx + rand(-0.22, 0.22),
        vy: vy + rand(-0.18, 0.18),
        active: true,
        volleyId,
      });
    }, i * 25);
  }
}

function rectCircleHit(ball, brick) {
  const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
  const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  return dx * dx + dy * dy < BALL_R * BALL_R;
}

function buzz() {
  if (navigator.vibrate) navigator.vibrate(12);
}

function addFloatText(text, x, y, color = "#ffd65a") {
  state.floatTexts.push({ text, x, y, vy: -1.15, life: 42, color });
}

function registerCombo(brick) {
  const now = performance.now();
  if (now < state.comboUntil && state.lastHitBrick !== brick.id) {
    state.comboCount += 1;
  } else {
    state.comboCount = 1;
  }
  state.lastHitBrick = brick.id;
  state.comboUntil = now + 520;

  if (state.comboCount >= 3) {
    addFloatText("good", brick.x + brick.w / 2, brick.y - 6);
    state.comboCount = 0;
  }
}

function hitBrick(ball, brick) {
  const cx = brick.x + brick.w / 2;
  const cy = brick.y + brick.h / 2;
  const overlapX = brick.w / 2 + BALL_R - Math.abs(ball.x - cx);
  const overlapY = brick.h / 2 + BALL_R - Math.abs(ball.y - cy);

  if (overlapX < overlapY) {
    ball.vx *= -1;
    ball.x += ball.x < cx ? -overlapX : overlapX;
    brick.squashAxis = "x";
  } else {
    ball.vy *= -1;
    ball.y += ball.y < cy ? -overlapY : overlapY;
    brick.squashAxis = "y";
  }

  brick.value -= 1;
  brick.hitFlash = 1;
  brick.squash = 1;
  buzz();
  registerCombo(brick);
  state.particles.push({ x: ball.x, y: ball.y, life: 16, color: brickColor(brick.value + 1) });
}

function landBall(ball) {
  ball.active = false;
  const live = (state.volleyLive.get(ball.volleyId) || 1) - 1;
  if (live <= 0) {
    state.volleyLive.delete(ball.volleyId);
    if (state.bricks.length > 0) dropBricks();
  } else {
    state.volleyLive.set(ball.volleyId, live);
  }
}

function dropBricks() {
  const density = Math.min(0.3 + state.level * 0.025, 0.62);
  state.bricks.forEach((brick) => {
    brick.y += ROW_H;
  });
  state.bricks.push(...spawnRow(0, density, state.level));
  if (state.bricks.some((brick) => brick.y + brick.h >= RED_LINE)) failLevel();
}

function updateCountdown() {
  if (state.mode !== "countdown") return;
  if (performance.now() >= state.countdownUntil) state.mode = "playing";
}

function update() {
  updateCountdown();

  if (state.mode === "playing") {
    for (const ball of state.balls) {
      ball.x += ball.vx;
      ball.y += ball.vy;

      if (ball.x < BALL_R || ball.x > W - BALL_R) {
        ball.vx *= -1;
        ball.x = Math.max(BALL_R, Math.min(W - BALL_R, ball.x));
      }
      if (ball.y < BALL_R) {
        ball.vy *= -1;
        ball.y = BALL_R;
      }

      for (const brick of state.bricks) {
        if (brick.value > 0 && rectCircleHit(ball, brick)) hitBrick(ball, brick);
      }

      if (ball.y > H + 20) landBall(ball);
    }

    state.balls = state.balls.filter((ball) => ball.active);
    state.bricks = state.bricks.filter((brick) => brick.value > 0);

    if (state.bricks.length === 0) winLevel();
  }

  state.bricks.forEach((brick) => {
    brick.hitFlash *= 0.82;
    brick.squash *= -0.38;
    if (Math.abs(brick.squash) < 0.03) brick.squash = 0;
  });

  state.particles.forEach((p) => {
    p.life -= 1;
    p.y -= 0.8;
  });
  state.particles = state.particles.filter((p) => p.life > 0);

  state.floatTexts.forEach((t) => {
    t.life -= 1;
    t.y += t.vy;
  });
  state.floatTexts = state.floatTexts.filter((t) => t.life > 0);
}

function drawBackground() {
  ctx.fillStyle = "#191b21";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let y = TOP; y < RED_LINE; y += ROW_H) ctx.fillRect(0, y, W, 1);

  ctx.strokeStyle = "#ff4d5d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(14, RED_LINE);
  ctx.lineTo(W - 14, RED_LINE);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 77, 93, 0.1)";
  ctx.fillRect(0, RED_LINE, W, H - RED_LINE);
}

function drawAim() {
  ctx.fillStyle = "#f6f2e8";
  ctx.beginPath();
  ctx.arc(W / 2, SHOOT_Y, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#15161a";
  ctx.font = "800 12px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.ballsPerVolley, W / 2, SHOOT_Y);

  if (state.mode !== "playing") return;
  if (!state.aim.active) return;
  ctx.strokeStyle = "rgba(255, 214, 90, 0.9)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(W / 2, SHOOT_Y);
  ctx.lineTo(state.aim.x, state.aim.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBricks() {
  for (const brick of state.bricks) {
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    const power = brick.squash * 0.08;
    const sx = brick.squashAxis === "x" ? 1 - power : 1 + power;
    const sy = brick.squashAxis === "y" ? 1 - power : 1 + power;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = brickColor(brick.value);
    roundedRect(brick.x, brick.y, brick.w, brick.h, 8);
    ctx.fill();
    if (brick.hitFlash > 0.05) {
      ctx.fillStyle = `rgba(255,255,255,${brick.hitFlash * 0.32})`;
      roundedRect(brick.x, brick.y, brick.w, brick.h, 8);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = "#101114";
    ctx.font = "900 22px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brick.value, cx, cy + 1);
  }
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawBalls() {
  ctx.fillStyle = "#eaf6ff";
  for (const ball of state.balls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = p.life / 16;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloatTexts() {
  for (const t of state.floatTexts) {
    ctx.globalAlpha = Math.min(1, t.life / 16);
    ctx.fillStyle = t.color;
    ctx.font = "900 24px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawCountdown() {
  if (state.mode !== "countdown") return;
  const left = Math.max(0, state.countdownUntil - performance.now());
  const number = Math.max(1, Math.ceil(left / 1000));
  const phase = (left % 1000) / 1000;
  const y = H / 2 + (0.5 - phase) * 46;
  const alpha = Math.min(1, 0.28 + phase);

  ctx.fillStyle = "rgba(12, 13, 16, 0.36)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffd65a";
  ctx.font = "900 96px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(number, W / 2, y);
  ctx.globalAlpha = 1;
}

function render() {
  drawBackground();
  drawBricks();
  drawBalls();
  drawParticles();
  drawFloatTexts();
  drawAim();
  drawCountdown();
  requestAnimationFrame(loop);
}

function loop() {
  update();
  render();
}

canvas.addEventListener("pointerdown", beginAim);
canvas.addEventListener("pointermove", moveAim);
canvas.addEventListener("pointerup", endAim);
canvas.addEventListener("pointercancel", () => {
  state.aim.active = false;
});

primaryBtn.onclick = startRun;
updateHud();
spawnLevel();
loop();
