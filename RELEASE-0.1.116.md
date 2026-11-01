# Chaotic GO v0.1.116 — comprovante do 3×3 acessível depois do encerramento

**1º de novembro de 2026 · progresso geral estimado: 97%.**

## Correção do pós-partida
- O botão de atualização ficava oculto assim que `match.status` mudava de `active` para `finished`. Isso impedia o jogador de solicitar, manualmente, a conferência final após o encerramento da partida.
- Agora, com a sala ainda em estado `ready`, o botão permanece visível tanto em partida ativa quanto encerrada. Quando há resultado de treinamento ou partida encerrada, ele passa a dizer **Atualizar comprovante final**.
- O botão apenas relê o estado do servidor e permite comparar código da sala, vencedor, turno decisivo e nocautes c4/c5/c6 nos dois celulares.
- O texto diferencia resultado registrado no treinamento de **sessão encerrada sem vitória confirmada**, para evitar sugerir um vencedor inexistente.
- Os botões de **Estou pronto** e **Retirar meu pronto** continuam indisponíveis ao final da partida; o botão de atualização não libera novas jogadas.
- A proteção contra respostas tardias, ações duplicadas e consultas congeladas das versões anteriores continua ativa.
- Versão visual, login, scanner, cache do PWA e bootstrap sincronizados com 0.1.116.

## Integridade e testes
- Oito testes adicionais cobrem partida ativa, resultado registrado antes do fim, fim com ou sem vitória, sala cancelada, resposta de outra sala, consulta somente de leitura e disponibilidade do botão de copiar.
- Nenhum arquivo de imagens/cartas, Deck, registro SQL, recompensa, XP ou moeda de jogador foi modificado.
- O backend do 3×3 passou anteriormente em cinco integrações SQL reais com `ROLLBACK`, documentadas em `docs/QA-3X3-SUPABASE-LIVE-2026-11-01.md`.
- A homologação em **dois celulares físicos** continua pendente. O progresso 97% não substitui essa verificação.
