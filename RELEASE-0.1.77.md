# Chaotic GO v0.1.77 — prévia privada do ataque emprestado
**Data:** 31/10/2026. **Escopo:** infraestrutura experimental 3x3 para a carta **Mão Negra (102)**, sem habilitar roubo/pagamento/dano reais.

## Alterações concretas
- **Supabase:** `supabase/chaotic-preview-3x3-borrowed-quote-v0177.sql` instalou a RPC autenticada `chaotic_quote_preview_3x3_borrowed_attack(uuid,uuid,integer)`.
- A RPC confirma sala/partida 3x3 ativa, atacante na vez e contato válido ainda não consumido. Consulta **somente custódias do tomador** via inspeção privada da v0.1.76, incluindo prova da carta original no álbum do dono e catálogo de custos e dano.
- Calcula **pontos de treinamento disponíveis**, viabilidade hipotética de custo, dano-base limitado pelo HP atual e **HP hipotético restante**. Confere que o HP coincide com o contato; não calcula elemental, imunidades, bônus, reação defensiva ou resolução final.
- **Somente leitura:** não debita pontos, não descarta carta, não altera HP, não troca dono, não escreve projeções oficiais e não libera a Mão Negra (102). `payment_enabled=false`, `damage_applied=false`, `ownership_transferred=false`.
- **Interface DROME:** nova seleção e botão de prévia de carta temporária quando o tomador está atacando e existe contato válido. Resultado visual identificado como simulação sem uso real. As cartas emprestadas continuam fora da mão e dos Decks originais.
- **PWA/Android:** versão do arquivo público, Service Worker, scanner e carregador DROME sincronizada para **v0.1.77**.

## Testes
- `supabase/tests/chaotic-preview-3x3-borrowed-quote-v0177.test.sql`: **PASS**, no Supabase real com transação revertida. Validou privilégios, ausência de escrita SQL direta e rejeição de chamadas anônimas, de usuário sem sala e de turno inválido.
- `tests/black-hand-borrowed-quote-v0177.test.mjs`: cinco testes de regressão de acesso privado, custo/dano-base, integridade das cartas, ligação com a interface e cache.
- `tests/black-hand-borrowed-inspection-v0176.test.mjs`: verificação de versão ajustada para acompanhar novas versões sem diminuir a cobertura anterior.
- **Teste positivo em Supabase aprovado:** `supabase/tests/chaotic-preview-3x3-borrowed-quote-positive-live-v0177.test.sql` criou um empréstimo temporário sintético de Vento Forte (105), comprovou custo 1, dano-base 5, HP hipotético 20→15 e bloqueio do dono original. Toda a transação foi revertida sem alterar contas ou cartas reais. Ainda não houve teste ponta a ponta de execução de Mão Negra (102) nem homologação em dois celulares reais.

## Limitações e próximo passo
**A Mão Negra (102) ainda não é jogável.** A função de empréstimo interna permanece revogada a usuários do navegador e o gasto 102 continua proibido no servidor. Para habilitar a mecânica, falta criar uma transação autorizada atômica que **pague 102, escolha/empreste carta adversária, contabilize seu uso com custo e efeitos corretos, e devolva a posse ao dono** com antirreplay e tratamento de encerramento de sala. A função de prévia não deve ser usada como autorização para debitá-la.

As cartas, artes, coleções, Decks, 1x1, 6x6 e regras anteriores não foram substituídas. Permanecem pendentes Aliança (103), Armadilha de Víbora (106), ajustes de equipamento/Mugic, combate oficial, auditoria granular das RPCs privilegiadas e teste físico simultâneo. O verificador de segurança do Supabase ainda alerta para diversas funções `SECURITY DEFINER` chamáveis por usuários autenticados; é necessária revisão das respectivas autorizações em cada função.

**Progresso global estimado: 97% (±10 pontos percentuais), sem aumento automático.** A estimativa é manual e **não** significa que o jogo esteja homologado para lançamento.
