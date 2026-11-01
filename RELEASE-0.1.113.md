# Chaotic GO v0.1.113 — retorno instantâneo ao turno após reconexão do Realtime

**1º de novembro de 2026 · progresso geral estimado: 97%.**

## O que mudou
- Quando o canal Supabase Realtime registra `CHANNEL_ERROR` ou `TIMED_OUT` e depois recebe `SUBSCRIBED` **no mesmo canal**, o DROME agora solicita imediatamente a atualização do estado da sala e do turno.
- Antes, a reconexão automática apenas limpava a marca de erro; o jogador podia continuar olhando para uma fase antiga do ataque até a próxima consulta periódica (intervalo nominal de seis segundos).
- A atualização imediata é **somente de leitura**: não repete ataques, pagamentos, respostas de defesa, compras de carta ou passagens de turno.
- A rotina evita consultas duplicadas no primeiro `SUBSCRIBED`, ignora `SUBSCRIBED` repetidos e não consulta quando a tela do jogo está oculta, o aparelho está sem rede ou o jogador deixou o DROME.
- Callbacks de canais substituídos e salas antigas continuam descartados; a recuperação de segundo plano e o polling permanecem disponíveis.
- Versão visual, login, scanner, bootstrap e Service Worker atualizados para 0.1.113.

## Validação
- Sete novos testes Node verificam a retomada imediata, ausência de duplicatas, bloqueio em segundo plano/offline, isolamento de canais e salas e ausência de replay de movimentos.
- As cartas, as imagens, os Decks e os dados permanentes existentes não foram alterados.
- Ainda é necessário homologar uma partida 3×3 entre dois celulares físicos, com desconexão durante o ataque, defesa, três nocautes e resumo de resultado idêntico em ambos.
