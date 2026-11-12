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

  // Drone grave de suspense contínuo
  droneOsc1 = audioCtx.createOscillator();
  droneOsc2 = audioCtx.createOscillator();
  droneGain = audioCtx.createGain();

  droneOsc1.type = 'sawtooth';
  droneOsc1.frequency.value = 55; // Lá grave (A1)

  droneOsc2.type = 'sine';
  droneOsc2.frequency.value = 58.27; // Dissonância leve para tensão

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
  width: 24,
  height: 36,
  speed: 3.5,
  skinColor: '#ffcc99',
  shirtColor: '#224466',
  pantsColor: '#111822',
  isMoving: false,
  inShelter: false
};

const keys = {};

// 3 TORRES DE TRANSMISSÃO (OBJETIVO FINAL)
const towers = [
  { id: 1, x: 650, y: 450, width: 36, height: 60, progress: 0, activated: false, name: "Torre Norte" },
  { id: 2, x: 1900, y: 800, width: 36, height: 60, progress: 0, activated: false, name: "Torre Leste" },
  { id: 3, x: 1150, y: 1650, width: 36, height: 60, progress: 0, activated: false, name: "Torre Sul" }
];

// ESCONDERIJOS (CASAS EM RUÍNAS)
const shelters = [
  { x: 1000, y: 700, width: 140, height: 110, name: "Casa em Ruínas A" },
  { x: 1800, y: 1200, width: 160, height: 130, name: "Bunker Destruído" },
  { x: 400, y: 1500, width: 150, height: 120, name: "Estrutura Abandonada" }
];

// ESTRUTURAS E CONSTRUÇÕES DESTRUIDAS (COM COLISÃO)
const ruins = [
  { x: 800, y: 1100, w: 100, h: 90 },
  { x: 1500, y: 600, w: 130, h: 80 },
  { x: 600, y: 600, w: 80, h: 70 },
  { x: 1300, y: 1500, w: 110, h: 100 },
  { x: 1100, y: 1000, w: 90, h: 60 }
];

// SUPRIMENTOS NO CHÃO
const itemsOnGround = [
  { id: 1, x: 1150, y: 880, type: 'water', name: 'Garrafa de Água Potável', years: 3, supp: 10, collected: false },
  { id: 2, x: 1450, y: 1100, type: 'food', name: 'Ração Militar em Lata', years: 2, supp: 15, collected: false },
  { id: 3, x: 750, y: 550, type: 'med', name: 'Kit de Primeiros Socorros', years: 5, supp: 5, collected: false },
  { id: 4, x: 1750, y: 1350, type: 'water', name: 'Galão de Água Filtrada', years: 4, supp: 15, collected: false },
  { id: 5, x: 1220, y: 1550, type: 'med', name: 'Adrenalina Sintética', years: 5, supp: 10, collected: false }
];

// SOBREVIVENTES (NPCs COM DECISÕES CEGAS)
const npcs = [
  {
    id: 1,
    name: "Marcus (Sobrevivente)",
    x: 1350,
    y: 750,
    width: 24,
    height: 36,
    skinColor: '#d2b48c',
    shirtColor: '#664422',
    pantsColor: '#221100',
    vx: 0.8,
    vy: 0,
    moveTimer: 0,
    isTalking: false,
    dialog: "Encontramos uma poça com água acumulada perto do prédio quebrado. O grupo tem sede. O que fazemos?",
    options: [
      { text: "Beber a água diretamente para aliviar a desidratação.", years: -8, supp: 5, resp: "A água estava contaminada! Perdeste 8 anos de vida por infecção." },
      { text: "Ferver e filtrar com o pano antes de beber qualquer gole.", years: 4, supp: 10, resp: "Fizeste uma boa escolha! A água purificada recuperou a tua saúde." }
    ],
    solved: false
  },
  {
    id: 2,
    name: "Doutora Elena",
    x: 850,
    y: 1250,
    width: 24,
    height: 36,
    skinColor: '#ffdbac',
    shirtColor: '#882222',
    pantsColor: '#331111',
    vx: -0.8,
    vy: 0,
    moveTimer: 0,
    isTalking: false,
    dialog: "Uma caixa de suprimentos caiu dentro da casinha destruída. Pode ter remédios ou ser perigosa.",
    options: [
      { text: "Entrar com cuidado para resgatar a caixa.", years: 5, supp: 15, resp: "Encontraste medicamentos intactos entre as ruínas!" },
      { text: "Ignorar a caixa para não arriscar um desabamento.", years: -3, supp: 0, resp: "Evitaste o perigo, mas o desgaste do caminho extra custou tempo de vida." }
    ],
    solved: false
  }
];

// ZUMBIS
const zombies = [
  { x: 1600, y: 900, width: 24, height: 36, speed: 1.3, vx: 0, vy: 0, patrolTimer: 0, isMoving: false },
  { x: 900, y: 600, width: 24, height: 36, speed: 1.1, vx: 0, vy: 0, patrolTimer: 0, isMoving: false },
  { x: 1100, y: 1400, width: 24, height: 36, speed: 1.2, vx: 0, vy: 0, patrolTimer: 0, isMoving: false },
  { x: 500, y: 900, width: 24, height: 36, speed: 1.0, vx: 0, vy: 0, patrolTimer: 0, isMoving: false },
  { x: 1850, y: 700, width: 24, height: 36, speed: 1.2, vx: 0, vy: 0, patrolTimer: 0, isMoving: false }
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

  // Batida cardíaca quando um zumbi está perseguindo
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

function checarColisaoRuin(nextX, nextY) {
  for (let r of ruins) {
    if (
      nextX < r.x + r.w &&
      nextX + player.width > r.x &&
      nextY < r.y + r.h &&
      nextY + player.height > r.y
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
  if (keys['a'] || keys['arrowleft']) { nextX -= player.speed; player.isMoving = true; }
  if (keys['d'] || keys['arrowright']) { nextX += player.speed; player.isMoving = true; }

  if (!checarColisaoRuin(nextX, player.y)) player.x = nextX;
  if (!checarColisaoRuin(player.x, nextY)) player.y = nextY;
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
        } else {
          z.vx = 0;
          z.vy = 0;
          z.isMoving = false;
        }
      }
    }

    z.x += z.vx;
    z.y += z.vy;
  }
}

function verificarInteracoes() {
  activeNPC = null;
  activeItem = null;
  activeTower = null;
  const prompt = document.getElementById('interaction-prompt');

  // 1. Verificar proximidade com Torres de Sinal
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

  // 2. Verificar proximidade com NPCs
  for (let npc of npcs) {
    const dist = Math.hypot((player.x + player.width/2) - (npc.x + npc.width/2), (player.y + player.height/2) - (npc.y + npc.height/2));
    if (dist < 50 && !npc.solved) {
      activeNPC = npc;
      prompt.innerHTML = `Pressione <span class="key-highlight">[E]</span> para conversar com ${npc.name}`;
      prompt.style.display = 'block';
      return;
    }
  }

  // 3. Verificar proximidade com Itens no Chão
  for (let item of itemsOnGround) {
    if (item.collected) continue;
    const dist = Math.hypot((player.x + player.width/2) - item.x, (player.y + player.height/2) - item.y);
    if (dist < 35) {
      activeItem = item;
      prompt.innerHTML = `Pressione <span class="key-highlight">[E]</span> para pegar ${item.name}`;
      prompt.style.display = 'block';
      return;
    }
  }

  prompt.style.display = 'none';
}

// LÓGICA DE ATIVAÇÃO DAS 3 TORRES DE SATÉLITE
function atualizarAtivacaoTorre() {
  const progBox = document.getElementById('tower-progress-box');
  const progFill = document.getElementById('tower-progress-fill');

  if (activeTower && (keys['e'] || keys[' '])) {
    progBox.style.display = 'block';
    activeTower.progress += 0.7; // Leva ~2.5 segundos segurando [E]
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

function desenharCenario() {
  // Esconderijos
  for (let s of shelters) {
    const sx = s.x - camera.x;
    const sy = s.y - camera.y;

    ctx.fillStyle = '#2d1d16';
    ctx.fillRect(sx, sy, s.width, s.height);

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, s.width, s.height);

    ctx.fillStyle = '#00ff88';
    ctx.font = '9px "Press Start 2P"';
    ctx.fillText('ESCONDERIJO', sx + 8, sy + 18);
  }

  // Ruínas e Construções Quebradas
  for (let r of ruins) {
    const rx = r.x - camera.x;
    const ry = r.y - camera.y;

    ctx.fillStyle = '#3a281e';
    ctx.fillRect(rx, ry, r.w, r.h);

    ctx.strokeStyle = '#5a3f30';
    ctx.lineWidth = 3;
    ctx.strokeRect(rx, ry, r.w, r.h);

    ctx.fillStyle = '#18120e';
    ctx.fillRect(rx + 10, ry + 10, r.w / 3, r.h / 3);
  }

  // Torres de Transmissão (Objetivo)
  for (let t of towers) {
    const tx = t.x - camera.x;
    const ty = t.y - camera.y;

    // Base da Torre
    ctx.fillStyle = '#2a2e35';
    ctx.fillRect(tx, ty + 20, t.width, 40);
    ctx.strokeStyle = t.activated ? '#00ff88' : '#ffcc00';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, ty + 20, t.width, 40);

    // Antena metálica
    ctx.strokeStyle = '#8899aa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx + t.width / 2, ty + 20);
    ctx.lineTo(tx + t.width / 2, ty - 15);
    ctx.stroke();

    // Luz no topo (Vermelha piscando se desligada, Verde fixa se ligada)
    const blink = Math.floor(animFrame / 20) % 2 === 0;
    ctx.fillStyle = t.activated ? '#00ff88' : (blink ? '#ff0033' : '#660011');
    ctx.beginPath();
    ctx.arc(tx + t.width / 2, ty - 17, 5, 0, Math.PI * 2);
    ctx.fill();

    // Ondas de sinal se estiver ativa
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

  if (screenX < -50 || screenX > canvas.width + 50 || screenY < -50 || screenY > canvas.height + 50) return;

  const legOffset = isMoving ? Math.sin(animFrame * 0.25) * 4 : 0;
  const armOffset = isMoving ? Math.cos(animFrame * 0.25) * 3 : 0;

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(screenX + 12, screenY + 34, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isZombie ? '#1c2618' : (char.pantsColor || '#111');
  ctx.fillRect(screenX + 4, screenY + 22, 6, 12 + legOffset);
  ctx.fillRect(screenX + 14, screenY + 22, 6, 12 - legOffset);

  ctx.fillStyle = isZombie ? '#2e4226' : char.shirtColor;
  ctx.fillRect(screenX + 3, screenY + 10, 18, 13);

  ctx.fillStyle = isZombie ? '#3b5431' : char.shirtColor;
  ctx.fillRect(screenX - 1, screenY + 11 + armOffset, 4, 10);
  ctx.fillRect(screenX + 21, screenY + 11 - armOffset, 4, 10);

  ctx.fillStyle = isZombie ? '#4d6e40' : char.skinColor;
  ctx.fillRect(screenX + 4, screenY, 16, 11);

  if (!isZombie) {
    ctx.fillStyle = isNPC ? '#3a2518' : '#111';
    ctx.fillRect(screenX + 4, screenY, 16, 3);
  }

  ctx.fillStyle = isZombie ? '#ff0000' : '#000';
  ctx.fillRect(screenX + 7, screenY + 4, 3, 3);
  ctx.fillRect(screenX + 14, screenY + 4, 3, 3);

  if (isNPC) {
    ctx.fillStyle = '#ffcc00';
    ctx.font = '12px "Press Start 2P"';
    ctx.fillText('!', screenX + 8, screenY - 6);
  }
}

function desenharMinimapa() {
  if (!miniCtx) return;

  const mw = miniCanvas.width;
  const mh = miniCanvas.height;
  const scale = 0.042;

  miniCtx.fillStyle = '#100c09';
  miniCtx.fillRect(0, 0, mw, mh);

  const cx = mw / 2;
  const cy = mh / 2;

  // Esconderijos (Verde)
  for (let s of shelters) {
    const mx = cx + (s.x - player.x) * scale;
    const my = cy + (s.y - player.y) * scale;
    miniCtx.fillStyle = '#00ff88';
    miniCtx.fillRect(mx - 3, my - 3, 6, 6);
  }

  // Torres de Transmissão (Amarelo se desligada, Ciano se ligada)
  for (let t of towers) {
    const mx = cx + (t.x - player.x) * scale;
    const my = cy + (t.y - player.y) * scale;
    miniCtx.fillStyle = t.activated ? '#00e5ff' : '#ffcc00';
    miniCtx.beginPath();
    miniCtx.moveTo(mx, my - 4);
    miniCtx.lineTo(mx + 4, my + 3);
    miniCtx.lineTo(mx - 4, my + 3);
    miniCtx.closePath();
    miniCtx.fill();
  }

  // Zumbis (Vermelho)
  for (let z of zombies) {
    const mx = cx + (z.x - player.x) * scale;
    const my = cy + (z.y - player.y) * scale;
    miniCtx.fillStyle = '#ff0033';
    miniCtx.beginPath();
    miniCtx.arc(mx, my, 3, 0, Math.PI * 2);
    miniCtx.fill();
  }

  // Jogador (Azul no Centro)
  miniCtx.fillStyle = '#00ccff';
  miniCtx.beginPath();
  miniCtx.arc(cx, cy, 4, 0, Math.PI * 2);
  miniCtx.fill();
  miniCtx.strokeStyle = '#ffffff';
  miniCtx.lineWidth = 1;
  miniCtx.stroke();
}

function desenharIluminacaoEClima() {
  const screenPx = player.x + player.width / 2 - camera.x;
  const screenPy = player.y + player.height / 2 - camera.y;

  // Se todas as torres forem ligadas, a luz expande
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

  desenharIluminacaoEClima();
}