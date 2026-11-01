# Chaotic GO v0.1.120 — comprovante final exibido sem esperar o diagnóstico complementar

**1º de novembro de 2026 · progresso geral estimado: 97%.**

## Problema confirmado
- A v0.1.119 priorizava os dados finais antes do histórico, mas, após ler a vitória e os nocautes, o cliente ainda aguardava a RPC `chaotic_get_preview_3x3_resume_status` para atualizar visualmente o resultado.
- Um navegador Android podia manter essa RPC suspensa, fazendo o jogador ver o comprovante anterior ou não ver o vencedor, apesar de o servidor já ter retornado os registros de nocaute e resultado.

## Correção
- O 3×3 encerrado agora apresenta **imediatamente** o comprovante final depois de verificar as leituras de nocautes e resultados, antes de consultar o checkpoint complementar.
- Antes da primeira renderização do final, apaga somente a informação local e obsoleta da etapa de ataque e de presença. Não altera HP, resultado, cartas, banco ou recompensas oficiais.
- Se a RPC complementar responder, a tela atualiza a indicação de fase; se falhar, o comprovante já exibido permanece, com um aviso adequado.
- Uma resposta atrasada de outra sala, tela ou turno nunca pode atualizar o comprovante novo.
- O caminho ativo 3×3 e os outros modos de combate continuam inalterados.
- Login, scanner, bootstrap e cache do PWA atualizados para v0.1.120.

## Validação
- Nove novos testes verificam renderização antes de checkpoint demorado, resposta permanentemente pendente, erro de checkpoint, troca de sala/turno, sessão sem vencedor, falha dos dados de nocaute e ausência de qualquer mutação de combate.
- Os testes anteriores da v0.1.117 foram ajustados para aceitar duas atualizações visuais: a imediata do comprovante e a opcional da etapa final.
- Os cinco testes reais de integração do Supabase com transações revertidas permanecem documentados em `docs/QA-3X3-SUPABASE-LIVE-2026-11-01.md`.

**Limite:** o jogo ainda precisa ser homologado entre dois celulares reais, com corte de conexão durante ataque, defesa, três nocautes e resultados comparados. Os **97%** seguem sendo uma estimativa.
