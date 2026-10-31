# Chaotic GO v0.1.79 — Mão Negra (102): roubo experimental após reação defensiva

**Data:** 31/10/2026. **Status:** implementação no código e no Supabase real; aguarda homologação com duas sessões móveis simultâneas. A porcentagem global continua manualmente em **97% (±10 p.p.)**.

## Implementação

O ataque original **Mão Negra (102)** custa **0** e causa **0 de dano**, com efeito de retirar **uma carta de Ataque aleatória da mão do adversário**. Nenhuma carta muda de dono em seu álbum ou Deck original.

- **Pagamento especial:** `chaotic_pay_preview_3x3_black_hand(uuid,integer)` verifica participação real, turno atual, sala 3x3 pronta, projeção original `102`, custo zero, mão preparada e carta original na própria mão. Reusa os controles de custo, guarda a carta 102 como gasta **somente no treinamento** e não executa o roubo ainda. O pagamento é negado se o adversário não tem carta, o atacante não tem espaço, o ataque já foi pago ou existem confrontos conflitantes.
- **Reação defensiva:** após pagar, o atacante abre a janela 3x3 existente; o defensor passa pela RPC de prioridade existente. O servidor **não permite roubar antes do passe**.
- **Resolução única:** `chaotic_resolve_preview_3x3_black_hand(uuid,integer)` confere a janela `defender_passed_preview` e o pagamento único. Só então chama a rotina interna restrita que escolhe **aleatoriamente** a carta do defensor, confere o álbum/catálogo originais, guarda a custódia, e marca o ataque como concluído. Tudo é uma transação atômica; um erro impede o roubo parcial. O ID da instância original não passa ao tomador; a vista privada mostra dados da carta do catálogo.
- **Passagem de turno:** após o passe defensivo e a resolução de custo/dano zero, o atacante consegue passar o turno normalmente. Se a resolução ainda estiver pendente, o bloqueio existente continua valendo.
- **Proteção de mão cheia:** `chaotic-preview-3x3-effective-hand-cap-v0179.sql` acrescenta gatilhos a entradas na mão e custódias `held`. Até cinco cartas no total entre cartas próprias na mão e cartas emprestadas. O limite é aplicado também quando outra mecânica tenta comprar uma carta, não apenas na compra comum do turno.
- **DROME:** botões próprios para pagar 102 e para confirmar o efeito só depois de o defensor passar; a mão privada mostra as cartas temporárias recebidas e não as mistura com o Deck original.

## Testes realizados

- **SQL real no Supabase:** `supabase/tests/chaotic-preview-3x3-black-hand-atomic-live-v0179.test.sql`, com usuários/partida sintéticos e **ROLLBACK**. Conferiu pagamento 0/0, rejeição antes da reação, passe defensivo, empréstimo da carta original **Vento Forte (105)**, controle de dono e custódia, bloqueio de replay, passagem do turno depois da resolução e bloqueio de uma sexta carta ao contar a emprestada.
- **Regressões Node:** `tests/black-hand-payment-and-borrow-v0179.test.mjs`; mantém as suites anteriores e estende seus testes de compatibilidade.
- **Nenhuma vitória oficial, XP, moedas, HP oficial ou inventário permanente foram alterados** nos testes.

## O que AINDA falta

**O roubo 102 já tem uma resolução experimental; usar posteriormente a carta roubada como ataque ainda está DESABILITADO.** Essa próxima integração exige custo da carta emprestada, habilidades/efeitos de ataque, defesa, consumo de custódia, antirreplay e devolução segura. Não confundir roubo experimental com a Mão Negra plenamente pronta no PvP oficial.

As versões v0.1.76 e v0.1.78 mantêm, respectivamente, a devolução no resultado terminal e a recuperação de cartas emprestadas ao reconectar a uma sala expirada; ambas ainda precisam de testes reais de rede com dois celulares.

Faltam ainda Aliança (103), Armadilha de Víbora (106), equipamentos e Mugics incompletos, regras de combate oficial, revisão de permissões do servidor e homologação em dois dispositivos.

**Catálogo, imagens, álbuns, Decks, 1x1 e 6x6 originais preservados.** Versionar não significa homologar o jogo.
