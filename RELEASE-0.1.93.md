# Chaotic GO v0.1.93 — checkpoint seguro para dois jogadores

**31/10/2026. Progresso estimado: 97%.** O 3x3 segue em treinamento, não em modo oficial.

## O que mudou
- Os botões para passar o turno no 3x3 são ocultados até a consulta do servidor confirmar o turno correto e a fase `ready` ou `damage_settled`.
- Ações de ataque não ficam visíveis quando o checkpoint de reconexão está ausente, obsoleto ou indica partida encerrada.
- Respostas e inspeções do defensor exigem a fase `awaiting_defender` confirmada pelo servidor para o próprio jogador.
- Mensagem de reconexão explica claramente por que uma ação ficou bloqueada. Nenhuma tentativa de ataque ou pagamento é reenviada automaticamente.
- Abas, scanner, login, service worker e DROME compartilham a release-93. Não houve modificações de cartas, artes, Decks, banco ou recompensas.

## Testes reais do Supabase (transações com ROLLBACK)
- Dois jogadores, confirmação pronto/não pronto, presença obsoleta e bloqueio de terceiro: PASS.
- Sincronização de turno e recuperação após interrupção: PASS.
- Três nocautes nos turnos 1, 3 e 5, vitória consistente em ambas as contas, sem bônus oficial: PASS.

Todos os fixtures foram executados na base ChaoticGO com contas descartáveis; nenhuma alteração de teste foi persistida.

## Pendências
Os testes automatizados e fixtures SQL não substituem a verificação manual em dois celulares físicos (login, sala por código, Decks, ataques, defesa, desconexão e vitória). Não marcar multiplayer como homologado antes dessa validação.
