let canvas, ctx;
let playerName = "Sobrevivente";
let lifeYears = 40;
let supplies = 70;
let activeNPC = null;
let inDialog = false;
let animFrame = 0;
let flashDamage = 0;

// TAMANHO DO MUNDO EXPANDIDO (Mundo Aberto)
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1800;

// CAMÉRA
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
  isMoving: false
};

const keys = {};

// PARTÍCULAS DE NÉVOA TÓXICA
const particles = [];
for (let i = 0; i < 60; i++) {
  particles.push({
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    size: Math.random() * 2 + 1,
    speedX: Math.random() * 0.4 - 0.2,
    speedY: Math.random() * 0.3 + 0.1
  });
}

// SUPRIMENTOS RECOLHÍVEIS PELO MAPA
const itemsOnGround = [
  { id: 1, x: 1000, y: 850, type: 'water', name: 'Garrafa de Água Potável', years: 3, supp: 10, collected: false },
  { id: 2, x: 1400, y: 1100, type: 'food', name: 'Ração Militar em Lata', years: 2, supp: 15, collected: false },
  { id: 3, x: 700, y: 500, type: 'med', name: 'Kit de Primeiros Socorros', years: 5, supp: 5, collected: false },
  { id: 4, x: 1800, y: 1300, type: 'water', name: 'Galão de Água Filtrada', years: 4, supp: 15, collected: false }
];

// SOBREVIVENTES (DECISÕES CEGAS - SEM REVELAR VALORES ANTES)
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
    dialog: "Encontramos uma poça com água acumulada da chuva, mas está turva e perto de poeira tóxica. O grupo tem muita sede. O que fazemos?",
    options: [
      { text: "Beber a água diretamente para aliviar a desidratação imediata.", years: -6, supp: 5, resp: "A água estava contaminada! Contraíste uma infecção forte e perdeste anos de vida." },
      { text: "Ferver e filtrar com o pano antes de beber qualquer gole.", years: 4, supp: 10, resp: "Boa escolha! A filtragem purificou a água e garantiu hidratação segura." }
    ],
    solved: false
  },
  {
    id: 2,
    name: "Doutora Elena",
    x: 800,
    y: 1200,
    width: 24,
    height: 36,
    skinColor: '#ffdbac',
    shirtColor: '#882222',
    pantsColor: '#331111',
    vx: -1,
    vy: 0,
    moveTimer: 0,
    isTalking: false,
    dialog: "Um bando de saqueadores abandonou uma caixa lacrada na zona vermelha. Pode conter remédios ou ser uma armadilha com zumbis.",
    options: [
      { text: "Investigar e abrir a caixa com cuidado.", years: 5, supp: 15, resp: "Tiveste sorte! A caixa continha suprimentos médicos intactos." },
      { text: "Ignorar a caixa e focar na rota segura de evacuação.", years: -2, supp: 0, resp: "Evitaste perigos, mas o cansaço do caminho extra desgastou a tua saúde." }
    ],
    solved: false
  }
];

// ZUMBIS PERSEGUIDORES (IA DE ATALHO AO JOGADOR)
const zombies = [
  { x: 1600, y: 900, width: 24, height: 36, speed: 2.1 },
  { x: 900, y: 600, width: 24, height: 36, speed: 1.9 },
  { x: 1100, y: 1400, width: 24, height: 36, speed: 2.2 },
  { x: 500, y: 900, width: 24, height: 36, speed: 2.0 }
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
  
  redimensionarCanvas();
  window.addEventListener('resize', redimensionarCanvas);

  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (['e', ' '].includes(e.key.toLowerCase()) && activeNPC && !inDialog) {
      abrirDialogo(activeNPC);
    }
  });

  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  requestAnimationFrame(gameLoop);
}

function gameLoop() {
  animFrame++;

  if (!inDialog) {
    atualizarJogador();
    atualizarNPCs();
    atualizarZumbis();
    verificarColetaItens();
    verificarProximidade();
    verificarAtaqueZumbi();
  }

  atualizarCamera();
  desenhar();
  requestAnimationFrame(gameLoop);
}

function atualizarJogador() {
  player.isMoving = false;
  if (keys['w'] || keys['arrowup']) { if (player.y > 0) player.y -= player.speed; player.isMoving = true; }
  if (keys['s'] || keys['arrowdown']) { if (player.y < WORLD_HEIGHT - player.height) player.y += player.speed; player.isMoving = true; }
  if (keys['a'] || keys['arrowleft']) { if (player.x > 0) player.x -= player.speed; player.isMoving = true; }
  if (keys['d'] || keys['arrowright']) { if (player.x < WORLD_WIDTH - player.width) player.x += player.speed; player.isMoving = true; }
}

function atualizarCamera() {
  // Mantém a câmera centralizada no jogador
  camera.x = player.x + player.width / 2 - canvas.width / 2;
  camera.y = player.y + player.height / 2 - canvas.height / 2;

  // Trava a câmera nos limites do mundo expandido
  camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH - canvas.width));
  camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT - canvas.height));
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

    if (npc.x + npc.vx > 0 && npc.x + npc.vx < WORLD_WIDTH - npc.width) npc.x += npc.vx * 0.7;
    else npc.vx *= -1;

    if (npc.y + npc.vy > 0 && npc.y + npc.vy < WORLD_HEIGHT - npc.height) npc.y += npc.vy * 0.7;
    else npc.vy *= -1;
  }
}

// ZUMBIS CORREM ATRÁS DO SOBREVIVENTE
function atualizarZumbis() {
  for (let z of zombies) {
    const dx = (player.x + player.width / 2) - (z.x + z.width / 2);
    const dy = (player.y + player.height / 2) - (z.y + z.height / 2);
    const dist = Math.hypot(dx, dy);

    // Se o jogador estiver num raio de visão (380px), o zumbi avança!
    if (dist < 380) {
      z.x += (dx / dist) * z.speed;
      z.y += (dy / dist) * z.speed;
    }
  }
}

// RECOLHER ÁGUA E SUPRIMENTOS NO CHÃO
function verificarColetaItens() {
  for (let item of itemsOnGround) {
    if (item.collected) continue;

    const dist = Math.hypot((player.x + player.width / 2) - item.x, (player.y + player.height / 2) - item.y);
    if (dist < 28) {
      item.collected = true;
      lifeYears = Math.min(100, lifeYears + item.years);
      supplies = Math.min(100, supplies + item.supp);

      document.getElementById('life-span').innerText = lifeYears + ' Anos';
      document.getElementById('supplies-val').innerText = supplies + '%';

      mostrarPopupItem(`+${item.years} Anos: ${item.name}!`);
    }
  }
}

function mostrarPopupItem(texto) {
  const pop = document.getElementById('item-popup');
  pop.innerText = texto;
  pop.style.display = 'block';
  setTimeout(() => { pop.style.display = 'none'; }, 2500);
}

function verificarProximidade() {
  let perto = false;
  activeNPC = null;

  for (let npc of npcs) {
    const dist = Math.hypot((player.x + player.width/2) - (npc.x + npc.width/2), (player.y + player.height/2) - (npc.y + npc.height/2));
    if (dist < 50 && !npc.solved) {
      perto = true;
      activeNPC = npc;
      break;
    }
  }

  document.getElementById('interaction-prompt').style.display = perto ? 'block' : 'none';
}

function verificarAtaqueZumbi() {
  for (let z of zombies) {
    const dist = Math.hypot((player.x + player.width/2) - (z.x + z.width/2), (player.y + player.height/2) - (z.y + z.height/2));
    if (dist < 22) {
      lifeYears = Math.max(0, lifeYears - 1);
      flashDamage = 5;
      document.getElementById('life-span').innerText = lifeYears + ' Anos';
    }
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
    btn.innerText = opt.text; // Sem mostrar spoilers de +5 ou -5 anos!
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
}

function fecharDialogo() {
  if (activeNPC) activeNPC.isTalking = false;
  inDialog = false;
  document.getElementById('dialog-box').style.display = 'none';
}

function desenharItemChao(item) {
  if (item.collected) return;
  const screenX = item.x - camera.x;
  const screenY = item.y - camera.y;

  // Brilho sob o item
  ctx.fillStyle = item.type === 'water' ? 'rgba(0, 200, 255, 0.4)' : 'rgba(255, 200, 0, 0.4)';
  ctx.beginPath();
  ctx.arc(screenX, screenY, 10, 0, Math.PI * 2);
  ctx.fill();

  // Ícone Pixel Art do Item
  if (item.type === 'water') {
    ctx.fillStyle = '#00ccff';
    ctx.fillRect(screenX - 3, screenY - 6, 6, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(screenX - 2, screenY - 8, 4, 2);
  } else {
    ctx.fillStyle = '#ff9900';
    ctx.fillRect(screenX - 5, screenY - 5, 10, 10);
  }
}

function desenharPersonagemDetalhado(worldX, worldY, char, isMoving, isZombie = false, isNPC = false) {
  const screenX = worldX - camera.x;
  const screenY = worldY - camera.y;

  // Renderizar apenas se estiver visível na janela da câmera
  if (screenX < -50 || screenX > canvas.width + 50 || screenY < -50 || screenY > canvas.height + 50) return;

  const legOffset = isMoving ? Math.sin(animFrame * 0.25) * 4 : 0;
  const armOffset = isMoving ? Math.cos(animFrame * 0.25) * 3 : 0;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(screenX + 12, screenY + 34, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pernas
  ctx.fillStyle = isZombie ? '#1c2618' : (char.pantsColor || '#111');
  ctx.fillRect(screenX + 4, screenY + 22, 6, 12 + legOffset);
  ctx.fillRect(screenX + 14, screenY + 22, 6, 12 - legOffset);

  // Corpo
  ctx.fillStyle = isZombie ? '#2e4226' : char.shirtColor;
  ctx.fillRect(screenX + 3, screenY + 10, 18, 13);
  
  // Braços
  ctx.fillStyle = isZombie ? '#3b5431' : char.shirtColor;
  ctx.fillRect(screenX - 1, screenY + 11 + armOffset, 4, 10);
  ctx.fillRect(screenX + 21, screenY + 11 - armOffset, 4, 10);

  // Cabeça
  ctx.fillStyle = isZombie ? '#4d6e40' : char.skinColor;
  ctx.fillRect(screenX + 4, screenY, 16, 11);

  if (!isZombie) {
    ctx.fillStyle = isNPC ? '#3a2518' : '#111';
    ctx.fillRect(screenX + 4, screenY, 16, 3);
  }

  // Olhos
  ctx.fillStyle = isZombie ? '#ff0000' : '#000';
  ctx.fillRect(screenX + 7, screenY + 4, 3, 3);
  ctx.fillRect(screenX + 14, screenY + 4, 3, 3);

  // Indicador NPC
  if (isNPC) {
    ctx.fillStyle = '#ffcc00';
    ctx.font = '12px "Press Start 2P"';
    ctx.fillText('!', screenX + 8, screenY - 6);
  }
}

function desenharIluminacaoEClima() {
  const screenPx = player.x + player.width / 2 - camera.x;
  const screenPy = player.y + player.height / 2 - camera.y;

  // Lanterna focada no jogador
  const gradient = ctx.createRadialGradient(screenPx, screenPy, 40, screenPx, screenPy, 250);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.7, 'rgba(5, 3, 2, 0.7)');
  gradient.addColorStop(1, 'rgba(3, 2, 1, 0.96)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Partículas de poeira
  ctx.fillStyle = 'rgba(255, 180, 100, 0.3)';
  for (let p of particles) {
    const px = p.x - camera.x;
    const py = p.y - camera.y;

    if (px >= 0 && px <= canvas.width && py >= 0 && py <= canvas.height) {
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Pisca de dano
  if (flashDamage > 0) {
    ctx.fillStyle = `rgba(255, 0, 0, ${flashDamage * 0.08})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashDamage--;
  }
}

function desenhar() {
  ctx.fillStyle = '#0b0806';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grelha do mundo (move-se com a câmera)
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

  // Desenhar itens no chão
  for (let item of itemsOnGround) {
    desenharItemChao(item);
  }

  // Desenhar NPCs
  for (let npc of npcs) {
    desenharPersonagemDetalhado(npc.x, npc.y, npc, !npc.isTalking, false, !npc.solved);
  }

  // Desenhar Zumbis
  for (let z of zombies) {
    desenharPersonagemDetalhado(z.x, z.y, z, true, true, false);
  }

  // Desenhar Jogador
  desenharPersonagemDetalhado(player.x, player.y, player, player.isMoving, false, false);

  // Efeitos visuais
  desenharIluminacaoEClima();
}