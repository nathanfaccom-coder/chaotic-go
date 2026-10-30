// ==========================================
// CONFIGURAÇÕES DE DESIGN E BANCOS DE DADOS
// ==========================================
const URL_FUNDO_CARTA = 'cartas/verso.jpg'; 

// ==========================================
// 1. BANCO DE DADOS: CRIATURAS
// ==========================================
const MONSTROS = [
    { id: 1, nome: "Johnes", tribo: "Azul", tipoClasse: "Subordinado", raridade: 0.1, elementos: ["Terra"], fichasHabilidade: 2, temEfeito: true, efeitoId: "espiar_mao", precisaAlvo: false, textoCarta: "Habilidade: Descarte 1 ficha de habilidade para olhar a mão do oponente.", cartaBlank: "cartas/criaturas/azul/johnes.jpg", iconeMapa: "cartas/icones/johnes_perfil.png", statsMax: { coragem: 50, poder: 40, sabedoria: 60, velocidade: 30, energia: 45 } },
    { id: 2, nome: "Promos", tribo: "Azul", tipoClasse: "Subordinado", raridade: 0.1, elementos: [], fichasHabilidade: 3, temEfeito: false, precisaAlvo: false, textoCarta: "Promos e o Promoscentismo.", cartaBlank: "cartas/criaturas/azul/promos.png", iconeMapa: "cartas/icones/promos_perfil.png", statsMax: { coragem: 40, poder: 40, sabedoria: 80, velocidade: 60, energia: 25 } },
    { id: 3, nome: "Alakazaz", tribo: "Azul", tipoClasse: "Mago", raridade: 0.1, elementos: [], fichasHabilidade: 5, temEfeito: true, precisaAlvo: true, efeitoId: "doar_ficha", textoCarta: "Você pode pegar as fichas de habilidade deste campeão e distribuir elas entre os campeões que você controla.", cartaBlank: "cartas/criaturas/azul/alakazaz.png", iconeMapa: "cartas/icones/alakazaz_perfil.png", statsMax: { coragem: 50, poder: 20, sabedoria: 80, velocidade: 25, energia: 10 } },
    { id: 4, nome: "Alfel", tribo: "Azul", tipoClasse: "Guerreiro", raridade: 0.1, elementos: ["Água"], fichasHabilidade: 1, temEfeito: false, precisaAlvo: false, textoCarta: "Procura o assassino de sua família.", cartaBlank: "cartas/criaturas/azul/alfel.png", iconeMapa: "cartas/icones/alfel_perfil.png", statsMax: { coragem: 50, poder: 15, sabedoria: 45, velocidade: 20, energia: 40 } },
    { id: 5, nome: "Ferez", tribo: "Azul", tipoClasse: "Guerreiro", raridade: 0.1, elementos: ["Água"], fichasHabilidade: 0, temEfeito: false, precisaAlvo: false, textoCarta: "Vive nas terras mais geladas da tribo azul.", cartaBlank: "cartas/criaturas/azul/ferez.png", iconeMapa: "cartas/icones/ferez_perfil.png", statsMax: { coragem: 35, poder: 65, sabedoria: 70, velocidade: 45, energia: 40 } },
    { id: 6, nome: "Frador", tribo: "Azul", tipoClasse: "Guerreiro", raridade: 0.6, elementos: [], fichasHabilidade: 1, custoHabilidade: 2, temEfeito: true, efeitoId: "dano_25", precisaAlvo: true, textoCarta: "Descarte 2 fichas de habilidade desse campeão, em sequência cause 25 de dano a um campeão do seu oponente.", cartaBlank: "cartas/criaturas/azul/frador.png", iconeMapa: "cartas/icones/frador_perfil.png", statsMax: { coragem: 85, poder: 80, sabedoria: 45, velocidade: 75, energia: 35 } },
    { id: 7, nome: "Gaturno", tribo: "Azul", tipoClasse: "Guerreiro", raridade: 0.1, elementos: [], fichasHabilidade: 0, temEfeito: false, precisaAlvo: false, textoCarta: "Não deixe sua mulher sozinha com o Gaturno.", cartaBlank: "cartas/criaturas/azul/gaturno.png", iconeMapa: "cartas/icones/gaturno_perfil.png", statsMax: { coragem: 30, poder: 65, sabedoria: 60, velocidade: 105, energia: 50 } },
    { id: 8, nome: "Guru", tribo: "Azul", tipoClasse: "Mago", raridade: 0.1, elementos: ["Ar"], fichasHabilidade: 2, temEfeito: true, precisaAlvo: true, efeitoId: "guru_elemento", textoCarta: "HABILIDADE: Descarte 1 ficha de habilidade deste campeão e depois dê 1 elemento de sua escolha para qualquer campeão.\n\nEnquanto este campeão estiver em seu controle todos os seus outros campeões ganham o elemento vento.", cartaBlank: "cartas/criaturas/azul/guru.png", iconeMapa: "cartas/icones/guru_perfil.png", statsMax: { coragem: 40, poder: 40, sabedoria: 75, velocidade: 45, energia: 25 } },
    { id: 9, nome: "Horn-ey", tribo: "Azul", tipoClasse: "Guerreiro", raridade: 0.1, elementos: ["Terra"], fichasHabilidade: 0, temEfeito: false, precisaAlvo: false, textoCarta: "jamais fale sobre o terceiro chifre de Horn-ey.", cartaBlank: "cartas/criaturas/azul/horn-ey.png", iconeMapa: "cartas/icones/horn-ey_perfil.png", statsMax: { coragem: 55, poder: 65, sabedoria: 30, velocidade: 55, energia: 50 } },
    { id: 10, nome: "Leona", tribo: "Azul", tipoClasse: "Guerreiro", raridade: 0.1, elementos: ["Água"], fichasHabilidade: 1, temEfeito: true, precisaAlvo: true, textoCarta: "HABILIDADE: toda vez que esse campeão atacar ele causa 5 de dano em qualquer campeão.", cartaBlank: "cartas/criaturas/azul/leona.png", iconeMapa: "cartas/icones/leona_perfil.png", statsMax: { coragem: 30, poder: 25, sabedoria: 30, velocidade: 45, energia: 35 } },
    { id: 11, nome: "Lion", tribo: "Azul", tipoClasse: "Guerreiro", raridade: 0.1, elementos: ["Fogo", "Terra"], fichasHabilidade: 1, temEfeito: true, precisaAlvo: false, efeitoId: "aumenta_energia_10", textoCarta: "HABILIDADE: Descarte 1 ficha de habilidade de Lion e aumente a sua energia em 10.", cartaBlank: "cartas/criaturas/azul/lion.png", iconeMapa: "cartas/icones/lion_perfil.png", statsMax: { coragem: 30, poder: 35, sabedoria: 30, velocidade: 20, energia: 25 } },
    { id: 12, nome: "Naty", tribo: "Azul", tipoClasse: "Mago", raridade: 0.1, elementos: [], fichasHabilidade: 3, temEfeito: true, precisaAlvo: false, efeitoId: "resetar_naty", textoCarta: "HABILIDADE: Na primeira vez que este campeão batalhar, ele ganha os 4 elementos, na segunda vez 3 elementos de sua escolha, na terceira vez 2 elementos de sua escolha, na quarta vez 1 elemento de sua escolha, descarte 1 ficha de habilidade deste campeão para renovar os efeitos deste campeão.", cartaBlank: "cartas/criaturas/azul/naty.png", iconeMapa: "cartas/icones/naty_perfil.png", statsMax: { coragem: 25, poder: 30, sabedoria: 60, velocidade: 65, energia: 35 } },
    { id: 13, nome: "Rex", tribo: "Azul", tipoClasse: "Subordinado", raridade: 0.1, elementos: ["Ar"], fichasHabilidade: 2, temEfeito: true, precisaAlvo: false, textoCarta: "HABILIDADE: Este campeão não toma dano do elemento vento.", cartaBlank: "cartas/criaturas/azul/rex.png", iconeMapa: "cartas/icones/rex_perfil.png", statsMax: { coragem: 30, poder: 15, sabedoria: 25, velocidade: 40, energia: 25 } },
    { id: 14, nome: "Spedman", tribo: "Azul", tipoClasse: "Guerreiro", raridade: 0.1, elementos: [], fichasHabilidade: 1, temEfeito: true, precisaAlvo: false, textoCarta: "HABILIDADE: Quando qualquer campeão que você controle for atacado, descarte 1 ficha de habilidade de Spedman, Spedman passa a ser seu campeão ativo e o dano do ataque é zerado.", cartaBlank: "cartas/criaturas/azul/spedman.png", iconeMapa: "cartas/icones/spedman_perfil.png", statsMax: { coragem: 45, poder: 50, sabedoria: 35, velocidade: 125, energia: 35 } },
    { id: 15, nome: "Vidal", tribo: "Azul", tipoClasse: "Mago", raridade: 0.1, elementos: [], fichasHabilidade: 2, temEfeito: true, efeitoId: "cura_15", precisaAlvo: true, textoCarta: "HABILIDADE: Descarte 1 ficha de habilidade desse campeão, em sequência recupere 15 pontos de energia de qualquer campeão.", cartaBlank: "cartas/criaturas/azul/vidal.png", iconeMapa: "cartas/icones/vidal_perfil.png", statsMax: { coragem: 35, poder: 20, sabedoria: 40, velocidade: 25, energia: 30 } },
    { id: 16, nome: "Xamã", tribo: "Azul", tipoClasse: "Mago", raridade: 0.9, elementos: [], fichasHabilidade: 4, temEfeito: true, efeitoId: "cura_10", precisaAlvo: true, textoCarta: "HABILIDADE: Descarte uma ficha de habilidade deste campeão, em sequência recupere 10 pontos de energia de qualquer campeão.", cartaBlank: "cartas/criaturas/azul/xama.png", iconeMapa: "cartas/icones/xama_perfil.png", statsMax: { coragem: 45, poder: 65, sabedoria: 65, velocidade: 50, energia: 15 } }
];

// ==========================================
// 2. BANCO DE DADOS: ATAQUES (Neutros)
// ==========================================
const ATAQUES = [
    {
        id: 101, 
        nome: "Ácido Gástrico", 
        custo: 3, 
        danoBase: 10, 
        danoElemental: { fogo: 5, agua: 5, terra: 0, vento: 0 }, 
        checkAtributo: null, // 🔥 Indica que não há checagem
        tipoCarta: "Ataque", 
        img: "cartas/ataques/acido_gastrico.jpg", 
        efeito: "Remove o equipamento do campeão ativo do oponente.", 
        raridade: 0.6
    },
    {
        id: 102, 
        nome: "Mão Negra", 
        custo: 0, 
        danoBase: 0, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, vento: 0 }, 
        checkAtributo: null, // 🔥 Indica que não há checagem
        tipoCarta: "Ataque", 
        img: "cartas/ataques/mao_negra.jpg", 
        efeito: "Pegue uma carta aleatória de ataque da mão do seu oponente.", 
        raridade: 0.6
    },
    {
        id: 103, 
        nome: "Aliança", 
        custo: 2, 
        danoBase: 0, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, vento: 0 }, 
        checkAtributo: null, // 🔥 Indica que não há checagem
        tipoCarta: "Ataque", 
        img: "cartas/ataques/alianca.jpg", 
        efeito: "Escolha um campeão derrotado seu, o valor da metade da energia dele é recuperado no seu campeão ativo.", 
        raridade: 0.7
    },
    { 
        id: 104, 
        nome: "Fogo Primordial 2.0", 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/fogo_primordial_2_0.jpg", 
        custo: 2, 
        danoBase: 5, 
        fogo: 5, agua: 0, terra: 0, ar: 0, 
        efeito: "Rode um dado de 6 lados. O valor será multiplicado com o dano base desta carta e passa a ser o dano total.",
        raridade: 0.7
    },

    {
        id: 105, 
        nome: "Vento Forte", 
        custo: 1, 
        danoBase: 5, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, ar: 0 }, // Mantive neutro no base, o bônus vem de modificadores!
        checkAtributo: null, 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/vento_forte.jpg", 
        efeito: "Se este ataque for bem sucedido você pode revelar 1 campeão que esteja virado para baixo do seu oponente.", 
        raridade: 0.5
    },
    {
        id: 106, 
        nome: "Armadilha de Víbora", 
        custo: 3, 
        danoBase: 15, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, ar: 0 }, 
        checkAtributo: null, 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/armadilha_vibora.jpg", 
        efeito: "Causa envenenamento. A cada turno do seu oponente, a criatura atingida perde 5 de energia. Este efeito não pode ser curado.", 
        raridade: 0.6
    },
    {
        id: 107, 
        nome: "Armadilha de Vinha", 
        custo: 1, 
        danoBase: 5, 
        danoElemental: { fogo: 0, agua: 0, terra: 5, ar: 0 }, 
        checkAtributo: null, 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/armadilha_vinha.jpg", 
        efeito: "Causa 5 de dano de Terra. Seu oponente não pode atacar, ativar habilidades, magias e nem comprar cartas no próximo turno.", 
        raridade: 0.7
    },
    {
        id: 108, 
        nome: "SPEED", 
        custo: 0, 
        danoBase: 0, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, ar: 0 }, 
        checkAtributo: null, 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/speed.jpg", 
        efeito: "Compre mais 1 carta do monte de cartas de ataque.", 
        raridade: 0.5
    },
    {
        id: 109, 
        nome: "TORNADO", 
        custo: 0, 
        danoBase: 0, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, ar: 0 }, 
        checkAtributo: null, 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/tornado.jpg", 
        efeito: "Seu oponente embaralha a mão de cartas de ataque dele no monte e depois compra 2 cartas. Só pode ser usado se o seu campeão ativo tiver o elemento Ar.", 
        raridade: 0.6
    },
    {
        id: 110, 
        nome: "SONAR", 
        custo: 2, 
        danoBase: 0, 
        danoElemental: { fogo: 0, agua: 0, terra: 10, ar: 10 }, 
        checkAtributo: null, 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/sonar.jpg", 
        efeito: "Pegue uma carta de ataque de custo 1 ou inferior do monte e adicione na sua mão.", 
        raridade: 0.8
    },
    {
        id: 111, 
        nome: "MÃO ELETRÔNICA", 
        custo: 3, 
        danoBase: 10, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, ar: 0 }, 
        checkAtributo: null, 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/mao_eletronica.jpg", 
        efeito: "Causa 10 de Dano. Seu oponente não pode atacar nos 2 próximos turnos.", 
        raridade: 0.6
    },
    {
        id: 112, 
        nome: "MÃO MÃO", 
        custo: 1, 
        danoBase: 5, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, ar: 0 }, 
        checkAtributo: null, 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/mao_mao.jpg", 
        efeito: "Causa 5 de Dano. Seu oponente não pode atacar no próximo turno.", 
        raridade: 0.5
    },
    {
        id: 113, 
        nome: "PURGATÓRIO", 
        custo: 0, 
        danoBase: 0, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, ar: 0 }, 
        checkAtributo: null, 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/purgatorio.jpg", 
        efeito: "Causa 0 de Dano. Ganha +5 de Dano extra para cada campeão seu derrotado (no cemitério).", 
        raridade: 0.5
    },
    {
        id: 114, 
        nome: "ESQUELETO", 
        custo: 2, 
        danoBase: 10, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, ar: 0 }, 
        checkAtributo: null, 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/esqueleto.jpg", 
        efeito: "Causa 10 de Dano. Ganha +5 de Dano extra para cada campeão seu derrotado (no cemitério).", 
        raridade: 0.6
    },
    {
        id: 115, 
        nome: "SOPRO", 
        custo: 0, 
        danoBase: 0, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, ar: 0 }, 
        checkAtributo: null, 
        tipoCarta: "Ataque", 
        img: "cartas/ataques/sopro.jpg", 
        efeito: "Pegue uma carta aleatória de ataque da mão do seu oponente e descarte.", 
        raridade: 0.5
    },
    /* ===================================================
    EXEMPLO DE COMO CRIAR UM ATAQUE COM CHECAGEM NO FUTURO:
    ===================================================
    ,{
        id: 104, 
        nome: "Golpe de Bravura", 
        custo: 1, 
        danoBase: 10, 
        danoElemental: { fogo: 0, agua: 0, terra: 0, vento: 0 }, 
        checkAtributo: { atributo: "coragem", danoExtra: 10 }, // Dá +10 de dano se a sua Coragem for maior!
        tipoCarta: "Ataque", 
        img: "cartas/ataques/golpe.jpg", 
        efeito: "Ganha +10 de dano extra se você for mais corajoso que o oponente.", 
        raridade: 0.5
    }
    */
];

// ==========================================
// 3. BANCO DE DADOS: EQUIPAMENTOS (Neutros)
// ==========================================
const EQUIPAMENTOS = [
    { id: 201, nome: "Anel Precioso", tipoCarta: "Equipamento", img: "cartas/equips/anel_precioso.png", efeito: "O campeão equipado perde 15 de energia, mas ignora danos elementais. Indestrutível.", raridade: 0.3 },
    { id: 202, nome: "Amuleto do Vácuo", tipoCarta: "Equipamento", img: "cartas/equips/amuleto_do_vacuo.jpg", efeito: "O campeão equipado não sofre danos que envolvam o elemento ar.", raridade: 0.4 },
    { id: 203, nome: "Arpa Mágica", tipoCarta: "Equipamento", img: "cartas/equips/arpa_magica.jpg", efeito: "Descarte este equipamento e adicione 1 ficha de habilidade no campeão equipado.", raridade: 0.4 },
    { id: 204, nome: "Bastão da Sabedoria", tipoCarta: "Equipamento", img: "cartas/equips/bastao_da_sabedoria.jpg", efeito: "Este equipamento aumenta em 40 pontos o atributo da sabedoria.", raridade: 0.5 },
    { id: 205, nome: "Bomba de Fogo", tipoCarta: "Equipamento", img: "cartas/equips/bomba_de_fogo.jpg", efeito: "Aumenta a energia em 5. Se a criatura for destruída com o equipamento revelado, cause 25 de dano a qualquer criatura.", raridade: 0.6 },
    { id: 206, nome: "Bracelete de cristal", tipoCarta: "Equipamento", img: "cartas/equips/bracelete_de_cristal.jpg", efeito: "Aumenta em +5 o dano de ataques de terra. Sacrifique este equipamento para curar envenenamento de qualquer criatura.", raridade: 0.5 },
    { id: 207, nome: "Bracelete de Água", tipoCarta: "Equipamento", img: "cartas/equips/bracelete_de_agua.jpg", efeito: "Os ataques que envolvam o elemento água causam mais 5 de dano, este equipamento não dá o elemento água.", raridade: 0.5 },
];


// ==========================================
// 4. BANCO DE DADOS: MAGIAS (MUGIC)
// ==========================================
const MAGIAS = [
    {
        id: 301, nome: "Canção da Criação", triboRestricao: null, custoAtivacao: 1, efeitoId: "cancao_criacao", tipoCarta: "Magia", img: "cartas/magias/cancao_criacao.png", efeito: "Adicione qualquer elemento a um campeão. Gaste 3 fichas para adicionar 2 elementos.", raridade: 0.5
    },
    {
        id: 302, nome: "Canção da rejeição", triboRestricao: null, custoAtivacao: 2, efeitoId: "cancao_rejeicao", tipoCarta: "Magia", img: "cartas/magias/cancao_rejeicao.jpg", efeito: "Descarte 2 fichas para negar a ativação de uma magia ou habilidade do oponente.", raridade: 0.6
    }
];

// ==========================================
// 5. BANCO DE DADOS: LOCAIS
// ==========================================
const LOCAIS_DB = [
    {
        id: 501, 
        nome: "Cidade de Kiru", 
        iniciativa: "Sabedoria", 
        triboNativa: "Azul", // Regra 1: Só Tribo Azul
        elementoNativo: null, // Regra 2: Qualquer Elemento (null)
        img: "cartas/locais/locais azul/cidade de kiru.jpg", 
        tipoCarta: "Local", 
        efeito: "As criaturas da tribo azul têm 10 de Energia adicionais.",
        raridade: 0.0
    },
    {
        id: 502, 
        nome: "O Túnel da Tempestade", 
        iniciativa: "Poder", 
        triboNativa: "Qualquer", // Regra 1: Qualquer Tribo
        elementoNativo: "Ar",    // Regra 2: SÓ monstros com o elemento "Ar"
        boostSpawn: [
            { nome: "Guru", peso: 50 }, 
            { nome: "Rex", peso: 50 }   
        ],
        img: "cartas/locais/tunel_tempestade.jpg", 
        tipoCarta: "Local", 
        efeito: "Ataques aéreos causam 5 de dano adicional. O dano causado por ataques de água é reduzido em 5.",
        raridade: 0.0
    },
    {
        id: 503, 
        nome: "A Barragem de Magma", 
        iniciativa: "Ar", // O motor vai usar "Velocidade" como desempate natural, como manda a regra para elementos!
        triboNativa: "Qualquer", 
        elementoNativo: "Fogo", 
        img: "cartas/locais/A barragem.png", 
        tipoCarta: "Local", 
        efeito: "Criaturas sem Fogo, ganham ele.",
        raridade: 0.4
    }
];

const CENARIOS = {
    "Cidade de Kiru": "cartas/locais/locais azul/kiru-bg.png",
    "O Túnel da Tempestade": "cartas/locais/tempestade-bg.jpg",
    "A Barragem de Magma": "cartas/locais/A barragem-bg.png" // Pode trocar por um BG específico depois se quiser
};
