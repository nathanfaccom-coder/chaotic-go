# Chaotic GO v0.1.85 — revelação opcional do Vento Forte emprestado

**Data:** 31/10/2026. **Estimativa global:** 97% (incerteza ±10 p.p., não é homologação). **Alvo:** treino experimental 3x3, sem modificação das partidas oficiais ou das cartas originais.

## Entregue

A Mão Negra (102) pode emprestar temporariamente a carta Vento Forte (105) no 3x3 experimental. Desde a v0.1.84, seu custo 1, dano-base até 5, nocautes e vitória final de treino estão integrados com devolução atômica dos empréstimos. **Agora a v0.1.85 acrescenta a escolha opcional de revelar uma criatura inimiga oculta depois do dano.**

- Nova tabela `chaotic_preview_3x3_borrowed_105_reveal_events`: um único evento por sala/turno, relacionado ao recibo real do dano de Vento Forte emprestado. `SELECT` com RLS apenas para os dois participantes; nenhuma escrita direta para navegador ou anônimo.
- `chaotic_resolve_preview_3x3_borrowed_105_reveal(uuid,integer,integer,boolean)`: somente o atacante autenticado, durante o **mesmo turno**, após o passe do defensor, débito do custo e aplicação do dano. Verifica a integridade do recibo de custo e HP, o plano de empréstimo encerrado, custódia `released`, dono original e carta em `deck`. Não há segundo débito, segundo dano ou transferência de propriedade.
- O atacante escolhe uma criatura **viva e ainda virada para baixo** em `c4`, `c5` ou `c6` para revelar, ou dispensa o efeito com uma ação explícita. Seleção inválida, alvo morto, alvo já virado, repetição, tentativa do defensor ou de terceiro são recusados antes de qualquer alteração.
- Um gatilho em `chaotic_match_turns` impede avançar o turno **depois do dano** enquanto a revelação não tiver sido decidida ou dispensada. Se o último golpe encerrou o treino, o resultado terminal tem precedência; não há revelação tardia após vitória.
- DROME: painel específico visível **mesmo após a devolução da carta original**, com escolha de alvos ocultos vivos, botão **Revelar** e botão **Dispensar**. A decisão e o estado são recuperados do servidor após reconexão. O aviso das demais cartas temporárias foi corrigido: só a 105 possui esse caminho completo no treino.
- `index.html`, `sw.js`, `scanner.html`, `scanner-completo.html` e `full-game-bootstrap.js` atualizados juntos para **0.1.85 / release-85**.

## Evidências de testes

Todos os SQL usam usuários sintéticos e **ROLLBACK**, sem afetar inventário, cartões, contas ou partidas reais.

- `supabase/tests/chaotic-borrowed-105-optional-reveal-live-v0185.test.sql`: rejeita revelação antes de pagar, após tentar pular turno, contra o alvo já revelado, pelo defensor ou duas vezes. Autoriza revelar criatura c5 viva e oculta, preserva c6, custo e HP, permite o turno seguinte e confirma RLS contra terceiro. **PASS**.
- `supabase/tests/chaotic-borrowed-105-optional-reveal-skip-v0185.test.sql`: recusa dispensar com alvo simultâneo, permite pular a revelação sem mudar criaturas ocultas ou cobrar de novo e libera o turno. **PASS**.
- `supabase/tests/chaotic-borrowed-105-reveal-after-terminal-denied-v0185.test.sql`: a vitória de treino continua devolvendo duas cartas e registrando resultado único; revelação após resultado é recusada. **PASS**.
- Regressões reais `v0182` (dano-base), `v0183` (nocaute individual), `v0184` (vitória terminal), e recusa contra equipamento foram reexecutadas e aprovadas. O teste antigo de passar turno após o dano agora registra explicitamente a decisão de **dispensar**.
- Suíte Node `tests/black-hand-borrowed-105-optional-reveal-v0185.test.mjs` mantém verificação de RLS, proteção da propriedade original, autorização, antirreplay, painel, versão e compatibilidade. Verificar status final no GitHub Actions.

## Limitações

**Equipamentos, imunidades, efeitos condicionais de outras cartas e Mugics ainda não foram concluídos.** O servidor recusa Vento Forte emprestado contra criatura defensora equipada, sem cobrar pontos. A revelação é uma flag visual de combate: nomes de criaturas podem continuar visíveis nas estruturas já existentes; não é sigilo criptográfico.

Não há premiação oficial, alteração de Deck ou álbum permanente, e as mecânicas originais dos modos 1x1/6x6 não foram removidas. **Ainda é preciso auditar o conjunto completo de combate e testar duas sessões reais simultâneas em celulares antes de homologar.**
