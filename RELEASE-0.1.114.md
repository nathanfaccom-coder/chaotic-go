# Chaotic GO v0.1.114 — recuperação de leitura congelada após suspensão do Android

**1º de novembro de 2026 · progresso estimado: 97%.**

## Correção
- Quando o Android suspende a PWA no segundo plano durante uma leitura longa, a consulta pode continuar pendente mesmo após a internet voltar; a leitura anterior bloqueava a nova sincronização.
- Agora, após uma transição de desconexão/segundo plano explicitamente detectada para a mesma sala, se houver uma **consulta travada e nenhuma ação do jogador em execução**, o DROME invalida a geração antiga, libera apenas a consulta de leitura e abre uma nova assinatura e leitura.
- Respostas da geração antiga continuam bloqueadas por verificação de sala, tela e turno; não podem sobrescrever o HP, as cartas ou a fase recente.
- Uma consulta velha também não pode apagar a fila de atualizações de uma geração nova.
- Se uma **ação real** ainda estiver pendente, não se cancela nem repete essa ação: o servidor continua sendo responsável por pagamento, ataque, defesa e dano.
- Só retoma com internet, aplicativo visível e tela DROME aberta; eventos repetidos de retorno não descartam novamente a mesma geração.
- Atualizadas as versões de cache, login, scanner e bootstrap para v0.1.114.

## Testes e limites
- Seis novos testes simulam consulta congelada, retorno repetido, ação em andamento, aplicativo sem rede/oculto, fila em duas gerações e bloqueio de respostas antigas.
- Esta atualização não altera cartas, imagens, Decks, saldo, dados permanentes nem SQL.
- O backend do treinamento 3×3 já passou em cinco suítes de integração reais no Supabase com rollback, documentadas em `docs/QA-3X3-SUPABASE-LIVE-2026-11-01.md`.
- Continua faltando homologação visual de uma partida 3×3 completa em dois celulares físicos, incluindo interrupção da rede durante um ataque, defesa e três nocautes iguais em ambos os aparelhos. Os 97% seguem estimativos.
