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

## Protocolo de turnos (fase 2)
- Banco: `public.chaotic_match_turns` com RLS de leitura para anfitrião e convidado; escrita direta proibida.
- RPCs: `chaotic_start_match` (somente anfitrião), `chaotic_pass_turn` (somente jogador da vez, com número esperado), `chaotic_stop_match` (participantes).
- O servidor define a vez e usa bloqueio transacional para impedir jogadas repetidas ou fora da ordem.
- O botão **Iniciar teste de turnos** aparece com dois jogadores; os comandos **Passar meu turno** e **Encerrar teste** podem ser usados para verificar sincronização.
- Isto NÃO é o motor oficial de combate: ainda não interpreta cartas, dano, efeitos, vencedores, XP ou recompensas. A batalha multiplayer legada permanece bloqueada.
- Testes de simulação aprovados no GitHub Actions. Ainda é necessário testar com duas contas reais em dois navegadores/celulares. A pasta `/complete` é uma prévia separada.

## Diário de ações e prévia de tabuleiro (fase 3)
- A tabela `chaotic_match_events` registra somente eventos **start**, **pass** e **stop**, atomicamente com a mudança de turno.
- O cliente só pode **ler** eventos de partidas em que participa; não há INSERT/UPDATE/DELETE de cliente.
- A sala mostra o anfitrião e convidado, o marcador de jogador ativo e os doze eventos mais recentes. Isso é uma **prévia**, não o tabuleiro de combate funcional.
- Encerrar uma sala ou o convidado sair durante uma partida encerra o teste, sem permitir reutilizar o duelo com outra pessoa.
- Ainda não há sincronização de criaturas, ataques, cartas, custos, efeitos, estatísticas ou recompensas.
