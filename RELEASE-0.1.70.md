# Chaotic GO v0.1.70 — Fogo Primordial 2.0 (104) com dado no servidor

**Data:** 31/10/2026 (America/Sao_Paulo). **Escopo:** treinamento experimental 3x3; arte, cartas, álbuns, Decks e combate oficial preservados.

## Regra conferida no catálogo original

O cadastro de ataque `104` é **Fogo Primordial 2.0**, dano-base **5**, custo **2**; descrição original: o jogador rola um dado de seis lados e **multiplica o resultado pelo dano-base**, gerando o dano total. O catálogo de inspeção 3x3 registra `six_sided_base_multiplier`. Assim, dano bruto de treino **5, 10, 15, 20, 25 ou 30**. O HP real perdido fica limitado ao HP que ainda restava ao defensor; não há dano oficial.

## Implementado no servidor Supabase

- `supabase/chaotic-preview-3x3-fire-104-v0170.sql`: função `chaotic_apply_preview_3x3_training_fire_104(uuid,integer)` usa `random()*6` no **servidor PostgreSQL** e guarda a face em `chaotic_preview_3x3_training_damage_events.fire_die_roll`. Só o atacante autenticado e com o turno corrente, pagamento correto, defesa passada, inspeções de criaturas/elementos e **defensor sem equipamento** pode aplicar dano.
- Dados e HP são modificados na **mesma transação**; o evento contendo o dado é inserido antes da atualização do HP para que o gatilho de nocaute confira o dano contra a mesma face persistida. Uma falha reverte tanto o evento quanto o HP. O número **não é fornecido pelo cliente** e não pode ser alterado com um novo clique.
- `chaotic_record_preview_3x3_training_knockout` confere o registro do dado do servidor e a fórmula `5 × dado` quando há nocaute com ataque 104. As restrições do banco incluem `fire_die_roll` entre **1 e 6**, apenas para 104; dano até 30; faixa de HP derrotado até 30; e `resolution_status='training_fire_104_die_resolved'`.
- `supabase/chaotic-preview-3x3-spend-104-v0170.sql`: o pagamento experimental passa a permitir `104`, mantendo proteção contra carta ausente da mão, débito duplicado e falta de pontos. A carta original e recursos oficiais não são modificados.
- A RPC de dano é executável por `authenticated`, **não** por `anon`; dentro da função, a autorização é restrita ao atacante correto da sala e do turno.

## DROME (interface)

- `chaotic-lobby.js` reconhece `104` como ataque experimental resolvível.
- O mesmo botão de resolução do ataque chama a RPC de dado do servidor. **Não** usa rolagem local nem aceita um número digitado.
- Mostra o valor rolado, o produto `5 × face`, o HP antes/depois e o dano realmente causado. A consulta do histórico inclui `fire_die_roll` para reapresentar a mesma face após reconexão.
- Indicadores de cache/versão atualizados para **v0.1.70** no `index.html`, `sw.js`, `scanner.html`, `scanner-completo.html` e `full-game-bootstrap.js`.
- Todos os arquivos de imagens, áudios, cartas, Decks e dados oficiais foram preservados.

## Testes

**Teste de integração real:** `supabase/tests/chaotic-preview-3x3-fire-104-live-v0170.test.sql` — **PASS** no projeto Supabase ChaoticGO:
1. Conta não atacante tenta rolar e é rejeitada;
2. A função real de gasto do ataque **104** consome exatamente **2 pontos apenas de treino** e move a carta da mão privada para gasta;
3. A função real de dano faz a rolagem, grava o resultado entre 1 e 6, calcula `5 × dado`, nocauteia a criatura fictícia com 5 HP;
4. Uma segunda tentativa no mesmo turno é rejeitada pelo **antirreplay**, sem outro dano/rolagem;
5. Dois ataques 105 nos turnos seguintes mantêm os três nocautes válidos, determinando corretamente vitória e derrota;
6. Toda a transação é revertida com `BEGIN/ROLLBACK`. Conferência posterior encontrou **zero contas fictícias e zero resultados de teste persistentes**.

`tests/fire-primordial-v0170.test.mjs` acrescenta cinco regressões sobre fórmula, restrições, permissões, resultado real e UI/PWA. **181/181 testes automatizados aprovados**, sem falhas, incluindo sintaxe JS, no GitHub Actions run `41191274264`.

## Auditoria e limites

- Consultado no banco: execução anônima da nova RPC **bloqueada**. Auditoria do Supabase ainda registra **75 avisos** sobre funções privilegiadas disponíveis a usuários autenticados; exigem revisão individual. Também permanecem 7 tabelas RLS sem política de acesso direto (privadas) e alerta de proteção contra senhas comprometidas.
- `random()` é um gerador pseudoaleatório adequado para um jogo casual; não deve ser anunciado como rolagem criptograficamente auditável para apostas.
- **Somente treinamento 3x3**. Não introduz equipamentos ou Mugics oficiais; o servidor exige defensor sem equipamento experimental para este cálculo. Não promete todas as condições de combate oficial.
- **Não foram usados dois celulares físicos** nem duas conexões concorrentes independentes no teste; o cenário de integração usa contas autenticadas simuladas e transação revertida.
- O catálogo original tem quinze ataques; com o 104, são **nove** ataques com resolução de dano experimental disponível. Os outros seis continuam apenas consultáveis/projetáveis, sem gasto no treino até receberem resolver específico.

**Progresso geral estimado: 97% (±10 pontos percentuais)**, indicador manual de planejamento, não garantia de que o PvP oficial esteja pronto.

**Próximo foco:** testar a rolagem e os conflitos em conexões SQL realmente simultâneas; continuar os seis ataques pendentes, equipamentos/Mugics e homologar o PWA em dois dispositivos reais.
