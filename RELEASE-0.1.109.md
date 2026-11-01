# Chaotic GO v0.1.109 — descartar respostas antigas na leitura do combate 3×3

**1º de novembro de 2026 · progresso estimado: 97%.**

## Correção de sincronização
- Duas leituras do estado do mesmo combate e turno podiam disputar o painel quando uma consulta lenta coincidisse com uma atualização depois de um ataque, defesa ou pagamento.
- Cada leitura do estado 3×3 agora recebe um identificador monotônico. Se uma consulta mais nova começar, a anterior não pode gravar novamente cartas, HP, posições ou estado das ações, mesmo que a sala e o número do turno permaneçam iguais.
- Continua a verificação anterior de sala, tela e turno. A mudança não altera permissões nem substitui o estado autoritativo do Supabase.
- Nenhuma ação é reenviada automaticamente: sem ataques, pagamentos, passes, empréstimos ou mutações nos Decks.

## Validação
- Quatro novos testes de concorrência verificam respostas invertidas, leitura antiga interrompida após atualização parcial, mudança de turno e proteção do checkpoint.
- Versões de cache do login, scanner, bootstrap e Service Worker atualizadas para 0.1.109.
- O teste de partida 3×3 completa em dois celulares, com reconexão no meio do ataque e vitória conferida em ambos os lados, continua pendente. **97% ainda é uma estimativa, não homologação do multiplayer.**
- As cartas, as imagens, os Decks e os dados permanentes existentes permanecem intactos.
