# Chaotic GO v0.1.68 — conflitos de ações do 3x3

**Data:** 31/10/2026. **Escopo:** integridade do treinamento multiplayer 3x3, sem alterar cartas, imagens, Decks, 1x1 ou 6x6.

## Corrigido no Supabase real

A função pública autenticada `chaotic_pass_turn(uuid,integer)` já bloqueava a linha da partida com `FOR UPDATE` e negava salto de turno se houvesse defesa pendente, ataque pago sem dano, decisão opcional pendente ou resultado final. Faltavam dois casos relevantes de reconexão: um contato já aberto sem pagamento e uma projeção de ataque ainda não paga.

A migração `chaotic_prevent_unpaid_3x3_turn_skip_v0168` foi aplicada e registrada em `supabase/chaotic-preview-3x3-turn-consistency-v0168.sql`. Agora:
1. Contato de treino 3x3 aberto pelo atacante sem registro de pagamento: troca de turno negada.
2. Projeção de ataque criada mas ainda sem pagamento do ataque correspondente: troca de turno negada.
3. Defesa aberta, pagamento concluído sem dano, revelação opcional do Vento Forte, SONAR e vitória de treino continuam bloqueando o turno como antes.
4. Todas as verificações são específicas do modo 3x3 e a função mantém os controles de 1x1/Burst e 6x6. Não foram alterados álbuns, HP oficial ou moedas.

Auditoria de RPCs: a função de passagem de turno, a função de defesa e as seis rotinas de dano experimental consultadas possuem bloqueio da linha de partida; nenhum desses oito endpoints está aberto a `anon`. Um lock por sala serializa mutações concorrentes **quando todas seguem a mesma ordem de lock**. Isso reduz condições de corrida, não é uma prova formal de ausência de deadlocks/corridas em todo o jogo.

## Atualização do DROME

Em `chaotic-lobby.js`:
- O botão de passar o turno também fica oculto quando existe contato ou ataque ainda sem pagamento.
- Antes de responder à defesa, aplicar dano ou passar o turno, o cliente consulta `chaotic_get_preview_3x3_resume_status`. Se o número do turno, a fase ou a autorização da etapa estiverem desatualizados, interrompe e pede nova sincronização.
- O servidor **continua sendo a autoridade definitiva**: a consulta preliminar não substitui os locks, o JWT, as verificações de fase e o turno esperado dentro das RPCs.
- Se uma RPC falhar por um conflito de turno/defesa/dano, o DROME faz uma atualização **somente de leitura** e apresenta a situação corrigida. Não reenvia automaticamente a defesa, o dano, pagamentos ou compras de cartas.
- Mensagem da defesa corrigida: o atacante **precisa aplicar o dano antes de passar o turno**. A versão anterior dizia equivocadamente que poderia passar assim que o defensor respondesse.

## Testes de banco

`supabase/tests/chaotic-preview-3x3-action-interleavings-live-v0168.test.sql` foi executado **com PASS no projeto Supabase real**:
- Duas contas fictícias e três criaturas por equipe;
- Contato sem pagamento: turno não muda;
- Ataque projetado sem pagamento: turno não muda;
- Resposta do defensor somente uma vez;
- Aplicação do dano Vento Forte 105 somente uma vez, preservando HP;
- Três nocautes reais em turnos alternados, com resultado distinto para vencedor/perdedor e turno extra negado;
- Transação totalmente revertida (`BEGIN/ROLLBACK`), sem contas e cartas fictícias persistentes.

**Limitação importante:** os comandos foram enviados em uma transação de teste com intercalações adversariais **sequenciais**, não em conexões SQL realmente paralelas. A auditoria de `FOR UPDATE` sustenta a proteção esperada; uma prova de dois aparelhos enviando requisições ao mesmo milissegundo ainda requer um teste de carga concorrente com clientes independentes.

## Testes automatizados, PWA e publicação

`tests/turn-conflict-consistency-v0168.test.mjs` acrescenta cinco regressões para guardas da função SQL, fases, teste real, UI e alinhamento de versão/cache. O GitHub Actions valida a suíte Node e sintaxe JS. Consulte a execução da última revisão para a contagem final.

Versão visual `0.1.68`; referências de `sw.js`, `scanner.html`, `scanner-completo.html`, `full-game-bootstrap.js` e `chaotic-lobby.js` atualizadas para `release-68`. A publicação ocorre pelo workflow de sincronização do branch Pages após a aprovação de testes, com verificação HTTP posterior.

## Pendências de lançamento

- Homologar o fluxo ponta a ponta com **dois celulares reais**, redes distintas, reconexão no instante de defesa/dano e testes simultâneos de carga.
- Concluir mecânicas do **combate oficial**, Mugics, equipamentos e efeitos restantes.
- Rever individualmente permissões de funções `SECURITY DEFINER` acessíveis a usuários autenticados; revisar proteção de senha comprometida no Supabase Auth.
- Garantir feedback adequado para falha de rede sem confundir erro local com ação persistida no servidor.

**Progresso geral estimado mantido em 96% (margem ±10 p.p.)**, pois a segurança do treinamento avançou, mas a homologação física e o combate oficial seguem pendentes. O percentual não é medição objetiva de funcionalidade restante.
