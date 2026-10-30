# Chaotic GO — migração do jogo completo (em desenvolvimento)

Esta branch recupera a base de 89 arquivos do repositório principal de origem, incluindo **Decks**, montagem de decks, artes, áudio, DROME e batalha. Integra autenticação e progresso privado via Supabase ChaoticGO, sem apagar nem substituir a versão de teste atual publicada no GitHub Pages.

## Realizado
- Menu e tela completos de Decks restaurados.
- Salvar e carregar decks pelo caminho privado `jogadores/<usuário>/decks/<modo_slot>`, adaptado para `public.chaotic_game_nodes`.
- Migração não destrutiva de álbum, perfil e amigos do teste Supabase anterior para a nova tabela, caso ainda não existam nesse formato.
- Acesso protegido por login Supabase, RLS por usuário e controle de conta em Perfil.
- Criadas páginas independentes `login-completo.html` e `scanner-completo.html`.
- Código original de Firebase retirado de `script.js` nesta branch.

## Pendente — não publicar ainda
- Testes reais no navegador para Decks, inventário, GPS, música, DROME e persistência.
- Substituição do motor multiplayer Firebase por um backend seguro: salas, presença, amizades, trocas, turnos e resultados. A ponte atual **bloqueia operações em outras contas e salas** por segurança.
- Importação das contas/decks que existam no **Firebase original** exige um processo de migração verificado, não automático. Contas Firebase não são as mesmas identidades que Supabase.
- Verificação de integridade de dados e operações concorrentes, RLS, e proteção anti-trapaça antes de habilitar economia e trocas online.
- A segurança do Supabase reportou aviso de **proteção contra senhas vazadas desativada**; configurar no dashboard quando disponível.

**Status:** branch de desenvolvimento, sem GitHub Pages ativo e sem alteração da `main`. Não representa um jogo funcionalmente testado. O site atual publicado continua na branch `feature/contas-e-salvamento-supabase`.
