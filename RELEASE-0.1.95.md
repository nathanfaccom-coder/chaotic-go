# Chaotic GO v0.1.95 — proteção dos checkpoints em reconexões lentas

**31 de outubro de 2026. Progresso estimado: 97%.**

- Corrigida uma condição de corrida do DROME: três respostas recebidas após a troca de sala (presença, fase de ataque e prioridade de carta temporariamente emprestada) agora só são gravadas se sala, tela e turno continuarem sendo os mesmos.
- A confirmação de fase antes de mutações 3x3 não reutiliza resposta de outra sala ou turno; troca durante a consulta cancela a ação local e exige atualização.
- Cinco testes de regressão verificam respostas atrasadas de presença, ataque, empréstimo temporário, autorização da fase e ordem de gravação.
- Cache e referências da página inicial, login, scanner e bootstrap passam a carregar a release-95.

## Preservação
Nenhuma carta, imagem, Deck, recurso oficial, tabela ou dado dos jogadores foi modificado; somente JavaScript do DROME, arquivos de versão, testes e esta nota.

## Limite da validação
Os testes em GitHub Actions não são prova de que dois celulares físicos conseguem terminar uma sessão real, nem homologam o combate oficial. Continuam pendentes partida ponta a ponta, reconexão durante ataque e confirmação da vitória na UI de ambos os jogadores.
