# Chaotic GO v0.1.57 — Proteção real de identidades ocultas no TREINO 3x3

**Data da implementação:** 30/10/2026 (America/Sao_Paulo).

## Problema corrigido
Na v0.1.56, o DROME escondia visualmente o nome de um campeão adversário virado para baixo, porém o membro podia obter o nome, o ID original e dados capazes de identificar o campeão diretamente nas consultas Supabase/Reatime. A ocultação visual não era segurança.

## Implementação aplicada
- Migração `supabase/chaotic-preview-3x3-facedsafe-state-v0157.sql` aplicada ao Supabase existente.
- **RLS com leitura direta somente do proprietário** em cinco tabelas: `chaotic_preview_3x3_allies`, `chaotic_preview_3x3_hp_wallets`, `chaotic_preview_3x3_board_positions`, `chaotic_preview_3x3_move_events` e `chaotic_preview_3x3_token_transfers`. São preservados os registros originais e as operações servidoras de combate.
- **Remoção dessas cinco tabelas do Supabase Realtime:** nenhum dado bruto com nome, ID de instância, HP inicial ou valores de fichas é transmitido publicamente por esses canais. O DROME já possui fallback de consulta periódica de 6 segundos para acompanhar a sala.
- Nova função autenticada `chaotic_get_preview_3x3_safe_state(lobby_id)`, SECURITY DEFINER com `search_path=''`, confirmação de pertencimento pela sessão `auth.uid()` e `chaotic_match_turns`. Reconstitui os dados do treino em cinco coleções, mas não retorna aos adversários identificadores de cartas, nomes, Deck original ou fichas de campeões com `face_up=false`. Também oculta HP detalhado e entrega apenas informação vivo/nocaute para controlar as ações permitidas do tabuleiro. Campeões já revelados e campeões próprios continuam completos.
- **DROME atualizado:** não consulta mais as cinco tabelas confidenciais diretamente; usa a função com máscara do servidor, mostra HP oculto dos campeões ainda virados para baixo e não escreve “Alakazaz” em transferências cuja identidade não foi revelada. Nenhuma imagem original ou mecânica oficial foi alterada.

## Verificações
- **Teste SQL transacional real**: `supabase/tests/chaotic-preview-3x3-facedsafe-state-live.test.sql` — **PASS**, com dois usuários sintéticos autenticados, primeira criatura adversária virada para baixo e segunda já revelada. Confirma 3/6 linhas visíveis nas cinco tabelas protegidas pelo RLS, segredo do nome/ID/Deck/HP do adversário oculto no retorno do RPC, conteúdo completo para dono/slot revelado, bloqueio para terceira pessoa não membro e ausência das cinco tabelas no Realtime. Transação `BEGIN/ROLLBACK`: não deixa usuários, Decks ou salas reais alterados.
- **Seis testes Node**: `tests/facedown-safe-state.test.mjs` validam política de proprietário, publicação, máscara de dados, autenticação e integração no DROME.
- **GitHub Actions:** **111/111 testes aprovados**, sintaxe limpa na implementação, antes do bump final de release.
- PWA `sw.js` e tela `index.html` atualizados para v0.1.57.

## Limitações e próximos riscos
Esta atualização protege as **principais tabelas brutas de formação/HP/movimento**. Uma auditoria de privacidade completa do ecossistema e das demais tabelas históricas ainda é necessária, especialmente para inferências por habilidades, atributos elementais, HP ou efeitos antes da revelação e para as diferenças entre DROME e combate oficial. O teste autenticado no banco não substitui o teste de dois celulares nem verifica o deploy GitHub Pages. O motor oficial, demais cartas/Mugics, equipamentos e condições de vitória oficiais continuam incompletos.

**Progresso global aproximado: 86% (±10 pontos percentuais), ~14% restantes.** Estimativa manual de desenvolvimento, não garantia de prontidão ou segurança total.
