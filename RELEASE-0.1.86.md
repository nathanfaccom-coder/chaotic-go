# Chaotic GO v0.1.86 — neutralidade e equipamento original no Vento Forte emprestado

**Data:** 31/10/2026. **Progresso estimado:** 97% (incerteza ±10 p.p.; não é homologação). **Escopo:** treino 3x3 experimental, mantendo o inventário e o PvP oficial intactos.

## Entregue

O Vento Forte (105) temporariamente emprestado pela Mão Negra (102) já possui pagamento e dano-base atômicos, nocautes de criatura e de equipe, devolução de todas as cartas temporárias na vitória e revelação opcional ou dispensa (versões anteriores).

A v0.1.86 integra uma **subcategoria estrita de equipamento defensivo original**. O catálogo `cartas.js` e a tabela autorizada `chaotic_preview_card_reference` registram o Vento Forte com **custo 1, dano-base neutro 5 e ZERO dano elemental de ar, fogo, água ou terra**. O nome da carta não a transforma automaticamente em um ataque de ar. Assim:

- **202, Amuleto do Vácuo:** bloqueia dano que envolve ar, mas o Vento Forte 105 original é neutro. A imunidade do equipamento permanece respeitada e **não é acionada** por esse ataque não elemental.
- **204, Bastão da Sabedoria:** eleva o atributo Sabedoria em 40, mas o dano-base fixo de Vento Forte não depende da Sabedoria. Por isso, o dano-base permanece 5.
- Todos os **demais equipamentos (201, 203, 205, 206, 207)** permanecem recusados antes de pagar, até que interações de escudos, descarte de equipamentos, gatilhos de morte, curas ou modificadores sejam integradas sem pular ações defensivas.

## Implementação e privacidade

- `supabase/chaotic-borrowed-105-neutral-equipment-audit-v0186.sql`: tabela `chaotic_preview_3x3_borrowed_105_equipment_audits` com RLS, somente o defensor lê seus resultados; navegador não insere, modifica ou exclui. Registra o ID de instância, ID do catálogo, regra identificada e verificações de autenticidade. O equipamento não é tornado público nem descartado.
- `supabase/chaotic-borrowed-105-202-204-neutral-equipment-settlement-v0186.sql`: a função transacional `chaotic_settle_preview_3x3_borrowed_105_base` confere equipamento colocado no Deck original da criatura, busca sua instância de propriedade única no álbum original e valida seu nome e regra no catálogo do servidor. Confirma no catálogo oficial que o ataque 105 ainda tem quatro danos elementais iguais a zero. **Só 202 ou 204 passam**. O recibo privado é registrado antes da cobrança, dentro da mesma transação. Qualquer problema cancela automaticamente débito, HP, nocaute e custódia.
- A continuação de prioridade defensiva, custo 1, dano neutro 5, nocaute de treinamento, devolução original e revelação opcional continua usando as mesmas rotinas anteriores.
- DROME: esclarece que o Vento Forte emprestado pode ser resolvido sem equipamento ou com **202/204 autenticamente verificados**, sem divulgar à pessoa que ataca o identificador privado do equipamento do defensor.
- `index.html`, `sw.js`, ambos scanners e `full-game-bootstrap.js` sincronizados na versão 0.1.86.

## Testes no Supabase (usuários sintéticos, ROLLBACK)

- `supabase/tests/chaotic-borrowed-105-vacuum-202-live-v0186.test.sql`: com Amuleto autêntico, custo 4→3, HP 20→15, carta devolvida, antirreplay, dispensa de revelação, próximo turno e RLS da auditoria (apenas o defensor). **PASS**.
- `supabase/tests/chaotic-borrowed-105-wisdom-204-live-v0186.test.sql`: mesmas verificações com Bastão da Sabedoria, sem incremento ilegítimo de dano. **PASS**.
- `supabase/tests/chaotic-borrowed-105-ring-201-refusal-v0186.test.sql`: Anel Precioso não resolvido, sem cobrar, dano ou perda da carta. **PASS**.
- `supabase/tests/chaotic-borrowed-105-bomb-205-refusal-v0186.test.sql`: Bomba de Fogo, com gatilho de morte não implementado, permanece bloqueada. **PASS**.
- `supabase/tests/chaotic-borrowed-105-forged-202-refusal-v0186.test.sql`: equipamento de identidade não reconhecida no catálogo não pode ser declarado como Amuleto válido. **PASS**.
- Regressões executadas e aprovadas: v0.1.82 dano e recusa contra equipamento sem suporte, v0.1.83 nocaute individual, v0.1.84 vitória final com devolução, v0.1.85 revelação opcional.
- Suíte Node: `tests/black-hand-borrowed-105-neutral-equipment-v0186.test.mjs`, além de todos os testes existentes. Resultado final a confirmar no workflow após o relatório.

## Pendências

Essa atualização **não** cobre o uso do equipamento 201 com custo energético, a ativação/descarte da Arpa 203, efeitos de morte da Bomba 205 nem as ações especiais dos Braceletes 206/207. Outros ataques, Mugics, habilidades, efeitos de imunidade e interações de elementos também demandam integração específica. O modo é **treinamento**, não combate oficial. Permanecem pendentes auditoria completa de segurança e homologação simultânea com dois dispositivos reais.

**Álbuns, cartas, imagens, Decks e mecânicas originais dos modos 1x1 e 6x6 foram preservados.**
