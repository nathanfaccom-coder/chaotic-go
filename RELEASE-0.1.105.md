# Chaotic GO v0.1.105 — reconexão automática do Realtime no treino 3×3

**1º de novembro de 2026 · progresso geral estimado: 97%.**

## Corrigido
- Se o canal Supabase Realtime cair, o DROME continua usando as consultas periódicas existentes e agenda uma nova assinatura após 30 segundos, sem exigir reiniciar o jogo.
- Reconexões não executam ações de combate: não repetem ataques, passes, defesas, pagamentos nem empréstimos.
- Erros tardios de um canal pertencente a uma sala anterior não reativam uma conexão obsoleta nem interferem no novo combate.
- Quando a inscrição volta a ficar **SUBSCRIBED**, o retry é cancelado; erros repetidos não empurram o prazo de reconexão indefinidamente.
- Identificadores de cache e versões dos carregadores atualizados para v0.1.105, inclusive no Android.

## Verificação e próxima etapa
- Quatro novos testes automatizados simulam timeout, erro repetido, recuperação e substituição de sala. Os testes existentes verificam isolamento, turnos, empréstimos, interface mobile e dados originais.
- Ainda é necessário **jogar uma partida 3×3 em dois celulares físicos**, com reconexão durante um ataque, resposta do defensor, três nocautes e conferência de resultado nos dois aparelhos. Os 97% não devem ser elevados apenas com testes simulados.
- Cartas, imagens, Decks, banco de dados permanente e mecânicas anteriores não foram modificados nesta atualização.
