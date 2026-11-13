let canvas, ctx, miniCanvas, miniCtx;
let playerName = "Sobrevivente";
let lifeYears = 35;
let hunger = 100;
let thirst = 100;
let stamina = 100;
let battery = 100;
let flaresCount = 2;
let flashlightOn = true;
let isHiding = false;
let currentHideSpot = null;

let activeNPC = null;
let activeItem = null;
let activeNote = null;
let activeHideSpot = null;
let activeShip = null;
let inDialog = false;
let readingNote = false;

let animFrame = 0;
let agingTimer = 0;
let hungerThirstTimer = 0;
let flashDamage = 0;
let screenShake = 0;
let lightningAlpha = 0;
let lightningTimer = 0;

let isGameOver = false;
let isVictory = false;
let isLaunching = false;
let playerBoardedShip = false;
let shipLiftOffset = 0;

let liftParticles = [];
let activeFlares = [];
let footprints = [];
let ashParticles = [];
let soundWaves = [];
let groundDetails = [];

// ==========================================
// CENA DE VÍDEO MILITAR EM TELA CHEIA (24 SEGUNDOS)
// ==========================================
let inIntro = false;
let introTimer = 0;
const INTRO_DURATION = 1440; // 24 segundos exatos (somente o vídeo dela falando, sem cena do foguete)
let introCutTriggered = false;
let speechTimeoutIds = [];

// Frases limpas e diretas com clique de walkie-talkie nas pausas
const PHONE_VIDEO_LINES = [
  {
    delayMs: 350,
    rate: 1.04,
    pitch: 1.05,
    text: "Câmbio! Aqui é a Sargento Sara. Se você recebeu esse vídeo, preste muita atenção.",
    caption: "\"[CÂMBIO] Aqui é a Sargento Sara. Se você recebeu esse vídeo, preste muita atenção.\""
  },
  {
    delayMs: 5200,
    rate: 1.06,
    pitch: 1.06,
    text: "O núcleo rompeu e a radiação está consumindo nossos anos de vida rapidamente.",
    caption: "\"O núcleo rompeu e a radiação está consumindo nossos anos de vida rapidamente.\""
  },
  {
    delayMs: 10400,
    rate: 1.08,
    pitch: 1.08,
    text: "A Nave Aurora está na plataforma norte, mas faltam três peças espalhadas nas ruínas.",
    caption: "\"A Nave Aurora está na plataforma norte, mas faltam três peças espalhadas nas ruínas.\""
  },
  {
    delayMs: 15600,
    rate: 1.12,
    pitch: 1.10,
    text: "Economize a lanterna e se esconda nos armários se ouvir passos rápidos! Câmbio—",
    caption: "\"Economize a lanterna e se esconda nos armários se ouvir passos rápidos! Câmbio—\""
  },
  {
    delayMs: 20400,
    rate: 1.18,
    pitch: 1.15,
    text: "Espera... movimento no perímetro! Eles andam de quatro patas! Não, não, NÃO!",
    caption: "\"Espera... movimento no perímetro! Eles andam de quatro patas! Não, não, NÃO—\""
  }
];

function selecionarVozFemininaNatural() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const ptVoices = voices.filter(v => v.lang.toLowerCase().includes('pt'));

  const naturalPriority = [
    'francisca online',
    'thalita online',
    'natural',
    'google português',
    'francisca',
    'thalita',
    'maria',
    'luciana',
    'vitoria'
  ];

  for (let name of naturalPriority) {
    const found = ptVoices.find(v => v.name.toLowerCase().includes(name));
    if (found) return found;
  }
  return ptVoices[0] || null;
}

function limparFalasAgendadas() {
  for (let id of speechTimeoutIds) clearTimeout(id);
  speechTimeoutIds = [];
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function agendarFalasDoCelular() {
  limparFalasAgendadas();
  if (!audioEnabled || !('speechSynthesis' in window)) return;

  const chosenVoice = selecionarVozFemininaNatural();

  PHONE_VIDEO_LINES.forEach(line => {
    const id = setTimeout(() => {
      if (!inIntro || introCutTriggered || !audioEnabled) return;
      document.getElementById('intro-subtitle').innerText = line.caption;

      // Clique limpo de transmissão walkie-talkie antes da fala
      tocarEfeitoSonoro('walkie_ptt_in');

      const utter = new SpeechSynthesisUtterance(line.text);
      utter.lang = 'pt-BR';
      utter.rate = line.rate;
      utter.pitch = line.pitch;
      utter.volume = 1.0;
      if (chosenVoice) utter.voice = chosenVoice;

      utter.onend = () => {
        if (inIntro && !introCutTriggered && audioEnabled) {
          tocarEfeitoSonoro('walkie_ptt_out');
        }
      };

      window.speechSynthesis.speak(utter);
    }, line.delayMs);
    speechTimeoutIds.push(id);
  });
}

// ==========================================
// SISTEMA DE ÁUDIO E EFEITOS SONOROS (WEB AUDIO API)
// ==========================================
let audioCtx = null;
let audioEnabled = true;
let masterGain = null;
let droneOsc1 = null;
let droneOsc2 = null;
let droneGain = null;
let engineOsc = null;
let engineGain = null;
let radioStaticGain = null;
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
  droneOsc1.frequency.value = 98;

  droneOsc2.type = 'triangle';
  droneOsc2.frequency.value = 100.5;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 280;

  droneGain.gain.value = 0.13;

  droneOsc1.connect(filter);
  droneOsc2.connect(filter);
  filter.connect(droneGain);
  droneGain.connect(masterGain);

  droneOsc1.start();
  droneOsc2.start();

  const bufferSize = audioCtx.sampleRate * 2;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const windSource = audioCtx.createBufferSource();
  windSource.buffer = noiseBuffer;
  windSource.loop = true;

  const windFilter = audioCtx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 340;
  windFilter.Q.value = 2.5;

  const windGain = audioCtx.createGain();
  windGain.gain.value = 0.04;

  windSource.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(masterGain);
  windSource.start();

  // Estática suave estilo rádio walkie-talkie (bem baixa para manter a voz limpa)
  const staticSource = audioCtx.createBufferSource();
  staticSource.buffer = noiseBuffer;
  staticSource.loop = true;

  const staticFilter = audioCtx.createBiquadFilter();
  staticFilter.type = 'bandpass';
  staticFilter.frequency.value = 1900;
  staticFilter.Q.value = 1.6;

  radioStaticGain = audioCtx.createGain();
  radioStaticGain.gain.value = 0;

  staticSource.connect(staticFilter);
  staticFilter.connect(radioStaticGain);
  radioStaticGain.connect(masterGain);
  staticSource.start();

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

function definirEstaticaRadio(volume) {
  if (!audioCtx || !radioStaticGain) return;
  radioStaticGain.gain.setTargetAtTime(audioEnabled ? volume : 0, audioCtx.currentTime, 0.04);
}

function alternarAudio() {
  garantirAudioAtivo();
  audioEnabled = !audioEnabled;
  const btn = document.getElementById('audio-toggle');
  if (btn) btn.innerText = audioEnabled ? 'SOM: ON' : 'SOM: OFF';

  if (!audioEnabled) {
    limparFalasAgendadas();
  }

  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(audioEnabled ? 0.85 : 0, audioCtx.currentTime, 0.05);
  }
}

function atualizarMusicaDeTensao() {
  if (!audioEnabled || !audioCtx || !masterGain) return;
  if (audioCtx.state === 'suspended') return;

  const ritmo = (isBeingChased || isLaunching || inIntro) ? 26 : (lifeYears <= 12 ? 32 : 52);
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
    filter.frequency.setValueAtTime((isBeingChased || inIntro) ? 620 : 380, now);

    // Durante a fala da intro, mantém a música de fundo mais discreta para voz bem limpa
    const vol = inIntro ? 0.055 : (isBeingChased ? 0.13 : 0.09);
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

  if (tipo === 'walkie_ptt_in') {
    // Clique característico de apertar o botão do walkie-talkie
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.setValueAtTime(1950, now + 0.035);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (tipo === 'walkie_ptt_out') {
    // Bi-bi curto ao soltar o botão do walkie-talkie
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1250, now);
    osc.frequency.setValueAtTime(920, now + 0.04);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.09);
  } else if (tipo === 'monster_ambush_roar') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.linearRampToValueAtTime(40, now + 1.15);
    gain.gain.setValueAtTime(0.46, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.start(now);
    osc.stop(now + 1.2);

    const screech = audioCtx.createOscillator();
    const sGain = audioCtx.createGain();
    screech.type = 'sawtooth';
    screech.frequency.setValueAtTime(540, now + 0.04);
    screech.frequency.exponentialRampToValueAtTime(1020, now + 0.24);
    screech.frequency.exponentialRampToValueAtTime(180, now + 0.85);
    sGain.gain.setValueAtTime(0.32, now + 0.04);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    screech.connect(sGain);
    sGain.connect(masterGain);
    screech.start(now + 0.04);
    screech.stop(now + 0.9);
  } else if (tipo === 'step') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.055);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (tipo === 'heartbeat') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.2);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.22);
  } else if (tipo === 'zombie_groan') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95 + Math.random() * 20, now);
    osc.frequency.linearRampToValueAtTime(68, now + 0.45);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.start(now);
    osc.stop(now + 0.48);
  } else if (tipo === 'quad_shriek') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.55);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    osc.start(now);
    osc.stop(now + 0.58);
  } else if (tipo === 'quad_gallop') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.09);
    gain.gain.setValueAtTime(0.20, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (tipo === 'thunder') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 1.1);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
    osc.start(now);
    osc.stop(now + 1.15);
  } else if (tipo === 'hide') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
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
  baseSpeed: 3.3,
  speed: 3.3,
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
    x: 240, y: 1460, w: 195, h: 165,
    doorSide: 'bottom', doorPos: 65, doorWidth: 44,
    type: 'clinic', title: 'POSTO MÉDICO EM RUÍNAS', onFire: true
  },
  {
    x: 1640, y: 1960, w: 205, h: 170,
    doorSide: 'top', doorPos: 68, doorWidth: 46,
    type: 'warehouse', title: 'DEPÓSITO SUL DESTRUÍDO', onFire: true
  },
  {
    x: 2380, y: 680, w: 195, h: 165,
    doorSide: 'left', doorPos: 52, doorWidth: 44,
    type: 'clinic', title: 'LABORATÓRIO LESTE', onFire: true
  },
  {
    x: 920, y: 1180, w: 155, h: 135,
    doorSide: 'top', doorPos: 55, doorWidth: 40,
    type: 'house', title: 'CASA ABANDONADA #01', onFire: false
  },
  {
    x: 1540, y: 1120, w: 160, h: 140,
    doorSide: 'left', doorPos: 48, doorWidth: 40,
    type: 'house', title: 'RESIDÊNCIA COLAPSADA #02', onFire: true
  },
  {
    x: 1080, y: 1680, w: 165, h: 140,
    doorSide: 'right', doorPos: 50, doorWidth: 40,
    type: 'house', title: 'ABRIGO FAMILIAR #03', onFire: false
  }
];

const hidingSpots = [
  { x: 942, y: 1205, w: 28, h: 36, type: 'locker', label: 'Armário Metálico' },
  { x: 1655, y: 1140, w: 28, h: 36, type: 'locker', label: 'Armário Enferrujado' },
  { x: 1102, y: 1705, w: 28, h: 36, type: 'locker', label: 'Armário de Suprimentos' },
  { x: 265, y: 1560, w: 28, h: 36, type: 'locker', label: 'Armário Hospitalar' },
  { x: 1665, y: 2070, w: 28, h: 36, type: 'locker', label: 'Contêiner Aberto' },
  { x: 1420, y: 940, w: 46, h: 30, type: 'rubble', label: 'Escombros de Concreto' },
  { x: 1980, y: 820, w: 46, h: 30, type: 'rubble', label: 'Pilha de Destroços' }
];

const wreckedCars = [
  { x: 1330, y: 840, w: 72, h: 36, color: '#5c2b24', onFire: true, dir: 1 },
  { x: 760, y: 1120, w: 72, h: 36, color: '#39424a', onFire: false, dir: -1 },
  { x: 1780, y: 860, w: 72, h: 36, color: '#3d454d', onFire: true, dir: -1 }
];

const loreNotes = [
  {
    id: 1, x: 1020, y: 1275, read: false,
    title: 'DIÁRIO DE CLARA — DIA 03 DO COLAPSO',
    text: '"O céu ficou laranja na terça-feira. Meu marido notou que os cabelos dele ficaram brancos em poucas horas. A radiação do núcleo está roubando décadas da nossa vida a cada dia..."'
  },
  {
    id: 2, x: 1640, y: 1215, read: false,
    title: 'GRAVAÇÃO DO VIGIA — SETOR LESTE',
    text: '"Não corram perto das ruínas! Aquelas coisas que andam de quatro patas são cegas no escuro se você apagar a lanterna, mas ouvem qualquer passo apressado a dezenas de metros."'
  },
  {
    id: 3, x: 1185, y: 1765, read: false,
    title: 'BILHETE DE DESPEDIDA',
    text: '"Deixei pilhas e comida no armário para quem vier depois. Ouvi dizer que engenheiros da nave Aurora estão reunindo peças ao sul e ao leste. Que Deus nos ajude."'
  },
  {
    id: 4, x: 2490, y: 740, read: false,
    title: 'RELATÓRIO CIENTÍFICO — LAB 04',
    text: '"A mutação quadrúpede apresenta estrutura óssea alongada e extrema velocidade. A luz intensa de sinalizadores térmicos sobrecarrega seus sentidos por alguns segundos."'
  }
];

const itemsOnGround = [
  { id: 101, x: 275, y: 1495, type: 'ship_part', partShape: 'suit', label: 'Traje Criogênico', years: 4, hunger: 0, thirst: 0, collected: false, revealedOnRadar: false },
  { id: 102, x: 2535, y: 805, type: 'ship_part', partShape: 'chip', label: 'Chip de Navegação', years: 4, hunger: 0, thirst: 0, collected: false, revealedOnRadar: false },
  { id: 103, x: 1800, y: 2090, type: 'ship_part', partShape: 'fuel', label: 'Núcleo de Combustível', years: 4, hunger: 0, thirst: 0, collected: false, revealedOnRadar: false },

  { id: 1, x: 1120, y: 950, type: 'water', label: 'Garrafa de Água', years: 2, hunger: 0, thirst: 45, collected: false },
  { id: 2, x: 1860, y: 810, type: 'water', label: 'Cantil de Água Pura', years: 2, hunger: 0, thirst: 50, collected: false },
  { id: 3, x: 1420, y: 1620, type: 'water', label: 'Galão de Água', years: 2, hunger: 0, thirst: 50, collected: false },

  { id: 4, x: 640, y: 1220, type: 'food', label: 'Ração Enlatada', years: 2, hunger: 45, thirst: 0, collected: false },
  { id: 5, x: 1660, y: 1420, type: 'food', label: 'Pacote de Biscoitos', years: 2, hunger: 50, thirst: 0, collected: false },
  { id: 6, x: 2020, y: 980, type: 'food', label: 'Conserva Nutritiva', years: 2, hunger: 50, thirst: 0, collected: false },

  { id: 9, x: 965, y: 1270, type: 'battery', label: 'Pilhas Alcalinas (+60% Bateria)', years: 1, battery: 60, collected: false },
  { id: 10, x: 1580, y: 1185, type: 'battery', label: 'Bateria de Lítio (+70% Bateria)', years: 1, battery: 70, collected: false },
  { id: 11, x: 1130, y: 1730, type: 'battery', label: 'Pilhas Alcalinas (+60% Bateria)', years: 1, battery: 60, collected: false },

  { id: 7, x: 1020, y: 1220, type: 'flare', label: 'Sinalizador Tático (+1)', years: 1, collected: false },
  { id: 8, x: 1750, y: 1380, type: 'flare', label: 'Sinalizador Tático (+1)', years: 1, collected: false }
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
    dialog: "Você viu a transmissão da Sargento Sara? Ela tentou segurar o perímetro norte até o fim... Precisamos terminar o que ela começou! Qual peça da nave você quer localizar?",
    options: [
      {
        text: "Onde posso achar o Galão de Combustível?",
        years: 2, hunger: 0, thirst: 0,
        revealPartId: 103,
        resp: "DICA DO MARCUS: Siga para o SUL até o DEPÓSITO SUL DESTRUÍDO. O galão vermelho está no fundo. Marquei no sonar!"
      },
      {
        text: "Onde está o Chip de Navegação?",
        years: 2, hunger: 0, thirst: 0,
        revealPartId: 102,
        resp: "DICA DO MARCUS: Vá para o LESTE até o LABORATÓRIO LESTE. Cuidado no caminho aberto! Marquei a posição no sonar."
      },
      {
        text: "Preciso de água e comida para a busca.",
        years: 2, hunger: 35, thirst: 35,
        revealPartId: null,
        resp: "Tome aqui! Vasculhe também as casas abandonadas para achar pilhas e diários."
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
    dialog: "Aqueles monstros de quatro patas reagem ao som de corrida e à luz, exatamente como a Sargento Sara alertou no vídeo. Eu vi onde guardaram o Traje Criogênico e o Combustível.",
    options: [
      {
        text: "Onde posso encontrar o Traje Criogênico?",
        years: 3, hunger: 0, thirst: 0,
        revealPartId: 101,
        resp: "DICA DA ELENA: Siga para SUDOESTE até o POSTO MÉDICO EM RUÍNAS. Entre pela porta de baixo e olhe no canto superior esquerdo!"
      },
      {
        text: "Você sabe onde fica o Combustível?",
        years: 2, hunger: 0, thirst: 0,
        revealPartId: 103,
        resp: "DICA DA ELENA: O galão de combustível está no DEPÓSITO SUL, ao sudeste da nave! Marquei no seu sonar."
      },
      {
        text: "Aplicar soro hidratante.",
        years: 3, hunger: 20, thirst: 45,
        revealPartId: null,
        resp: "Hidratação restaurada! Fale comigo novamente se precisar das coordenadas."
      }
    ],
    solved: false
  }
];

const zombies = [
  { x: 1650, y: 880, width: 26, height: 40, speed: 1.0, vx: 0, vy: 0, facing: -1, patrolTimer: 0, isMoving: false, groanTimer: 120 },
  { x: 820, y: 1120, width: 26, height: 40, speed: 0.95, vx: 0, vy: 0, facing: 1, patrolTimer: 0, isMoving: false, groanTimer: 240 },
  { x: 1450, y: 1660, width: 26, height: 40, speed: 1.02, vx: 0, vy: 0, facing: 1, patrolTimer: 0, isMoving: false, groanTimer: 180 },
  { x: 480, y: 1180, width: 26, height: 40, speed: 0.92, vx: 0, vy: 0, facing: 1, patrolTimer: 0, isMoving: false, groanTimer: 300 },
  { x: 2060, y: 840, width: 26, height: 40, speed: 1.05, vx: 0, vy: 0, facing: -1, patrolTimer: 0, isMoving: false, groanTimer: 90 }
];

const quadrupedMonsters = [
  {
    name: 'Rastejador Noturno',
    x: 2080, y: 860,
    width: 48, height: 30,
    speed: 2.35,
    damage: 4,
    detectRadius: 460,
    vx: 0, vy: 0, facing: -1,
    patrolTimer: 0, isMoving: false, wasChasing: false,
    investigateX: null, investigateY: null, investigateTimer: 0
  },
  {
    name: 'Predador das Cinzas',
    x: 1380, y: 1780,
    width: 48, height: 30,
    speed: 2.35,
    damage: 4,
    detectRadius: 460,
    vx: 0, vy: 0, facing: 1,
    patrolTimer: 0, isMoving: false, wasChasing: false,
    investigateX: null, investigateY: null, investigateTimer: 0
  }
];

function redimensionarCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function inicializarAmbiente() {
  ashParticles = [];
  for (let i = 0; i < 65; i++) {
    ashParticles.push({
      x: Math.random() * 2000,
      y: Math.random() * 1400,
      vx: -0.4 - Math.random() * 0.7,
      vy: 0.3 + Math.random() * 0.6,
      size: 1.5 + Math.random() * 2.5,
      isEmber: Math.random() > 0.78
    });
  }

  groundDetails = [];
  for (let i = 0; i < 90; i++) {
    groundDetails.push({
      x: 150 + Math.random() * 2600,
      y: 450 + Math.random() * 1900,
      r: 8 + Math.random() * 22,
      type: Math.random() > 0.4 ? 'crater' : 'crack'
    });
  }
}

function iniciarCenaIntroducao() {
  inIntro = true;
  introTimer = 0;
  introCutTriggered = false;

  const phoneFrame = document.getElementById('phone-frame');
  phoneFrame.classList.remove('dropped');
  document.getElementById('rec-dot').style.background = '#ef4444';
  document.getElementById('rec-label').innerText = 'REC';
  document.getElementById('phone-signal').innerText = 'WALKIE-TALKIE LINK';
  document.getElementById('intro-overlay').style.display = 'block';

  // Estática de rádio bem suave (0.015) para manter a voz super limpa
  definirEstaticaRadio(0.015);
  agendarFalasDoCelular();
}

function pularIntroducao() {
  if (!inIntro) return;
  inIntro = false;
  definirEstaticaRadio(0);
  limparFalasAgendadas();
  document.getElementById('intro-overlay').style.display = 'none';
}

function atualizarCenaIntroducao() {
  introTimer++;
  const remaining = Math.max(0, Math.ceil((INTRO_DURATION - introTimer) / 60));
  document.getElementById('intro-timer').innerText = remaining + 's';

  const recSecs = Math.min(24, Math.floor(introTimer / 60));
  document.getElementById('phone-rec-time').innerText = '00:' + String(recSecs).padStart(2, '0');

  const sub = document.getElementById('intro-subtitle');
  const phoneFrame = document.getElementById('phone-frame');

  // Relâmpagos distantes ao fundo durante a gravação
  if (introTimer === 240 || introTimer === 780) {
    lightningAlpha = 0.55;
    tocarEfeitoSonoro('thunder');
  }

  // Aos 22.8s (frame 1370): O monstro ataca, corta a voz no meio e derruba o celular
  if (introTimer >= 1370 && !introCutTriggered) {
    introCutTriggered = true;
    limparFalasAgendadas();
    tocarEfeitoSonoro('monster_ambush_roar');
    definirEstaticaRadio(0.16);
    screenShake = 26;
    flashDamage = 15;

    phoneFrame.classList.add('dropped');
    document.getElementById('rec-dot').style.background = '#94a3b8';
    document.getElementById('rec-label').innerText = 'SINAL PERDIDO';
    document.getElementById('phone-signal').innerText = 'TELA TRINCADA';
    sub.innerText = '[RUGIDO ENSUREDECEDOR — O CELULAR CAI NO CHÃO E A TRANSMISSÃO CORTA]';
  }

  if (introTimer >= INTRO_DURATION) {
    pularIntroducao();
  }
}

// ==========================================
// DESENHO DO FUNDO PÓS-APOCALÍPTICO E SARA COM ROUPA MILITAR EM CLOSE-UP
// ==========================================
function desenharCenaCelularSara() {
  if (!inIntro) return;

  const w = canvas.width;
  const h = canvas.height;

  // 1. FUNDO DETALHADO (Céu alaranjado de radiação, ruínas, fumaça e fogo ao fundo)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#1c120d');
  skyGrad.addColorStop(0.45, '#431a0b');
  skyGrad.addColorStop(0.78, '#7c2d12');
  skyGrad.addColorStop(1, '#140c08');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Nuvens densas de fumaça e radiação no horizonte
  ctx.fillStyle = 'rgba(20, 14, 12, 0.55)';
  for (let i = 0; i < 6; i++) {
    const cloudX = ((i * 280 + animFrame * 0.25) % (w + 300)) - 150;
    const cloudY = h * 0.22 + Math.sin(i * 1.7) * 35;
    ctx.beginPath();
    ctx.ellipse(cloudX, cloudY, 190, 55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Silhueta de prédios destruídos e antenas ao fundo
  const skyline = [
    { x: 0.03, y: 0.36, bw: 0.11, bh: 0.64 },
    { x: 0.13, y: 0.44, bw: 0.09, bh: 0.56 },
    { x: 0.23, y: 0.30, bw: 0.12, bh: 0.70 },
    { x: 0.66, y: 0.32, bw: 0.11, bh: 0.68 },
    { x: 0.78, y: 0.42, bw: 0.10, bh: 0.58 },
    { x: 0.88, y: 0.35, bw: 0.12, bh: 0.65 }
  ];

  ctx.fillStyle = '#140e0c';
  for (let b of skyline) {
    const bx = w * b.x;
    const by = h * b.y;
    const bw = w * b.bw;
    const bh = h * b.bh;
    ctx.fillRect(bx, by, bw, bh);

    // Janelas em chamas / destruídas nos prédios do fundo
    ctx.fillStyle = 'rgba(249, 115, 22, 0.38)';
    for (let wy = by + 22; wy < h * 0.75; wy += 34) {
      for (let wx = bx + 14; wx < bx + bw - 18; wx += 26) {
        if ((Math.floor(wx + wy) % 3) === 0) {
          ctx.fillRect(wx, wy, 10, 14);
        }
      }
    }
    ctx.fillStyle = '#140e0c';
  }

  // Focos de incêndio nas ruínas atrás dela
  desenharFogoAnimado(w * 0.18, h * 0.68, 1.4);
  desenharFogoAnimado(w * 0.82, h * 0.66, 1.5);

  // Cinzas e brasas voando no fundo
  for (let p of ashParticles) {
    ctx.fillStyle = p.isEmber ? 'rgba(251, 146, 60, 0.78)' : 'rgba(214, 211, 209, 0.32)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. SARGENTO SARA EM CLOSE-UP (BEM PRÓXIMA DA CÂMERA, COM UNIFORME MILITAR)
  const scale = Math.min(w, h) / 540; // Escala responsiva para ficar bem próxima em qualquer monitor
  const handShakeX = Math.sin(animFrame * 0.22) * (introTimer > 1180 ? 11 : 4.5);
  const handShakeY = Math.cos(animFrame * 0.29) * (introTimer > 1180 ? 8 : 3);

  const sx = w * 0.5 + handShakeX;
  const sy = h * 0.52 + handShakeY;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(scale, scale);

  // Luz quente das chamas contornando os ombros e rosto dela
  const rimLight = ctx.createRadialGradient(0, 10, 30, 0, 10, 260);
  rimLight.addColorStop(0, 'rgba(249, 115, 22, 0.24)');
  rimLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rimLight;
  ctx.beginPath();
  ctx.arc(0, 10, 260, 0, Math.PI * 2);
  ctx.fill();

  // Cabelo castanho escuro preso em coque tático com mechas soltas
  const windHair = Math.sin(animFrame * 0.18) * 6;
  ctx.fillStyle = '#24150f';
  ctx.beginPath();
  ctx.arc(0, -108, 28, 0, Math.PI * 2); // Coque militar atrás
  ctx.arc(0, -25, 68, 0, Math.PI * 2);
  ctx.fill();

  // Ombros largos com Gandola / Uniforme Militar Verde-Oliva
  ctx.fillStyle = '#364532';
  ctx.strokeStyle = '#111610';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-145, 230);
  ctx.quadraticCurveTo(-135, 92, -48, 76);
  ctx.lineTo(48, 76);
  ctx.quadraticCurveTo(135, 92, 145, 230);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Manchas de camuflagem tática no uniforme
  ctx.fillStyle = '#263123';
  ctx.beginPath();
  ctx.ellipse(-85, 145, 26, 16, 0.4, 0, Math.PI * 2);
  ctx.ellipse(90, 155, 28, 18, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Gola alta do uniforme militar
  ctx.fillStyle = '#2b3828';
  ctx.beginPath();
  ctx.moveTo(-36, 68);
  ctx.lineTo(-46, 106);
  ctx.lineTo(0, 96);
  ctx.lineTo(46, 106);
  ctx.lineTo(36, 68);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Colete Balístico Tático sobre o uniforme
  ctx.fillStyle = '#1f261e';
  ctx.strokeStyle = '#0c0f0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-78, 86);
  ctx.lineTo(-86, 230);
  ctx.lineTo(86, 230);
  ctx.lineTo(78, 86);
  ctx.lineTo(44, 82);
  ctx.lineTo(32, 128);
  ctx.lineTo(-32, 128);
  ctx.lineTo(-44, 82);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Bolsos táticos e tiras MOLLE no colete
  ctx.fillStyle = '#2b3429';
  ctx.fillRect(-66, 148, 48, 52);
  ctx.strokeRect(-66, 148, 48, 52);
  ctx.fillRect(18, 148, 48, 52);
  ctx.strokeRect(18, 148, 48, 52);

  // Patch militar (bandeira / insígnia) no peito
  ctx.fillStyle = '#b45309';
  ctx.fillRect(-62, 114, 34, 18);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-62, 114, 34, 18);

  // Rádio Walkie-Talkie preso no ombro esquerdo com antena e LED piscando
  ctx.fillStyle = '#18181b';
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 2.5;
  ctx.fillRect(-84, 72, 26, 44);
  ctx.strokeRect(-84, 72, 26, 44);
  // Antena do walkie-talkie
  ctx.fillRect(-80, 26, 5, 46);
  // LED verde de transmissão
  ctx.fillStyle = (animFrame % 16 < 10) ? '#22c55e' : '#14532d';
  ctx.beginPath();
  ctx.arc(-66, 82, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Pescoço
  ctx.fillStyle = '#e6b084';
  ctx.fillRect(-22, 34, 44, 48);

  // Rosto bem próximo da câmera
  ctx.fillStyle = '#f2c6a0';
  ctx.strokeStyle = '#1c120c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -14, 52, 64, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Marcas de fuligem / poeira de combate no rosto
  ctx.fillStyle = 'rgba(41, 37, 36, 0.28)';
  ctx.beginPath();
  ctx.ellipse(-28, 6, 12, 5, -0.3, 0, Math.PI * 2);
  ctx.ellipse(30, -4, 10, 4, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Franja e mechas frontais balançando
  ctx.fillStyle = '#24150f';
  ctx.beginPath();
  ctx.arc(0, -30, 54, Math.PI, 0);
  ctx.lineTo(54 + windHair, 24);
  ctx.lineTo(40, -16);
  ctx.lineTo(-10, -24);
  ctx.lineTo(-42, -14);
  ctx.lineTo(-54 + windHair, 24);
  ctx.closePath();
  ctx.fill();

  // Fone comunicador tático (headset) no ouvido direito com haste até perto da boca
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(48, -22, 12, 28, 5);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(52, 2);
  ctx.quadraticCurveTo(46, 22, 22, 20);
  ctx.stroke();

  // Olhos expressivos olhando direto para a câmera (e olhando para o lado no ataque)
  const lookSide = introTimer > 1180 ? -6 : 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-20, -18, 11, 7.5, 0, 0, Math.PI * 2);
  ctx.ellipse(20, -18, 11, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(-20 + lookSide, -18, 4.8, 0, Math.PI * 2);
  ctx.arc(20 + lookSide, -18, 4.8, 0, Math.PI * 2);
  ctx.fill();

  // Brilho nos olhos
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-22 + lookSide, -20, 1.8, 0, Math.PI * 2);
  ctx.arc(18 + lookSide, -20, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Sobrancelhas firmes
  ctx.strokeStyle = '#1c120c';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-32, -30);
  ctx.lineTo(-10, -26);
  ctx.moveTo(32, -30);
  ctx.lineTo(10, -26);
  ctx.stroke();

  // Nariz sutil
  ctx.strokeStyle = '#c9936b';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(-3, 2);
  ctx.lineTo(3, 4);
  ctx.stroke();

  // Boca sincronizada com a fala
  const mouthOpen = introCutTriggered ? 11 : Math.abs(Math.sin(animFrame * 0.42)) * 8 + 2;
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.ellipse(0, 20, 11, mouthOpen, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Sombra rápida do monstro passando atrás dela nos últimos 3 segundos
  if (introTimer > 1220) {
    const monsterPassX = w * 0.25 + ((introTimer - 1220) * 6);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.ellipse(monsterPassX, h * 0.58, 120, 48, -0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vidro trincado quando o celular cai
  if (introCutTriggered) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.15);
    ctx.lineTo(w * 0.48, h * 0.48);
    ctx.lineTo(w * 0.72, h * 0.82);
    ctx.moveTo(w * 0.48, h * 0.48);
    ctx.lineTo(w * 0.22, h * 0.74);
    ctx.moveTo(w * 0.48, h * 0.48);
    ctx.lineTo(w * 0.78, h * 0.28);
    ctx.stroke();
  }
}

function emitirOndaSonora(x, y, maxRadius) {
  soundWaves.push({ x, y, radius: 8, maxRadius, alpha: 0.65 });

  for (let m of quadrupedMonsters) {
    const dist = Math.hypot((m.x + m.width / 2) - x, (m.y + m.height / 2) - y);
    if (dist <= maxRadius) {
      m.investigateX = x;
      m.investigateY = y;
      m.investigateTimer = 240;
    }
  }
}

function alternarEsconderijo() {
  if (inIntro || inDialog || readingNote || isGameOver || isVictory || playerBoardedShip) return;

  if (isHiding) {
    isHiding = false;
    currentHideSpot = null;
    document.getElementById('stealth-banner').style.display = 'none';
    tocarEfeitoSonoro('hide');
    return;
  }

  if (activeHideSpot) {
    isHiding = true;
    currentHideSpot = activeHideSpot;
    player.x = activeHideSpot.x + activeHideSpot.w / 2 - player.width / 2;
    player.y = activeHideSpot.y + activeHideSpot.h / 2 - player.height / 2;
    document.getElementById('stealth-banner').style.display = 'block';
    tocarEfeitoSonoro('hide');
  }
}

function lancarSinalizador() {
  if (flaresCount <= 0 || inIntro || inDialog || readingNote || isGameOver || isVictory || playerBoardedShip) return;
  if (isHiding) alternarEsconderijo();

  flaresCount--;
  document.getElementById('flares-val').innerText = flaresCount;

  const fx = player.x + player.width / 2 + player.facing * 18;
  const fy = player.y + player.height - 6;

  activeFlares.push({ x: fx, y: fy, life: 450 });
  emitirOndaSonora(fx, fy, 420);
  tocarEfeitoSonoro('flare');
  mostrarPopupItem('SINALIZADOR LANÇADO! Criaturas atraídas.');
}

function alternarLanterna() {
  if (inIntro || inDialog || readingNote || isGameOver || isVictory) return;
  if (battery <= 0) {
    flashlightOn = false;
    mostrarPopupItem('BATERIA DA LANTERNA ESGOTADA! Procure pilhas nas casas.');
    return;
  }
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
  inicializarAmbiente();
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

    if (readingNote && (k === 'e' || k === 'escape' || k === ' ')) {
      fecharNota();
      return;
    }

    if (k === 'f') alternarLanterna();
    if (k === 'q') lancarSinalizador();
    if (k === 'c') alternarEsconderijo();

    if (['e', ' '].includes(k) && !inDialog && !readingNote && !isGameOver && !isVictory && !playerBoardedShip) {
      if (isHiding) {
        alternarEsconderijo();
      } else if (activeNPC) {
        abrirDialogo(activeNPC);
      } else if (activeItem) {
        coletarItem(activeItem);
      } else if (activeNote) {
        abrirNota(activeNote);
      } else if (activeHideSpot) {
        alternarEsconderijo();
      }
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
  battery = 100;
  flaresCount = 2;
  flashlightOn = true;
  isHiding = false;
  currentHideSpot = null;
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
  activeFlares = [];
  footprints = [];
  soundWaves = [];
  escapeShip.launched = false;
  escapeShip.progress = 0;

  atualizarSomMotorNave(false, 0);
  atualizarHUDStatus();
  document.getElementById('stealth-banner').style.display = 'none';
  document.getElementById('parts-val').innerText = '0/3';
  document.getElementById('flares-val').innerText = flaresCount;
  document.getElementById('notes-val').innerText = '0/4';
  document.getElementById('flashlight-val').innerText = 'LIGADA';
  document.getElementById('flashlight-val').style.color = '#38bdf8';
  document.getElementById('game-over-screen').style.display = 'none';
  document.getElementById('victory-screen').style.display = 'none';

  itemsOnGround.forEach(i => {
    i.collected = false;
    if (i.type === 'ship_part') i.revealedOnRadar = false;
  });
  loreNotes.forEach(n => n.read = false);
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
  const bVal = Math.round(battery);

  document.getElementById('hunger-text').innerText = hVal + '%';
  document.getElementById('hunger-bar').style.width = hVal + '%';
  document.getElementById('hunger-bar').style.background = hVal <= 30 ? '#ff3333' : '#ff9900';

  document.getElementById('thirst-text').innerText = tVal + '%';
  document.getElementById('thirst-bar').style.width = tVal + '%';
  document.getElementById('thirst-bar').style.background = tVal <= 30 ? '#ff3333' : '#00ccff';

  document.getElementById('stamina-text').innerText = sVal + '%';
  document.getElementById('stamina-bar').style.width = sVal + '%';
  document.getElementById('stamina-bar').style.background = sVal <= 25 ? '#ef4444' : '#22c55e';

  document.getElementById('battery-text').innerText = bVal + '%';
  document.getElementById('battery-bar').style.width = bVal + '%';
  document.getElementById('battery-bar').style.background = bVal <= 20 ? '#ef4444' : '#facc15';

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
  atualizarAmbienteEClima();

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

  if (!inDialog && !readingNote) {
    atualizarJogador();
    atualizarFomeSedeBateria();
    atualizarNPCs();
    atualizarSinalizadores();
    atualizarZumbis();
    atualizarMonstrosQuadrupedes();
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

function atualizarAmbienteEClima() {
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

  for (let sw of soundWaves) {
    sw.radius += 5.5;
    sw.alpha -= 0.015;
  }
  soundWaves = soundWaves.filter(sw => sw.alpha > 0 && sw.radius < sw.maxRadius);

  lightningTimer++;
  if (!inIntro && lightningTimer > 520 && Math.random() < 0.008) {
    lightningTimer = 0;
    lightningAlpha = 0.65;
    setTimeout(() => {
      tocarEfeitoSonoro('thunder');
      screenShake = Math.max(screenShake, 6);
    }, 350);
  }
  if (lightningAlpha > 0) {
    lightningAlpha = Math.max(0, lightningAlpha - 0.045);
  }
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
    const notesRead = loreNotes.filter(n => n.read).length;
    document.getElementById('victory-stats').innerText = `Tempo Restante: ${lifeYears} Anos • Diários Lidos: ${notesRead}/4`;
    document.getElementById('victory-screen').style.display = 'flex';
  }
}

function atualizarFomeSedeBateria() {
  if (flashlightOn && battery > 0) {
    battery = Math.max(0, battery - 0.022);
    if (battery === 0) {
      flashlightOn = false;
      const el = document.getElementById('flashlight-val');
      el.innerText = 'SEM BATERIA';
      el.style.color = '#ef4444';
      mostrarPopupItem('A bateria da lanterna acabou!');
    }
  }

  hungerThirstTimer++;
  const interval = player.isSprinting ? 28 : (player.isMoving ? 44 : 65);
  if (hungerThirstTimer >= interval) {
    hungerThirstTimer = 0;
    hunger = Math.max(0, hunger - 1);
    thirst = Math.max(0, thirst - 1.3);
    atualizarHUDStatus();
  }

  agingTimer++;
  const yearInterval = (hunger <= 0 || thirst <= 0) ? 130 : 275;
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
    const rate = isLaunching ? 24 : 36;
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
  if (isHiding) {
    player.isMoving = false;
    player.isSprinting = false;
    stamina = Math.min(100, stamina + 0.65);
    atualizarHUDStatus();
    return;
  }

  player.isMoving = false;
  let dx = 0;
  let dy = 0;

  if (keys['w'] || keys['arrowup']) { dy -= 1; player.isMoving = true; }
  if (keys['s'] || keys['arrowdown']) { dy += 1; player.isMoving = true; }
  if (keys['a'] || keys['arrowleft']) { dx -= 1; player.isMoving = true; player.facing = -1; }
  if (keys['d'] || keys['arrowright']) { dx += 1; player.isMoving = true; player.facing = 1; }

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

      if (player.isSprinting) {
        emitirOndaSonora(player.x + player.width / 2, player.y + player.height / 2, 260);
      }
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

function obterAlvoCriatura(ex, ey, px, py, detectRadius) {
  for (let f of activeFlares) {
    if (Math.hypot(f.x - ex, f.y - ey) < 520) {
      return { x: f.x, y: f.y, isFlare: true };
    }
  }

  if (isHiding && !flashlightOn) {
    return null;
  }

  if (Math.hypot(px - ex, py - ey) < detectRadius) {
    return { x: px, y: py, isFlare: false };
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

  const detectionRadius = isLaunching ? 1100 : (flashlightOn ? 410 : 260);

  for (let z of zombies) {
    const zx = z.x + z.width / 2;
    const zy = z.y + z.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;

    z.groanTimer--;
    if (z.groanTimer <= 0) {
      z.groanTimer = 240 + Math.floor(Math.random() * 220);
      if (Math.hypot(px - zx, py - zy) < 480) {
        tocarEfeitoSonoro('zombie_groan');
      }
    }

    const target = obterAlvoCriatura(zx, zy, px, py, playerInsideBuilding ? 0 : detectionRadius);

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

function atualizarMonstrosQuadrupedes() {
  let playerInsideBuilding = false;
  for (let b of buildings) {
    if (jogadorDentroDe(b)) {
      playerInsideBuilding = true;
      break;
    }
  }

  for (let m of quadrupedMonsters) {
    const mx = m.x + m.width / 2;
    const my = m.y + m.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const baseRadius = isLaunching ? 1200 : (flashlightOn ? m.detectRadius : 220);

    const target = obterAlvoCriatura(mx, my, px, py, playerInsideBuilding ? 0 : baseRadius);

    if (target) {
      m.investigateTimer = 0;
      const dx = target.x - mx;
      const dy = target.y - my;
      const dist = Math.hypot(dx, dy);

      if (!target.isFlare) {
        isBeingChased = true;
        if (!m.wasChasing) {
          m.wasChasing = true;
          tocarEfeitoSonoro('quad_shriek');
          screenShake = Math.max(screenShake, 8);
        }
      }

      const chaseSpeed = isLaunching ? m.speed * 1.2 : m.speed;
      if (dist > 18) {
        m.vx = (dx / dist) * chaseSpeed;
        m.vy = (dy / dist) * chaseSpeed;
        m.isMoving = true;
        m.facing = dx >= 0 ? 1 : -1;
      } else {
        m.vx = 0;
        m.vy = 0;
        m.isMoving = false;
      }

      if (m.isMoving && animFrame % 12 === 0 && Math.hypot(px - mx, py - my) < 420) {
        tocarEfeitoSonoro('quad_gallop');
      }
    } else if (m.investigateTimer > 0 && m.investigateX !== null) {
      m.investigateTimer--;
      const dx = m.investigateX - mx;
      const dy = m.investigateY - my;
      const dist = Math.hypot(dx, dy);
      if (dist > 20) {
        m.vx = (dx / dist) * (m.speed * 0.8);
        m.vy = (dy / dist) * (m.speed * 0.8);
        m.isMoving = true;
        m.facing = dx >= 0 ? 1 : -1;
      } else {
        m.vx = 0;
        m.vy = 0;
        m.isMoving = false;
      }
    } else {
      m.wasChasing = false;
      m.patrolTimer++;
      if (m.patrolTimer > 130 + Math.random() * 60) {
        m.patrolTimer = 0;
        const ang = Math.random() * Math.PI * 2;
        if (Math.random() > 0.35) {
          m.vx = Math.cos(ang) * (m.speed * 0.42);
          m.vy = Math.sin(ang) * (m.speed * 0.42);
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
  activeNote = null;
  activeHideSpot = null;
  activeShip = null;
  const prompt = document.getElementById('interaction-prompt');

  if (isHiding) {
    prompt.innerHTML = `Escondido em ${currentHideSpot.label} — Pressione <span class="key-highlight">[C]</span> ou <span class="key-highlight">[E]</span> para sair`;
    prompt.style.display = 'block';
    return;
  }

  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;

  const distShip = Math.hypot(
    px - (escapeShip.x + escapeShip.width / 2),
    py - (escapeShip.y + escapeShip.height / 2)
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
    if (Math.hypot(px - (npc.x + npc.width/2), py - (npc.y + npc.height/2)) < 52) {
      activeNPC = npc;
      prompt.innerHTML = `Pressione <span class="key-highlight">[E]</span> para falar com ${npc.name}`;
      prompt.style.display = 'block';
      return;
    }
  }

  for (let item of itemsOnGround) {
    if (item.collected) continue;
    if (Math.hypot(px - item.x, py - item.y) < 38) {
      activeItem = item;
      prompt.innerHTML = `Pressione <span class="key-highlight">[E]</span> para pegar ${item.label}`;
      prompt.style.display = 'block';
      return;
    }
  }

  for (let note of loreNotes) {
    if (Math.hypot(px - note.x, py - note.y) < 38) {
      activeNote = note;
      prompt.innerHTML = `Pressione <span class="key-highlight">[E]</span> para ler ${note.title}`;
      prompt.style.display = 'block';
      return;
    }
  }

  for (let hs of hidingSpots) {
    if (Math.hypot(px - (hs.x + hs.w / 2), py - (hs.y + hs.h / 2)) < 42) {
      activeHideSpot = hs;
      prompt.innerHTML = `Pressione <span class="key-highlight">[C]</span> ou <span class="key-highlight">[E]</span> para se esconder em ${hs.label}`;
      prompt.style.display = 'block';
      return;
    }
  }

  prompt.style.display = 'none';
}

function abrirNota(note) {
  readingNote = true;
  note.read = true;
  const totalRead = loreNotes.filter(n => n.read).length;
  document.getElementById('notes-val').innerText = `${totalRead}/4`;
  document.getElementById('interaction-prompt').style.display = 'none';
  document.getElementById('note-title').innerText = note.title;
  document.getElementById('note-body').innerText = note.text;
  document.getElementById('note-modal').style.display = 'flex';
  tocarEfeitoSonoro('item');
}

function fecharNota() {
  readingNote = false;
  document.getElementById('note-modal').style.display = 'none';
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
  lifeYears = Math.min(100, lifeYears + (item.years || 0));
  hunger = Math.min(100, hunger + (item.hunger || 0));
  thirst = Math.min(100, thirst + (item.thirst || 0));
  if (item.battery) battery = Math.min(100, battery + item.battery);

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
  } else if (item.type === 'battery') {
    tocarEfeitoSonoro('item');
    mostrarPopupItem(`Recarregou Lanterna (+${item.battery}% Bateria)`);
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
  if (playerBoardedShip || (isHiding && !flashlightOn)) return;

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

  for (let m of quadrupedMonsters) {
    const dist = Math.hypot(px - (m.x + m.width / 2), py - (m.y + m.height / 2));
    if (dist < 28 && animFrame % 18 === 0) {
      lifeYears = Math.max(0, lifeYears - m.damage);
      flashDamage = 9;
      screenShake = Math.max(screenShake, 10);
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
      mostrarPopupItem(`SINAL DETECTADO NO SONAR: ${part.label}!`);
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

    ctx.fillStyle = `rgba(30, 26, 24, ${(1 - progress) * 0.48})`;
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
// CONSTRUÇÕES DESTRUÍDAS
// ==========================================
function desenharConstrucaoInterior(b) {
  const bx = b.x - camera.x;
  const by = b.y - camera.y;

  if (bx < -250 || bx > canvas.width + 250 || by < -250 || by > canvas.height + 250) return;

  const isInside = jogadorDentroDe(b);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(bx + 10, by + 12, b.w, b.h);

  ctx.fillStyle = b.type === 'clinic' ? '#262d33' : (b.type === 'house' ? '#27201b' : '#241d18');
  ctx.fillRect(bx, by, b.w, b.h);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.arc(bx + b.w * 0.35, by + b.h * 0.45, 24, 0, Math.PI * 2);
  ctx.arc(bx + b.w * 0.72, by + b.h * 0.68, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(10, 8, 6, 0.55)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(bx + 25, by + 30);
  ctx.lineTo(bx + 55, by + 58);
  ctx.lineTo(bx + 48, by + 82);
  ctx.moveTo(bx + b.w - 30, by + b.h - 25);
  ctx.lineTo(bx + b.w - 65, by + b.h - 55);
  ctx.stroke();

  if (b.type === 'house') {
    ctx.fillStyle = '#442c1e';
    ctx.save();
    ctx.translate(bx + b.w - 46, by + 42);
    ctx.rotate(0.28);
    ctx.fillRect(-16, -10, 32, 20);
    ctx.strokeStyle = '#1c120c';
    ctx.strokeRect(-16, -10, 32, 20);
    ctx.restore();

    ctx.fillStyle = 'rgba(127, 29, 29, 0.35)';
    ctx.fillRect(bx + 45, by + 55, 50, 34);
  } else if (b.type === 'clinic') {
    ctx.fillStyle = '#475569';
    ctx.fillRect(bx + b.w - 52, by + 18, 36, 18);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(bx + b.w - 48, by + 21, 24, 12);
  } else {
    ctx.fillStyle = '#573b22';
    ctx.fillRect(bx + 18, by + 20, 26, 26);
    ctx.strokeStyle = '#1f140b';
    ctx.strokeRect(bx + 18, by + 20, 26, 26);
  }

  ctx.fillStyle = '#4a3a30';
  ctx.fillRect(bx + 14, by + b.h - 22, 9, 7);
  ctx.fillRect(bx + b.w - 28, by + 16, 11, 8);
  ctx.fillRect(bx + b.w - 22, by + b.h - 26, 8, 8);

  const walls = obterParedesConstrucao(b);
  ctx.fillStyle = '#4c3b31';
  ctx.strokeStyle = '#140f0c';
  ctx.lineWidth = 2;

  for (let w of walls) {
    const wx = w.x - camera.x;
    const wy = w.y - camera.y;
    ctx.fillRect(wx, wy, w.w, w.h);
    ctx.strokeRect(wx, wy, w.w, w.h);
  }

  ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
  if (b.doorSide === 'bottom') {
    ctx.fillRect(bx + b.doorPos, by + b.h - 10, b.doorWidth, 10);
  } else if (b.doorSide === 'top') {
    ctx.fillRect(bx + b.doorPos, by, b.doorWidth, 10);
  } else if (b.doorSide === 'left') {
    ctx.fillRect(bx, by + b.doorPos, 10, b.doorWidth);
  } else if (b.doorSide === 'right') {
    ctx.fillRect(bx + b.w - 10, by + b.doorPos, 10, b.doorWidth);
  }

  if (b.onFire) {
    desenharFogoAnimado(bx + b.w - 28, by + 32, 0.9);
  }

  ctx.fillStyle = isInside ? '#00ff88' : '#d6c3b3';
  ctx.font = '8px "Press Start 2P"';
  ctx.fillText(isInside ? `${b.title} (INTERIOR)` : b.title, bx + 8, by - 7);
}

function desenharTetosConstrucoes() {
  for (let b of buildings) {
    if (jogadorDentroDe(b)) continue;

    const bx = b.x - camera.x;
    const by = b.y - camera.y;
    if (bx < -250 || bx > canvas.width + 250 || by < -250 || by > canvas.height + 250) continue;

    ctx.fillStyle = 'rgba(30, 23, 19, 0.9)';
    ctx.beginPath();
    ctx.rect(bx + 10, by + 10, b.w - 20, b.h - 20);
    ctx.moveTo(bx + 28, by + 28);
    ctx.lineTo(bx + b.w - 48, by + 24);
    ctx.lineTo(bx + b.w - 26, by + b.h - 42);
    ctx.lineTo(bx + 36, by + b.h - 32);
    ctx.closePath();
    ctx.fill('evenodd');

    ctx.strokeStyle = '#1c140f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx + 22, by + 40);
    ctx.lineTo(bx + b.w - 30, by + 65);
    ctx.moveTo(bx + 45, by + b.h - 28);
    ctx.lineTo(bx + b.w - 40, by + 30);
    ctx.stroke();
  }
}

function desenharEsconderijos() {
  for (let hs of hidingSpots) {
    const sx = hs.x - camera.x;
    const sy = hs.y - camera.y;
    if (sx < -80 || sx > canvas.width + 80 || sy < -80 || sy > canvas.height + 80) continue;

    if (hs.type === 'locker') {
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.fillRect(sx, sy, hs.w, hs.h);
      ctx.strokeRect(sx, sy, hs.w, hs.h);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx + 6, sy + 7, hs.w - 12, 3);
      ctx.fillRect(sx + 6, sy + 13, hs.w - 12, 3);
    } else {
      ctx.fillStyle = '#44403c';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy + hs.h);
      ctx.lineTo(sx + 10, sy + 4);
      ctx.lineTo(sx + hs.w - 8, sy + 8);
      ctx.lineTo(sx + hs.w, sy + hs.h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

function desenharDiariosChao() {
  for (let note of loreNotes) {
    const nx = note.x - camera.x;
    const ny = note.y - camera.y;
    if (nx < -80 || nx > canvas.width + 80 || ny < -80 || ny > canvas.height + 80) continue;

    ctx.fillStyle = note.read ? 'rgba(168, 162, 158, 0.25)' : 'rgba(250, 204, 21, 0.3)';
    ctx.beginPath();
    ctx.arc(nx, ny, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = note.read ? '#a8a29e' : '#fef08a';
    ctx.fillRect(nx - 6, ny - 7, 12, 14);
    ctx.fillStyle = '#44403c';
    ctx.fillRect(nx - 4, ny - 4, 8, 1.5);
    ctx.fillRect(nx - 4, ny - 1, 7, 1.5);
    ctx.fillRect(nx - 4, ny + 2, 8, 1.5);
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

  const shipY = sy - shipLiftOffset;
  const shakeX = (isLaunching || playerBoardedShip) ? (Math.random() - 0.5) * 4.5 : 0;
  const shakeY = isLaunching ? (Math.random() - 0.5) * 3 : 0;
  const cx = sx + escapeShip.width / 2 + shakeX;
  const cy = shipY + escapeShip.height / 2 + shakeY;

  if (isLaunching || playerBoardedShip) {
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

  if (playerBoardedShip) {
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

  if (!playerBoardedShip) {
    ctx.fillStyle = parts >= 3 ? '#00ff88' : '#ffcc00';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText(`NAVE AURORA (${parts}/3)`, sx - 16, sy - 6);
  }
}

function desenharCenario() {
  for (let gd of groundDetails) {
    const gx = gd.x - camera.x;
    const gy = gd.y - camera.y;
    if (gx < -60 || gx > canvas.width + 60 || gy < -60 || gy > canvas.height + 60) continue;

    if (gd.type === 'crater') {
      ctx.fillStyle = 'rgba(8, 5, 4, 0.45)';
      ctx.beginPath();
      ctx.ellipse(gx, gy, gd.r, gd.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(8, 5, 4, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + gd.r, gy + gd.r * 0.5);
      ctx.lineTo(gx + gd.r * 1.4, gy - gd.r * 0.2);
      ctx.stroke();
    }
  }

  for (let b of buildings) {
    desenharConstrucaoInterior(b);
  }

  desenharEsconderijos();
  desenharDiariosChao();

  for (let c of wreckedCars) {
    desenharCarroDestruido(c);
  }

  for (let fp of footprints) {
    ctx.fillStyle = `rgba(8, 5, 4, ${(fp.life / 90) * 0.48})`;
    ctx.beginPath();
    ctx.arc(fp.x - camera.x, fp.y - camera.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let sw of soundWaves) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${sw.alpha * 0.32})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sw.x - camera.x, sw.y - camera.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
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
  } else if (item.type === 'battery') {
    ctx.fillStyle = 'rgba(250, 204, 21, 0.32)';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1;
    ctx.fillRect(screenX - 4, screenY - 5, 8, 10);
    ctx.strokeRect(screenX - 4, screenY - 5, 8, 10);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(screenX - 2, screenY - 7, 4, 2);
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

    ctx.fillStyle = 'rgba(14, 10, 8, 0.92)';
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 4);
    ctx.fill();

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(item.label, screenX, tagY + 14);
    ctx.textAlign = 'left';
  }
}

function desenharMonstroQuadrupede(m) {
  const screenX = m.x - camera.x;
  const screenY = m.y - camera.y;

  if (screenX < -100 || screenX > canvas.width + 100 || screenY < -100 || screenY > canvas.height + 100) return;

  const facing = m.facing || 1;
  const cycle = animFrame * (m.wasChasing ? 0.42 : 0.18);
  const strideFront = m.isMoving ? Math.sin(cycle) * 8 : 0;
  const strideBack = m.isMoving ? Math.cos(cycle) * 8 : 0;
  const spineWave = m.isMoving ? Math.sin(cycle * 2) * 2.5 : 0;

  const cx = screenX + m.width / 2;
  const cy = screenY + m.height / 2;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 2.2;

  const backHipX = cx - facing * 14;
  const backFootX = backHipX - facing * 6 + strideBack;
  ctx.beginPath();
  ctx.moveTo(backHipX, cy + spineWave);
  ctx.lineTo(backHipX - facing * 10, cy - 6);
  ctx.lineTo(backFootX, cy + 13);
  ctx.stroke();

  const frontShoulderX = cx + facing * 13;
  const frontFootX = frontShoulderX + facing * 7 + strideFront;
  ctx.beginPath();
  ctx.moveTo(frontShoulderX, cy - spineWave);
  ctx.lineTo(frontShoulderX + facing * 9, cy + 3);
  ctx.lineTo(frontFootX, cy + 13);
  ctx.stroke();

  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.moveTo(cx - facing * 18, cy + 2 + spineWave);
  ctx.quadraticCurveTo(cx, cy - 11 - spineWave, cx + facing * 16, cy - 1);
  ctx.lineTo(cx + facing * 12, cy + 6);
  ctx.quadraticCurveTo(cx, cy + 2, cx - facing * 16, cy + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#71717a';
  ctx.lineWidth = 1.4;
  for (let r = -8; r <= 6; r += 5) {
    ctx.beginPath();
    ctx.moveTo(cx + r, cy - 5 - spineWave * 0.5);
    ctx.lineTo(cx + r - facing * 2, cy - 10 - spineWave * 0.5);
    ctx.stroke();
  }

  const headX = cx + facing * 20;
  const headY = cy + 2 - spineWave;
  ctx.fillStyle = '#27272a';
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 8, 5.5, facing * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(headX + facing * 4, headY - 1.5, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.beginPath();
  ctx.arc(headX + facing * 4, headY - 1.5, 6, 0, Math.PI * 2);
  ctx.fill();
}

function desenharPersonagemDetalhado(worldX, worldY, char, isMoving, isZombie = false, isNPC = false) {
  if (!isZombie && !isNPC && isHiding) return;

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

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
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

  const pantsColor = isZombie ? '#1c2419' : (char.pantsColor || '#1b222c');
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#0d0d0d';

  if (isZombie) {
    const stepFront = isMoving ? Math.max(0, Math.sin(cycle)) * 4 : 0;
    const dragLag = isMoving ? (6 + Math.sin(cycle) * 2) * facing : 4 * facing;

    ctx.fillStyle = '#161c14';
    ctx.beginPath();
    ctx.moveTo(cx - 2 * facing, screenY + 25 + bodyBob);
    ctx.lineTo(cx - 7 * facing, screenY + 25 + bodyBob);
    ctx.lineTo(cx - 7 * facing - dragLag, screenY + 37);
    ctx.lineTo(cx - 1 * facing - dragLag, screenY + 37);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = pantsColor;
    ctx.beginPath();
    ctx.roundRect(cx + (facing === 1 ? 0 : -6), screenY + 24 + bodyBob, 6, 11 - stepFront * 0.5, 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = pantsColor;
    ctx.beginPath();
    ctx.roundRect(cx - 7, screenY + 24 - bodyBob, 6, 11 + legSwing, 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(cx + 1, screenY + 24 - bodyBob, 6, 11 - legSwing, 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = isZombie ? '#3f5239' : char.skinColor;
  ctx.beginPath();
  ctx.roundRect(cx - 10, screenY + 14 - armSwing + (isZombie ? bodyBob : -bodyBob), 4, 11, 2);
  ctx.fill();

  const torsoY = isZombie ? screenY + 11 + bodyBob : screenY + 11 - bodyBob;
  const torsoOffset = isZombie ? facing * 2.5 : 0;
  ctx.fillStyle = isZombie ? '#293625' : char.shirtColor;
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
    ctx.fillStyle = '#4c1d1d';
    ctx.fillRect(cx - 3 + torsoOffset, torsoY + 5, 6, 4);
  }

  if (isZombie) {
    ctx.fillStyle = '#475c40';
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
  }

  const headX = cx + (isZombie ? facing * 3 : 0);
  const headY = isZombie ? screenY + 5 + bodyBob : screenY + 5 - bodyBob;

  ctx.fillStyle = isZombie ? '#4b6144' : char.skinColor;
  ctx.beginPath();
  ctx.arc(headX, headY, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isZombie ? '#1c211b' : (char.hairColor || '#1c1613');
  ctx.beginPath();
  ctx.arc(headX, headY - 1.5, 7.6, Math.PI, 0);
  ctx.fill();

  const eyeShift = facing * 2;
  if (isZombie) {
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(headX - 2 + eyeShift, headY + 0.5, 1.5, 0, Math.PI * 2);
    ctx.arc(headX + 2.5 + eyeShift, headY + 0.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#111';
    ctx.fillRect(headX - 2.5 + eyeShift, headY - 0.5, 2, 2.2);
    ctx.fillRect(headX + 1.5 + eyeShift, headY - 0.5, 2, 2.2);
  }

  if (isNPC) {
    const floatY = Math.sin(animFrame * 0.1) * 2;
    ctx.fillStyle = '#facc15';
    ctx.font = '11px "Press Start 2P"';
    ctx.fillText('?', cx - 4, screenY - 8 + floatY);
  }
}

function desenharMinimapa() {
  if (!miniCtx) return;

  const mw = miniCanvas.width;
  const mh = miniCanvas.height;
  const scale = 0.038;

  const bgGrad = miniCtx.createRadialGradient(mw / 2, mh / 2, 10, mw / 2, mh / 2, mw * 0.7);
  bgGrad.addColorStop(0, '#17120e');
  bgGrad.addColorStop(1, '#080605');
  miniCtx.fillStyle = bgGrad;
  miniCtx.fillRect(0, 0, mw, mh);

  const cx = mw / 2;
  const cy = mh / 2;

  miniCtx.strokeStyle = 'rgba(217, 119, 6, 0.14)';
  miniCtx.lineWidth = 1;
  miniCtx.beginPath();
  miniCtx.moveTo(cx, 0); miniCtx.lineTo(cx, mh);
  miniCtx.moveTo(0, cy); miniCtx.lineTo(mw, cy);
  miniCtx.stroke();

  miniCtx.strokeStyle = 'rgba(217, 119, 6, 0.2)';
  miniCtx.beginPath();
  miniCtx.arc(cx, cy, 26, 0, Math.PI * 2);
  miniCtx.arc(cx, cy, 52, 0, Math.PI * 2);
  miniCtx.stroke();

  const sweepAngle = (animFrame * 0.03) % (Math.PI * 2);
  miniCtx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
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
      miniCtx.fillStyle = item.type === 'water' ? '#00ccff' : (item.type === 'battery' ? '#facc15' : '#ff9900');
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

  for (let m of quadrupedMonsters) {
    if (!m.wasChasing && lightningAlpha <= 0.1) continue;
    const mx = cx + (m.x - player.x) * scale;
    const my = cy + (m.y - player.y) * scale;
    if (mx >= 0 && mx <= mw && my >= 0 && my <= mh) {
      miniCtx.fillStyle = '#e879f9';
      miniCtx.beginPath();
      miniCtx.arc(mx, my, pulse + 1.5, 0, Math.PI * 2);
      miniCtx.fill();
    }
  }

  miniCtx.fillStyle = '#38bdf8';
  miniCtx.beginPath();
  miniCtx.arc(cx, cy, 3.8, 0, Math.PI * 2);
  miniCtx.fill();
}

function desenharIluminacaoEClima() {
  if (inIntro) {
    // Renderiza apenas a transmissão de vídeo em tela cheia da Sargento Sara
    desenharCenaCelularSara();

    if (lightningAlpha > 0) {
      ctx.fillStyle = `rgba(220, 235, 255, ${lightningAlpha * 0.25})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (flashDamage > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${flashDamage * 0.06})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      flashDamage--;
    }
    return;
  }

  for (let p of ashParticles) {
    ctx.fillStyle = p.isEmber ? 'rgba(255, 120, 30, 0.65)' : 'rgba(200, 190, 180, 0.25)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  const screenPx = player.x + player.width / 2 - camera.x;
  const screenPy = player.y + player.height / 2 - camera.y;

  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = canvas.width;
  lightCanvas.height = canvas.height;
  const lCtx = lightCanvas.getContext('2d');

  const baseDarkness = lightningAlpha > 0 ? Math.max(0.15, 0.85 - lightningAlpha) : 0.86;
  lCtx.fillStyle = `rgba(5, 4, 3, ${baseDarkness})`;
  lCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

  lCtx.globalCompositeOperation = 'destination-out';

  const selfGrad = lCtx.createRadialGradient(screenPx, screenPy, 20, screenPx, screenPy, 115);
  selfGrad.addColorStop(0, 'rgba(0,0,0,1)');
  selfGrad.addColorStop(1, 'rgba(0,0,0,0)');
  lCtx.fillStyle = selfGrad;
  lCtx.beginPath();
  lCtx.arc(screenPx, screenPy, 115, 0, Math.PI * 2);
  lCtx.fill();

  const batteryFlicker = battery < 20 ? (Math.sin(animFrame * 0.7) > -0.3) : true;
  if (flashlightOn && battery > 0 && batteryFlicker && !playerBoardedShip) {
    const beamLen = battery < 25 ? 240 : 340;
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

  for (let f of activeFlares) {
    const fx = f.x - camera.x;
    const fy = f.y - camera.y;
    const fGrad = lCtx.createRadialGradient(fx, fy, 10, fx, fy, 175);
    fGrad.addColorStop(0, 'rgba(0,0,0,1)');
    fGrad.addColorStop(1, 'rgba(0,0,0,0)');
    lCtx.fillStyle = fGrad;
    lCtx.beginPath();
    lCtx.arc(fx, fy, 175, 0, Math.PI * 2);
    lCtx.fill();
  }

  ctx.drawImage(lightCanvas, 0, 0);

  if (lightningAlpha > 0) {
    ctx.fillStyle = `rgba(220, 235, 255, ${lightningAlpha * 0.28})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (flashDamage > 0) {
    ctx.fillStyle = `rgba(255, 0, 0, ${flashDamage * 0.08})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashDamage--;
  }
}

function desenhar() {
  if (inIntro) {
    desenharIluminacaoEClima();
    return;
  }

  ctx.fillStyle = '#140f0c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(217, 119, 6, 0.04)';
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

  for (let m of quadrupedMonsters) {
    desenharMonstroQuadrupede(m);
  }

  if (!playerBoardedShip) {
    desenharPersonagemDetalhado(player.x, player.y, player, player.isMoving, false, false);
  }

  desenharTetosConstrucoes();
  desenharIluminacaoEClima();
}