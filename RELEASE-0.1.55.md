# Chaotic GO 0.1.55 — Busca privada do SONAR

**Data:** 30/10/2026

## O que funciona agora
Após pagar SONAR (110) e resolver seu dano elemental no treinamento 3x3, o atacante pode consultar as cartas originais do próprio monte, escolher uma carta de ataque de **custo 1 ou inferior** (custo 0 também é permitido) e movê-la da pilha de treinamento para sua **mão privada**. Não retira nem altera a instância original do álbum e não modifica deck oficial, HP oficial, XP, moedas ou resultado da partida.

A RPC `chaotic_resolve_preview_3x3_sonar_search` valida a autenticação, o turno, a sala, o pagamento e a resolução anterior de dano SONAR, os dados originais do Deck e álbum, o custo canônico, o estado da carta no monte e o limite da mão de 5 cartas. Há uma única busca por turno, com evento imutável e proteção contra replay. O jogador pode encerrar a busca sem carta caso não exista alvo elegível ou a mão esteja cheia. A finalização registra `effects_fully_resolved=true` para o SONAR do treinamento, sem alterar o combate oficial.

## Segurança e privacidade
A tabela `chaotic_preview_3x3_sonar_search_events` possui RLS de leitura **somente pelo autor da busca**, sem INSERT/UPDATE/DELETE por clientes e sem publicação Realtime. O próprio catálogo das opções é retornado pela RPC apenas ao atacante autenticado na sua vez. O DROME usa uma seleção privada e segura, sem injetar nomes diretamente como HTML.

## Validação
Migração aplicada: `supabase/chaotic-preview-3x3-sonar-private-search.sql`. Auditoria SQL `supabase/tests/chaotic-preview-3x3-sonar-private-search-audit.test.sql`: **PASS**. Testes transacionais `supabase/tests/chaotic-preview-3x3-sonar-private-search-live.test.sql`: **PASS**, com 12 cenários de ataque, duas buscas bem-sucedidas (Vento Forte custo 1, SPEED custo 0), caso sem carta elegível (somente custos 2 e 3), bloqueio de acesso pelo adversário e da repetição. Dados sintéticos revertidos via BEGIN/ROLLBACK. A suíte Node/GitHub Actions da implementação passou **99 de 99 testes**, sintaxe aprovada.

## Limitações
Ainda faltam outros ataques, Mugics, efeitos de equipamentos, batalha/vitória oficial e testes reais entre dois celulares. O SONAR tem dano elemental e busca funcionando dentro do **treinamento 3x3 restrito**, não equivale a uma partida oficial finalizada. GitHub Pages ainda não confirmado como publicado.

**Progresso estimado:** 84% ±10 p.p., aproximadamente 16% restantes. Estimativa manual e sujeita a testes completos.
