let canvas, ctx, miniCanvas, miniCtx;
let playerName = "Sobrevivente";
let lifeYears = 40;
let supplies = 70;
let activeNPC = null;
let activeItem = null;
let inDialog = false;
let animFrame = 0;
let flashDamage = 0;
let isGameOver = false;

// CÂMERA E MUNDO INFINITO
const camera = { x: 0, y: 0 };

// JOGADOR
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

// ESCONDERIJOS (CASAS EM RUÍNAS)
const shelters = [
  { x: 1000, y: 700, width: 140, height: 110, name: "Casa em Ruínas A" },
  { x: 1800, y: 1200, width: 160, height: 130, name: "Bunker Destruído" },
  { x: 400, y: 1500, width: 150, height: 120, name: "Estrutura Abandonada" }
];

// OBSTÁCULOS E ESTRUTURAS DE RUÍNAS (COM COLISÃO DESVIÁVEL)
const ruins = [
  { x: 800, y: 1100, w: 90, h: 90, label: "Prédio em Ruínas" },
  { x: 1500, y: 600, w: 120, h: 80, label: "Torre Caída" },
  { x: 600, y: 600, w: 70, h: 70, label: "Escombros" },
  { x: 1300, y: 1500, w: 110, h: 100, label: "Construção Quebrada" },
  { x: 1100, y: 1000, w: 80, h: 60, label: "Carro Destruído" }
];

// SUPRIMENTOS NO CHÃO
const itemsOnGround = [
  { id: 1, x: 1150, y: 880, type: 'water', name: 'Garrafa de Água Potável', years: 3, supp: 10, collected: false },
  { id: 2, x: 1450, y: 1100, type: 'food', name: 'Ração Militar em Lata', years: 2, supp: 15, collected: false },
  { id: 3, x: 750, y: 550, type: 'med', name: 'Kit de Primeiros Socorros', years: 5, supp: 5, collected: false },
  { id: 4, x: 1750, y: 1350, type: 'water', name: 'Galão de Água Filtrada', years: 4, supp: 15, collected: false }
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
    vx: 1,
    vy: 0,
    moveTimer: 0,
    isTalking: false,
    dialog: "Encontramos uma poça com água acumulada da chuva perto das ruínas. O grupo tem muita sede. O que fazemos?",
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
    vx: -1,
    vy: 0,
    moveTimer: 0,
    isTalking: false,
    dialog: "Uma caixa de suprimentos caiu dentro do prédio destruído. Pode ter remédios ou ser perigosa.",
    options: [
      { text: "Entrar com cuidado para resgatar a caixa.", years: 5, supp: 15, resp: "Encontraste medicamentos intactos entre as ruínas!" },
      { text: "Ignorar a caixa para não arriscar um desabamento.", years: -3, supp: 0, resp: "Evitaste o perigo, mas o desgaste do caminho extra custou tempo de vida." }
    ],
    solved: false
  }
];

// ZUMBIS PERSEGUIDORES
const zombies = [
  { x: 1600, y: 900, width: 24, height: 36, speed: 2.2 },
  { x: 900, y: 600, width: 24, height: 36, speed: 2.0 },
  { x: 1100, y: 1400, width: 24, height: 36, speed: 2.3 },
  { x: 500, y: 900, width: 24, height: 36, speed: 2.1 }
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

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (['e', ' '].includes(k) && !inDialog && !isGameOver) {
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

  document.getElementById('life-span').innerText = lifeYears + ' Anos';
  document.getElementById('supplies-val').innerText = supplies + '%';
  document.getElementById('game-over-screen').style.display = 'none';

  itemsOnGround.forEach(i => i.collected = false);
  npcs.forEach(n => n.solved = false);

  requestAnimationFrame(gameLoop);
}

function gameLoop() {
  if (isGameOver) return;

  animFrame++;

  if (!inDialog) {
    atualizarJogador();
    atualizarEsconderijo();
    atualizarNPCs();
    atualizarZumbis();
    verificarInteracoes();
    verificarAtaqueZumbi();
    verificarMorte();
  }

  atualizarCamera();
  desenhar();
  desenharMinimapa();

  if (!isGameOver) {
    requestAnimationFrame(gameLoop);
  }
}

// SISTEMA DE COLISÃO COM ESTRUTURAS E RUÍNAS
function checarColisaoRuin(nextX, nextY) {
  for (let r of ruins) {
    if (
      nextX < r.x + r.w &&
      nextX + player.width > r.x &&
      nextY < r.y + r.h &&
      nextY + player.height > r.y
    ) {
      return true; // Colidiu, bloqueia o movimento
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

  // Aplica o movimento apenas se não houver colisão
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
      npc.vx = d[0];
      npc.vy = d[1];
    }
    npc.x += npc.vx * 0.7;
    npc.y += npc.vy * 0.7;
  }
}

function atualizarZumbis() {
  if (player.inShelter) return;

  for (let z of zombies) {
    const dx = (player.x + player.width / 2) - (z.x + z.width / 2);
    const dy = (player.y + player.height / 2) - (z.y + z.height / 2);
    const dist = Math.hypot(dx, dy);

    if (dist < 450) {
      z.x += (dx / dist) * z.speed;
      z.y += (dy / dist) * z.speed;
    }
  }
}

function verificarInteracoes() {
  activeNPC = null;
  activeItem = null;
  const prompt = document.getElementById('interaction-prompt');

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
    if (dist < 35) {
      activeItem = item;
      prompt.innerHTML = `Pressione <span class="key-highlight">[E]</span> para pegar ${item.name}`;
      prompt.style.display = 'block';
      return;
    }
  }

  prompt.style.display = 'none';
}

function coletarItem(item) {
  item.collected = true;
  lifeYears = Math.min(100, lifeYears + item.years);
  supplies = Math.min(100, supplies + item.supp);

  document.getElementById('life-span').innerText = lifeYears + ' Anos';
  document.getElementById('supplies-val').innerText = supplies + '%';

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
    }
  }
}

function verificarMorte() {
  if (lifeYears <= 0 && !isGameOver) {
    isGameOver = true;
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
  for (let s of shelters) {
    const sx = s.x - camera.x;
    const sy = s.y - camera.y;

    ctx.fillStyle = 'rgba(40, 20, 15, 0.85)';
    ctx.fillRect(sx, sy, s.width, s.height);

    ctx.strokeStyle = '#ff5500';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, s.width, s.height);

    ctx.fillStyle = '#00ff88';
    ctx.font = '9px "Press Start 2P"';
    ctx.fillText('ESCONDERIJO', sx + 8, sy + 18);
  }

  for (let r of ruins) {
    const rx = r.x - camera.x;
    const ry = r.y - camera.y;

    ctx.fillStyle = '#1e1410';
    ctx.fillRect(rx, ry, r.w, r.h);

    ctx.strokeStyle = '#553c2e';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, r.w, r.h);
  }
}

function desenharItemChao(item) {
  if (item.collected) return;
  const screenX = item.x - camera.x;
  const screenY = item.y - camera.y;

  ctx.fillStyle = item.type === 'water' ? 'rgba(0, 200, 255, 0.4)' : 'rgba(255, 200, 0, 0.4)';
  ctx.beginPath();
  ctx.arc(screenX, screenY, 10, 0, Math.PI * 2);
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

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
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

// RENDERING CORRIGIDO DO MINIMAPA
function desenharMinimapa() {
  if (!miniCtx) return;

  const mw = miniCanvas.width;
  const mh = miniCanvas.height;
  const scale = 0.04;

  miniCtx.fillStyle = '#050302';
  miniCtx.fillRect(0, 0, mw, mh);

  const cx = mw / 2;
  const cy = mh / 2;

  // Esconderijos (Pontos Verdes)
  miniCtx.fillStyle = '#00ff88';
  for (let s of shelters) {
    const mx = cx + (s.x - player.x) * scale;
    const my = cy + (s.y - player.y) * scale;
    miniCtx.fillRect(mx - 3, my - 3, 6, 6);
  }

  // Zumbis (Pontos Vermelhos)
  miniCtx.fillStyle = '#ff0033';
  for (let z of zombies) {
    const mx = cx + (z.x - player.x) * scale;
    const my = cy + (z.y - player.y) * scale;
    miniCtx.fillRect(mx - 2, my - 2, 4, 4);
  }

  // Jogador (Ponto Azul Central)
  miniCtx.fillStyle = '#00ccff';
  miniCtx.beginPath();
  miniCtx.arc(cx, cy, 3, 0, Math.PI * 2);
  miniCtx.fill();
}

function desenharIluminacaoEClima() {
  const screenPx = player.x + player.width / 2 - camera.x;
  const screenPy = player.y + player.height / 2 - camera.y;

  const gradient = ctx.createRadialGradient(screenPx, screenPy, 40, screenPx, screenPy, 260);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.75, 'rgba(5, 3, 2, 0.7)');
  gradient.addColorStop(1, 'rgba(3, 2, 1, 0.96)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (flashDamage > 0) {
    ctx.fillStyle = `rgba(255, 0, 0, ${flashDamage * 0.08})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashDamage--;
  }
}

function desenhar() {
  ctx.fillStyle = '#0b0806';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255, 85, 0, 0.04)';
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
    desenharPersonagemDetalhado(z.x, z.y, z, true, true, false);
  }

  desenharPersonagemDetalhado(player.x, player.y, player, player.isMoving, false, false);

  desenharIluminacaoEClima();
}