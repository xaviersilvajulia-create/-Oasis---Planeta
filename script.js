let playerName = "Jogador";
let health = 100;
let canvas, ctx;
let activeNPC = null;

// Objeto do Jogador
const player = {
  x: 280,
  y: 180,
  size: 20,
  speed: 3,
  color: '#00f3ff'
};

// Teclas pressionadas
const keys = {};

// Lista de Habitantes/NPCs pelo mapa
const npcs = [
  {
    id: 1,
    name: "Cidadão Pedro",
    x: 100,
    y: 100,
    size: 20,
    color: '#ffe600',
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
    size: 20,
    color: '#ff0055',
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
    y: 300,
    size: 20,
    color: '#00ff88',
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

  // Eventos do Teclado
  window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  requestAnimationFrame(gameLoop);
}

function gameLoop() {
  atualizarMovimento();
  verificarProximidadeNPC();
  desenhar();
  requestAnimationFrame(gameLoop);
}

function atualizarMovimento() {
  if (keys['w'] || keys['arrowup']) if (player.y > 0) player.y -= player.speed;
  if (keys['s'] || keys['arrowdown']) if (player.y < canvas.height - player.size) player.y += player.speed;
  if (keys['a'] || keys['arrowleft']) if (player.x > 0) player.x -= player.speed;
  if (keys['d'] || keys['arrowright']) if (player.x < canvas.width - player.size) player.x += player.speed;
}

function verificarProximidadeNPC() {
  let pertoDeAlgum = false;
  activeNPC = null;

  for (let npc of npcs) {
    const dist = Math.hypot((player.x + player.size/2) - (npc.x + npc.size/2), (player.y + player.size/2) - (npc.y + npc.size/2));
    if (dist < 40 && !npc.solved) {
      pertoDeAlgum = true;
      activeNPC = npc;
      break;
    }
  }

  const prompt = document.getElementById('interaction-prompt');
  if (pertoDeAlgum) {
    prompt.style.display = 'block';
    if (keys['e'] || keys[' ']) {
      abrirDialogo(activeNPC);
    }
  } else {
    prompt.style.display = 'none';
  }
}

function abrirDialogo(npc) {
  document.getElementById('dialog-box').style.display = 'block';
  document.getElementById('npc-name').innerText = npc.name;
  document.getElementById('npc-text').innerText = npc.dialog;

  const grid = document.getElementById('dialog-options');
  grid.innerHTML = '';

  npc.options.forEach((opt, index) => {
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

function desenhar() {
  // Limpar fundo
  ctx.fillStyle = '#050a14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Desenhar grelha Cyberpunk
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
    ctx.fillStyle = npc.solved ? '#555555' : npc.color;
    ctx.fillRect(npc.x, npc.y, npc.size, npc.size);

    // Efeito de brilho em NPCs ativos
    if (!npc.solved) {
      ctx.shadowColor = npc.color;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(npc.x, npc.y, npc.size, npc.size);
      ctx.shadowBlur = 0;
    }
  }

  // Desenhar Jogador
  ctx.fillStyle = player.color;
  ctx.shadowColor = player.color;
  ctx.shadowBlur = 12;
  ctx.fillRect(player.x, player.y, player.size, player.size);
  ctx.shadowBlur = 0;
}