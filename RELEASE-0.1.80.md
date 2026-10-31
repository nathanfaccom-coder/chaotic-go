# Chaotic GO v0.1.80 — preparação privada do Vento Forte emprestado

**Data:** 31/10/2026. **Progresso geral:** 97% (estimativa manual ±10 pontos percentuais), sem aumento automático.

## Novidade desta etapa

O jogador que conseguiu **Vento Forte (105)** através da **Mão Negra (102)** pode preparar uma **intenção privada de uso**, sem consumir a carta ou descontar pontos. Este é o primeiro passo persistente, com antirreplay, de uma futura resolução completa do ataque emprestado.

- Uma nova tabela `chaotic_preview_3x3_borrowed_105_plans` grava **apenas** ID da custódia temporária, atacante/defensor, turno, posições de combate, saldo de treinamento e prévia do HP do alvo. O dono da carta não é alterado.
- **RLS:** `authenticated` recebe somente `SELECT`, filtrado por `borrower_id=auth.uid()`. Não há `INSERT`, `UPDATE` ou `DELETE` diretos para clientes, nem permissão para visitantes anônimos.
- `chaotic_prepare_preview_3x3_borrowed_105(uuid,uuid,integer)`: verifica o atacante autenticado da vez, treino 3x3 ativo, contato ainda não comprometido, empréstimo legítimo anterior ao turno atual, dono original, bloqueios de ataque e saldo. Reusa a inspeção privada da v0.1.77, que confere álbum e catálogo originais. Um mesmo pedido repetido não cria nova intenção.
- `chaotic_cancel_preview_3x3_borrowed_105(uuid,integer)`: apenas o tomador na própria vez pode cancelar uma intenção ainda não paga. O registro cancelado não é reaproveitado no mesmo turno.
- **DROME:** ao escolher Vento Forte emprestado, o jogador tem os botões **Preparar (SEM gastar)** e **Cancelar preparação (SEM gastar)**. A tela recarrega a intenção privada do servidor após reconexão e mostra o valor previsto e HP hipotético.

## Validação

O script `supabase/tests/chaotic-preview-3x3-borrowed-105-private-plan-live-v0180.test.sql` foi executado no Supabase real com usuários sintéticos e `ROLLBACK`:

- rejeitou uso fora da vez;
- validou custo original **1**, dano-base **5**, pontos previstos **4** e HP hipotético **20→15**;
- rejeitou tentativa do dono da carta e de terceiros;
- confirmou privacidade do registro usando `SET LOCAL ROLE authenticated` e RLS;
- confirmou idempotência e bloqueio de repetição após cancelamento;
- confirmou que o pagamento, o HP e o estado original de empréstimo **não mudaram**.

Regressões adicionais: `tests/black-hand-borrowed-105-intent-v0180.test.mjs`.

## Importante — o que ainda NÃO está implementado

**Preparar a intenção não é usar a carta.** O Vento Forte emprestado continua **sem pagamento e sem dano reais**. Falta autorizar o pagamento da carta temporária e construir a janela defensiva e a resolução definitiva de seus efeitos, incluindo nocaute, revelação opcional e devolução segura da custódia, com provas de não duplicação.

Os ataques originais, imagens, álbuns, Decks, combates 1x1/6x6, XP, moedas e resultados oficiais permanecem preservados. Também faltam Aliança (103), Armadilha de Víbora (106), revisão de regras e segurança do servidor e homologação simultânea em dois celulares físicos.

**Esta versão não significa que o jogo esteja pronto ou homologado.**
