// Simple 2D-ish space shooter using Three.js and an orthographic camera.

/* global THREE */

const appEl = document.getElementById("app");
const scoreEl = document.getElementById("scoreValue");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScoreEl = document.getElementById("finalScore");
const restartButton = document.getElementById("restartButton");

let renderer;
let scene;
let camera;

const WORLD_WIDTH = 16;
const WORLD_HEIGHT = 10;

let player;
let playerSpeed = 10;
let bullets = [];
let enemies = [];

let lastTime = 0;
let isGameOver = false;
let score = 0;

const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
};

let canShoot = true;
const shootCooldown = 0.18;
let shootTimer = 0;

let enemySpawnTimer = 0;
let enemySpawnInterval = 1.1;

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  appEl.appendChild(renderer.domElement);
  resize();
  window.addEventListener("resize", resize);
}

function initScene() {
  scene = new THREE.Scene();

  camera = new THREE.OrthographicCamera(
    -WORLD_WIDTH / 2,
    WORLD_WIDTH / 2,
    WORLD_HEIGHT / 2,
    -WORLD_HEIGHT / 2,
    0.1,
    100
  );
  camera.position.set(0, 0, 10);

  const ambient = new THREE.AmbientLight(0x9ab0ff, 0.9);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(-4, 6, 5);
  scene.add(dirLight);

  const bgGeometry = new THREE.PlaneGeometry(WORLD_WIDTH * 1.2, WORLD_HEIGHT * 1.4, 32, 32);
  const bgMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      void main() {
        vec2 uv = vUv;
        float t = uTime * 0.06;

        float vignette = smoothstep(0.75, 0.22, distance(uv, vec2(0.5)));
        vec3 top = vec3(0.16, 0.22, 0.55);
        vec3 mid = vec3(0.03, 0.06, 0.19);
        vec3 bottom = vec3(0.0, 0.0, 0.02);

        float g = smoothstep(0.0, 0.6, uv.y);
        float h = smoothstep(0.2, 1.0, uv.y);
        vec3 base = mix(bottom, mid, g);
        base = mix(base, top, h * 0.75);

        vec2 grid = uv * vec2(80.0, 40.0);
        vec2 id = floor(grid);
        vec2 frac = fract(grid);
        float rnd = random(id);

        float star = 0.0;
        if (rnd > 0.985) {
          float size = mix(0.05, 0.12, rnd);
          float dist = length(frac - 0.5);
          star = smoothstep(size, 0.0, dist);
          float twinkle = 0.4 + 0.6 * sin(t * 8.0 + rnd * 20.0);
          star *= twinkle;
        }

        float fog = smoothstep(0.1, 0.9, uv.y);
        vec3 fogColor = vec3(0.0, 0.45, 0.8) * 0.4;

        vec3 color = base;
        color += star * vec3(0.7, 0.9, 1.5);
        color = mix(color, fogColor, fog * 0.3);
        color *= vignette;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depthWrite: false,
  });
  const bg = new THREE.Mesh(bgGeometry, bgMaterial);
  bg.position.z = -5;
  scene.add(bg);

  const starsGeometry = new THREE.BufferGeometry();
  const starCount = 120;
  const positions = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * WORLD_WIDTH * 1.1;
    positions[i * 3 + 1] = (Math.random() - 0.5) * WORLD_HEIGHT * 1.1;
    positions[i * 3 + 2] = -1 - Math.random() * 1.5;
    sizes[i] = 0.02 + Math.random() * 0.05;
  }

  starsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  starsGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const starsMaterial = new THREE.PointsMaterial({
    color: 0x9edbff,
    size: 0.05,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
  });
  const stars = new THREE.Points(starsGeometry, starsMaterial);
  stars.name = "stars";
  scene.add(stars);

  const playerGeometry = new THREE.ConeGeometry(0.28, 0.9, 16);
  const playerMaterial = new THREE.MeshStandardMaterial({
    color: 0x7df9ff,
    metalness: 0.4,
    roughness: 0.15,
    emissive: new THREE.Color(0x33cfff),
    emissiveIntensity: 0.8,
  });
  player = new THREE.Mesh(playerGeometry, playerMaterial);
  player.rotation.z = Math.PI / 2;
  player.position.set(-WORLD_WIDTH / 2 + 1.2, 0, 0);
  scene.add(player);

  const glowGeometry = new THREE.ConeGeometry(0.14, 0.7, 12);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x00f5ff,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.rotation.z = Math.PI / 2;
  glow.position.set(-0.1, 0, -0.02);
  player.add(glow);
}

function spawnBullet() {
  const geometry = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
  const material = new THREE.MeshBasicMaterial({
    color: 0x7df9ff,
  });
  const bullet = new THREE.Mesh(geometry, material);
  bullet.rotation.z = Math.PI / 2;
  bullet.position.set(player.position.x + 0.6, player.position.y, 0.1);
  bullet.userData = {
    speed: 18,
    radius: 0.2,
  };
  scene.add(bullet);
  bullets.push(bullet);
}

function spawnEnemy() {
  const radius = 0.35 + Math.random() * 0.25;
  const geometry = new THREE.DodecahedronGeometry(radius, 1);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.55 + Math.random() * 0.12, 0.7, 0.6),
    metalness: 0.3,
    roughness: 0.25,
    emissive: new THREE.Color(0x200844),
    emissiveIntensity: 0.9,
  });

  const enemy = new THREE.Mesh(geometry, material);
  const y = (Math.random() - 0.5) * (WORLD_HEIGHT * 0.8);
  enemy.position.set(WORLD_WIDTH / 2 + 1, y, 0.15);
  enemy.userData = {
    speed: 3 + Math.random() * 2.4,
    spin: new THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5
    ),
    radius,
  };
  scene.add(enemy);
  enemies.push(enemy);
}

function resetGame() {
  bullets.forEach((b) => scene.remove(b));
  enemies.forEach((e) => scene.remove(e));
  bullets = [];
  enemies = [];
  score = 0;
  updateScore(0);
  isGameOver = false;
  canShoot = true;
  shootTimer = 0;
  enemySpawnTimer = 0;
  enemySpawnInterval = 1.1;
  player.position.set(-WORLD_WIDTH / 2 + 1.2, 0, 0);
  gameOverOverlay.classList.remove("visible");
}

function updateScore(delta) {
  score = Math.max(0, score + delta);
  const padded = score.toString().padStart(5, "0");
  scoreEl.textContent = padded;
  finalScoreEl.textContent = padded;
}

function handleInput(dt) {
  const up = keys.ArrowUp || keys.KeyW;
  const down = keys.ArrowDown || keys.KeyS;
  const left = keys.ArrowLeft || keys.KeyA;
  const right = keys.ArrowRight || keys.KeyD;

  const move = { x: 0, y: 0 };
  if (up) move.y += 1;
  if (down) move.y -= 1;
  if (left) move.x -= 1;
  if (right) move.x += 1;

  if (move.x !== 0 || move.y !== 0) {
    const len = Math.hypot(move.x, move.y);
    move.x /= len;
    move.y /= len;
  }

  player.position.x += move.x * playerSpeed * dt;
  player.position.y += move.y * playerSpeed * dt;

  const halfW = WORLD_WIDTH / 2 - 0.9;
  const halfH = WORLD_HEIGHT / 2 - 0.8;
  player.position.x = Math.max(-halfW, Math.min(halfW, player.position.x));
  player.position.y = Math.max(-halfH, Math.min(halfH, player.position.y));

  const targetTilt = move.y * 0.35;
  player.rotation.z = Math.PI / 2 + targetTilt;

  shootTimer += dt;
  if (!canShoot && shootTimer >= shootCooldown) {
    canShoot = true;
  }

  if ((keys.Space || keys.KeyK) && canShoot) {
    spawnBullet();
    canShoot = false;
    shootTimer = 0;
  }
}

function updateBullets(dt) {
  bullets.forEach((bullet) => {
    bullet.position.x += bullet.userData.speed * dt;
  });

  bullets = bullets.filter((bullet) => {
    const isVisible = bullet.position.x < WORLD_WIDTH / 2 + 2;
    if (!isVisible) {
      scene.remove(bullet);
    }
    return isVisible;
  });
}

function updateEnemies(dt) {
  enemies.forEach((enemy) => {
    enemy.position.x -= enemy.userData.speed * dt;
    enemy.rotation.x += enemy.userData.spin.x * dt;
    enemy.rotation.y += enemy.userData.spin.y * dt;
    enemy.rotation.z += enemy.userData.spin.z * dt;
  });

  enemies = enemies.filter((enemy) => {
    const isVisible = enemy.position.x > -WORLD_WIDTH / 2 - 2;
    if (!isVisible) {
      scene.remove(enemy);
    }
    return isVisible;
  });

  enemySpawnTimer += dt;
  if (enemySpawnTimer >= enemySpawnInterval) {
    enemySpawnTimer = 0;
    spawnEnemy();
    enemySpawnInterval = Math.max(0.4, enemySpawnInterval * 0.985);
  }
}

function checkCollisions() {
  const playerRadius = 0.55;

  for (const enemy of enemies) {
    const dx = enemy.position.x - player.position.x;
    const dy = enemy.position.y - player.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist < enemy.userData.radius + playerRadius) {
      triggerGameOver();
      return;
    }
  }

  const bulletsToRemove = new Set();
  const enemiesToRemove = new Set();

  bullets.forEach((bullet, bi) => {
    enemies.forEach((enemy, ei) => {
      const dx = enemy.position.x - bullet.position.x;
      const dy = enemy.position.y - bullet.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist < enemy.userData.radius + bullet.userData.radius) {
        bulletsToRemove.add(bi);
        enemiesToRemove.add(ei);
      }
    });
  });

  if (enemiesToRemove.size > 0) {
    enemies = enemies.filter((enemy, idx) => {
      if (enemiesToRemove.has(idx)) {
        spawnExplosion(enemy.position, enemy.userData.radius);
        scene.remove(enemy);
        updateScore(25);
        return false;
      }
      return true;
    });
  }

  if (bulletsToRemove.size > 0) {
    bullets = bullets.filter((bullet, idx) => {
      if (bulletsToRemove.has(idx)) {
        scene.remove(bullet);
        return false;
      }
      return true;
    });
  }
}

function spawnExplosion(position, size) {
  const geometry = new THREE.SphereGeometry(size * 0.9, 16, 12);
  const material = new THREE.MeshBasicMaterial({
    color: 0x7df9ff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const explosion = new THREE.Mesh(geometry, material);
  explosion.position.copy(position);
  explosion.position.z += 0.15;
  explosion.userData = {
    life: 0.35,
  };
  scene.add(explosion);

  const originalScale = explosion.scale.clone();
  const originalOpacity = material.opacity;
  const startTime = performance.now();

  function animateExplosion() {
    const now = performance.now();
    const elapsed = (now - startTime) / 1000;
    const t = elapsed / explosion.userData.life;

    if (t >= 1) {
      scene.remove(explosion);
      geometry.dispose();
      material.dispose();
      return;
    }

    const easeOut = 1 - Math.pow(1 - t, 2);
    explosion.scale.setScalar(originalScale.x * (1 + easeOut * 1.6));
    material.opacity = originalOpacity * (1 - t);

    requestAnimationFrame(animateExplosion);
  }

  requestAnimationFrame(animateExplosion);
}

function triggerGameOver() {
  isGameOver = true;
  gameOverOverlay.classList.add("visible");
}

function animate(timestamp) {
  requestAnimationFrame(animate);

  const dt = lastTime ? (timestamp - lastTime) / 1000 : 0;
  lastTime = timestamp;

  if (scene) {
    const bg = scene.children.find((c) => c.material && c.material.uniforms && c.material.uniforms.uTime);
    if (bg) {
      bg.material.uniforms.uTime.value = timestamp / 1000;
    }

    const stars = scene.getObjectByName("stars");
    if (stars) {
      stars.rotation.x = Math.sin(timestamp * 0.00009) * 0.04;
      stars.rotation.y = Math.cos(timestamp * 0.00007) * 0.03;
    }
  }

  if (isGameOver) {
    renderer.render(scene, camera);
    return;
  }

  updateScore(Math.floor(dt * 12));

  handleInput(dt);
  updateBullets(dt);
  updateEnemies(dt);
  checkCollisions();

  renderer.render(scene, camera);
}

function resize() {
  if (!renderer) return;
  const rect = appEl.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
}

function setupInput() {
  window.addEventListener("keydown", (e) => {
    if (keys.hasOwnProperty(e.code)) {
      keys[e.code] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (keys.hasOwnProperty(e.code)) {
      keys[e.code] = false;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
    }
  });

  restartButton.addEventListener("click", () => {
    resetGame();
  });
}

function main() {
  initRenderer();
  initScene();
  setupInput();
  resetGame();
  requestAnimationFrame(animate);
}

main();

