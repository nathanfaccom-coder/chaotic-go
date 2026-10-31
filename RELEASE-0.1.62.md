# Chaotic GO v0.1.62 — Consistência do fluxo PvP 3x3

**Data da implementação:** 30/10/2026 (horário local do Brasil).

## Problema encontrado
A RPC original `chaotic_pass_turn(uuid,integer)` validava o membro e o número do turno, e protegia a prioridade Burst 1x1, mas **não verificava** a conclusão de janelas defensivas nem efeitos de ataques do **treinamento 3x3**. Um jogador poderia avançar o turno após gastar uma carta sem aplicar o dano, sem aguardar a resposta defensiva ou sem decidir a opção do Vento Forte/SONAR. A interface escondia várias ações após a vitória, mas a RPC também precisava recusar o avanço.

## Alterações efetivas
- Migração aplicada no Supabase: `supabase/chaotic-preview-3x3-turn-pass-safety-v0162.sql`.
- `chaotic_pass_turn` reforçada **somente quando `lobby.mode='3x3'`** para recusar troca de turno se:
  1. `chaotic_preview_3x3_training_outcomes` já registra um resultado do treinamento;
  2. `chaotic_preview_3x3_defense_windows` está aguardando o defensor;
  3. `chaotic_preview_3x3_attack_spends.training_damage_applied=false` após uma carta ter sido paga;
  4. Vento Forte (105) ainda tem decisão de revelação opcional pendente;
  5. SONAR (110) ainda precisa concluir a busca privada de carta.
- A carta **107 — Armadilha de Vinha** não é bloqueada simplesmente por `effects_fully_resolved=false`, porque seu efeito já marcado como *parcial* inclui bloqueio futuro de ataque/compra; impedir o turno nessa situação travaria a partida. A restrição 107 foi preservada.
- Os controles do DROME usam as mesmas condições para ocultar o botão de passar turno, e `updateMatchUI()` agora é executado após toda sincronização das janelas de defesa e gastos. O botão **Encerrar teste** permanece acessível ao membro quando o resultado experimental foi registrado, permitindo fechar a sessão sem criar vitória oficial.
- Preservados os fluxos 1x1 Burst/Mugics e 6x6, cartas originais, imagens, Decks, HP oficial, XP, moedas e efeitos previamente implementados.

## Testes executados
- `supabase/tests/chaotic-preview-3x3-turn-pass-integrity-live.test.sql`: **PASS** no Supabase real. Reexecuta **12 cenários de ataque**, tenta passar após gasto sem dano, com defensor aguardando, com revelação 105 pendente, busca 110 pendente, e após um resultado de treinamento registrado, verificando rejeição; confirma passagem legal após ataques 107/111/112 e encerramento explícito da sessão. Contas, salas e eventos fictícios criados e revertidos em `BEGIN/ROLLBACK`. O caso de *resultado registrado* verifica o guard isoladamente com uma linha sintética ligada a uma janela defensiva válida; **não pretende simular três nocautes completos**.
- `supabase/tests/chaotic-preview-3x3-turn-pass-audit.test.sql`: **PASS**, verifica as cláusulas de segurança de turno, restrição ao modo 3x3, preservação de Burst/Mugics 1x1 e existência da proteção de resultados.
- `tests/turn-pass-safety-v0162.test.mjs`: seis regressões novas; `tests/terminal-actions.test.mjs` atualizado para exigir o estado de controle sincronizado ao final de todas as consultas.
- CI GitHub Actions da implementação: **139/139 testes aprovados e sintaxe válida**. Versão visível no DROME/index e cache PWA alterados para v0.1.62.

## O que ainda falta
Esta versão fecha a integridade da **troca de turno** no modo experimental 3x3; ela não equivale a uma partida real ponta a ponta com dois celulares. As demais cartas/efeitos, Mugics, equipamentos e condições de vitória **oficial** continuam incompletas. GitHub Pages aparece habilitado no repositório, mas o URL público não pôde ser verificado (a tentativa de acesso externo falhou), então **não há confirmação de publicação funcional**.

**Progresso geral estimado: 91% (±10 pontos percentuais), aproximadamente 9% restantes pela estimativa manual.** Não é uma medição de qualidade nem garantia de prontidão para entrega.
