// ==========================================
// 1. BANCO DE DADOS: CRIATURAS
// ==========================================
const MONSTROS = [
    {
        id: 1,
        nome: "Johnes",
        tribo: "Azul",
        tipoClasse: "Subordinado",
        raridade: 0.8, // Comum
        elementos: ["Terra"],
        fichasHabilidade: 2,
        temEfeito: true,
        textoCarta: "Habilidade: Descarte 1 ficha de habilidade para olhar a mão do oponente.",
        cartaBlank: "cartas/criaturas/azul/johnes.jpg",
        iconeMapa: "cartas/icones/johnes_perfil.png",
        statsMax: { coragem: 50, poder: 40, sabedoria: 60, velocidade: 30, energia: 45 }
    },
    {
        id: 2,
        nome: "Promos",
        tribo: "Azul",
        tipoClasse: "Subordinado",
        raridade: 0.7, // Comum
        elementos: [],
        fichasHabilidade: 3,
        temEfeito: false,
        textoCarta: "Promos e o Promoscentismo.",
        cartaBlank: "cartas/criaturas/azul/promos.png",
        iconeMapa: "cartas/icones/promos_perfil.png",
        statsMax: { coragem: 40, poder: 40, sabedoria: 80, velocidade: 60, energia: 25 }
    }
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
        tipoCarta: "Ataque",
        img: "cartas/ataques/acido_gastrico.jpg",
        efeito: "Remove o equipamento do campeão ativo do oponente."
    }
];

// ==========================================
// 3. BANCO DE DADOS: EQUIPAMENTOS (Neutros)
// ==========================================
const EQUIPAMENTOS = [
    {
        id: 201,
        nome: "Anel Precioso",
        tipoCarta: "Equipamento",
        img: "cartas/equips/anel_precioso.png",
        efeito: "O campeão equipado perde 15 de energia, mas ignora danos elementais. Indestrutível."
    }
];

// ==========================================
// 4. BANCO DE DADOS: MAGIAS (MUGIC)
// ==========================================
const MAGIAS = [
    {
        id: 301,
        nome: "Canção da Criação",
        triboRestricao: null, // null = Sem restrição (Qualquer tribo usa)
        custoAtivacao: 1, 
        tipoCarta: "Magia",
        img: "cartas/magias/cancao_criacao.png",
        efeito: "Adicione qualquer elemento a um campeão. Gaste 3 fichas para adicionar 2 elementos."
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
        triboNativa: "Azul", // <--- Define que aqui só aparecem criaturas Azuis
        img: "cartas/locais/locais azul/cidade de kiru.png"
    },
    {
        id: 502,
        nome: "O Túnel da Tempestade",
        iniciativa: "Poder",
        triboNativa: "Qualquer", // <--- "Qualquer" permite monstros de todas as tribos
        img: "cartas/locais/tunel_tempestade.jpg"
    }
];

const CENARIOS = {
    "Cidade de Kiru": "cartas/locais/locais azul/kiru-bg.png",
    "O Túnel da Tempestade": "cartas/locais/tempestade-bg.jpg"
};