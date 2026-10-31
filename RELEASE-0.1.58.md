# Chaotic GO 0.1.58 — Auditoria de vazamentos indiretos no 3x3

**Data da atualização:** 30/10/2026 (horário local do projeto).

## Problema identificado
As tabelas `chaotic_preview_3x3_creature_element_checks` e
`chaotic_preview_3x3_dynamic_element_checks` estavam liberadas por RLS de
leitura para ambos os membros. Suas linhas contêm nomes/IDs e elementos de
criaturas, indicadores de Naty e contagens/ativação de **Guru**, que podiam
revelar um suporte ou uma criatura virada para baixo sem usar a tabela da
formação. As duas tabelas também estavam no Supabase Realtime.

## Alterações efetivas (treino 3x3, Supabase)
- Migração `supabase/chaotic-preview-3x3-indirect-element-history-privacy.sql`
  aplicada: remove políticas de leitura ampla, revoga `SELECT` de clientes
  nessas duas tabelas e as retira da publicação `supabase_realtime`.
- RPC autenticada `chaotic_get_preview_3x3_safe_inspections(lobby_id)`:
  só permite membros confirmados da partida e entrega JSON com lista restrita
  de campos, não snapshots brutos. Nomes, elementos básicos, indicadores
  de Rex e de Naty são mascarados quando a criatura adversária não está
  revelada. Contagens e indicadores de Guru e de Ar por suporte do
  adversário permanecem `null` enquanto houver **algum companheiro
  ainda virado para baixo**.
- Migração de reforço
  `supabase/chaotic-preview-3x3-indirect-element-history-hardening.sql`
  aplicada: o Guru não é denunciado por registros antigos mesmo se um
  companheiro escondido já estiver nocauteado; a máscara depende da
  revelação, não do HP atual.
- `chaotic-lobby.js`: substituídas as duas leituras brutas pelo retorno
  da RPC e removidas as assinaturas Realtime; na interface são exibidos
  *Campeão oculto*, *elementos ocultos* e *informação parcialmente oculta*
  em vez de imprimir indicadores confidenciais ou confundir `null` com
  `false`. Polling existente continua atualizando o DROME.
- As cartas, imagens, Decks, HP oficial, pontuação e todas as regras de
  combate foram preservadas. Nenhum registro original de inspeção foi apagado.

## Validação
- `supabase/tests/chaotic-preview-3x3-indirect-element-privacy-live.test.sql`:
  **PASS**, com doze cenários de ataques anteriores reexecutados e teste
  adicional de inspeção por atacante, defensor e usuário fora da sala.
  Verifica segredo de criatura e de Guru na equipe ainda oculta. Tudo
  testado dentro de `BEGIN/ROLLBACK`, sem conservar usuários fictícios.
- `supabase/tests/chaotic-preview-3x3-indirect-element-privacy-audit.test.sql`:
  **PASS** para privilégios, ausência de publicação Realtime, máscara
  obrigatória de Rex/Guru/Naty e proteção de dados históricos.
- `tests/indirect-element-privacy.test.mjs`: seis regressões novas, junto
  com testes legados ajustados para exigir o acesso seguro, sem tentar
  consultar tabelas recém-protegidas. Cache/tela atualizados para 0.1.58.

## O que NÃO está concluído
Esta etapa protege especificamente **duas fontes indiretas** de identidades
e suporte elemental no treino 3x3. Uma auditoria completa de outros
registros, funções RPC, eventos antigos, inferências de cartas e
distribuição do aplicativo ainda falta. O combate oficial, Mugics,
equipamentos, toda a vitória oficial, uma partida real de ponta a ponta
em dois celulares e a publicação GitHub Pages seguem não verificados.

**Progresso estimado: 87% (±10 pontos percentuais)**, aproximadamente
13% restantes. Estimativa manual, não garantia de conclusão ou segurança
absoluta.
