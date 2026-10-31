# Chaotic GO v0.1.84 — vitória terminal por Vento Forte emprestado

**Data:** 31/10/2026. **Estimativa do projeto:** 97% (margem ±10 pontos percentuais; não significa homologação). **Modo afetado:** apenas treinamento experimental 3x3.

## Entrega principal

Quando o **Vento Forte (105)** obtido temporariamente pela **Mão Negra (102)** derruba a **terceira criatura** da equipe adversária, o servidor registra o resultado final **somente do treinamento** e devolve **todos os ataques emprestados ainda pendentes**, não apenas o último utilizado. Esse fluxo continua sem vitória oficial, dinheiro, XP, alteração de álbum ou descarte permanente da carta original.

1. A origem do resultado final é auditada por `chaotic_validate_3x3_training_outcome_source()`: turno autenticado, duas equipes originais, três HP zerados e nocaute comprovado por ataque original ou temporário. Para o ataque emprestado, exige recibo único de pagamento, 5 de dano-base, plano já concluído, custódia devolvida e carta original reintegrada ao dono. Resultado fabricado é rejeitado.
2. `chaotic_preview_3x3_training_outcomes` não cria uma janela artificial de defesa de uma carta da mão original. Mantém FK para o **contato legítimo** do turno e usa auditoria por gatilho da origem da carta, preservando ambos os tipos de combate.
3. O gatilho de nocaute emprestado cria seu registro específico sem substituir o nocaute da carta normal. A função de pagamento finaliza custo de 1 ponto, dano-base de até 5 HP, nocaute/recibo, devolução da carta usada e **só então** cria o resultado terminal de treinamento.
4. O gatilho `chaotic_restore_3x3_loans_before_training_outcome()`, já existente, valida e devolve os demais empréstimos legítimos na mesma transação. Qualquer erro na integridade de uma segunda carta faz a operação inteira falhar (inclusive o custo e o HP), sem deixar vitória parcial.
5. O DROME passa a mostrar **“Vitória no treino 3x3”** quando `training_outcome_recorded=true`, indicando devolução de todos os empréstimos, sem XP, moedas ou vitória oficial. Os rótulos do Vento Forte emprestado deixam de indicar que o terceiro nocaute está indisponível.
6. Atualizados `index.html`, `sw.js`, scanners e `full-game-bootstrap.js` para a versão **0.1.84**.

## Testes concluídos com Supabase real

Todos os testes SQL abaixo usam transações **ROLLBACK** e usuários de teste sintéticos:

- `supabase/tests/chaotic-borrowed-105-terminal-outcome-live-v0184.test.sql`: terceiro nocaute (5 → 0 HP), custo de ataque 4 → 3, exatamente um resultado de treino, duas cartas temporárias legitimamente emprestadas restauradas, sem XP/moedas, sem replay e sem passagem de turno após o resultado. **PASS**.
- `supabase/tests/chaotic-borrowed-105-final-team-outcome-v0184.test.sql`: segundo cenário independente com dois empréstimos, vitória restrita ao treino, custódias liberadas e álbum original preservado. **PASS**.
- `supabase/tests/chaotic-borrowed-105-lethal-rejection-v0182.test.sql`: o teste histórico passou a verificar empréstimo adicional corrompido: o terceiro nocaute é rejeitado sem pagamento, dano parcial ou perda da primeira carta. **PASS**.
- `supabase/tests/chaotic-preview-3x3-three-knockouts-live-v0163.test.sql`: três nocautes **com cartas próprias**, nos turnos 1, 3 e 5, continuam registrando resultado correto. **PASS**.
- `supabase/tests/chaotic-borrowed-105-atomic-base-live-v0182.test.sql`: ataque emprestado não letal ainda funciona e devolve a carta. **PASS**.

A suíte Node de regressão inclui `tests/black-hand-borrowed-105-final-outcome-v0184.test.mjs` e os testes anteriores. **270/270 aprovados** no último teste da revisão.

## Limitações que permanecem

A resolução do Vento Forte emprestado segue restrita ao treinamento **sem equipamento defensivo** e **sem a revelação opcional do Vento Forte**. Outras cartas emprestadas ainda não possuem a resolução completa de custo/efeito. As cartas Aliança (103), Armadilha de Víbora (106), equipamentos, Mugics e diversas regras oficiais seguem pendentes. Também faltam auditoria completa de permissões/RLS e testes de combate real simultâneo em dois celulares.

**Progresso geral estimado: 97%.** Nenhuma arte, álbum, Deck, mecânica 1x1/6x6 ou economia oficial foi removida ou alterada.
