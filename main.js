import * as THREE from 'three';

// ——— Game constants ———
const WORLD_WIDTH = 20;
const WORLD_HEIGHT = 14;
const PLAYER_SPEED = 12;
const BULLET_SPEED = 18;
const ENEMY_SPEED = 4;
const ENEMY_SPAWN_INTERVAL = 1.2;
const PLAYER_HALF = 0.5;
const BULLET_RADIUS = 0.2;
const ENEMY_RADIUS = 0.6;

// ——— State ———
let scene, camera, renderer;
let playerMesh, playerBox;
let bullets = [];
let enemies = [];
let stars = [];
let keys = {};
let score = 0;
let lives = 3;
let lastEnemyTime = 0;
let gameRunning = false;
let gameOver = false;

// ——— DOM ———
const container = document.getElementById('canvas-container');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const startOverlay = document.getElementById('start-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const finalScoreEl = document.getElementById('final-score');
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');

function init() {
  scene = new THREE.Scene();

  const aspect = window.innerWidth / window.innerHeight;
  const frustum = Math.max(WORLD_HEIGHT / 2, (WORLD_WIDTH / 2) / aspect);
  camera = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect,
    frustum, -frustum,
    0.1, 100
  );
  camera.position.z = 10;
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  createStarfield();
  createPlayer();
  setupInput();
  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);
  window.addEventListener('resize', onResize);
}

function createStarfield() {
  const starCount = 200;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * WORLD_WIDTH * 1.5;
    positions[i * 3 + 1] = (Math.random() - 0.5) * WORLD_HEIGHT * 1.5;
    positions[i * 3 + 2] = -1;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.08,
    transparent: true,
    opacity: 0.8,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  stars.push(points);
}

function createPlayer() {
  const shape = new THREE.Shape();
  shape.moveTo(0, PLAYER_HALF);
  shape.lineTo(-PLAYER_HALF * 0.8, -PLAYER_HALF);
  shape.lineTo(0, PLAYER_HALF * 0.4);
  shape.lineTo(PLAYER_HALF * 0.8, -PLAYER_HALF);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00d4ff,
    side: THREE.DoubleSide,
  });
  playerMesh = new THREE.Mesh(geometry, material);
  playerMesh.position.set(0, -WORLD_HEIGHT / 2 + 2, 0);
  scene.add(playerMesh);
  playerBox = { half: PLAYER_HALF, mesh: playerMesh };
}

function createBullet(x, y) {
  const geometry = new THREE.CircleGeometry(BULLET_RADIUS, 12);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  bullets.push({ mesh, vy: BULLET_SPEED, radius: BULLET_RADIUS });
}

function createEnemy(x, y) {
  const shape = new THREE.Shape();
  const h = 0.5;
  shape.moveTo(0, -h);
  shape.lineTo(-h * 0.7, h * 0.5);
  shape.lineTo(0, h * 0.2);
  shape.lineTo(h * 0.7, h * 0.5);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff4466,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  enemies.push({ mesh, vy: -ENEMY_SPEED, radius: ENEMY_RADIUS });
}

function setupInput() {
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (gameRunning && e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
}

function startGame() {
  gameOver = false;
  gameRunning = true;
  score = 0;
  lives = 3;
  lastEnemyTime = performance.now() / 1000;

  bullets.forEach((b) => { scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); });
  bullets = [];
  enemies.forEach((e) => { scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); });
  enemies = [];

  playerMesh.position.set(0, -WORLD_HEIGHT / 2 + 2, 0);
  playerMesh.visible = true;

  startOverlay.classList.remove('visible');
  gameoverOverlay.classList.remove('visible');
  updateUI();
  requestAnimationFrame(gameLoop);
}

function updateUI() {
  scoreEl.textContent = `SCORE: ${score}`;
  livesEl.textContent = `LIVES: ${lives}`;
  finalScoreEl.textContent = score;
}

function gameOverScreen() {
  gameRunning = false;
  gameOver = true;
  gameoverOverlay.classList.add('visible');
  finalScoreEl.textContent = score;
}

function gameLoop(time) {
  if (!gameRunning) return;

  const dt = 0.016;
  const halfW = WORLD_WIDTH / 2;
  const halfH = WORLD_HEIGHT / 2;

  // Player movement
  let dx = 0, dy = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
  if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
  if (keys['ArrowUp'] || keys['KeyW']) dy += 1;
  if (keys['ArrowDown'] || keys['KeyS']) dy -= 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    playerMesh.position.x += dx * PLAYER_SPEED * dt;
    playerMesh.position.y += dy * PLAYER_SPEED * dt;
    playerMesh.position.x = Math.max(-halfW + 1, Math.min(halfW - 1, playerMesh.position.x));
    playerMesh.position.y = Math.max(-halfH + 1, Math.min(halfH - 1, playerMesh.position.y));
  }

  // Shoot
  if (keys['Space']) {
    const now = time / 1000;
    if (!playerMesh.lastShot || now - playerMesh.lastShot > 0.2) {
      createBullet(playerMesh.position.x, playerMesh.position.y);
      playerMesh.lastShot = now;
    }
  }

  // Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.y += b.vy * dt;
    if (b.mesh.position.y > halfH + 1) {
      scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
      bullets.splice(i, 1);
    }
  }

  // Spawn enemies
  const now = time / 1000;
  if (now - lastEnemyTime > ENEMY_SPAWN_INTERVAL) {
    lastEnemyTime = now;
    createEnemy((Math.random() - 0.5) * WORLD_WIDTH * 0.8, halfH + 1);
  }

  // Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.mesh.position.y += e.vy * dt;
    if (e.mesh.position.y < -halfH - 1) {
      scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      enemies.splice(i, 1);
      continue;
    }
    // Player collision
    const px = playerMesh.position.x, py = playerMesh.position.y;
    const ex = e.mesh.position.x, ey = e.mesh.position.y;
    if (Math.hypot(px - ex, py - ey) < PLAYER_HALF + e.radius) {
      lives--;
      updateUI();
      scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      enemies.splice(i, 1);
      if (lives <= 0) {
        gameOverScreen();
        return;
      }
    }
  }

  // Bullet vs enemy
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      const dist = Math.hypot(
        b.mesh.position.x - e.mesh.position.x,
        b.mesh.position.y - e.mesh.position.y
      );
      if (dist < b.radius + e.radius) {
        score += 100;
        updateUI();
        scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        bullets.splice(bi, 1);
        scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        enemies.splice(ei, 1);
        break;
      }
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}

function onResize() {
  const aspect = window.innerWidth / window.innerHeight;
  const frustum = Math.max(WORLD_HEIGHT / 2, (WORLD_WIDTH / 2) / aspect);
  camera.left = -frustum * aspect;
  camera.right = frustum * aspect;
  camera.top = frustum;
  camera.bottom = -frustum;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
