let canvas, ctx;
let playerName = "Sobrevivente";
let lifeYears = 42;
let supplies = 80;
let activeNPC = null;
let inDialog = false;
let animFrame = 0;

// Configuração do Jogador
const player = {
  x: 300,
  y: 300,
  width: 22,
  height: 30,
  speed: 3,
  skinColor: '#ffcc99',
  shirtColor: '#224466',
  isMoving: false
};

const keys = {};

// Sobreviventes (NPCs)
const npcs = [
  {
    id: 1,
    name: "Marcus (Sobrevivente)",
    x: 200,
    y: 150,
    width: 22,
    height: 30,
    skinColor: '#d2b48c',
    shirtColor: '#664422',
    vx: 1,
    vy: 0,
    moveTimer: 0,
    isTalking: false,
    dialog: "Encontrei uma reserva de suprimentos médicos no setor norte. Se partilharmos com o acampamento, reduzimos a nossa racionização pessoal.",
    options: [
      { text: "Entregar tudo ao acampamento (+Suprimentos / -3 Anos de Vida por desgaste)", years: -3, supp: 20, resp: "O acampamento agradeceu, mas estás exausto." },
      { text: "Guardar os remédios para uso pessoal (+5 Anos de Vida / -Suprimentos)", years: 5, supp: -10, resp: "Garantiste a tua longevidade, mas a comunidade ficou desprotegida." }
    ],
    solved: false
  },
  {
    id: 2,
    name: "Doutora Elena",
    x: 600,
    y: 400,
    width: 22,
    height: 30,
    skinColor: '#ffdbac',
    shirtColor: '#882222',
    vx: -1,
    vy: 0,
    moveTimer: 0,
    isTalking: false,
    dialog: "Uma horda de zumbis aproxima-se dos filtros de ar da base. Precisamos de decidir se ativamos as barreiras elétricas ou evacuamos.",
    options: [
      { text: "Ativar barreiras elétricas (-25% Suprimentos de energia)", years: 2, supp: -25, resp: "Os filtros continuam seguros!" },
      { text: "Fazer evacuação rápida (-8 Anos de Vida devido ao ar tóxico)", years: -8, supp: 10, resp: "Escaparam, mas a inalação de toxinas encurtou a tua vida." }
    ],
    solved: false
  }
];

// Inimigos (Zumbis)
const zombies = [
  { x: 400, y: 100, width: 22, height: 30, vx: 0.8, vy: 0.5 },
  { x: 700, y: 250, width: 22, height: 30, vx: -0.6, vy: 0.8 },
  { x: 150, y: 500, width: 22, height: 30, vx: 0.5, vy: -0.7 }
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
    verificarProximidade();
    verificarAtaqueZumbi();
  }

  desenhar();
  requestAnimationFrame(gameLoop);
}

function atualizarJogador() {
  player.isMoving = false;
  if (keys['w'] || keys['arrowup']) { if (player.y > 0) player.y -= player.speed; player.isMoving = true; }
  if (keys['s'] || keys['arrowdown']) { if (player.y < canvas.height - player.height) player.y += player.speed; player.isMoving = true; }
  if (keys['a'] || keys['arrowleft']) { if (player.x > 0) player.x -= player.speed; player.isMoving = true; }
  if (keys['d'] || keys['arrowright']) { if (player.x < canvas.width - player.width) player.x += player.speed; player.isMoving = true; }
}

function atualizarNPCs() {
  for (let npc of npcs) {
    // Se estiver a falar, o NPC para totalmente!
    if (npc.isTalking) continue;

    npc.moveTimer++;
    if (npc.moveTimer > 60 + Math.random() * 40) {
      npc.moveTimer = 0;
      const dirs = [[1,0], [-1,0], [0,1], [0,-1], [0,0]];
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      npc.vx = d[0];
      npc.vy = d[1];
    }

    if (npc.x + npc.vx > 0 && npc.x + npc.vx < canvas.width - npc.width) npc.x += npc.vx * 0.7;
    else npc.vx *= -1;

    if (npc.y + npc.vy > 0 && npc.y + npc.vy < canvas.height - npc.height) npc.y += npc.vy * 0.7;
    else npc.vy *= -1;
  }
}

function atualizarZumbis() {
  for (let z of zombies) {
    z.x += z.vx;
    z.y += z.vy;

    if (z.x < 0 || z.x > canvas.width - z.width) z.vx *= -1;
    if (z.y < 0 || z.y > canvas.height - z.height) z.vy *= -1;
  }
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
    if (dist < 25) {
      lifeYears = Math.max(0, lifeYears - 1);
      document.getElementById('life-span').innerText = lifeYears + ' Anos';
    }
  }
}

function abrirDialogo(npc) {
  inDialog = true;
  npc.isTalking = true; // O NPC para de andar durante a conversa!
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
}

function fecharDialogo() {
  if (activeNPC) activeNPC.isTalking = false; // O NPC volta a andar após a escolha!
  inDialog = false;
  document.getElementById('dialog-box').style.display = 'none';
}

function desenharCharacter(x, y, color, isMoving, isZombie = false, isNPC = false) {
  const legOffset = isMoving ? Math.sin(animFrame * 0.2) * 3 : 0;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x + 11, y + 28, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pernas
  ctx.fillStyle = '#111';
  ctx.fillRect(x + 4, y + 20, 5, 8 + legOffset);
  ctx.fillRect(x + 13, y + 20, 5, 8 - legOffset);

  // Corpo
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 9, 18, 12);

  // Cabeça
  ctx.fillStyle = isZombie ? '#446633' : '#ffcc99';
  ctx.fillRect(x + 4, y, 14, 10);

  // Olhos
  ctx.fillStyle = isZombie ? '#ff0000' : '#000';
  ctx.fillRect(x + 6, y + 4, 3, 3);
  ctx.fillRect(x + 13, y + 4, 3, 3);

  // Destaque para NPCs com missão
  if (isNPC) {
    ctx.fillStyle = '#ffcc00';
    ctx.font = '12px "Press Start 2P"';
    ctx.fillText('!', x + 7, y - 6);
  }
}

function desenhar() {
  ctx.fillStyle = '#110b08';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grelha de ruínas
  ctx.strokeStyle = 'rgba(255, 85, 0, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // Desenhar NPCs (Sobreviventes)
  for (let npc of npcs) {
    desenharCharacter(npc.x, npc.y, npc.solved ? '#444' : npc.shirtColor, !npc.isTalking, false, !npc.solved);
  }

  // Desenhar Zumbis
  for (let z of zombies) {
    desenharCharacter(z.x, z.y, '#2d4422', true, true, false);
  }

  // Desenhar Jogador
  desenharCharacter(player.x, player.y, player.shirtColor, player.isMoving, false, false);
}