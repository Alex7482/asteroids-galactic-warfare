
"use strict";

// ASTEROIDS: GALACTIC WARFARE
// Controls: WASD / arrows, Space to shoot, P to pause.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.getElementById("score"),
  round: document.getElementById("round"),
  lives: document.getElementById("lives"),
  gold: document.getElementById("gold"),
  weapon: document.getElementById("weapon"),
  helpers: document.getElementById("helpers"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  start: document.getElementById("startButton"),
  message: document.getElementById("message"),
  shop: document.getElementById("shopButton"),
  pause: document.getElementById("pauseButton"),
  bossHud: document.getElementById("bossHud"),
  bossName: document.getElementById("bossName"),
  bossHealth: document.getElementById("bossHealth"),
  bossHealthText: document.getElementById("bossHealthText")
};

const TAU = Math.PI * 2;
const rand = (a, b) => Math.random() * (b - a) + a;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

let W = 900;
let H = 600;
let lastTime = 0;
let keys = {};
let state = "menu";
let score = 0;
let gold = 0;
let lives = 20;
let round = 1;
let nextShopScore = 5000;
let weapon = "BLASTER";
let weaponUntil = 0;
let rapidUntil = 0;
let shieldUntil = 0;
let damageBoostUntil = 0;
let extraLivesBought = 0;
let boss = null;
let bossSpawnedThisRound = false;
let nextBossRound = 5;
let lastShot = 0;
let shopVisits = 0;
let upgradeMenuOpen = false;

let asteroids = [];
let bullets = [];
let enemyBullets = [];
let orbs = [];
let particles = [];
let helpers = [];
let stars = [];
let planets = [];

const ship = {
  x: 0, y: 0, vx: 0, vy: 0,
  angle: -Math.PI / 2,
  radius: 14,
  invulnerableUntil: 0
};

const shopItems = [
  { id: "rapid", name: "Rapid Fire", desc: "Shoot much faster for 30 seconds.", price: 12 },
  { id: "damage", name: "Heavy Blaster", desc: "Deal double damage for 30 seconds.", price: 15 },
  { id: "shield", name: "Energy Shield", desc: "Protects you for 20 seconds.", price: 18 },
  { id: "life", name: "Extra Life", desc: "Gain one additional life.", price: 25 },
  { id: "helper", name: "Helper Ship", desc: "A companion ship that shoots asteroids.", price: 35 },
  { id: "helper2", name: "Extra Helper", desc: "Add another companion ship.", price: 55 },
  { id: "spread", name: "Spread Weapon", desc: "Fire three shots at once for 30 seconds.", price: 22 }
];

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(320, rect.width);
  H = Math.max(360, rect.height);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ship.x === 0 && ship.y === 0) {
    ship.x = W / 2;
    ship.y = H / 2;
  }
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function makeBackground() {
  stars = Array.from({ length: 150 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: rand(0.5, 2),
    a: rand(0.2, 0.9),
    phase: rand(0, TAU)
  }));
  planets = [
    { x: W * 0.18, y: H * 0.25, r: Math.min(W, H) * 0.12, color: "#263c8c" },
    { x: W * 0.82, y: H * 0.72, r: Math.min(W, H) * 0.19, color: "#713b75" }
  ];
}
makeBackground();

function createAsteroid(x, y, radius, level = 0, goldRock = false) {
  const angle = rand(0, TAU);
  const speed = rand(35, 75) * (1 + round * 0.018);
  const sides = Math.floor(rand(8, 13));
  const shape = Array.from({ length: sides }, () => rand(0.72, 1.25));
  const hp = Math.max(2, Math.ceil(radius / 12) + Math.floor(round / 12));

  asteroids.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    hp,
    maxHp: hp,
    level,
    goldRock,
    shape,
    rotation: rand(0, TAU),
    spin: rand(-1.1, 1.1),
    explosive: !goldRock && Math.random() < 0.13,
    dead: false
  });
}

function spawnWave() {
  asteroids = [];
  bullets = [];
  enemyBullets = [];
  boss = null;
  bossSpawnedThisRound = false;
  ui.bossHud.hidden = true;

  const count = Math.min(5 + round + Math.floor(round / 3), 65);
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - ship.x, y - ship.y) < 140);

    const radius = rand(20, 40);
    createAsteroid(x, y, radius);
  }

  // Golden asteroids become more likely in later rounds.
  if (Math.random() < Math.min(0.25 + round * 0.004, 0.75)) {
    createAsteroid(rand(40, W - 40), rand(40, H - 40), rand(22, 32), 0, true);
  }

  if (round >= nextBossRound) {
    spawnBoss();
    nextBossRound += 5;
  }
  updateHUD();
}

function spawnBoss() {
  const hp = 80 + round * 18;
  boss = {
    x: W / 2,
    y: 90,
    vx: rand(-90, 90),
    vy: 25,
    radius: Math.min(65, 42 + round * 0.5),
    hp,
    maxHp: hp,
    shotTimer: 1,
    phase: 0,
    dead: false
  };
  bossSpawnedThisRound = true;
  ui.bossHud.hidden = false;
  ui.bossName.textContent = "DREADNOUGHT — ROUND " + round;
  ui.message.textContent = "BOSS INCOMING! Dodge its attacks!";
}

function resetGame() {
  score = 0;
  gold = 0;
  lives = 20;
  round = 1;
  nextShopScore = 5000;
  weapon = "BLASTER";
  weaponUntil = 0;
  rapidUntil = 0;
  shieldUntil = 0;
  damageBoostUntil = 0;
  extraLivesBought = 0;
  shopVisits = 0;
  helpers = [];
  orbs = [];
  particles = [];
  bullets = [];
  enemyBullets = [];
  asteroids = [];
  boss = null;
  ship.x = W / 2;
  ship.y = H / 2;
  ship.vx = 0;
  ship.vy = 0;
  ship.angle = -Math.PI / 2;
  ship.invulnerableUntil = performance.now() + 2500;
  nextBossRound = 5;
  spawnWave();
  state = "playing";
  ui.overlay.hidden = true;
  ui.start.textContent = "START MISSION";
  ui.shop.disabled = false;
  ui.message.textContent = "Destroy asteroids. Collect gold. Survive.";
  updateHUD();
}

function updateHUD() {
  ui.score.textContent = Math.floor(score).toLocaleString();
  ui.round.textContent = round + " / 500";
  ui.lives.textContent = lives;
  ui.gold.textContent = gold;
  ui.weapon.textContent = weapon;
  ui.helpers.textContent = helpers.length;
  ui.shop.textContent = "SHOP — " + gold + " GOLD";
  ui.pause.textContent = state === "paused" ? "RESUME" : "PAUSE";
}

function showOverlay(title, text, button = "CONTINUE") {
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = text;
  ui.start.textContent = button;
  ui.overlay.hidden = false;
}

function pauseGame() {
  if (state === "playing") {
    state = "paused";
    showOverlay("MISSION PAUSED", "Take a breather. Resume when you're ready.", "RESUME");
  } else if (state === "paused") {
    state = "playing";
    ui.overlay.hidden = true;
  }
  updateHUD();
}

function addParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, TAU);
    const speed = rand(35, 180);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.25, 0.8),
      maxLife: 0.8,
      color,
      size: rand(1.5, 4)
    });
  }
}

function fireBullet(x, y, angle, helperShot = false) {
  const speed = helperShot ? 430 : 500;
  bullets.push({
    x: x + Math.cos(angle) * 17,
    y: y + Math.sin(angle) * 17,
    vx: Math.cos(angle) * speed + ship.vx * 0.25,
    vy: Math.sin(angle) * speed + ship.vy * 0.25,
    life: 1.25,
    damage: performance.now() < damageBoostUntil ? 2 : 1,
    helperShot
  });
}

function shoot(now) {
  const rate = now < rapidUntil ? 90 : 230;
  if (now - lastShot < rate) return;
  lastShot = now;

  if (weapon === "SPREAD" && now < weaponUntil) {
    fireBullet(ship.x, ship.y, ship.angle - 0.25);
    fireBullet(ship.x, ship.y, ship.angle);
    fireBullet(ship.x, ship.y, ship.angle + 0.25);
  } else {
    fireBullet(ship.x, ship.y, ship.angle);
  }
}

function buyItem(id) {
  const item = shopItems.find(i => i.id === id);
  if (!item) return;
  if (gold < item.price) {
    ui.message.textContent = "Not enough gold for " + item.name + ".";
    return;
  }
  if ((id === "helper" && helpers.length >= 1) ||
      (id === "helper2" && helpers.length >= 2)) {
    ui.message.textContent = "You already own enough helper ships for that upgrade.";
    return;
  }
  gold -= item.price;
  const now = performance.now();

  switch (id) {
    case "rapid": rapidUntil = now + 30000; break;
    case "damage": damageBoostUntil = now + 30000; break;
    case "shield": shieldUntil = now + 20000; break;
    case "life": lives++; break;
    case "helper":
    case "helper2":
      helpers.push({ angle: rand(0, TAU), cooldown: 0, radius: 10 });
      break;
    case "spread":
      weapon = "SPREAD";
      weaponUntil = now + 30000;
      break;
  }
  ui.message.textContent = "Purchased: " + item.name + "!";
  addParticles(ship.x, ship.y, "#ffe16a", 12);
  renderShop();
  updateHUD();
}

function renderShop() {
  state = "shop";
  ui.overlay.hidden = false;
  ui.overlayTitle.textContent = "GALACTIC SUPPLY SHOP";
  ui.overlayText.textContent = "Spend gold on upgrades. The action is paused while shopping.";
  ui.start.textContent = "RETURN TO BATTLE";

  let old = document.getElementById("shopItems");
  if (old) old.remove();

  const list = document.createElement("div");
  list.id = "shopItems";
  list.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:18px 0;max-height:42vh;overflow:auto;";

  for (const item of shopItems) {
    const card = document.createElement("div");
    card.style.cssText = "border:1px solid #315174;border-radius:8px;padding:12px;background:#0c1930;text-align:left;";
    const title = document.createElement("strong");
    title.textContent = item.name + " — " + item.price + " gold";
    const desc = document.createElement("p");
    desc.textContent = item.desc;
    desc.style.cssText = "font-size:12px;color:#afc0db;min-height:30px;";
    const button = document.createElement("button");
    button.textContent = "BUY";
    button.style.cssText = "width:100%;padding:9px;";
    button.onclick = () => buyItem(item.id);
    card.append(title, desc, button);
    list.appendChild(card);
  }

  ui.overlay.querySelector(".overlay-card").appendChild(list);
  ui.message.textContent = "Shop open. Your mission is paused.";
  updateHUD();
}

function closeShop() {
  const list = document.getElementById("shopItems");
  if (list) list.remove();
  state = "playing";
  ui.overlay.hidden = true;
  updateHUD();
}

function maybeShop() {
  if (score >= nextShopScore) {
    nextShopScore += 5000;
    shopVisits++;
    renderShop();
  }
}

function loseLife() {
  const now = performance.now();
  if (now < ship.invulnerableUntil || now < shieldUntil) return;
  lives--;
  ship.invulnerableUntil = now + 2000;
  addParticles(ship.x, ship.y, "#ff6688", 24);
  ship.vx = -Math.cos(ship.angle) * 110;
  ship.vy = -Math.sin(ship.angle) * 110;
  if (lives <= 0) {
    lives = 0;
    state = "gameover";
    showOverlay("SHIP DESTROYED", "You scored " + score.toLocaleString() + " points and reached round " + round + ".", "PLAY AGAIN");
  }
  updateHUD();
}

function update(dt, now) {
  if (state !== "playing") return;

  // Ship controls use acceleration and inertia.
  if (keys.ArrowLeft || keys.KeyA) ship.angle -= 3.8 * dt;
  if (keys.ArrowRight || keys.KeyD) ship.angle += 3.8 * dt;

  if (keys.ArrowUp || keys.KeyW) {
    ship.vx += Math.cos(ship.angle) * 260 * dt;
    ship.vy += Math.sin(ship.angle) * 260 * dt;
  }
  if (keys.ArrowDown || keys.KeyS) {
    ship.vx -= Math.cos(ship.angle) * 120 * dt;
    ship.vy -= Math.sin(ship.angle) * 120 * dt;
  }

  ship.vx *= Math.pow(0.985, dt * 60);
  ship.vy *= Math.pow(0.985, dt * 60);
  ship.vx = clamp(ship.vx, -340, 340);
  ship.vy = clamp(ship.vy, -340, 340);
  ship.x = (ship.x + ship.vx * dt + W) % W;
  ship.y = (ship.y + ship.vy * dt + H) % H;

  if (keys.Space) shoot(now);
  if (weapon !== "BLASTER" && now > weaponUntil) weapon = "BLASTER";

  for (const a of asteroids) {
    a.x = (a.x + a.vx * dt + W) % W;
    a.y = (a.y + a.vy * dt + H) % H;
    a.rotation += a.spin * dt;
  }

  // Asteroid collision: bounce apart instead of passing through each other.
  for (let i = 0; i < asteroids.length; i++) {
    const a = asteroids[i];
    if (a.dead) continue;
    for (let j = i + 1; j < asteroids.length; j++) {
      const b = asteroids[j];
      if (b.dead) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      const minD = a.radius + b.radius;
      if (d > 0 && d < minD) {
        const nx = dx / d, ny = dy / d;
        const push = (minD - d) * 0.5;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const av = a.vx * nx + a.vy * ny;
        const bv = b.vx * nx + b.vy * ny;
        a.vx += (bv - av) * nx;
        a.vy += (bv - av) * ny;
        b.vx += (av - bv) * nx;
        b.vy += (av - bv) * ny;
      }
    }
  }

  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) b.life = 0;
  }

  for (const eb of enemyBullets) {
    eb.x += eb.vx * dt;
    eb.y += eb.vy * dt;
    eb.life -= dt;
    if (distance(eb, ship) < ship.radius + 5) {
      eb.life = 0;
      loseLife();
    }
  }

  // Bullet damage against asteroids.
  for (const b of bullets) {
    if (b.life <= 0) continue;
    for (const a of asteroids) {
      if (a.dead) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius) {
        b.life = 0;
        a.hp -= b.damage;
        addParticles(b.x, b.y, a.goldRock ? "#ffe16a" : "#9eafc5", 3);
        if (a.hp <= 0) {
          a.dead = true;
          score += a.goldRock ? 350 : Math.round(80 + a.radius);
          if (a.goldRock) {
            const reward = Math.floor(rand(8, 19)) + Math.floor(round / 10);
            gold += reward;
            ui.message.textContent = "Golden asteroid destroyed! +" + reward + " gold!";
            addParticles(a.x, a.y, "#ffd54a", 35);
          } else {
            addParticles(a.x, a.y, a.explosive ? "#ff713d" : "#a6c3d8", 18);
            if (a.explosive) {
              for (const other of asteroids) {
                if (!other.dead && other !== a && distance(a, other) < a.radius + 45) {
                  other.hp -= 3;
                  if (other.hp <= 0) other.dead = true;
                }
              }
              addParticles(a.x, a.y, "#ff4b2e", 32);
            }
            if (a.radius > 24 && a.level < 2) {
              for (let k = 0; k < 2; k++) {
                createAsteroid(a.x, a.y, a.radius * 0.55, a.level + 1);
              }
            }
          }
          maybeShop();
        }
        break;
      }
    }

    if (boss && b.life > 0 && Math.hypot(boss.x - b.x, boss.y - b.y) < boss.radius) {
      b.life = 0;
      boss.hp -= b.damage * 2;
      if (boss.hp <= 0) {
        score += 2000 + round * 100;
        gold += 25 + round;
        addParticles(boss.x, boss.y, "#ff48bd", 65);
        ui.message.textContent = "BOSS DEFEATED! Bonus score and gold awarded!";
        boss = null;
        ui.bossHud.hidden = true;
        maybeShop();
      }
    }
  }

  bullets = bullets.filter(b => b.life > 0);
  enemyBullets = enemyBullets.filter(b => b.life > 0);
  asteroids = asteroids.filter(a => !a.dead);

  // Helper ships orbit the player and fire automatically.
  helpers.forEach((h, i) => {
    h.angle += dt * (0.8 + i * 0.12);
    h.x = ship.x + Math.cos(h.angle) * (45 + i * 14);
    h.y = ship.y + Math.sin(h.angle) * (45 + i * 14);
    h.cooldown -= dt;
    if (h.cooldown <= 0) {
      let target = null, best = Infinity;
      for (const a of asteroids) {
        const d = distance(h, a);
        if (d < best) { best = d; target = a; }
      }
      if (boss && distance(h, boss) < best) target = boss;
      if (target) {
        const angle = Math.atan2(target.y - h.y, target.x - h.x);
        bullets.push({
          x: h.x, y: h.y,
          vx: Math.cos(angle) * 420, vy: Math.sin(angle) * 420,
          life: 1.1, damage: 1, helperShot: true
        });
        h.cooldown = 0.6;
      }
    }
  });

  // Boss movement and attacks.
  if (boss) {
    boss.phase += dt;
    boss.x += boss.vx * dt;
    boss.y = 90 + Math.sin(boss.phase * 1.3) * 35;
    if (boss.x < boss.radius || boss.x > W - boss.radius) boss.vx *= -1;
    boss.shotTimer -= dt;
    if (boss.shotTimer <= 0) {
      const angle = Math.atan2(ship.y - boss.y, ship.x - boss.x);
      const spread = Math.min(0.45, 0.12 + round * 0.006);
      for (const offset of [-spread, 0, spread]) {
        enemyBullets.push({
          x: boss.x, y: boss.y + boss.radius * 0.5,
          vx: Math.cos(angle + offset) * (160 + round * 2),
          vy: Math.sin(angle + offset) * (160 + round * 2),
          life: 3
        });
      }
      boss.shotTimer = Math.max(0.55, 1.6 - round * 0.02);
    }
    if (distance(ship, boss) < ship.radius + boss.radius * 0.7) loseLife();
    const percent = clamp(boss.hp / boss.maxHp * 100, 0, 100);
    ui.bossHealth.style.width = percent + "%";
    ui.bossHealthText.textContent = Math.ceil(percent) + "%";
  }

  // Collect floating weapon orbs.
  for (const orb of orbs) {
    orb.life -= dt;
    orb.phase += dt * 2;
    if (distance(ship, orb) < ship.radius + 12) {
      weapon = orb.type;
      weaponUntil = now + 15000;
      orb.life = 0;
      ui.message.textContent = "Weapon collected: " + weapon + "!";
      addParticles(orb.x, orb.y, "#56eaff", 15);
    }
  }
  orbs = orbs.filter(o => o.life > 0);
  if (Math.random() < 0.0015) {
    orbs.push({
      x: rand(40, W - 40), y: rand(40, H - 40),
      type: Math.random() < 0.5 ? "SPREAD" : "RAPID",
      life: 12, phase: 0
    });
  }

  // Ship-asteroid collisions.
  for (const a of asteroids) {
    if (distance(ship, a) < ship.radius + a.radius * 0.7) {
      if (now >= ship.invulnerableUntil && now >= shieldUntil) {
        loseLife();
        a.vx += (a.x - ship.x) * 1.4;
        a.vy += (a.y - ship.y) * 1.4;
      }
    }
  }

  // Update particles.
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
  }
  particles = particles.filter(p => p.life > 0);

  if (asteroids.length === 0 && !boss) {
    if (round >= 500) {
      state = "victory";
      showOverlay("GALAXY SAVED!", "You survived all 500 rounds! Final score: " + score.toLocaleString(), "PLAY AGAIN");
    } else {
      round++;
      ui.message.textContent = "Round " + round + " incoming!";
      spawnWave();
    }
  }

  maybeShop();
  updateHUD();
}

function drawBackground(now) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#060d25");
  bg.addColorStop(0.5, "#100d27");
  bg.addColorStop(1, "#030610");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Distant planets.
  planets.forEach((p, i) => {
    const x = p.x + Math.sin(now * 0.00003 + i) * 12;
    const y = p.y + Math.cos(now * 0.000025 + i) * 9;
    const g = ctx.createRadialGradient(x - p.r * 0.35, y - p.r * 0.4, 2, x, y, p.r);
    g.addColorStop(0, "#7994d0");
    g.addColorStop(0.45, p.color);
    g.addColorStop(1, "#090b20");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, p.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#8caeff30";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, p.r * 1.45, p.r * 0.32, -0.25, 0, TAU);
    ctx.stroke();
  });

  stars.forEach(s => {
    ctx.globalAlpha = s.a * (0.65 + Math.sin(now * 0.002 + s.phase) * 0.35);
    ctx.fillStyle = "#d9f4ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawShip(now) {
  if (now < ship.invulnerableUntil && Math.floor(now / 100) % 2 === 0) return;
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#4beaff";
  ctx.strokeStyle = "#b9f7ff";
  ctx.fillStyle = "#1b91bb";
  ctx.lineWidth = 2;
  // Three connected triangles make the futuristic ship.
  ctx.beginPath();
  ctx.moveTo(19, 0); ctx.lineTo(-10, -12); ctx.lineTo(-5, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(19, 0); ctx.lineTo(-5, 0); ctx.lineTo(-10, 12); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, -12); ctx.lineTo(-5, 0); ctx.lineTo(-10, 12);
  ctx.strokeStyle = "#48eaff";
  ctx.stroke();

  if (keys.ArrowUp || keys.KeyW) {
    ctx.fillStyle = "#ffb34a";
    ctx.beginPath();
    ctx.moveTo(-7, -4); ctx.lineTo(-24 - Math.random() * 9, 0);
    ctx.lineTo(-7, 4); ctx.fill();
  }
  ctx.restore();

  if (now < shieldUntil) {
    ctx.strokeStyle = "#48eaff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 25, 0, TAU);
    ctx.stroke();
  }
}

function drawAsteroid(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rotation);
  ctx.beginPath();
  a.shape.forEach((v, i) => {
    const angle = i / a.shape.length * TAU;
    const x = Math.cos(angle) * a.radius * v;
    const y = Math.sin(angle) * a.radius * v;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = a.goldRock ? "#8d651b" : "#273449";
  ctx.strokeStyle = a.goldRock ? "#ffe16a" : a.explosive ? "#ff744d" : "#90a8c5";
  ctx.lineWidth = a.goldRock ? 3 : 1.7;
  ctx.shadowBlur = a.goldRock ? 16 : a.explosive ? 12 : 0;
  ctx.shadowColor = a.goldRock ? "#ffcf36" : "#ff5733";
  ctx.fill();
  ctx.stroke();

  if (a.goldRock) {
    ctx.fillStyle = "#fff0a3";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("G", 0, 4);
  } else if (a.hp < a.maxHp) {
    ctx.fillStyle = "#ff697d";
    ctx.fillRect(-a.radius * 0.6, -a.radius - 9, a.radius * 1.2 * a.hp / a.maxHp, 3);
  }
  ctx.restore();
}

function drawBoss() {
  if (!boss) return;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.rotate(Math.sin(boss.phase) * 0.08);
  ctx.shadowBlur = 28;
  ctx.shadowColor = "#ff2b83";
  ctx.fillStyle = "#4a153e";
  ctx.strokeStyle = "#ff62b0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-boss.radius, -boss.radius * 0.3);
  ctx.lineTo(-boss.radius * 0.6, -boss.radius);
  ctx.lineTo(0, -boss.radius * 0.75);
  ctx.lineTo(boss.radius * 0.6, -boss.radius);
  ctx.lineTo(boss.radius, -boss.radius * 0.3);
  ctx.lineTo(boss.radius * 0.8, boss.radius * 0.6);
  ctx.lineTo(0, boss.radius);
  ctx.lineTo(-boss.radius * 0.8, boss.radius * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ff9bcf";
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius * 0.28, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function draw(now) {
  drawBackground(now);
  asteroids.forEach(drawAsteroid);

  bullets.forEach(b => {
    ctx.fillStyle = b.helperShot ? "#ffcf75" : "#6af5ff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.helperShot ? 3 : 3.5, 0, TAU);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  enemyBullets.forEach(b => {
    ctx.fillStyle = "#ff4c9a";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, TAU);
    ctx.fill();
  });

  orbs.forEach(o => {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.phase);
    ctx.strokeStyle = "#69f4ff";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#40eaff";
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.fillStyle = "#e6ffff";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(o.type === "SPREAD" ? "3" : "R", 0, 4);
    ctx.restore();
  });

  helpers.forEach(h => {
    ctx.strokeStyle = "#ffd878";
    ctx.fillStyle = "#976e24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(h.x + 12, h.y);
    ctx.lineTo(h.x - 8, h.y - 8);
    ctx.lineTo(h.x - 4, h.y);
    ctx.lineTo(h.x - 8, h.y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  drawBoss();
  drawShip(now);

  particles.forEach(p => {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  });
  ctx.globalAlpha = 1;
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000 || 0, 0.035);
  lastTime = now;
  update(dt, now);
  draw(now);
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", e => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }
  keys[e.code] = true;
  if (e.code === "KeyP" && !e.repeat) {
    if (state === "playing" || state === "paused") pauseGame();
  }
  if (e.code === "Escape" && state === "shop") closeShop();
});

window.addEventListener("keyup", e => {
  keys[e.code] = false;
});

window.addEventListener("blur", () => {
  keys = {};
  if (state === "playing") pauseGame();
});

ui.start.addEventListener("click", () => {
  if (state === "menu" || state === "gameover" || state === "victory") {
    resetGame();
  } else if (state === "paused") {
    state = "playing";
    ui.overlay.hidden = true;
  } else if (state === "shop") {
    closeShop();
  }
  updateHUD();
});

ui.pause.addEventListener("click", () => {
  if (state === "playing" || state === "paused") pauseGame();
});

ui.shop.addEventListener("click", () => {
  if (state === "playing" || state === "paused") renderShop();
  else if (state === "shop") closeShop();
});

ui.overlay.hidden = false;
ui.shop.disabled = true;
updateHUD();
requestAnimationFrame(loop);
