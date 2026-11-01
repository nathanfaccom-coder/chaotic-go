# Chaotic GO v0.1.121 — comprovante final 3×3 independente da leitura de formação

**1º de novembro de 2026 · progresso geral estimado: 97%.**

## Correção da consulta pós-partida
- Em versões anteriores, mesmo com o comprovante final priorizado, `refresh3x3Allies()` ainda aguardava `chaotic_get_preview_3x3_safe_state` antes de acessar as tabelas dos nocautes e do resultado.
- Essa consulta de formação/HP é necessária **durante o combate**, mas não é necessária para comprovar o vencedor após `match.status='finished'`. Uma RPC suspensa pelo Android podia impedir o carregamento da prova final apesar de o servidor possuir o resultado.
- Agora o cliente identifica o fim do treino **antes** da chamada da formação e segue direto para `refreshFinished3x3Receipt()`, que lê o resultado, os nocautes e a etapa final sem executar mutações.
- A tela de formação/tabuleiro previamente carregada permanece como uma referência visual local; o resultado final é comprovado somente pelas linhas do servidor. Uma sala nova continua isolada por ID, turno e geração de tela.
- Durante uma partida **ativa**, o fluxo anterior permanece: obter a formação/HP mascarados pelo Supabase, consultar mão, empréstimos e todas as regras de ataque/defesa. Nenhuma dessas mecânicas foi eliminada.
- Cache, login, scanner, bootstrap e versão visível atualizados para v0.1.121.

## Testes e limites
- Oito novos testes cobrem comprovante com a RPC de formação travada/indisponível, falha verdadeira do comprovante, isolamento de sala/turno e preservação do caminho ativo sem mutações.
- O teste anterior de leitura final foi atualizado para confirmar que `chaotic_get_preview_3x3_safe_state` não é chamado após a partida encerrada.
- Nenhuma carta, arte, Deck, saldo, XP, moeda, SQL ou dado permanente de jogador foi alterado.
- A homologação ponta a ponta com **dois celulares físicos** (desconexão durante o ataque, defesa, três KOs e comprovantes idênticos) continua pendente. Por isso os **97%** permanecem uma estimativa.
