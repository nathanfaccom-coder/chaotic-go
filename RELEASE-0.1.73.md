# Chaotic GO v0.1.73 — TORNADO (109) e base segura da Mão Negra (102)

**Data de desenvolvimento:** 31/10/2026. **Escopo:** treinamento experimental 3x3; preservar cartas originais, álbuns, imagens, Decks, 1x1, 6x6, moedas, XP e combate oficial.

## 1. TORNADO 109: efeito implementado

Regra conferida no catálogo original: **TORNADO**, ID **109**, custo **0**, dano **0**. Só funciona se o campeão atacante tiver **elemento Ar**. O adversário embaralha as cartas de sua mão junto com seu próprio monte e depois compra **duas cartas**.

Arquivo: `supabase/chaotic-preview-3x3-tornado-109-v0173.sql`.

- Função `chaotic_apply_preview_3x3_training_tornado_109(uuid,integer)` autentica e valida sala, vez do atacante, gasto, janela de defesa, equipamentos, HP inalterado, referência da carta e elementos naturais da criatura.
- O servidor, sob `FOR UPDATE` na partida, embaralha o monte **do defensor**, devolvendo as cartas da mão àquele monte. As cartas mantêm **actor_id**, **attack_instance_id** e posições originais no Deck. São compradas até duas cartas, para a **mesma pessoa**, sem revelar nomes/IDs de cartas ao atacante.
- O evento compartilhado persiste somente `tornado_shuffled_count` (0–5) e `tornado_drawn_count` (0–2), sem mostrar qual carta foi comprada.
- A resolução acontece uma única vez. O dano é 0 e o HP não é alterado. Nenhum recurso ou Deck oficial é modificado.
- `supabase/chaotic-preview-3x3-spend-tornado-v0173.sql` permite pagar 109 **somente** se o atacante possui Ar natural no catálogo original e o oponente já preparou uma mão de treino. O servidor verifica ambas as condições **antes** de gastar até mesmo a carta de custo zero. Caso contrário, o jogador pode cancelar o contato ainda não pago usando a função segura existente.
- A função só permite execução por conta autenticada com a vez válida; `anon` não pode executar.

### Teste de banco

`supabase/tests/chaotic-preview-3x3-tornado-109-live-v0173.test.sql` executado **com PASS no Supabase real**. Num cenário de duas identidades fictícias:
1. Campeão sem Ar tenta pagar TORNADO: operação negada e carta permanece na mão;
2. Campeão com Ar validado no catálogo pode pagar a carta original;
3. Após a janela de defesa, a carta embaralha **uma carta** que estava na mão inimiga com o monte particular e compra **duas**, preservando propriedade, 0 dano e 0 gasto;
4. Uma segunda tentativa é negada, sem outro embaralhamento ou nova compra;
5. A sequência anterior dos três nocautes por Fogo Primordial e Vento Forte continua funcionando, com resultado final correto.

A validação usou transação `BEGIN / ROLLBACK`. **Não** representa dois dispositivos reais enviando requisições simultâneas. Os dados fictícios foram descartados.

### Interface

O `chaotic-lobby.js` oferece resolução do ataque 109 pelo DROME, explica a exigência de Ar natural, chama a função exclusiva do servidor e apresenta o número de cartas embaralhadas e compradas. Nomes e IDs da mão adversária não são exibidos. O histórico também recupera essas contagens após reconexão.

A versão e o cache Android/PWA foram alinhados para **0.1.73** em `index.html`, `sw.js`, `scanner.html`, `scanner-completo.html` e `full-game-bootstrap.js`.

## 2. Mão Negra 102: fundação de custódia, ataque NÃO liberado

A regra original da **Mão Negra (102)** é pegar uma carta aleatória da mão adversária para uso pelo atacante. Diferentemente do SOPRO, não basta descartá-la: o destinatário precisa **poder jogar** a carta transferida. O código atual valida a carta contra **o Deck e o álbum do próprio atacante**, de modo que uma transferência direta de `actor_id` seria incorreta e insegura.

A migração `chaotic_preview_3x3_temporary_custody_foundation_v0173` criou a estrutura `public.chaotic_preview_3x3_temporary_card_custody`, registrada em `supabase/chaotic-preview-3x3-temporary-card-custody-v0173.sql`. Ela mantém separados:
- Dono original (`source_actor_id`), destinatário (`borrower_id`), slot de origem, instância original, ataque do catálogo e turno;
- Estado de posse temporária (`reserved`, `held`, `used`, `released`) e verificação `training_only=true`;
- Restrição de impossibilidade de emprestar simultaneamente a mesma instância de origem.

A tabela tem **RLS habilitada**: somente dono e destinatário autenticados, ambos da mesma partida, podem consultar as próprias linhas. Clientes não possuem privilégios de INSERT, UPDATE ou DELETE; não podem forjar roubos.

**Importante: a Mão Negra ainda não é executável ou pagável.** Não foi criado um roubo fictício nem alterada a mão real do adversário. Na próxima etapa, será necessário integrar a custódia privada à projeção de ataque, às verificações de custo, à sincronização da mão, ao uso da carta emprestada e à devolução no fim da partida. Só depois a carta 102 poderá ser habilitada.

`supabase/tests/chaotic-preview-3x3-custody-foundation-live-v0173.test.sql` passou no Supabase real: dono e destinatário autorizados enxergaram a entrada fictícia; terceiro usuário não enxergou; tentativa de escrever via conta autenticada foi negada; a transação foi revertida.

## 3. Validação, segurança e pendências

- `tests/tornado-109-v0173.test.mjs`: cinco testes para regra de Ar, compra privada, antirreplay, integração SQL e cache PWA.
- `tests/black-hand-custody-foundation-v0173.test.mjs`: três testes para custódia privada, RLS e proibição de liberar a Mão Negra prematuramente.
- Os testes de versões anteriores continuam, incluindo SPEED, SOPRO, Fogo Primordial, Decks e 3x3. Consulte o GitHub Actions do último commit para a contagem final.
- Auditoria do Supabase: a nova função de TORNADO não está disponível para `anon`; há **78** alertas `SECURITY DEFINER` executáveis por `authenticated` requerendo revisão caso a caso, **7** avisos de tabelas com RLS sem políticas diretas e alerta de proteção contra senhas comprometidas. Não são, isoladamente, prova de exploração.
- Restam **Mão Negra (102)**, **Aliança (103)** e **Armadilha de Víbora (106)** sem resolução experimental completa, além de equipamentos, Mugics, regras oficiais e testes independentes simultâneos.
- Nenhuma homologação em **dois celulares físicos** foi feita. O app permanece em treinamento experimental para as regras aqui relatadas.

**Progresso global estimado mantido em 97% (±10 pontos percentuais)**. Estimativa manual; o jogo **não** está homologado para lançamento.
