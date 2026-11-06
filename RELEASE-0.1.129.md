# Chaotic GO v0.1.129 — histórico seguro de resultados do 3×3

**6 de novembro de 2026.** Desenvolvimento sem sobrescrever cartas, Decks ou resultados.

## Servidor
- Migração Supabase aplicada: tabela `chaotic_training_match_history` armazena **uma vez por sala** resultados de treino 3×3 que já foram auditados pelo motor do servidor (três nocautes).
- Trigger AFTER INSERT sobre `chaotic_preview_3x3_training_outcomes` arquiva resultado. UPSERT e alterações diretas por usuários comuns são proibidos.
- RLS e SELECT autenticado: cada participante vê **somente partidas nas quais venceu ou perdeu**.
- Histórico não tem vínculo de exclusão em cascata com a sala: continua disponível quando a sala fecha. A exclusão de uma conta apaga os registros associados por privacidade.
- Não atribui XP, moedas ou vitórias oficiais; não usa números de placar fornecidos pelo navegador.
- Não havia resultados completos auditados no servidor no momento da instalação; o painel começa vazio até um resultado que cumpra as regras.

## Interface
- DROME > Sala privada > Meu histórico de treino 3×3.
- Botão Atualizar histórico consulta os últimos 30 resultados da conta, mostra data, turno e vitórias/derrotas de treino.
- Não confundir estatística da janela de 30 com ranking ou total de carreira.
- Uma consulta que falhou apresenta erro, não 0 vitórias. Respostas atrasadas de uma tela antiga não são aplicadas a uma tela nova.
- Nomes de adversários e IDs de contas não são revelados no painel.
- Mantidos todos os sistemas existentes. Sem mudanças no motor de combate.

## Testes
- Oito novos testes de regressão para histórico, permissões, ausência de escrita e interface.
- Versão de login, scanner, bootstrap e cache PWA atualizada.
