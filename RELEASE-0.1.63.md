# Chaotic GO v0.1.63 — Validação real do terceiro nocaute no treino 3x3

**Implementação:** 30/10/2026 (America/Sao_Paulo); execução técnica próxima da virada do dia UTC.

## O que foi entregue
- Criado o teste SQL `supabase/tests/chaotic-preview-3x3-three-knockouts-live-v0163.test.sql` no repositório principal.
- **PASS no Supabase ChaoticGO real:** duas identidades sintéticas autenticadas, sala 3x3, seis unidades com HP próprio, três ataques **105 (Vento Forte)** resolvidos pela RPC de dano do servidor, com nocautes nos turnos **1, 3 e 5**.
- Entre os nocautes, o teste resolve a decisão opcional do Vento Forte e usa `chaotic_pass_turn` pelo atacante e pelo defensor. O desfecho NÃO aparece no primeiro ou segundo KO; aparece exatamente depois do terceiro.
- O servidor recusa nova passagem de turno após o vencedor registrado. A RPC `chaotic_ping_preview_3x3_player` confirma **vitória para o anfitrião e derrota para o convidado**, consultadas separadamente.
- Um dos participantes pode fechar a sessão de teste com `chaotic_stop_match` sem transformar a vitória de treinamento em vitória oficial, XP ou moedas.
- Todas as contas, salas, ações, cartas de teste e resultados são criados em `BEGIN` e revertidos em `ROLLBACK`. Nenhum dado de jogador real é alterado pelo teste.
- Criado `tests/three-knockouts-v0163.test.mjs` com cinco regressões estáticas sobre o roteiro de integração, sincronização e isolamento de recompensas.
- `index.html` marcado como versão 0.1.63 e cache PWA `sw.js` atualizado para o identificador release-63.

## Escopo exato e limitações
Esta validação é **integração real de RPCs e triggers do banco**, não uma partida visual de ponta a ponta entre dois celulares. O teste planta previamente estado sintético autorizado de contato, carta paga e defesa resolvida; também reorganiza posições **apenas dos dados sintéticos**, para exercitar três alvos distintos na faixa de contato. Portanto não prova todas as etapas do scanner, escolha de cartas ou navegação por hexágonos na UI.

**Nenhum arquivo de imagem, carta original, Deck ou mecânica existente foi substituído.** O modo oficial, as recompensas e o 1x1/6x6 permanecem isolados.

## O que ainda está pendente
1. Partida ponta a ponta com dois celulares físicos (anfitrião e convidado), reconexão e estados visuais.
2. Confirmar que o link público do GitHub Pages carrega a versão correta e todos os assets.
3. Concluir efeitos de cartas, Mugics, equipamentos e vitória/recompensas do **combate oficial**.
4. Validar cenários reais adicionais de desconexão, corrida simultânea e recuperação.

**Progresso geral estimado: 92% (±10 p.p.)**, estimativa manual não auditada. O avanço de um ponto reflete a primeira prova de três nocautes no mesmo combate experimental, não conclusão do PvP oficial.
