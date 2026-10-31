# Chaotic GO — v0.1.87: Bracelete de Água (207) contra Vento Forte emprestado

**Data de trabalho:** 31/10/2026. **Progresso global estimado:** 97% (±10 pontos percentuais, não homologação).

## Implementação

O Vento Forte (105) original, mesmo com esse nome, possui **dano-base 5 neutro** e quatro danos elementais iguais a zero no catálogo do servidor. O equipamento **Bracelete de Água (207)** aumenta em 5 o dano de **ataques que envolvem o elemento água**, sem conceder o elemento água. Quando está no **defensor**, não acrescenta dano ao ataque neutro do adversário nem o torna imune a esse ataque.

- `supabase/chaotic-borrowed-105-neutral-bracelet-207-audit-v0187.sql`: estende, com checagens de consistência, a tabela privada de auditoria dos equipamentos para aceitar somente as combinações verificadas de ID e regra **202, 204 e 207**. RLS continua permitindo leitura **somente ao dono defensor** e proíbe escrita direta dos clientes.
- `supabase/chaotic-borrowed-105-neutral-bracelet-207-settlement-v0187.sql`: estende a rotina transacional de ataque emprestado para autorizar o **207 autêntico**, se estiver colocado na criatura defensora e registrado com uma única instância no álbum original, com nome e regra correspondentes no catálogo `chaotic_preview_3x3_equipment_catalog`. A autorização ainda exige o ataque original `105`, custo 1, dano-base 5 e **nenhum dano elemental**, sem efeitos adicionais. O pagamento, dano-base, eventuais nocautes, vitória somente no treino e devolução da carta original continuam na transação existente.
- A interface DROME informa que o Vento Forte emprestado pode resolver dano contra defensor sem equipamento ou com **202/204/207 verificados**. A auditoria do equipamento não é divulgada ao atacante.
- Os demais equipamentos, particularmente **201 (Anel Precioso), 203 (Arpa Mágica), 205 (Bomba de Fogo) e 206 (Bracelete de Cristal)**, seguem bloqueados no caminho emprestado enquanto seus custos energéticos, descarte, habilidades de cura e gatilhos ainda exigirem regras adicionais.

## Testes SQL reais no Supabase, sempre com ROLLBACK

- `supabase/tests/chaotic-borrowed-105-water-207-live-v0187.test.sql`: equipamento autêntico 207 no defensor; dano 5 neutro (HP 20→15); custo 1 (pontos 4→3); devolução íntegra da carta emprestada; antirreplay; dispensa da revelação opcional; próximo turno; e auditoria privada com RLS que exclui atacante e estranhos. **PASS**.
- `supabase/tests/chaotic-borrowed-105-earth-206-refusal-v0187.test.sql`: equipamento 206 com cura opcional ainda não integrada; pagamento, HP, custódia e auditoria inalterados. **PASS**.
- `supabase/tests/chaotic-borrowed-105-forged-water-207-refusal-v0187.test.sql`: recusa uma suposta instância 207 cujo nome não corresponde ao catálogo, sem cobrar ou retirar qualquer carta. **PASS**.
- Testes existentes da v0.1.86 seguem cobrindo o 202, o 204 e as recusas 201/205. Node: `tests/black-hand-borrowed-105-water-bracelet-v0187.test.mjs` testa estrutura, catálogo, ações, privacidade, recusas e versão.

Os usuários sintéticos de teste e os eventos foram revertidos por transações `ROLLBACK`. Nenhuma alteração permanente foi aplicada em cartas de jogadores reais.

## Limitações restantes

Ainda não concluímos as respostas defensivas de equipamentos 201/203/205/206, atividades com Mugics, condições ofensivas e efeitos de outras cartas como 103/106, nem auditoria geral das funções privilegiadas. **O modo é exclusivamente treinamento 3x3**, sem premiação oficial. Testes com duas pessoas em celulares reais continuam necessários.

**Progresso estimado mantido em 97%.** Nenhuma carta, imagem, álbum, Deck, mecânica 1x1 ou 6x6 original foi removida.
