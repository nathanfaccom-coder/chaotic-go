# Chaotic GO v0.1.96 — proteção de ações entre salas

**31/10/2026 — progresso estimado: 97%.** Treino 3x3 permanece experimental.

## O que foi corrigido
- Cinco ações críticas do 3x3 (cancelamento, pagamento Mão Negra, gasto de carta, dano e passe defensivo) vinculam a requisição à sala, turno e tela de origem. Uma troca durante a consulta da fase impede uma mutação na sala errada.
- Respostas antigas dessas ações não reescrevem a interface após mudança de sala/turno.
- Passar turno, iniciar partida, encerrar partida e sair da sala usam o ID original e descartam respostas tardias.
- Erros de uma ação antiga não aparecem como erro da sala nova.
- Atualização de cache, login, scanner e inicialização para release-96.

## Validação e limites
Os testes automatizados cobrem troca de sala enquanto a fase é consultada e durante o avanço de turno. O servidor continua responsável pelas verificações de autorização e antirreplay. Nenhum arquivo original de cartas, artes, Decks ou registros do Supabase foi alterado. Teste manual em dois celulares ainda pendente.
