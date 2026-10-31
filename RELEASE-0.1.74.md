# Chaotic GO v0.1.74 — Mão Negra (102): validação privada antes do roubo

**Data:** 31/10/2026. **Estado:** uma etapa funcional de segurança/integração da Mão Negra, **não** o roubo completo. Training-only 3x3; não altera cartas, álbuns, Decks, imagens, 1x1, 6x6, XP, moedas ou combate oficial.

## O que foi desenvolvido

### Verificação segura, executada pelo servidor

`supabase/chaotic-preview-3x3-black-hand-readiness-v0174.sql` cria a função `chaotic_preview_3x3_black_hand_readiness(uuid,integer)` como uma operação **somente leitura** e disponível apenas a usuários autenticados, com autorização individual conferida pelo servidor. Valida a sala 3x3, o turno atual, a identidade de quem ataca, a projeção da carta original `102` (**Mão Negra**, custo **0**, dano **0**), a ausência de pagamento e a correspondência com o contato atual.

Em seguida, confere a preparação da mão do atacante e da mão do adversário, o fato de a própria Mão Negra estar realmente **na mão** e o espaço de até cinco cartas **após a futura utilização da 102**. Considera também empréstimos `reserved/held` registrados no livro-razão de posse temporária, sem confundir propriedade da carta e posse para uso.

A resposta devolve apenas estado de elegibilidade, número de espaços que restariam **na mão do próprio atacante**, e se a mão adversária tem ao menos uma carta. **Não** devolve ID da carta adversária, slot, ordem de compra, detalhes do álbum, nome da carta, seleção aleatória nem conteúdo privado do oponente.

Os valores `playable:false` e `payment_enabled:false` são intencionais: esta função **não rouba, não transfere, não paga e não autoriza jogar** a Mão Negra.

### DROME

`chaotic-lobby.js` apresenta o botão **“Mão Negra (102): conferir espaço para carta roubada — sem gastar”** após a projeção original da 102 no turno do atacante. Informa, sem fingir que o ataque está liberado:
- se a própria carta não está na mão ou ainda é preciso preparar a mão;
- se o adversário ainda não preparou a mão ou a mão adversária está vazia;
- se não haverá espaço para receber outra carta após gastar a 102;
- se as condições **iniciais** estariam satisfeitas, mas falta implementar roubo, uso e devolução.

A interface conserva `resolvableTrainingAttacks3x3` **sem a carta 102**. A função de pagamento do Supabase também **não** inclui `102`, mesmo para tentativa manual de RPC. Uma projeção não dá permissão para gastar o ataque.

### Segurança, integridade e testes

`supabase/tests/chaotic-preview-3x3-black-hand-readiness-live-v0174.test.sql` foi **executado com PASS no banco real** usando três usuários fictícios em uma sala 3x3, com criaturas, HP, tabuleiro, mãos, contato e projeção sintéticos:
1. O atacante recebe apenas informações de viabilidade, sem dados privados da carta do adversário;
2. A resposta explicita `playable:false` e `payment_enabled:false`;
3. A verificação leva em conta o espaço **liberado quando a 102 for gasta**;
4. Defensor e terceiro usuário não conseguem executar a verificação no turno do atacante;
5. A função não gera linhas de posse temporária nem altera o estado das cartas;
6. Toda a transação foi revertida com `BEGIN/ROLLBACK`, sem dados artificiais persistentes.

`tests/black-hand-readiness-v0174.test.mjs` adicionou **cinco** testes de permissões, integração, privacidade, interface e versão PWA. Os testes existentes de TORNADO foram ajustados para validar versões futuras sem exigir literalmente v0.1.73. Suíte completa aprovada: **204/204 testes**, sem erros de sintaxe JavaScript, na execução do GitHub Actions `41197481654`.

Atualizados `index.html`, `sw.js`, `scanner.html`, `scanner-completo.html` e `full-game-bootstrap.js` para **0.1.74**, evitando que o Android/PWA continue carregando a interface antiga em cache.

## O que ainda falta na Mão Negra

1. Implementar o **roubo aleatório real** e atômico na mão adversária, de modo que o dono original não possa usar nem reciclar a carta enquanto estiver emprestada;
2. Representar a carta emprestada como **posse temporária**, sem modificar quem é o dono no álbum ou Deck original;
3. Integrar a posse à projeção/inspeção de ataque, pagamento com custo do catálogo, uso de carta pela pessoa que tomou emprestado e retorno ao dono após uso/fim da sessão;
4. Resolver limite de cinco cartas, reciclagem, suspensão do empréstimo, múltiplas conexões e reconexão;
5. Só então liberar pagamento e botão de execução da **102**, com testes negativos de acessos não autorizados e anti-replay.

Outras pendências: Aliança (103), Armadilha de Víbora (106), equipamentos, Mugics, conclusão do PvP oficial, revisão dos avisos de segurança e **homologação em dois celulares físicos**.

**Progresso global estimado permanece em 97% ±10 pontos percentuais**, um acompanhamento manual e não homologação de lançamento.
