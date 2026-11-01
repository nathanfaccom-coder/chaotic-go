# Chaotic GO v0.1.99 — reconexão sem recuperar a sala errada

**31/10/2026. Progresso geral estimado: 97%.** Treinamento 3×3 ainda experimental.

## Melhorias
- Cada recuperação de sala é identificada pela geração da tela e ID da sala. Uma requisição suspensa de uma tela antiga não bloqueia nem libera indevidamente a reconexão da nova sessão.
- Ao reabrir o DROME, a tentativa de recuperação pode começar imediatamente sem aguardar uma consulta interrompida do Android.
- Avisos de erros do Realtime, polling, retorno ao aplicativo e restauração são exibidos apenas na sala em que se originaram.
- Não ocorre retransmissão automática de ataques, pagamentos, passagens de turno ou alterações de Deck.
- Cache, scanner, login, bootstrap e página inicial sincronizados para release-99.

## Testes e pendências
Cinco regressões testam leituras simultâneas e tardias, isolamento da nova recuperação e mensagens de erro após trocar de sala. Os testes automatizados e a verificação pública devem passar antes de liberar o site. Não foram alterados cartas, imagens, Decks, SQL, XP nem moedas. Para homologação completa, ainda falta um teste real do 3×3 em dois celulares.
