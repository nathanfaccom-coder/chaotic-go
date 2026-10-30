# Chaotic GO — Status de conclusão e pendências (30/10/2026)

Este documento acompanha **prontidão para lançar o jogo completo com Supabase**, não porcentagem de linhas escritas, número de commits ou cartas preservadas. A avaliação é manual e pode mudar após testes reais. **Estimativa atual: 54% (incerteza aproximada ±10 pontos percentuais).**

## Critérios ponderados

| Área | Peso | Avaliação funcional | Contribuição |
|---|---:|---:|---:|
| Motor legado, scanner, cartas, imagens, áudios e interfaces preservados | 25% | 90% | 22,5 p.p. |
| Contas, migração de coleção, Decks e persistência privada Supabase | 15% | 75% | 11,25 p.p. |
| Salas privadas, sincronização e protocolo de turnos | 10% | 70% | 7 p.p. |
| PvP completo: posicionamento, dano real, efeitos, habilidades, vitória | 25% | 24% | 6 p.p. |
| Economia, amigos, trocas, recompensas e progressão integradas | 15% | 25% | 3,75 p.p. |
| Testes ponta a ponta, dois dispositivos, mobile, segurança e publicação | 10% | 35% | 3,5 p.p. |
| **Estimativa total** | **100%** | | **54 p.p.** |

Números estimados para planejamento, não verificação automática de 54% das funcionalidades. O código original salvo no repositório não garante que cada uma de suas ações funcione após trocar de backend.

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
- **Próximo bloqueio crítico:** emissão/posse autoritativa das cartas (álbum editável no cliente), mão aleatória e pontos oficiais com iniciativa/bloqueios de efeitos, custo real, resolução de equipamentos, locais, Burst, rolagens, efeitos e vitória antes de liberar dano real.
- A estimativa ponderada sobe de **53% para 54%**, por adicionar recursos verificáveis no servidor sem dano oficial. O número ainda é manual e continuará incerto até existir um 1x1 completo testado.
