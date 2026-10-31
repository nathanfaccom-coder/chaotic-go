# Chaotic GO v0.1.72 — SOPRO (115) com descarte aleatório privado

**Data:** 31/10/2026. **Escopo:** treinamento experimental 3x3; nada removido do álbum, imagens, cartas, Decks ou sistemas oficiais.

## Regra e escolha técnica

O catálogo original informa que **SOPRO (115)** custa **0**, causa **0 de dano** e faz o oponente descartar **uma carta aleatória da mão**. A ação não transfere a propriedade da carta: ela continua registrada no Deck original do defensor e apenas muda de `hand` para `spent` na **mão temporária do treino**.

A **Mão Negra (102)** continua desabilitada para pagamento, pois precisa do conceito de **carta temporariamente roubada** entre dois jogadores. O modelo atual atrela cada carta ao álbum/Deck do dono; transferir diretamente sua linha de mão a outro usuário quebraria verificações de sincronização e arriscaria duplicação ou desaparecimento de carta. Não simular a carta 102 como descarte: isso alteraria a regra original.

## Implementação real no Supabase

- `supabase/chaotic-preview-3x3-sopro-115-v0172.sql`: nova função `chaotic_apply_preview_3x3_training_sopro_115(uuid,integer)`, com verificação da identidade autenticada, sala e turno, defesa concluída, pagamento, componentes originais, criaturas e equipamento. Bloqueia a linha da partida `FOR UPDATE` e só permite um evento de resolução por turno.
- Seleciona **uma carta que esteja realmente na mão do defensor**, usando `ORDER BY pg_catalog.random() LIMIT 1 FOR UPDATE`. A seleção e o descarte ocorrem na mesma transação que o evento de resolução.
- O cartão muda somente para `card_state='spent'`, `spent_reason='discard'`, o motivo permitido pela restrição existente. **Não altera `actor_id`**, `attack_instance_id`, álbum, Deck, carteira de pontos nem HP. Se a mão do defensor estiver vazia, o efeito é registrado como sem descarte; não cria uma carta.
- Adiciona `chaotic_preview_3x3_training_damage_events.sopro_discarded_card` (booleano); o evento público contém **apenas sucesso/falha** e não revela ID, nome, slot ou ordem da carta descartada. O dono a verá atualizada na própria mão.
- O gasto usa o 115 apenas agora que existe resolução real: `supabase/chaotic-preview-3x3-spend-sopro-v0172.sql`. Mantém todos os guardas de pagamento e bloqueio de repetição, custo original zero e dano zero.
- Restrição de consistência do efeito, restrição de catálogo e status de resolução `training_sopro_115_random_discard_resolved`. Apenas `authenticated` recebe EXECUTE; `anon` não.
- `chaotic_preview_3x3_attack_hand_spent_reason_check` foi **preservada**, sem relaxar suas regras.

## DROME / Android

A interface agora inclui o 115 entre os ataques experimentais permitidos. Ao resolver, chama a função do Supabase, atualiza a mão/estado e exibe mensagem de descarte ou mão adversária vazia. A mensagem não revela a identidade da carta escolhida. O histórico mostra o booleano `sopro_discarded_card` após reconexão e usa a etiqueta SOPRO.

O cache foi atualizado para **v0.1.72** no `index.html`, `sw.js`, `full-game-bootstrap.js`, `scanner.html` e `scanner-completo.html`. Todas as artes e cartas originais foram mantidas.

## Teste real, reproduzível e revertido

`supabase/tests/chaotic-preview-3x3-sopro-115-live-v0172.test.sql` executado **com PASS** no Supabase:
- Duas contas de teste, sala 3x3, turnos e equipamentos sintéticos;
- Pagamento da carta 115 pelo atacante, com 0 pontos debitados;
- Defesa concluída pelo defensor;
- Tentativa de usar SOPRO pelo próprio defensor bloqueada;
- **Uma** carta privada da mão defensora descartada; a propriedade e a instância originais permanecem no registro do dono;
- HP antes e depois idênticos, nenhum recurso oficial alterado;
- Segundo uso do mesmo efeito rejeitado por antirreplay, sem descartar outra carta;
- Retomada normal do turno e manutenção dos três nocautes de teste por Fogo Primordial 104 e Vento Forte 105;
- `BEGIN/ROLLBACK`: nenhum dado fictício de jogador ou partida foi preservado.

`tests/sopro-115-v0172.test.mjs` adiciona cinco regressões automatizadas: regra original, escopo da mão do defensor, privacidade e bloqueio, teste SQL e UI/versão. A suíte completa deve passar antes de publicar.

## Limites e próximo foco

- Mão Negra (102), Aliança (103), Armadilha de Víbora (106) e TORNADO (109) continuam pendentes. A Mão Negra precisa de suporte seguro a posse temporária; nunca trocar `actor_id` de carta original.
- A aleatoriedade via `random()` do PostgreSQL é adequada ao treino, mas não criptograficamente auditável para jogos com apostas.
- O teste no banco intercala operações autenticadas em uma transação, **não** substitui conexões concorrentes independentes e homologação em **dois celulares físicos**.
- Revisão de segurança de `SECURITY DEFINER`, proteção de senhas e finalização do PvP oficial ainda pendentes.
- **Progresso manual geral mantido em 97%, ±10 pontos percentuais**. O número é estimativa, não indicador de que o lançamento esteja homologado.
