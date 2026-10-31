# Chaotic GO v0.1.60 — Corrigida a resposta bruta de inspeção dinâmica

**Implementação:** 30/10/2026 — histórico de desenvolvimento do projeto.

## Problema identificado
Embora a v0.1.58 tivesse revogado o acesso do cliente às tabelas brutas de elementos e implementado uma leitura filtrada dos históricos, a RPC original `chaotic_inspect_preview_3x3_dynamic_elements(uuid,integer)` **ainda podia ser executada diretamente por um defensor autenticado**. Ela retornava um registro inteiro, incluindo `attacker_guru_support_count` e `attacker_guru_air_candidate`, que revelavam se a equipe adversária possuía um Guru oculto. Proteger só a tabela não bastava: uma `SECURITY DEFINER` exposta também é uma fonte de dados.

## Correção aplicada
- Migração instalada `supabase/chaotic-preview-3x3-private-dynamic-rpc-response-v0160.sql`.
- A função original continua existindo para preservar a verificação canônica de catálogo, HP, turno, defesa, Naty e Guru, mas **EXECUTE foi revogado de `PUBLIC`, `anon` e `authenticated`**. Nenhum cliente consegue chamar diretamente sua resposta bruta.
- Nova RPC `chaotic_inspect_preview_3x3_dynamic_elements_safe(uuid,integer)`, executável somente por jogadores autenticados. Chama internamente o cálculo original e entrega apenas o registro do turno, filtrado pela `chaotic_get_preview_3x3_safe_inspections`. As mesmas proteções de turno, janela defensiva, autenticação, sala, integridade, HP e antirrepetição permanecem ativas.
- `chaotic-lobby.js` atualizado para chamar exclusivamente a função filtrada e **não transformar o valor oculto `null` em falso**. A interface informa quando a existência de Guru na equipe adversária está protegida, sem expor contagens.
- Nenhuma imagem, carta, Deck, dano, HP oficial, pontuação, moeda, XP ou mecânica original foi alterada.
- Tela de login e cache PWA passam a versão **0.1.60**.

## Validações realizadas
- Migração Supabase **aplicada**.
- `supabase/tests/chaotic-preview-3x3-dynamic-rpc-safe-live.test.sql`: **PASS**; execução real no banco com 12 cenários de combate, conferindo que o próprio defensor pode executar uma inspeção com resultado filtrado, obtém dados legítimos da sua equipe, **não recebe a contagem de Guru da equipe oculta**, e uma nova tentativa no mesmo turno é rejeitada. Todo o estado de teste foi criado em `BEGIN/ROLLBACK`.
- `supabase/tests/chaotic-preview-3x3-dynamic-rpc-safe-audit.test.sql`: **PASS**; privilégios de execução, função filtrada, RLS e ausência de transmissão Realtime dos dados brutos.
- `tests/dynamic-rpc-response-privacy.test.mjs`: cinco novos testes de regressão. CI GitHub Actions da implementação **127/127 testes aprovados**, verificação de sintaxe aprovada.

## Limitações e próximos passos
A correção elimina o vazamento por esta **RPC específica**, mas não é prova de auditoria completa de todos os eventos e funções. Permanecem pendentes outras cartas e efeitos do 3x3, sistema oficial de vitória e combate, testes entre dois celulares reais e confirmação da publicação GitHub Pages. Não afirmar que o jogo está publicado/100% funcional sem validação externa.

**Estimativa manual de progresso geral: 89% ±10 pontos percentuais, cerca de 11% restantes.** Este percentual não equivale a uma medição automatizada da qualidade ou do escopo faltante.
