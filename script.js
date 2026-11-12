let canvas, ctx, miniCanvas, miniCtx;
let playerName = "Sobrevivente";
let lifeYears = 40;
let supplies = 70;
let activeNPC = null;
let activeItem = null;
let activeTower = null;
let inDialog = false;
let animFrame = 0;
let flashDamage = 0;
let isGameOver = false;
let isVictory = false;

// ==========================================
// SISTEMA DE ÁUDIO DE TENSÃO (WEB AUDIO API)
// ==========================================
let audioCtx = null;
let audioEnabled = true;
let droneOsc1 = null;
let droneOsc2 = null;
let droneGain = null;
let heartbeatTimer = 0;
let isBeingChased = false;

function iniciarAudio() {
  if (audioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();

  droneOsc1 = audioCtx.createOscillator();
  droneOsc2 = audioCtx.createOscillator();
  droneGain = audioCtx.createGain();

  droneOsc1.type = 'sawtooth';
  droneOsc1.frequency.value = 55;

  droneOsc2.type = 'sine';
  droneOsc2.frequency.value = 58.27;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 140;

  droneGain.gain.value = audioEnabled ? 0.08 : 0;

  droneOsc1.connect(filter);
  droneOsc2.connect(filter);
  filter.connect(droneGain);
  droneGain.connect(audioCtx.destination);

  droneOsc1.start();
  droneOsc2.start();
}

function alternarAudio() {
  audioEnabled = !audioEnabled;
  const btn = document.getElementById('audio-toggle');
  if (btn) btn.innerText = audioEnabled ? 'SOM: ON' : 'SOM: OFF';
  if (droneGain && audioCtx) {
    droneGain.gain.setTargetAtTime(audioEnabled ? 0.08 : 0, audioCtx.currentTime, 0.1);
  }
}

function tocarEfeitoSonoro(tipo) {
  if (!audioEnabled || !audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (tipo === 'heartbeat') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (tipo === 'item') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(660, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (tipo === 'damage') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(55, now + 0.25);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (tipo === 'tower_tick') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520 + Math.random() * 120, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (tipo === 'victory') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.setValueAtTime(440, now + 0.15);
    osc.frequency.setValueAtTime(659, now + 0.3);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.start(now);
    osc.stop(now + 0.7);
  }
}

// ==========================================
// CÂMERA, JOGADOR E OBJETIVOS
// ==========================================
const camera = { x: 0, y: 0 };

const player = {
  x: 1200,
  y: 900,
  width: 26,
  height: 40,
  speed: 3.5,
  skinColor: '#f1c27d',
  shirtColor: '#2b4c6f',
  pantsColor: '#1b222c',
  hairColor: '#1c1613',
  hasBackpack: true,
  facing: 1,
  isMoving: false,
  inShelter: false
};

const keys = {};

const towers = [
  { id: 1, x: 650, y: 450, width: 36, height: 60, progress: 0, activated: false, name: "Torre Norte" },
  { id: 2, x: 1900, y: 800, width: 36, height: 60, progress: 0, activated: false, name: "Torre Leste" },
  { id: 3, x: 1150, y: 1650, width: 36, height: 60, progress: 0, activated: false, name: "Torre Sul" }
];

const shelters = [
  { x: 1000, y: 700, width: 140, height: 110, name: "Casa em Ruínas A" },
  { x: 1800, y: 1200, width: 160, height: 130, name: "Bunker Destruído" },
  { x: 400, y: 1500, width: 150, height: 120, name: "Estrutura Abandonada" }
];

// CONSTRUÇÕES EXPLORÁVEIS POR DENTRO
const buildings = [
  {
    x: 780, y: 1080, w: 170, h: 145,
    doorSide: 'bottom', doorPos: 65, doorWidth: 42,
    type: 'clinic', title: 'POSTO MÉDICO', onFire: true
  },
  {
    x: 1480, y: 580, w: 185, h: 150,
    doorSide: 'bottom', doorPos: 72, doorWidth: 44,
    type: 'house', title: 'CASA ABANDONADA', onFire: false
  },
  {
    x: 1280, y: 1450, w: 180, h: 150,
    doorSide: 'top', doorPos: 68, doorWidth: 44,
    type: 'warehouse', title: 'DEPÓSITO', onFire: true
  },
  {
    x: 880, y: 490, w: 165, h: 140,
    doorSide: 'bottom', doorPos: 60, doorWidth: 42,
    type: 'house', title: 'RESIDÊNCIA 04', onFire: false
  },
  {
    x: 1620, y: 1020, w: 175, h: 145,
    doorSide: 'left', doorPos: 52, doorWidth: 42,
    type: 'clinic', title: 'LABORATÓRIO', onFire: true
  }
];

// CARROS DESTRUÍDOS PELO CAMINHO
const wreckedCars = [
  { x: 1280, y: 840, w: 72, h: 36, color: '#5c2b24', onFire: true, dir: 1 },
  { x: 960, y: 940, w: 72, h: 36, color: '#39424a', onFire: false, dir: -1 },
  { x: 1420, y: 1280, w: 74, h: 38, color: '#4f4632', onFire: true, dir: 1 },
  { x: 720, y: 820, w: 70, h: 36, color: '#2f353b', onFire: true, dir: -1 },
  { x: 1680, y: 760, w: 72, h: 36, color: '#593325', onFire: false, dir: 1 },
  { x: 1040, y: 1340, w: 72, h: 36, color: '#3d454d', onFire: true, dir: -1 }
];

const itemsOnGround = [
  { id: 1, x: 1150, y: 880, type: 'water', name: 'Garrafa de Água Potável', years: 3, supp: 10, collected: false },
  { id: 2, x: 840, y: 1130, type: 'med', name: 'Kit Cirúrgico (Interior)', years: 6, supp: 15, collected: false },
  { id: 3, x: 1560, y: 635, type: 'food', name: 'Ração Enlatada (Interior)', years: 4, supp: 15, collected: false },
  { id: 4, x: 1750, y: 1350, type: 'water', name: 'Galão de Água Filtrada', years: 4, supp: 15, collected: false },
  { id: 5, x: 1360, y: 1525, type: 'med', name: 'Adrenalina Sintética (Interior)', years: 5, supp: 15, collected: false },
  { id: 6, x: 1710, y: 1085, type: 'water', name: 'Cantil Militar (Interior)', years: 4, supp: 10, collected: false }
];

const npcs = [
  {
    id: 1,
    name: "Marcus (Sobrevivente)",
    x: 1350,
    y: 750,
    width: 26,
    height: 40,
    skinColor: '#c68642',
    shirtColor: '#5c4033',
    pantsColor: '#261c16',
    hairColor: '#2c1e16',
    hasBackpack: true,
    facing: 1,
    vx: 0.8,
    vy: 0,
    moveTimer: 0,
    isTalking: false,
    dialog: "Encontramos uma poça com água acumulada perto das construções. O grupo tem sede. O que fazemos?",
    options: [
      { text: "Beber a água diretamente para aliviar a desidratação.", years: -8, supp: 5, resp: "A água estava contaminada! Perdeste 8 anos de vida por infecção." },
      { text: "Ferver e filtrar com o pano antes de beber qualquer gole.", years: 4, supp: 10, resp: "Fizeste uma boa escolha! A água purificada recuperou a tua saúde." }
    ],
    solved: false
  },
  {
    id: 2,
    name: "Doutora Elena",
    x: 990,
    y: 1210,
    width: 26,
    height: 40,
    skinColor: '#ffdbac',
    shirtColor: '#d9dfe6',
    pantsColor: '#2d3748',
    hairColor: '#5a1e1e',
    isMedic: true,
    facing: -1,
    vx: -0.8,
    vy: 0,
    moveTimer: 0,
    isTalking: false,
    dialog: "Deixei suprimentos dentro do Posto Médico aqui ao lado, mas o prédio está pegando fogo. Vale a pena arriscar?",
    options: [
      { text: "Entrar pela porta e vasculhar as prateleiras internas.", years: 5, supp: 15, resp: "Encontraste medicamentos intactos dentro das salas!" },
      { text: "Ignorar o prédio para não arriscar a fumaça.", years: -3, supp: 0, resp: "Evitaste o perigo, mas a falta de remédios desgastou tua saúde." }
    ],
    solved: false
  }
];

const zombies = [
  { x: 1600, y: 900, width: 26, height: 40, speed: 1.3, vx: 0, vy: 0, facing: -1, patrolTimer: 0, isMoving: false },
  { x: 900, y: 680, width: 26, height: 40, speed: 1.1, vx: 0, vy: 0, facing: 1, patrolTimer: 0, isMoving: false },
  { x: 1100, y: 1400, width: 26, height: 40, speed: 1.2, vx: 0, vy: 0, facing: 1, patrolTimer: 0, isMoving: false },
  { x: 500, y: 900, width: 26, height: 40, speed: 1.0, vx: 0, vy: 0, facing: 1, patrolTimer: 0, isMoving: false },
  { x: 1850, y: 700, width: 26, height: 40, speed: 1.2, vx: 0, vy: 0, facing: -1, patrolTimer: 0, isMoving: false }
];

function redimensionarCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function iniciarJogo() {
  const input = document.getElementById('player-name-input').value.trim();
  if (input !== "") playerName = input;

  document.getElementById('display-player-name').innerText = playerName;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('game-ui').style.display = 'block';

  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  miniCanvas = document.getElementById('minimapCanvas');
  miniCtx = miniCanvas.getContext('2d');
  
  redimensionarCanvas();
  window.addEventListener('resize', redimensionarCanvas);

  iniciarAudio();

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (['e', ' '].includes(k) && !inDialog && !isGameOver && !isVictory) {
      if (activeNPC) abrirDialogo(activeNPC);
      else if (activeItem) coletarItem(activeItem);
    }
  });

  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  requestAnimationFrame(gameLoop);
}

function reiniciarJogo() {
  lifeYears = 40;
  supplies = 70;
  player.x = 1200;
  player.y = 900;
  isGameOver = false;
  isVictory = false;

  document.getElementById('life-span').innerText = lifeYears + ' Anos';
  document.getElementById('supplies-val').innerText = supplies + '%';
  document.getElementById('towers-val').innerText = '0/3';
  document.getElementById('game-over-screen').style.display = 'none';
  document.getElementById('victory-screen').style.display = 'none';

  itemsOnGround.forEach(i => i.collected = false);
  npcs.forEach(n => n.solved = false);
  towers.forEach(t => { t.activated = false; t.progress = 0; });

  requestAnimationFrame(gameLoop);
}

function gameLoop() {
  if (isGameOver || isVictory) return;

  animFrame++;

  if (!inDialog) {
    atualizarJogador();
    atualizarEsconderijo();
    atualizarNPCs();
    atualizarZumbis();
    verificarInteracoes();
    atualizarAtivacaoTorre();
    verificarAtaqueZumbi();
    verificarMorte();
  }

  atualizarSomTensao();
  atualizarCamera();
  desenhar();
  desenharMinimapa();

  if (!isGameOver && !isVictory) {
    requestAnimationFrame(gameLoop);
  }
}

function atualizarSomTensao() {
  if (!audioEnabled || !audioCtx) return;

  if (isBeingChased && !player.inShelter) {
    heartbeatTimer++;
    if (heartbeatTimer >= 38) {
      heartbeatTimer = 0;
      tocarEfeitoSonoro('heartbeat');
    }
  } else {
    heartbeatTimer = 30;
  }
}

function obterParedesConstrucao(b) {
  const t = 10;
  const walls = [];

  if (b.doorSide === 'top') {
    walls.push({ x: b.x, y: b.y, w: b.doorPos, h: t });
    walls.push({ x: b.x + b.doorPos + b.doorWidth, y: b.y, w: b.w - (b.doorPos + b.doorWidth), h: t });
  } else {
    walls.push({ x: b.x, y: b.y, w: b.w, h: t });
  }

  if (b.doorSide === 'bottom') {
    walls.push({ x: b.x, y: b.y + b.h - t, w: b.doorPos, h: t });
    walls.push({ x: b.x + b.doorPos + b.doorWidth, y: b.y + b.h - t, w: b.w - (b.doorPos + b.doorWidth), h: t });
  } else {
    walls.push({ x: b.x, y: b.y + b.h - t, w: b.w, h: t });
  }

  if (b.doorSide === 'left') {
    walls.push({ x: b.x, y: b.y, w: t, h: b.doorPos });
    walls.push({ x: b.x, y: b.y + b.doorPos + b.doorWidth, w: t, h: b.h - (b.doorPos + b.doorWidth) });
  } else {
    walls.push({ x: b.x, y: b.y, w: t, h: b.h });
  }

  if (b.doorSide === 'right') {
    walls.push({ x: b.x + b.w - t, y: b.y, w: t, h: b.doorPos });
    walls.push({ x: b.x + b.w - t, y: b.y + b.doorPos + b.doorWidth, w: t, h: b.h - (b.doorPos + b.doorWidth) });
  } else {
    walls.push({ x: b.x + b.w - t, y: b.y, w: t, h: b.h });
  }

  return walls;
}

function jogadorDentroDe(b) {
  const cx = player.x + player.width / 2;
  const cy = player.y + player.height / 2;
  return cx > b.x && cx < b.x + b.w && cy > b.y && cy < b.y + b.h;
}

// COLISÃO DO JOGADOR (PODE ENTRAR NOS ESCONDERIJOS E PELAS PORTAS DAS CONSTRUÇÕES)
function checarColisaoObstaculos(nextX, nextY) {
  const footX = nextX + 4;
  const footY = nextY + 18;
  const footW = player.width - 8;
  const footH = player.height - 18;

  for (let b of buildings) {
    const walls = obterParedesConstrucao(b);
    for (let w of walls) {
      if (
        footX < w.x + w.w &&
        footX + footW > w.x &&
        footY < w.y + w.h &&
        footY + footH > w.y
      ) {
        return true;
      }
    }
  }

  for (let c of wreckedCars) {
    if (
      nextX < c.x + c.w &&
      nextX + player.width > c.x &&
      nextY < c.y + c.h &&
      nextY + player.height > c.y
    ) {
      return true;
    }
  }
  return false;
}

// BARREIRA EXCLUSIVA PARA ZUMBIS (PROÍBE ENTRAR NOS ESCONDERIJOS E ATRAVESSAR OBSTÁCULOS)
function checarColisaoZumbi(nextX, nextY, z) {
  // 1. Bloqueia entrada nos esconderijos (com margem de segurança de 6px)
  for (let s of shelters) {
    if (
      nextX < s.x + s.width + 6 &&
      nextX + z.width > s.x - 6 &&
      nextY < s.y + s.height + 6 &&
      nextY + z.height > s.y - 6
    ) {
      return true;
    }
  }

  // 2. Bloqueia atravessar paredes das construções
  for (let b of buildings) {
    const walls = obterParedesConstrucao(b);
    for (let w of walls) {
      if (
        nextX < w.x + w.w &&
        nextX + z.width > w.x &&
        nextY < w.y + w.h &&
        nextY + z.height > w.y
      ) {
        return true;
      }
    }
  }

  // 3. Bloqueia atravessar carros destruídos
  for (let c of wreckedCars) {
    if (
      nextX < c.x + c.w &&
      nextX + z.width > c.x &&
      nextY < c.y + c.h &&
      nextY + z.height > c.y
    ) {
      return true;
    }
  }

  return false;
}

function atualizarJogador() {
  player.isMoving = false;
  let nextX = player.x;
  let nextY = player.y;

  if (keys['w'] || keys['arrowup']) { nextY -= player.speed; player.isMoving = true; }
  if (keys['s'] || keys['arrowdown']) { nextY += player.speed; player.isMoving = true; }
  if (keys['a'] || keys['arrowleft']) { nextX -= player.speed; player.isMoving = true; player.facing = -1; }
  if (keys['d'] || keys['arrowright']) { nextX += player.speed; player.isMoving = true; player.facing = 1; }

  if (!checarColisaoObstaculos(nextX, player.y)) player.x = nextX;
  if (!checarColisaoObstaculos(player.x, nextY)) player.y = nextY;
}

function atualizarCamera() {
  camera.x = player.x + player.width / 2 - canvas.width / 2;
  camera.y = player.y + player.height / 2 - canvas.height / 2;
}

function atualizarEsconderijo() {
  player.inShelter = false;
  for (let s of shelters) {
    if (
      player.x > s.x && player.x < s.x + s.width &&
      player.y > s.y && player.y < s.y + s.height
    ) {
      player.inShelter = true;
      break;
    }
  }

  const safeBadge = document.getElementById('status-safe');
  if (safeBadge) safeBadge.style.display = player.inShelter ? 'inline-block' : 'none';
}

function atualizarNPCs() {
  for (let npc of npcs) {
    if (npc.isTalking) continue;

    npc.moveTimer++;
    if (npc.moveTimer > 80 + Math.random() * 40) {
      npc.moveTimer = 0;
      const dirs = [[1,0], [-1,0], [0,1], [0,-1], [0,0]];
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      npc.vx = d[0] * 0.8;
      npc.vy = d[1] * 0.8;
      if (d[0] !== 0) npc.facing = d[0];
    }
    npc.x += npc.vx;
    npc.y += npc.vy;
  }
}

function atualizarZumbis() {
  isBeingChased = false;

  for (let z of zombies) {
    const dx = (player.x + player.width / 2) - (z.x + z.width / 2);
    const dy = (player.y + player.height / 2) - (z.y + z.height / 2);
    const dist = Math.hypot(dx, dy);

    if (!player.inShelter && dist < 400) {
      z.vx = (dx / dist) * z.speed;
      z.vy = (dy / dist) * z.speed;
      z.isMoving = true;
      z.facing = dx >= 0 ? 1 : -1;
      isBeingChased = true;
    } else {
      z.patrolTimer++;
      if (z.patrolTimer > 100 + Math.random() * 50) {
        z.patrolTimer = 0;
        const ang = Math.random() * Math.PI * 2;
        if (Math.random() > 0.3) {
          z.vx = Math.cos(ang) * (z.speed * 0.5);
          z.vy = Math.sin(ang) * (z.speed * 0.5);
          z.isMoving = true;
          z.facing = z.vx >= 0 ? 1 : -1;
        } else {
          z.vx = 0;
          z.vy = 0;
          z.isMoving = false;
        }
      }
    }

    // Move o zumbi respeitando a barreira dos esconderijos e obstáculos
    let blocked = false;
    if (!checarColisaoZumbi(z.x + z.vx, z.y, z)) {
      z.x += z.vx;
    } else {
      blocked = true;
    }

    if (!checarColisaoZumbi(z.x, z.y + z.vy, z)) {
      z.y += z.vy;
    } else {
      blocked = true;
    }

    // Se encostar na borda de um esconderijo ou obstáculo, vira para longe
    if (blocked) {
      z.vx = -z.vx;
      z.vy = -z.vy;
      z.facing = z.vx >= 0 ? 1 : -1;
      z.patrolTimer = 0;
    }
  }
}

function verificarInteracoes() {
  activeNPC = null;
  activeItem = null;
  activeTower = null;
  const prompt = document.getElementById('interaction-prompt');

  for (let t of towers) {
    if (t.activated) continue;
    const dist = Math.hypot((player.x + player.width/2) - (t.x + t.width/2), (player.y + player.height/2) - (t.y + t.height/2));
    if (dist < 55) {
      activeTower = t;
      prompt.innerHTML = `Segure <span class="key-highlight">[E]</span> para religar ${t.name}`;
      prompt.style.display = 'block';
      return;
    }
  }

  for (let npc of npcs) {
    const dist = Math.hypot((player.x + player.width/2) - (npc.x + npc.width/2), (player.y + player.height/2) - (npc.y + npc.height/2));
    if (dist < 50 && !npc.solved) {
      activeNPC = npc;
      prompt.innerHTML = `Pressione <span class="key-highlight">[E]</span> para conversar com ${npc.name}`;
      prompt.style.display = 'block';
      return;
    }
  }

  for (let item of itemsOnGround) {
    if (item.collected) continue;
    const dist = Math.hypot((player.x + player.width/2) - item.x, (player.y + player.height/2) - item.y);
    if (dist < 38) {
      activeItem = item;
      prompt.innerHTML = `Pressione <span class="key-highlight">[E]</span> para pegar ${item.name}`;
      prompt.style.display = 'block';
      return;
    }
  }

  prompt.style.display = 'none';
}

function atualizarAtivacaoTorre() {
  const progBox = document.getElementById('tower-progress-box');
  const progFill = document.getElementById('tower-progress-fill');

  if (activeTower && (keys['e'] || keys[' '])) {
    progBox.style.display = 'block';
    activeTower.progress += 0.7;
    progFill.style.width = Math.min(100, activeTower.progress) + '%';

    if (animFrame % 12 === 0) {
      tocarEfeitoSonoro('tower_tick');
    }

    if (activeTower.progress >= 100) {
      activeTower.activated = true;
      progBox.style.display = 'none';
      tocarEfeitoSonoro('item');

      const ligadas = towers.filter(t => t.activated).length;
      document.getElementById('towers-val').innerText = `${ligadas}/3`;
      mostrarPopupItem(`${activeTower.name} ONLINE! (${ligadas}/3)`);

      if (ligadas === 3) {
        isVictory = true;
        tocarEfeitoSonoro('victory');
        document.getElementById('victory-stats').innerText = `Expectativa de Vida Preservada: ${lifeYears} Anos`;
        document.getElementById('victory-screen').style.display = 'flex';
      }
    }
  } else {
    progBox.style.display = 'none';
    if (activeTower && !activeTower.activated) {
      activeTower.progress = Math.max(0, activeTower.progress - 0.5);
    }
  }
}

function coletarItem(item) {
  item.collected = true;
  lifeYears = Math.min(100, lifeYears + item.years);
  supplies = Math.min(100, supplies + item.supp);

  document.getElementById('life-span').innerText = lifeYears + ' Anos';
  document.getElementById('supplies-val').innerText = supplies + '%';

  tocarEfeitoSonoro('item');
  mostrarPopupItem(`+${item.years} Anos: ${item.name}!`);
  activeItem = null;
}

function mostrarPopupItem(texto) {
  const pop = document.getElementById('item-popup');
  pop.innerText = texto;
  pop.style.display = 'block';
  setTimeout(() => { pop.style.display = 'none'; }, 2500);
}

function verificarAtaqueZumbi() {
  if (player.inShelter) return;

  for (let z of zombies) {
    const dist = Math.hypot((player.x + player.width/2) - (z.x + z.width/2), (player.y + player.height/2) - (z.y + z.height/2));
    if (dist < 22) {
      lifeYears = Math.max(0, lifeYears - 2);
      flashDamage = 6;
      document.getElementById('life-span').innerText = lifeYears + ' Anos';
      if (animFrame % 15 === 0) tocarEfeitoSonoro('damage');
    }
  }
}

function verificarMorte() {
  if (lifeYears <= 0 && !isGameOver) {
    isGameOver = true;
    tocarEfeitoSonoro('damage');
    document.getElementById('game-over-screen').style.display = 'flex';
  }
}

function abrirDialogo(npc) {
  inDialog = true;
  npc.isTalking = true;
  document.getElementById('interaction-prompt').style.display = 'none';
  document.getElementById('dialog-box').style.display = 'block';
  document.getElementById('npc-name').innerText = npc.name;
  document.getElementById('npc-text').innerText = npc.dialog;

  const grid = document.getElementById('dialog-options');
  grid.innerHTML = '';

  npc.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'btn-oasis';
    btn.innerText = opt.text;
    btn.onclick = () => responderNPC(npc, opt);
    grid.appendChild(btn);
  });
}

function responderNPC(npc, opcao) {
  lifeYears = Math.max(0, lifeYears + opcao.years);
  supplies = Math.max(0, Math.min(100, supplies + opcao.supp));

  document.getElementById('life-span').innerText = lifeYears + ' Anos';
  document.getElementById('supplies-val').innerText = supplies + '%';

  if (opcao.years > 0) tocarEfeitoSonoro('item');
  else tocarEfeitoSonoro('damage');

  npc.solved = true;
  document.getElementById('npc-text').innerText = `${opcao.resp}`;
  document.getElementById('dialog-options').innerHTML = `
    <button class="btn-oasis" onclick="fecharDialogo()">Voltar ao Território</button>
  `;

  verificarMorte();
}

function fecharDialogo() {
  if (activeNPC) activeNPC.isTalking = false;
  inDialog = false;
  document.getElementById('dialog-box').style.display = 'none';
}

// ==========================================
// EFEITO DE FOGO ANIMADO E FUMAÇA
// ==========================================
function desenharFogoAnimado(fx, fy, escala = 1) {
  const flicker1 = Math.sin(animFrame * 0.35 + fx) * 3 * escala;
  const flicker2 = Math.cos(animFrame * 0.45 + fy) * 2.5 * escala;

  const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, 36 * escala);
  glow.addColorStop(0, 'rgba(255, 130, 0, 0.42)');
  glow.addColorStop(1, 'rgba(255, 50, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(fx, fy, 36 * escala, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 3; i++) {
    const progress = ((animFrame * 0.8 + i * 22 + fx) % 60) / 60;
    const smokeY = fy - 12 * escala - progress * 35 * escala;
    const smokeX = fx + Math.sin(progress * 5 + i) * 6 * escala;
    const smokeRadius = (4 + progress * 8) * escala;

    ctx.fillStyle = `rgba(35, 30, 28, ${(1 - progress) * 0.45})`;
    ctx.beginPath();
    ctx.arc(smokeX, smokeY, smokeRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ff3b00';
  ctx.beginPath();
  ctx.moveTo(fx - 10 * escala, fy + 2);
  ctx.quadraticCurveTo(fx - 12 * escala, fy - 12 * escala, fx + flicker1, fy - 24 * escala);
  ctx.quadraticCurveTo(fx + 12 * escala, fy - 12 * escala, fx + 10 * escala, fy + 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ff9100';
  ctx.beginPath();
  ctx.moveTo(fx - 6.5 * escala, fy + 2);
  ctx.quadraticCurveTo(fx - 7 * escala, fy - 8 * escala, fx + flicker2, fy - 17 * escala);
  ctx.quadraticCurveTo(fx + 7 * escala, fy - 8 * escala, fx + 6.5 * escala, fy + 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fff066';
  ctx.beginPath();
  ctx.arc(fx, fy - 3 * escala, 3.5 * escala, 0, Math.PI * 2);
  ctx.fill();
}

// ==========================================
// CONSTRUÇÕES EXPLORÁVEIS POR DENTRO
// ==========================================
function desenharConstrucaoInterior(b) {
  const bx = b.x - camera.x;
  const by = b.y - camera.y;

  if (bx < -250 || bx > canvas.width + 250 || by < -250 || by > canvas.height + 250) return;

  const isInside = jogadorDentroDe(b);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(bx + 8, by + 10, b.w, b.h);

  ctx.fillStyle = b.type === 'clinic' ? '#2c343b' : '#2d241e';
  ctx.fillRect(bx, by, b.w, b.h);

  ctx.strokeStyle = b.type === 'clinic' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1;
  for (let px = bx + 20; px < bx + b.w; px += 20) {
    ctx.beginPath(); ctx.moveTo(px, by); ctx.lineTo(px, by + b.h); ctx.stroke();
  }
  for (let py = by + 20; py < by + b.h; py += 20) {
    ctx.beginPath(); ctx.moveTo(bx, py); ctx.lineTo(bx + b.w, py); ctx.stroke();
  }

  if (b.type === 'clinic') {
    ctx.fillStyle = '#5a6875';
    ctx.fillRect(bx + b.w - 52, by + 18, 36, 18);
    ctx.fillStyle = '#8b2635';
    ctx.fillRect(bx + b.w - 48, by + 21, 24, 12);

    ctx.fillStyle = '#475569';
    ctx.fillRect(bx + 16, by + 18, 22, 34);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 16, by + 18, 22, 34);
  } else if (b.type === 'house') {
    ctx.fillStyle = '#4a2520';
    ctx.fillRect(bx + b.w / 2 - 28, by + b.h / 2 - 18, 56, 36);

    ctx.fillStyle = '#5c3d28';
    ctx.fillRect(bx + 20, by + 20, 34, 22);
    ctx.fillStyle = '#3d281a';
    ctx.fillRect(bx + b.w - 44, by + 22, 24, 24);
  } else {
    ctx.fillStyle = '#6b492b';
    ctx.fillRect(bx + 18, by + 20, 26, 26);
    ctx.strokeStyle = '#2b1d10';
    ctx.strokeRect(bx + 18, by + 20, 26, 26);

    ctx.fillStyle = '#7c2d12';
    ctx.beginPath();
    ctx.arc(bx + b.w - 30, by + b.h - 32, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#14100d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx + 35, by + b.h - 25);
  ctx.lineTo(bx + 55, by + b.h - 42);
  ctx.lineTo(bx + 70, by + b.h - 35);
  ctx.stroke();

  const walls = obterParedesConstrucao(b);
  ctx.fillStyle = '#59463a';
  ctx.strokeStyle = '#1c1511';
  ctx.lineWidth = 2;

  for (let w of walls) {
    const wx = w.x - camera.x;
    const wy = w.y - camera.y;
    ctx.fillRect(wx, wy, w.w, w.h);
    ctx.strokeRect(wx, wy, w.w, w.h);
  }

  ctx.fillStyle = 'rgba(255, 204, 0, 0.22)';
  if (b.doorSide === 'bottom') {
    ctx.fillRect(bx + b.doorPos, by + b.h - 10, b.doorWidth, 10);
  } else if (b.doorSide === 'top') {
    ctx.fillRect(bx + b.doorPos, by, b.doorWidth, 10);
  } else if (b.doorSide === 'left') {
    ctx.fillRect(bx, by + b.doorPos, 10, b.doorWidth);
  }

  if (b.onFire) {
    desenharFogoAnimado(bx + b.w - 28, by + 32, 0.9);
  }

  ctx.fillStyle = isInside ? '#00ff88' : '#d6c3b3';
  ctx.font = '8px "Press Start 2P"';
  ctx.fillText(isInside ? `${b.title} (INTERIOR)` : b.title, bx + 12, by - 6);
}

function desenharTetosConstrucoes() {
  for (let b of buildings) {
    if (jogadorDentroDe(b)) continue;

    const bx = b.x - camera.x;
    const by = b.y - camera.y;
    if (bx < -250 || bx > canvas.width + 250 || by < -250 || by > canvas.height + 250) continue;

    ctx.fillStyle = 'rgba(38, 29, 24, 0.68)';
    ctx.beginPath();
    ctx.rect(bx + 10, by + 10, b.w - 20, b.h - 20);
    ctx.moveTo(bx + 35, by + 35);
    ctx.lineTo(bx + b.w - 40, by + 30);
    ctx.lineTo(bx + b.w - 30, by + b.h - 35);
    ctx.lineTo(bx + 30, by + b.h - 40);
    ctx.closePath();
    ctx.fill('evenodd');
  }
}

function desenharCarroDestruido(c) {
  const cx = c.x - camera.x;
  const cy = c.y - camera.y;

  if (cx < -150 || cx > canvas.width + 150 || cy < -150 || cy > canvas.height + 150) return;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.ellipse(cx + c.w / 2, cy + c.h + 2, c.w * 0.52, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(160, 210, 230, 0.35)';
  ctx.fillRect(cx + 12, cy + c.h + 4, 4, 3);
  ctx.fillRect(cx + c.w - 18, cy - 4, 5, 3);
  ctx.fillStyle = '#2b2420';
  ctx.fillRect(cx - 5, cy + c.h - 4, 8, 5);

  ctx.fillStyle = '#141414';
  ctx.beginPath();
  ctx.arc(cx + 14, cy + c.h, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5c3422';
  ctx.beginPath();
  ctx.arc(cx + c.w - 14, cy + c.h + 1, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = c.color;
  ctx.strokeStyle = '#1a1412';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx, cy + 10, c.w, c.h - 10, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#26211e';
  ctx.beginPath();
  ctx.moveTo(cx + 14, cy + 10);
  ctx.lineTo(cx + 22, cy);
  ctx.lineTo(cx + c.w - 22, cy + 2);
  ctx.lineTo(cx + c.w - 14, cy + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0d0b0a';
  ctx.fillRect(cx + 22, cy + 3, 12, 6);
  ctx.fillRect(cx + 37, cy + 3, 12, 6);

  ctx.fillStyle = 'rgba(130, 55, 25, 0.55)';
  ctx.fillRect(cx + 6, cy + 14, 16, 8);
  ctx.fillRect(cx + c.w - 22, cy + 15, 14, 7);

  if (c.onFire) {
    const hoodX = c.dir === 1 ? cx + c.w - 14 : cx + 14;
    desenharFogoAnimado(hoodX, cy + 12, 0.9);
  }
}

function desenharCenario() {
  // Esconderijos (zona fechada para zumbis, aberta para o jogador)
  for (let s of shelters) {
    const sx = s.x - camera.x;
    const sy = s.y - camera.y;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(sx + 6, sy + 6, s.width, s.height);

    ctx.fillStyle = '#241b15';
    ctx.fillRect(sx, sy, s.width, s.height);

    ctx.strokeStyle = '#3d2e24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + 10, sy + 30);
    ctx.lineTo(sx + s.width - 10, sy + 30);
    ctx.moveTo(sx + 10, sy + s.height - 20);
    ctx.lineTo(sx + s.width - 10, sy + s.height - 20);
    ctx.stroke();

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, s.width, s.height);

    ctx.fillStyle = '#00ff88';
    ctx.font = '9px "Press Start 2P"';
    ctx.fillText('ABRIGO SEGURO', sx + 8, sy + 18);
  }

  for (let b of buildings) {
    desenharConstrucaoInterior(b);
  }

  for (let c of wreckedCars) {
    desenharCarroDestruido(c);
  }

  for (let t of towers) {
    const tx = t.x - camera.x;
    const ty = t.y - camera.y;

    ctx.fillStyle = '#2a2e35';
    ctx.fillRect(tx, ty + 20, t.width, 40);
    ctx.strokeStyle = t.activated ? '#00ff88' : '#ffcc00';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, ty + 20, t.width, 40);

    ctx.strokeStyle = '#8899aa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx + t.width / 2, ty + 20);
    ctx.lineTo(tx + t.width / 2, ty - 15);
    ctx.stroke();

    const blink = Math.floor(animFrame / 20) % 2 === 0;
    ctx.fillStyle = t.activated ? '#00ff88' : (blink ? '#ff0033' : '#660011');
    ctx.beginPath();
    ctx.arc(tx + t.width / 2, ty - 17, 5, 0, Math.PI * 2);
    ctx.fill();

    if (t.activated) {
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tx + t.width / 2, ty - 17, 14 + (animFrame % 20), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function desenharItemChao(item) {
  if (item.collected) return;
  const screenX = item.x - camera.x;
  const screenY = item.y - camera.y;

  ctx.fillStyle = item.type === 'water' ? 'rgba(0, 200, 255, 0.5)' : 'rgba(255, 200, 0, 0.5)';
  ctx.beginPath();
  ctx.arc(screenX, screenY, 11, 0, Math.PI * 2);
  ctx.fill();

  if (item.type === 'water') {
    ctx.fillStyle = '#00ccff';
    ctx.fillRect(screenX - 3, screenY - 6, 6, 12);
  } else {
    ctx.fillStyle = '#ff9900';
    ctx.fillRect(screenX - 5, screenY - 5, 10, 10);
  }
}

function desenharPersonagemDetalhado(worldX, worldY, char, isMoving, isZombie = false, isNPC = false) {
  const screenX = worldX - camera.x;
  const screenY = worldY - camera.y;

  if (screenX < -60 || screenX > canvas.width + 60 || screenY < -60 || screenY > canvas.height + 60) return;

  const facing = char.facing || 1;
  const cycle = animFrame * 0.24;
  const legSwing = isMoving ? Math.sin(cycle) * 4.5 : 0;
  const armSwing = isMoving ? Math.cos(cycle) * 4 : 0;
  const bodyBob = isMoving ? Math.abs(Math.sin(cycle)) * 1.5 : 0;

  const cx = screenX + 13;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.ellipse(cx, screenY + 38, 12, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isZombie && char.hasBackpack) {
    const packX = facing === 1 ? cx - 12 : cx + 5;
    ctx.fillStyle = '#3b3326';
    ctx.strokeStyle = '#14110d';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(packX, screenY + 13 - bodyBob, 7, 13, 2);
    ctx.fill();
    ctx.stroke();
  }

  const pantsColor = isZombie ? '#232b20' : (char.pantsColor || '#1b222c');
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#0d0d0d';

  ctx.fillStyle = pantsColor;
  ctx.beginPath();
  ctx.roundRect(cx - 7, screenY + 24 - bodyBob, 6, 11 + legSwing, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#141110';
  ctx.fillRect(cx - 7.5, screenY + 33 + legSwing - bodyBob, 7, 4);

  ctx.fillStyle = pantsColor;
  ctx.beginPath();
  ctx.roundRect(cx + 1, screenY + 24 - bodyBob, 6, 11 - legSwing, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#141110';
  ctx.fillRect(cx + 0.5, screenY + 33 - legSwing - bodyBob, 7, 4);

  ctx.fillStyle = isZombie ? '#4b6344' : char.skinColor;
  ctx.beginPath();
  ctx.roundRect(cx - 10, screenY + 14 - armSwing - bodyBob, 4, 11, 2);
  ctx.fill();

  const torsoOffset = isZombie ? facing * 1.5 : 0;
  ctx.fillStyle = isZombie ? '#33422e' : char.shirtColor;
  ctx.beginPath();
  ctx.roundRect(cx - 8 + torsoOffset, screenY + 11 - bodyBob, 16, 15, 3);
  ctx.fill();
  ctx.stroke();

  if (!isZombie) {
    ctx.fillStyle = char.isMedic ? '#ff2a4b' : 'rgba(0,0,0,0.28)';
    ctx.fillRect(cx - 1, screenY + 12 - bodyBob, 2, 13);
    if (char.isMedic) {
      ctx.fillRect(cx - 3.5, screenY + 15 - bodyBob, 7, 2);
    }
  } else {
    ctx.fillStyle = '#587350';
    ctx.fillRect(cx - 4 + torsoOffset, screenY + 17 - bodyBob, 5, 3);
  }

  if (isZombie) {
    ctx.fillStyle = '#587350';
    ctx.beginPath();
    const reachX = facing === 1 ? cx + 3 : cx - 14;
    ctx.roundRect(reachX, screenY + 13 + (armSwing * 0.4) - bodyBob, 11, 4, 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = char.shirtColor;
    ctx.beginPath();
    ctx.roundRect(cx + 6, screenY + 13 + armSwing - bodyBob, 4.5, 9, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = char.skinColor;
    ctx.beginPath();
    ctx.arc(cx + 8.2, screenY + 23 + armSwing - bodyBob, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const headX = cx + (isZombie ? facing * 2 : 0);
  const headY = screenY + 5 - bodyBob;

  ctx.fillStyle = isZombie ? '#5d7a54' : char.skinColor;
  ctx.beginPath();
  ctx.arc(headX, headY, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isZombie ? '#242922' : (char.hairColor || '#1c1613');
  ctx.beginPath();
  ctx.arc(headX, headY - 1.5, 7.6, Math.PI, 0);
  ctx.fill();

  const eyeShift = facing * 2;
  if (isZombie) {
    ctx.fillStyle = '#ff1e38';
    ctx.beginPath();
    ctx.arc(headX - 2 + eyeShift, headY + 0.5, 1.6, 0, Math.PI * 2);
    ctx.arc(headX + 2.5 + eyeShift, headY + 0.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#111';
    ctx.fillRect(headX - 2.5 + eyeShift, headY - 0.5, 2, 2.2);
    ctx.fillRect(headX + 1.5 + eyeShift, headY - 0.5, 2, 2.2);
  }

  if (isNPC) {
    const floatY = Math.sin(animFrame * 0.1) * 2;
    ctx.fillStyle = '#ffcc00';
    ctx.font = '11px "Press Start 2P"';
    ctx.fillText('!', cx - 4, screenY - 8 + floatY);
  }
}

// ==========================================
// MINIMAPA RADAR TÁTICO
// ==========================================
function desenharMinimapa() {
  if (!miniCtx) return;

  const mw = miniCanvas.width;
  const mh = miniCanvas.height;
  const scale = 0.055;

  const bgGrad = miniCtx.createRadialGradient(mw / 2, mh / 2, 10, mw / 2, mh / 2, mw * 0.7);
  bgGrad.addColorStop(0, '#1a1410');
  bgGrad.addColorStop(1, '#0a0806');
  miniCtx.fillStyle = bgGrad;
  miniCtx.fillRect(0, 0, mw, mh);

  const cx = mw / 2;
  const cy = mh / 2;

  miniCtx.strokeStyle = 'rgba(255, 85, 0, 0.12)';
  miniCtx.lineWidth = 1;
  miniCtx.beginPath();
  miniCtx.moveTo(cx, 0); miniCtx.lineTo(cx, mh);
  miniCtx.moveTo(0, cy); miniCtx.lineTo(mw, cy);
  miniCtx.stroke();

  miniCtx.strokeStyle = 'rgba(255, 140, 50, 0.18)';
  miniCtx.beginPath();
  miniCtx.arc(cx, cy, 26, 0, Math.PI * 2);
  miniCtx.arc(cx, cy, 52, 0, Math.PI * 2);
  miniCtx.stroke();

  const sweepAngle = (animFrame * 0.03) % (Math.PI * 2);
  miniCtx.strokeStyle = 'rgba(0, 229, 255, 0.28)';
  miniCtx.lineWidth = 1.5;
  miniCtx.beginPath();
  miniCtx.moveTo(cx, cy);
  miniCtx.lineTo(cx + Math.cos(sweepAngle) * 62, cy + Math.sin(sweepAngle) * 62);
  miniCtx.stroke();

  miniCtx.fillStyle = 'rgba(130, 115, 105, 0.55)';
  for (let b of buildings) {
    const mx = cx + (b.x - player.x) * scale;
    const my = cy + (b.y - player.y) * scale;
    miniCtx.fillRect(mx, my, Math.max(4, b.w * scale), Math.max(4, b.h * scale));
  }

  miniCtx.fillStyle = 'rgba(180, 110, 75, 0.65)';
  for (let c of wreckedCars) {
    const mx = cx + (c.x - player.x) * scale;
    const my = cy + (c.y - player.y) * scale;
    miniCtx.fillRect(mx, my, Math.max(3, c.w * scale), Math.max(2, c.h * scale));
  }

  for (let s of shelters) {
    const mx = cx + (s.x - player.x) * scale;
    const my = cy + (s.y - player.y) * scale;
    miniCtx.fillStyle = 'rgba(0, 255, 136, 0.35)';
    miniCtx.fillRect(mx, my, s.width * scale, s.height * scale);
    miniCtx.strokeStyle = '#00ff88';
    miniCtx.lineWidth = 1;
    miniCtx.strokeRect(mx, my, s.width * scale, s.height * scale);
  }

  miniCtx.fillStyle = '#38bdf8';
  for (let item of itemsOnGround) {
    if (item.collected) continue;
    const mx = cx + (item.x - player.x) * scale;
    const my = cy + (item.y - player.y) * scale;
    miniCtx.fillRect(mx - 1.5, my - 1.5, 3, 3);
  }

  miniCtx.fillStyle = '#ff8800';
  for (let npc of npcs) {
    if (npc.solved) continue;
    const mx = cx + (npc.x - player.x) * scale;
    const my = cy + (npc.y - player.y) * scale;
    miniCtx.beginPath();
    miniCtx.arc(mx, my, 2.5, 0, Math.PI * 2);
    miniCtx.fill();
  }

  for (let t of towers) {
    let mx = cx + (t.x - player.x) * scale;
    let my = cy + (t.y - player.y) * scale;
    mx = Math.max(8, Math.min(mw - 8, mx));
    my = Math.max(8, Math.min(mh - 8, my));

    miniCtx.fillStyle = t.activated ? '#00e5ff' : '#ffcc00';
    miniCtx.beginPath();
    miniCtx.moveTo(mx, my - 4.5);
    miniCtx.lineTo(mx + 4, my + 3.5);
    miniCtx.lineTo(mx - 4, my + 3.5);
    miniCtx.closePath();
    miniCtx.fill();
  }

  const pulse = 2.5 + Math.sin(animFrame * 0.15) * 0.6;
  for (let z of zombies) {
    const mx = cx + (z.x - player.x) * scale;
    const my = cy + (z.y - player.y) * scale;
    if (mx >= 0 && mx <= mw && my >= 0 && my <= mh) {
      miniCtx.fillStyle = '#ff0033';
      miniCtx.beginPath();
      miniCtx.arc(mx, my, pulse, 0, Math.PI * 2);
      miniCtx.fill();
    }
  }

  miniCtx.fillStyle = 'rgba(0, 204, 255, 0.18)';
  miniCtx.beginPath();
  miniCtx.moveTo(cx, cy);
  if (player.facing === 1) {
    miniCtx.arc(cx, cy, 18, -0.45, 0.45);
  } else {
    miniCtx.arc(cx, cy, 18, Math.PI - 0.45, Math.PI + 0.45);
  }
  miniCtx.closePath();
  miniCtx.fill();

  miniCtx.fillStyle = '#00ccff';
  miniCtx.beginPath();
  miniCtx.arc(cx, cy, 3.8, 0, Math.PI * 2);
  miniCtx.fill();
  miniCtx.strokeStyle = '#ffffff';
  miniCtx.lineWidth = 1.2;
  miniCtx.stroke();

  miniCtx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  miniCtx.font = 'bold 8px Rajdhani, sans-serif';
  miniCtx.fillText('N', cx - 3, 9);
  miniCtx.fillText('S', cx - 3, mh - 3);
  miniCtx.fillText('O', 3, cy + 3);
  miniCtx.fillText('L', mw - 8, cy + 3);
}

function desenharIluminacaoEClima() {
  const screenPx = player.x + player.width / 2 - camera.x;
  const screenPy = player.y + player.height / 2 - camera.y;

  const ligadas = towers.filter(t => t.activated).length;
  const outerRadius = 360 + ligadas * 60;

  const gradient = ctx.createRadialGradient(screenPx, screenPy, 80, screenPx, screenPy, outerRadius);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.75, 'rgba(10, 7, 5, 0.45)');
  gradient.addColorStop(1, 'rgba(5, 3, 2, 0.85)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (flashDamage > 0) {
    ctx.fillStyle = `rgba(255, 0, 0, ${flashDamage * 0.08})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashDamage--;
  }
}

function desenhar() {
  ctx.fillStyle = '#18120e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255, 85, 0, 0.06)';
  ctx.lineWidth = 1;
  const startX = - (camera.x % 60);
  const startY = - (camera.y % 60);

  for (let x = startX; x < canvas.width; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = startY; y < canvas.height; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  desenharCenario();

  for (let item of itemsOnGround) {
    desenharItemChao(item);
  }

  for (let npc of npcs) {
    desenharPersonagemDetalhado(npc.x, npc.y, npc, !npc.isTalking, false, !npc.solved);
  }

  for (let z of zombies) {
    desenharPersonagemDetalhado(z.x, z.y, z, z.isMoving, true, false);
  }

  desenharPersonagemDetalhado(player.x, player.y, player, player.isMoving, false, false);

  desenharTetosConstrucoes();

  desenharIluminacaoEClima();
}