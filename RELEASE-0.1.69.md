# Chaotic GO v0.1.69 — não gastar cartas sem resolução de dano e cancelar contato não pago

**Data de desenvolvimento:** 31/10/2026. **Escopo:** treinamento 3x3; sem modificar imagens, Decks originais, álbum, 1x1, 6x6 ou recompensas oficiais.

## Problema real encontrado

O catálogo original tem 15 ataques (IDs `101` a `115`). A projeção experimental permite consultar todos, mas somente oito IDs têm uma rotina de dano 3x3 implementada na interface: `101`, `105`, `107`, `110`, `111`, `112`, `113` e `114`.

Até v0.1.68, `chaotic_spend_preview_3x3_attack` permitia pagar por um ataque original sem resolvedor, como o **104 (Fogo Primordial 2.0)**, que precisa de dado. Isso consumia pontos e marcava carta usada **somente no treinamento**, mas sem função para concluir o dano, enquanto a passagem de turno corretamente proíbe dano pendente. Resultado: risco de **travamento lógico da partida de treino**.

## Alterações reais no Supabase

1. `supabase/chaotic-preview-3x3-spend-capability-v0169.sql`: atualiza `chaotic_spend_preview_3x3_attack(uuid,integer)`. Somente os oito ataques experimentais com resolvedor citado podem ser pagos. **Todos os quinze continuam consultáveis para projeção de dano-base**, mas os demais não podem debitar a carteira ou gastar a carta.
2. `supabase/chaotic-preview-3x3-unpaid-cancel-v0169.sql`: nova RPC `chaotic_cancel_preview_3x3_unpaid_contact(uuid,integer)`. Apenas o atacante autenticado, com sala pronta, turno ativo e contato sob seu controle, pode cancelar a preparação ainda **não paga**. O servidor bloqueia cancelamento após gasto, defesa, dano ou Clash/Burst; bloqueia terceiros.
3. Cancelar elimina a preparação de contato e, por integridade referencial, a projeção e inspeção de custo vinculadas. Não manipula moedas, pontos, carta gasta, dano, HP, Decks ou recompensas. **Campeões já revelados ao iniciar contato permanecem revelados** — informação pública não pode ser desfeita para recuperar o elemento surpresa.
4. As duas RPCs mantêm `FOR UPDATE` sobre a linha da partida. A nova função concede `EXECUTE` apenas a `authenticated` e usa `auth.uid()`, conferência do membro, sala, turno, status e ausência de efeitos pagos.

## Interface do DROME

- `chaotic-lobby.js` distingue ataques somente projetáveis daqueles com dano experimental. O botão **Gastar pontos e usar carta SÓ no treino** fica oculto para cartas sem resolvedor; tentar pagar por interface desatualizada também é bloqueado antes da RPC.
- Novo botão **Cancelar contato ou ataque ainda não pago**. Disponível para atacante somente antes do gasto; consulta a fase atual via RPC de checkpoint e invoca a nova função. Recarrega o estado do servidor, sem repetir outras ações.
- Novo aviso explica a limitação do ataque não suportado e preserva clareza sobre campeões já revelados.

## Teste real

`supabase/tests/chaotic-preview-3x3-unpaid-cancel-live-v0169.test.sql` passou no Supabase real, dentro de `BEGIN / ROLLBACK` com contas/salas fictícias:
- abertura e cancelamento de contato ainda sem carta; turno preservado;
- projeção original de Fogo Primordial 2.0 (104); tentativa de pagamento **rejeitada** e nenhum ponto debitado;
- adversário tenta cancelar o contato do atacante e é bloqueado;
- cancelamento autorizado remove projeção não paga, sem apagar recursos da mão/HP;
- novo contato permite executar a sequência do ataque original Vento Forte (105);
- tentativa de cancelar depois do pagamento é bloqueada;
- três nocautes reais de treino com proteção antirreplay e resultado correto para anfitrião e convidado.

**Limitação de validação:** as ações são intercaladas em uma transação, e não enviadas de dois sockets independentes ao mesmo milissegundo. Não afirmar homologação física de dois aparelhos.

## Automação e publicação

`tests/unsupported-attacks-and-cancel-v0169.test.mjs`: cinco verificações de segurança, compatibilidade, interface e cache. A suíte Node completa passou com **176/176** e sintaxe JS validada na execução `41190354625` antes da criação deste relatório. Os testes antigos de Vento Forte agora usam a referência original com custo 1; não dependem mais de pagar indevidamente por 104.

Atualizado o identificador visível e PWA para **v0.1.69** em `index.html`, `sw.js`, `scanner.html`, `scanner-completo.html` e `full-game-bootstrap.js` (carrega `chaotic-lobby.js?v=release-69`). O workflow publica apenas após sucesso no CI e verifica a versão HTTP real.

## Auditoria e pendências

- Conferido no Supabase: as novas ações de cancelamento e pagamento não estão abertas para `anon`; zero contas fictícias e resultados artificiais permaneceram.
- Advisories atuais: **74** funções `SECURITY DEFINER` acessíveis a usuários autenticados merecem revisão individual, além de **7** tabelas com RLS sem política explícita e **1** alerta sobre proteção contra senhas comprometidas.
- Ataques não suportados continuam sem resolutor 3x3. A proteção evita **novos pagamentos incompatíveis**, não corrige automaticamente um ataque pago **antes** desta atualização. Para partidas antigas afetadas, pode ser necessário encerrar e criar uma nova sala.
- Falta implementar rolagem do Fogo Primordial 2.0 e demais efeitos de todos os ataques, equipamentos e Mugics, combate oficial, testes independentes de concorrência real e homologação do PWA com dois celulares físicos.

**Progresso global manual mantido em 96% (incerteza ±10 pontos percentuais)**, sem afirmar que o combate oficial está concluído.
