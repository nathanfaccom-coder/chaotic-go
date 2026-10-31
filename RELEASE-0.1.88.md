# Chaotic GO — v0.1.88: Bracelete de Cristal (206) na defesa neutra do treino 3x3

**Data:** 31 de outubro de 2026. **Progresso global estimado:** 97% (incerteza ±10 pontos percentuais, não homologação).

## Entrega

O Vento Forte (105) temporariamente emprestado pela Mão Negra (102) já podia pagar 1 ponto, aplicar até 5 HP de dano-base neutro, causar nocaute e encerrar o treinamento 3x3 devolvendo todas as cartas temporárias, além de revelar opcionalmente um alvo após o acerto. As versões 0.1.86–0.1.87 acrescentaram reconhecimento de equipamentos originais **202, 204 e 207** no defensor.

Nesta versão, estendi **apenas a verificação defensiva passiva** ao **Bracelete de Cristal (206)**, quando autêntico e colocado na criatura defensora que recebe o Vento Forte emprestado. O bracelete pode aumentar dano de terra em ataques próprios e curar veneno por habilidade; **nenhuma dessas ações é aplicada a um ataque neutro do adversário**. Vento Forte 105 mantém dano-base **5**, custo **1** e zero dano de fogo, água, terra e ar segundo o catálogo do servidor. **Não foi criado nem presumido um status de veneno**.

### Código e segurança

- `supabase/chaotic-borrowed-105-crystal-206-audit-v0188.sql`: acrescenta o ID **206**, com a regra canônica `increase_earth_damage_5_cure_poison`, à lista fechada de combinações 202/204/206/207 da tabela privada `chaotic_preview_3x3_borrowed_105_equipment_audits`. A RLS original continua permitindo consulta somente ao **dono defensor** e proibindo escritas pelo navegador.
- `supabase/chaotic-borrowed-105-crystal-206-passive-defense-v0188.sql`: valida o equipamento colocado no Deck original do defensor, exige uma **única instância correspondente no álbum** e confere nome e regra no catálogo oficial. Revalida o ataque 105 como dano-base 5 neutro antes de qualquer cobrança. Outros equipamentos continuam recusados. O débito 1, dano-base, registro de nocaute/vitória apenas de treino e devolução da carta original continuam em **uma operação atômica**.
- `chaotic-lobby.js`: mostra **202/204/206/207** como compatibilidades defensivas restritas, sem revelar qual equipamento o defensor possui. Mantém claro que o uso emprestado é **somente experimental**.
- `index.html`, `sw.js`, `scanner.html`, `scanner-completo.html` e `full-game-bootstrap.js` sincronizados em **v0.1.88 (release-88)**.

### Testes reais de SQL em transação com ROLLBACK

1. `supabase/tests/chaotic-borrowed-105-crystal-206-neutral-live-v0188.test.sql`: valida o original 206 no defensor, custo 4→3, HP 20→15, carta original devolvida, passe defensivo, impedimento de replay, escolha de dispensar revelação e avanço de turno. Confere que a auditoria do equipamento só é visível ao defensor e não causa segundo pagamento/dano. **PASS**.
2. `supabase/tests/chaotic-borrowed-105-forged-crystal-206-refusal-v0188.test.sql`: imitação de instância 206 com nome não reconhecido. O ataque é recusado sem alterar pontos, HP, empréstimo ou auditoria. **PASS**.
3. Regressões em SQL já reexecutadas: **Anel Precioso (201)** e **Bomba de Fogo (205)** continuam sendo bloqueados sem consumo e **Vento Forte sem equipamento** continua funcional. **PASS**.

A suíte Node `tests/black-hand-borrowed-105-crystal-206-v0188.test.mjs` testa lista de regras, propriedade, dano neutro, RLS, recusa de falsificação e versão PWA. As suítes históricas v0.1.86 e v0.1.87 continuam verificando compatibilidade.

### Pendente para as próximas versões

A **cura efetiva de veneno** do Bracelete de Cristal 206 ainda precisa de um estado real de envenenamento, regras de duração/alvo e uma ação autorizada pelo servidor. O fato de o 206 estar passivamente equipado no defensor **não é prova de que sua cura tenha sido executada**. As habilidades, custos e descartes de outros equipamentos (201, 203, 205), Mugics e efeitos oficiais permanecem pendentes. O treinamento não concede XP, moedas ou vitórias oficiais. Testes simultâneos com **dois dispositivos físicos** e auditoria geral de segurança ainda são necessários.

**Nenhuma carta, imagem, álbum, Deck, recompensa oficial ou mecânica 1x1/6x6 original foi removida.**
