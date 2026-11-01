# Chaotic GO v0.1.119 — comprovante final prioritário e histórico opcional

**1º de novembro de 2026 · progresso estimado: 97%.**

## Correções
- A versão anterior já encurtava a atualização após `match.status='finished'`, mas ainda aguardava o histórico de eventos `chaotic_match_events` antes de carregar os dados decisivos da vitória 3×3.
- Agora a consulta ao comprovante final de treinamento acontece **primeiro**. Ela recupera os nocautes e o resultado no servidor, e o histórico é consultado **depois**, como complemento.
- Se o histórico estiver lento, o comprovante já foi carregado. Se a consulta histórica falhar, a tela informa que o histórico está indisponível, **sem apagar ou bloquear** o resultado registrado.
- A resposta de uma sala abandonada não gera aviso de falha na sala recém-aberta. A checagem de `room`, geração de tela e objeto de partida continua isolando atualizações antigas.
- Ao finalizar uma partida, o diagnóstico de presença — disponível apenas durante o jogo ativo — deixa de exibir uma mensagem de espera infinita. A interface passa a orientar o jogador a conferir o comprovante.
- Partidas ativas e demais modos continuam usando a cadeia completa de atualização. Nenhum ataque, defesa, pagamento, recompensa ou carta original foi modificado.
- Cache do PWA, login, scanner e bootstrap sincronizados para 0.1.119.

## Testes
- Nove novos testes cobrem ordem de prioridade, erro e demora do histórico, sala trocada, ausência de avisos tardios, preservação dos modos ativos, diagnóstico após o encerramento e somente leitura.
- Testes anteriores foram ajustados à nova ordem para continuar cobrindo os mesmos riscos de respostas atrasadas.
- Cinco testes SQL de integração real do Supabase, executados previamente com transações revertidas, estão documentados em `docs/QA-3X3-SUPABASE-LIVE-2026-11-01.md`.

**Limitação:** ainda falta uma partida de validação ponta a ponta em dois celulares físicos, com interrupção durante o ataque, reconexão, resposta defensiva, três nocautes e comprovante idêntico nos aparelhos. O percentual permanece em 97% como estimativa, e não como homologação.
