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
const TOP = 112;
const RED_LINE = H - 76;
const SHOOT_Y = 56;
const BALL_R = 5;
const MAX_SPEED = 8.6;

const state = {
  mode: "menu",
  level: 1,
  streak: 0,
  plays: 3,
  ballsPerShot: 18,
  ballsRemaining: 0,
  ballsHome: 0,
  bricks: [],
  balls: [],
  particles: [],
  aim: { active: false, x: W / 2, y: TOP + 150 },
  launchedThisTurn: false,
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
  if (value > 18) return "#ef476f";
  if (value > 10) return "#ff9f1c";
  if (value > 5) return "#35d0ba";
  return "#7ad66d";
}

function spawnLevel() {
  state.bricks = [];
  const rows = Math.min(3 + Math.floor(state.level / 2), 7);
  const density = Math.min(0.38 + state.level * 0.035, 0.72);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (Math.random() < density || (r === 0 && c === Math.floor(COLS / 2))) {
        const base = 2 + state.level + r * 2;
        state.bricks.push({
          x: GAP + c * (CELL + GAP),
          y: TOP + r * ROW_H,
          w: CELL,
          h: ROW_H - GAP,
          value: Math.ceil(rand(base, base + 6 + state.level * 1.6)),
          hitFlash: 0,
        });
      }
    }
  }
  state.balls = [];
  state.ballsPerShot = Math.min(18 + Math.floor(state.level / 2) * 2, 42);
  state.ballsRemaining = state.ballsPerShot;
  state.ballsHome = state.ballsPerShot;
  state.launchedThisTurn = false;
}

function startRun() {
  if (state.plays <= 0) {
    showOverlay("局数不足", "看广告续局", "每次挑战消耗 1 局。看完激励广告即可继续爬塔。", "看广告 +1 局", grantPlay);
    return;
  }
  state.plays -= 1;
  state.mode = "playing";
  spawnLevel();
  updateHud();
  hideOverlay();
}

function resetRun() {
  state.level = 1;
  state.streak = 0;
  startRun();
}

function grantPlay() {
  state.plays += 1;
  updateHud();
  showOverlay("奖励到账", "获得 1 局", "这就是纯 IAA 的付费点：看广告换一次挑战机会。", "开始挑战", startRun);
}

function revive() {
  state.bricks.forEach((brick) => {
    brick.y = Math.max(TOP, brick.y - ROW_H * 2);
  });
  state.mode = "playing";
  state.balls = [];
  state.ballsRemaining = state.ballsPerShot;
  state.ballsHome = state.ballsPerShot;
  state.launchedThisTurn = false;
  hideOverlay();
}

function winLevel() {
  state.level += 1;
  state.streak += 1;
  updateHud();
  showOverlay("通关", `第 ${state.level - 1} 关已清空`, "连胜继续累积，下一层方块会更硬、弹珠更多。", "继续爬塔", () => {
    state.mode = "playing";
    spawnLevel();
    hideOverlay();
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
  const p = event.touches ? event.touches[0] : event;
  return {
    x: ((p.clientX - rect.left) / rect.width) * W,
    y: ((p.clientY - rect.top) / rect.height) * H,
  };
}

function beginAim(event) {
  if (state.mode !== "playing" || state.launchedThisTurn) return;
  const pos = pointerPos(event);
  if (pos.y > TOP + 38) return;
  state.aim.active = true;
  state.aim.x = pos.x;
  state.aim.y = Math.max(TOP + 80, pos.y + 160);
}

function moveAim(event) {
  if (!state.aim.active) return;
  const pos = pointerPos(event);
  state.aim.x = Math.max(24, Math.min(W - 24, pos.x));
  state.aim.y = Math.max(TOP + 70, Math.min(RED_LINE - 60, pos.y));
  event.preventDefault();
}

function endAim() {
  if (!state.aim.active) return;
  state.aim.active = false;
  fireVolley();
}

function fireVolley() {
  const dx = state.aim.x - W / 2;
  const dy = state.aim.y - SHOOT_Y;
  const len = Math.hypot(dx, dy) || 1;
  const vx = (dx / len) * MAX_SPEED;
  const vy = Math.max(3.2, (dy / len) * MAX_SPEED);
  state.launchedThisTurn = true;
  state.ballsHome = 0;

  for (let i = 0; i < state.ballsPerShot; i += 1) {
    setTimeout(() => {
      if (state.mode !== "playing") return;
      state.balls.push({
        x: W / 2,
        y: SHOOT_Y,
        vx: vx + rand(-0.18, 0.18),
        vy: vy + rand(-0.12, 0.12),
        active: true,
      });
    }, i * 34);
  }
}

function rectCircleHit(ball, brick) {
  const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
  const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  return dx * dx + dy * dy < BALL_R * BALL_R;
}

function hitBrick(ball, brick) {
  const cx = brick.x + brick.w / 2;
  const cy = brick.y + brick.h / 2;
  const overlapX = brick.w / 2 + BALL_R - Math.abs(ball.x - cx);
  const overlapY = brick.h / 2 + BALL_R - Math.abs(ball.y - cy);
  if (overlapX < overlapY) {
    ball.vx *= -1;
    ball.x += ball.x < cx ? -overlapX : overlapX;
  } else {
    ball.vy *= -1;
    ball.y += ball.y < cy ? -overlapY : overlapY;
  }
  brick.value -= 1;
  brick.hitFlash = 1;
  state.particles.push({ x: ball.x, y: ball.y, life: 16, color: brickColor(brick.value + 1) });
}

function dropBricks() {
  state.bricks.forEach((brick) => {
    brick.y += ROW_H;
  });
  state.launchedThisTurn = false;
  state.ballsRemaining = state.ballsPerShot;
  state.ballsHome = state.ballsPerShot;
  if (state.bricks.some((brick) => brick.y + brick.h >= RED_LINE)) {
    failLevel();
  }
}

function update() {
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

      if (ball.y > H + 18) {
        ball.active = false;
        state.ballsHome += 1;
      }
    }

    state.balls = state.balls.filter((ball) => ball.active);
    state.bricks = state.bricks.filter((brick) => brick.value > 0);
    state.bricks.forEach((brick) => {
      brick.hitFlash *= 0.84;
    });

    if (state.bricks.length === 0 && state.launchedThisTurn) winLevel();
    if (state.launchedThisTurn && state.ballsHome >= state.ballsPerShot && state.bricks.length > 0) dropBricks();
  }

  state.particles.forEach((p) => {
    p.life -= 1;
    p.y -= 0.8;
  });
  state.particles = state.particles.filter((p) => p.life > 0);
}

function drawBackground() {
  ctx.fillStyle = "#191b21";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let y = TOP; y < RED_LINE; y += ROW_H) {
    ctx.fillRect(0, y, W, 1);
  }
  ctx.strokeStyle = "#ff4d5d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(14, RED_LINE);
  ctx.lineTo(W - 14, RED_LINE);
  ctx.stroke();
}

function drawAim() {
  ctx.fillStyle = "#f6f2e8";
  ctx.beginPath();
  ctx.arc(W / 2, SHOOT_Y, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#15161a";
  ctx.font = "800 12px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.ballsPerShot, W / 2, SHOOT_Y);

  if (!state.aim.active || state.launchedThisTurn || state.mode !== "playing") return;
  ctx.strokeStyle = "rgba(255, 214, 90, 0.86)";
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
    ctx.fillStyle = brickColor(brick.value);
    ctx.globalAlpha = 1;
    roundedRect(brick.x, brick.y, brick.w, brick.h, 8);
    ctx.fill();
    if (brick.hitFlash > 0.05) {
      ctx.fillStyle = `rgba(255,255,255,${brick.hitFlash * 0.35})`;
      roundedRect(brick.x, brick.y, brick.w, brick.h, 8);
      ctx.fill();
    }
    ctx.fillStyle = "#101114";
    ctx.font = "900 22px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brick.value, brick.x + brick.w / 2, brick.y + brick.h / 2 + 1);
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

function render() {
  drawBackground();
  drawBricks();
  drawBalls();
  drawParticles();
  drawAim();
  requestAnimationFrame(loop);
}

function loop() {
  update();
  render();
}

canvas.addEventListener("pointerdown", beginAim);
canvas.addEventListener("pointermove", moveAim);
canvas.addEventListener("pointerup", endAim);
canvas.addEventListener("pointercancel", endAim);

primaryBtn.onclick = startRun;
updateHud();
spawnLevel();
loop();
