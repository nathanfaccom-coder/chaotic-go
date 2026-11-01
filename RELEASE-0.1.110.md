# Chaotic GO v0.1.110 — comprovante de conferência do resultado 3×3 em dois celulares

**1º de novembro de 2026 · progresso estimado: 97%.**

## Conferência independente do resultado
- O DROME mostra um resumo baseado somente nos dados já consultados do servidor: código da sala, equipe vencedora (anfitrião ou convidado), equipe derrotada, turno decisivo, e c4/c5/c6 nocauteados.
- Os dois jogadores podem usar **Copiar resumo para comparar celulares** e conferir se receberam exatamente o mesmo resultado depois de **Atualizar conexão e turno**.
- O resumo não afirma que dois aparelhos foram fisicamente testados: a confirmação real ainda deve ser realizada.
- O resultado só é marcado como **consistente no servidor** quando constam três nocautes distintos do lado derrotado (HP de treino 0 e bandeiras de treino), vencedor e derrotado são membros diferentes da sala, o resultado registra 3 criaturas derrotadas, e não há alterações oficiais ou premiações.
- Nocautes duplicados não são contados em dobro; eventos posteriores ao turno decisivo são descartados; registros incompletos ou inconsistentes exibem aviso, sem liberar combate ou recompensas.
- O botão copia texto localmente e não faz consultas nem alterações no banco.

## Integridade e validação
- Dez testes novos verificam igualdade do resumo entre os membros, resultado parcial, eventos duplicados, ataque emprestado, flags oficiais, turnos e uso do botão de cópia.
- Nenhuma carta, imagem, Deck, mecânica antiga, SQL, moeda ou dado permanente foi alterado.
- A validação definitiva depende de um teste com dois celulares reais: conexão, ataque, queda de rede, defesa, três nocautes e comparação do comprovante final em ambos.
