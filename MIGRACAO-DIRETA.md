# Chaotic GO — migração direta (30/10/2026)

**Site oficial**: `https://nathanfaccom-coder.github.io/chaotic-go/`.

Este lançamento promove a base completa com Decks, cartas, áudio, scanner, mapa, oficina, minigames e DROME, com autenticação e salvamento privado via Supabase. Os arquivos de código antigos foram preservados em uma branch de backup e no endereço `/legacy/`.

## Preservação
- Backup Git da publicação anterior: `backup/pages-before-direct-migration-2026-10-30`.
- Backup Git da `main` antiga: `backup/main-before-direct-migration-2026-10-30`.
- Tabelas Supabase existentes foram mantidas, sem DROP ou TRUNCATE e sem redefinir contas.
- Carta/álbum/perfil anteriores do **teste Supabase** são importados sem sobrescrever registros da versão completa.
- Os dados de um eventual **Firebase antigo** não foram copiados automaticamente: sua identidade Firebase é diferente da identidade Supabase. Preservamos o código antigo para permitir recuperação posterior, se necessário.

## Estado das mecânicas
- Restaurados os arquivos originais de Decks, batalha, cartas, áudio, mapa, scanner, minigames e interface.
- Decks compatíveis com `decks/<modo>_slot_<número>` e com nomes simplificados anteriores.
- O DROME de batalha multiplayer **não está totalmente migrado**; salas privadas e protótipos de turnos/cartas no Supabase estão em teste. Isso não é uma partida oficial.
- Sistema legado de trocas/amigos ainda possui referências Firebase e exige adaptação segura antes de transferir cartas entre contas.
- Não ativar economia/recompensas por RPCs de teste.

## Cache e PWA
O service worker de lançamento não armazena telas autenticadas nem JavaScript em cache, evitando login antigo/Firebase persistente. Para reinstalações antigas, recarregue a página principal.

## Testes
`node --test tests/*.test.mjs` com GitHub Actions e `node --check` nos módulos; testes em dois dispositivos reais ainda pendentes.

## Sincronização entre dispositivos (atualização 30/10/2026)
- A coleção privada `chaotic_game_nodes` foi habilitada no `supabase_realtime` e possui política RLS por proprietário.
- O adaptador `supabase-game-bridge.js` agora escuta INSERT/UPDATE/DELETE e notifica álbum, perfil e Decks, incluindo agrupamento da oficina.
- Salas DROME, turnos e eventos também recebem notificações em tempo real; a consulta a cada seis segundos permanece de reserva.
- As batalhas oficiais, trocas e recompensas **não** estão habilitadas: a sincronização transporta estado, mas não valida todas as regras antigas.
- Os testes automatizados simularam atualizações de duas sessões, filtragem por conta, mudanças de decks e liberação da conexão ao sair.

## Tabuleiro compartilhado de teste (fase de movimentação)
- A nova tabela `chaotic_preview_board` registra a posição de **uma criatura por jogador** e transmite mudanças via Supabase Realtime somente aos participantes autorizados.
- O posicionamento exige uma criatura declarada de um deck salvo; os hexágonos válidos são c6 no 1x1, c4–c6 no 3x3 e c1–c6 no 6x6.
- O servidor permite movimentação apenas entre vizinhos do próprio lado, uma vez por turno, e rejeita comandos fora da vez e turnos nulos.
- A prévia visual tem botões **Posicionar minha criatura** e **Mover para a casa escolhida**, além das duas áreas de hexágonos.
- Nenhuma carta, estatística, dano ou recompensa foi alterada. O tabuleiro oficial de combate ainda não recebe esses comandos; a integração com o motor completo permanece pendente.
- Testes automatizados e uma transação de verificação no Supabase validaram os bloqueios. Ainda não houve teste com duas contas reais.

## Encontro de criaturas e cartas originais (fase seguinte)
- A tabela `chaotic_preview_clashes` registra um **encontro de teste**, somente por RPC autenticada, após o servidor confirmar jogador da vez, duas criaturas posicionadas, carta de ataque declarada no próprio turno e adjacência real entre os dois lados do DROME.
- Regras originais de contato: 1x1 c6↔c6; 3x3 c4/c5↔c4/c5; 6x6 primeira linha c1/c2/c3 com os pares de `obterAdjacencias` em `batalha.js`.
- A prévia mostra o nome, a arte e a energia **base** das criaturas e o nome do ataque a partir do catálogo `cartas.js`, sem alterar suas definições.
- O confronto fica com `result='awaiting_original_engine'`: **não aplica dano, efeitos especiais, custos, vitória, cartas transferidas ou XP**. O motor oficial completo continua no projeto e precisa ser portado com validação no servidor antes da liberação de PvP.
- O catálogo é público; as informações apresentadas nesta etapa de testes não substituem a regra de criaturas ocultas do combate oficial.
- Testes no GitHub validam 1x1 com criaturas de duas contas simuladas, bloqueio de confronto repetido, jogador não autorizado e matriz de adjacência; teste real entre dois celulares ainda pendente.

## Prévia autoritativa de dano base (nova etapa)
- O Supabase recebe uma referência de **16 definições de ataque e 16 criaturas**, extraídas de `cartas.js`, sem reescrever o catálogo original.
- A tabela `chaotic_preview_damage`, com RLS, registra somente uma estimativa de `danoBase` e energia inicial. A API `chaotic_preview_calculate_base_damage` aceita apenas o atacante autenticado no turno de confronto já validado. Não altera HP, estado de batalha, XP, moedas nem cartas.
- O catálogo atual possui um conflito de identificador: **Fogo Primordial 2.0** e **Golpe de Bravura** têm o mesmo ID **104**. O servidor retorna `ambiguous_attack_id` e não calcula um valor arbitrário.
- Exemplo de referência: `Vento Forte` (ID 105) possui 5 de dano base, mas seu efeito especial e possíveis modificadores **não são aplicados**. A energia exibida é a energia **base** da criatura, não a energia real em jogo.
- Confrontos continuam no status `awaiting_original_engine`; danos elementais, atributos, equipamentos, bloqueios, cartas especiais, resolução definitiva, efeitos e mortes exigem portabilidade completa do motor.
- Testes automatizados cobrem uma carta com ID único, ID ambíguo, acesso de terceiro, repetição e nenhum estado de HP modificado. Consulta real ao Supabase validou 32 definições, acesso privado e proibição de operações sem partida/turno.

## Bônus elementais e checagens de atributos — prévia (30/10/2026)
- Revisão do `cartas.js`: **15 ataques ativos + 16 criaturas**. O “Golpe de Bravura” está apenas em um comentário de exemplo; uma referência erroneamente incluída nos testes anteriores foi retirada exclusivamente da tabela de referência. Nenhuma carta real, imagem ou inventário foi apagado.
- `chaotic_preview_card_reference` agora guarda os elementos e atributos **base** do catálogo e os elementos de dano dos ataques. Não lê nem altera o DNA individual de cada carta.
- A função privada `chaotic_reference_modifier_formula` calcula um subtotal demonstrativo de base + elemento correspondente + checagem de atributo presente no catálogo; ela bloqueia resultado final para o “Fogo Primordial 2.0”, que exige dado.
- `chaotic_preview_calculate_modifiers` permite que somente o atacante autenticado e no turno atual registre o subtotal depois de registrar o confronto e o dano base. Os resultados têm RLS privada, sem escrita direta pelo cliente.
- A interface mostra **Conferir bônus elementais e atributos** e o histórico. O valor NÃO altera HP, posição, cartas, recompensas, dados, equipamentos, imunidades, modificadores de local, habilidades ou estado oficial de combate.
- Uma transação SQL com rollback e testes Node verificaram, entre outros exemplos, Lion + Ácido Gástrico = 10+5=15, Johnes + Armadilha de Vinha = 5+5=10, bônus de coragem maior/menor e bloqueio de resultados de dado.
- Ainda é necessária a migração completa e validada do motor oficial antes de habilitar batalhas PvP com dano verdadeiro.
