# Chaotic GO v0.1.125 — roteiro de aceite 3×3 incorporado ao DROME

**2 de novembro de 2026 · progresso geral estimado: 97%.**

## Novo recurso
- Na seção de comparação dos comprovantes do DROME há um painel recolhível de **seis etapas de verificação manual em dois celulares**.
- O roteiro registra: mesma sala/turno, desconexão real do defensor após pagamento, retomada sem nova cobrança, defesa/dano sem duplicação, três nocautes em ambos os aparelhos e ausência de alteração de recompensas/dados oficiais.
- Mostra a quantidade de etapas marcadas e permite **Gerar registro para copiar**, com sala, data do dispositivo, marcações e situação atual da comparação dos comprovantes.
- O registro é criado somente no navegador; não acessa nem altera o Supabase. A exportação não inclui senha, token ou IDs internos.
- Ao mudar de sala, as etapas são reiniciadas. Ao mudar marcações, relatórios anteriores são invalidados. A mensagem de comprovantes coincidentes só entra no registro se ambos os textos ainda forem os mesmos da última comparação.
- Mesmo com seis etapas marcadas, o registro não certifica a presença de dois celulares físicos e **não habilita recompensas oficiais**.

## Verificações
- Seis novos testes automatizados para renderização, pendências, atualização, troca de sala, resultado colado alterado e ausência de alterações remotas.
- Versões do login, scanner, bootstrap e PWA atualizadas para v0.1.125.
- Cartas, imagens, Decks e mecânicas originais preservados.

## Próximo bloqueio
Execução real do roteiro **em dois celulares físicos**: interrupção durante o ataque, reconexão e sincronização de defesa, três nocautes, comprovantes iguais e integridade de dados. Manter a estimativa em **97%** até haver evidência dessa execução.
