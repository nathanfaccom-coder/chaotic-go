# Chaotic GO v0.1.127 — coleção com favoritos e seleção de DNA individual

**3 de novembro de 2026.** Atualização independente de testes em dois celulares.

## Entregas
- Álbum agora permite filtrar **somente favoritos**, ordenar por nome ou favoritos primeiro e consultar a quantidade de cartas individuais visíveis.
- Duas cópias da mesma criatura podem ter o mesmo ID de catálogo e diferentes atributos/DNA. A lista passa o índice exato da instância ao abrir ou favoritar para não agir sempre sobre a primeira cópia.
- Dados da carta são mostrados como texto seguro, não inseridos como HTML executável. A imagem exige caminho local reconhecido ou HTTP(S).
- Cartas legadas com atributos ausentes aparecem com marcadores, sem quebrar o Álbum.
- Ordem do inventário no banco e demais dados permanecem preservados: filtros não alteram o Supabase e só o ato explícito de favoritar aciona salvamento.
- Pesquisa antiga por nome, tipo e tribo continua disponível.

## Verificações
- Oito testes automatizados cobrem filtro, ordenação, DNA individual, favoritos e dados incompletos.
- Atualizados index, telas de login, scanner, bootstrap e cache para a v0.1.127.

## Ainda pendente
- Integração oficial de combate, economia e progressão com transações seguras. Nenhuma funcionalidade experimental passa automaticamente a ser oficial por esta entrega.
