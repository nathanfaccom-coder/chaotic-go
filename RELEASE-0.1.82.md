# Chaotic GO v0.1.82 — primeiro uso com custo e dano de Vento Forte emprestado

**Data:** 31/10/2026. **Progresso global:** 97% (estimativa manual, ±10 p.p., não significa homologação). **Escopo:** combate experimental 3x3; originais de usuário e PvP oficial permanecem preservados.

## Concluído nesta versão

A Mão Negra (102) já realiza um empréstimo temporário em ambiente de treino. O Vento Forte (105) emprestado já tinha prévia, planejamento e prioridade defensiva. **Agora é possível resolver sua versão restrita de dano-base e cobrança reais no treinamento**, apenas quando o alvo não tem equipamento e possui MAIS de 5 HP (não letal).

- A função `chaotic_settle_preview_3x3_borrowed_105_base(uuid,integer)` verifica o atacante autenticado na vez, custódia ainda válida e realmente emprestada pelo defensor, carta original no álbum/dono e no catálogo, contato e HP idênticos ao planejamento, custo original 1, saldo suficiente, passe do defensor e ausência de conflito com ataques e janelas simultâneas.
- Verifica novamente o **Deck original do defensor** e recusa sem cobrança se existir qualquer equipamento na criatura alvo ou se o ataque provocaria nocaute. Confere que o dano é neutro 5, sem qualquer efeito elemental extra. A revelação opcional do Vento Forte **não é realizada** nesta modalidade restrita.
- **Transação única:** desconta **1 ponto de ataque**, aplica **5 de dano-base não letal** ao HP de treinamento, registra um recibo privado e devolve a **mesma carta original** ao Deck do jogador de quem foi emprestada. Repetições falham, e qualquer erro em uma etapa reverte tudo. Não modifica álbum, Deck permanente, moedas, XP, HP oficial ou vitória oficial.
- `chaotic_preview_3x3_borrowed_105_base_events`: tabela restrita por RLS e sem acesso de escrita para o navegador, contendo custo, HP e vínculo com custódia. Impede dois recibos para a mesma custódia.
- O estado `base_resolved_no_optional_reveal` só pode coexistir com `payment_applied=true` e `damage_applied=true`, por restrições SQL. Qualquer estado anterior exige ambos falsos.
- A rotina original `chaotic_pass_turn` aceita o turno concluído **somente** quando houver recibo verificável, custódia devolvida, custo e dano coerentes. Todos os controles preexistentes de outras formas de combate, Burst, Mugics e turnos pendentes permanecem.
- O DROME exibe o botão de resolução somente para o tomador após o passe defensivo; informa limites, custo, HP, devolução ao dono e a ausência de revelação opcional. O relatório de estado passa a mostrar os verdadeiros campos de cobrança e dano.

## Testes SQL reais, revertidos

1. `supabase/tests/chaotic-borrowed-105-atomic-base-live-v0182.test.sql`: com duas contas sintéticas, o atacante não pôde pagar antes do passe e o defensor não pôde executar a carta. Após o passe correto, custo **4→3**, HP **20→15**, devolução ao Deck do dono, evento único, antirreplay e passagem de turno **3→4**. Sem alteração do álbum. **PASS**.
2. `supabase/tests/chaotic-borrowed-105-equipped-rejection-v0182.test.sql`: alvo com equipamento — pagamento, HP e empréstimo inalterados. **PASS**.
3. `supabase/tests/chaotic-borrowed-105-lethal-rejection-v0182.test.sql`: alvo com 5 HP (nocaute potencial) — pagamento, HP e empréstimo inalterados. **PASS**.

Todos os testes foram realizados em transação revertida por **ROLLBACK**, sem criar contas permanentes ou consumir cartas de jogadores reais.

As verificações automatizadas da versão também incluem `tests/black-hand-borrowed-105-atomic-base-v0182.test.mjs` e regressões anteriores.

## Limitações a resolver na próxima etapa

**Ainda não é a execução completa da carta original.** O uso emprestado **não suporta nocaute, equipamento nem a revelação opcional do Vento Forte**; não é permitido no PvP oficial. Para esses casos, o servidor recusa a transação antes de gastar pontos. A prioridade seguinte é integrar as regras de defesa, nocaute/resultado e efeitos opcionais sem criar caminhos paralelos inconsistentes.

Outras pendências: Aliança (103), Armadilha de Víbora (106), equipamentos e Mugics, auditoria das RPCs privilegiadas, homologação simultânea em dois celulares e regras oficiais completas.

**Nenhuma arte, carta, Deck, álbum, mecânica 1x1/6x6 ou inventário original foi removido.**
