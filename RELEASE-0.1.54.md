# Chaotic GO 0.1.54 — SONAR e Rex (30/10/2026)

**Resultado implementado:** SONAR (110) agora resolve dano Terra/Ar **somente no treinamento 3x3**. O dano é 10 por Terra natural e 10 por Ar natural do atacante, conferidos com o catálogo original e o Deck salvo, com máximo de 20. Rex (card 13) possui imunidade total ao golpe que contém Ar, **inclusive à parcela Terra**, conforme o código original `batalha.js`. O Supabase registra separadamente o dano evitado e não altera HP ou cria nocaute quando o dano efetivo é zero.

**Segurança:** exige login, atacante da vez, ataque original pago, resposta defensiva encerrada, identidade de ambas as criaturas e HP de contato válidos, nenhum equipamento não resolvido, nenhum elemento progressivo de Naty ou bônus dinâmico de Guru para outra criatura. Não altera inventário, imagens, cartas, resultado oficial, XP ou moedas. Rejeita repetição do mesmo ataque.

**Não concluído:** o efeito de SONAR de buscar no Deck uma carta de ataque com custo até 1 ainda precisa de execução por uma RPC própria, com mão privada; o dano é o único efeito implementado no treinamento. Ainda faltam defesa de outros ataques elementais, equipamentos, Mugics, combate/vitória oficiais e teste ponta a ponta entre dois celulares.

**Arquivos:** `supabase/chaotic-preview-3x3-sonar-110-rex-immunity.sql`; `supabase/tests/chaotic-preview-3x3-sonar-110-rex-live-integration.test.sql`; `supabase/tests/chaotic-preview-3x3-sonar-110-rex-immunity.test.sql`; `tests/sonar-110.test.mjs`; `chaotic-lobby.js`; `index.html`; `sw.js`.

**Verificações:** Supabase, auditoria SQL PASS. Integração transacional PASS em **11 cenários de RPC**, incluindo SONAR com Guru/Ar ou Lion/Terra contra Rex (0 dano, sem nocaute) e contra outro defensor (10 de dano e nocaute). Todas as contas, salas e Decks de teste foram revertidos. GitHub Actions da implementação: **93/93 testes aprovados**, sintaxe aprovada. A publicação real no GitHub Pages continua não verificada.

**Progresso global estimado: 83% ±10 pontos percentuais**; aproximadamente 17% restantes. Estimativa manual, não uma medição automatizada.
