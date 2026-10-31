# Chaotic GO v0.1.56 — Revelação opcional do Vento Forte (105)

**Data:** 30/10/2026.

## Funcionalidade de treinamento 3x3
- A carta original **Vento Forte** (ID 105, custo 1, 5 de dano-base) permite, após um ataque bem-sucedido e com dano positivo, **revelar exatamente um campeão adversário virado para baixo ou dispensar o efeito**.
- Adicionado registro de estado de face por posição c4, c5 e c6 em `chaotic_preview_3x3_face_states`. A formação começa virada para baixo; combatentes envolvidos em um contato viram para cima, como já ocorre no motor original (`batalha.js`). Os demais ficam elegíveis para o Vento Forte enquanto ainda vivos e virados para baixo.
- A RPC autenticada `chaotic_resolve_preview_3x3_vento_reveal` verifica dono do turno, sala, dano 105 previamente pago/aplicado, alvo adversário vivo, estado virado para baixo, e impedimento de replay. Atualiza o estado de face, conclui o efeito na linha de dano e registra uma decisão em `chaotic_preview_3x3_vento_reveal_events`. Se o jogador dispensar, a decisão é registrada e o efeito é finalizado **sem revelar mais nenhum campeão**.
- O DROME agora mostra os estados de face e oferece escolha/dispensa de revelação. Os nomes adversários ainda virados para baixo são **mascarados visualmente** no histórico de formação/HP.
- **Limitação de privacidade importante:** o sigilo de identidades NÃO está concluído. A tabela anterior `chaotic_preview_3x3_allies` continua expondo nomes aos membros via API; logo o novo verso é um **estado visual do treinamento**, não um mecanismo seguro de ocultação contra um usuário técnico. A arquitetura de dados/RLS precisará ser corrigida antes de declarar uma função de blefe/identidade oculta completa. Não se deve anunciar esse modo como ocultação real.
- Nenhum arquivo original `cartas.js`, arte de carta, álbum, Deck, pontuação, XP ou HP oficial foi modificado.

## Supabase e regressões
- Migração `supabase/chaotic-preview-3x3-vento-105-face-down-reveal.sql` aplicada. Gatilhos de inicialização de face e revelação por contato; tabelas com RLS de leitura pelos membros e sem gravações diretas dos clientes.
- Integração SQL real `supabase/tests/chaotic-preview-3x3-vento-105-reveal-real-integration.test.sql`: **PASS**, com 12 cenários de combate, atacante revelando posição c5, verificação de c4 já revelado por contato, adversário sem permissão, alvo inválido e proteção contra replay.
- Integração SQL de dispensa `supabase/tests/chaotic-preview-3x3-vento-105-skip-real.test.sql`: **PASS**, sem novas criaturas viradas para cima e sem reabertura do efeito.
- Auditoria SQL `supabase/tests/chaotic-preview-3x3-vento-105-face-down-audit.test.sql`: **PASS**, conferindo RLS, concessões, gatilhos, requisitos do ataque e preservação do HP oficial.
- `tests/vento-105-reveal.test.mjs` acrescenta 6 regressões e testes/mocks anteriores foram atualizados. GitHub Actions da implementação: **105/105 testes PASS**, sintaxe aprovada.
- Estado de face não funciona ainda como proteção contra extração de nomes pela API original. Vitória oficial, Mugics, demais ataques, equipamentos e partidas PvP reais em dois celulares continuam pendentes. Publicação real no GitHub Pages ainda não confirmada.

**Estimativa de conclusão geral: 85% (±10 p.p.), 15% restantes.** Métrica manual aproximada, não significa motor final testado.
