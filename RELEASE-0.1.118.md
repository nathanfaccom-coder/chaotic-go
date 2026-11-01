# Chaotic GO v0.1.118 — carregamento rápido do comprovante final do 3×3

**1º de novembro de 2026 · progresso geral estimado: 97%.**

## Melhoria
- O servidor confirma a partida 3×3 como encerrada por `chaotic_match_turns.status='finished'`. O cliente não precisa reler dezenas de tabelas de combate ativo antes de mostrar a prova do resultado.
- A rotina `refreshMatch()` mantém a leitura do histórico de eventos e vai diretamente ao leitor privado do comprovante final 3×3 quando encontra `status='finished'`.
- São dispensadas as consultas da prévia de ataque, equipamento, dados, efeitos, danos e outras etapas ativas que não são necessárias para conferir o resultado final. Isto reduz espera e pontos de falha em celulares, sem alterar o cálculo de vitória.
- O caminho do comprovante segue usando a leitura RLS dos participantes, com nocautes distintos, vencedor e etapa final, e permanece protegido contra respostas tardias de outra sala/turno.
- A partida ativa 3×3 continua usando a rotina completa; outros modos também conservam seu fluxo normal.
- Atualizados login, scanner, bootstrap e cache do PWA para v0.1.118.

## Testes e limites
- Oito testes novos verificam o caminho direto depois do término, ausência de RPC ativo indevido, descarte de leitura antiga, manutenção do combate ativo, preservação dos outros modos e somente leitura.
- Os cinco testes reais de integração SQL do 3×3 (com ROLLBACK) estão documentados em `docs/QA-3X3-SUPABASE-LIVE-2026-11-01.md`.
- Nenhuma carta, arte, Deck, dinheiro, XP, regra de vitória ou dado permanente do jogo foi alterado.
- A validação final em dois celulares físicos, com reconexão durante o ataque, defesa, três nocautes e o mesmo resultado, continua pendente. O progresso fica em **97%** até termos essa evidência.
