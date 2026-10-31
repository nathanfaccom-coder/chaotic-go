# Chaotic GO v0.1.66 — reconexão durante ataque experimental 3x3

**Data:** 31/10/2026 (America/Sao_Paulo).

## Implementado no Supabase
Nova RPC `public.chaotic_get_preview_3x3_resume_status(p_lobby_id uuid)`, documentada em `supabase/chaotic-preview-3x3-resume-checkpoint-v0166.sql` e aplicada via migração `chaotic_preview_3x3_resume_checkpoint_v0166`.

É uma leitura **STABLE**, autenticada e com validação da participação dos dois jogadores, da sala ativa/encerrada e da consistência do anfitrião/convidado. Não executa ataque, compra, defesa ou alteração de HP. Retorna apenas a fase e o turno atuais, se é a vez do usuário, se ele precisa agir e, ao fim do treinamento, se venceu. **Não expõe IDs de cartas, mão, Deck, equipamento privado, dados de identidade do adversário ou quantidade de moedas.**

Fases possíveis: `ready`, `contact_open`, `awaiting_payment`, `awaiting_defender`, `awaiting_damage`, `awaiting_optional_reveal`, `awaiting_sonar_search`, `damage_settled`, `training_finished` e `session_closed`. A RPC é um diagnóstico, não autorização para agir: as validações reais permanecem nas funções de defesa, dano e troca de turno.

As permissões foram conferidas: `anon` **não** executa a RPC; `authenticated` pode chamar, mas um usuário autenticado de fora da sala recebe erro.

## DROME e Android
- O painel `lobby-3x3-recovery-state` exibe o checkpoint do ataque obtido no servidor durante a atualização periódica, manual ou no retorno do navegador.
- Quando falta resposta do defensor, a fase é exibida sem sugerir ao atacante outra aplicação de dano. Após resposta, mostra que o atacante deve aplicar o dano ainda pendente.
- Depois de um ataque resolvido, informa que **nenhum dano ou carta será repetido pela reconexão**.
- A aplicação mantém o cache único de versão v0.1.66 no `index.html`, `sw.js`, `scanner.html`, `scanner-completo.html` e carregamento atualizado do `chaotic-lobby.js`.
- Também foi removida a afirmação incorreta de que *dois jogadores estão conectados* quando existem somente dois participantes cadastrados. O diagnóstico de presença continua separado.
- Cartas, sprites, áudios, imagens originais, Decks, 1x1, 6x6 e recompensas oficiais não foram modificados nesta versão.

## Testes de integração reais no Supabase
`supabase/tests/chaotic-preview-3x3-resume-mid-attack-live-v0166.test.sql`: **PASS**. Duas contas sintéticas e seis criaturas divididas em equipes de três. Testados, dentro da mesma transação:
1. Sem ataque pendente, checkpoint `ready`; um usuário fora da sala é bloqueado.
2. Ataque declarado e não pago: `awaiting_payment`.
3. Pagamento concluído e defesa aberta: host vê `awaiting_defender` sem permissão de responder; convidado vê a mesma fase e a necessidade de responder, mesmo fora da sua vez.
4. Tentativa prematura de passar o turno rejeitada; o convidado responde pela função real `chaotic_pass_preview_3x3_defense`. Segunda resposta rejeitada.
5. Anfitrião recupera fase `awaiting_damage`, aplica dano pela RPC real do Vento Forte 105; segunda tentativa é bloqueada pelo antirreplay. O HP e o registro permanecem únicos.
6. Estado `awaiting_optional_reveal`; depois da escolha opcional, `damage_settled`. Avançam os turnos até terceiro nocaute verdadeiro, quando surge `training_finished` para os dois lados com resultado distinto.
7. Todo o teste é revertido por `ROLLBACK`, com zero contas/rooms/HP de teste persistidos.

A validação é da sequência de RPCs e do estado persistente em PostgreSQL, **não** prova que duas telas físicas em dispositivos distintos foram totalmente homologadas. O teste simula reconexão por consultas autenticadas repetidas, sem desligar fisicamente a rede.

## Testes automatizados
`tests/resume-mid-attack-v0166.test.mjs` adiciona cinco testes para permissão, fases, suíte SQL, interface e cache. A primeira suíte da versão registrou **158 testes de 158 aprovados**, incluindo verificação de sintaxe, após ajustar o teste de versão da v0.1.65 para não bloquear versões posteriores. A validação final do último commit deve ser consultada no GitHub Actions.

## Segurança ainda pendente
A auditoria Supabase registrou 7 tabelas com RLS e sem políticas diretas (privadas por grants) e **73 alertas** de funções SECURITY DEFINER disponíveis para contas autenticadas, incluindo a nova RPC; isso exige inspeção de autorização por função e não significa automaticamente vulnerabilidade explorável. Continua um alerta para proteção contra senhas vazadas, que depende de configuração do Auth. Nenhuma permissão oficial foi aberta a `anon`.

## Pendências para a versão seguinte
- Homologar dois celulares Android reais com contas diferentes, acionando perda e retorno da rede durante janela defensiva, dano e encerramento da sessão.
- Confirmar comportamento de interface no PWA instalado e alternância entre primeiro plano/segundo plano.
- Completar combate oficial e cartas, Mugics, habilidades, equipamento e efeitos ainda não suportados. Não substituir o treino experimental por vitória oficial.

**Progresso geral manual estimado: 95% (±10 pontos percentuais)**. Não equivale a garantia de entrega oficial, pois ainda há mecânicas e homologações relevantes pendentes.
