# Chaotic GO v0.1.123 — confirmação de dois comprovantes expira quando o texto colado muda

**2 de novembro de 2026 · progresso geral estimado: 97%.**

## Correção na comparação de dois celulares

- A v0.1.122 permitia colar no DROME o resumo do segundo celular e comparar sala, vencedor, derrotado, turno decisivo e os três nocautes. No entanto, depois de aparecer **RESUMOS COINCIDEM**, alterar o texto colado podia deixar a aprovação antiga visível.
- Agora, qualquer edição, nova colagem ou mudança no campo do outro aparelho revoga imediatamente a comparação anterior, exibe **Resumo do outro aparelho alterado. Compare novamente os dois comprovantes**, e apaga os dois snapshots anteriores.
- Só um novo clique em **Comparar os dois comprovantes** poderá mostrar novamente coincidência ou divergência.
- Cada comparação registra apenas as duas strings consultadas na tela; não gera prova criptográfica nem identifica fisicamente aparelhos. A atualização do comprovante local já limpa a confirmação obsoleta quando o servidor fornece outro resultado.
- Toda essa alteração ocorre localmente na interface: nenhum RPC de combate, escritura no Supabase, XP, moeda, carta, Deck ou dado permanente é modificado.

## Validação

- Sete testes novos para snapshots, digitação, substituição via evento de alteração, recomparação, restauração de texto, proteção contra escrita/injeção e mudança do resultado local.
- Mantidas as verificações de proteção anteriores, incluindo a advertência expressa de que **textos coincidentes NÃO comprovam dois celulares físicos**.
- Atualizados versão visual, login, scanner, bootstrap e cache da PWA para v0.1.123.

## Pendência real

Falta executar uma partida de treinamento 3×3 em **dois celulares físicos**, incluindo perda de conexão durante um ataque, reconexão, defesa, três nocautes e comparação do resultado. Os **97%** são apenas uma estimativa; a comparação textual sozinha não homologa o multiplayer.
