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

**Status:** preview isolado em `https://nathanfaccom-coder.github.io/chaotic-go/complete/login-completo.html`, preservando a versão original na raiz e sem alterar `main`. Testes sintáticos e de simulação de banco não substituem testes reais com usuário logado.

## Progresso adicional
- Compatibilidade da leitura de coleção de decks: DROME consulta `decks` e recebe os registros `decks/<modo>_<slot>` agrupados.
- Simulação do adaptador validou salvar, listar, atualizar, excluir, isolamento por usuário e bloqueio de caminhos multiplayer inseguros (7 verificações).
- Assets JS da prévia com parâmetro de versão para evitar cache desatualizado.

## Salas privadas online (fase 1)
- Banco: `public.chaotic_lobbies` com RLS por participante e quatro RPCs autenticadas (`chaotic_create_lobby`, `chaotic_join_lobby`, `chaotic_close_lobby`, `chaotic_leave_lobby`). Escritas diretas na tabela são proibidas para o cliente.
- Novo botão **Sala privada (teste)** no DROME permite criar e entrar usando código aleatório de 12 caracteres. Atualização do status por consulta periódica.
- Nenhuma luta ou troca acontece nessa sala, e os fluxos legados de matchmaking permanecem bloqueados.
- Para teste real da união de dois jogadores, são necessárias duas contas distintas. Ainda não certificado em celulares diferentes.
