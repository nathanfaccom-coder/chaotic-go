# Chaotic GO v0.1.100 — preparação 3×3 protegida de respostas atrasadas

**31/10/2026. Progresso estimado do projeto: 97%.**

## Correções de sincronização
- Os botões Pronto, Retirar pronto, Preparar formação, Preparar HP, Preparar tabuleiro, Mover criatura e Abrir contato agora capturam a sala, o turno e a geração da tela no início da ação.
- A requisição é enviada ao identificador original da sala, sem trocar para uma nova sala caso o jogador navegue enquanto aguarda a resposta.
- Uma resposta atrasada não sobrescreve a presença do adversário, não abre um refresh da partida nova e não mostra mensagem de sucesso incorreta.
- O botão manual de Atualizar conexão e turno também descarta avisos retornados de uma sala/turno anterior.
- Os novos testes simulam troca de sala durante RPC, teste de sucesso na sala correta e isolamento de mensagens, mantendo os testes existentes.
- Versão de login, scanner, bootstrap e Service Worker sincronizada para release-100.

## Garantias e pendência
Nenhuma tabela, arte original, carta, Deck, recompensa ou saldo do Supabase foi modificado. O servidor continua responsável pela autorização de cada jogada e pelo antirreplay. O 3x3 continua **treino experimental** até uma partida completa ser validada em dois celulares reais, incluindo uma desconexão e três nocautes.
