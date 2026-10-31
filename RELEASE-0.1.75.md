# Chaotic GO v0.1.75 — Mão Negra (102): empréstimo atômico interno e devolução

**Data:** 31/10/2026. **Escopo:** infraestrutura experimental de combate 3x3. **Importante:** a Mão Negra ainda não é jogável no cliente e continua bloqueada para pagamento; foram implementadas e testadas funções internas para uso em uma futura resolução completa.

## Entrega real no Supabase

`supabase/chaotic-preview-3x3-black-hand-atomic-custody-v0175.sql` adiciona o estado `loaned` à mão **apenas de treinamento**. O estado impede a carta de aparecer simultaneamente como `hand`, `deck` ou `spent` e a exclui das rotinas normais de compra e reciclagem enquanto está emprestada. A identidade do dono (`actor_id`), a instância original, o slot e o Deck não são modificados.

A função interna `chaotic_internal_hold_preview_3x3_black_hand(uuid,integer)`:
- confere identidade autenticada, anfitrião/convidado, sala, vez e turno, contato original e a projeção **102**, custo zero;
- exige um **registro interno de gasto simulado no teste** da carta 102, porque o pagamento real continua desabilitado;
- valida mãos privadas preparadas, limite de cinco cartas e ausência de empréstimo anterior no turno;
- escolhe uma carta aleatória que realmente está na mão do adversário e confere sua instância no **álbum do dono**, mapeando o nome ao catálogo de ataques original;
- atualiza somente a carta temporária do dono para `loaned` e registra a custódia como `held`, dentro de uma única transação. Se algo falhar, nenhuma alteração persiste.

A função interna `chaotic_internal_release_preview_3x3_black_hand(uuid,uuid,integer)` confere a identidade, o mesmo registro de custódia, a instância e o estado `loaned`; devolve a carta ao **monte do dono**, com prioridade de embaralhamento renovada, e marca a custódia como `released`. Uma devolução repetida é rejeitada.

`supabase/chaotic-preview-3x3-black-hand-loan-once-v0175.sql` reforça o antirreplay: existe no máximo um empréstimo por tomador, sala e turno; mesmo depois de devolver a carta, a 102 não pode roubar novamente no mesmo turno.

**Segurança:** as duas funções têm `EXECUTE` revogado para `PUBLIC`, `anon` e `authenticated`. Elas **não são endpoints usáveis pelo navegador**. Só fazem parte da infraestrutura interna que uma futura função de ataque completa poderá utilizar. A tabela de posse continua com RLS, somente consulta privada às duas partes e nenhuma permissão de escrita aos clientes.

## Teste real, não apenas simulação de texto

`supabase/tests/chaotic-preview-3x3-black-hand-loan-live-v0175.test.sql` passou no Supabase de produção usando uma **transação de teste revertida**, com duas contas e sala fictícias. Como o gasto real da 102 está bloqueado, o teste insere **apenas dentro da transação** um registro sintético de pagamento zero para alcançar a rotina interna.

Verificou:
- O defensor não pode iniciar o empréstimo no lugar do atacante;
- O servidor seleciona a carta original **Vento Forte (105)** que estava na mão do defensor e verifica seu álbum;
- A carta fica no estado `loaned` e o livro de posse aponta para o atacante, sem trocar a propriedade ou duplicar linhas na mão;
- Roubar outra vez antes da devolução é rejeitado;
- O dono recupera a carta no próprio monte;
- Devolver duas vezes ou roubar novamente **depois da devolução** no mesmo turno é rejeitado;
- Chamadas diretas das funções internas pela função de cliente `authenticated` são recusadas;
- `ROLLBACK` cancela contas, cartas, sala, pagamentos e custódia fictícios, sem persistência.

Não foi realizado um teste físico com dois celulares nem chamadas realmente simultâneas independentes. A função de sorteio usa aleatoriedade casual do PostgreSQL, não criptográfica.

## Interface, compatibilidade e testes

A interface `chaotic-lobby.js` mostra separadamente a contagem de cartas originais temporariamente emprestadas, quando existirem, evitando interpretá-las como descarte ou perda. A verificação privada da Mão Negra introduzida na v0.1.74 continua disponível **sem gastar nem roubar carta**. A carta 102 segue ausente da lista de ataques pagáveis e dos ataques resolvíveis no DROME.

A suíte `tests/black-hand-loan-v0175.test.mjs` acrescentou cinco testes sobre integridade do dono, permissão, bloqueio de repetição, retorno, arquivo SQL real e alinhamento de cache. Testes anteriores dos ataques 101, 104, 105, 107, 108, 109, 110–115 e Decks continuam. A última suíte antes da alteração no texto de exibição da mão passou com **209/209**, sem erro de sintaxe, no workflow **41198621470**; verificar a execução mais recente para o commit final.

Cache e versão **0.1.75** foram atualizados em `index.html`, `sw.js`, `full-game-bootstrap.js`, `scanner.html` e `scanner-completo.html`. Cartas, artes, imagens, álbuns, Decks e progressão oficiais não foram apagados ou migrados.

## O que ainda precisa ser integrado para a Mão Negra funcionar

1. Ligar o fluxo **real de pagamento 102** ao sorteio interno, sem permitir carta gasta sem resolução;
2. Expor de forma privada a carta emprestada ao tomador, sem divulgar outras cartas do adversário;
3. Modificar projeção, inspeção de custo e gasto para aceitar, **sem falsificar propriedade**, a carta temporária como ataque permitido ao tomador;
4. Registrar seu uso uma única vez, garantir limite de mão, concluir efeitos de cada carta roubada e devolver corretamente na sessão;
5. Proteger término de sessão, cancelamento, reconexão, partidas concorrentes e o estado `loaned` sob falhas e rollback;
6. Só depois habilitar o botão de roubo da 102 e os testes físicos em dois Androids.

Outras pendências: Aliança (103), Armadilha de Víbora (106), equipamentos, Mugics, PvP oficial, revisão granular de funções privilegiadas.

**Progresso geral estimado: permanece em 97%, com incerteza ±10 pontos percentuais.** Não representa jogo homologado para publicação oficial.
