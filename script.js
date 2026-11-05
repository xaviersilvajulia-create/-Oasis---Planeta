let health = 80;
let energy = 100;
let dia = 1;

const acoes = {
  reciclar: { health: 15, energy: -20 },
  arvore: { health: 25, energy: -35 },
  fastfood: { health: -20, energy: -10 },
  carro: { health: -30, energy: -15 }
};

function executarAcao(tipo) {
  const acao = acoes[tipo];

  if (energy + acao.energy < 0) {
    alert("Sua energia acabou por hoje! Clique em 'AVANÇAR PARA O PRÓXIMO DIA' para recarregar.");
    return;
  }

  health = Math.max(0, Math.min(100, health + acao.health));
  energy = Math.max(0, Math.min(100, energy + acao.energy));

  atualizarInterface();
}

function passarDia() {
  dia++;
  energy = 100; // Recarrega energia para o novo dia
  // O planeta perde um pouco de saúde natural a cada dia sem cuidados
  health = Math.max(0, health - 10);
  
  atualizarInterface();
  alert(`Dia ${dia} iniciado! A energia foi restaurada.`);
}

function atualizarInterface() {
  // Atualiza as barras
  document.getElementById('health-bar').style.width = health + '%';
  document.getElementById('health-val').innerText = health + '%';

  document.getElementById('energy-bar').style.width = energy + '%';
  document.getElementById('energy-val').innerText = energy + '%';

  // Atualiza o estado visual do Avatar (Planeta)
  const avatar = document.getElementById('planet-avatar');
  const statusText = document.getElementById('planet-status-text');

  avatar.className = 'planet-core ';

  if (health >= 70) {
    avatar.classList.add('mood-healthy');
    statusText.innerText = `DIA ${dia} // ESTADO: PROSPERO`;
    statusText.style.color = "#00ff88";
  } else if (health >= 35) {
    avatar.classList.add('mood-warning');
    statusText.innerText = `DIA ${dia} // ESTADO: ALERTA`;
    statusText.style.color = "#ffe600";
  } else {
    avatar.classList.add('mood-danger');
    statusText.innerText = `DIA ${dia} // ESTADO: CRÍTICO`;
    statusText.style.color = "#ff0055";
  }
}