# Chaotic GO v0.1.126 — seleção segura de Decks e publicação robusta

**2 de novembro de 2026.** O progresso geral anterior de 97% continua sendo apenas uma estimativa, não certificação de todas as modalidades.

## Jogo e Oficina
- A seleção de Decks do DROME exige quantidade de criaturas compatível com o modo: **1 no 1×1, 3 no 3×3 e 6 no 6×6**. Os 20 ataques e 10 locais continuam obrigatórios.
- O indicador "pronto para batalha" na Oficina verifica também a quantidade de criaturas antes de marcar um Deck novo como pronto. Decks já armazenados não são modificados, excluídos nem regravados por essa verificação.
- Nomes e modo exibidos nos cartões de Decks são inseridos como texto seguro, impedindo que conteúdo salvo seja interpretado como HTML executável.
- Uma consulta lenta de Decks não pode mais sobrescrever a tela aberta depois pelo jogador. Falha de uma requisição antiga também não apaga a tela atual.
- Preservados IDs dos slots, cartas individuais, imagens, regras de combate, equipamentos e dados permanentes.

## Publicação
- A verificação do endereço público agora suporta a implantação mais lenta do GitHub Pages antes de acusar falha (até 36 tentativas com espera), mantendo validação rígida de versão e arquivos essenciais.
- As requisições de verificação da página inicial usam parâmetro de consulta para reduzir interferência de cache HTTP antigo.
- Testes automatizados novos para contagem de criaturas, estrutura do Deck, conteúdo seguro, respostas atrasadas e erros de leitura.

## Limitações
- Isso melhora a seleção e a validação dos Decks; não libera partidas oficiais, recompensas, trocas ou economia ainda pendentes no backend.
