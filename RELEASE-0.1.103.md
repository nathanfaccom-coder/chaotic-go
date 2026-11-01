# Chaotic GO v0.1.103 — bloqueio de botões preservado após ações

**1º de novembro de 2026 — progresso estimado: 97%.**

## Problema e correção
Quando qualquer ação assíncrona terminava, a tela reativava indiscriminadamente todos os botões. Isso podia reabilitar, por exemplo, o botão de revelação de criatura de Vento Forte emprestado, mesmo quando nenhuma criatura adversária viva e oculta era elegível.

O DROME agora conserva o estado de desabilitação anterior durante a ação, libera somente controles da sessão original e atualiza a elegibilidade do 3×3 após a resposta do servidor. Isso mantém controles inválidos desabilitados, sem impedir que um controle se torne válido quando o estado do combate mudar. Respostas de sessões antigas não alteram os botões da nova tela.

## Testes e limites
Cinco novos testes verificam preservação de botão bloqueado, habilitação/desabilitação conforme o estado atual, ação antiga versus nova sessão e recuperação de erro tardio. Código, artes, cartas, Decks, contas, SQL, XP e moedas originais preservados. A homologação do 3×3 depende ainda de uma partida real completa em dois celulares com reconexão e três nocautes.
