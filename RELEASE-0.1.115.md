# Chaotic GO v0.1.115 — botão de atualização recupera leitura travada mesmo sem evento de rede

**1º de novembro de 2026 · progresso geral estimado: 97%.**

## Correção
- A v0.1.114 já recuperava leituras congeladas quando o Android notificava uma mudança de conectividade ou visibilidade. Porém, alguns navegadores podem manter uma leitura antiga sem emitir o evento esperado.
- No DROME 3×3, tocar em **Atualizar conexão e turno** agora permite abandonar uma consulta de leitura pendente, invalidar respostas antigas pela geração da tela, recriar o canal Realtime e consultar o estado atual do servidor.
- Esse descarte só ocorre em resposta ao toque explícito, com DROME 3×3 selecionado, celular visível, internet ligada e **nenhuma ação de combate em andamento**. O bloqueio `busy` não pode ser contornado.
- O botão permanece dentro da rotina que impede ações simultâneas; toques repetidos durante a atualização não disparam várias consultas.
- Nenhum ataque, pagamento, passe, defesa, dano ou empréstimo é reproduzido. Só leitura e assinatura são reiniciadas. As cartas e os Decks originais não são editados.
- Versões do PWA, login, scanner e cache atualizadas para v0.1.115.

## Testes
- Oito testes automatizados novos cobrem recuperação manual, ausência de consulta antiga, bloqueio durante ação ativa, aplicativo offline/oculto, uso normal, troca de sala, dois toques e ausência de reenvio de mutações.
- Cinco integrações SQL de treinamento 3×3 no Supabase já foram executadas com dados fictícios e `ROLLBACK`, conforme `docs/QA-3X3-SUPABASE-LIVE-2026-11-01.md`.

**Limite:** ainda é indispensável jogar a partida 3×3 completa entre **dois celulares físicos**, conferindo o turno restaurado, a defesa, os três nocautes e a igualdade do comprovante. **97% permanece apenas uma estimativa**, não homologação final.
