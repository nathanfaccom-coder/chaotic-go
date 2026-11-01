# Chaotic GO v0.1.107 — Realtime restaurado ao voltar ao DROME no Android

**1º de novembro de 2026 · progresso geral estimado: 97%.**

## Correção
- O Android pode suspender a conexão WebSocket quando a PWA vai para o segundo plano sem emitir o evento `offline`.
- Ao ocultar a tela do DROME com uma sala ativa, o cliente registra somente o ID da sala. Ao voltar com internet, recria a assinatura Realtime dessa mesma sala e faz uma consulta de leitura do turno.
- Nenhuma ação de combate é reproduzida: ataques, custos, passagens de turno, respostas do defensor e resultados continuam controlados pelo servidor.
- Eventos de retorno repetidos não criam canais extras. Se o usuário ainda estiver sem rede, a reconexão é adiada. Outras telas não disparam uma reconexão desnecessária.
- Versões de cache atualizadas no scanner, login, bootstrap e service worker.

## Testes e limites
- Três novos testes verificam retorno do segundo plano sem evento offline, espera pela internet e não interferência de outra tela.
- Os 401 testes anteriores continuam na suíte, incluindo reconexão após mudança de Wi-Fi/dados, sala antiga e empréstimos 3×3.
- O teste real de uma partida inteira **em dois celulares físicos**, com ataque interrompido, reconexão, defesa, três nocautes e resultado idêntico em ambos os aparelhos, permanece necessário. Não elevar a porcentagem sem essa homologação.
- Nenhuma imagem, carta, Deck, moeda, dado permanente ou mecânica anterior foi alterada.
