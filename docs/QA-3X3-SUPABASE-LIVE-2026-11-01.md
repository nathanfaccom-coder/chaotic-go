# Chaotic GO — Validação de integração 3×3 no Supabase real

**Data:** 1º de novembro de 2026  
**Base de código:** v0.1.113 — commit `a5a15f5fef9ae1435053c91d01a49a58e90481d9`  
**Ambiente:** Supabase `ChaoticGO` (projeto `avmpfnveotjzoqkrygfn`)  
**Resultado:** **5/5 suítes de integração SQL aprovadas.**

## Suítes executadas e resultados observados

1. `supabase/tests/chaotic-preview-3x3-two-player-preflight-live.test.sql` — **PASS v0.1.61:** dois participantes confirmam pronto, teste de presença desatualizada e não pronta, bloqueio de terceiro não autorizado. `ROLLBACK` executado.
2. `supabase/tests/chaotic-preview-3x3-peer-turn-reconnect-live-v0164.test.sql` — **PASS v0.1.64:** reconexão, sincronização do turno entre anfitrião e convidado, restrição de acesso externo. `ROLLBACK` executado.
3. `supabase/tests/chaotic-preview-3x3-three-knockouts-live-v0163.test.sql` — **PASS v0.1.63:** três nocautes de verdade na lógica SQL nos turnos 1, 3 e 5; ambos recebem o resultado correto; sem repetição de ação. `ROLLBACK` executado.
4. `supabase/tests/chaotic-preview-3x3-resume-mid-attack-live-v0166.test.sql` — **PASS v0.1.66:** retomada do ataque após mudança de fase, defesa duplicada impedida, dano duplicado impedido, etapa privada e resultado recuperados, três nocautes reais. `ROLLBACK` executado.
5. `supabase/tests/chaotic-preview-3x3-action-interleavings-live-v0168.test.sql` — **PASS v0.1.68:** passe prematuro com contato ou ataque não pago bloqueado, defesa e dano duplicados rejeitados; três nocautes e recuperação privada corretos. `ROLLBACK` executado.

Essas suítes foram **efetivamente executadas na conexão Supabase** durante esta sessão. Não são apenas verificações estáticas do conteúdo SQL. Cada suíte usa **usuários fictícios, sala fictícia, transação explícita e ROLLBACK**. Não se deve executar esses testes retirando a transação e o ROLLBACK.

### Auditoria pós-execução

Uma consulta SQL somente de leitura confirmou:

- `synthetic_users_remaining = 0`
- `synthetic_lobbies_remaining = 0`
- `synthetic_knockouts_remaining = 0`

A auditoria usou os IDs fixos das suítes e consultou a presença de seus nocautes por sala. As salas com UUID aleatório das suítes transacionais não foram listadas individualmente na consulta. O `ROLLBACK` integra cada suíte aprovada.

## O que está comprovado — e o que NÃO está

**Comprovado:** o backend atual consegue simular dois membros, recuperar o estado de ataque/defesa, bloquear duplicações, registrar três nocautes e entregar resultado compatível com o treinamento 3×3, sem conceder XP, moedas ou vitória oficial.

**Ainda não comprovado:** dois navegadores em **celulares físicos** trocando mensagens pela rede em tempo real durante uma partida completa, incluindo interrupção efetiva de Wi-Fi/dados, retorno do aplicativo do segundo plano e igualdade visual do resultado no cliente.

**Importante:** esses testes exercitam o **modo de treinamento 3×3**, não homologam a modalidade oficial nem garantem ausência de defeitos visuais, de toque ou de rede em aparelhos reais.

## Próximo critério de aceite

Usar o roteiro `docs/ACEITE-3X3-DOIS-CELULARES.md`. Só marcar a partida como validada se cada aparelho exibir a mesma sala, turno decisivo, vencedor e três nocautes ao consultar o relatório do servidor, sem repetição de pagamento, defesa ou dano.

**Progresso geral estimado:** 97%; não aumentar com base apenas nessas suítes de backend.

**Integridade:** nenhuma carta, Deck, imagem, saldo ou dado permanente de jogador foi intencionalmente alterado nesta validação.
