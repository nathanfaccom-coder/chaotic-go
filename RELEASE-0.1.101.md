# Chaotic GO v0.1.101 — encerrar sala sem bloquear a próxima partida

**31/10/2026. Progresso geral estimado: 97%.**

## Correção
- Corrigido um problema no encerramento da sala privada: o código anterior avançava a geração da tela, mas a ação ainda conservava o bloqueio de botões, impedindo criar/entrar em outra sala até reabrir o DROME.
- Agora, após a confirmação do servidor, o DROME é reconstruído com a tela inicial limpa. A reconstrução elimina bloqueios, fila antiga de atualização, indicadores de presença e qualquer estado privado do combate 3x3 da sala encerrada.
- Um erro ao encerrar ou sair da sala mantém a partida atual intacta, sem apagar o código local nem fingir sucesso.
- Quatro testes verificam encerramento pelo anfitrião, saída pelo convidado, criação imediata de outra sala, limpeza da UI e falha de encerramento.
- Marcadores de cache, login, scanner e módulos atualizados para release-101.

## Preservação e limite
Nenhuma arte, carta, Deck, banco de dados, SQL, XP ou moeda foi alterada. A reconstrução limpa exclusivamente o estado temporário de tela. O treino 3x3 permanece experimental até a homologação com dois celulares reais, incluindo partida completa, queda de conexão e três nocautes.
