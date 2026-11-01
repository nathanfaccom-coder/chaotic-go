# Chaotic GO v0.1.117 — comprovante final do 3×3 não depende de RPCs de partida ativa

**1º de novembro de 2026 · progresso geral estimado: 97%.**

## Falha corrigida
- A v0.1.116 exibia **Atualizar comprovante final** após a partida, mas a atualização completa ainda chamava `chaotic_ping_preview_3x3_player` e `chaotic_get_preview_3x3_borrowed_attacks`. Essas funções, por segurança, **exigem `match.status='active'`** no Supabase.
- Após encerrar uma partida, esses RPCs negavam acesso e a leitura podia parar antes de renderizar o resultado. A consulta de presença jamais foi projetada para autenticar o resultado final.
- A v0.1.117 separa o fluxo final. Após obter a formação do RPC privado permitido, o cliente detecta `match.status==='finished'` e lê **somente** os três registros de comprovação: nocautes originais, nocautes de ataques emprestados e resultado de treino, sob as políticas RLS dos membros da sala.
- Consulta em seguida `chaotic_get_preview_3x3_resume_status`, que aceita partidas **ativas ou encerradas**. Se esse diagnóstico falhar, o comprovante já lido continua disponível e a tela avisa que a etapa final não pôde ser confirmada.
- Presença antiga é limpa ao encerrar a partida: não pode sugerir que os dois aparelhos continuam conectados. A verificação continua exigindo três nocautes válidos e um resultado consistente.
- O cliente não invoca RPCs de cartas emprestadas ativas nem faz ping de presença no caminho finalizado. Nenhum ataque, defesa, dano, pagamento ou premiação é reenviado.
- Atualizados login, scanner, bootstrap e cache do PWA para v0.1.117.

## Evidências e segurança
- Foram inspecionados os contratos das funções e as políticas de leitura no projeto Supabase ChaoticGO: `chaotic_ping_preview_3x3_player` e `chaotic_get_preview_3x3_borrowed_attacks` exigem partida ativa; `chaotic_get_preview_3x3_resume_status` permite `active` ou `finished`; as tabelas de nocautes e resultado são consultáveis pelos membros da sala após o encerramento.
- Oito novos testes automatizados verificam recuperação do resultado, proibição dos RPCs ativos, encerramento sem vencedor, falha parcial do checkpoint, troca de sala/turno, isolamento de leituras e ausência de mutações.
- Nenhuma carta, imagem, Deck, saldo, moeda, XP ou dado permanente de usuário foi alterado.
- Continua pendente o **teste visual real com dois celulares físicos**. Os **97%** seguem estimativos até uma partida 3×3 completa, com reconexão, defesa, três nocautes e comparação do mesmo comprovante nos dois aparelhos.
