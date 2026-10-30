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

## Fogo Primordial 2.0 — dado autoritativo (fase de teste)
- `chaotic_preview_dice` registra um único resultado de dado 1d6 por confronto do ataque ativo ID 104; `chaotic_roll_preview_die` valida participante, turno e cálculo anterior, com bloqueio transacional anti-repetição.
- A multiplicação `danoBase × valorDoDado` reproduz essa etapa do `batalha.js`, mas os demais efeitos permanecem pendentes. **Não altera HP nem determina vencedor.**
- A API anônima e escrita direta estão proibidas; leitura somente com RLS de participantes. Há teste automático emulado e checagens negativas no banco, mas ainda faltam duas contas reais para teste completo.
- Uma estimativa geral com critérios ponderados está em `STATUS-PROJETO.md` (**53% de prontidão estimada para versão completa**).

## Ficha individual e equipamento do 1x1 (etapa de integração)
- A versão original de Decks salva o **ID único da carta capturada** (ex.: número gerado no scanner), diferente do ID do modelo no catálogo. A antiga prévia baseada apenas em IDs de catálogo não representa fielmente cartas reais.
- `chaotic_preview_loadouts` permite registrar, uma vez por jogador e por partida privada **1x1**, os atributos **c, p, s, v, e** da criatura individual do álbum, junto do equipamento efetivamente selecionado no Decks.
- `chaotic_capture_preview_loadout` confere autenticacão, turno, modo, deck salvo, seleção no c6, posição no tabuleiro, existência única no álbum e tipo das cartas. O equipamento segue a regra de slot/fallback do motor legado.
- A tabela possui RLS para os dois participantes, sem INSERT/UPDATE direto; um segundo registro pelo mesmo jogador é recusado.
- O botão **Preparar ficha da minha criatura** e as duas fichas aparecem em DROME → Sala privada (teste), com sincronização Realtime.
- **Não aplica dano/efeitos ou recompensas** e **não prova posse antifraude**: a coleção atual é gravável pelo próprio jogador. Antes de ativar PvP competitivo, será necessário criar emissão/transação autoritativa para cartas capturadas e resolver os IDs de instância dos ataques ao catálogo.
- A avaliação de prontidão do projeto continua 53%: mais uma dependência foi atendida, mas o combate completo ainda não foi habilitado nem validado em dois dispositivos.


## Cálculo experimental com DNA individual no 1x1 (versão 0.1.9 — 30/10/2026)
- A nova tabela `chaotic_preview_individual_damage` e a RPC `chaotic_calculate_individual_preview` exigem duas criaturas com fichas individuais congeladas, ataque individual validado, contato no tabuleiro e turno atual do atacante.
- A conta parte do **dano base do modelo** associado à carta realmente capturada, aplica os elementos base da espécie da criatura atacante e compara atributos `c/p/s/v` de ambas as cartas capturadas quando a carta de ataque exigir essa regra.
- A **energia inicial individual** `e` do defensor é usada apenas para exibir uma simulação de quanto sobraria após o subtotal. **Não existe alteração de HP, cartas, posicionamento, XP, moedas, vitória ou derrota.** Não é energia atual depois de múltiplas ações.
- Os ataques Fogo Primordial 2.0, Purgatório e Esqueleto permanecem com `special_resolution_required` e **não exibem subtotal de dano**, pois dependem de dado ou cemitério ainda não portados nesta API.
- Interface: **DROME → Sala privada (teste) → 1x1 → Simular dano com DNA no servidor**. As prévias antigas de catálogo permanecem no código, mas seus botões são ocultados no 1x1 para não confundir IDs de instâncias com IDs de modelos.
- Segurança: tabela com RLS apenas para participantes, proibição de INSERT/UPDATE/DELETE pelo navegador, RPC de escrita autorizada apenas para usuário autenticado no turno válido e bloqueio de cálculos repetidos.
- Testes do GitHub e transação SQL com rollback cobrem bônus elementais, comparação de DNA, ataques especiais e bloqueios básicos de acesso. **Ainda não houve teste ponta a ponta com duas contas em aparelhos reais.**
- Pendência crítica: a existência da carta no álbum/deck ainda não comprova emissão legítima, pois o cliente pode editar o próprio álbum. Por isso, manter combate e recompensas competitivas indisponíveis até construir emissão autoritativa e portar custos, imunidades, equipamentos, magias, locais, efeitos e vitória.

## Prévia de revelação de equipamentos e custo informativo (versão 0.1.10 — 30/10/2026)
- A tabela `chaotic_preview_equipment_reveals` registra uma única revelação por jogador e partida, vinculada à ficha preparada no Supabase. RPC de revelação valida autenticação, participante, turno, estado da sala e equipamento da carta capturada. Outros jogadores só enxergam o registro quando pertencem à mesma sala.
- O cálculo do DROME 1x1 considera apenas os equipamentos cuja revelação foi registrada: Bracelete de Cristal (+5 em ataque de Terra), Bracelete de Água (+5 em Água), imunidade de Ar do Rex ou do Amuleto do Vácuo e a supressão de bônus elementais pelo Anel Precioso. Os efeitos de energia do Anel (-15), Bomba de Fogo (+5) e efeitos não integrados **bloqueiam o total de dano e a energia restante da prévia**, evitando resultados falsos.
- O custo de ataque é extraído do modelo validado; **saldo de pontos de ataque, pontos ganhos, consumo do custo e cartas na mão NÃO estão sincronizados**. O jogo não deve autorizar uma jogada nem pagar recompensas com base nesta prévia.
- A revelação neste teste não ativa magias, Burst, dano de equipamentos, HP, XP ou dinheiro. Não substituir o motor legado por essas funções de prévia.
- Testes: `supabase/tests/chaotic-equipment-and-cost-preview.test.sql` é transacional com rollback; o GitHub Actions verifica o DROME, incluindo proprietários, turnos e tentativas duplicadas de revelação.

## Mão e pontos de ataque de teste no Supabase (versão 0.1.11 — 30/10/2026)

O 1x1 experimental agora possui `chaotic_preview_attack_wallets` e `chaotic_preview_attack_hand`, de leitura exclusiva para o dono via RLS. Após preparar sua criatura, o jogador pode preparar uma mão com **três primeiras cartas válidas do deck**, em ordem fixa de teste. Essa seleção **não substitui o embaralhamento e a compra aleatória oficiais**, nem autentica a origem da coleção: o álbum ainda é editável pelo usuário.

O saldo inicial experimental é 3 pontos, acrescido de 1 em cada retorno à própria vez depois de preparar a mão. Uma carta adicional é comprada pelo servidor em turno posterior, até atingir cinco na mão. A função `chaotic_spend_preview_attack` verifica turno, dono, confronto, identificação da carta individual, mão e saldo antes de marcar a carta como usada e debitar pontos **somente na carteira de teste**. A prévia de DNA de dano agora exige que esse pagamento tenha sido registrado no mesmo turno. Assim, não é mais possível gerar uma nova prévia individual sem validar o gasto experimental.

Os dados da mão de um jogador não são compartilhados com o adversário. Nenhuma dessas funções modifica energia real, pontos oficiais, XP, moedas, vitória, raridades ou cartas do álbum. Ainda faltam compra/embaralhamento aleatórios, geração de iniciativa, bloqueios de compra, efeitos de cartas e motor PvP definitivo. Verificação: `supabase/tests/chaotic-preview-attack-resources.test.sql` e testes Node do DROME.

## Embaralhamento privado dos ataques no 1x1 experimental (versão 0.1.12 — 30/10/2026)
- O servidor registra `draw_position` (ordem sorteada no momento da criação da mão) para cada instância capturada, sem modificar `card_slot`, o índice original da carta no Deck. A distribuição inicial e a compra seguinte acompanham `draw_position`.
- A tabela da mão agora tem política de leitura apenas para o próprio jogador e **somente** quando `card_state` é `hand` ou `spent`. O monte não é transmitido ao cliente antes da compra. `total_cards` fica na carteira para calcular a quantidade restante.
- Mãos experimentais que já existiam recebem `draw_position=card_slot` como migração conservadora, evitando apagar partidas de teste ou invalidar a mão que já tinha sido distribuída.
- Os testes SQL em `supabase/tests/chaotic-preview-server-shuffle.test.sql` verificam permutação, posições válidas, RLS, autenticação e escrita bloqueada. As verificações Node cobrem a ordem de compra e o bloqueio da visualização de cartas não compradas.
- **Não é combate oficial.** A posse dos itens ainda vem do álbum gravável pelo cliente; não existe prevenção completa de fraude, efeitos de compra bloqueada, descarte oficial, reembaralhamento do lixo, iniciativa, HP ou vitória.

## Descarte e reciclagem de cartas no 1x1 de teste (versão 0.1.13 — 30/10/2026)
- RPC `chaotic_discard_preview_attack`: permite ao dono descartar uma carta que esteja de fato na mão experimental em seu próprio turno, após sincronizá-la. O descarte não gasta pontos e não pode substituir um ataque declarado ou registrar dano.
- `spent_reason` distingue `attack` (jogada validada e paga) de `discard` (descarte voluntário); as funções de cálculo de dano agora exigem `attack` como motivo do gasto no mesmo turno.
- A reciclagem ocorre automaticamente **quando o monte acaba** e a compra da vez é permitida. As cartas de lixo recebem ordem aleatória renovada pelo servidor; nenhuma carta é criada ou apagada do álbum, deck ou coleção original. O contador `recycle_cycles` acompanha as reciclagens em uma mesma partida experimental.
- A função `chaotic_capture_preview_attack` foi reforçada para recusar ataques que não estão na mão já distribuída do jogador e sincronizada ao turno. Manipular as chamadas da interface não permite pular essa verificação.
- A tela exibe lixo, ciclos de reembaralhamento e comando de descarte. Mãos/monte permanecem privados. Cartas não compradas não são reveladas ao oponente.
- Teste de regressão: `supabase/tests/chaotic-preview-discard-recycle.test.sql` verifica RLS, restrição de escrita direta, razão do gasto e função de reembaralhamento. Os testes JavaScript com estado simulado cobrem descarte duplicado, tentativa do oponente, reciclagem e compra única por turno.
- **Atenção:** ainda é um módulo de teste, não o combate autoritativo completo; não cobre iniciativa, efeitos de cartas que bloqueiam compra e custos, danos reais, vitórias ou recompensas. Não há teste real concluído com duas contas em aparelhos diferentes.

## Iniciativa individual em prévia segura (versão 0.1.14 — 30/10/2026)
- `chaotic_preview_initiatives` e `chaotic_capture_preview_initiative` foram adicionadas ao Supabase. O servidor exige sala 1x1 ativa, ator no turno, confronto registrado, fichas de criatura realmente vinculadas a cada carta individual e ausência de cálculo duplicado.
- O motor original usa atributo de iniciativa definido pelo Local, com Velocidade como padrão, e desempate em favor de quem iniciou o confronto. A prévia atual implementa **somente o fallback de Velocidade**, que é corretamente rotulado como `no_location_speed_default`; não afirma que a iniciativa é oficial quando o Local exige outro atributo.
- Resultados podem ser consultados somente por participantes via RLS. Usuários anônimos e alterações diretas são bloqueados; a função de comparação rejeita valores inválidos e atributos ainda não implementados.
- A prévia **não** reordena turnos, concede pontos, altera estado de cartas, compra, HP, XP ou vitória. O futuro uso em combate real requer Local e confirmação completa dos gatilhos de habilidade (Armadilha de Vinha, Mão Eletrônica, Mão Mão), que dependem de dano final verificado.
- Testes: `supabase/tests/chaotic-preview-initiative.test.sql` e `tests/turns.test.mjs`. A automação do GitHub e o teste de dois celulares continuam necessários antes de tratar o 1x1 como pronto.

## Compatibilidade e sorteio de Local no 1x1 experimental (versão 0.1.15 — 30/10/2026)
- O editor original salva `decks/1x1_slot_1`, mas `chaotic_declare_combat_action` consultava `decks/1x1_1`. A RPC agora prefere `decks/<modo>_slot_<n>` e aceita o formato legado como fallback. A correção afeta apenas a consulta, não modifica arquivos salvos, cartas ou IDs.
- A RPC `chaotic_capture_preview_room_location` confere o ator atual, 1x1 ativo, confronto, duas fichas individuais correspondentes, Deck do atacante e a instância do Local no álbum antes de sorteá-la no servidor. O snapshot fica fixo na sala e a RLS expõe o resultado apenas aos participantes. É proibido forçar outro Local ou sortear após ter calculado uma iniciativa sem Local.
- Os três Locais do motor original são reconhecidos pelo nome e correspondência de ID: Cidade de Kiru (501 → Sabedoria), O Túnel da Tempestade (502 → Poder), A Barragem de Magma (503 → Velocidade, correspondente à regra de fallback de "Ar"). A prévia `chaotic_capture_preview_initiative` agora compara atributos individuais `s`, `p` ou `v` de acordo com o Local da sala; sem sorteio prévio mantém o fallback de Velocidade rotulado como provisório.
- A validação rejeita atributos individuais ausentes ou incorretos. O teste `supabase/tests/chaotic-preview-location-initiative.test.sql` foi executado no Supabase, sem criar partidas ou consumir inventário.
- Os efeitos de Local (por exemplo, bônus de energia e danos elementais), as mudanças oficiais de turno/pontos e a posse autoritativa das cartas **ainda não foram implementados**. Esse protocolo segue separado do jogo original e não libera XP, moedas, HP ou vitórias.

## Modificadores de Local na prévia de dano DNA (versão 0.1.16 — 30/10/2026)
- A função `chaotic_preview_location_damage` resolve, com referências do catálogo **original**, modificadores de três Locais já capturados pelo servidor. Não aceita Local arbitrário/ID desconhecido. A RPC `chaotic_calculate_individual_preview` incorpora as parcelas apenas para simular um confronto 1x1 autenticado, no turno atual, sem escrever HP no jogo.
- **Túnel da Tempestade:** +5 em ataques com componente Ar e −5 com Água. Soma as condições e aplica `greatest(0,...)` para impedir dano negativo.
- **Barragem de Magma:** adiciona Fogo ao atacante que não possui esse elemento natural, sem duplicar Fogo existente; o novo bônus elemental é neutralizado se o defensor tiver Anel Precioso revelado.
- **Cidade de Kiru:** concede +10 de energia indicada ao defensor Azul (outros atributos e energia oficial não mudam). Snapshot da prévia suporta até 550 energia, para comportar o bônus de uma criatura com 500.
- Os novos campos de breakdown são `location_id`, `location_elemental_bonus`, `location_damage_delta` e `location_energy_bonus`. O histórico da interface os exibe separadamente aos dois participantes.
- A simulação continua exigindo carta de ataque individual capturada, conferência de turno e confronto, pagamento experimental na mão e `spent_reason='attack'`. **Nenhum efeito é aplicado ao motor oficial**, incluindo dano persistente, iniciativa oficial, vitória ou recompensas.
- Verificação: `supabase/tests/chaotic-preview-location-damage.test.sql` executado com rollback; **33 testes Node aprovados** no GitHub Actions, inclusive Kiru e preservação de DNA.

## Efeitos condicionais aguardando dano final (v0.1.17 — 30/10/2026)

A tabela `chaotic_preview_effect_candidates` e a RPC `chaotic_capture_preview_effect_candidate` registram **somente projeções de gatilhos** para cartas de ataque: Armadilha de Vinha (107: anula próxima vez do adversário, sem compra/pontos), MÃO ELETRÔNICA (111: bloqueia ataque nas duas próximas vezes) e MÃO MÃO (112: bloqueia ataque na próxima vez). Todos os três **precisam causar dano final positivo** no código original.

O servidor só permite criar a proposta após um ataque individual capturado, um confronto coerente, custo de teste pago, turno ativo e prévia positiva com `calculation_status='partial_estimate'`. O servidor calcula vítima, escopo, duração e números das próximas vezes. Uma segunda criação e pedidos anônimos/de terceiros são negados. A tabela tem RLS, apenas leitura para integrantes e sem permissão de escrita do cliente.

**Nenhuma dessas propostas é um status ativo**: `confirmation_state='candidate_requires_final_damage'` e `applied_to_match=false` por restrição do banco. A projeção NÃO modifica turno real, bloqueio de ataque, compra, saldo ou HP, pois ainda falta resolver efeitos de imunidades, equipamentos e dano definitivo. Ativar status apenas após integrar um motor autoritativo que valide dano final e expiração, em uma única transação.

Regressão: `supabase/tests/chaotic-preview-conditional-effects.test.sql`, mais testes Node de duas contas simuladas para proibição de repetição e confirmação de que o jogador-alvo **mantém sua vez**. Não equivale a testes reais de dois aparelhos.

## HP acumulado hipotético no Supabase (versão 0.1.18 — 30/10/2026)

A migração `supabase/chaotic-preview-persistent-hp.sql` implementa duas tabelas exclusivas para treinamento de 1x1: `chaotic_preview_hp_wallets` (saldos atuais por criatura/jogador) e `chaotic_preview_hp_events` (auditoria dos ataques simulados). **Não é o HP oficial do jogo.**

A função `chaotic_prepare_preview_hp` exige participante na própria vez, 1x1 pronto, duas fichas individuais válidas e Local já definido; bloqueia partidas em que a prévia de dano começou antes da carteira de treino. Inicializa os dois lados em uma transação, usando Energia individual da ficha e bônus +10 de Kiru se a tribo for Azul.

A função `chaotic_apply_preview_hp_projection` confere o atacante, alvo, turno, carta individual validada, pagamento de teste, Local e ficha de ambos, e recusa dano ainda indeterminado (por exemplo, rolagens e especiais pendentes). Usa exclusivamente `calculation_status='partial_estimate'` como **dano indicativo**, atualizado cumulativamente até o mínimo de zero, uma única vez por turno. Eventos gravam `official_hp_changed=false` e `final_damage_verified=false`, imposições conferidas diretamente no banco.

Os clientes apenas leem as carteiras e eventos mediante RLS para integrantes da sala; não podem reescrever HP ou eventos. O histórico é sincronizado via Realtime e atualização periódica. O teste `supabase/tests/chaotic-preview-persistent-hp.test.sql` passou em transação sem alterar registros do usuário. O teste JavaScript de Kiru simula dois ataques em turnos distintos, sem modificar `loadouts.stats.e`, recompensas, turno oficial ou cartas do álbum.

**Não confundir saldo experimental com resolução de PvP final:** faltam um motor de dano completamente autoritativo, condições de vitória, efeitos de status sobre turnos e provas de propriedade das cartas. Não foram realizados testes reais com dois telefones. Até lá, nenhuma habilidade condicional pode ser ativada a partir de um evento hipotético.

## Auditoria obrigatória do dano final — 0.1.19 (30/10/2026)
- A migração `supabase/chaotic-preview-damage-audit.sql` adiciona `chaotic_preview_resolution_audits` sob RLS somente para integrantes do combate e a RPC `chaotic_audit_preview_damage`. O servidor confronta partida, jogador, turno, carta individual de ataque, slot pago `spent_reason='attack'`, dano registrado e fichas individuais antes de gerar a avaliação.
- `chaotic_preview_resolution_blockers` cobre os 15 ataques originais (101–115), incluindo regras exclusivas: cartas de compra/recuperação (102/103/108/109/110/115), dado do Fogo Primordial (104), revelação do Vento Forte (105), veneno da Víbora (106), Vinha (107), efeitos das Mãos (111/112), poderes do cemitério (113/114) e remoção de equipamento (101). Também evidencia Burst, habilidades e economia de cartas não totalmente autoritativa.
- A auditoria é uma **lista de impedimentos**, não uma confirmação de dano: restrições do PostgreSQL fixam `review_status='incomplete'`, `final_damage_verified=false` e `applied_to_official_match=false`. Nem a tela nem uma chamada à API podem ativar efeitos/HP oficial só porque houve uma estimativa positiva.
- O botão "Verificar impedimentos de dano final no servidor" mostra os motivos do próprio confronto e replica a resposta ao adversário. A operação é exclusiva do atacante no seu turno e só registra uma auditoria por confronto.
- `supabase/tests/chaotic-preview-damage-audit.test.sql` passou, e 34 testes Node passaram na suíte funcional. Nenhuma partida de ponta a ponta com dois usuários reais foi validada.
