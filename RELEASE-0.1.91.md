# Chaotic GO v0.1.91 — recuperação segura de salas
**31 de outubro de 2026. Progresso estimado: 97%.** Isto não é homologação em dois aparelhos.

- Impede que uma resposta atrasada da recuperação de cartas temporárias feche a sala nova que o jogador abriu.
- A recuperação da sala antiga respeita a geração da tela e não apaga outra sala nem interrompe ações em curso.
- Suspende consultas periódicas do DROME enquanto o celular está offline; quando a conexão retorna, lê o estado no servidor, sem repetir ataque ou pagamento.
- Corrige mensagens antigas que descreviam incorretamente o treino 3x3 como sem dano, nocaute ou vitória.
- Sincroniza splash, login, scanner, bootstrap, cache e JavaScript na release-91. Não altera imagens, cartas, Decks, recompensas nem dados do Supabase.

**Teste prioritário pendente:** duas contas em dois celulares físicos, da criação de sala ao resultado do 3x3, com uma desconexão no meio do combate. O modo oficial continua indisponível.
