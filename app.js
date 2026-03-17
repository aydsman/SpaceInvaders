// @ts-nocheck
(() => {
  // --- Element references ---
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  
  const canvas = $('#myCanvas');
  const ctx = canvas.getContext('2d');

  const btnStart = $('[data-action="start"]');
  const btnPause = $('[data-action="pause"]');
  const btnReset = $('[data-action="reset"]');
  const btnMute = $('[data-action="mute"]');
  const btnFullscreen = $('[data-action="fullscreen"]');
  const btnOpenSettings = $('[data-action="open-settings"]');

  const outScore = $('#score');
  const outLevel = $('#level');
  const outLives = $('#lives');
  const outShield = $('#shield');
  const outFps = $('#fps');
  const outTime = $('#time');

  const settingsDialog = $('#settingsDialog');
  const pauseDialog = $('#pauseDialog');

  const sfxShoot = $('#sfxShoot');
  const sfxExplosion = $('#sfxExplosion');
  const bgMusic = $('#bgMusic');

  // --- ASSETS ---
  const imgPlayer = new Image(); imgPlayer.src = 'assets/player.png';
  const imgEnemy = new Image(); imgEnemy.src = 'assets/enemyShip.png';
  const imgLaser = new Image(); imgLaser.src = 'assets/laserRed.png';

  // --- Game config and state ---
  const BASE_WIDTH = 1024;
  const BASE_HEIGHT = 768;

  const settings = {
    difficulty: 'normal',
    graphics: 'medium',
    musicVolume: 0.6,
    sfxVolume: 0.8,
    controlScheme: 'wasd',
    muted: false
  };

  const difficultyTable = {
    easy:   { enemyRate: 1.6, enemySpeed: 100, maxEnemies: 12 },
    normal: { enemyRate: 1.2, enemySpeed: 150, maxEnemies: 16 },
    hard:   { enemyRate: 0.9, enemySpeed: 200, maxEnemies: 22 },
    insane: { enemyRate: 0.7, enemySpeed: 250, maxEnemies: 28 }
  };

  const graphicsTable = {
    low:   { starLayers: 1 },
    medium:{ starLayers: 2 },
    high:  { starLayers: 3 },
    ultra: { starLayers: 4 }
  };

  let state = {
    running: false,
    paused: false,
    lastTs: 0,
    fps: 0,
    frameCount: 0,
    frameTimer: 0,
    score: 0,
    level: 1,
    lives: 3,
    shield: 100,
    timeSec: 0,
    enemySpawnTimer: 0,
    fireCooldown: 0,
    specialCooldown: 0,
  };

  // --- Entities ---
  const player = {
    x: BASE_WIDTH / 2 - 25,
    y: BASE_HEIGHT - 80,
    w: 50,
    h: 50,
    speed: 400
  };

  const bullets = [];
  const enemies = [];
  const particles = [];

  // High-DPI canvas scaling
  function resizeCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(BASE_WIDTH * dpr);
    canvas.height = Math.floor(BASE_HEIGHT * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // --- Input handling ---
  const keys = new Set();
  const keyMap = {
    left:  ['a', 'A', 'ArrowLeft'],
    right: ['d', 'D', 'ArrowRight'],
    fire:  [' ', 'Spacebar'],
    special: ['Shift'],
    pause: ['p', 'P'],
    fullscreen: ['f', 'F'],
  };

  window.addEventListener('keydown', (e) => {
    keys.add(e.key);
    if (keyMap.pause.includes(e.key)) { e.preventDefault(); togglePause(); }
    if (keyMap.fullscreen.includes(e.key)) { e.preventDefault(); toggleFullscreen(); }
    if (keyMap.fire.includes(e.key) || keyMap.left.includes(e.key) || keyMap.right.includes(e.key)) e.preventDefault();
  }, { passive: false });

  window.addEventListener('keyup', (e) => { keys.delete(e.key); });

  // --- Buttons & Dialogs ---
  btnStart?.addEventListener('click', startGame);
  btnPause?.addEventListener('click', () => togglePause());
  btnReset?.addEventListener('click', resetGame);
  btnMute?.addEventListener('click', toggleMute);
  btnFullscreen?.addEventListener('click', toggleFullscreen);
  btnOpenSettings?.addEventListener('click', () => settingsDialog?.showModal());

  settingsDialog?.addEventListener('close', () => {
    if (settingsDialog.returnValue === 'apply') {
      settings.difficulty = $('#difficulty').value;
      settings.graphics = $('#graphics').value;
      settings.musicVolume = clamp01(Number($('#musicVolume').value) / 100);
      settings.sfxVolume = clamp01(Number($('#sfxVolume').value) / 100);
      settings.controlScheme = $('#controlScheme').value;
      applyVolumes();
    }
  });

  pauseDialog?.addEventListener('close', () => {
    if (pauseDialog.returnValue === 'resume') { togglePause(false); } 
    else if (pauseDialog.returnValue === 'restart') { resetGame(); startGame(); }
  });

  // --- Audio helpers ---
  function applyVolumes() {
    const vMusic = settings.muted ? 0 : settings.musicVolume;
    const vSfx = settings.muted ? 0 : settings.sfxVolume;
    if (bgMusic) bgMusic.volume = vMusic;
    if (sfxShoot) sfxShoot.volume = vSfx;
    if (sfxExplosion) sfxExplosion.volume = vSfx;
  }
  applyVolumes();

  function toggleMute() {
    settings.muted = !settings.muted;
    btnMute?.setAttribute('aria-pressed', String(settings.muted));
    applyVolumes();
  }

  // --- Game lifecycle ---
  function startGame() {
    if (!state.running) {
      state.running = true;
      state.paused = false;
      state.lastTs = 0;
      bgMusic?.play?.().catch(() => {});
      requestAnimationFrame(loop);
    }
  }

  function togglePause(force = null) {
    if (!state.running) return;
    state.paused = (force === null) ? !state.paused : !!force;
    if (state.paused) {
      pauseDialog?.showModal();
    } else {
      if (pauseDialog?.open) pauseDialog.close('resume');
      state.lastTs = 0;
      requestAnimationFrame(loop);
    }
  }

  function resetGame() {
    state.running = false;
    state.paused = false;
    state.lastTs = 0; state.fps = 0; state.frameCount = 0; state.frameTimer = 0;
    state.score = 0; state.level = 1; state.lives = 3; state.shield = 100; state.timeSec = 0;
    
    bullets.length = 0; enemies.length = 0; particles.length = 0;
    player.x = BASE_WIDTH / 2 - 25;
    updateHUD();
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await (canvas.requestFullscreen?.() || $('#play')?.requestFullscreen?.());
      else await document.exitFullscreen?.();
    } catch {}
  }

  // --- Loop ---
  function loop(ts) {
    if (!state.running || state.paused) return;
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.033, (ts - state.lastTs) / 1000); // max 30 FPS jump
    state.lastTs = ts;

    // FPS calc
    state.frameTimer += dt;
    state.frameCount++;
    if (state.frameTimer >= 0.5) {
      state.fps = Math.round(state.frameCount / state.frameTimer);
      state.frameCount = 0; state.frameTimer = 0;
    }

    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // Rectangular collision detection
  function intersect(r1, r2) {
    return !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y);
  }

  // --- Update ---
  function update(dt) {
    state.timeSec += dt;

    const scheme = settings.controlScheme;
    const left = (scheme === 'arrows') ? keys.has('ArrowLeft') : (keys.has('a') || keys.has('A') || keys.has('ArrowLeft'));
    const right = (scheme === 'arrows') ? keys.has('ArrowRight') : (keys.has('d') || keys.has('D') || keys.has('ArrowRight'));
    const firing = keys.has(' ') || keys.has('Spacebar');
    const special = keys.has('Shift');

    // Player Horizontal Movement
    if (left) player.x -= player.speed * dt;
    if (right) player.x += player.speed * dt;
    player.x = clamp(player.x, 0, BASE_WIDTH - player.w);

    // Firing
    state.fireCooldown -= dt;
    if (firing && state.fireCooldown <= 0) {
      fireBullet();
      state.fireCooldown = 0.2;
    }

    // Special Bomb
    state.specialCooldown -= dt;
    if (special && state.specialCooldown <= 0 && state.shield >= 25) {
      state.specialCooldown = 6;
      state.shield = Math.max(0, state.shield - 25);
      enemies.length = 0;
      explode(player.x + 25, player.y + 25, 40, '#5ac8fa');
      sfxExplosion?.cloneNode(true)?.play?.().catch(()=>{});
    }

    // Enemies spawn
    const diff = difficultyTable[settings.difficulty] || difficultyTable.normal;
    state.enemySpawnTimer -= dt;
    if (state.enemySpawnTimer <= 0 && enemies.length < diff.maxEnemies) {
      spawnEnemy(diff.enemySpeed);
      state.enemySpawnTimer = diff.enemyRate;
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      let b = bullets[i];
      b.y -= b.speed * dt; // Move strictly UP
      if (b.y < -20) bullets.splice(i, 1);
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      let e = enemies[i];
      e.y += e.speed * dt; // Move strictly DOWN

      // Bullet collision
      let hit = false;
      for (let j = bullets.length - 1; j >= 0; j--) {
        let b = bullets[j];
        if (intersect(e, b)) {
          bullets.splice(j, 1);
          hit = true;
          break;
        }
      }
      
      if (hit) {
        state.score += 25;
        explode(e.x + 20, e.y + 20, 10, '#ffffff');
        sfxExplosion?.cloneNode(true)?.play?.().catch(()=>{});
        enemies.splice(i, 1);
        continue;
      }

      // Player collision
      if (intersect(e, player)) {
        state.shield -= 25;
        explode(player.x + 25, player.y + 25, 16, '#ff6b6b');
        sfxExplosion?.cloneNode(true)?.play?.().catch(()=>{});
        enemies.splice(i, 1);
        if (state.shield <= 0) {
          state.lives -= 1;
          state.shield = 100;
          if (state.lives <= 0) return gameOver();
        }
        continue;
      }

      // Offscreen
      if (e.y > BASE_HEIGHT) {
        enemies.splice(i, 1);
        state.shield -= 10;
        if (state.shield <= 0) {
          state.lives -= 1;
          state.shield = 100;
          if (state.lives <= 0) return gameOver();
        }
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Level scaling
    state.level = 1 + Math.floor(state.timeSec / 30);
    updateHUD();
  }

  function updateHUD() {
    if(outScore) outScore.textContent = String(state.score);
    if(outLevel) outLevel.textContent = String(state.level);
    if(outLives) outLives.textContent = String(state.lives);
    if(outShield) outShield.textContent = `${Math.max(0, Math.min(100, Math.round(state.shield)))}%`;
    if(outFps) outFps.textContent = String(state.fps);
    if(outTime) outTime.textContent = toMMSS(state.timeSec);
  }

  // --- Render ---
  function render() {
    ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    // Stars
    const starLayers = graphicsTable[settings.graphics]?.starLayers ?? 2;
    for (let i = 0; i < starLayers; i++) {
      drawStars(40 + i * 30, i * 1000);
    }

    // Enemies
    enemies.forEach(e => {
      if (imgEnemy.complete && imgEnemy.naturalWidth !== 0) {
        ctx.drawImage(imgEnemy, e.x, e.y, e.w, e.h);
      } else {
        ctx.fillStyle = 'red';
        ctx.fillRect(e.x, e.y, e.w, e.h);
      }
    });

    // Bullets
    bullets.forEach(b => {
      if (imgLaser.complete && imgLaser.naturalWidth !== 0) {
        ctx.drawImage(imgLaser, b.x, b.y, b.w, b.h);
      } else {
        ctx.fillStyle = 'yellow';
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
    });

    // Player
    if (imgPlayer.complete && imgPlayer.naturalWidth !== 0) {
      ctx.drawImage(imgPlayer, player.x, player.y, player.w, player.h);
    } else {
      ctx.fillStyle = 'blue';
      ctx.fillRect(player.x, player.y, player.w, player.h);
    }

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    });
    ctx.globalAlpha = 1;
  }

  function drawStars(count, seed) {
    const rand = mulberry32(Math.floor(state.timeSec * 60) + seed);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < count; i++) {
      ctx.fillRect(Math.floor(rand() * BASE_WIDTH), Math.floor(rand() * BASE_HEIGHT), rand() * 2, rand() * 2);
    }
  }

  function spawnEnemy(speed) {
    enemies.push({
      x: Math.random() * (BASE_WIDTH - 40), y: -40, w: 40, h: 40,
      speed: speed * (0.8 + Math.random() * 0.4)
    });
  }

  function fireBullet() {
    bullets.push({
      x: player.x + (player.w / 2) - 3, y: player.y, w: 6, h: 20, speed: 600
    });
    sfxShoot?.cloneNode(true)?.play?.().catch(()=>{});
  }

  function explode(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        s: 2 + Math.random() * 3, life: 0.6 + Math.random() * 0.6, maxLife: 1.2, color
      });
    }
  }

  function gameOver() {
    state.running = false;
    try {
      const key = 'spaceGameScores';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.push({ initials: 'YOU', score: state.score, t: Date.now() });
      list.sort((a, b) => b.score - a.score);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 10)));
      renderScores(list.slice(0, 10));
    } catch {}
    
    if (pauseDialog) {
      $('#pauseTitle').innerHTML = '<i class="fa-solid fa-skull"></i> Game Over';
      pauseDialog.showModal();
    }
  }

  function renderScores(list) {
    const ol = $('#scores');
    if (!ol) return;
    ol.innerHTML = '';
    list.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.initials || 'YOU'} — ${item.score.toLocaleString()}`;
      ol.appendChild(li);
    });
  }

  // --- Utilities ---
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function clamp01(v) { return clamp(v, 0, 1); }
  function toMMSS(sec) {
    const s = Math.floor(sec);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }

  // Init Leaderboard
  try {
    const list = JSON.parse(localStorage.getItem('spaceGameScores') || '[]');
    renderScores(list.slice(0, 10));
  } catch {}

})();