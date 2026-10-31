# Chaotic GO v0.1.94 — respostas atrasadas não contaminam outra sala

**31/10/2026 — progresso estimado: 97%.** Versão de estabilização do treino 3x3, não é combate oficial homologado.

## Proteções
- Cada leitura dos dados privados do 3x3 fica vinculada ao ID da sala, geração da tela e número do turno originais. Se outro turno ou sala for aberto durante uma requisição, a resposta é descartada sem atualizar o painel.
- As consultas de cartas, efeitos, equipamentos, HP, nocaute, vitória, mão de treino e presença usam o identificador da sala capturado antes de iniciar a sincronização, evitando misturar dados durante uma troca de sala.
- A rotina de leitura do turno interrompe o carregamento dos módulos seguintes se o jogador mudar de sala enquanto os dados chegam. Os diagnósticos de presença e histórico também descartam respostas obsoletas.
- Arquivos de abertura, login, scanner, bootstrap e service worker passaram a usar o identificador release-94.

## Testes
- Regressões para resposta atrasada da formação 3x3, heartbeat do turno e histórico antigo, sem mistura com uma nova sala.
- Fluxo de testes automatizados do GitHub é pré-requisito para publicação e a verificação pública consulta os arquivos publicados.

## Preservação e limitações
Nenhum arquivo de imagens, cartas, Decks ou dados do Supabase foi alterado. O treino em servidor (incluindo três nocautes reais em transação revertida) foi verificado anteriormente, mas a experiência completa em dois celulares físicos continua pendente. Não habilitar XP, moedas, resultados oficiais ou liberar 1x1/6x6 como concluídos.
