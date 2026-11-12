let canvas, ctx, miniCanvas, miniCtx;
let playerName = "Sobrevivente";
let lifeYears = 35;
let hunger = 100;
let thirst = 100;
let stamina = 100;
let flaresCount = 2;
let flashlightOn = true;

let activeNPC = null;
let activeItem = null;
let activeShip = null;
let inDialog = false;
let animFrame = 0;
let agingTimer = 0;
let hungerThirstTimer = 0;
let flashDamage = 0;
let screenShake = 0;
let isGameOver = false;
let isVictory = false;
let isLaunching = false;
let playerBoardedShip = false;
let shipLiftOffset = 0;
let liftParticles = [];
let acidProjectiles = [];
let acidPuddles = [];
let activeFlares = [];
let footprints = [];
let ashParticles = [];

// ==========================================
// CONTROLE DA CENA DE INTRODUÇÃO (10 SEGUNDOS)
// ==========================================
let inIntro = false;
let introTimer = 0;
const INTRO_DURATION = 600; // 10 segundos a 60 FPS
let introShipAltitude = 360;

// ==========================================
// SISTEMA DE ÁUDIO E TRILHA DE TENSÃO (WEB AUDIO API)
// ==========================================
let audioCtx = null;
let audioEnabled = true;
let masterGain = null;
let droneOsc1 = null;
let droneOsc2 = null;
let droneGain = null;
let engineOsc = null;
let engineGain = null;
let tensionMusicTimer = 0;
let tensionNoteIndex = 0;
let heartbeatTimer = 0;
let stepSoundTimer = 0;
let isBeingChased = false;

const TENSION_NOTES = [110.00, 116.54, 130.81, 116.54, 103.83, 110.00, 82.41, 98.00];

function garantirAudioAtivo() {
  if (!audioCtx) {
    iniciarAudio();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function iniciarAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = audioEnabled ? 0.85 : 0;
  masterGain.connect(audioCtx.destination);

  droneOsc1 = audioCtx.createOscillator();
  droneOsc2 = audioCtx.createOscillator();
  droneGain = audioCtx.createGain();

  droneOsc1.type = 'sawtooth';
  droneOsc1.frequency.value = 110;

  droneOsc2.type = 'triangle';
  droneOsc2.frequency.value = 111.8;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;

  droneGain.gain.value = 0.14;

  droneOsc1.connect(filter);
  droneOsc2.connect(filter);
  filter.connect(droneGain);
  droneGain.connect(masterGain);

  droneOsc1.start();
  droneOsc2.start();

  engineOsc = audioCtx.createOscillator();
  engineGain = audioCtx.createGain();
  const engineFilter = audioCtx.createBiquadFilter();

  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 90;
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 450;
  engineGain.gain.value = 0;

  engineOsc.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(masterGain);
  engineOsc.start();
}

function alternarAudio() {
  garantirAudioAtivo();
  audioEnabled = !audioEnabled;
  const btn = document.getElementById('audio-toggle');
  if (btn) btn.innerText = audioEnabled ? 'SOM: ON' : 'SOM: OFF';

  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(audioEnabled ? 0.85 : 0, audioCtx.currentTime, 0.05);
  }
}

function atualizarMusicaDeTensao() {
  if (!audioEnabled || !audioCtx || !masterGain) return;
  if (audioCtx.state === 'suspended') return;

  const ritmo = (isBeingChased || isLaunching) ? 24 : (lifeYears <= 12 ? 32 : 48);
  tensionMusicTimer++;

  if (tensionMusicTimer >= ritmo) {
    tensionMusicTimer = 0;
    const freq = TENSION_NOTES[tensionNoteIndex % TENSION_NOTES.length];
    tensionNoteIndex++;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const subOsc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const noteGain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq * 2, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isBeingChased ? 750 : 420, now);

    const vol = isBeingChased ? 0.16 : 0.10;
    noteGain.gain.setValueAtTime(0.001, now);
    noteGain.gain.linearRampToValueAtTime(vol, now + 0.04);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(masterGain);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.58);
    subOsc.stop(now + 0.58);
  }
}

function atualizarSomMotorNave(ativo, progresso) {
  if (!audioCtx || !engineGain || !engineOsc) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const now = audioCtx.currentTime;
  if (ativo && audioEnabled) {
    const freq = 95 + (progresso * 2.2);
    const vol = Math.min(0.32, 0.14 + (progresso / 100) * 0.18);
    engineOsc.frequency.setTargetAtTime(freq, now, 0.08);
    engineGain.gain.setTargetAtTime(vol, now, 0.08);
  } else {
    engineGain.gain.setTargetAtTime(0, now, 0.1);
  }
}

function tocarEfeitoSonoro(tipo) {
  if (!audioEnabled) return;
  garantirAudioAtivo();
  if (!audioCtx || !masterGain) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(masterGain);

  const now = audioCtx.currentTime;

  if (tipo === 'step') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.055);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (tipo === 'heartbeat') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.2);
    gain.gain.setValueAtTime(0.34, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.22);
  } else if (tipo === 'brute_roar') {
    // Rugido grave e pesado do Brutamonte
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.55);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    osc.start(now);
    osc.stop(now + 0.58);
  } else if (tipo === 'brute_step') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.15);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.16);
  } else if (tipo === 'stalker_screech') {
    // Guincho agudo do Perseguidor
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(310, now + 0.34);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.start(now);
    osc.stop(now + 0.36);
  } else if (tipo === 'acid_spit') {
    // Chiado borbulhante do Cuspidor Ácido
    osc.type = 'square';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.22);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.start(now);
    osc.stop(now + 0.24);
  } else if (tipo === 'flare') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.linearRampToValueAtTime(780, now + 0.25);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.start(now);
    osc.stop(now + 0.28);
  } else if (tipo === 'flashlight') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(700, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (tipo === 'radio_beep') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(960, now);
    osc.frequency.setValueAtTime(1240, now + 0.06);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.start(now);
    osc.stop(now + 0.14);
  } else if (tipo === 'crash_land') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.7);
    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc.start(now);
    osc.stop(now + 0.75);
  } else if (tipo === 'item') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(783.99, now + 0.09);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.start(now);
    osc.stop(now + 0.28);
  } else if (tipo === 'ship_part') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.09);
    osc.frequency.setValueAtTime(659.25, now + 0.18);
    osc.frequency.setValueAtTime(880, now + 0.27);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.start(now);
    osc.stop(now + 0.45);
  } else if (tipo === 'launch_alarm') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.07);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.start(now);
    osc.stop(now + 0.14);
  } else if (tipo === 'board_hatch') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.25);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.start(now);
    osc.stop(now + 0.28);
  } else if (tipo === 'damage') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.linearRampToValueAtTime(85, now + 0.28);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (tipo === 'tick_year') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, now);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (tipo === 'liftoff') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 2.2);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
    osc.start(now);
    osc.stop(now + 2.4);
  }
}

// ==========================================
// CÂMERA, JOGADOR E NAVE
// ==========================================
const camera = { x: 0, y: 0 };

const player = {
  x: 1200,
  y: 900,
  width: 26,
  height: 40,
  baseSpeed: 3.4,
  speed: 3.4,
  skinColor: '#ffdbac',
  shirtColor: '#2563eb',
  pantsColor: '#28362b',
  hairColor: '#1f1610',
  hasBackpack: true,
  facing: 1,
  aimAngle: 0,
  isMoving: false,
  isSprinting: false
};

const keys = {};

const escapeShip = {
  x: 1165,
  y: 720,
  width: 96,
  height: 110,
  progress: 0,
  launched: false,
  name: "Cápsula Orbital Aurora"
};

const buildings = [
  {
    x: 240, y: 1460, w: 185, h: 160,
    doorSide: 'bottom', doorPos: 65, doorWidth: 42,
    type: 'clinic', title: 'POSTO MÉDICO', onFire: true
  },
  {
    x: 1640, y: 1960, w: 195, h: 165,
    doorSide: 'top', doorPos: 68, doorWidth: 44,
    type: 'warehouse', title: 'DEPÓSITO SUL', onFire: true
  },
  {
    x: 2380, y: 680, w: 190, h: 160,
    doorSide: 'left', doorPos: 52, doorWidth: 42,
    type: 'clinic', title: 'LABORATÓRIO LESTE', onFire: true
  }
];

const wreckedCars = [
  { x: 1330, y: 840, w: 72, h: 36, color: '#5c2b24', onFire: true, dir: 1 },
  { x: 760, y: 1120, w: 72, h: 36, color: '#39424a', onFire: false, dir: -1 },
  { x: 1780, y: 860, w: 72, h: 36, color: '#3d454d', onFire: true, dir: -1 }
];

const itemsOnGround = [
  { id: 101, x: 268, y: 1495, type: 'ship_part', partShape: 'suit', label: 'Traje Criogênico', years: 4, hunger: 0, thirst: 0, collected: false, revealedOnRadar: false },
  { id: 102, x: 2535, y: 805, type: 'ship_part', partShape: 'chip', label: 'Chip de Navegação', years: 4, hunger: 0, thirst: 0, collected: false, revealedOnRadar: false },
  { id: 103, x: 1800, y: 2090, type: 'ship_part', partShape: 'fuel', label: 'Núcleo de Combustível', years: 4, hunger: 0, thirst: 0, collected: false, revealedOnRadar: false },

  { id: 1, x: 1120, y: 950, type: 'water', label: 'Garrafa de Água', years: 2, hunger: 0, thirst: 45, collected: false },
  { id: 2, x: 1860, y: 810, type: 'water', label: 'Cantil de Água Pura', years: 2, hunger: 0, thirst: 50, collected: false },
  { id: 3, x: 1420, y: 1620, type: 'water', label: 'Galão de Água', years: 2, hunger: 0, thirst: 50, collected: false },

  { id: 4, x: 640, y: 1220, type: 'food', label: 'Ração Enlatada', years: 2, hunger: 45, thirst: 0, collected: false },
  { id: 5, x: 1660, y: 1420, type: 'food', label: 'Pacote de Biscoitos', years: 2, hunger: 50, thirst: 0, collected: false },
  { id: 6, x: 2020, y: 980, type: 'food', label: 'Conserva Nutritiva', years: 2, hunger: 50, thirst: 0, collected: false },

  // Sinalizadores extras pelo mapa
  { id: 7, x: 1020, y: 1260, type: 'flare', label: 'Sinalizador Tático (+1)', years: 1, hunger: 0, thirst: 0, collected: false },
  { id: 8, x: 1750, y: 1180, type: 'flare', label: 'Sinalizador Tático (+1)', years: 1, hunger: 0, thirst: 0, collected: false }
];

const npcs = [
  {
    id: 1,
    name: "Marcus (Engenheiro)",
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
    dialog: "Use [Q] para jogar sinalizadores e distrair os monstros! Eu sei onde esconderam o Combustível e o Chip da nave Aurora. Qual pista você precisa?",
    options: [
      {
        text: "Onde posso achar o Galão de Combustível?",
        years: 2, hunger: 0, thirst: 0,
        revealPartId: 103,
        resp: "DICA DO MARCUS: Siga bem para o SUL até o DEPÓSITO SUL (cuidado com o Brutamonte!). O galão vermelho de combustível está no canto interno direito. Marquei no radar!"
      },
      {
        text: "Onde está o Chip de Navegação?",
        years: 2, hunger: 0, thirst: 0,
        revealPartId: 102,
        resp: "DICA DO MARCUS: Vá direto para o LESTE até o LABORATÓRIO LESTE. Entre pela porta esquerda e procure no fundo da sala! Marquei no radar."
      },
      {
        text: "Preciso de água e comida para a busca.",
        years: 2, hunger: 35, thirst: 35,
        revealPartId: null,
        resp: "Tome aqui! Se precisar das dicas de onde estão as peças, pode falar comigo de novo."
      }
    ],
    solved: false
  },
  {
    id: 2,
    name: "Doutora Elena",
    x: 680,
    y: 1280,
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
    dialog: "Os monstros estão rondando as ruínas! Eu vi onde guardaram o Traje Criogênico e também sei onde está o Combustível.",
    options: [
      {
        text: "Onde posso encontrar o Traje Criogênico?",
        years: 3, hunger: 0, thirst: 0,
        revealPartId: 101,
        resp: "DICA DA ELENA: Siga mais para SUDOESTE até o POSTO MÉDICO. Entre pela porta de baixo e olhe no canto superior esquerdo! Marquei no radar."
      },
      {
        text: "Você sabe onde fica o Combustível?",
        years: 2, hunger: 0, thirst: 0,
        revealPartId: 103,
        resp: "DICA DA ELENA: O galão de combustível foi levado para o DEPÓSITO SUL, bem longe ao sudeste da nave! Marquei a direção no seu radar."
      },
      {
        text: "Aplicar soro hidratante para correr mais rápido.",
        years: 3, hunger: 20, thirst: 45,
        revealPartId: null,
        resp: "Hidratação restaurada! Fale comigo novamente se quiser dicas da localização das peças."
      }
    ],
    solved: false
  }
];

const zombies = [
  { x: 1650, y: 880, width: 26, height: 40, speed: 1.05, vx: 0, vy: 0, facing: -1, patrolTimer: 0, isMoving: false },
  { x: 820, y: 1120, width: 26, height: 40, speed: 0.98, vx: 0, vy: 0, facing: 1, patrolTimer: 0, isMoving: false },
  { x: 1450, y: 1660, width: 26, height: 40, speed: 1.02, vx: 0, vy: 0, facing: 1, patrolTimer: 0, isMoving: false },
  { x: 480, y: 1180, width: 26, height: 40, speed: 0.95, vx: 0, vy: 0, facing: 1, patrolTimer: 0, isMoving: false },
  { x: 2060, y: 840, width: 26, height: 40, speed: 1.08, vx: 0, vy: 0, facing: -1, patrolTimer: 0, isMoving: false }
];

const monsters = [
  {
    name: 'Brutamonte',
    kind: 'brute',
    x: 1580, y: 1850,
    width: 38, height: 52,
    speed: 0.85,
    damage: 4,
    detectRadius: 430,
    vx: 0, vy: 0, facing: -1,
    patrolTimer: 0, isMoving: false, wasChasing: false, attackCooldown: 0
  },
  {
    name: 'Brutamonte',
    kind: 'brute',
    x: 340, y: 1650,
    width: 38, height: 52,
    speed: 0.85,
    damage: 4,
    detectRadius: 430,
    vx: 0, vy: 0, facing: 1,
    patrolTimer: 0, isMoving: false, wasChasing: false, attackCooldown: 0
  },
  {
    name: 'Perseguidor',
    kind: 'stalker',
    x: 2180, y: 760,
    width: 30, height: 44,
    speed: 1.88,
    damage: 3,
    detectRadius: 540,
    vx: 0, vy: 0, facing: -1,
    patrolTimer: 0, isMoving: false, wasChasing: false, attackCooldown: 0
  },
  {
    name: 'Perseguidor',
    kind: 'stalker',
    x: 960, y: 1380,
    width: 30, height: 44,
    speed: 1.85,
    damage: 3,
    detectRadius: 520,
    vx: 0, vy: 0, facing: 1,
    patrolTimer: 0, isMoving: false, wasChasing: false, attackCooldown: 0
  },
  {
    name: 'Cuspidor Ácido',
    kind: 'spitter',
    x: 1480, y: 1120,
    width: 30, height: 44,
    speed: 0.95,
    damage: 2,
    detectRadius: 490,
    vx: 0, vy: 0, facing: -1,
    patrolTimer: 0, isMoving: false, wasChasing: false, attackCooldown: 90
  },
  {
    name: 'Cuspidor Ácido',
    kind: 'spitter',
    x: 1920, y: 1480,
    width: 30, height: 44,
    speed: 0.95,
    damage: 2,
    detectRadius: 490,
    vx: 0, vy: 0, facing: 1,
    patrolTimer: 0, isMoving: false, wasChasing: false, attackCooldown: 90
  }
];

function redimensionarCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function inicializarParticulasCinzas() {
  ashParticles = [];
  for (let i = 0; i < 65; i++) {
    ashParticles.push({
      x: Math.random() * 2000,
      y: Math.random() * 1400,
      vx: -0.4 - Math.random() * 0.7,
      vy: 0.3 + Math.random() * 0.6,
      size: 1.5 + Math.random() * 2.5,
      isEmber: Math.random() > 0.75
    });
  }
}

function iniciarCenaIntroducao() {
  inIntro = true;
  introTimer = 0;
  introShipAltitude = 360;
  document.getElementById('intro-overlay').style.display = 'flex';
  tocarEfeitoSonoro('radio_beep');
}

function pularIntroducao() {
  if (!inIntro) return;
  inIntro = false;
  introShipAltitude = 0;
  document.getElementById('intro-overlay').style.display = 'none';
}

function atualizarCenaIntroducao() {
  introTimer++;
  const remaining = Math.max(0, Math.ceil((INTRO_DURATION - introTimer) / 60));
  document.getElementById('intro-timer').innerText = remaining + 's';

  const sub = document.getElementById('intro-subtitle');

  if (introTimer === 1) {
    sub.innerText = "ALERTA CRÍTICO: Órbita terrestre em colapso. Cápsula Aurora sofrendo falha nos propulsores!";
  } else if (introTimer === 180) {
    tocarEfeitoSonoro('radio_beep');
    sub.innerText = "IMPACTO DETECTADO! As 3 peças essenciais da nave se soltaram e caíram nas construções próximas.";
  } else if (introTimer === 360) {
    tocarEfeitoSonoro('radio_beep');
    sub.innerText = "ATENÇÃO: A radiação temporal está consumindo seus anos de vida e mutantes cercam a região.";
  } else if (introTimer === 480) {
    tocarEfeitoSonoro('radio_beep');
    sub.innerText = "Fale com os sobreviventes para localizar as peças, use [F] para a lanterna e [Q] para sinalizadores!";
  }

  // Descida da nave nos primeiros 3.5 segundos
  if (introShipAltitude > 0) {
    introShipAltitude = Math.max(0, introShipAltitude - 1.8);
    liftParticles.push({
      x: escapeShip.x + escapeShip.width / 2 + (Math.random() - 0.5) * 40,
      y: escapeShip.y + escapeShip.height - introShipAltitude + 6,
      vx: (Math.random() - 0.5) * 3,
      vy: 1.2 + Math.random() * 2,
      life: 30,
      size: 9 + Math.random() * 12
    });
    if (introShipAltitude === 0) {
      screenShake = 18;
      tocarEfeitoSonoro('crash_land');
    }
  }

  for (let p of liftParticles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
  }
  liftParticles = liftParticles.filter(p => p.life > 0);

  // Câmera focada na nave durante a introdução
  camera.x = (escapeShip.x + escapeShip.width / 2) - canvas.width / 2;
  camera.y = (escapeShip.y + escapeShip.height / 2 + 40) - canvas.height / 2;

  if (introTimer >= INTRO_DURATION) {
    pularIntroducao();
  }
}

function lancarSinalizador() {
  if (flaresCount <= 0 || inIntro || inDialog || isGameOver || isVictory || playerBoardedShip) return;
  flaresCount--;
  document.getElementById('flares-val').innerText = flaresCount;

  activeFlares.push({
    x: player.x + player.width / 2 + player.facing * 18,
    y: player.y + player.height - 6,
    life: 420 // 7 segundos atraindo monstros e zumbis
  });

  tocarEfeitoSonoro('flare');
  mostrarPopupItem('SINALIZADOR LANÇADO! Monstros atraídos pela luz.');
}

function alternarLanterna() {
  if (inIntro || inDialog || isGameOver || isVictory) return;
  flashlightOn = !flashlightOn;
  const el = document.getElementById('flashlight-val');
  el.innerText = flashlightOn ? 'LIGADA' : 'DESLIGADA';
  el.style.color = flashlightOn ? '#38bdf8' : '#94a3b8';
  tocarEfeitoSonoro('flashlight');
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
  inicializarParticulasCinzas();
  iniciarCenaIntroducao();

  window.addEventListener('pointerdown', garantirAudioAtivo);

  window.addEventListener('keydown', e => {
    garantirAudioAtivo();
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (k === 'enter' && inIntro) {
      pularIntroducao();
      return;
    }

    if (inIntro) return;

    if (k === 'f') alternarLanterna();
    if (k === 'q') lancarSinalizador();

    if (['e', ' '].includes(k) && !inDialog && !isGameOver && !isVictory && !playerBoardedShip) {
      if (activeNPC) abrirDialogo(activeNPC);
      else if (activeItem) coletarItem(activeItem);
    }
  });

  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  requestAnimationFrame(gameLoop);
}

function reiniciarJogo() {
  garantirAudioAtivo();
  lifeYears = 35;
  hunger = 100;
  thirst = 100;
  stamina = 100;
  flaresCount = 2;
  flashlightOn = true;
  player.x = 1200;
  player.y = 900;
  player.speed = player.baseSpeed;
  agingTimer = 0;
  hungerThirstTimer = 0;
  isGameOver = false;
  isVictory = false;
  isLaunching = false;
  playerBoardedShip = false;
  shipLiftOffset = 0;
  liftParticles = [];
  acidProjectiles = [];
  acidPuddles = [];
  activeFlares = [];
  footprints = [];
  escapeShip.launched = false;
  escapeShip.progress = 0;

  atualizarSomMotorNave(false, 0);
  atualizarHUDStatus();
  document.getElementById('parts-val').innerText = '0/3';
  document.getElementById('flares-val').innerText = flaresCount;
  document.getElementById('flashlight-val').innerText = 'LIGADA';
  document.getElementById('flashlight-val').style.color = '#38bdf8';
  document.getElementById('game-over-screen').style.display = 'none';
  document.getElementById('victory-screen').style.display = 'none';

  itemsOnGround.forEach(i => {
    i.collected = false;
    if (i.type === 'ship_part') i.revealedOnRadar = false;
  });
  npcs.forEach(n => n.solved = false);

  iniciarCenaIntroducao();
  requestAnimationFrame(gameLoop);
}

function atualizarHUDStatus() {
  const elLife = document.getElementById('life-span');
  elLife.innerText = lifeYears + ' Anos';
  elLife.style.color = lifeYears <= 10 ? '#ff0033' : '#ffffff';

  const hVal = Math.round(hunger);
  const tVal = Math.round(thirst);
  const sVal = Math.round(stamina);

  document.getElementById('hunger-text').innerText = hVal + '%';
  document.getElementById('hunger-bar').style.width = hVal + '%';
  document.getElementById('hunger-bar').style.background = hVal <= 30 ? '#ff3333' : '#ff9900';

  document.getElementById('thirst-text').innerText = tVal + '%';
  document.getElementById('thirst-bar').style.width = tVal + '%';
  document.getElementById('thirst-bar').style.background = tVal <= 30 ? '#ff3333' : '#00ccff';

  document.getElementById('stamina-text').innerText = sVal + '%';
  document.getElementById('stamina-bar').style.width = sVal + '%';
  document.getElementById('stamina-bar').style.background = sVal <= 25 ? '#ef4444' : '#22c55e';

  let speedFactor = 1.0;
  if (hunger <= 0 || thirst <= 0) {
    speedFactor = 0.55;
  } else if (hunger <= 30 && thirst <= 30) {
    speedFactor = 0.70;
  } else if (hunger <= 30 || thirst <= 30) {
    speedFactor = 0.82;
  }

  const sprintMultiplier = player.isSprinting ? 1.55 : 1.0;
  player.speed = player.baseSpeed * speedFactor * sprintMultiplier;

  const slowBadge = document.getElementById('status-slow');
  if (slowBadge) {
    slowBadge.style.display = speedFactor < 1.0 ? 'inline-block' : 'none';
  }
}

function gameLoop() {
  if (isGameOver || isVictory) return;

  animFrame++;
  atualizarParticulasAmbiente();

  if (inIntro) {
    atualizarCenaIntroducao();
    atualizarMusicaDeTensao();
    desenhar();
    desenharMinimapa();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (playerBoardedShip) {
    atualizarAnimacaoDecolagem();
    atualizarCamera();
    desenhar();
    desenharMinimapa();
    if (!isVictory) {
      requestAnimationFrame(gameLoop);
    }
    return;
  }

  if (!inDialog) {
    atualizarJogador();
    atualizarFomeSedeETempo();
    atualizarNPCs();
    atualizarSinalizadores();
    atualizarZumbis();
    atualizarMonstros();
    atualizarProjeteisAcido();
    verificarInteracoes();
    atualizarDecolagemNave();
    verificarAtaqueInimigos();
    verificarMorte();
  } else {
    atualizarSomMotorNave(false, 0);
  }

  atualizarMusicaDeTensao();
  atualizarSomTensao();
  atualizarCamera();
  desenhar();
  desenharMinimapa();

  if (!isGameOver && !isVictory) {
    requestAnimationFrame(gameLoop);
  }
}

function atualizarParticulasAmbiente() {
  for (let p of ashParticles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = canvas.width;
    if (p.y > canvas.height) {
      p.y = 0;
      p.x = Math.random() * canvas.width;
    }
  }

  for (let fp of footprints) fp.life--;
  footprints = footprints.filter(fp => fp.life > 0);

  for (let ap of acidPuddles) ap.life--;
  acidPuddles = acidPuddles.filter(ap => ap.life > 0);
}

function atualizarSinalizadores() {
  for (let f of activeFlares) f.life--;
  activeFlares = activeFlares.filter(f => f.life > 0);
}

function atualizarAnimacaoDecolagem() {
  shipLiftOffset += 3.2;

  for (let i = 0; i < 3; i++) {
    liftParticles.push({
      x: escapeShip.x + escapeShip.width / 2 + (Math.random() - 0.5) * 44,
      y: escapeShip.y + escapeShip.height - shipLiftOffset + 8,
      vx: (Math.random() - 0.5) * 2.5,
      vy: 1.5 + Math.random() * 2,
      life: 35,
      size: 10 + Math.random() * 14
    });
  }

  for (let p of liftParticles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    p.size += 0.3;
  }
  liftParticles = liftParticles.filter(p => p.life > 0);

  if (shipLiftOffset > 460 && !isVictory) {
    isVictory = true;
    document.getElementById('victory-stats').innerText = `Tempo Restante na Terra: ${lifeYears} Anos → Salvo na Órbita!`;
    document.getElementById('victory-screen').style.display = 'flex';
  }
}

function atualizarFomeSedeETempo() {
  hungerThirstTimer++;
  const interval = player.isSprinting ? 28 : (player.isMoving ? 44 : 65);
  if (hungerThirstTimer >= interval) {
    hungerThirstTimer = 0;
    hunger = Math.max(0, hunger - 1);
    thirst = Math.max(0, thirst - 1.3);
    atualizarHUDStatus();
  }

  agingTimer++;
  const yearInterval = (hunger <= 0 || thirst <= 0) ? 130 : 270;
  if (agingTimer >= yearInterval) {
    agingTimer = 0;
    lifeYears = Math.max(0, lifeYears - 1);
    atualizarHUDStatus();
    tocarEfeitoSonoro('tick_year');
  }
}

function atualizarSomTensao() {
  if (!audioEnabled || !audioCtx) return;

  if (isBeingChased || lifeYears <= 10 || isLaunching) {
    heartbeatTimer++;
    const rate = isLaunching ? 24 : 38;
    if (heartbeatTimer >= rate) {
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

function checarColisaoCriatura(nextX, nextY, ent) {
  for (let b of buildings) {
    if (
      nextX < b.x + b.w + 4 &&
      nextX + ent.width > b.x - 4 &&
      nextY < b.y + b.h + 4 &&
      nextY + ent.height > b.y - 4
    ) {
      return true;
    }
  }

  for (let c of wreckedCars) {
    if (
      nextX < c.x + c.w &&
      nextX + ent.width > c.x &&
      nextY < c.y + c.h &&
      nextY + ent.height > c.y
    ) {
      return true;
    }
  }

  return false;
}

function atualizarJogador() {
  player.isMoving = false;
  let dx = 0;
  let dy = 0;

  if (keys['w'] || keys['arrowup']) { dy -= 1; player.isMoving = true; }
  if (keys['s'] || keys['arrowdown']) { dy += 1; player.isMoving = true; }
  if (keys['a'] || keys['arrowleft']) { dx -= 1; player.isMoving = true; player.facing = -1; }
  if (keys['d'] || keys['arrowright']) { dx += 1; player.isMoving = true; player.facing = 1; }

  // Corrida (Sprint) com Shift
  if (keys['shift'] && player.isMoving && stamina > 2) {
    player.isSprinting = true;
    stamina = Math.max(0, stamina - 0.65);
  } else {
    player.isSprinting = false;
    stamina = Math.min(100, stamina + (player.isMoving ? 0.25 : 0.55));
  }
  atualizarHUDStatus();

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    player.aimAngle = Math.atan2(dy, dx);
  } else {
    player.aimAngle = player.facing === 1 ? 0 : Math.PI;
  }

  const nextX = player.x + dx * player.speed;
  const nextY = player.y + dy * player.speed;

  if (!checarColisaoObstaculos(nextX, player.y)) player.x = nextX;
  if (!checarColisaoObstaculos(player.x, nextY)) player.y = nextY;

  if (player.isMoving) {
    stepSoundTimer++;
    const stepInterval = player.isSprinting ? 11 : (player.speed < player.baseSpeed ? 22 : 16);
    if (stepSoundTimer >= stepInterval) {
      stepSoundTimer = 0;
      tocarEfeitoSonoro('step');
      footprints.push({
        x: player.x + player.width / 2,
        y: player.y + player.height - 2,
        life: 90
      });
    }
  } else {
    stepSoundTimer = 12;
  }
}

function atualizarCamera() {
  let shakeX = 0;
  let shakeY = 0;
  if (screenShake > 0) {
    shakeX = (Math.random() - 0.5) * screenShake;
    shakeY = (Math.random() - 0.5) * screenShake;
    screenShake = Math.max(0, screenShake - 0.8);
  }
  camera.x = player.x + player.width / 2 - canvas.width / 2 + shakeX;
  camera.y = player.y + player.height / 2 - canvas.height / 2 + shakeY;
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

function obterAlvoMaisProximo(ex, ey, defaultTargetX, defaultTargetY, detectRadius) {
  // Sinalizadores têm prioridade máxima para distrair monstros e zumbis!
  for (let f of activeFlares) {
    const dFlare = Math.hypot(f.x - ex, f.y - ey);
    if (dFlare < 520) {
      return { x: f.x, y: f.y, isFlare: true };
    }
  }
  const dPlayer = Math.hypot(defaultTargetX - ex, defaultTargetY - ey);
  if (dPlayer < detectRadius) {
    return { x: defaultTargetX, y: defaultTargetY, isFlare: false };
  }
  return null;
}

function atualizarZumbis() {
  isBeingChased = false;

  let playerInsideBuilding = false;
  for (let b of buildings) {
    if (jogadorDentroDe(b)) {
      playerInsideBuilding = true;
      break;
    }
  }

  const detectionRadius = isLaunching ? 1100 : (flashlightOn ? 440 : 310);

  for (let z of zombies) {
    const zx = z.x + z.width / 2;
    const zy = z.y + z.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;

    const target = obterAlvoMaisProximo(zx, zy, px, py, playerInsideBuilding ? 0 : detectionRadius);

    if (target) {
      const dx = target.x - zx;
      const dy = target.y - zy;
      const dist = Math.hypot(dx, dy);
      const chaseSpeed = isLaunching ? z.speed * 1.3 : z.speed;
      if (dist > 14) {
        z.vx = (dx / dist) * chaseSpeed;
        z.vy = (dy / dist) * chaseSpeed;
        z.isMoving = true;
      } else {
        z.vx = 0;
        z.vy = 0;
        z.isMoving = false;
      }
      z.facing = dx >= 0 ? 1 : -1;
      if (!target.isFlare) isBeingChased = true;
    } else {
      z.patrolTimer++;
      if (z.patrolTimer > 110 + Math.random() * 60) {
        z.patrolTimer = 0;
        const ang = Math.random() * Math.PI * 2;
        if (Math.random() > 0.3) {
          z.vx = Math.cos(ang) * (z.speed * 0.55);
          z.vy = Math.sin(ang) * (z.speed * 0.55);
          z.isMoving = true;
          z.facing = z.vx >= 0 ? 1 : -1;
        } else {
          z.vx = 0;
          z.vy = 0;
          z.isMoving = false;
        }
      }
    }

    moverCriaturaComDesvio(z);
  }
}

function atualizarMonstros() {
  let playerInsideBuilding = false;
  for (let b of buildings) {
    if (jogadorDentroDe(b)) {
      playerInsideBuilding = true;
      break;
    }
  }

  for (let m of monsters) {
    const mx = m.x + m.width / 2;
    const my = m.y + m.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const baseRadius = isLaunching ? 1200 : (flashlightOn ? m.detectRadius : m.detectRadius * 0.72);

    if (m.attackCooldown > 0) m.attackCooldown--;

    // Passos pesados do Brutamonte tremem a câmera se estiver perto
    if (m.kind === 'brute' && m.isMoving && animFrame % 28 === 0) {
      const distPlayer = Math.hypot(px - mx, py - my);
      if (distPlayer < 360) {
        screenShake = Math.max(screenShake, 5);
        tocarEfeitoSonoro('brute_step');
      }
    }

    const target = obterAlvoMaisProximo(mx, my, px, py, playerInsideBuilding ? 0 : baseRadius);

    if (target) {
      const dx = target.x - mx;
      const dy = target.y - my;
      const dist = Math.hypot(dx, dy);

      if (!target.isFlare) {
        isBeingChased = true;
        if (!m.wasChasing) {
          m.wasChasing = true;
          if (m.kind === 'brute') {
            tocarEfeitoSonoro('brute_roar');
            screenShake = Math.max(screenShake, 8);
          } else if (m.kind === 'stalker') {
            tocarEfeitoSonoro('stalker_screech');
          } else {
            tocarEfeitoSonoro('acid_spit');
          }
        }
      }

      const chaseSpeed = isLaunching ? m.speed * 1.25 : m.speed;

      if (m.kind === 'spitter' && !target.isFlare && dist < 240) {
        m.vx = 0;
        m.vy = 0;
        m.isMoving = false;
        m.facing = dx >= 0 ? 1 : -1;
      } else if (dist > 16) {
        m.vx = (dx / dist) * chaseSpeed;
        m.vy = (dy / dist) * chaseSpeed;
        m.isMoving = true;
        m.facing = dx >= 0 ? 1 : -1;
      } else {
        m.vx = 0;
        m.vy = 0;
        m.isMoving = false;
      }

      if (m.kind === 'spitter' && !target.isFlare && m.attackCooldown <= 0 && dist < 390) {
        m.attackCooldown = 140;
        const speedProj = 4.2;
        acidProjectiles.push({
          x: mx,
          y: my - 6,
          vx: (dx / dist) * speedProj,
          vy: (dy / dist) * speedProj,
          life: 110
        });
        tocarEfeitoSonoro('acid_spit');
      }
    } else {
      m.wasChasing = false;
      m.patrolTimer++;
      if (m.patrolTimer > 120 + Math.random() * 60) {
        m.patrolTimer = 0;
        const ang = Math.random() * Math.PI * 2;
        if (Math.random() > 0.35) {
          m.vx = Math.cos(ang) * (m.speed * 0.5);
          m.vy = Math.sin(ang) * (m.speed * 0.5);
          m.isMoving = true;
          m.facing = m.vx >= 0 ? 1 : -1;
        } else {
          m.vx = 0;
          m.vy = 0;
          m.isMoving = false;
        }
      }
    }

    moverCriaturaComDesvio(m);
  }
}

function atualizarProjeteisAcido() {
  for (let p of acidProjectiles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;

    for (let b of buildings) {
      if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) {
        acidPuddles.push({ x: p.x, y: p.y, life: 240 });
        p.life = 0;
        break;
      }
    }

    const dist = Math.hypot((player.x + player.width / 2) - p.x, (player.y + player.height / 2) - p.y);
    if (dist < 18 && p.life > 0) {
      acidPuddles.push({ x: p.x, y: p.y, life: 240 });
      p.life = 0;
      lifeYears = Math.max(0, lifeYears - 2);
      flashDamage = 7;
      atualizarHUDStatus();
      tocarEfeitoSonoro('damage');
    } else if (p.life === 1) {
      acidPuddles.push({ x: p.x, y: p.y, life: 240 });
    }
  }
  acidProjectiles = acidProjectiles.filter(p => p.life > 0);
}

function moverCriaturaComDesvio(ent) {
  let blockedX = false;
  let blockedY = false;

  if (!checarColisaoCriatura(ent.x + ent.vx, ent.y, ent)) {
    ent.x += ent.vx;
  } else {
    blockedX = true;
  }

  if (!checarColisaoCriatura(ent.x, ent.y + ent.vy, ent)) {
    ent.y += ent.vy;
  } else {
    blockedY = true;
  }

  if (blockedX && blockedY) {
    ent.vx = -ent.vx;
    ent.vy = -ent.vy;
    ent.facing = ent.vx >= 0 ? 1 : -1;
    ent.patrolTimer = 0;
  } else if (blockedX) {
    ent.vx = -ent.vx * 0.5;
    ent.facing = ent.vx >= 0 ? 1 : -1;
  } else if (blockedY) {
    ent.vy = -ent.vy * 0.5;
  }
}

function contarPecasColetadas() {
  return itemsOnGround.filter(i => i.type === 'ship_part' && i.collected).length;
}

function verificarInteracoes() {
  activeNPC = null;
  activeItem = null;
  activeShip = null;
  const prompt = document.getElementById('interaction-prompt');

  const distShip = Math.hypot(
    (player.x + player.width / 2) - (escapeShip.x + escapeShip.width / 2),
    (player.y + player.height / 2) - (escapeShip.y + escapeShip.height / 2)
  );
  if (distShip < 80 && !escapeShip.launched) {
    const parts = contarPecasColetadas();
    if (parts >= 3) {
      activeShip = escapeShip;
      prompt.innerHTML = `Segure <span class="key-highlight">[E]</span> para aquecer motores e ENTRAR NA NAVE!`;
      prompt.style.display = 'block';
      return;
    } else {
      prompt.innerHTML = `Nave Incompleta: Fale com os sobreviventes para achar as peças (${parts}/3)`;
      prompt.style.display = 'block';
      return;
    }
  }

  for (let npc of npcs) {
    const dist = Math.hypot((player.x + player.width/2) - (npc.x + npc.width/2), (player.y + player.height/2) - (npc.y + npc.height/2));
    if (dist < 52) {
      activeNPC = npc;
      prompt.innerHTML = `Pressione <span class="key-highlight">[E]</span> para pedir ajuda a ${npc.name}`;
      prompt.style.display = 'block';
      return;
    }
  }

  for (let item of itemsOnGround) {
    if (item.collected) continue;
    const dist = Math.hypot((player.x + player.width/2) - item.x, (player.y + player.height/2) - item.y);
    if (dist < 38) {
      activeItem = item;
      prompt.innerHTML = `Pressione <span class="key-highlight">[E]</span> para pegar ${item.label}`;
      prompt.style.display = 'block';
      return;
    }
  }

  prompt.style.display = 'none';
}

function atualizarDecolagemNave() {
  const progBox = document.getElementById('tower-progress-box');
  const progFill = document.getElementById('tower-progress-fill');

  if (activeShip && (keys['e'] || keys[' '])) {
    isLaunching = true;
    progBox.style.display = 'block';
    activeShip.progress += 0.5;
    progFill.style.width = Math.min(100, activeShip.progress) + '%';

    atualizarSomMotorNave(true, activeShip.progress);
    if (animFrame % 24 === 0) {
      tocarEfeitoSonoro('launch_alarm');
    }

    if (activeShip.progress >= 100) {
      activeShip.launched = true;
      isLaunching = false;
      playerBoardedShip = true;
      progBox.style.display = 'none';
      document.getElementById('interaction-prompt').style.display = 'none';
      atualizarSomMotorNave(false, 0);
      tocarEfeitoSonoro('board_hatch');
      tocarEfeitoSonoro('liftoff');
      mostrarPopupItem(`EMBARQUE CONCLUÍDO! DECOLANDO DA TERRA...`);
    }
  } else {
    isLaunching = false;
    progBox.style.display = 'none';
    atualizarSomMotorNave(false, 0);
    if (activeShip && !activeShip.launched) {
      activeShip.progress = Math.max(0, activeShip.progress - 0.35);
    }
  }
}

function coletarItem(item) {
  item.collected = true;
  lifeYears = Math.min(100, lifeYears + item.years);
  hunger = Math.min(100, hunger + (item.hunger || 0));
  thirst = Math.min(100, thirst + (item.thirst || 0));

  atualizarHUDStatus();

  if (item.type === 'ship_part') {
    const parts = contarPecasColetadas();
    document.getElementById('parts-val').innerText = `${parts}/3`;
    tocarEfeitoSonoro('ship_part');
    if (parts === 3) {
      mostrarPopupItem(`3/3 PEÇAS PRONTAS! Corra para entrar na Nave Aurora!`);
    } else {
      mostrarPopupItem(`Peça da Nave (${parts}/3): ${item.label}!`);
    }
  } else if (item.type === 'flare') {
    flaresCount++;
    document.getElementById('flares-val').innerText = flaresCount;
    tocarEfeitoSonoro('item');
    mostrarPopupItem(`Pegou ${item.label}!`);
  } else if (item.type === 'water') {
    tocarEfeitoSonoro('item');
    mostrarPopupItem(`Bebeu ${item.label} (+${item.thirst}% Sede)`);
  } else if (item.type === 'food') {
    tocarEfeitoSonoro('item');
    mostrarPopupItem(`Comeu ${item.label} (+${item.hunger}% Fome)`);
  }

  activeItem = null;
}

function mostrarPopupItem(texto) {
  const pop = document.getElementById('item-popup');
  pop.innerText = texto;
  pop.style.display = 'block';
  setTimeout(() => { pop.style.display = 'none'; }, 3000);
}

function verificarAtaqueInimigos() {
  if (playerBoardedShip) return;

  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;

  for (let z of zombies) {
    const dist = Math.hypot(px - (z.x + z.width / 2), py - (z.y + z.height / 2));
    if (dist < 22) {
      lifeYears = Math.max(0, lifeYears - 2);
      flashDamage = 6;
      atualizarHUDStatus();
      if (animFrame % 15 === 0) tocarEfeitoSonoro('damage');
    }
  }

  for (let m of monsters) {
    const dist = Math.hypot(px - (m.x + m.width / 2), py - (m.y + m.height / 2));
    const hitRange = m.kind === 'brute' ? 30 : 25;
    if (dist < hitRange && animFrame % 18 === 0) {
      lifeYears = Math.max(0, lifeYears - m.damage);
      flashDamage = 8;
      atualizarHUDStatus();
      tocarEfeitoSonoro('damage');
    }
  }
}

function verificarMorte() {
  if (lifeYears <= 0 && !isGameOver) {
    isGameOver = true;
    isLaunching = false;
    atualizarSomMotorNave(false, 0);
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
  if (opcao.revealPartId === null && npc.solved) {
    document.getElementById('npc-text').innerText = "Já te entreguei todos os meus suprimentos extras, mas ainda posso te dizer onde estão as peças da nave!";
    document.getElementById('dialog-options').innerHTML = `
      <button class="btn-oasis" onclick="abrirDialogo(activeNPC)">Pedir dica sobre as peças</button>
      <button class="btn-oasis" onclick="fecharDialogo()">Voltar à Missão</button>
    `;
    return;
  }

  lifeYears = Math.max(0, lifeYears + opcao.years);
  hunger = Math.min(100, hunger + (opcao.hunger || 0));
  thirst = Math.min(100, thirst + (opcao.thirst || 0));

  if (opcao.revealPartId) {
    const part = itemsOnGround.find(i => i.id === opcao.revealPartId);
    if (part) {
      part.revealedOnRadar = true;
      mostrarPopupItem(`SINAL DETECTADO NO RADAR: ${part.label}!`);
    }
  } else {
    npc.solved = true;
  }

  atualizarHUDStatus();

  if (opcao.years > 0) tocarEfeitoSonoro('item');
  else tocarEfeitoSonoro('damage');

  document.getElementById('npc-text').innerText = `${opcao.resp}`;
  document.getElementById('dialog-options').innerHTML = `
    <button class="btn-oasis" onclick="abrirDialogo(activeNPC)">Fazer outra pergunta</button>
    <button class="btn-oasis" onclick="fecharDialogo()">Voltar à Missão</button>
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

    ctx.fillStyle = 'rgba(38, 29, 24, 0.85)';
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

  if (c.onFire) {
    const hoodX = c.dir === 1 ? cx + c.w - 14 : cx + 14;
    desenharFogoAnimado(hoodX, cy + 12, 0.9);
  }
}

function desenharNaveEspacial() {
  const sx = escapeShip.x - camera.x;
  const sy = escapeShip.y - camera.y;
  const parts = contarPecasColetadas();

  ctx.fillStyle = '#1e242b';
  ctx.fillRect(sx - 12, sy + 10, escapeShip.width + 24, escapeShip.height);
  ctx.strokeStyle = parts >= 3 ? '#00ff88' : '#ffcc00';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx - 12, sy + 10, escapeShip.width + 24, escapeShip.height);

  ctx.fillStyle = '#ffcc00';
  for (let i = -8; i < escapeShip.width + 12; i += 16) {
    ctx.fillRect(sx + i, sy + escapeShip.height + 4, 8, 5);
  }

  for (let p of liftParticles) {
    ctx.fillStyle = `rgba(220, 220, 220, ${(p.life / 35) * 0.45})`;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  const verticalOffset = inIntro ? introShipAltitude : shipLiftOffset;
  const shipY = sy - verticalOffset;
  const shakeX = (isLaunching || playerBoardedShip || (inIntro && introShipAltitude > 0)) ? (Math.random() - 0.5) * 4.5 : 0;
  const shakeY = isLaunching ? (Math.random() - 0.5) * 3 : 0;
  const cx = sx + escapeShip.width / 2 + shakeX;
  const cy = shipY + escapeShip.height / 2 + shakeY;

  if (isLaunching || playerBoardedShip || (inIntro && introShipAltitude > 0)) {
    const scaleFlame = playerBoardedShip ? 1.5 : 1.1;
    desenharFogoAnimado(cx - 18, shipY + escapeShip.height + 6, scaleFlame);
    desenharFogoAnimado(cx + 18, shipY + escapeShip.height + 6, scaleFlame);
  }

  ctx.fillStyle = '#b91c1c';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy + 10);
  ctx.lineTo(cx - 38, cy + 42);
  ctx.lineTo(cx - 14, cy + 38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + 18, cy + 10);
  ctx.lineTo(cx + 38, cy + 42);
  ctx.lineTo(cx + 14, cy + 38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.fillRect(cx - 20, cy + 36, 12, 10);
  ctx.fillRect(cx + 8, cy + 36, 12, 10);

  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 48);
  ctx.quadraticCurveTo(cx + 26, cy - 15, cx + 22, cy + 38);
  ctx.lineTo(cx - 22, cy + 38);
  ctx.quadraticCurveTo(cx - 26, cy - 15, cx, cy - 48);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 48);
  ctx.quadraticCurveTo(cx + 11, cy - 32, cx + 12, cy - 26);
  ctx.lineTo(cx - 12, cy - 26);
  ctx.quadraticCurveTo(cx - 11, cy - 32, cx, cy - 48);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0ea5e9';
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (playerBoardedShip || inIntro) {
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath();
    ctx.arc(cx, cy - 7, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f1610';
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 4.6, Math.PI, 0);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 11, 3, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < parts ? '#00ff88' : '#ef4444';
    ctx.beginPath();
    ctx.arc(cx - 10 + i * 10, cy + 14, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!playerBoardedShip && !inIntro) {
    ctx.fillStyle = parts >= 3 ? '#00ff88' : '#ffcc00';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText(`NAVE AURORA (${parts}/3)`, sx - 16, sy - 6);
  }
}

function desenharCenario() {
  for (let b of buildings) {
    desenharConstrucaoInterior(b);
  }

  for (let c of wreckedCars) {
    desenharCarroDestruido(c);
  }

  // Pegadas na poeira e poças de ácido
  for (let fp of footprints) {
    ctx.fillStyle = `rgba(10, 7, 5, ${(fp.life / 90) * 0.45})`;
    ctx.beginPath();
    ctx.arc(fp.x - camera.x, fp.y - camera.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let ap of acidPuddles) {
    ctx.fillStyle = `rgba(132, 204, 22, ${(ap.life / 240) * 0.55})`;
    ctx.beginPath();
    ctx.ellipse(ap.x - camera.x, ap.y - camera.y, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  desenharNaveEspacial();
}

function desenharSinalizadores() {
  for (let f of activeFlares) {
    const sx = f.x - camera.x;
    const sy = f.y - camera.y;
    const pulse = 28 + Math.sin(animFrame * 0.4) * 8;

    const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, pulse);
    glow.addColorStop(0, 'rgba(255, 40, 40, 0.7)');
    glow.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ==========================================
// ITENS NO CHÃO (COMBUSTÍVEL, TRAJE, CHIP E SINALIZADOR)
// ==========================================
function desenharItemChao(item) {
  if (item.collected) return;
  const screenX = item.x - camera.x;
  const screenY = item.y - camera.y;

  if (screenX < -120 || screenX > canvas.width + 120 || screenY < -120 || screenY > canvas.height + 120) return;

  if (item.type === 'ship_part') {
    const pulse = 13 + Math.sin(animFrame * 0.14) * 2.5;
    ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
    ctx.beginPath();
    ctx.arc(screenX, screenY, pulse, 0, Math.PI * 2);
    ctx.fill();

    if (item.partShape === 'fuel') {
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(screenX - 7, screenY - 7, 14, 16, 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#991b1b';
      ctx.fillRect(screenX - 4, screenY - 10, 7, 3);

      ctx.fillStyle = '#facc15';
      ctx.fillRect(screenX + 3, screenY - 10, 3, 4);

      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screenX - 4, screenY - 3);
      ctx.lineTo(screenX + 4, screenY + 5);
      ctx.moveTo(screenX + 4, screenY - 3);
      ctx.lineTo(screenX - 4, screenY + 5);
      ctx.stroke();

    } else if (item.partShape === 'suit') {
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(screenX, screenY - 7, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0284c7';
      ctx.fillRect(screenX - 3, screenY - 8, 6, 3);

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(screenX - 6, screenY - 2, 12, 9, 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillRect(screenX - 5, screenY + 7, 4, 5);
      ctx.fillRect(screenX + 1, screenY + 7, 4, 5);

    } else if (item.partShape === 'chip') {
      ctx.fillStyle = '#facc15';
      for (let p = -5; p <= 5; p += 5) {
        ctx.fillRect(screenX - 10, screenY + p - 1, 20, 2);
        ctx.fillRect(screenX + p - 1, screenY - 10, 2, 20);
      }

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(screenX - 7, screenY - 7, 14, 14, 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(screenX - 3, screenY - 3, 6, 6);
    }

  } else if (item.type === 'flare') {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(screenX - 2, screenY - 7, 4, 14);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(screenX - 2, screenY - 7, 4, 3);
  } else if (item.type === 'water') {
    ctx.fillStyle = 'rgba(0, 204, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00ccff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(screenX - 4, screenY - 6, 8, 12, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(screenX - 2, screenY - 8, 4, 2);
  } else {
    ctx.fillStyle = 'rgba(255, 153, 0, 0.35)';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff9900';
    ctx.strokeStyle = '#fff5e6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(screenX - 6, screenY - 5, 12, 10, 2);
    ctx.fill();
    ctx.stroke();
  }

  const distToPlayer = Math.hypot((player.x + player.width / 2) - item.x, (player.y + player.height / 2) - item.y);
  if (distToPlayer < 85 && !inIntro) {
    ctx.font = 'bold 11px Rajdhani, sans-serif';
    const textWidth = ctx.measureText(item.label).width;
    const tagW = textWidth + 16;
    const tagH = 20;
    const tagX = screenX - tagW / 2;
    const tagY = screenY - 32;

    let accentColor = '#00e5ff';
    if (item.partShape === 'fuel' || item.type === 'flare') accentColor = '#ef4444';
    else if (item.type === 'water') accentColor = '#00ccff';
    else if (item.type === 'food') accentColor = '#ff9900';

    ctx.fillStyle = 'rgba(14, 10, 8, 0.92)';
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 4);
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(item.label, screenX, tagY + 14);
    ctx.textAlign = 'left';
  }
}

// ==========================================
// DESENHO DOS MONSTROS MUTANTES
// ==========================================
function desenharMonstro(m) {
  const screenX = m.x - camera.x;
  const screenY = m.y - camera.y;

  if (screenX < -90 || screenX > canvas.width + 90 || screenY < -90 || screenY > canvas.height + 90) return;

  const facing = m.facing || 1;
  const cycle = animFrame * (m.kind === 'stalker' ? 0.32 : 0.16);
  const legSwing = m.isMoving ? Math.sin(cycle) * 5 : 0;
  const bob = m.isMoving ? Math.abs(Math.sin(cycle)) * 2.5 : 0;
  const cx = screenX + m.width / 2;

  const auraColor = m.kind === 'spitter' ? 'rgba(34, 197, 94, 0.22)' : 'rgba(168, 85, 247, 0.22)';
  ctx.fillStyle = auraColor;
  ctx.beginPath();
  ctx.arc(cx, screenY + m.height / 2, m.width * 0.85, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.ellipse(cx, screenY + m.height - 2, m.width * 0.48, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 1.5;

  if (m.kind === 'brute') {
    ctx.fillStyle = '#3b0764';
    ctx.fillRect(cx - 12, screenY + 34 - bob, 9, 14 + legSwing);
    ctx.strokeRect(cx - 12, screenY + 34 - bob, 9, 14 + legSwing);
    ctx.fillRect(cx + 3, screenY + 34 - bob, 9, 14 - legSwing);
    ctx.strokeRect(cx + 3, screenY + 34 - bob, 9, 14 - legSwing);

    ctx.fillStyle = '#581c87';
    ctx.beginPath();
    ctx.roundRect(cx - 17, screenY + 12 - bob, 34, 24, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.moveTo(cx - 16, screenY + 14 - bob);
    ctx.lineTo(cx - 22, screenY + 4 - bob);
    ctx.lineTo(cx - 10, screenY + 12 - bob);
    ctx.moveTo(cx + 16, screenY + 14 - bob);
    ctx.lineTo(cx + 22, screenY + 4 - bob);
    ctx.lineTo(cx + 10, screenY + 12 - bob);
    ctx.fill();

    ctx.fillStyle = '#6b21a8';
    ctx.beginPath();
    ctx.roundRect(cx - 22, screenY + 16 - bob - legSwing * 0.5, 7, 18, 3);
    ctx.roundRect(cx + 15, screenY + 16 - bob + legSwing * 0.5, 7, 18, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.arc(cx + facing * 2, screenY + 9 - bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(cx - 2 + facing * 4, screenY + 8 - bob, 2, 0, Math.PI * 2);
    ctx.arc(cx + 4 + facing * 4, screenY + 8 - bob, 2, 0, Math.PI * 2);
    ctx.fill();

  } else if (m.kind === 'stalker') {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(cx - 8, screenY + 26 - bob, 6, 15 + legSwing);
    ctx.fillRect(cx + 2, screenY + 26 - bob, 6, 15 - legSwing);

    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.roundRect(cx - 10 + facing * 2, screenY + 12 - bob, 20, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 2;
    const clawX = facing === 1 ? cx + 10 : cx - 10;
    ctx.beginPath();
    ctx.moveTo(clawX, screenY + 18 - bob);
    ctx.lineTo(clawX + facing * 12, screenY + 22 - bob);
    ctx.moveTo(clawX, screenY + 22 - bob);
    ctx.lineTo(clawX + facing * 11, screenY + 27 - bob);
    ctx.stroke();

    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#3f3f46';
    ctx.beginPath();
    ctx.arc(cx + facing * 4, screenY + 8 - bob, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d946ef';
    ctx.beginPath();
    ctx.arc(cx + facing * 7, screenY + 7 - bob, 2.2, 0, Math.PI * 2);
    ctx.fill();

  } else {
    ctx.fillStyle = '#14532d';
    ctx.fillRect(cx - 8, screenY + 27 - bob, 6, 14 + legSwing);
    ctx.fillRect(cx + 2, screenY + 27 - bob, 6, 14 - legSwing);

    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.roundRect(cx - 11, screenY + 12 - bob, 22, 17, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(cx - facing * 6, screenY + 16 - bob, 5, 0, Math.PI * 2);
    ctx.arc(cx - facing * 4, screenY + 23 - bob, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(cx + facing * 2, screenY + 7 - bob, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.arc(cx + facing * 6, screenY + 9 - bob, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const distToPlayer = Math.hypot((player.x + player.width / 2) - (m.x + m.width / 2), (player.y + player.height / 2) - (m.y + m.height / 2));
  if (distToPlayer < 260 && !inIntro) {
    ctx.fillStyle = m.kind === 'spitter' ? '#4ade80' : '#e879f9';
    ctx.font = 'bold 10px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.name.toUpperCase(), cx, screenY - 6 - bob);
    ctx.textAlign = 'left';
  }
}

function desenharProjeteisAcido() {
  for (let p of acidProjectiles) {
    const sx = p.x - camera.x;
    const sy = p.y - camera.y;

    ctx.fillStyle = 'rgba(74, 222, 128, 0.35)';
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function desenharPersonagemDetalhado(worldX, worldY, char, isMoving, isZombie = false, isNPC = false) {
  const screenX = worldX - camera.x;
  const screenY = worldY - camera.y;

  if (screenX < -60 || screenX > canvas.width + 60 || screenY < -60 || screenY > canvas.height + 60) return;

  const facing = char.facing || 1;
  const cycle = isZombie ? animFrame * 0.14 : animFrame * 0.24;
  const legSwing = isMoving ? Math.sin(cycle) * 4.5 : 0;
  const armSwing = isMoving ? Math.cos(cycle) * 4 : 0;
  const limpTilt = (isZombie && isMoving) ? Math.max(0, Math.sin(cycle)) * 2.5 : 0;
  const bodyBob = isMoving ? (isZombie ? limpTilt : Math.abs(Math.sin(cycle)) * 1.5) : 0;

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

  if (isZombie) {
    const stepFront = isMoving ? Math.max(0, Math.sin(cycle)) * 4 : 0;
    const dragLag = isMoving ? (6 + Math.sin(cycle) * 2) * facing : 4 * facing;

    ctx.strokeStyle = '#0d0d0d';
    ctx.fillStyle = '#1d241a';
    ctx.beginPath();
    ctx.moveTo(cx - 2 * facing, screenY + 25 + bodyBob);
    ctx.lineTo(cx - 7 * facing, screenY + 25 + bodyBob);
    ctx.lineTo(cx - 7 * facing - dragLag, screenY + 37);
    ctx.lineTo(cx - 1 * facing - dragLag, screenY + 37);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#141110';
    ctx.fillRect(cx - 5 * facing - dragLag - 3, screenY + 35, 8, 3.5);

    ctx.fillStyle = pantsColor;
    ctx.beginPath();
    ctx.roundRect(cx + (facing === 1 ? 0 : -6), screenY + 24 + bodyBob, 6, 11 - stepFront * 0.5, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#141110';
    ctx.fillRect(cx + (facing === 1 ? -0.5 : -6.5), screenY + 34 - stepFront * 0.5 + bodyBob * 0.3, 7, 4);
  } else {
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
  }

  ctx.fillStyle = isZombie ? '#4b6344' : char.skinColor;
  ctx.beginPath();
  ctx.roundRect(cx - 10, screenY + 14 - armSwing + (isZombie ? bodyBob : -bodyBob), 4, 11, 2);
  ctx.fill();

  const torsoY = isZombie ? screenY + 11 + bodyBob : screenY + 11 - bodyBob;
  const torsoOffset = isZombie ? facing * 2 : 0;
  ctx.fillStyle = isZombie ? '#33422e' : char.shirtColor;
  ctx.beginPath();
  ctx.roundRect(cx - 8 + torsoOffset, torsoY, 16, 15, 3);
  ctx.fill();
  ctx.stroke();

  if (!isZombie) {
    ctx.fillStyle = char.isMedic ? '#ff2a4b' : 'rgba(0,0,0,0.28)';
    ctx.fillRect(cx - 1, torsoY + 1, 2, 13);
    if (char.isMedic) {
      ctx.fillRect(cx - 3.5, torsoY + 4, 7, 2);
    }
  } else {
    ctx.fillStyle = '#587350';
    ctx.fillRect(cx - 4 + torsoOffset, torsoY + 6, 5, 3);
  }

  if (isZombie) {
    ctx.fillStyle = '#587350';
    ctx.beginPath();
    const reachX = facing === 1 ? cx + 3 : cx - 14;
    ctx.roundRect(reachX, torsoY + 2 + (armSwing * 0.4), 11, 4, 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = char.shirtColor;
    ctx.beginPath();
    ctx.roundRect(cx + 6, torsoY + 2 + armSwing, 4.5, 9, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = char.skinColor;
    ctx.beginPath();
    ctx.arc(cx + 8.2, torsoY + 12 + armSwing, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const headX = cx + (isZombie ? facing * 2.5 : 0);
  const headY = isZombie ? screenY + 5 + bodyBob : screenY + 5 - bodyBob;

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
    ctx.fillText('?', cx - 4, screenY - 8 + floatY);
  }
}

// ==========================================
// MINIMAPA NO CANTO SUPERIOR DIREITO
// ==========================================
function desenharMinimapa() {
  if (!miniCtx) return;

  const mw = miniCanvas.width;
  const mh = miniCanvas.height;
  const scale = 0.038;

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

  for (let item of itemsOnGround) {
    if (item.collected) continue;
    let mx = cx + (item.x - player.x) * scale;
    let my = cy + (item.y - player.y) * scale;

    if (item.type === 'ship_part') {
      if (!item.revealedOnRadar) continue;
      mx = Math.max(12, Math.min(mw - 12, mx));
      my = Math.max(12, Math.min(mh - 12, my));
      miniCtx.strokeStyle = item.partShape === 'fuel' ? '#ef4444' : '#00e5ff';
      miniCtx.lineWidth = 1.4;
      miniCtx.setLineDash([2, 2]);
      miniCtx.beginPath();
      miniCtx.arc(mx, my, 8 + Math.sin(animFrame * 0.12) * 2, 0, Math.PI * 2);
      miniCtx.stroke();
      miniCtx.setLineDash([]);
    } else {
      miniCtx.fillStyle = item.type === 'water' ? '#00ccff' : (item.type === 'flare' ? '#ef4444' : '#ff9900');
      miniCtx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
  }

  miniCtx.fillStyle = '#ffaa00';
  for (let npc of npcs) {
    const mx = cx + (npc.x - player.x) * scale;
    const my = cy + (npc.y - player.y) * scale;
    miniCtx.beginPath();
    miniCtx.arc(mx, my, 3, 0, Math.PI * 2);
    miniCtx.fill();
  }

  let shX = cx + (escapeShip.x + escapeShip.width / 2 - player.x) * scale;
  let shY = cy + (escapeShip.y + escapeShip.height / 2 - player.y) * scale;
  shX = Math.max(8, Math.min(mw - 8, shX));
  shY = Math.max(8, Math.min(mh - 8, shY));
  miniCtx.fillStyle = contarPecasColetadas() >= 3 ? '#00ff88' : '#ffcc00';
  miniCtx.beginPath();
  miniCtx.moveTo(shX, shY - 5);
  miniCtx.lineTo(shX + 4.5, shY + 4);
  miniCtx.lineTo(shX - 4.5, shY + 4);
  miniCtx.closePath();
  miniCtx.fill();

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

  for (let m of monsters) {
    const mx = cx + (m.x - player.x) * scale;
    const my = cy + (m.y - player.y) * scale;
    if (mx >= 0 && mx <= mw && my >= 0 && my <= mh) {
      miniCtx.fillStyle = '#d946ef';
      miniCtx.beginPath();
      miniCtx.arc(mx, my, pulse + 1.2, 0, Math.PI * 2);
      miniCtx.fill();
    }
  }

  miniCtx.fillStyle = 'rgba(0, 229, 255, 0.22)';
  miniCtx.beginPath();
  miniCtx.moveTo(cx, cy);
  if (player.facing === 1) {
    miniCtx.arc(cx, cy, 18, -0.45, 0.45);
  } else {
    miniCtx.arc(cx, cy, 18, Math.PI - 0.45, Math.PI + 0.45);
  }
  miniCtx.closePath();
  miniCtx.fill();

  miniCtx.fillStyle = '#00e5ff';
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

// ==========================================
// ILUMINAÇÃO REALISTA + LANTERNA DIRECIONAL + CINZAS
// ==========================================
function desenharIluminacaoEClima() {
  // Cinzas e brasas flutuando
  for (let p of ashParticles) {
    ctx.fillStyle = p.isEmber ? 'rgba(255, 120, 30, 0.65)' : 'rgba(200, 190, 180, 0.28)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  if (inIntro) return;

  const screenPx = player.x + player.width / 2 - camera.x;
  const screenPy = player.y + player.height / 2 - camera.y;

  // Camada de escuridão atmosférica com recorte da lanterna tática
  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = canvas.width;
  lightCanvas.height = canvas.height;
  const lCtx = lightCanvas.getContext('2d');

  lCtx.fillStyle = lifeYears <= 10 ? 'rgba(10, 4, 4, 0.84)' : 'rgba(6, 4, 3, 0.78)';
  lCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

  lCtx.globalCompositeOperation = 'destination-out';

  // Halo natural ao redor do jogador
  const selfGrad = lCtx.createRadialGradient(screenPx, screenPy, 25, screenPx, screenPy, 135);
  selfGrad.addColorStop(0, 'rgba(0,0,0,1)');
  selfGrad.addColorStop(1, 'rgba(0,0,0,0)');
  lCtx.fillStyle = selfGrad;
  lCtx.beginPath();
  lCtx.arc(screenPx, screenPy, 135, 0, Math.PI * 2);
  lCtx.fill();

  // Cone de luz da lanterna [F]
  if (flashlightOn && !playerBoardedShip) {
    const beamLen = 340;
    const spread = 0.42;
    const coneGrad = lCtx.createRadialGradient(screenPx, screenPy, 15, screenPx, screenPy, beamLen);
    coneGrad.addColorStop(0, 'rgba(0,0,0,1)');
    coneGrad.addColorStop(0.75, 'rgba(0,0,0,0.75)');
    coneGrad.addColorStop(1, 'rgba(0,0,0,0)');

    lCtx.fillStyle = coneGrad;
    lCtx.beginPath();
    lCtx.moveTo(screenPx, screenPy);
    lCtx.arc(screenPx, screenPy, beamLen, player.aimAngle - spread, player.aimAngle + spread);
    lCtx.closePath();
    lCtx.fill();
  }

  // Luz dos sinalizadores ativos
  for (let f of activeFlares) {
    const fx = f.x - camera.x;
    const fy = f.y - camera.y;
    const fGrad = lCtx.createRadialGradient(fx, fy, 10, fx, fy, 170);
    fGrad.addColorStop(0, 'rgba(0,0,0,1)');
    fGrad.addColorStop(1, 'rgba(0,0,0,0)');
    lCtx.fillStyle = fGrad;
    lCtx.beginPath();
    lCtx.arc(fx, fy, 170, 0, Math.PI * 2);
    lCtx.fill();
  }

  ctx.drawImage(lightCanvas, 0, 0);

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
  desenharSinalizadores();

  for (let item of itemsOnGround) {
    desenharItemChao(item);
  }

  for (let npc of npcs) {
    desenharPersonagemDetalhado(npc.x, npc.y, npc, !npc.isTalking, false, true);
  }

  for (let z of zombies) {
    desenharPersonagemDetalhado(z.x, z.y, z, z.isMoving, true, false);
  }

  for (let m of monsters) {
    desenharMonstro(m);
  }

  desenharProjeteisAcido();

  if (!playerBoardedShip && !inIntro) {
    desenharPersonagemDetalhado(player.x, player.y, player, player.isMoving, false, false);
  }

  desenharTetosConstrucoes();
  desenharIluminacaoEClima();
}