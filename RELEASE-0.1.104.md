# Chaotic GO v0.1.104 — saída automática de salas encerradas

**1º de novembro de 2026 · progresso geral estimado: 97%.**

## Corrigido
- Quando a sala deixa de existir ou o acesso é revogado, o DROME agora reconstrói a tela, descartando os estados temporários do combate anterior e permitindo criar ou entrar em outra sala. Uma consulta antiga não pode fechar uma sala mais recente.
- Salas 3×3 canceladas ou expiradas executam primeiro a recuperação de cartas emprestadas confirmada pelo servidor e **somente depois** reconstruem a tela. A limpeza local nunca é apresentada como recuperação do servidor se a RPC falhar.
- Salas de outros modos encerradas/expiradas também saem do estado bloqueado, sem chamar funções específicas de empréstimos 3×3.
- Se o login recuperar a sala mas a consulta do turno falhar por conexão, o DROME mantém a sala e informa que é necessário usar **Atualizar conexão e turno**, sem repetir ataques, passes ou pagamentos.
- Versões do login, scanner, bootstrap e Service Worker sincronizadas para release-104.

## Testes e limite de homologação
Nove testes específicos cobrem expulsão/fechamento pelo anfitrião, expiração, recuperação de empréstimos, revogação de membro, resposta atrasada, falha de rede, partida ativa e mensagem de restauração. Nenhuma arte, carta, Deck, saldo, tabela SQL ou dado permanente foi alterado. A partida completa 3×3 entre dois celulares reais ainda é necessária antes de homologar o multiplayer.
