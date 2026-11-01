# Chaotic GO v0.1.106 — retorno seguro da conexão no celular

**1º de novembro de 2026 · progresso estimado: 97%.**

## Correções
- Quando o Android perde Wi-Fi/dados móveis, o DROME associa a desconexão à sala atual.
- Ao voltar a ter internet e com a tela da sala visível, o DROME recria a assinatura do Supabase Realtime antes de atualizar o turno.
- A reconexão não envia nem repete ataques, defesas, pagamentos ou passagens de turno.
- A troca de sala invalida a indicação de desconexão anterior, e notificações repetidas não geram assinaturas extras.
- Se o navegador ainda está offline ou em segundo plano, a reconexão aguarda a volta das condições para leitura.
- Atualização coordenada de versão e cache do login, scanner, bootstrap, service worker e PWA.

## Validação
- Cinco novos testes automáticos cobrem a volta da internet, segundo plano, troca de sala, restauração sem sala e garantia de reconexão sem mutações de combate.
- Os testes anteriores de retorno e falha do canal permanecem ativos.
- **Ainda falta** o teste real de uma partida completa em dois aparelhos, incluindo interromper e restaurar a rede no meio do ataque e confirmar três nocautes e vencedor nas duas telas. O progresso não sobe com validação simulada.
- Nenhuma carta, arte, Deck, dado permanente ou mecânica anterior foi alterada.
