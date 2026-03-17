const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ASSET LOADING ---
const assets = {
    player: new Image(),
    enemy: new Image(),
    laser: new Image(),
    life: new Image()
};

assets.player.src = 'assets/player.png';
assets.enemy.src = 'assets/enemyShip.png';
assets.laser.src = 'assets/laserRed.png';
assets.life.src = 'assets/life.png';

// --- GAME STATE ---
let isGameOver = false;
let score = 0;
let lives = 3;

// --- ENTITIES ---
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 60,
    width: 50,
    height: 50,
    speed: 5,
    dx: 0
};

const lasers = [];
const enemies = [];

// --- INPUT HANDLING ---
document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') player.dx = -player.speed;
    if (e.code === 'ArrowRight') player.dx = player.speed;
    if (e.code === 'Space') shootLaser();
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') player.dx = 0;
});

function shootLaser() {
    lasers.push({
        x: player.x + player.width / 2 - 2.5, // Center laser
        y: player.y,
        width: 5,
        height: 15,
        speed: 7
    });
}

// --- ENEMY SPAWNER ---
function spawnEnemy() {
    const x = Math.random() * (canvas.width - 40);
    enemies.push({
        x: x,
        y: -40,
        width: 40,
        height: 40,
        speed: 2 + Math.random() * 2 // Random speed
    });
}

// Spawn an enemy every 1.5 seconds
setInterval(spawnEnemy, 1500);

// --- COLLISION DETECTION ---
function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// --- MAIN GAME LOOP ---
function update() {
    if (isGameOver) return;

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update & Draw Player
    player.x += player.dx;
    // Keep player in bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
    ctx.drawImage(assets.player, player.x, player.y, player.width, player.height);

    // Update & Draw Lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
        let l = lasers[i];
        l.y -= l.speed;
        ctx.drawImage(assets.laser, l.x, l.y, l.width, l.height);

        // Remove off-screen lasers
        if (l.y < 0) lasers.splice(i, 1);
    }

    // Update & Draw Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        e.y += e.speed;
        ctx.drawImage(assets.enemy, e.x, e.y, e.width, e.height);

        // Check collision with lasers
        for (let j = lasers.length - 1; j >= 0; j--) {
            if (checkCollision(lasers[j], e)) {
                enemies.splice(i, 1);
                lasers.splice(j, 1);
                score += 10;
                break;
            }
        }

        // Check if enemy passed the bottom
        if (e.y > canvas.height) {
            enemies.splice(i, 1);
            lives--;
            if (lives <= 0) isGameOver = true;
        }
    }

    // Draw UI (Score & Lives)
    ctx.font = '20px Courier New';
    ctx.fillStyle = 'white';
    ctx.fillText(`Score: ${score}`, 10, 30);
    
    // Draw life icons
    for(let i = 0; i < lives; i++) {
        ctx.drawImage(assets.life, canvas.width - 40 - (i * 35), 10, 30, 30);
    }

    // Game Over Text
    if (isGameOver) {
        ctx.font = '40px Courier New';
        ctx.fillStyle = 'red';
        ctx.fillText('GAME OVER', canvas.width / 2 - 100, canvas.height / 2);
    }

    requestAnimationFrame(update);
}

// Wait for assets to load before starting
window.onload = () => {
    update();
};
