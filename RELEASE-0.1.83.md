# Chaotic GO v0.1.83 — nocaute individual com Vento Forte emprestado

**31 de outubro de 2026 · progresso estimado: 97% (±10 p.p.)**

## Implementado

O Vento Forte (105) obtido temporariamente pela Mão Negra (102) já podia pagar 1 ponto, aplicar até 5 de dano-base sem equipamento e devolver a carta ao dono em uma transação atômica (v0.1.82). **Agora também pode nocautear individualmente uma criatura defensora com 1 a 5 HP no treino 3x3**, sem criar uma carta própria para o tomador.

- `supabase/chaotic-borrowed-105-knockout-ledger-v0183.sql`: nova tabela `chaotic_preview_3x3_borrowed_105_knockouts`, somente para o treinamento; `SELECT` protegido por RLS para os dois participantes; sem `INSERT/UPDATE/DELETE` pelo cliente; um registro por criatura derrotada e por turno. O recibo de dano-base passa a permitir HP zero e redução máxima de 5 sem saldo negativo.
- `supabase/chaotic-borrowed-105-knockout-trigger-v0183.sql`: adicionada uma ramificação autenticada ao gatilho existente de nocaute. A execução original do Vento Forte da mão própria permanece intacta; a ramificação emprestada valida passe defensivo, custódia `held`, identidade original da criatura, HP/dano, turno, empréstimo e ausência de nocaute duplicado. A tentativa de derrubar o **último integrante da equipe** continua bloqueada para não registrar uma vitória inconsistente.
- `supabase/chaotic-borrowed-105-knockout-settlement-v0183.sql`: o pagamento 1, dano-base até 5 (com mínimo de 0 HP), registro de nocaute quando aplicável e devolução da carta original acontecem na **mesma transação**. Se houver uma falha, nenhum dos efeitos é mantido.
- Interface DROME: o botão de resolução esclarece que nocaute individual já está disponível, mas nocaute final da equipe e equipamento ainda não. O histórico reúne nocaute normal e emprestado, identificando a origem da Mão Negra sem expor uma instância privada da carta. O resumo do golpe também marca **NOCAUTE** quando HP chega a zero.
- Os arquivos do site, scanner Android e cache PWA foram sincronizados em **0.1.83**. Cartas, artes, álbuns, Decks, lojas, XP e partidas oficiais não foram alterados.

## Testes efetivos no Supabase

Todos os testes usam usuários fictícios em uma transação **ROLLBACK**, sem alterações permanentes em contas de jogadores:

- `supabase/tests/chaotic-borrowed-105-single-ko-live-v0183.test.sql`: o atacante com Vento Forte emprestado espera o passe defensivo, paga **4 → 3**, nocauteia uma criatura de **5 → 0 HP**, gera exatamente um registro na tabela emprestada, não cria nocaute convencional, devolve a carta ao dono, bloqueia replay e avança o turno **3 → 4**. **PASS**.
- `supabase/tests/chaotic-borrowed-105-lethal-rejection-v0182.test.sql`: fixture atualizada para a situação em que as outras duas criaturas já estão derrotadas. O nocaute final é recusado antes de pagar, sem alterar HP, custódia ou álbum. **PASS**.
- `supabase/tests/chaotic-borrowed-105-atomic-base-live-v0182.test.sql`: o dano-base sem nocaute da versão anterior continua íntegro. **PASS**.
- `supabase/tests/chaotic-borrowed-105-equipped-rejection-v0182.test.sql`: defensor com equipamento ainda bloqueia o dano sem cobrar pontos. **PASS**.

A suíte Node inclui `tests/black-hand-borrowed-105-individual-ko-v0183.test.mjs` e regressões atualizadas. A confirmação de publicação é conduzida pelo CI do repositório.

## Limites e próximos passos

**Esta entrega não significa que todos os tipos de nocaute e todas as regras do Vento Forte estejam completos.** O último nocaute da equipe ainda requer integração com o resultado terminal e devolução de eventuais outras cartas emprestadas. Efeitos de equipamentos, revelação opcional da carta e demais cartas de combate ainda precisam de integração. Também faltam a revisão geral das funções privilegiadas, mecânicas oficiais e homologação com dois celulares simultâneos.

**Estimativa geral mantida em 97%**, não homologação nem promessa de jogabilidade oficial completa.
