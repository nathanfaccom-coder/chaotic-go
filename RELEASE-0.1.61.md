# Chaotic GO 0.1.61 — Diagnóstico de dois jogadores no treinamento 3x3

**Implementação:** 30/10/2026 (America/Sao_Paulo).

## Mudança funcional
- O treinamento 3x3 agora possui painel de **atividade recente, prontidão do anfitrião e convidado, turno atual e resultado do treino**, sem alterar o combate oficial.
- Nova tabela `chaotic_preview_3x3_player_presence`: por sala e ator, apenas `last_seen_at`, `last_seen_turn` e `ready_for_test`. Os registros NÃO são expostos por tabela ou via Supabase Realtime; RLS habilitado, sem permissões de leitura/escrita de clientes.
- Nova RPC autenticada `chaotic_ping_preview_3x3_player(uuid,boolean)`, em `supabase/chaotic-preview-3x3-two-player-preflight-v0161.sql`, aplicada ao Supabase real. Exige um usuário de uma das duas contas participantes, sala 3x3 pronta e não expirada, partida ativa e identidades consistentes. Seu relógio é **o do servidor**; outra pessoa só é considerada com atividade recente quando seu último ping ocorreu há **25 segundos ou menos**.
- Os botões **Estou pronto para testar o 3x3** e **Retirar meu pronto** refletem o registro do servidor. Os dois jogadores só aparecem “prontos para testar” quando os dois sinalizaram prontidão **e** têm atividade recente. `p_ready=null` preserva o status e atualiza o último sinal durante a sincronização periódica de 6 segundos já existente no DROME. O painel deixa claro que **um ping não prova dois celulares reais nem substitui uma partida ponta a ponta**.
- A RPC retorna `training_finished` e `you_won_training` lendo a tabela **já existente** `chaotic_preview_3x3_training_outcomes`. Não muda turnos, HP, Deck, cartas, resultados oficiais, XP ou moedas. Um novo “pronto” é rejeitado após a vitória registrada.
- Arquivos atualizados: `chaotic-lobby.js`, `index.html` (VERSÃO 0.1.61), `sw.js` (cache release-61), simulações do navegador `tests/turns.test.mjs`. **Nenhuma arte ou carta original modificada.**

## Prova de execução
- `supabase/tests/chaotic-preview-3x3-two-player-preflight-live.test.sql`: **PASS** no Supabase real, testando duas contas **sintéticas autenticadas**, prontidão host/guest, consulta dos dois pontos de vista, perda de atividade após **45 segundos**, reconexão, retirada da prontidão e bloqueio de uma terceira conta. Tudo dentro de `BEGIN/ROLLBACK`; dados fictícios descartados.
- A integridade do registro de vencedor impede que se invente uma vitória sem janela defensiva e ataque válidos. O teste de prontidão foi mantido separado dos cenários canônicos de nocaute, sem relaxar as chaves estrangeiras.
- `supabase/tests/chaotic-preview-3x3-two-player-preflight-audit.test.sql`: **PASS** para autenticação, concessões, ausência de RLS de escrita direta, servidor como fonte do horário, não-publicação Realtime e isolamento do resultado oficial.
- `tests/two-player-preflight.test.mjs`: seis novos testes de preflight/privacidade/estado do DROME. A suíte GitHub Actions da implementação passou **133/133 testes** e sintaxe. Reexecutada a suíte SQL de **12 cenários de combate** anteriores: **PASS** após a migração.
- Repositório GitHub reporta `has_pages=true`, ou seja, o recurso Pages está habilitado, **mas a URL publicada e seu conteúdo atual não puderam ser verificados**. Não interpretar isso como publicação confirmada.

## Limitações reais
O trabalho desta versão prepara e diagnostica uma sessão de **dois jogadores**, mas **não é uma partida completa efetivamente testada em dois celulares**. O 3x3 ainda é experimental; a resolução completa de ataques restantes, Mugics, equipamento, vitória oficial e validação visual/publicação de ponta a ponta permanecem pendentes. A presença indica um pedido recente ao Supabase, não prova que a tela está visível ou que o dispositivo terá conexão estável.

**Progresso geral estimado: 90% (±10 pontos percentuais); cerca de 10% restantes segundo a estimativa manual.** Este número não substitui uma lista de critérios de aceite nem demonstra prontidão para entrega.
