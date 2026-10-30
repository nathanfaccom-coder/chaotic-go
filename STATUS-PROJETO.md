# Chaotic GO — Status de conclusão e pendências (30/10/2026)

Este documento acompanha **prontidão para lançar o jogo completo com Supabase**, não porcentagem de linhas escritas, número de commits ou cartas preservadas. A avaliação é manual e pode mudar após testes reais. **Estimativa atual: 57% (incerteza aproximada ±10 pontos percentuais).**

## Critérios ponderados

| Área | Peso | Avaliação funcional | Contribuição |
|---|---:|---:|---:|
| Motor legado, scanner, cartas, imagens, áudios e interfaces preservados | 25% | 90% | 22,5 p.p. |
| Contas, migração de coleção, Decks e persistência privada Supabase | 15% | 75% | 11,25 p.p. |
| Salas privadas, sincronização e protocolo de turnos | 10% | 70% | 7 p.p. |
| PvP completo: posicionamento, dano real, efeitos, habilidades, vitória | 25% | 36% | 9 p.p. |
| Economia, amigos, trocas, recompensas e progressão integradas | 15% | 25% | 3,75 p.p. |
| Testes ponta a ponta, dois dispositivos, mobile, segurança e publicação | 10% | 35% | 3,5 p.p. |
| **Estimativa total** | **100%** | | **57 p.p.** |

Números estimados para planejamento, não verificação automática de 57% das funcionalidades. O código original salvo no repositório não garante que cada uma de suas ações funcione após trocar de backend.

## Entregas já implementadas ou disponíveis
- Jogo completo e recursos originais publicados no site; backup de branches anteriores.
- Login Supabase, dados do jogador em tabela com RLS, importador opcional de cartas antigas, exportação de backup e Realtime da coleção.
- Salas privadas com convite, permissões, turnos ordenados, diário de eventos.
- Prévia de um marcador de criatura por jogador; adjacência, movimento e encontro validados no servidor.
- Dano base, elementos e verificações de atributo no catálogo **padrão**, em modo de demonstração; prévia adicional com DNA individual no **1x1**.
- Regra de ataque **Fogo Primordial 2.0**: novo sorteio único 1d6 feito no servidor e compartilhado no turno, sem dano definitivo.

## O que impede declarar 100%
1. **Crítico:** recuperar e validar cada carta individual (DNA/atributos reais), baralhos e mão durante partida; integridade/posse de cartas.
2. **Crítico:** motor de combate autoritativo real com até seis criaturas, movimentos completos, custos, ataques, imunidades, dados, habilidades, magias, equipamentos, locais, dano real e resolução de vitórias.
3. **Crítico:** testar dois jogadores reais em dois celulares distintos, reconexões, perda de rede, saída, conflitos simultâneos e RLS.
4. **Importante:** validar e adaptar amigos, trocas, economia, XP e recompensas ao Supabase, com transações seguras e prevenção de duplicação.
5. **Importante:** testes ponta a ponta da experiência inteira no celular e desktop, incluindo importação Firebase, login e retorno de sessão, assets e PWA.

## Próximas prioridades
- P0: testes com segunda conta e documentação de falhas reproduzíveis.
- P0: portar uma batalha 1x1 completa do motor original com estado de servidor e replay tests.
- P1: expandir a resolução de 1x1 para 3x3 e 6x6 sem perder regras especiais.
- P1: portar trocas e progresso com transações e auditoria.
- P1: estabilização, UX mobile, testes cruzados e preparação de lançamento.

**Limite:** as tabelas `chaotic_preview_*` são experimentais. Resultados desses cálculos **não modificam pontos de vida, partidas oficiais, moedas, XP, cartas ou vitórias**. Evite usar suas prévias para premiar partidas.

## Integração individual 1x1 — progresso recente
- Captura de atributos das cartas realmente salvas no álbum, e não apenas dos valores-padrão do catálogo, com equipamento e trava de escrita no servidor.
- **Versão 0.1.8:** a função `chaotic_capture_preview_attack` registra uma correspondência de teste entre o ID individual de um ataque no álbum/deck e seu modelo no catálogo ativo (15 ataques), conferindo nome, custo, dano-base, turno e participante. Um novo painel no DROME mostra a confirmação e sincroniza os registros entre participantes.
- **Versão 0.1.9:** nova tabela e RPC `chaotic_calculate_individual_preview` para o **1x1 de teste**, exigindo duas fichas imutáveis, o ataque individual validado, confronto, turno correto e participante autorizado. Calcula base, elemento de catálogo e comparações sobre o **DNA individual**, exibindo apenas uma **simulação** da energia restante (sem dedução real).
- **Ataques especiais:** Fogo Primordial 2.0 e bônus dependentes de cemitério ficam sem subtotal/energia simulada até o motor de efeitos e dados ser integrado. As prévias antigas baseadas em IDs do catálogo ficam ocultas **no 1x1**, mas preservadas para diagnósticos legados dos demais modos.
- **Verificação:** função e RLS aplicadas ao Supabase. Cenários SQL transacionais de fórmula/atributo/ataques especiais/restrição de escrita aprovados, além de testes Node do DROME. Sem dano, cartas, economia, XP ou vitória alterados. **Sem validação em dois celulares reais**.
- **Versão 0.1.10:** equipamento do deck pode ser **revelado uma única vez** em teste 1x1 pelo dono da carta na própria vez; o registro fica no Supabase com RLS, sem executar o Burst nem alterar atributos/energia reais. Prévia considera Bracelete de Cristal e Bracelete de Água se revelados, imunidades de Ar de Rex/Amuleto do Vácuo, e neutralização elemental por Anel Precioso. Os efeitos de energia do Anel Precioso (-15), Bomba de Fogo (+5) e equipamentos ainda não resolvidos bloqueiam a apresentação de dano total fictício.
- **Custo da carta:** exibido com referência validada do catálogo, mas o saldo de pontos de ataque e a carta na mão **ainda não são verificados**. Nenhum custo é debitado; não libera legalidade da jogada.
- **Verificações 0.1.10:** testes SQL transacionais cobrem equipamentos, imunidades, visibilidade da revelação, ataques especiais e permissões; testes Node do DROME cobrem uma revelação por jogador, sincronização e ausência de redução de HP.
- **Versão 0.1.11:** mão e carteira de pontos de ataque **separadas do combate oficial** e mantidas no Supabase, com acesso do jogador apenas aos próprios dados. A mão começa com os **três primeiros ataques válidos** do deck de 20 (ordem fixa de teste; **não é sorteio oficial**), pode receber uma carta em novo turno e limita a 5 cartas. Saldo experimental: 3 pontos iniciais e +1 em novas vezes após o preparo.
- **Pagamento experimental:** `chaotic_spend_preview_attack` valida ataque capturado, posição/ID da carta na mão, confronto registrado, turno, jogador e saldo, descontando o custo **somente nessa carteira de teste**; trava gastos repetidos. O cálculo experimental de dano agora exige comprovante desse gasto. Contas oficiais, HP, vitórias e cartas originais permanecem intactos.
- **Verificação 0.1.11:** SQL e testes Node cobrem aquisição/consumo de recursos, bloqueio de terceiro jogador, saldo insuficiente, replay e RLS. Ainda falta sincronizar iniciativa, efeitos que bloqueiam compra, embaralhamento e descartes do motor original.
- **Versão 0.1.12:** mão de teste agora é embaralhada no **servidor** usando posições de compra aleatórias, persistidas na partida. Distribuição inicial de 3 cartas e compras posteriores respeitam essa ordem sorteada, sem alterar o índice original da carta no Deck, usado nas declarações de combate.
- **Privacidade do deck:** RLS libera ao próprio jogador somente cartas `hand` e `spent`; as cartas `deck` não são retornadas pela API até a compra. `total_cards` na carteira permite mostrar quantas restam sem expor nomes e ordem do monte. Mãos existentes na prévia preservam o índice anterior, para não invalidar testes já começados.
- **Verificação 0.1.12:** a migração foi aplicada e o teste SQL de permutação/ocultação/permissões foi aprovado. O embaralhamento vale somente para o 1x1 experimental: não inclui descarte/reciclagem do lixo, iniciativa, compra bloqueada por habilidades, integridade da emissão das cartas nem efeitos de jogo.
- **Próximo bloqueio crítico:** emissão/posse autoritativa das cartas (álbum editável no cliente), pontos oficiais com iniciativa/bloqueios de efeitos, custo real, reciclagem de lixo, equipamentos, locais, Burst, rolagens, efeitos e vitória antes de liberar dano real.
- **0.1.13:** a estimativa manual sobe de **54% para 55%** pelo descarte e reciclagem controlados pelo servidor, ainda sem dano oficial e sem testes reais entre aparelhos. O número continua incerto até existir um 1x1 completo.


## Versão 0.1.13 — descarte e reciclagem no DROME 1x1 (30/10/2026)
- Nova RPC `chaotic_discard_preview_attack`: proprietário pode descartar uma carta **realmente na mão de teste** durante a sua vez. A carta vai ao lixo experimental com marcador `spent_reason='discard'`, sem custo. Não pode ser repetida ou usada para comprovar pagamento.
- RPC `chaotic_sync_preview_hand`: quando o monte está vazio e há cartas no lixo, reembaralha **somente as descartadas e usadas** no servidor (`gen_random_uuid()`), distribui uma nova carta, e incrementa o contador de ciclos. O embaralhamento não altera slots, DNA, catálogo ou a carta física original.
- Pagamento real de teste marca `spent_reason='attack'`; a RPC de DNA agora exige a razão `attack`, e não apenas o estado usado. A validação da instância capturada também exige a carta disponível na mão do próprio jogador e no turno sincronizado.
- UI inclui seleção de descarte por slot, resumo de lixo e reembaralhamentos, e mensagem de reciclagem. Os IDs de carta são exibidos em texto seguro e nunca interpolados na marcação dinâmica.
- Nenhum efeito é aplicado à partida oficial. **Pendências**: iniciativa, habilidades que bloqueiam compra, pontos e turnos, escolha de alvo, Burst, equipamentos especiais, dano persistente, mortes, vitória, pagamentos oficiais e legitimidade da emissão das cartas. Testes automatizados não substituem validação ponta a ponta com duas contas reais.

## Versão 0.1.14 — prévia de iniciativa com DNA individual (30/10/2026)
- Nova RPC `chaotic_capture_preview_initiative` e tabela `chaotic_preview_initiatives` sob RLS somente para participantes da partida, protegida contra chamada anônima, acesso externo e repetição no mesmo turno.
- A prévia compara a **Velocidade `v` das duas criaturas individualizadas** congeladas no Supabase, confere o confronto registrado e concede o desempate à criatura atacante, como no motor original.
- **Limite crítico:** o Local do confronto **ainda não está sincronizado**; o motor original pode exigir Coragem, Poder ou Sabedoria. Por isso o resultado guarda `attribute_source='no_location_speed_default'` e `calculation_status='preview_only_no_turn_change'`, **não altera o turno ativo, não adiciona pontos de ataque e não provoca dano**. Quando os Locais forem integrados, a iniciativa passará a usar o atributo selecionado pelo Local.
- A interface mostra a comparação individual em ambos os aparelhos com a ressalva de que o resultado é diagnóstico. Testes SQL validam atacante mais rápido, defensor mais rápido, empate, dados inválidos, permissões e ausência de escrita direta.
- **Próximo bloqueio:** sincronizar Local/arena e início do combate com turnos, depois implementar efeitos efetivos da Armadilha de Vinha (107), Mão Eletrônica (111) e Mão Mão (112) **somente após confirmar dano final positivo no servidor**. Esses bloqueios não devem ser acionados manualmente pelo jogador nem sobre uma prévia de dano incompleta.
- Estimativa geral **mantida em 55%** até iniciativa e efeitos virarem parte do motor de combate real, e não somente prévias de diagnóstico.

## Versão 0.1.15 — compatibilidade dos Decks salvos e Local de iniciativa (30/10/2026)

- **Correção de compatibilidade real:** `chaotic_declare_combat_action` agora procura `decks/<modo>_slot_<n>` (chave escrita por `script.js` ao salvar um Deck), antes da forma antiga `decks/<modo>_<n>`. Essa divergência poderia impedir o servidor de reconhecer um Deck legítimo e interromper o fluxo antes da batalha. Nenhum Deck ou carta existente foi apagado.
- **Sorteio de Local em servidor (somente teste 1x1):** nova tabela `chaotic_preview_room_locations` e RPC `chaotic_capture_preview_room_location`, com RLS e proteção contra manipulação direta. Requer sala ativa, confronto declarado, fichas individuais dos dois lados e uma carta de Local pertencente ao álbum/Deck selecionado do atacante. O Local é sorteado uma vez por sala e não pode ser alterado após a primeira iniciativa.
- **Atributos fiéis ao motor existente:** `Cidade de Kiru` (501) usa Sabedoria (`s`), `O Túnel da Tempestade` (502) usa Poder (`p`) e `A Barragem de Magma` (503) usa Velocidade (`v`, fallback de `Ar` no código legado). Iniciativas posteriores podem utilizar a seleção registrada; continuam sem alterar turnos nem pontos oficiais.
- **Interface:** botão "Sortear Local do meu Deck no servidor", nome e atributo do Local, comparação individual de iniciativa visível para ambos os participantes. RLS impede consulta das salas por usuários externos.
- **Verificação SQL:** `supabase/tests/chaotic-preview-location-initiative.test.sql` cobre os três Locais, desempate, atributos faltantes, acesso e permissão de escrita. Testes JavaScript têm caso de sorteio, sincronização com segundo jogador e proteção contra sorteio repetido; GitHub Actions acompanha mudanças de versão.
- **Próximos bloqueios:** a validade do álbum/carta ainda depende de registros graváveis pelo usuário; locais reais também modificam elementos e dano, iniciativa real precisa alterar turnos/pontos com segurança, e habilidades, HP e vitória ainda não foram habilitados. O sorteio experimental escolhe o Deck do atacante e não reivindica reproduzir todas as regras de seleção de Local do modo oficial.
- **Estimativa geral: 56% (±10 p.p.)**. Ponto adicional conservador por resolver uma incompatibilidade de Deck em produção e conectar Local ao cálculo individual, sem declarar PvP pronto.

## Versão 0.1.16 — efeitos de Locais na prévia individual de dano (30/10/2026)
- **O Túnel da Tempestade (502):** a simulação individual reconhece +5 em ataques com elemento Ar e −5 em ataques com elemento Água; os dois efeitos se somam caso um ataque tenha ambos, e o resultado não pode ser menor que zero.
- **A Barragem de Magma (503):** criaturas sem Fogo natural recebem o elemento Fogo para a simulação de ataque; o servidor adiciona apenas o bônus elemental de Fogo que faltar, sem duplicar um elemento natural. Caso o defensor tenha Anel Precioso revelado, não aplica o novo bônus elemental.
- **Cidade de Kiru (501):** criaturas da tribo Azul têm +10 de energia **na prévia defensiva**; o efeito não é aplicado à vida armazenada no álbum ou a qualquer batalha oficial. Os limites da tabela de teste foram ampliados para o caso de criaturas com até 500 de energia individual +10 de Kiru.
- **Auditabilidade:** a tabela `chaotic_preview_individual_damage` ganhou `location_id`, `location_elemental_bonus`, `location_damage_delta` e `location_energy_bonus` para ambos os participantes verem cada parcela. Não existe desconto de HP real, XP, moedas ou vitórias.
- **Validação da posse e do ataque preservada:** mantém a verificação do slot da carta capturada na mão de teste, custo já debitado e `spent_reason='attack'`; não admite um descarte voluntário como pagamento do ataque. Imunidades e efeitos especiais não resolvidos continuam bloqueando totals enganosos.
- **Testes:** `supabase/tests/chaotic-preview-location-damage.test.sql` passou no Supabase para os três Locais, elementos naturais, segurança e pagamentos; **33/33 testes** JavaScript aprovados, incluindo fluxo 1x1 de Kiru em dois clientes simulados e DNA original intacto.
- **Pendente:** o motor de habilidades, imunidades adicionais, equipamentos especiais e dano final em HP não foi migrado; a emissão das cartas ainda se baseia no álbum editável pelo cliente. É necessário testar dois usuários reais, com diferentes aparelhos e contas, antes de considerar o sistema competitivo pronto.
- **Progresso geral estimado: 57% (±10 p.p.)** por adicionar bônus de Local validados no servidor à prévia individual; o PvP oficial permanece incompleto.
