# Chaotic GO v0.1.124 — correção da restauração silenciosa do comprovante 3×3
**2 de novembro de 2026. Progresso geral estimado: 97%.**

## Correção
- Ao voltar para uma aba no Android, o navegador pode restaurar ou preencher o campo do segundo comprovante sem disparar input/change. Uma mensagem de correspondência anterior poderia permanecer visível.
- A interface confere novamente os snapshots local e colado a cada atualização do relatório e ao focar o campo. Divergências invalidam a confirmação anterior e exigem nova comparação explícita.
- Quando o conteúdo permanece igual, a interface não produz alertas desnecessários.
- Foram adicionados sete testes de regressão.
- Nenhuma carta, imagem, Deck, mecânica original, RPC, XP, moeda ou dado permanente é alterado.

## Para homologar
Executar uma partida 3×3 completa em dois celulares físicos: desconexão durante ataque, reconexão, defesa, pagamento e dano sem duplicação, três nocautes e resultado igual nos dois aparelhos. A igualdade textual de comprovantes NÃO comprova dois aparelhos físicos. Manter 97% até esse teste.
