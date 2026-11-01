# Chaotic GO v0.1.108 — pulso de presença independente durante a sincronização 3×3

**1º de novembro de 2026 · progresso estimado: 97%.**

## Melhoria de estabilidade no multiplayer
- Uma leitura completa de cartas, turnos e tabuleiro pode demorar, especialmente na rede móvel. Antes, o polling aguardava a leitura terminar para voltar a enviar o pulso de presença ao Supabase.
- Agora o DROME pode enviar um **pulso de presença separado, no máximo uma vez a cada dez segundos**, enquanto a sincronização completa ainda está em andamento. Assim, uma leitura lenta não deve fazer o adversário parecer desconectado por falta de atividade.
- Esse pulso usa somente a RPC de presença já existente, com `p_ready: null`: não joga uma carta, não paga ataque, não passa turno e não altera o resultado.
- O pulso não roda com o aplicativo oculto, sem rede, fora de uma partida ativa ou em modos diferentes de 3×3.
- Resultados atrasados são descartados quando a sala ou o turno muda. Requisições simultâneas para a mesma sala são bloqueadas.

## Testes e limites
- Sete testes adicionais verificam a cadência do pulso, isolamento de salas, mudança de turno, conexão indisponível, ausência de replay e continuidade da leitura completa.
- As versões de login, scanner, cache e PWA foram sincronizadas para 0.1.108. Nenhum arquivo de imagem, carta, Deck, SQL ou dado permanente foi modificado.
- A homologação real ainda exige uma partida 3×3 entre **dois celulares**, com queda e volta da rede durante um ataque, resposta do defensor, três nocautes e resultado igual nos dois aparelhos.
- **97% permanece uma estimativa**, sem fingir que testes simulados substituem a experiência real.
