let playerName = "Sobrevivente";
let health = 100;
let supplies = 80;
let canvas, ctx;
let activeNPC = null;
let animFrame = 0;

// Jogador
const player = {
  x: 280,
  y: 180,
  width: 20,
  height: 28,
  speed: 2.3,
  skinColor: '#ffcc99',
  shirtColor: '#333333',
  isMoving: false
};

const keys = {};

// Sobreviventes pelo mapa pós-apocalíptico
const npcs = [
  {
    id: 1,
    name: "Sobrevivente Marcus",
    x: 120,
    y: 100,
    width: 20,
    height: 28,
    skinColor: '#d2b48c',
    shirtColor: '#553311',
    vx: 1,
    vy: 0,
    moveTimer: 0,
    dialog: "Encontrei a última fonte de água não contaminada da região, mas o meu grupo está fraco. Se partilharmos com todos, a água acaba em dois dias.",
    options: [
      { text: "Racionar rigorosamente entre todos os habitantes.", healthChange: -10, suppliesChange: 15, response: "Vai ser difícil, mas pelo menos todos têm uma hipótese de sobreviver." },
      { text: "Guardar a água apenas para o teu grupo prioritário.", healthChange: 15, suppliesChange: -20, response: "O teu grupo sobreviveu, mas os outros ficaram desidratados..." }
    ],
    solved: false
  },
  {
    id: 2,
    name: "Doutora Elena",
    x: 440,
    y: 140,
    width: 20,
    height: 28,
    skinColor: '#ffdbac',
    shirtColor: '#882222',
    vx: 0,
    vy: 1,
    moveTimer: 0,
    dialog: "Uma tempestade ácida aproxima-se. Temos apenas um abrigo blindado com capacidade limitada. Quem devemos priorizar?",
    options: [
      { text: "Priorizar crianças e os doentes.", healthChange: 10, suppliesChange: -15, response: "Garantiste o futuro, mas consumiste muitos recursos de emergência." },
      { text: "Priorizar os trabalhadores que mantêm os geradores.", healthChange: -15, suppliesChange: 20, response: "A energia da base manteve-se estável, mas a moral caiu drasticamente." }
    ],
    solved: false
  },
  {
    id: 3,
    name: "Saqueador Arlo",
    x: 220,
    y: 290,
    width: 20,
    height: 28,
    skinColor: '#8d5524',
    shirtColor: '#444444',
    vx: -1,
    vy: 0,
    moveTimer: 0,
    dialog: "Achei um depósito de mantimentos antigo num edifício prestes a ruir. Posso tentar entrar solto ou pedimos ajuda à equipa?",
    options: [
      { text: "Organizar um resgate seguro em equipa.", healthChange: 15, suppliesChange: 10, response: "Conseguiram recuperar os mantimentos sem vítimas!" },
      { text: "Ir sozinho rapidamente antes que desmorone.", healthChange: -25, suppliesChange: -10, response: "O teto cedeu parcialmente! O Arlo ficou ferido." }
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
    if (npc.moveTimer > 70 + Math.random() * 40) {
      npc.moveTimer = 0;
      const dirs = [[1,0], [-1,0], [0,1], [0,-1], [0,0]];
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      npc.vx = d[0];
      npc.vy = d[1];
    }

    if (npc.x + npc.vx * 0.7 > 0 && npc.x + npc.vx * 0.7 < canvas.width - npc.width) npc.x += npc.vx * 0.7;
    else npc.vx *= -1;

    if (npc.y + npc.vy * 0.7 > 0 && npc.y + npc.vy * 0.7 < canvas.height - npc.height) npc.y += npc.vy * 0.7;
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
  supplies = Math.max(0, Math.min(100, supplies + opcao.suppliesChange));

  document.getElementById('health-bar').style.width = health + '%';
  document.getElementById('health-val').innerText = health + '%';

  document.getElementById('supplies-bar').style.width = supplies + '%';
  document.getElementById('supplies-val').innerText = supplies + '%';

  npc.solved = true;

  document.getElementById('npc-text').innerText = `${opcao.response}`;
  document.getElementById('dialog-options').innerHTML = `
    <button class="btn-oasis" onclick="fecharDialogo()">Continuar exploração</button>
  `;
}

function fecharDialogo() {
  document.getElementById('dialog-box').style.display = 'none';
}

function desenharBoneco(x, y, width, height, skinColor, shirtColor, isMoving, isNPC = false) {
  const legOffset = isMoving ? Math.sin(animFrame * 0.2) * 3 : 0;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(x + width/2, y + height - 2, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pernas
  ctx.fillStyle = '#111';
  ctx.fillRect(x + 3, y + 18, 5, 8 + legOffset);
  ctx.fillRect(x + 12, y + 18, 5, 8 - legOffset);

  // Roupa de Sobrevivente
  ctx.fillStyle = shirtColor;
  ctx.fillRect(x + 2, y + 8, 16, 10);

  // Cabeça
  ctx.fillStyle = skinColor;
  ctx.fillRect(x + 3, y, 14, 9);

  // Olhos
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 5, y + 3, 3, 3);
  ctx.fillRect(x + 12, y + 3, 3, 3);

  // Indicador de PNJ
  if (isNPC) {
    ctx.fillStyle = '#ffcc00';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText('!', x + 7, y - 5);
  }
}

function desenharCenarioDevastado() {
  // Solo Árido
  ctx.fillStyle = '#261b13';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Rachaduras do solo
  ctx.strokeStyle = 'rgba(60, 40, 25, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 80); ctx.lineTo(120, 150); ctx.lineTo(90, 220);
  ctx.moveTo(350, 40); ctx.lineTo(400, 180); ctx.lineTo(520, 200);
  ctx.moveTo(200, 300); ctx.lineTo(280, 370);
  ctx.stroke();

  // Árvores Secas / Mortas
  const arvoresMortas = [{x: 80, y: 50}, {x: 520, y: 80}, {x: 150, y: 320}, {x: 480, y: 310}];
  for (let a of arvoresMortas) {
    ctx.strokeStyle = '#150d09';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + 20); ctx.lineTo(a.x, a.y);
    ctx.lineTo(a.x - 10, a.y - 12);
    ctx.moveTo(a.x, a.y - 5); ctx.lineTo(a.x + 10, a.y - 15);
    ctx.stroke();
  }

  // Poça Tóxica
  ctx.fillStyle = 'rgba(0, 255, 100, 0.25)';
  ctx.beginPath();
  ctx.ellipse(320, 200, 40, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#00ff66';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function desenhar() {
  desenharCenarioDevastado();

  // Desenhar NPCs
  for (let npc of npcs) {
    const isMoving = npc.vx !== 0 || npc.vy !== 0;
    desenharBoneco(npc.x, npc.y, npc.width, npc.height, npc.skinColor, npc.solved ? '#444' : npc.shirtColor, isMoving, !npc.solved);
  }

  // Desenhar Jogador
  desenharBoneco(player.x, player.y, player.width, player.height, player.skinColor, player.shirtColor, player.isMoving);
}