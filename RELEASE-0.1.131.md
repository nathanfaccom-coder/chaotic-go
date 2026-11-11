# Chaotic GO v0.1.131 — resultados oficiais com origem verificável

**11 de novembro de 2026.**

## Segurança de recompensas
- Nova tabela \`chaotic_official_match_results\` com status \`pending_engine_verification\` ou \`verified\`, vencedor do par participante, modo e proveniência obrigatória. Ainda não existe um motor que produza resultados oficiais verificados: a tabela começa vazia.
- RLS: somente host e convidado conseguem ler uma eventual partida; **nenhum jogador pode gravar resultados**.
- O extrato de XP/moedas agora exige uma chave estrangeira para um resultado oficial existente e o gatilho valida \`verified\`, vencedor, destinatário e tipo de premiação. Resultados de treino DROME continuam explicitamente bloqueados.
- \`chaotic_my_official_reward_totals()\` consulta a **soma de todo o extrato autenticado** com SECURITY INVOKER. Não utiliza perfil legado editável e não estima saldo a partir das últimas 20 linhas.
- Contas comuns não podem inserir resultados, modificar recompensas ou chamar uma RPC de pagamento; **nenhum pagamento foi ativado**.

## Interface
- DROME → Sala privada → Extrato de recompensas oficiais: se o servidor disponibiliza o total, mostra XP e moedas somados para todo o histórico, além do recorte dos últimos 20 lançamentos.
- Quando o servidor está indisponível, preserva os últimos lançamentos confirmados em vez de inventar um total; respostas atrasadas de outra tela não são aplicadas.
- Mantidas cartas, Decks, scanner, coleção, telas móveis e combate.

## Limites
- Esta não é a implementação completa de uma partida oficial; não produz vitórias oficiais nem concede XP ou moedas.
- Antes de habilitar pagamentos será necessário finalizar e auditar um motor autoritativo, conferir compra/posse de cartas, turnos, efeitos, danos e nocautes, definir valores de recompensa e implementar liquidação atômica idempotente.
