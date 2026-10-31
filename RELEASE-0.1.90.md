# Chaotic GO v0.1.90 — estabilidade e fluxo jogável de dois participantes

**Data:** 31 de outubro de 2026. **Progresso geral estimado:** 97% (não é homologação; margem de incerteza elevada).

## Prioridade desta versão

**Pausar novas cartas e efeitos para consolidar o percurso essencial:** abertura → login → scanner → DROME → sala privada 3x3 → preparação de dois usuários → combate por turnos → nocaute → resultado de treinamento.

Esta atualização não transforma os modos de combate em oficiais nem afirma que dois celulares físicos já foram homologados.

## Correções entregues

- **Login e sessão:** os três HTML de login usam recursos versionados da release-90. A autenticação redireciona ao scanner autenticado. O comando de **tentar conexão novamente** recarrega a página sem desconectar o jogador; a ação de **sair** continua separada.
- **Scanner e celular:** scripts essenciais do scanner e bootstrap estão sincronizados na v0.1.90. O painel do DROME tem rolagem vertical e controles dimensionados para toque. A página inicial deixa de bloquear o zoom móvel. A opção de instalação não promete partida offline, pois autenticação e sincronização de combate necessitam de internet.
- **Treinamento 3x3 em primeiro plano:** a entrada destaca a sala privada por código, sem apagar os modos anteriores, que permanecem identificados como em desenvolvimento/teste. Os Decks, cartas, artes, álbuns e dados permanentes não foram migrados destrutivamente.
- **Ação offline segura:** `chaotic-lobby.js` recusa novos comandos quando `navigator.onLine === false` antes de chamar o Supabase; mostra aviso de que não houve envio nem consumo de pontos. Ao voltar a conexão, o DROME **consulta o turno no servidor** ou recupera a sala válida, sem reenviar automaticamente ataque ou pagamento que talvez já tenha sido efetuado.
- **Publicação mais rigorosa:** `.github/workflows/verify-publication.yml` exige HTTP 200 de **20 arquivos essenciais** do site, incluindo login, scanner completo, autenticação, módulo de inicialização, DROME, CSS, JS e manifesto. Confere ainda os links da abertura, a presença dos scripts no login e a versão correta do bootstrap, DROME e service worker publicados. Um único index.html acessível já não basta.
- **Regressão e execução:** `tests/stable-two-player-public-smoke-v0190.test.mjs` executa teste JavaScript em ambiente isolado que comprova que um toque offline não aciona uma jogada e que, após conexão, a ação só executa ao ser iniciada novamente. Outros testes da release verificam login real simulado, botão de reconexão sem logout, caminhos entre telas, CSS móvel, testes SQL e integridade das versões. O teste v0.1.89 passou a aceitar futuras versões do app sem deixar de conferir sincronização da PWA.

## Evidência de integração com o Supabase (ROLLBACK)

Reexecutei no servidor, com contas fictícias e transações que **não persistem**:
1. `supabase/tests/chaotic-preview-3x3-two-player-preflight-live.test.sql`: dois participantes prontos, estado offline/stale, alternância de pronto e bloqueio de terceiro — **PASS**.
2. `supabase/tests/chaotic-preview-3x3-peer-turn-reconnect-live-v0164.test.sql`: turno após passe, desconexão, sincronização e recuperação do segundo participante — **PASS**.
3. `supabase/tests/chaotic-preview-3x3-three-knockouts-live-v0163.test.sql`: três nocautes reais nos turnos 1, 3 e 5; vencedor e derrotado veem o mesmo resultado de treino; sem bônus, moedas ou vitória oficial; tentativa de turno extra rejeitada — **PASS**.

**Validação contínua GitHub Actions:** 314 testes aprovados, 0 falhas, execução `41247443374`.

## Falta para considerar o Chaotic GO pronto

- **Homologação manual e visual em dois celulares físicos reais**, incluindo interrupção de internet no meio de pagamento/resposta defensiva e reconexão.
- Auditoria de todas as habilidades, Mugics, outros equipamentos e ataques ainda não resolvidos. Treino 3x3 não equivale a modo oficial.
- Revisão completa de UX em aparelhos pequenos, performance em rede móvel, instalação PWA e textos de falha da sessão.
- Não afirmar disponibilidade pública da release atual até que o workflow `Verificar publicação pública` confirme o conteúdo remoto. O commit de implantação e a checagem de conteúdo do Pages são passos separados.

**Esta é uma versão de estabilização, não de novas regras de combate.** Nenhuma carta, arte, Deck ou mecânica existente foi removida.
