# Chaotic GO v0.1.111 — recibo 3×3 não pode confirmar vitória com dados incompletos

**1º de novembro de 2026 · progresso estimado: 97%.**

## Correção de integridade
- A conferência do resultado 3×3 agora rejeita valores nulos/ausentes. Antes, conversões de JavaScript podiam tratar `null` como `0` em HP e recompensas.
- Cada um dos três nocautes exige HP anterior inteiro positivo, HP final exatamente zero, turno válido, ocorrência de treinamento, e confirmações explícitas de que o HP e a partida oficiais não mudaram.
- O ataque precisa ter sido realizado pelo vencedor registrado contra uma criatura do adversário derrotado, até o turno decisivo.
- Uma carta emprestada exige confirmação adicional de que a propriedade original permaneceu intacta.
- O resultado precisa ter exatamente três criaturas derrotadas, participantes corretos, escopo `training_only_no_official_victory`, e quatro declarações explícitas de inexistência de mudanças oficiais, XP e moedas.
- Campos de auditoria que existiam no Supabase mas não eram consultados pelo cliente foram adicionados às leituras de nocaute original, nocaute emprestado e resultado final.
- Em caso de dados incompletos, a interface exibe `ATENÇÃO: RESULTADO NÃO CONFERIDO NO SERVIDOR`; ela não concede vitória oficial nem repete ações.

## Testes e preservação
- Dez novos testes cobrem HP nulo, HP anterior inválido, turno inválido, propriedades de carta emprestada, escopo errado, recompensas ausentes, autor incorreto e integridade de consultas.
- Atualização de cache, login, scanner, bootstrap e PWA para 0.1.111.
- Nenhuma imagem, carta, Deck, SQL ou dado permanente existente foi modificado.
- A validação final do multiplayer continua exigindo uma partida física em dois celulares, incluindo ataque, reconexão, defesa, três nocautes e o mesmo resultado para os dois jogadores. Progresso estimado mantido em 97%.
