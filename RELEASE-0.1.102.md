# Chaotic GO v0.1.102 — correção de turno antigo e retorno ao DROME

**31/10/2026 — progresso geral estimado de 97%.**

## Problemas corrigidos
- Uma leitura de turno iniciada antes de um avanço local poderia chegar depois e substituir na tela o turno recém-confirmado (mesmo com a mesma sala e geração). Agora cada atualização mantém a referência original do estado e é descartada se outra leitura ou ação confirmou um novo turno enquanto aguardava.
- Após aceitar uma resposta atual, cada etapa posterior da atualização acompanha a referência desse estado. Um heartbeat antigo não altera a presença nem continua carregando o painel após um avanço do turno.
- Tocar em **Voltar ao DROME** enquanto a sala ainda está ativa agora mostra o aviso sem desligar o Realtime ou o polling. A sincronização é interrompida somente ao efetivamente sair.
- Os marcadores de versão dos módulos do jogo, login e cache foram sincronizados para release-102.

## Verificação
Seis novos testes exercitam regressão de turno na mesma sala, duas consultas concorrentes, heartbeat tardio, atualização normal e o botão Voltar com sala ativa ou encerrada. Não há nenhuma alteração em cartas, imagens, Decks, dados permanentes, funções SQL, XP ou moedas. O 3×3 permanece como treinamento experimental e exige partida completa em dois celulares reais para ser homologado.
