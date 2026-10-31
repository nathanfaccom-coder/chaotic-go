# Chaotic GO v0.1.71 — SPEED (108) no treinamento 3x3

**Data:** 31/10/2026 (America/Sao_Paulo). **Escopo:** ataque original SPEED, sem trocar imagens, cartas, Decks, 1x1, 6x6 ou combate oficial.

## Regra original conferida
A carta **SPEED**, ID **108**, tem **0 de dano-base**, **custo 0** e texto de efeito: comprar **mais uma carta do monte de ataques**. Não ataca o HP adversário nem altera moedas ou XP.

## Alterações aplicadas ao Supabase
- `supabase/chaotic-preview-3x3-speed-108-v0171.sql`: nova função `chaotic_apply_preview_3x3_training_speed_108(uuid,integer)`, com autenticação por `auth.uid()`, conferência de anfitrião/convidado, turno corrente, pagamento, resposta defensiva, inspeção de criaturas/equipamentos e bloqueio da linha da partida por `FOR UPDATE`.
- O efeito adquire bloqueio de carteira e mão do **atacante**, exige sincronização de turno e mantém o limite de **5 cartas na mão**. Compra somente do monte do próprio jogador; quando vazio, pode reciclar descartes de treino usando o procedimento da compra normal, respeitando o limite de ciclos. Não altera a mão do defensor.
- `chaotic_preview_3x3_training_damage_events.speed_drew_card` registra **apenas se houve compra**, sem divulgar o ID, slot ou nome da carta privada ao oponente. O registro do turno tem dano base **0**, HP antes/depois idênticos e efeitos concluídos. A resolução é feita na mesma transação que a compra.
- Proteções de integridade do banco: `chaotic_preview_3x3_speed_private_draw_check`, extensão da validação de catálogo de eventos para 108 e novo status `training_speed_108_bonus_draw_resolved` após efeito concluído. Não permite segunda execução, nova carta ou novo pagamento do mesmo turno.
- `supabase/chaotic-preview-3x3-spend-speed-v0171.sql` adiciona o 108 à lista de ataques que podem ser pagos, **somente após a resolução experimental estar implementada**. Mantém os 9 ataques anteriormente suportados.
- `anon` não tem permissão de executar a nova função; `authenticated` tem permissão de chamá-la, mas o corpo valida turno, sala e participação efetiva. Nenhum dado oficial foi alterado.

## Interface DROME / Android
- `chaotic-lobby.js` agora reconhece a carta 108 e chama `chaotic_apply_preview_3x3_training_speed_108` após o defensor concluir a janela de reação.
- Exibe o resultado de compra **sem mostrar a carta ao adversário** e informa que SPEED não causa dano.
- O histórico recuperado do servidor inclui apenas `speed_drew_card`; a mão continua consultada pelo próprio usuário conforme as regras privadas atuais.
- Atualizados `index.html`, `sw.js`, `scanner.html`, `scanner-completo.html` e os imports para **versão 0.1.71**, com invalidação do cache da versão anterior.

## Testes concretos
- `supabase/tests/chaotic-preview-3x3-speed-108-live-v0171.test.sql`: **PASS** no banco real, com duas contas fictícias autenticadas, vitória experimental mantida e `ROLLBACK`. A função real de gasto aceita custo zero, a defesa real passa, o atacante compra **exatamente uma** carta adicional privada com **0 dano** e **0 gasto**. Um defensor não pode acionar a compra. Repetição da função não compra segunda carta. A partida consegue avançar ao turno seguinte; a sequência com Fogo Primordial e Vento Forte ainda conclui três nocautes, preservando vitória/derrota.
- `tests/speed-108-v0171.test.mjs`: cinco testes adicionais de regra, privacidade, limites de mão, antirreplay, integração SQL, interface e cache.
- GitHub Actions: **186/186 testes aprovados**, sem falha de sintaxe, no run `41192534833` do código antes deste relatório. A execução após o último commit deve ser consultada antes de anunciar homologação final.
- Verificação de auditoria: `anonymous_allowed=false`; **zero** contas fictícias e eventos SPEED artificiais persistiram após a transação.

## Limitações e próximas prioridades
1. O **treinamento 3x3** é experimental; o jogo completo ainda necessita fechar mecânicas do PvP oficial, equipamentos, Mugics e interações de efeitos.
2. Restam cinco ataques originais sem resolução 3x3 completa: **Mão Negra (102), Aliança (103), Armadilha de Víbora (106), TORNADO (109) e SOPRO (115)**. Não liberar pagamentos até suas resoluções serem implementadas.
3. Não houve testes físicos em dois celulares nem **requisições simultâneas independentes**; testes de SQL intercalaram os jogadores numa transação única. Conferir também o caso de monte vazio e mão cheia em homologação real.
4. A revisão de segurança do Supabase ainda aponta **76 funções SECURITY DEFINER executáveis por contas autenticadas**, 7 tabelas com RLS sem política direta e um alerta de proteção contra senhas comprometidas. Esses alertas não são prova isolada de falha, mas precisam de revisão individual.
5. As verificações da API permitem somente membros da sala. A carta adicional não aparece no evento público; o jogo continua limitado pelas políticas de acesso dos registros privados da mão.

**Progresso geral manual mantido em 97% (incerteza ±10 pontos percentuais)**, sem afirmar que o jogo esteja pronto para lançamento oficial.
