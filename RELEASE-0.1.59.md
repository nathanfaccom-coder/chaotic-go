# Chaotic GO v0.1.59 — Blindagem de vazamentos pela transferência de Alakazaz

**Data de lançamento do código:** 30/10/2026 — histórico de desenvolvimento.

## Vulnerabilidade corrigida
O 3x3 original contém **Alakazaz**, única criatura autorizada a doar uma ficha para outra criatura da mesma equipe. Na v0.1.58, o adversário podia consultar o histórico mascarado em `chaotic_get_preview_3x3_safe_state` e observar que uma transferência ocorreu, inclusive posições e turno, o que **identificava o doador** mesmo sem o nome. O `updated_at` da linha de uma criatura oculta também podia fornecer uma pista sobre quem mudou de estado.

## Correções aplicadas no Supabase
- Migração `supabase/chaotic-preview-3x3-alakazaz-transfer-existence-privacy.sql` aplicada. No retorno da RPC de estado, eventos de `chaotic_preview_3x3_token_transfers` ficam **totalmente ausentes** para o adversário enquanto o **doador permanecer virado para baixo**. Não se envia um objeto com campos `null` ou uma contagem de eventos ocultos.
- O dono mantém acesso integral às próprias transferências. Após o doador ser revelado em combate/Vento Forte, o adversário pode consultar o histórico de transferência; se a criatura recebedora ainda estiver oculta, a identidade e a contagem de fichas do recebedor continuam mascaradas.
- Migração `supabase/chaotic-preview-3x3-facedsafe-timestamps.sql` aplicada: `created_at` e `updated_at` de criaturas adversárias ocultas também retornam `null`, impedindo identificar o doador pelo instante de mudança de suas fichas. Não altera os valores reais no banco.
- Permanece a política `SELECT` em `chaotic_preview_3x3_token_transfers` apenas para `actor_id=auth.uid()`. Essa tabela continua fora do Realtime, não é lida diretamente pelo DROME, nem alterada por estas migrações.
- **Cartas, imagens, Decks, habilidades, efeitos já existentes e HP oficial preservados**. O projeto continua usando os dados públicos do tabuleiro no momento certo; a ocultação aqui é a existência de um efeito exclusivo antes de revelar o doador.

## Testes
- `supabase/tests/chaotic-preview-3x3-alakazaz-transfer-existence-live.test.sql`: PASS, testes reais dentro de uma transação revertida com dois usuários autenticados e um outsider; doador Alakazaz c6 oculto, evento totalmente invisível ao adversário, visível ao dono, depois revelação do doador com recebedor ainda oculto, e carimbos de data mascarados.
- `supabase/tests/chaotic-preview-3x3-alakazaz-transfer-existence-audit.test.sql`: PASS, autorizações, SQL da RPC, RLS e publicação Realtime.
- `supabase/tests/chaotic-preview-3x3-indirect-element-privacy-live.test.sql`: PASS novamente, com os **12 cenários de ataque** anteriores e proteção dos elementos/Guru.
- `tests/hidden-alakazaz-transfer.test.mjs`: cinco novas regressões de regras de mascaramento, condições de exibição, metadados, fixture autenticada e DROME. A suíte de CI é a fonte definitiva para o número final de testes.
- `index.html` e `sw.js` agora são identificados como v0.1.59, mantendo as imagens originais.

## Limitações honestas
Esta atualização fecha **dois caminhos específicos de inferência**; não afirma sigilo criptográfico de cada efeito do jogo. Outras mecânicas visíveis, como alterações de fichas em um destinatário já revelado, podem permitir deduções legítimas. Outras tabelas/RPCs ainda exigem auditoria. Não foi realizada partida real completa em dois aparelhos, nem concluído o motor oficial ou verificado deployment do GitHub Pages.

**Progresso geral estimado: 88% (±10 pontos percentuais), cerca de 12% restantes.** Estimativa manual da série de versões, não comprovação de prontidão para entrega.
