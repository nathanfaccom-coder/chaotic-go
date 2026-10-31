# Chaotic GO v0.1.98 — reconexão sem bloquear a próxima sala

**31/10/2026. Progresso geral estimado: 97%.**

## Correções
- Reabrir o DROME após uma suspensão do navegador Android libera o bloqueio de botões pertencente à sessão antiga e desassocia a fila de atualizações daquela tela.
- Uma resposta tardia de ação não pode liberar o bloqueio de outra ação da sessão nova. O bloqueio é liberado somente quando a ação pertence à geração de tela atual.
- Um ciclo antigo de atualização deixa de consumir a fila de Realtime da nova sala; o ciclo pertence ao identificador original da sala e geração da tela.
- A recuperação de conflito de turno não publica avisos obsoletos se o jogador já entrou em outra sala.
- Identificadores de versão, cache, login, scanner e bootstrap sincronizados para release-98.

## Verificação e limites
Testes de regressão reproduzem duas ações sobrepostas por troca de sessão, retorno tardio do servidor, refresh antigo e fila de atualização recém-criada. Nenhum asset de carta, arte, Deck, tabela ou dado real do Supabase foi alterado. O combate 3x3 permanece experimental; uma partida completa em **dois celulares reais** continua necessária antes de homologar o multiplayer.
