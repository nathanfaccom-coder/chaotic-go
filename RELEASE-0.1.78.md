# Chaotic GO v0.1.78 — recuperação de empréstimos após expiração da sala

**Data:** 31/10/2026. **Escopo:** evitar que cartas emprestadas temporariamente no treino 3x3 fiquem presas quando a sala expire ou seja cancelada sem registrar um resultado de treinamento. Nenhum Deck, álbum, imagem, carta original, XP, moeda, HP oficial, combate 1x1/6x6 ou PvP oficial é alterado.

## O que foi implementado

- **Servidor:** `supabase/chaotic-preview-3x3-expired-loan-recovery-v0178.sql` cria a RPC `chaotic_restore_expired_preview_3x3_loans(uuid)`. Apenas jogadores autenticados que constem como host/convidado originais podem acioná-la; o servidor confere vínculo sala/partida e aceita somente treino **3x3 encerrado, cancelado ou com prazo vencido**. Uma partida 3x3 que continua ativa e não expirou é explicitamente bloqueada.
- A operação bloqueia a partida e cada custódia original, confere propriedade e instância no registro do dono e devolve somente custódias `held` como carta `deck` **ao mesmo dono original**, em transação única. Marca `released` com turno final (1–120) e falha integralmente se encontrar estado inconsistente, sem concluir uma devolução parcial.
- A resposta é resumida e não contém ID de instância privada, carta do álbum ou mão do adversário. Repetir após a primeira devolução não devolve uma segunda vez. Estados intermediários `reserved`/`used` ficam bloqueados até existir uma recuperação específica.
- **DROME no celular:** `chaotic-lobby.js` detecta sala 3x3 expirada/cancelada durante atualização ou retomada da sessão, consulta a RPC **antes de esquecer a última sala** e informa quantas cartas temporárias foram restauradas. O identificador salvo localmente não autoriza acesso; o servidor verifica a participação. Quando o aparelho nunca volta a abrir o jogo, ou não há conexão, não existe execução automática por cron.
- Arquivos de versão do site e PWA sincronizados em `v0.1.78`.

## Validação e limitações

- Checagem direta de permissões do banco: `anon` não pode executar a RPC, `authenticated` pode apenas após validações dentro da própria função.
- `supabase/tests/chaotic-preview-3x3-expired-loan-auth-v0178.test.sql` valida rejeição de chamada sem autenticação.
- `tests/black-hand-expired-recovery-v0178.test.mjs` cobre guardas de servidor, integridade do dono, falha segura, reconexão e preservação da restrição da Mão Negra.
- **A execução de ponta a ponta com custódia ativa seguida de expiração não foi homologada em duas sessões/celulares reais.** A verificação de permissões e testes estáticos não equivale a testes de concorrência, nem garante que todos os possíveis casos de queda de conexão estejam cobertos.
- A recuperação ocorre quando um participante volta ao jogo ou atualiza sua sala; não é um trabalho em segundo plano. A devolução no resultado normal do treino da v0.1.76 continua preservada.

**Mão Negra (102) permanece NÃO jogável** até a cadeia atômica de pagamento, empréstimo, uso, resolução de efeitos e devolução de custódia ser concluída. Permanecem também Aliança (103), Armadilha de Víbora (106), revisão de equipamentos/Mugics, segurança das RPCs privilegiadas e testes em dois celulares.

**Progresso geral mantido em 97% (estimativa manual ±10 p.p.).** Versão publicada não significa jogo pronto.
