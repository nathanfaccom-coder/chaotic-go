# Chaotic GO v0.1.128 — convites mais fáceis para partidas reais

**3 de novembro de 2026.** O usuário relatou que conseguiu jogar uma partida; essa informação não comprova, por si só, todos os cenários de desconexão ou a homologação de modos oficiais.

## Melhorias
- O botão **Copiar convite** mantém a mensagem completa, agora com endereço público do jogo.
- O campo de entrada agora aceita tanto **código hexadecimal de 12 caracteres** quanto **convite completo** gerado pelo próprio Chaotic GO. Mensagens aleatórias não viram um código de sala, mesmo quando possuem caracteres parecidos.
- Botão **Copiar só o código** para compartilhar sem texto adicional.
- Botão **Compartilhar convite no celular**: abre o compartilhamento nativo do Android quando disponível; caso contrário, tenta copiar o convite.
- Botão **Colar convite recebido**: lê a área de transferência somente após o clique do jogador. Caso o navegador bloqueie a leitura, informa como colar manualmente.
- Compartilhamento cancelado não encerra a sala. Nenhum dado de login, senha, token, carta, XP ou moeda é colocado no convite.
- Sem alterações de regras, Decks, cartas, coleção, RPC ou banco de dados.

## Testes
- 12 novos testes para código simples, convite completo, rejeição de texto indevido, cópia, compartilhamento e ausência de escrita em tabelas.
- Atualizados index, login, scanner, bootstrap e cache da PWA para a v0.1.128.

## Próximas tarefas
Progredir nos modos oficiais e nas transações de economia, progresso e combate sem assumir que treinamentos experimentais já autorizam premiações.
