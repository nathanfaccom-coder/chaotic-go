# Chaotic GO v0.1.89 — origem verificável do veneno e inspeção do Bracelete de Cristal

**31 de outubro de 2026** · Progresso estimado: **97%** (margem de incerteza ±10 pontos percentuais; não é homologação).

## Regra original preservada

O catálogo original em `cartas.js` define:
- **Armadilha de Víbora (106):** custo 3, dano-base 15 e envenenamento que retira **5 de energia a cada turno do oponente**. A descrição estabelece que **esse efeito não pode ser curado**.
- **Bracelete de cristal (206):** bônus de 5 em ataques de terra e **sacrifício do equipamento para curar envenenamento**.

As duas regras **não são intercambiáveis**. O bracelete só poderá curar origens de veneno marcadas como curáveis, quando existirem no combate. **O veneno específico de 106 é incurável, inclusive pelo 206.** Esta versão prepara essa distinção e não inventa uma cura que contradiga o texto da carta.

## Implementação realizada

- `supabase/chaotic-3x3-viper-106-uncurable-poison-provenance-v0189.sql`: nova tabela privada `chaotic_preview_3x3_poison_statuses`, associada a uma criatura e ao **evento real de dano de um ataque 106**. Exige FK para o HP de treinamento da criatura e para um recibo de dano; gatilho interno valida que o atacante gastou a carta 106, pagou seu custo, causou dano real e deixou o alvo vivo, mantendo o mesmo contato e a mesma instância original. Não aceita um número “106” inventado ou um ataque de outro turno. A tabela é **somente leitura para o próprio dono** (RLS), sem permissão de escrita para jogadores.
- A estrutura registra explicitamente `poison_kind=viper_uncurable`, `curable=false`, `crystal_206_cure_allowed=false`, dano periódico planejado de 5 e `poison_state=pending_turn_tick_integration`. **Nenhum tick de veneno é aplicado ainda**, e nenhuma habilidade foi ativada. A criação automática do status ao resolver o 106 ainda depende da implementação do próprio ataque 106 no 3x3.
- `supabase/chaotic-3x3-crystal-206-poison-eligibility-v0189.sql`: função autenticada `chaotic_inspect_preview_3x3_poison_crystal_206(uuid,integer)` **somente leitura**. Permite consultar **a própria criatura**, checa HP/instância, Deck original, equipamento 206 e propriedade única no álbum original, além de validar sua regra canônica. Informa status, impossibilidade de curar veneno 106 e que o dano periódico não está ligado. Nunca sacrifica a carta, cobra pontos ou altera HP.
- DROME `chaotic-lobby.js`: painel para selecionar uma criatura própria c4, c5 ou c6 e consultar veneno e Bracelete 206 **sem curar**. Informa explicitamente que o veneno de 106 é incurável e o dano periódico ainda não está ativo. A função não permite inspecionar criatura alheia.
- Arquivos do site, scanner e PWA sincronizados em **v0.1.89 / release-89**. Nenhum álbum, Deck, efeito oficial, imagem ou carta foi removido.

## Testes reais executados no Supabase (ROLLBACK)

`supabase/tests/chaotic-3x3-viper-106-crystal-206-source-safety-v0189.test.sql`

Com usuários fictícios e Bracelete de Cristal 206 genuíno, confirmou:
1. Inspeção válida da criatura própria: equipamento original reconhecido, nenhuma fonte de veneno presente, cura e tick desabilitados, HP e cartas intactos.
2. Tentativa administrativa de registrar veneno **sem um ataque 106 real** foi recusada pelas exigências de proveniência.
3. Um terceiro usuário foi impedido de inspecionar o equipamento ou estado da criatura alheia.
4. Slot fora de c4–c6 foi recusado.
5. Usuário autenticado não pode inserir envenenamento diretamente.
6. O teste inteiro foi revertido por **ROLLBACK**; nenhuma carta ou conta real foi alterada.

Também há testes de estrutura, privacidade, conservação de cartas e versão PWA em `tests/chaotic-3x3-viper-106-crystal-206-poison-source-v0189.test.mjs`.

## Limitações importantes

**A Armadilha de Víbora 106 ainda não envenena automaticamente durante o combate, nem aplica a perda de 5 por turno.** Essa versão é uma infraestrutura verificável, não a conclusão do efeito. A cura do 206 também não está ativa: ela requer uma fonte *curável* de veneno e uma transação completa de sacrifício da carta, ainda não implementadas. Em particular, **não deve curar o 106**.

Permanecem pendentes outros equipamentos ativos, Mugics, outras cartas, combate oficial, auditoria ampla e homologação de duas sessões reais no celular. **O progresso geral continua estimado em 97%.**
