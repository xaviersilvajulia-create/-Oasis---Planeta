let planetScore = 100;
let comfortScore = 100;
let currentStep = 0;

const questions = [
  {
    time: "07:00 AM // HORA DE ACORDAR",
    text: "Você vai tomar banho para ir à escola. Qual é a sua escolha?",
    optA: { text: "Banho rápido de 5 minutos.", planet: 0, comfort: 10 },
    optB: { text: "Banho quente de 20 minutos relaxante.", planet: -15, comfort: 30 }
  },
  {
    time: "12:30 PM // HORÁRIO DO ALMOÇO",
    text: "Hora de comer! O que vai para o seu prato?",
    optA: { text: "Refeição caseira com legumes e sem desperdício.", planet: 10, comfort: 10 },
    optB: { text: "Fast-food cheio de embalagens plásticas descartáveis.", planet: -20, comfort: 25 }
  },
  {
    time: "02:00 PM // SUA LOCOMOÇÃO",
    text: "Você precisa ir encontrar seus amigos na cidade.",
    optA: { text: "Ir de bicicleta ou transporte coletivo.", planet: 20, comfort: -10 },
    optB: { text: "Pedir um carro por aplicativo individual.", planet: -25, comfort: 30 }
  }
];

function atualizarHUD() {
  planetScore = Math.max(0, Math.min(100, planetScore));
  comfortScore = Math.max(0, Math.min(100, comfortScore));

  document.getElementById('planet-bar').style.width = planetScore + '%';
  document.getElementById('planet-val').innerText = planetScore + '%';

  document.getElementById('comfort-bar').style.width = comfortScore + '%';
  document.getElementById('comfort-val').innerText = comfortScore + '%';
}

function escolher(opcaoIndex) {
  const q = questions[currentStep];
  const escolha = opcaoIndex === 0 ? q.optA : q.optB;

  planetScore += escolha.planet;
  comfortScore += escolha.comfort;
  atualizarHUD();

  currentStep++;

  if (currentStep < questions.length) {
    carregarPergunta();
  } else {
    finalizarJogo();
  }
}

function carregarPergunta() {
  const q = questions[currentStep];
  document.getElementById('card-time').innerText = q.time;
  document.getElementById('card-text').innerText = q.text;
  document.getElementById('optA-text').innerText = q.optA.text;
  document.getElementById('optB-text').innerText = q.optB.text;
}

function finalizarJogo() {
  let mensagemFinal = "";
  if (planetScore >= 70) {
    mensagemFinal = "CONQUISTA DESBLOQUEADA: Guardião do Planeta! Suas atitudes garantiram um futuro sustentável no OASIS e no mundo real.";
  } else if (planetScore >= 40) {
    mensagemFinal = "NÍVEL INTERMEDIÁRIO: Você equilibrou seu conforto com o ambiente, mas ainda há dados de poluição críticos.";
  } else {
    mensagemFinal = "ALERTA DE GAME OVER ECOLÓGICO: O planeta não suportará esse ritmo de consumo por muito tempo!";
  }

  document.getElementById('game-card').innerHTML = `
    <h2 class="time-tag">SIMULAÇÃO CONCLUÍDA</h2>
    <p class="question-text">${mensagemFinal}</p>
    <p style="color: #00f3ff; margin-bottom: 15px;">Pontuação Final - Planeta: ${planetScore}% | Conforto: ${comfortScore}%</p>
    <button class="btn-oasis" onclick="location.reload()">REINICIAR SIMULAÇÃO</button>
  `;
}
