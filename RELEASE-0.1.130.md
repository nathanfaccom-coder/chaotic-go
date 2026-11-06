# Chaotic GO v0.1.130 — estatísticas de carreira e extrato de recompensas oficiais

**6 de novembro de 2026.** Todos os dados, cartas e Decks anteriores preservados.

## Banco Supabase
- Função `chaotic_my_training_stats()`, SECURITY INVOKER, calcula **todo o histórico de treino** do usuário, além do recorte de 30 resultados disponível no painel. RLS restringe a consulta aos próprios resultados.
- Tabela `chaotic_official_reward_ledger` criada para futuros lançamentos oficiais. Cada par (partida, jogador) tem **uma única chave**, independente do tipo de premiação.
- RLS permite exclusivamente SELECT dos próprios recibos. Contas autenticadas não podem inserir/alterar/apagar registros; chamadas anônimas não podem executar a função de estatísticas.
- Trigger impede que partidas e resultados do DROME experimental sejam convertidos em fontes de premiação oficial.
- **Nenhuma recompensa está habilitada**: ainda não existe motor de vitória oficial conectado nem endpoint para emitir pagamentos. Os dados do perfil legado são editáveis pelo cliente e não constituem prova para XP oficial.

## Interface
- DROME > Sala privada > Meu histórico de treino 3×3: também mostra o resumo de **carreira inteira** retornado pelo servidor, distinto dos últimos 30 resultados. Se esse serviço falhar, exibe somente a janela de 30; nunca inventa total.
- Novo painel recolhível **Extrato de recompensas oficiais**, somente leitura, com os últimos 20 lançamentos e valores recebidos nesse recorte, sem afirmar que sejam o saldo global do jogador.
- No início, extrato vazio é normal: nenhuma distribuição foi iniciada. Falhas de conexão não são tratadas como ausência de recompensas.
- O extrato não abre o inventário nem revela dados de adversários.

## Testes e limitações
- Adicionados testes de UI, estatísticas, ausência de permissões de escrita e proibição de premiar treino.
- O ledger por si só **não credita moedas nem XP**. O próximo passo, antes da ativação de pagamentos, é implementar e auditar o encerramento de partida oficial e a transação atômica dos saldos. Nunca usar fim de treino ou perfil editável como certificação.
