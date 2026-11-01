# Chaotic GO v0.1.112 — proteção contra tempestade de eventos de Realtime

**1º de novembro de 2026 · progresso estimado: 97%.**

## Correção de sincronização do multiplayer
- Depois de uma reconexão, um canal Realtime antigo pode emitir notificações tardias enquanto a inscrição é descartada. Agora o DROME também compara a identidade do canal nas notificações de alterações, além de comparar sala e tela; não inicia nova leitura nem altera avisos por um canal descartado.
- Uma sequência contínua de notificações podia manter o `refreshRoom()` num ciclo indefinido. O cliente agora agrupa eventos em no máximo duas leituras consecutivas (uma inicial e uma recuperação), liberando o bloqueio depois disso.
- A consulta periódica de seis segundos e o pulso de presença da v0.1.108 permanecem ativos para recuperar atualizações posteriores. Nenhum ataque, pagamento, defesa ou passagem de turno é reenviado pelo canal.
- A identificação de cada leitura do combate 3×3 da v0.1.109 continua descartando resultados atrasados.
- Login, scanner, bootstrap, versão visível e cache do PWA alinhados na v0.1.112.

## Verificação e limites
- Seis testes novos reproduzem callbacks de canal abandonado, erro tardio, troca de sala, tempestades de eventos e limitação de leituras; as regressões anteriores continuam na suíte.
- Nenhuma carta, arte, Deck, dinheiro, SQL ou dado persistente foi alterado.
- Ainda falta conferir a partida 3×3 em dois celulares reais, incluindo reconexão durante ataque, defesa e três nocautes com resultado correspondente. Por isso a conclusão geral continua estimada em 97%.
