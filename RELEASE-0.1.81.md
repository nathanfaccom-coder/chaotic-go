# Chaotic GO v0.1.81 — janela defensiva do Vento Forte emprestado

**Data:** 31/10/2026. **Progresso global:** 97% (estimativa manual com incerteza de ±10 p.p., não homologação). **Ambiente:** Supabase ChaoticGO + GitHub Pages.

## Entregue

A carta **Mão Negra (102)** pode roubar temporariamente um ataque no treinamento desde a v0.1.79. A v0.1.80 permite preparar a intenção privada do **Vento Forte (105)** recebido. A v0.1.81 acrescenta a **resposta de prioridade defensiva** para essa intenção, sem debitar pontos nem aplicar dano.

- **Estados do servidor:** `planned`, `awaiting_defender`, `defender_passed_preview` e `cancelled`, com horários do pedido e da resposta, sujeitos a restrições SQL de consistência.
- **Abrir prioridade:** `chaotic_open_preview_3x3_borrowed_105_priority(uuid,integer)`. Confere o tomador autenticado na vez, partida e contato corretos, custódia ainda `held`, prova no álbum original, catálogo Vento Forte custo 1/dano-base 5, pontos disponíveis, HP previsto inalterado e inexistência de outra projeção, gasto ou janela. A ação **não gasta nada**.
- **Passe do defensor:** `chaotic_pass_preview_3x3_borrowed_105_priority(uuid,integer)`. Somente o verdadeiro defensor, enquanto o turno ainda pertence ao tomador, responde uma única vez. Não revela ID privado da carta e não aplica dano.
- **Cancelar reação:** `chaotic_abort_preview_3x3_borrowed_105_priority(uuid,integer)`. Somente o tomador na própria vez pode cancelar uma janela aberta ou já respondida, ainda sem pagamento. A carta segue emprestada em sua custódia legítima; devolução no fim da partida ou na recuperação de sala expirada continua preservada.
- **Proteção de turno e ataque:** gatilhos em `chaotic_match_turns`, `chaotic_preview_3x3_attack_projections` e `chaotic_preview_3x3_attack_spends` bloqueiam pular a reação pendente ou lançar outro ataque simultaneamente. Sem gasto de dinheiro, moedas, XP, HP, mão ou Deck oficial.
- **Consulta mínima de estado:** `chaotic_get_preview_3x3_borrowed_105_priority(uuid)` somente para participantes da sala, retornando estado e função de atacante/defensor, sem identificador da instância ou custódia. O plano detalhado continua RLS apenas do tomador.
- **DROME:** botões para solicitar reação, passar como defensor e cancelar. A consulta de estado só é feita quando há carta emprestada para a conta ou uma carta própria em estado `loaned`, preservando compatibilidade com partidas 3x3 comuns e testes anteriores.
- **PWA:** `index.html`, `sw.js`, scanners e carregador DROME sincronizados na v0.1.81.

## Validação

O SQL `supabase/tests/chaotic-borrowed-105-priority-live-v0181.test.sql` foi executado no Supabase, com duas contas sintéticas e transação revertida por `ROLLBACK`. Verificou: abertura restrita ao tomador, passe restrito ao defensor, rejeição de outsider, prioridade não repetível, impedimento de avanço prematuro do turno, bloqueio de outro ataque, estado sem vazamento de identificadores, cancelamento não repetível e integridade de pontos, HP e custódia.

**CI:** 244 testes automatizados aprovados, zero falhas após ajustes de compatibilidade de versão e da consulta de estado para combates sem empréstimos. Os testes Node incluem `tests/black-hand-borrowed-105-priority-v0181.test.mjs`.

## Ainda pendente

**Esta versão NÃO paga nem aplica o Vento Forte emprestado.** A rotina atual de nocaute foi construída para ataque da mão original; antes de debitar pontos, é necessário adaptar pagamento/defesa/dano/nocaute à custódia temporária, efeitos condicionais e eventual revelação do Vento Forte, com resolução transacional, antirreplay e devolução segura. É preferível rejeitar uma operação incompleta a prender uma carta ou descontar pontos indevidamente.

Continuam pendentes outras mecânicas oficiais (incluindo 103 e 106), auditoria das funções privilegiadas, revisão de equipamentos/Mugics e testes simultâneos com dois celulares reais. Álbuns, imagens, cartas, Decks, 1x1 e 6x6 originais permanecem preservados.
