let playerName = "Jogador";
let health = 100;
let canvas, ctx;
let activeNPC = null;
let animFrame = 0;

// Jogador com animação e sprite de boneco
const player = {
  x: 280,
  y: 180,
  width: 20,
  height: 28,
  speed: 2.5,
  skinColor: '#00f3ff',
  shirtColor: '#ff0055',
  isMoving: false
};

const keys = {};

// Cidadãos que andam sozinhos pelo mapa
const npcs = [
  {
    id: 1,
    name: "Cidadão Pedro",
    x: 100,
    y: 100,
    width: 20,
    height: 28,
    skinColor: '#ffe600',
    shirtColor: '#9900ff',
    vx: 1,
    vy: 0,
    moveTimer: 0,
    dialog: "Estou com muita pressa para ir ao trabalho. Devo ir de carro individual ou pegar a bicicleta?",
    options: [
      { text: "Vai de bicicleta! Ajuda o trânsito e reduz o CO2.", healthChange: 10, response: "Boa ideia! Vou pedalando hoje." },
      { text: "Vai de carro para economizar tempo.", healthChange: -15, response: "Vou de carro então, mas sei que polui..." }
    ],
    solved: false
  },
  {
    id: 2,
    name: "Moradora Ana",
    x: 450,
    y: 120,
    width: 20,
    height: 28,
    skinColor: '#ff0055',
    shirtColor: '#00ff88',
    vx: 0,
    vy: 1,
    moveTimer: 0,
    dialog: "Sobrou bastante óleo de fritura. Estava pensando em despejar na pia da cozinha.",
    options: [
      { text: "Não faça isso! Guarde numa garrafa PET e leve à reciclagem.", healthChange: 15, response: "Verdade, 1 litro de óleo contamina muita água!" },
      { text: "Pode jogar, é mais prático.", healthChange: -20, response: "Espero que não entupa o cano da cidade..." }
    ],
    solved: false
  },
  {
    id: 3,
    name: "Estudante Lucas",
    x: 250,
    y: 280,
    width: 20,
    height: 28,
    skinColor: '#00ff88',
    shirtColor: '#ffe600',
    vx: -1,
    vy: 0,
    moveTimer: 0,
    dialog: "Tenho várias garrafas plásticas vazias. Devo jogar no lixo comum ou buscar um ponto de coleta?",
    options: [
      { text: "Usa a coleta seletiva da escola!", healthChange: 10, response: "Excelente! Vou levar para a lixeira reciclável." },
      { text: "Joga no lixo comum mesmo.", healthChange: -10, response: "Que pena, vai direto para o aterro sanitário." }
    ],
    solved: false
  }
];

function iniciarJogo() {
  const inputName = document.getElementById('player-name-input').value.trim();
  if (inputName !== "") playerName = inputName;

  document.getElementById('display-player-name').innerText = playerName;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';

  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  window.addEventListener('keydown', e => { 
    keys[e.key.toLowerCase()] = true; 
    if (['e', ' '].includes(e.key.toLowerCase()) && activeNPC && document.getElementById('dialog-box').style.display === 'none') {
      abrirDialogo(activeNPC);
    }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  requestAnimationFrame(gameLoop);
}

function gameLoop() {
  animFrame++;
  atualizarJogador();
  atualizarNPCs();
  verificarProximidadeNPC();
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
    npc.moveTimer++;
    // Muda de direção aleatoriamente de tempos a tempos
    if (npc.moveTimer > 80 + Math.random() * 50) {
      npc.moveTimer = 0;
      const dirs = [[1,0], [-1,0], [0,1], [0,-1], [0,0]];
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      npc.vx = d[0];
      npc.vy = d[1];
    }

    // Movimento com colisão nas bordas
    if (npc.x + npc.vx * 0.8 > 0 && npc.x + npc.vx * 0.8 < canvas.width - npc.width) npc.x += npc.vx * 0.8;
    else npc.vx *= -1;

    if (npc.y + npc.vy * 0.8 > 0 && npc.y + npc.vy * 0.8 < canvas.height - npc.height) npc.y += npc.vy * 0.8;
    else npc.vy *= -1;
  }
}

function verificarProximidadeNPC() {
  let pertoDeAlgum = false;
  activeNPC = null;

  for (let npc of npcs) {
    const dist = Math.hypot((player.x + player.width/2) - (npc.x + npc.width/2), (player.y + player.height/2) - (npc.y + npc.height/2));
    if (dist < 45 && !npc.solved) {
      pertoDeAlgum = true;
      activeNPC = npc;
      break;
    }
  }

  const prompt = document.getElementById('interaction-prompt');
  prompt.style.display = pertoDeAlgum ? 'block' : 'none';
}

function abrirDialogo(npc) {
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
  health = Math.max(0, Math.min(100, health + opcao.healthChange));
  document.getElementById('health-val').innerText = health + '%';
  npc.solved = true;

  document.getElementById('npc-text').innerText = `${opcao.response}`;
  document.getElementById('dialog-options').innerHTML = `
    <button class="btn-oasis" onclick="fecharDialogo()">Continuar a explorar</button>
  `;
}

function fecharDialogo() {
  document.getElementById('dialog-box').style.display = 'none';
}

// Desenha bonecos animados em pixel art
function desenharBoneco(x, y, width, height, skinColor, shirtColor, isMoving, isNPC = false) {
  const legOffset = isMoving ? Math.sin(animFrame * 0.2) * 3 : 0;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + width/2, y + height - 2, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pernas
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 3, y + 18, 5, 8 + legOffset);
  ctx.fillRect(x + 12, y + 18, 5, 8 - legOffset);

  // Camisa / Corpo
  ctx.fillStyle = shirtColor;
  ctx.fillRect(x + 2, y + 8, 16, 10);

  // Cabeça
  ctx.fillStyle = skinColor;
  ctx.fillRect(x + 3, y, 14, 9);

  // Olhos
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 5, y + 3, 3, 3);
  ctx.fillRect(x + 12, y + 3, 3, 3);

  // Efeito de destaque para NPCs com missão
  if (isNPC) {
    ctx.fillStyle = '#ffe600';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText('!', x + 7, y - 5);
  }
}

function desenhar() {
  ctx.fillStyle = '#050a14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grelha do chão
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 30) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // Desenhar NPCs
  for (let npc of npcs) {
    const isMoving = npc.vx !== 0 || npc.vy !== 0;
    desenharBoneco(npc.x, npc.y, npc.width, npc.height, npc.skinColor, npc.solved ? '#555' : npc.shirtColor, isMoving, !npc.solved);
  }

  // Desenhar Jogador
  desenharBoneco(player.x, player.y, player.width, player.height, player.skinColor, player.shirtColor, player.isMoving);
}