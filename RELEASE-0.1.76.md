# Chaotic GO v0.1.76 — detalhes privados de empréstimos e devolução automática

**Data:** 31/10/2026. **Escopo:** infraestrutura segura de posse temporária para o treinamento experimental 3x3; sem alteração em cartas originais, álbum, Decks, imagens, recompensas ou PvP oficial.

## 1. Exibir a carta emprestada somente ao tomador

**Servidor:** `supabase/chaotic-preview-3x3-borrowed-attack-inspection-v0176.sql`

Nova RPC `chaotic_get_preview_3x3_borrowed_attacks(uuid)`:
- Exige `auth.uid()`, participação real em partida 3x3 ativa e sala correspondente. Só considera custódias com `borrower_id=auth.uid()`, `custody_state='held'` e `training_only=true`.
- Confere que a instância original continua no **registro do dono** com `card_state='loaned'` e que o catálogo coincide com o **álbum do dono original**. Valida nome, custo e dano-base. Uma divergência aborta a consulta.
- Devolve ao **tomador** nome da carta, ID do modelo (não da instância privada), custo, dano-base, turno e ID da custódia. **Não** devolve ID original da instância, slot do adversário, posição no monte, inventário completo ou outros dados do álbum alheio.
- Retorna explicitamente `ownership_transferred=false`, `training_only=true`, `playable=false` e `payment_enabled=false`. A consulta não transfere ou consome nenhuma carta.
- Executável por `authenticated` somente depois da validação no corpo; `anon` sem execução. A custódia continua com RLS própria.

**Interface:** `chaotic-lobby.js` consulta a nova RPC durante a atualização do 3x3 e mostra, em área separada, a carta recebida temporariamente, custo e dano-base originais, com alerta de que **ainda não pode ser usada**. Nunca mistura cartas emprestadas com os slots do Deck do tomador. O estado se atualiza ao reconectar.

**Teste real:** `supabase/tests/chaotic-preview-3x3-borrowed-card-private-live-v0176.test.sql`. Passou no Supabase com empréstimo interno fictício (apenas em transação de teste revertida). O tomador consultou corretamente **Vento Forte (105), custo 1, base 5**; o dono não viu essa carta como emprestada por ele; terceiro foi bloqueado; após a devolução a carta não apareceu como emprestada. A resposta não vazou ID de instância ou slot original. O papel `authenticated` teve permissão somente de consulta, nunca de executar o roubo interno.

## 2. Devolver automaticamente as cartas quando o treinamento termina

**Servidor:** `supabase/chaotic-preview-3x3-return-loans-on-outcome-v0176.sql`.

Um gatilho `BEFORE INSERT` da tabela `chaotic_preview_3x3_training_outcomes`, `chaotic_restore_3x3_loans_before_training_outcome()`, executa **na mesma transação** que registra o resultado experimental:

- Procura empréstimos `held` da sala e bloqueia suas linhas para serializar a devolução;
- Confere dono e destinatário contra os dois participantes do resultado, a instância original, o slot e o estado `loaned`;
- Devolve cada carta ao **monte do dono original**, sem transferir `actor_id`, ID do ataque, Deck ou álbum, e encerra a custódia como `released` com turno de devolução;
- Recusa resultado ou empréstimo inconsistente (falha segura), impedindo que uma eliminação deixe uma carta presa em estado impossível;
- Não altera a vitória oficial, XP, moedas, HP oficial ou recompensas. Se não há cartas emprestadas, o gatilho não modifica nada.

É propositalmente **BEFORE INSERT**: após existir um resultado de treinamento, o gatilho de bloqueio terminal já impede alterações na mão. A devolução deve ocorrer imediatamente antes do registro final.

**Teste real:** `supabase/tests/chaotic-preview-3x3-automatic-loan-return-v0176.test.sql`. Passou no banco com dados sintéticos revertidos:
1. A carta emprestada foi colocada propositalmente em estado inconsistente dentro do teste; inserir resultado foi bloqueado, sem criar vitória falsa;
2. Corrigido o estado, o mesmo resultado foi registrado e a carta voltou automaticamente ao monte do dono;
3. Custódia passou de `held` para `released`; não restou empréstimo ativo;
4. Flags de resultado oficial, XP e moedas permaneceram `false`;
5. `BEGIN / ROLLBACK` deixou os usuários, salas, cartas e resultados de teste sem persistência.

## 3. Regressões e compatibilidade

- `tests/black-hand-borrowed-inspection-v0176.test.mjs`: cinco testes para autorização, integridade do álbum, não vazamento, teste real, UI e PWA.
- `tests/black-hand-terminal-return-v0176.test.mjs`: três testes para atomicidade da devolução, proteção do resultado terminal e teste SQL.
- `tests/turns.test.mjs`: mock de RPC privada incluído para representar consultas autenticadas e vazias em partidas em que a 102 ainda está desabilitada.
- `tests/black-hand-loan-v0175.test.mjs`: verificação de versão futura corrigida, sem remover seus testes de proteção antirreplay.
- Todas as cartas e as funcionalidades 1x1, 6x6, Decks, dano, SPEED, SOPRO e TORNADO permanecem. **217/217 testes de Node aprovados**, sem falhas e sem erros de sintaxe do jogo no GitHub Actions run `41199921744`.
- `index.html`, `sw.js`, `scanner.html`, `scanner-completo.html` e `full-game-bootstrap.js` atualizados para **v0.1.76**.

## 4. Limitações e próximos passos

**Mão Negra (102) ainda não é jogável.** O uso exige ligar o pagamento original da 102 a uma resolução atômica; permitir a projeção e o custo de um ataque emprestado sem falsificar `actor_id` no Deck; aplicar efeito/dano uma vez, marcar a custódia como usada e devolver ao dono quando necessário; cobrir desconexões e encerramentos sem resultado formal. Não libere o gasto de 102 antes de completar a cadeia.

A devolução automática cobre o **resultado terminal de treinamento**. Uma sala simplesmente fechada/expirada sem resultado ainda exige um caminho seguro de limpeza futura ou a exclusão normal da sala por FK; não afirmar cobertura completa.

Permanecem: **Aliança (103), Armadilha de Víbora (106)**, equipamentos, Mugics, combate oficial, revisão granular de permissões privilegiadas e teste simultâneo em dois celulares físicos. Não houve homologação móvel nem prova de concorrência em conexões SQL independentes.

**Estimativa global mantida em 97% (±10 pontos percentuais)**, avaliação manual, não certificado de pronto para lançamento.
