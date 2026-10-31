# Chaotic GO v0.1.64 — reconexão e sincronização de turnos do 3x3

**Aplicação:** 31/10/2026 (America/Sao_Paulo).

## Alterações reais
- Supabase: `supabase/chaotic-preview-3x3-peer-turn-sync-v0164.sql` aplicada ao projeto **ChaoticGO**. A RPC autenticada `chaotic_ping_preview_3x3_player` agora retorna `self_synced_current_turn`, `peer_synced_current_turn` e `both_synced_current_turn`. Esses valores dependem **simultaneamente** do horário do servidor (atividade nos últimos 25 s) e do turno visto pelo cliente. Não expõem o ID, o deck ou dados particulares do adversário.
- A RPC mantém as validações existentes de dois participantes, sala 3x3 ativa, resultado experimental e permissões (execução apenas por `authenticated`, sem SELECT direto de tabela para o cliente).
- DROME: texto genérico **“Dois jogadores conectados”** removido do status `ready` (que garante participantes cadastrados, não conexão de dois aparelhos). A confirmação de atividade e de turno vem da RPC.
- DROME: painel 3x3 diferencia o adversário **sem atividade recente**, **ativo mas ainda desatualizado neste turno**, e **ativo e sincronizado**. Exibe prontidão e sincronização como informações distintas.
- Botão **“Atualizar conexão e turno”** para buscar o estado da sala de forma manual.
- Um heartbeat de diagnóstico é consultado no início da atualização de estado, antes do carregamento sequencial do tabuleiro/cartas. Assim, redes móveis lentas reduzem a chance de falso “desconectado”.
- Atualizações por Realtime, consulta periódica e retorno do app são serializadas; se outra alteração chega durante a leitura, uma atualização adicional é feita em seguida. Respostas de uma sala anterior são descartadas se o ID mudou.
- O polling pula consultas enquanto a aba está em segundo plano; ao voltar a ficar visível ou recuperar `online`, dispara leitura imediata da sala. **Não há promessa de WebSocket permanente em segundo plano.**
- Arquivos: `chaotic-lobby.js`, `index.html` (v0.1.64) e `sw.js` (cache release-20261031-64). Cartas, sprites, imagens e Decks originais foram preservados.

## Testes
- `supabase/tests/chaotic-preview-3x3-peer-turn-reconnect-live-v0164.test.sql` — **PASS no Supabase real** com contas autenticadas sintéticas; troca de turno A→B; sinal recente mas em turno anterior; reencontro do turno atual; timeout por ausência; volta do convidado; prontidão validada de ambos, reversão total em `BEGIN/ROLLBACK`.
- `tests/peer-turn-reconnect-v0164.test.mjs` — cinco regressões novas sobre RPC, autorização, frontend, sincronização e identificação PWA.
- O frontend não prova fisicamente duas instalações; os testes simulam duas identidades no servidor. A validação manual em dois aparelhos continua necessária.

## Próximos passos
- Exercitar login, convite, ataques, visualização e resultado com dois celulares físicos diferentes e redes distintas.
- Confirmar visualmente o GitHub Pages/instalação PWA no Android.
- Concluir mecânicas de combate oficial, equipamentos, Mugics, efeitos restantes e testes de corrida/reconexão durante dano real.

**Progresso estimado: 93% (±10 pontos percentuais)** — indicador manual de desenvolvimento, **não** 93% de garantia de qualidade ou prontidão para publicação.
