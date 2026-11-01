# Chaotic GO v0.1.122 — comparação de comprovantes entre dois celulares

**1º de novembro de 2026 · progresso geral estimado: 97%.**

## Ferramenta de conferência do treinamento 3×3

- Depois do texto **Conferência do resultado nos dois celulares**, o DROME exibe um campo de texto **Cole o resumo copiado do outro celular** e o botão **Comparar os dois comprovantes**.
- Um jogador pode tocar em **Copiar resumo para comparar celulares** no segundo aparelho, colar no primeiro e fazer uma comparação local, sem transmitir o texto colado nem escrever no banco.
- São confrontados o código da sala, o vencedor e o derrotado (ANFITRIÃO/CONVIDADO), o turno decisivo e os nocautes de c4, c5 e c6. Campos divergentes são identificados em português.
- A comparação só considera completo um relatório que contenha **RESULTADO DE TREINO CONSISTENTE NO SERVIDOR**, todos os três nocautes, ausência de recompensas oficiais e identificação válida dos participantes. Resumos parciais, malformados, com vencedor contraditório ou sem vitória confirmada são rejeitados.
- Mudanças no comprovante local invalidam a indicação anterior de comparação, exigindo uma nova conferência após atualizar a partida.
- **Importante:** texto colado pode ter vindo do mesmo aparelho ou ser adulterado. A mensagem de concordância afirma explicitamente que **não certifica a presença de dois celulares físicos** nem substitui a desconexão/reconexão real.
- O campo é limitado a 2400 caracteres e é comparado somente por `textContent` e `textarea.value`, sem inserir o conteúdo no HTML e sem alterar dados persistidos.
- Atualizados os caches do PWA, login, scanner, bootstrap e número da versão para 0.1.122.

## Testes e limites
- Doze novos testes automatizados cobrem comparação idêntica, espaços quebrados por teclado celular, diferença de sala/vencedor/turno, ausência de resultado, KO faltante, sinalizador irregular de recompensas, texto contraditório, segurança do campo e o limite de não certificar aparelhos.
- Nenhuma imagem, carta, Deck, regra do combate, HP, recompensa, banco SQL ou dado permanente foi alterado.
- Continuam necessárias uma partida 3×3 completa **em dois celulares físicos**, interrupção da rede durante o ataque, resposta defensiva, três KOs, reconexão e comprovantes comparados. Por isso **97% segue uma estimativa**, não a homologação final.
