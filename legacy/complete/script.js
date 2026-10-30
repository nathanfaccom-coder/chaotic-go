// ==========================================
// ☁️ CONEXÃO CLOUD (FIREBASE) E MÓDULO PRINCIPAL
// ==========================================
import { db,ref,set,get,onValue,update,remove,installDbCompat } from "./supabase-game-bridge.js?v=full-2";
installDbCompat();
const uid = window.ChaoticAuthUser?.id;
if (!uid) throw new Error("Sessão Supabase ausente");
// ==========================================
// 1. VARIÁVEIS GLOBAIS DA NUVEM
// ==========================================
let mapaScanner, marcadorJogador, marcadorMonstro, watchID, circuloRadar;
let localParaViagem = "";
let imgLocalParaViagem = ""; 
let triboLocalParaViagem = ""; 
window.modoMenu = true;
let indexSelecionado = 0;
let monstroAtual = null;
let tipoDeCartaAtual = ""; 
let cartaVisualizadaId = null; 

let circulosParaAcertar = 0;
let tempoRestante = 10;
let timerInterval, miraInterval;

// Os dados do jogador agora começam vazios e são preenchidos pela nuvem
window.inventario = []; 
window.perfilJogador = { nome: "Carregando...", avatar: "👤", vitorias: 0, derrotas: 0 };
window.amigos = [];
let amigoAtualTroca = null;
let minhaCartaOfertada = null;
let cartaSimuladaAmigo = null;

// ==========================================
// 🎵 GERENCIADOR DE ÁUDIO MESTRE
// ==========================================
const AUDIO = {
    menu: new Audio('audio/scaner-menu.mp3'),
    mapa: new Audio('audio/drento-dos-locais.mp3'),
    lobby: new Audio('audio/dentro-do-trocas.mp3'),
    minigameCriatura: new Audio('audio/scanear-criaturas.mp3'),
    minigameMugic: new Audio('audio/scanear-mugic.mp3'),
    viajar: new Audio('audio/entrando-nos-locais.mp3'),
    bau: new Audio('audio/animacao-bau.mp3'),
    spawn: new Audio('audio/aparicao-de-criatura.mp3'),
    notificacao: new Audio('audio/notificacao-troca.mp3')
};

// Configuração das Músicas em Loop e Volume (Ajuste os números se ficar alto/baixo)
AUDIO.menu.loop = true; AUDIO.menu.volume = 0.3;
AUDIO.mapa.loop = true; AUDIO.mapa.volume = 0.3;
AUDIO.lobby.loop = true; AUDIO.lobby.volume = 0.3;
AUDIO.minigameCriatura.loop = true; AUDIO.minigameCriatura.volume = 0.4;
AUDIO.minigameMugic.loop = true; AUDIO.minigameMugic.volume = 0.4;

// Função de Efeitos Rápidos (SFX)
window.tocarSFX = function(nome) {
    if(AUDIO[nome]) {
        AUDIO[nome].currentTime = 0;
        AUDIO[nome].play().catch(() => {});
    }
};

// Função Inteligente do DJ (Troca a música sem encavalar duas ao mesmo tempo)
window.mudarMusicaFundo = function(novaMusica) {
    let musicas = ['menu', 'mapa', 'lobby', 'minigameCriatura', 'minigameMugic'];
    musicas.forEach(m => {
        if(AUDIO[m]) { AUDIO[m].pause(); AUDIO[m].currentTime = 0; }
    });
    if(novaMusica && AUDIO[novaMusica]) {
        AUDIO[novaMusica].play().catch(() => {});
    }
};

// 1º Clique liga o motor do jogo
document.body.addEventListener('click', () => {
    let telaMapa = document.getElementById("tela-mapa").style.display === "flex";
    let telaMini = document.getElementById("tela-minigame").style.display === "block";
    let telaMugic = document.getElementById("modal-mugic-mini") && document.getElementById("modal-mugic-mini").style.display === "flex";
    let telaLobby = document.getElementById("modal-troca") && document.getElementById("modal-troca").style.display === "flex";

    if(AUDIO.menu.paused && !telaMapa && !telaMini && !telaMugic && !telaLobby) {
        mudarMusicaFundo('menu');
    }
}, { once: true });
// ==========================================
// 2. SINCRONIZAÇÃO EM TEMPO REAL COM O FIREBASE
// ==========================================

// 2.1 Puxando Perfil
const perfilRef = ref(db, 'jogadores/' + uid + '/profile');
onValue(perfilRef, (snapshot) => {
    if (snapshot.exists()) {
        window.perfilJogador = snapshot.val();
    } else {
        // O PLANO B: Se a nuvem estiver vazia, cria um perfil básico
        window.perfilJogador = { nome: "Novato(a)", avatar: "👤", vitorias: 0, derrotas: 0 };
    }
    
    // Atualiza a tela se ela estiver aberta
    if (document.getElementById("tela-perfil").style.display === "flex") {
        abrirPerfil();
    }
});

// 2.2 Puxando Álbum (Inventário)
const albumRef = ref(db, 'jogadores/' + uid + '/album');
onValue(albumRef, (snapshot) => {

   // ==========================================
    // 👑 MODO DEUS (CONTA DE DESENVOLVEDOR) 👑
    // ==========================================
    console.log("🔑 SEU UID ATUAL É:", uid); 
    const DEV_UID = "Uetuh99BvhcnlzCxBbBg1Yu0CJv2"; // A chave mestra do Arquiteto!

    if (uid === DEV_UID) {
        window.inventario = [];
        
        const adicionarTudo = (bancoGlob, tipo) => {
            if (typeof bancoGlob !== 'undefined') {
                bancoGlob.forEach(carta => {
                    window.inventario.push({
                        ...carta, // 🔥 A MÁGICA: Copia TUDO da carta original (custo, dano, efeitos, iniciativa)!
                        tribo: carta.tribo || "Neutro", 
                        tipoCarta: tipo, 
                        img: carta.img || carta.cartaBlank, 
                        favorito: false, 
                        quantidade: 20, 
                        stats: carta.statsMax ? {
                            c: carta.statsMax.coragem, p: carta.statsMax.poder,
                            s: carta.statsMax.sabedoria, v: carta.statsMax.velocidade, e: carta.statsMax.energia
                        } : { c: "-", p: "-", s: "-", v: "-", e: "-" }
                    });
                });
            }
        };

        adicionarTudo(typeof MONSTROS !== 'undefined' ? MONSTROS : [], "Criatura");
        adicionarTudo(typeof ATAQUES !== 'undefined' ? ATAQUES : [], "Ataque");
        adicionarTudo(typeof MAGIAS !== 'undefined' ? MAGIAS : [], "Magia");
        adicionarTudo(typeof EQUIPAMENTOS !== 'undefined' ? EQUIPAMENTOS : [], "Equipamento");
        adicionarTudo(typeof LOCAIS_DB !== 'undefined' ? LOCAIS_DB : [], "Local");

        if (document.getElementById("tela-album").style.display === "flex") renderizarListaAlbum();
        return; 
    }
    // ==========================================

    if (snapshot.exists()) {
        let dadosNuvem = snapshot.val();
        // CÓDIGO DE PROTEÇÃO: Força o Firebase a devolver uma Lista (Array) limpa!
        window.inventario = Array.isArray(dadosNuvem) ? dadosNuvem : Object.values(dadosNuvem);
        window.inventario = window.inventario.filter(item => item !== null && item !== undefined);
    } else {
        // PLANO B DO ÁLBUM: Conta nova? Recebe a Cidade de Kiru de brinde!
        window.inventario = [{
            id: Date.now(), nome: "Cidade de Kiru", tribo: "Azul", tipoCarta: "Local", 
            img: "cartas/locais/locais azul/cidade de kiru.jpg", favorito: false, quantidade: 1,
            stats: { c: "-", p: "-", s: "-", v: "-", e: "-" }
        }];
        salvarAlbumNaNuvem(); // Grava o brinde no Firebase na mesma hora!
    }

    // Atualiza a tela de cartas se ela estiver aberta
    if (document.getElementById("tela-album").style.display === "flex") {
        renderizarListaAlbum();
    }
});

// 2.3 Puxando Amigos
const amigosRef = ref(db, 'jogadores/' + uid + '/amigos');
onValue(amigosRef, (snapshot) => {
    if (snapshot.exists()) {
        window.amigos = snapshot.val() || [];
        // Atualiza a lista social se estiver aberta
        if (document.getElementById("tela-social").style.display === "flex") renderizarAmigos();
    } else {
        window.amigos = [];
    }
});
// 2.4 Puxando Pedidos de Amizade (Caixa de Entrada)
window.pedidosAmizade = null;
const pedidosRef = ref(db, 'jogadores/' + uid + '/pedidos');
onValue(pedidosRef, (snapshot) => {
    if (snapshot.exists()) {
        window.pedidosAmizade = snapshot.val();
        // Se a aba social estiver aberta, atualiza na hora pra mostrar o convite!
        if (document.getElementById("tela-social").style.display === "flex") renderizarAmigos();
    } else {
        window.pedidosAmizade = null;
        if (document.getElementById("tela-social").style.display === "flex") renderizarAmigos();
    }
});
// ==========================================
// 2.5 ESCUTANDO CHAMADAS PARA O LOBBY DE TROCA
// ==========================================
let salaTrocaAtual = null;
let souP1 = false; 
let chamadaPendente = null;

const conviteLobbyRef = ref(db, 'jogadores/' + uid + '/chamada_troca');
onValue(conviteLobbyRef, (snapshot) => {
    if (snapshot.exists()) {
        chamadaPendente = snapshot.val();
        
        // Verificação de segurança para garantir que os elementos existem
        const modal = document.getElementById("modal-chamada-troca");
        const texto = document.getElementById("texto-chamada-troca");

        if (modal && texto && chamadaPendente.nome) {
            texto.innerText = chamadaPendente.nome.toUpperCase() + "\nABRIU UM PORTAL DE TROCAS!";
            tocarSFX('notificacao');
            modal.style.display = "flex";
            
            // Toca um som ou vibra se possível para alertar o jogador
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
        
        // Limpa a chamada da nuvem imediatamente para evitar loops
        set(ref(db, 'jogadores/' + uid + '/chamada_troca'), null);
    }
});

// A função que os novos botões do HTML vão acionar
window.responderChamadaTroca = function(resposta) {
    document.getElementById("modal-chamada-troca").style.display = "none";
    
    if (!chamadaPendente) {
        mostrarMensagemScanner("Sinal perdido...");
        return;
    }

    // 1. SALVA OS DADOS NO COFRE ANTES DE APAGAR A CHAMADA!
    let idDaSala = chamadaPendente.salaId;
    let idDoAmigo = chamadaPendente.de;
    let nomeDoAmigo = chamadaPendente.nome;

    if (resposta === 'aceitar') {
        // MUDA PARA A TELA SOCIAL PRIMEIRO
        abrirSocial(); 
        
        // AGORA USA OS DADOS SALVOS NO COFRE (Não dá mais erro!)
        setTimeout(() => {
            entrarNaSalaDeTroca(idDaSala, false, idDoAmigo, nomeDoAmigo);
        }, 150); 
        
    } else if (resposta === 'esperar') {
        // Envia o status para a nuvem usando o ID seguro
        update(ref(db, 'salas_troca/' + idDaSala), { status: "ocupado" });
        mostrarMensagemScanner("Aviso de 'Aguarde' enviado!");
        
    } else if (resposta === 'recusar') {
        update(ref(db, 'salas_troca/' + idDaSala), { status: "recusado" });
        mostrarMensagemScanner("Chamada rejeitada.");
    }
    
    // 2. Agora sim podemos limpar a chamada pendente com segurança
    chamadaPendente = null;
}
// ==========================================
// 3. FUNÇÕES DE SALVAMENTO NA NUVEM
// ==========================================
window.salvarAlbumNaNuvem = function() {
    set(ref(db, 'jogadores/' + uid + '/album'), window.inventario)
        .catch(err => console.error("Erro ao salvar álbum na nuvem:", err));
};

window.salvarPerfilNaNuvem = function() {
    set(ref(db, 'jogadores/' + uid + '/profile'), window.perfilJogador)
        .catch(err => console.error("Erro ao salvar perfil na nuvem:", err));
};

window.salvarAmigosNaNuvem = function() {
    set(ref(db, 'jogadores/' + uid + '/amigos'), window.amigos)
        .catch(err => console.error("Erro ao salvar amigos na nuvem:", err));
};

// Gerador de números fixos baseado em uma semente (Para que todos vejam o mesmo monstro)
function sementeRandom(s) {
    let t = s += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

// ==========================================
// 2. FUNÇÕES DE APOIO E MENSAGEM GLOBAL
// ==========================================
window.mostrarMensagemScanner = function(texto) {
    let cx = document.getElementById("mensagem-global");
    if (!cx) {
        cx = document.createElement("div");
        cx.id = "mensagem-global";
        cx.className = "mensagem-sistema";
        cx.style.position = "absolute";
        cx.style.top = "15px";
        cx.style.left = "50%";
        cx.style.transform = "translateX(-50%)";
        cx.style.zIndex = "999999";
        cx.style.background = "rgba(0, 0, 0, 0.8)";
        cx.style.padding = "5px 15px";
        cx.style.borderRadius = "5px";
        cx.style.border = "1px solid #4CAF50";
        document.getElementById("tela-jogo").appendChild(cx);
    }
    
    cx.innerText = texto;
    cx.classList.add("mostrar");
    setTimeout(() => cx.classList.remove("mostrar"), 2500);
}

function gerarDNA(monstroID) {
    if (typeof MONSTROS === 'undefined') return;
    const dados = MONSTROS.find(m => m.id === monstroID);
    document.getElementById("camada-stats").style.display = "block";

    function sortearMultiploDe5(maximo, minimo = 0) {
        let maxMultiplos = Math.floor(maximo / 5);
        let minMultiplos = Math.floor(minimo / 5);
        let sorteio = Math.floor(Math.random() * ((maxMultiplos - minMultiplos) + 1)) + minMultiplos;
        return sorteio * 5; 
    }

    document.getElementById("stat-coragem").innerText = sortearMultiploDe5(dados.statsMax.coragem);
    document.getElementById("stat-poder").innerText = sortearMultiploDe5(dados.statsMax.poder);
    document.getElementById("stat-sabedoria").innerText = sortearMultiploDe5(dados.statsMax.sabedoria);
    document.getElementById("stat-velocidade").innerText = sortearMultiploDe5(dados.statsMax.velocidade);
    document.getElementById("stat-energia").innerText = sortearMultiploDe5(dados.statsMax.energia, 15);
}

// ==========================================
// ==========================================
// 3. SISTEMA DE CARTA HÍBRIDA (INSPEÇÃO)
// ==========================================
window.abrirDetalheCarta = function(nome, tribo, img, tipo = "local") {
    tipoDeCartaAtual = tipo;
    document.getElementById("imagem-detalhe").src = img;
    
    let btnEsq = document.getElementById("btn-acao-esq"); 
    let btnDir = document.getElementById("btn-acao-dir"); 

    if (tipo === "local") {
        localParaViagem = nome;
        imgLocalParaViagem = img;
        triboLocalParaViagem = tribo;
        document.getElementById("camada-stats").style.display = "none";
        btnEsq.innerText = "VOLTAR";
        btnDir.innerText = "VIAJAR";
    } else if (tipo === "monstro") {
        btnEsq.innerText = "DELETAR";
        btnDir.innerText = "GUARDAR";
    } else if (tipo === "album" || tipo === "inspecao_troca") {
        btnEsq.innerText = "EXCLUIR"; 
        btnDir.innerText = "VOLTAR"; 
        if(tipo === "inspecao_troca") btnEsq.style.display = "none";
        else btnEsq.style.display = "block";
    }

    document.getElementById("tela-locais").style.display = "none";
    document.getElementById("tela-album").style.display = "none";
    document.getElementById("tela-perfil").style.display = "none";
    if(document.getElementById("tela-social")) document.getElementById("tela-social").style.display = "none"; 
    
    document.getElementById("tela-detalhe-carta").style.display = "flex";
    document.getElementById("painel-botoes-fisicos").style.display = "none";
    document.getElementById("painel-viagem").style.display = "flex";
};
document.getElementById("btn-acao-dir").onclick = function() {
    if (tipoDeCartaAtual === "local") { 
        tocarSFX('viajar'); 
        mudarMusicaFundo('mapa'); 
        iniciarGPS(); 
    } else if (tipoDeCartaAtual === "monstro") {
       let novaCaptura = {
            id: Date.now(), nome: monstroAtual.nome, tribo: monstroAtual.tribo || "Azul", tipoCarta: "Criatura", 
            tipo: monstroAtual.tipoClasse || "Subordinado", // 🛠️ FIX: Agora o Scanner lê a palavra 'tipoClasse' do seu BD!
            img: monstroAtual.cartaBlank, favorito: false, quantidade: 1,
            stats: {
                c: document.getElementById("stat-coragem").innerText, p: document.getElementById("stat-poder").innerText,
                s: document.getElementById("stat-sabedoria").innerText, v: document.getElementById("stat-velocidade").innerText,
                e: document.getElementById("stat-energia").innerText
            }
        };
        inventario.push(novaCaptura);
        salvarAlbumNaNuvem();
        mostrarMensagemScanner("CARTA ARMAZENADA NO ÁLBUM!");
        voltarAoRadar();
   } else if (tipoDeCartaAtual === "album") {
        document.getElementById("tela-detalhe-carta").style.display = "none";
        document.getElementById("painel-viagem").style.display = "none";
        abrirAlbum(); // 🛠️ CORREÇÃO AQUI: Estava faltando chamar o Álbum de volta!
    } else if (tipoDeCartaAtual === "inspecao_troca") {
        document.getElementById("tela-detalhe-carta").style.display = "none";
        document.getElementById("painel-viagem").style.display = "none";
        if(document.getElementById("tela-social")) document.getElementById("tela-social").style.display = "flex";
    }
};
document.getElementById("btn-acao-esq").onclick = function() {
    if (tipoDeCartaAtual === "local") {
        location.reload(); 
    } else if (tipoDeCartaAtual === "monstro") {
        mostrarMensagemScanner("CÓDIGO DE DNA DELETADO!");
        voltarAoRadar();
    } else if (tipoDeCartaAtual === "album") {
        let carta = inventario.find(c => c.id === cartaVisualizadaId);
        if(carta && carta.favorito) document.getElementById("modal-confirmacao").style.display = "flex"; 
        else excluirCartaConfirmada(); 
    }
};

window.cancelarExclusao = function() {
    document.getElementById("modal-confirmacao").style.display = "none";
}

window.excluirCartaConfirmada = function() {
    document.getElementById("modal-confirmacao").style.display = "none";
    let carta = inventario.find(c => c.id === cartaVisualizadaId);
    if (carta && carta.tipoCarta === "Local" && carta.quantidade > 1) {
        carta.quantidade--; mostrarMensagemScanner("UMA CÓPIA EXCLUÍDA!");
    } else {
        inventario = inventario.filter(c => c.id !== cartaVisualizadaId); mostrarMensagemScanner("CARTA EXCLUÍDA!");
    }
   salvarAlbumNaNuvem(); 
    document.getElementById("tela-detalhe-carta").style.display = "none";
    document.getElementById("painel-viagem").style.display = "none";
    abrirAlbum(); // 🛠️ CORREÇÃO AQUI TAMBÉM: Retorna ao álbum após excluir a carta!
}

function voltarAoRadar() {
    mudarMusicaFundo('mapa');
    setTimeout(() => {
        document.getElementById("tela-detalhe-carta").style.display = "none";
        document.getElementById("painel-viagem").style.display = "none";
        document.getElementById("tela-mapa").style.display = "flex";
        document.getElementById("painel-botoes-fisicos").style.display = "flex";
        
        // Em vez de gerar um novo no mesmo lugar (como antes), apenas deixamos o mapa ativo
        // O motor de spawn passivo cuidará de gerar novos quando o jogador andar
    }, 1500);
}

// ==========================================
// 4. LÓGICA DO MINI-GAME E RADAR
// ==========================================
function iniciarMinigame(monstro) {
    mudarMusicaFundo('minigameCriatura');
    monstroAtual = monstro;
    window.modoMenu = false;
    document.getElementById("tela-mapa").style.display = "none";
    document.getElementById("tela-minigame").style.display = "block";
    document.getElementById("fundo-cena-minigame").src = CENARIOS[localParaViagem] || "";
    document.getElementById("monstro-cena").src = monstro.iconeMapa;
    circulosParaAcertar = 4;
    tempoRestante = 10;
    document.getElementById("alvo-container").innerHTML = "";
    document.getElementById("timer-progresso").style.width = "100%";
    
    for(let i=0; i<4; i++) {
        let alvo = document.createElement("div");
        alvo.className = "alvo-circulo";
        alvo.style.top = (25 + Math.random() * 50) + "%";
        alvo.style.left = (25 + Math.random() * 50) + "%";
        document.getElementById("alvo-container").appendChild(alvo);
    }
    timerInterval = setInterval(() => {
        tempoRestante -= 0.1;
        document.getElementById("segundos").innerText = Math.ceil(tempoRestante);
        document.getElementById("timer-progresso").style.width = (tempoRestante * 10) + "%";
        if(tempoRestante <= 0) finalizarMinigame(false);
    }, 100);
    miraInterval = setInterval(() => {
        let mira = document.getElementById("mira-vermelha");
        mira.style.top = (10 + Math.random() * 80) + "%";
        mira.style.left = (10 + Math.random() * 80) + "%";
    }, 400);
}

function verificarAcerto() {
    let mira = document.getElementById("mira-vermelha");
    let alvos = document.querySelectorAll(".alvo-circulo:not(.atingido)");
    let rectMira = mira.getBoundingClientRect();
    let centroMiraX = rectMira.left + (rectMira.width / 2);
    let centroMiraY = rectMira.top + (rectMira.height / 2);

    alvos.forEach(alvo => {
        let rectAlvo = alvo.getBoundingClientRect();
        let centroAlvoX = rectAlvo.left + (rectAlvo.width / 2);
        let centroAlvoY = rectAlvo.top + (rectAlvo.height / 2);
        let dist = Math.sqrt(Math.pow(centroMiraX - centroAlvoX, 2) + Math.pow(centroMiraY - centroAlvoY, 2));
        if(dist < 45) { 
            alvo.classList.add("atingido");
            circulosParaAcertar--;
            mira.style.borderColor = "#00ff00";
            setTimeout(() => { mira.style.borderColor = "#ff5555"; }, 200);
            if(circulosParaAcertar <= 0) finalizarMinigame(true);
        }
    });
}

function finalizarMinigame(vitoria) {
    clearInterval(timerInterval);
    clearInterval(miraInterval);
    
    // O monstro é removido do mapa pela função criarMarcadorMonstro agora
    
    if(vitoria) {
        mostrarMensagemScanner("SINCRONIZAÇÃO COMPLETA!");
        setTimeout(() => {
            document.getElementById("tela-minigame").style.display = "none";
            gerarDNA(monstroAtual.id);
            abrirDetalheCarta(monstroAtual.nome, monstroAtual.tribo, monstroAtual.cartaBlank, "monstro");
        }, 1500);
    } else {
        mostrarMensagemScanner("SINAL PERDIDO - A CRIATURA FUGIU!");
        setTimeout(() => {
            document.getElementById("tela-minigame").style.display = "none";
            document.getElementById("tela-mapa").style.display = "flex";
        }, 2000);
    }
}

// ==========================================
// 4. LÓGICA DO RADAR, BIOMAS E SPAWN (ESTILO POKÉMON GO)
// ==========================================

let marcadoresMonstros = [];
let ultimaLatSpawn = 0;
let ultimaLonSpawn = 0;

// Calcula a distância real em metros entre duas coordenadas (Fórmula de Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Raio da Terra em metros
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Retorna em metros
}

function criarMarcadorMonstro(latM, lonM, sorteado, ehPassivo = false) {
    let icone = L.icon({ iconUrl: sorteado.iconeMapa, iconSize: [45, 45], iconAnchor: [22, 22] });
    
    let novoMarcador = L.marker([latM, lonM], { 
        icon: icone, 
        opacity: ehPassivo ? 0.8 : 1.0 
    }).addTo(mapaScanner);
    
    novoMarcador.on('click', () => {
        // === NOVA TRAVA DE DISTÂNCIA ===
        if (marcadorJogador) {
            let posJogador = marcadorJogador.getLatLng();
            let distancia = calcularDistancia(posJogador.lat, posJogador.lng, latM, lonM);
            
            // 100 é o raio do seu círculo azul. Se estiver maior, bloqueia!
            if (distancia > 1000) { // 🛠️ FIX: Agora trava em 100 metros cravados!
                mostrarMensagemScanner(`FORA DE ALCANCE! Ande mais ${Math.ceil(distancia - 100)}m para escanear.`);
                return; // Aborta a função e impede o minigame de abrir
            }
        }
        // ===============================

        iniciarMinigame(sorteado);
        mapaScanner.removeLayer(novoMarcador);
        marcadoresMonstros = marcadoresMonstros.filter(m => m !== novoMarcador);
    });
    
    marcadoresMonstros.push(novoMarcador);
}

// ==========================================
// SISTEMA DE LOOT: BAÚS E MUGICS (VISUAIS UPGRADED)
// ==========================================

// Servidor CDN Público liberado para Desenvolvedores (Estilo 3D)
const IMG_BAU_TEXTURIZADO = "https://img.icons8.com/fluency/96/treasure-chest.png";
const IMG_MUGIC_TEXTURIZADO = "https://img.icons8.com/fluency/96/musical-notes.png";

window.criarMarcadorItem = function(latM, lonM, tipoNode) {
    // Usamos L.icon com as imagens externas para alta qualidade visual
    let iconeItem = L.icon({
        iconUrl: tipoNode === 'bau' ? IMG_BAU_TEXTURIZADO : IMG_MUGIC_TEXTURIZADO,
        iconSize: [45, 45], 
        iconAnchor: [22, 22],
        popupAnchor: [1, -34],
        className: tipoNode === 'bau' ? 'icone-bau-glow' : 'icone-mugic-glow'
    });

    let novoMarcador = L.marker([latM, lonM], { icon: iconeItem }).addTo(mapaScanner);
    
    // Adicionamos animação de pulso e contorno via CSS
    if (!document.getElementById('css-icones-loot')) {
        let style = document.createElement('style');
        style.id = 'css-icones-loot';
        style.innerHTML = `
            .icone-bau-glow { filter: drop-shadow(0 0 5px #ff5555) drop-shadow(0 0 10px #ff5555); transition: 0.2s; }
            .icone-mugic-glow { filter: drop-shadow(0 0 5px #00ffff) drop-shadow(0 0 10px #00ffff); transition: 0.2s; }
            .icone-bau-glow:hover, .icone-mugic-glow:hover { transform: scale(1.15) rotate(5deg); }
        `;
        document.head.appendChild(style);
    }

    novoMarcador.on('click', () => {
        // Trava de Distância (Você tem que estar a menos de 100m)
        if (marcadorJogador) {
            let pos = marcadorJogador.getLatLng();
            let dist = calcularDistancia(pos.lat, pos.lng, latM, lonM);
            if (dist > 1000) { // 🛠️ FIX: Agora baús também exigem 100 metros!
                mostrarMensagemScanner(`FORA DE ALCANCE! Aproxime-se mais ${Math.ceil(dist - 100)}m.`);
                return;
            }
        }

        // Abre o Node!
        if (tipoNode === 'bau') {
            abrirBauDeLoot();
            mapaScanner.removeLayer(novoMarcador);
        } else if (tipoNode === 'mugic') {
            // Em breve: abriremos o Mini-game de Música aqui!
            // Por enquanto, já dá a magia direto.
            abrirLootMugic();
            mapaScanner.removeLayer(novoMarcador);
        }
    });

    marcadoresMonstros.push(novoMarcador); // Usa a mesma lista para ser apagado quando andar
}

// ==========================================
// O MOTOR CINEMÁTICO DE DROP DO BAÚ
// ==========================================
function abrirBauDeLoot() {
    tocarSFX('bau');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]); 
    
    // 1. O Sorteador de Destino (Calcula o loot primeiro)
    let qtdItens = Math.floor(Math.random() * 6) + 1; 
    let lootGanho = [];

    for (let i = 0; i < qtdItens; i++) {
        let sorteioCategoria = Math.random();
        let categoriaAlvo = [];
        
        if (sorteioCategoria < 0.50) categoriaAlvo = typeof LOCAIS_DB !== 'undefined' ? LOCAIS_DB : [];
        else if (sorteioCategoria < 0.80) categoriaAlvo = typeof ATAQUES !== 'undefined' ? ATAQUES : [];
        else categoriaAlvo = typeof EQUIPAMENTOS !== 'undefined' ? EQUIPAMENTOS : [];
        
        if (categoriaAlvo.length === 0) categoriaAlvo = typeof LOCAIS_DB !== 'undefined' ? LOCAIS_DB : [];
        if (categoriaAlvo.length === 0) continue; 

        let sorteioRaridade = Math.random();
        let itensPossiveis = categoriaAlvo.filter(item => item.raridade >= sorteioRaridade);
        let itemSorteado = itensPossiveis.length > 0 ? itensPossiveis[Math.floor(Math.random() * itensPossiveis.length)] : categoriaAlvo[0]; 
            
        lootGanho.push(itemSorteado);
    }
    
    if (lootGanho.length === 0) { mostrarMensagemScanner("O Baú estava vazio..."); return; }

    // 2. Constrói a Tela de Animação do Baú (Só cria se não existir)
    if (!document.getElementById("modal-bau-animado")) {
        let modalCSS = document.createElement('style');
        modalCSS.innerHTML = `
            @keyframes shakeLoot { 0%{transform:rotate(0deg);} 25%{transform:rotate(-15deg) scale(1.1);} 50%{transform:rotate(15deg) scale(1.1);} 75%{transform:rotate(-15deg) scale(1.1);} 100%{transform:rotate(0deg) scale(1);} }
            .shaking-bau { animation: shakeLoot 0.3s infinite; }
            @keyframes popInCard { 0%{transform:scale(0); opacity:0;} 80%{transform:scale(1.1); opacity:1;} 100%{transform:scale(1); opacity:1;} }
            .pop-card { animation: popInCard 0.4s ease-out forwards; }
        `;
        document.head.appendChild(modalCSS);

        let modal = document.createElement("div");
        modal.id = "modal-bau-animado";
        modal.style.cssText = "display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,10,0,0.95); z-index:9999; flex-direction:column; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;";
        document.getElementById("tela-jogo").appendChild(modal);
    }

    let modal = document.getElementById("modal-bau-animado");
    modal.style.display = "flex";
    
    // Reseta o visual para a animação inicial
    modal.innerHTML = `
        <p id="titulo-bau" style="color:#ffd700; font-weight:bold; font-size:16px; margin-bottom:20px; text-shadow: 0 0 10px #ffd700; letter-spacing: 2px;">DECODIFICANDO BAÚ...</p>
        <img id="img-bau-animacao" class="shaking-bau" src="https://img.icons8.com/fluency/96/treasure-chest.png" style="width:120px; height:120px; filter:drop-shadow(0 0 20px #ffd700);">
        <div id="grid-loot" style="display:none; flex-wrap:wrap; justify-content:center; gap:15px; margin-top:30px; width:100%; max-height:280px; overflow-y:auto;"></div>
        <button id="btn-coletar-bau" style="display:none; margin-top:30px; background:#4CAF50; color:#000; font-weight:bold; border:2px solid #2e7d32; padding:12px 30px; border-radius:8px; cursor:pointer; font-size:14px; box-shadow:0 0 15px #4CAF50;">COLETAR TUDO</button>
    `;

    // 3. A Mágica: Treme por 2 segundos e depois revela as cartas!
    setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(200); // Batida forte ao abrir
        document.getElementById("img-bau-animacao").classList.remove("shaking-bau");
        document.getElementById("img-bau-animacao").src = "https://img.icons8.com/fluency/96/open-box.png"; // Muda a foto para baú aberto
        document.getElementById("titulo-bau").innerText = "LOOT ENCONTRADO!";
        document.getElementById("titulo-bau").style.color = "#4CAF50";
        
        let grid = document.getElementById("grid-loot");
        grid.style.display = "flex";
        grid.innerHTML = "";
        
        // Faz cada carta "pular" na tela uma de cada vez (staggering effect)
        lootGanho.forEach((item, index) => {
            let delay = index * 200; // Atrasa o pulo de cada carta em 200ms
            let corBorda = item.tipoCarta === 'Local' ? '#00ccff' : '#ff5555';
            if(item.tipoCarta === 'Equipamento') corBorda = '#ffd700';
            
            grid.innerHTML += `
                <div class="pop-card" style="display:flex; flex-direction:column; align-items:center; width:80px; opacity:0; animation-delay:${delay}ms;">
                    <img src="${item.img}" style="width:75px; border-radius:5px; border:2px solid ${corBorda}; box-shadow: 0 0 10px ${corBorda};">
                    <p style="color:#fff; font-size:9px; text-align:center; margin-top:5px; font-weight:bold; line-height:1.2;">${item.nome}</p>
                </div>
            `;
        });

        let btnColetar = document.getElementById("btn-coletar-bau");
        btnColetar.style.display = "block";
        btnColetar.onclick = () => {
            // Guarda no inventário usando nosso empilhador de quantidades
            lootGanho.forEach((itemSorteado, i) => {
                let itemExistente = window.inventario.find(c => c.nome === itemSorteado.nome && c.tipoCarta === itemSorteado.tipoCarta);
                if (itemExistente) itemExistente.quantidade = (itemExistente.quantidade || 1) + 1;
                else {
                    let novo = {...itemSorteado}; novo.id = Date.now() + i; novo.quantidade = 1;
                    window.inventario.push(novo);
                }
            });
            salvarAlbumNaNuvem();
            modal.style.display = "none"; // Fecha a tela
            mostrarMensagemScanner("ITENS ARMAZENADOS NO ÁLBUM!");
        };
    }, 1800); 
}

// ==========================================
// O NOVO MINIGAME DE MUGIC: "SINTONIA DE RITMO" (HARD MODE)
// ==========================================
let loopSintoniaMugic;

function abrirLootMugic() {
    mudarMusicaFundo('minigameMugic');
    if (typeof MAGIAS === 'undefined' || MAGIAS.length === 0) { mostrarMensagemScanner("Banco de Magias Vazio!"); return; }
    
    if (!document.getElementById("modal-mugic-mini")) {
        let modal = document.createElement("div");
        modal.id = "modal-mugic-mini";
        modal.style.cssText = "display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,20,30,0.98); z-index:9999; flex-direction:column; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;";
        document.getElementById("tela-jogo").appendChild(modal);
    }

    let modal = document.getElementById("modal-mugic-mini");
    modal.style.display = "flex";
    
    // Variáveis do modo Hard!
    let acertosAtuais = 0;
    let targetWidth = 18; // Barra verde mais fina (18% da tela)
    let targetPos = Math.floor(Math.random() * (100 - targetWidth)); // Posição inicial aleatória
    let gameAtivo = true;
    let pos = 0;
    let dir = 2.5; // Velocidade inicial do cursor

    modal.innerHTML = `
        <img src="https://img.icons8.com/fluency/96/musical-notes.png" style="width:70px; margin-bottom:20px; filter:drop-shadow(0 0 15px #00ffff);">
        <p id="titulo-mugic" style="color:#00ffff; font-weight:bold; font-size:18px; margin-bottom:5px; text-shadow: 0 0 10px #00ffff; text-align:center; letter-spacing: 1px;">SINTONIA MUGIC</p>
        <p id="sub-mugic" style="color:#aaa; font-size:11px; margin-bottom:30px; text-align:center; width:80%;">ACERTOS: <span id="contador-acertos" style="color:#0f0; font-weight:bold; font-size:14px;">0/3</span><br>Toque quando o cursor passar no verde!</p>
        
        <div style="width:90%; height:40px; background:#111; border:2px solid #00ffff; border-radius:20px; position:relative; overflow:hidden; box-shadow: inset 0 0 15px #000;">
            <div id="zona-verde-mugic" style="position:absolute; top:0; left:${targetPos}%; width:${targetWidth}%; height:100%; background:rgba(0,255,0,0.4); border-left:3px solid #0f0; border-right:3px solid #0f0; transition: left 0.15s ease-in-out;"></div>
            <div id="cursor-mugic" style="position:absolute; top:0; left:0%; width:15px; height:100%; background:#fff; box-shadow:0 0 15px #fff; border-radius:5px;"></div>
        </div>
        
        <div id="resultado-mugic" style="margin-top:30px; display:none; flex-direction:column; align-items:center;">
            <img id="img-magia-ganha" src="" style="width:90px; border-radius:5px; border:3px solid #00ffff; box-shadow:0 0 20px #00ffff;">
            <p id="nome-magia-ganha" style="color:#fff; font-size:14px; margin-top:10px; font-weight:bold; letter-spacing: 1px;"></p>
        </div>
        
        <button id="btn-sair-mugic" style="display:none; margin-top:25px; background:#00ffff; color:#000; font-weight:bold; border:none; padding:12px 30px; border-radius:8px; cursor:pointer; font-size:14px; box-shadow:0 0 15px #00ffff;">GUARDAR CÓDIGO</button>
    `;

    let cursor = document.getElementById("cursor-mugic");
    let zonaVerde = document.getElementById("zona-verde-mugic");
    let contador = document.getElementById("contador-acertos");

    clearInterval(loopSintoniaMugic);
    loopSintoniaMugic = setInterval(() => {
        if (!gameAtivo) return;
        pos += dir;
        if (pos >= 95) dir = -Math.abs(dir); // Bateu na direita
        if (pos <= 0) dir = Math.abs(dir);   // Bateu na esquerda
        cursor.style.left = pos + "%";
    }, 16);

    modal.onclick = function(e) {
        if (e.target.id === 'btn-sair-mugic') return; 
        if (!gameAtivo) return;
        
        let margemErro = 1; // Folga mínima de 1% para não ser injusto
        
        // Verifica se clicou dentro da Zona Verde
        if (pos >= (targetPos - margemErro) && pos <= (targetPos + targetWidth + margemErro)) {
            // ACERTOU O BEAT!
            acertosAtuais++;
            contador.innerText = acertosAtuais + "/3";
            cursor.style.background = "#0f0"; // Pisca verde
            setTimeout(() => { if(gameAtivo) cursor.style.background = "#fff"; }, 150);

            if (acertosAtuais >= 3) {
                // VITÓRIA FINAL (Cumpriu os 3 acertos)
                gameAtivo = false;
                clearInterval(loopSintoniaMugic);
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                
                document.getElementById("titulo-mugic").innerText = "SINTONIA PERFEITA!";
                document.getElementById("titulo-mugic").style.color = "#0f0";
                document.getElementById("sub-mugic").style.display = "none";
                zonaVerde.style.display = "none"; // Some a barrinha

                // Roda a roleta e dá o Loot
                let sorteioRaridade = Math.random();
                let magiasPossiveis = MAGIAS.filter(item => item.raridade >= sorteioRaridade);
                let magiaSorteada = magiasPossiveis.length > 0 ? magiasPossiveis[Math.floor(Math.random() * magiasPossiveis.length)] : MAGIAS[0];
                
                document.getElementById("img-magia-ganha").src = magiaSorteada.img;
                document.getElementById("nome-magia-ganha").innerText = magiaSorteada.nome;
                document.getElementById("resultado-mugic").style.display = "flex";
                
                let btn = document.getElementById("btn-sair-mugic");
                btn.style.display = "block";
                btn.onclick = () => {
                    let itemExistente = window.inventario.find(c => c.nome === magiaSorteada.nome && c.tipoCarta === "Magia");
                    if (itemExistente) itemExistente.quantidade = (itemExistente.quantidade || 1) + 1;
                    else { let novo = {...magiaSorteada}; novo.id = Date.now(); novo.quantidade = 1; window.inventario.push(novo); }
                    
                    salvarAlbumNaNuvem();
                    modal.style.display = "none";
                    mostrarMensagemScanner("MAGIA SALVA NO ÁLBUM!");
                };

            } else {
                // PASSOU DE FASE (Muda a zona de lugar e acelera o cursor)
                if (navigator.vibrate) navigator.vibrate(50);
                targetPos = Math.floor(Math.random() * (100 - targetWidth)); // Sorteia novo local
                zonaVerde.style.left = targetPos + "%";
                dir = dir > 0 ? dir + 0.8 : dir - 0.8; // Acelera a bolinha para ficar mais difícil!
            }

        } else {
            // ERROU O TEMPO! GAME OVER
            gameAtivo = false;
            clearInterval(loopSintoniaMugic);
            cursor.style.background = "#f00"; // Fica vermelho
            if (navigator.vibrate) navigator.vibrate(400); 
            
            document.getElementById("titulo-mugic").innerText = "SINAL PERDIDO...";
            document.getElementById("titulo-mugic").style.color = "#f00";
            document.getElementById("sub-mugic").innerHTML = "Você não conseguiu captar a frequência.<br>Acertos: " + acertosAtuais;
            document.getElementById("sub-mugic").style.color = "#ff5555";
            
            setTimeout(() => {
                modal.style.display = "none";
            }, 2500);
        }
    };
}

window.spawnMonstrosNaArea = function(lat, lon, forcarPassivo = false) {
    // Trava de segurança inicial
    if (typeof MONSTROS === 'undefined' || MONSTROS.length === 0) return;

    // 1. Acha as regras oficiais deste Local no banco de dados
    let regrasLocal = typeof LOCAIS_DB !== 'undefined' ? LOCAIS_DB.find(l => l.nome === localParaViagem) : null;
    let triboRegra = regrasLocal ? regrasLocal.triboNativa : "Qualquer";
    let elementoRegra = regrasLocal ? (regrasLocal.elementoNativo || null) : null;

    // 2. O FILTRO INTELIGENTE E RARIDADE: Checa o Bioma e já coloca bilhetes pela Raridade Padrão!
    let listaFiltrada = [];
    if (typeof MONSTROS !== 'undefined') {
        MONSTROS.forEach(m => {
            let triboOK = (triboRegra === "Qualquer" || m.tribo === triboRegra);
            let elementoOK = (!elementoRegra || (m.elementos && m.elementos.includes(elementoRegra)));
            
            if (triboOK && elementoOK) {
                // Multiplica a raridade (ex: 0.8) por 10 para virar quantidade de bilhetes (8 bilhetes)
                let qtdBilhetes = Math.max(1, Math.floor((m.raridade || 0.5) * 10));
                for (let i = 0; i < qtdBilhetes; i++) {
                    listaFiltrada.push(m);
                }
            }
        });
    }

    // 🚀 3. SISTEMA DE NINHO (BOOST DE SPAWN): Injeta bilhetes extras SE for um evento/ninho!
    if (regrasLocal && regrasLocal.boostSpawn) {
        regrasLocal.boostSpawn.forEach(boost => {
            let monstroBoost = MONSTROS.find(m => m.nome === boost.nome);
            if (monstroBoost) {
                // Coloca várias cópias do monstro na listaFiltrada dependendo do "peso"
                for (let i = 0; i < boost.peso; i++) {
                    listaFiltrada.push(monstroBoost);
                }
            }
        });
    }



    let agora = new Date();
    // CORREÇÃO: Transforma o nome do local e a hora em um NÚMERO REAL para a matemática não dar zero
    let textoSemente = localParaViagem + agora.getDate() + agora.getHours();
    let sementeBase = 0;
    for (let k = 0; k < textoSemente.length; k++) {
        sementeBase = Math.imul(31, sementeBase) + textoSemente.charCodeAt(k) | 0;
    }
    sementeBase = Math.abs(sementeBase); // Garante que seja positivo
    
    // 1. SPAWN FIXO (Estilo "Ninho" e "Escala Regional Balanceada")
    if (forcarPassivo === false) {
        marcadoresMonstros.forEach(m => mapaScanner.removeLayer(m));
        marcadoresMonstros = [];

        // 🛠️ FIX: Reduzido para 15 itens no mapa, para não poluir a tela (Vibe Pokémon GO).
        for (let i = 0; i < 15; i++) {
            let sementeUnica = sementeBase + (i * 150); 
            
            // 🛠️ FIX: Multiplicador 0.008 espalha os itens de forma realista (aprox. 800m a 1km)
            let offLat = (sementeRandom(sementeUnica + 200) - 0.5) * 0.008;
            let offLon = (sementeRandom(sementeUnica + 300) - 0.5) * 0.008;
            
            let roletaTipo = sementeRandom(sementeUnica + 400); // Rola de 0.0 a 1.0
            
            if (roletaTipo < 0.2) {
                // 20% de chance de ser um Baú
                criarMarcadorItem(lat + offLat, lon + offLon, 'bau');
            } else if (roletaTipo < 0.3) {
                // 10% de chance de ser um Símbolo Mugic
                criarMarcadorItem(lat + offLat, lon + offLon, 'mugic');
            } else if (listaFiltrada.length > 0) {
                // 70% de chance de ser Criatura, MAS SÓ SPAWNA se existir alguma criatura compatível com o local!
                let indexMonstro = Math.floor(sementeRandom(sementeUnica) * listaFiltrada.length);
                const sorteado = listaFiltrada[indexMonstro];
                criarMarcadorMonstro(lat + offLat, lon + offLon, sorteado, false);
            }
        }
    }

    // 2. SPAWN PASSIVO (Estilo "Caminhada" - Só para você)
    // Só vai piscar monstro na sua tela se o local tiver monstros nativos!
    if (forcarPassivo && listaFiltrada.length > 0) {
        // 💡 FIX: A Urna (listaFiltrada) já está com os bilhetes certos de raridade! É só sortear um!
        const sorteadoPassivo = listaFiltrada[Math.floor(Math.random() * listaFiltrada.length)];

        // Aparece colado em você (aprox. 30 metros)
        let offLat = (Math.random() - 0.5) * 0.0003;
        let offLon = (Math.random() - 0.5) * 0.0003;
        
        criarMarcadorMonstro(lat + offLat, lon + offLon, sorteadoPassivo, true);
        
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        tocarSFX('spawn');
        mostrarMensagemScanner("⚠️ UMA CRIATURA SELVAGEM APARECEU!");
    }
}
// ==========================================
// 4. LÓGICA DO RADAR, CÂMERA LIVRE E GIROSCÓPIO
// ==========================================
let seguirJogador = true; // Controla se o mapa segue você ou não

// Função para ler a Bússola do celular e girar a Seta
function lidarComGiroscopio(event) {
    let angulo = 0;
    // iOS usa webkitCompassHeading, Android usa alpha
    if (event.webkitCompassHeading) {
        angulo = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
        // O Android inverte os graus, precisamos calcular o oposto
        angulo = Math.abs(event.alpha - 360); 
    }

    // Acha a Seta no mapa e aplica o giro em tempo real!
    let seta = document.getElementById("icone-seta-jogador");
    if (seta) {
        seta.style.transform = `rotate(${angulo}deg)`;
    }
}

window.iniciarGPS = function() {
    document.getElementById("tela-detalhe-carta").style.display = "none";
    document.getElementById("painel-viagem").style.display = "none";
    document.getElementById("tela-mapa").style.display = "flex";
    document.getElementById("painel-botoes-fisicos").style.display = "flex";

    document.getElementById("texto-carregando").style.display = "block";
    document.getElementById("meu-mapa").style.display = "none";

    let tempoUltimoSpawn = Date.now();
    seguirJogador = true; // Ao abrir o mapa, ele foca em você

    // Pede permissão para usar o Giroscópio (Obrigatório para segurança dos iPhones novos)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(permissionState => {
            if (permissionState === 'granted') {
                window.addEventListener('deviceorientation', lidarComGiroscopio);
            }
        }).catch(console.error);
    } else {
        // Ativação para Android e aparelhos comuns
        window.addEventListener('deviceorientationabsolute', lidarComGiroscopio);
        window.addEventListener('deviceorientation', lidarComGiroscopio);
    }

    watchID = navigator.geolocation.watchPosition((pos) => {
        let lat = pos.coords.latitude; 
        let lon = pos.coords.longitude;

        // 📡 TRANSMITINDO SINAL PARA A NUVEM: Avisa seus amigos exatamente onde você está!
        update(ref(db, 'jogadores/' + uid + '/posicao'), { lat: lat, lon: lon, local: localParaViagem, online: Date.now() });

        document.getElementById("texto-carregando").style.display = "none";
        document.getElementById("meu-mapa").style.display = "block";
        document.getElementById("btn-sair-radar").style.display = "block";

        if (!mapaScanner) {
            // Inicia o mapa
            mapaScanner = L.map('meu-mapa', { zoomControl: false }).setView([lat, lon], 17);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapaScanner);
            
            // 🛑 SISTEMA DE CÂMERA LIVRE: Se arrastar o mapa, solta a trava!
            mapaScanner.on('dragstart', () => {
                seguirJogador = false;
                let btnCentro = document.getElementById("btn-recentralizar");
                if(btnCentro) btnCentro.style.display = "flex"; // Mostra o botão de voltar
            });

            // Cria o botão de Recentralizar (Fica escondido até você puxar o mapa)
            let btnCentro = document.createElement("button");
            btnCentro.id = "btn-recentralizar";
            btnCentro.innerHTML = "📍";
            btnCentro.style = "display: none; position: absolute; bottom: 20px; right: 20px; z-index: 1000; background: #111; color: #4CAF50; border: 2px solid #4CAF50; border-radius: 50%; width: 45px; height: 45px; font-size: 20px; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 0 15px rgba(0,0,0,0.8);";
            btnCentro.onclick = () => {
                seguirJogador = true;
                if(marcadorJogador) mapaScanner.flyTo(marcadorJogador.getLatLng(), 17);
                btnCentro.style.display = "none";
            };
            document.getElementById("tela-mapa").appendChild(btnCentro);
            
            // Círculo Azul de Alcance
            let corRadar = triboLocalParaViagem === "Azul" ? "#00ccff" : "#ff3300"; 
            // 🛠️ FIX: Raio ajustado para 100 metros (alcance realista de GPS)
            circuloRadar = L.circle([lat, lon], { color: corRadar, radius: 1000, fillOpacity: 0.1 }).addTo(mapaScanner);
            
            // 🧭 NOVA SETA 3D VETORIAL
            const svgSeta = `<svg viewBox="0 0 100 100" id="icone-seta-jogador" style="width: 100%; height: 100%; transform: rotate(0deg); transform-origin: center; transition: transform 0.1s ease-out;"><polygon points="50,5 90,90 50,70 10,90" fill="#ff3300" stroke="#fff" stroke-width="3" filter="drop-shadow(0px 4px 4px rgba(0,0,0,0.5))"/></svg>`;
            
            let divIconSeta = L.divIcon({
                html: svgSeta,
                className: '', // Vazio para não bugar o fundo
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            marcadorJogador = L.marker([lat, lon], { icon: divIconSeta }).addTo(mapaScanner);
            
spawnMonstrosNaArea(lat, lon, false);
            ultimaLatSpawn = lat;
            ultimaLonSpawn = lon;
            
            // 🛰️ LIGANDO O RASTREADOR DE ALIADOS NO MAPA!
            if (typeof window.rastrearAmigos === "undefined") {
                window.marcadoresAmigos = {}; // Cofre para guardar as fotinhas deles
                window.rastrearAmigos = function() {
                    amigos.forEach(amigo => {
                        onValue(ref(db, 'jogadores/' + amigo.uid + '/posicao'), (snap) => {
                            if (!snap.exists()) return;
                            let posAmigo = snap.val();
                            
                            // Se o amigo mudou de mapa ou desligou o radar (sinal mais velho que 5 minutos) -> SOME DO MAPA!
                            if (posAmigo.local !== localParaViagem || (Date.now() - posAmigo.online > 300000)) {
                                if (window.marcadoresAmigos[amigo.uid]) {
                                    mapaScanner.removeLayer(window.marcadoresAmigos[amigo.uid]);
                                    delete window.marcadoresAmigos[amigo.uid];
                                }
                                return;
                            }
                            
                            // Se ele está no mesmo mapa e ativo, DESENHA O AVATAR DELE!
                            if (!window.marcadoresAmigos[amigo.uid]) {
                                let avatarAmigo = amigo.avatar.startsWith("http") || amigo.avatar.startsWith("data:") 
                                    ? `<div style="width:35px; height:35px; background-image:url('${amigo.avatar}'); background-size:cover; border-radius:50%; border:2px solid #ffd700; box-shadow: 0 0 15px #ffd700;"></div>`
                                    : `<div style="width:35px; height:35px; background:#111; color:#ffd700; display:flex; align-items:center; justify-content:center; border-radius:50%; border:2px solid #ffd700; font-size:18px;">${amigo.avatar}</div>`;
                                
                                let iconeAmigo = L.divIcon({ html: avatarAmigo, className: '', iconSize: [35,35], iconAnchor: [17,17] });
                                window.marcadoresAmigos[amigo.uid] = L.marker([posAmigo.lat, posAmigo.lon], { icon: iconeAmigo }).addTo(mapaScanner);
                            } else {
                                // Se ele já está desenhado, só empurra ele pra onde ele andou!
                                window.marcadoresAmigos[amigo.uid].setLatLng([posAmigo.lat, posAmigo.lon]);
                            }
                        });
                    });
                };
                window.rastrearAmigos(); // Liga o drone!
            }

        } else {
            marcadorJogador.setLatLng([lat, lon]);
            circuloRadar.setLatLng([lat, lon]);
            
            // Só move a câmera para você se a Trava não foi quebrada arrastando
            if (seguirJogador) {
                mapaScanner.panTo([lat, lon]);
            }
            
            let distanciaAndada = calcularDistancia(ultimaLatSpawn, ultimaLonSpawn, lat, lon);
            let tempoPassado = Date.now() - tempoUltimoSpawn;

            if (distanciaAndada > 50 || tempoPassado > 60000) {
                spawnMonstrosNaArea(lat, lon, true); 
                ultimaLatSpawn = lat;
                ultimaLonSpawn = lon;
                tempoUltimoSpawn = Date.now();
            }
        }
    }, (err) => {
        console.error("Erro no GPS: ", err);
        mostrarMensagemScanner("SINAL DE GPS FRACO!");
    }, {
        enableHighAccuracy: true, 
        maximumAge: 10000, 
        timeout: 30000 // 🛠️ FIX: Aumentamos a paciência do radar para 30 segundos!
    });
};

function escanearLocalAtual() {
    let localExistente = inventario.find(c => c.nome === localParaViagem && c.tipoCarta === "Local");
    if (localExistente) {
        localExistente.quantidade = (localExistente.quantidade || 1) + 1;
    } else {
        let novoLocal = {
            id: Date.now(), 
            nome: localParaViagem, 
            tribo: triboLocalParaViagem || "Qualquer", 
            tipoCarta: "Local", 
            img: imgLocalParaViagem, 
            favorito: false, 
            quantidade: 1, 
            stats: { c: "-", p: "-", s: "-", v: "-", e: "-" } 
        };
        inventario.push(novoLocal);
    }
    salvarAlbumNaNuvem();
    
    let mapaTela = document.getElementById("tela-mapa");
    mapaTela.style.boxShadow = "inset 0 0 50px #4CAF50";
    setTimeout(() => { mapaTela.style.boxShadow = "none"; }, 500);
    
    mostrarMensagemScanner("LOCAL ESCANEADO E SALVO!");
}

// ==========================================
// DESCONEXÃO DO GPS E SAÍDA DO RADAR
// ==========================================
let btnSairRadar = document.getElementById("btn-sair-radar");
if (btnSairRadar) {
    btnSairRadar.onclick = () => {
        if (typeof watchID !== 'undefined' && watchID !== null) {
            navigator.geolocation.clearWatch(watchID);
            console.log("Sinal de GPS encerrado pelo Scanner.");
            
            // 📡 AVISA A NUVEM QUE VOCÊ SAIU DO RADAR (Pra você sumir do mapa dos seus amigos)
            update(ref(db, 'jogadores/' + uid + '/posicao'), { online: 0 });
        }
        location.reload();
    };
}

// ==========================================
// 6. SISTEMA DE MENU E ÁLBUM
// ==========================================

function abrirAlbum() {
    document.getElementById("tela-menu").style.display = "none";
    let telaAlbum = document.getElementById("tela-album");
    if(telaAlbum) {
        telaAlbum.style.display = "flex";
        
        // CORREÇÃO: Religa os botões físicos que foram apagados na inspeção!
        document.getElementById("painel-botoes-fisicos").style.display = "flex";
        
        window.modoMenu = false;
        renderizarListaAlbum(); 
    }
}

document.getElementById("filtro-nome").addEventListener("input", renderizarListaAlbum);
document.getElementById("filtro-tribo").addEventListener("change", renderizarListaAlbum);
document.getElementById("filtro-tipo").addEventListener("change", renderizarListaAlbum); 

function renderizarListaAlbum() {
    const lista = document.getElementById("lista-cartas");
    lista.innerHTML = ""; 
    let termo = document.getElementById("filtro-nome").value.toLowerCase();
    let triboFiltro = document.getElementById("filtro-tribo").value;
    let tipoFiltro = document.getElementById("filtro-tipo").value;

    let filtrados = inventario.filter(item => {
        let bateNome = item.nome.toLowerCase().includes(termo);
        let bateTribo = triboFiltro === "Todas" || (item.tribo && item.tribo === triboFiltro);
        let tipoDaCarta = item.tipoCarta || "Criatura";
        let bateTipo = tipoFiltro === "Todas" || tipoDaCarta === tipoFiltro;
        return bateNome && bateTribo && bateTipo;
    });

    if (filtrados.length === 0) {
        lista.innerHTML = "<p style='font-size: 10px; color: #666; text-align:center; padding: 20px;'>Nenhuma carta encontrada...</p>";
        return;
    }

    filtrados.forEach((item) => {
        let div = document.createElement("div");
        div.style = "background: #112211; border: 1px solid #4CAF50; padding: 8px; border-radius: 8px; display: flex; align-items: center; gap: 10px; position: relative; margin-bottom: 8px;";
        let estrela = item.favorito ? "⭐" : "☆";
        let corEstrela = item.favorito ? "#ffd700" : "#4CAF50";
        let qtd = item.quantidade || 1;
        let detalhesCarta = "";
        
        // A NOVA REGRA VISUAL: Ele sabe quem tem Status e quem tem Quantidade!
        let tipoParaEmpilhar = ["Local", "Magia", "Ataque", "Equipamento"];
        
        if (tipoParaEmpilhar.includes(item.tipoCarta)) {
            // Cartas empilháveis mostram a Quantidade
            detalhesCarta = `<div style="font-size: 10px; color: #4CAF50; margin-top: 4px;">TIPO: ${item.tipoCarta.toUpperCase()}<br><span style="font-weight: bold; color: white;">CÓPIAS NO DECK: ${qtd}</span></div>`;
        } else {
            // Criaturas mostram os Status únicos de DNA
            detalhesCarta = `<div style="font-size: 8.5px; color: #4CAF50; line-height: 1.3;">Energia: ${item.stats.e} | Coragem: ${item.stats.c}<br>Poder: ${item.stats.p} | Sabedoria: ${item.stats.s}<br>Velocidade: ${item.stats.v}</div>`;
        }

        div.innerHTML = `
            <div style="position: absolute; top: 8px; right: 10px; font-size: 16px; cursor: pointer; color: ${corEstrela};" onclick="toggleFavorito(${item.id}, event)">${estrela}</div>
            <img src="${item.img}" style="width: 50px; border-radius: 4px; cursor: pointer;" onclick="verCartaAlbum(${item.id})">
            <div style="text-align: left; cursor: pointer; flex: 1;" onclick="verCartaAlbum(${item.id})">
                <b style="font-size: 13px; color: #fff; display: block; margin-bottom: 4px;">${item.nome}</b>
                ${detalhesCarta}
            </div>
        `;
        lista.appendChild(div);
    });
}

window.toggleFavorito = function(id, event) {
    event.stopPropagation(); 
    let carta = inventario.find(c => c.id === id);
    if(carta) {
        carta.favorito = !carta.favorito;
        salvarAlbumNaNuvem(); 
        renderizarListaAlbum(); 
    }
}

window.verCartaAlbum = function(id) {
    let carta = inventario.find(c => c.id === id);
    if(!carta) return;
    cartaVisualizadaId = id; 
    
    // 💡 O NOVO INTERCEPTADOR: Se estiver montando deck, manda o ID pra Oficina!
    if (window.slotSelecionadoAtual !== null) {
        if (typeof window.interceptarMontagemDeck === "function") {
            window.interceptarMontagemDeck(id);
        }
        return; // Para aqui, não abre a inspeção preta!
    }

    abrirDetalheCarta(carta.nome, carta.tribo, carta.img, "album");
    
    // 🔥 AQUI VOLTAM OS STATUS ORIGINAIS E SOME A REGRA B BUGADA! 🔥
    if (carta.tipoCarta !== "Criatura") {
        document.getElementById("camada-stats").style.display = "none";
    } else {
        document.getElementById("camada-stats").style.display = "block";
        if(carta.stats) {
            document.getElementById("stat-coragem").innerText = carta.stats.c || "-";
            document.getElementById("stat-poder").innerText = carta.stats.p || "-";
            document.getElementById("stat-sabedoria").innerText = carta.stats.s || "-";
            document.getElementById("stat-velocidade").innerText = carta.stats.v || "-";
            document.getElementById("stat-energia").innerText = carta.stats.e || "-";
        }
    }
}

let btnVoltarAlbum = document.getElementById('btn-voltar-album');
if(btnVoltarAlbum) {
    btnVoltarAlbum.onclick = () => {
        // Se estava escolhendo carta pro Deck, cancela e volta pra Oficina
        if (window.slotSelecionadoAtual !== null) {
            window.slotSelecionadoAtual = null; // Limpa a memória
            document.getElementById('tela-album').style.display = 'none';
            document.getElementById('tela-decks').style.display = 'flex';
            
            let tituloAlbum = document.querySelector('#tela-album .titulo-tela');
            if(tituloAlbum) tituloAlbum.innerText = "MINHA COLEÇÃO";
        } 
        // Se era só uma visita normal ao álbum, volta pro Menu Principal
        else {
            document.getElementById('tela-album').style.display = 'none';
            document.getElementById('tela-menu').style.display = 'flex';
            
            // CORREÇÃO AQUI: Religa os botões do menu!
            window.modoMenu = true; 
        }
    };
}

// ==========================================
// 7. SISTEMA DE PERFIL DO JOGADOR
// ==========================================
function abrirPerfil() {
    document.getElementById("tela-menu").style.display = "none";
    document.getElementById("tela-perfil").style.display = "flex";
    window.modoMenu = false;

    document.getElementById("nome-jogador").innerText = perfilJogador.nome + " ✏️";
    
    let hashId = 0; 
    for(let i=0; i<perfilJogador.nome.length; i++) hashId += perfilJogador.nome.charCodeAt(i);
    document.getElementById("id-jogador").innerText = "#" + (hashId * 7).toString().padStart(4, '0').substring(0,4);

    let avatarBox = document.getElementById("avatar-jogador");
    if(perfilJogador.avatar.startsWith("http") || perfilJogador.avatar.startsWith("data:image")) {
        avatarBox.innerHTML = "";
        avatarBox.style.backgroundImage = `url('${perfilJogador.avatar}')`;
    } else {
        avatarBox.style.backgroundImage = "none";
        avatarBox.innerHTML = perfilJogador.avatar;
    }

    document.getElementById("stat-vitorias").innerText = perfilJogador.vitorias;
    document.getElementById("stat-derrotas").innerText = perfilJogador.derrotas;

    let totalCartas = 0, totalCriaturas = 0, totalLocais = 0;
    let totalMagias = 0, totalEquips = 0, totalAtaques = 0;
    let contagemTribos = {};

    inventario.forEach(item => {
        let qtd = item.quantidade || 1;
        totalCartas += qtd;
        
        let tipo = item.tipoCarta || "Criatura";
        if(tipo === "Criatura") totalCriaturas += qtd;
        if(tipo === "Local") totalLocais += qtd;
        if(tipo === "Magia") totalMagias += qtd;
        if(tipo === "Equipamento") totalEquips += qtd;
        if(tipo === "Ataque") totalAtaques += qtd;
        
        if(item.tribo) {
            contagemTribos[item.tribo] = (contagemTribos[item.tribo] || 0) + qtd;
        }
    });

    let triboDominante = "NENHUMA";
    let max = 0;
    for(let tribo in contagemTribos) {
        if(contagemTribos[tribo] > max) {
            max = contagemTribos[tribo];
            triboDominante = tribo.toUpperCase();
        }
    }

    document.getElementById("estatisticas-perfil").innerHTML = `
        <div class="perfil-stats-grid">
            <div class="stat-box">Cartas Totais<span>${totalCartas}</span></div>
            <div class="stat-box">Afinidade<span>${triboDominante}</span></div>
            <div class="stat-box">Criaturas<span>${totalCriaturas}</span></div>
            <div class="stat-box">Locais<span>${totalLocais}</span></div>
            <div class="stat-box">Ataques<span>${totalAtaques}</span></div>
            <div class="stat-box">Magias<span>${totalMagias}</span></div>
            <div class="stat-box">Equips<span>${totalEquips}</span></div>
        </div>
    `;
}

document.getElementById("upload-foto").addEventListener("change", function(event) {
    let file = event.target.files[0];
    if(!file) return;

    let reader = new FileReader();
    reader.onload = function(e) {
        let img = new Image();
        img.onload = function() {
            let canvas = document.createElement("canvas");
            let MAX_WIDTH = 150;
            let MAX_HEIGHT = 150;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
                if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            }

            canvas.width = width; canvas.height = height;
            let ctxCanvas = canvas.getContext("2d");
            ctxCanvas.drawImage(img, 0, 0, width, height);

            let base64Comprimido = canvas.toDataURL("image/jpeg", 0.7);
            document.getElementById("input-novo-avatar").value = base64Comprimido;
            mostrarMensagemScanner("FOTO CARREGADA E COMPRIMIDA!");
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
});

window.abrirModalPerfil = function() {
    document.getElementById("input-novo-nome").value = perfilJogador.nome;
    if(perfilJogador.avatar.startsWith("http") || perfilJogador.avatar.startsWith("data:image")) {
        document.getElementById("input-novo-avatar").value = "";
    } else {
        document.getElementById("input-novo-avatar").value = perfilJogador.avatar === "👤" ? "" : perfilJogador.avatar;
    }
    document.getElementById("modal-editar-perfil").style.display = "flex";
}

window.fecharModalPerfil = function() {
    document.getElementById("modal-editar-perfil").style.display = "none";
}

window.salvarEdicaoPerfil = function() {
    let nNome = document.getElementById("input-novo-nome").value.trim();
    let nAvatar = document.getElementById("input-novo-avatar").value.trim();
    
    if(nNome !== "") perfilJogador.nome = nNome;
    if(nAvatar !== "") perfilJogador.avatar = nAvatar;
    else if (perfilJogador.avatar === "") perfilJogador.avatar = "👤"; 
    
    salvarPerfilNaNuvem(); // Correção: Agora salva os dados de perfil corretamente
    fecharModalPerfil();
    abrirPerfil(); 
}

let btnVoltarPerfil = document.getElementById("btn-voltar-perfil");
if(btnVoltarPerfil) { btnVoltarPerfil.onclick = () => location.reload(); }

// ==========================================
// 8. REDE SOCIAL E TROCAS (EASTER EGG JOHNES)
// ==========================================
function abrirSocial() {
    // 1. MODO LIMPEZA TOTAL: Desliga TODAS as outras telas antes de abrir a Social
    document.getElementById("tela-menu").style.display = "none";
    document.getElementById("tela-mapa").style.display = "none";
    document.getElementById("tela-locais").style.display = "none";
    document.getElementById("tela-album").style.display = "none";
    document.getElementById("tela-perfil").style.display = "none";
    document.getElementById("tela-minigame").style.display = "none";
    document.getElementById("painel-viagem").style.display = "none";

    // 2. LIGA SÓ A TELA SOCIAL
    document.getElementById("tela-social").style.display = "flex";
    document.getElementById("painel-botoes-fisicos").style.display = "flex";
    
    window.modoMenu = false;
    renderizarAmigos();
}

window.adicionarAmigo = function() {
    let busca = document.getElementById("input-add-amigo").value.trim();
    if(busca.length < 3) { mostrarMensagemScanner("DIGITE UM NOME OU ID VÁLIDO!"); return; }

    // ==========================================
    // 🥚 EASTER EGG: CÓDIGO SECRETO JOHNES MAX
    // ==========================================
    if (busca.toUpperCase() === "#JOHNES") {
        let johnesBase = typeof MONSTROS !== 'undefined' ? MONSTROS.find(m => m.nome === "Johnes") : null;
        if (johnesBase) {
            let johnesMax = {
                id: Date.now(), 
                nome: johnesBase.nome + " (Max)", // Adiciona um selo especial no nome
                tribo: johnesBase.tribo, 
                tipoCarta: "Criatura", 
                img: johnesBase.cartaBlank, 
                favorito: true, // Já vem favoritado por ser épico!
                quantidade: 1,
                stats: {
                    c: johnesBase.statsMax.coragem, 
                    p: johnesBase.statsMax.poder,
                    s: johnesBase.statsMax.sabedoria, 
                    v: johnesBase.statsMax.velocidade, 
                    e: johnesBase.statsMax.energia
                }
            };
            window.inventario.push(johnesMax);
            salvarAlbumNaNuvem();
            document.getElementById("input-add-amigo").value = "";
            mostrarMensagemScanner("EASTER EGG: JOHNES FULL STATUS DESBLOQUEADO!");
            return; // Aborta a busca na nuvem, pois era um código secreto!
        }
    }
    // ==========================================

    document.getElementById("input-add-amigo").value = "Buscando na Nuvem...";

    // Vai na nuvem procurar todos os jogadores
    get(ref(db, 'jogadores')).then((snapshot) => {
        document.getElementById("input-add-amigo").value = "";
        
        if (snapshot.exists()) {
            let todosJogadores = snapshot.val();
            let jogadorEncontrado = null;
            let uidEncontrado = null;
            
            // Verifica se o jogador digitou um ID (começa com # e não é o Easter Egg)
            let isBuscaPorID = busca.startsWith("#");

            // Varredura no banco de dados
            for (let idNuvem in todosJogadores) {
                let jog = todosJogadores[idNuvem];
                
                if (isBuscaPorID) {
                    let hashId = 0;
                    for(let i=0; i<jog.nome.length; i++) hashId += jog.nome.charCodeAt(i);
                    let idVisual = "#" + (hashId * 7).toString().padStart(4, '0').substring(0,4);
                    
                    if (idVisual === busca) {
                        jogadorEncontrado = jog;
                        uidEncontrado = idNuvem;
                        break; 
                    }
                } else {
                    if (jog.nome.toLowerCase() === busca.toLowerCase()) {
                        jogadorEncontrado = jog;
                        uidEncontrado = idNuvem;
                        break; 
                    }
                }
            }

            if (jogadorEncontrado) {
                if (uidEncontrado === uid) { mostrarMensagemScanner("NÃO PODE ADICIONAR A SI MESMO!"); return; }
                
                let jaAmigo = amigos.find(a => a.uid === uidEncontrado);
                if (jaAmigo) { mostrarMensagemScanner("JÁ ESTÁ NA SUA LISTA!"); return; }

                // Cria a "carta de solicitação" para enviar
                let meuPedido = {
                    uid: uid, 
                    nome: perfilJogador.nome,
                    avatar: perfilJogador.avatar
                };

                // Envia direto para a "caixa de entrada" do amigo
                set(ref(db, 'jogadores/' + uidEncontrado + '/pedidos/' + uid), meuPedido)
                    .then(() => mostrarMensagemScanner("PEDIDO ENVIADO PARA " + jogadorEncontrado.nome.toUpperCase() + "!"));
            } else {
                mostrarMensagemScanner("SINAL PERDIDO! JOGADOR OU ID NÃO ENCONTRADO.");
            }
        }
    }).catch(error => {
        document.getElementById("input-add-amigo").value = "";
        mostrarMensagemScanner("ERRO DE CONEXÃO NO RADAR!");
    });
}

function renderizarAmigos() {
    let lista = document.getElementById("lista-amigos"); 
    lista.innerHTML = "";

    // 1. PRIMEIRO: Renderiza os pedidos de amizade pendentes (se alguém te adicionou)
    if (window.pedidosAmizade) {
        for (let idPedido in window.pedidosAmizade) {
            let remetente = window.pedidosAmizade[idPedido];
            let divPedido = document.createElement("div"); 
            divPedido.className = "amigo-item";
            divPedido.style.border = "2px dashed #ffd700"; // Borda dourada para destacar
            
            // O Avatar real (se for imagem URL ou emoji)
            let avatarHTML = remetente.avatar.startsWith("http") || remetente.avatar.startsWith("data:") 
                ? `<div class="amigo-avatar" style="background-image: url('${remetente.avatar}'); background-size: cover; background-position: center; color: transparent;">.</div>`
                : `<div class="amigo-avatar">${remetente.avatar}</div>`;

            divPedido.innerHTML = `
                <div class="amigo-info">
                    ${avatarHTML}
                    <div>
                        <div class="amigo-nome" style="color: #ffd700;">${remetente.nome}</div>
                        <div class="amigo-id">Quer ser seu amigo!</div>
                    </div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-trocar" style="background: #e53935; color: #fff; font-weight: bold; padding: 6px 12px; border-radius: 5px; border:none; cursor: pointer; font-size: 10px;" onclick="recusarAmigo('${idPedido}')">RECUSAR</button>
                    <button class="btn-trocar" style="background: #ffd700; color: #000; font-weight: bold; padding: 6px 12px; border-radius: 5px; border:none; cursor: pointer; font-size: 10px;" onclick="aceitarAmigo('${idPedido}', '${remetente.nome}', '${remetente.avatar}')">ACEITAR</button>
                </div>
            `;
            lista.appendChild(divPedido);
        }
    }

    // 2. DEPOIS: Renderiza os amigos que já estão na sua lista
    if(amigos.length === 0 && !window.pedidosAmizade) { 
        lista.innerHTML = "<p style='color:#666; font-size:10px; margin-top: 20px;'>Nenhum sinal no Radar...</p>"; 
        return; 
    }
    
    amigos.forEach((amigo, i) => {
        let div = document.createElement("div"); 
        div.className = "amigo-item";
        
        let avatarHTML = amigo.avatar.startsWith("http") || amigo.avatar.startsWith("data:") 
            ? `<div class="amigo-avatar" style="background-image: url('${amigo.avatar}'); background-size: cover; background-position: center; color: transparent;">.</div>`
            : `<div class="amigo-avatar">${amigo.avatar}</div>`;

        div.innerHTML = `
            <div class="amigo-info" style="cursor: pointer;" onclick="mostrarPerfilDoAmigo(${i})">
                ${avatarHTML}
                <div>
                    <div class="amigo-nome">${amigo.nome}</div>
                    <div class="amigo-id">Status: Online 🟢</div>
                </div>
            </div>
            <div style="display: flex; gap: 5px;">
                <button class="btn-trocar" style="background: #e53935; color: #fff; font-weight: bold; padding: 6px 8px; border-radius: 5px; border:none; cursor: pointer; font-size: 10px;" onclick="excluirAmigo(${i})">X</button>
                <button class="btn-trocar" style="background: #4CAF50; color: #000; font-weight: bold; padding: 6px 12px; border-radius: 5px; border:none; cursor: pointer; font-size: 10px;" onclick="iniciarTroca(${i})">TROCAR</button>
            </div>
        `;
        lista.appendChild(div);
    });
}

// Função para quando você clica em RECUSAR o convite
window.recusarAmigo = function(uidAmigo) {
    // Apenas apaga o pedido da sua "caixa de entrada" sem adicionar à lista
    set(ref(db, 'jogadores/' + uid + '/pedidos/' + uidAmigo), null);
    mostrarMensagemScanner("SINAL REJEITADO.");
}

// Função para quando você clica em ACEITAR o convite
window.aceitarAmigo = function(uidAmigo, nomeAmigo, avatarAmigo) {
    // 1. Adiciona ele na sua lista
    amigos.push({ uid: uidAmigo, nome: nomeAmigo, avatar: avatarAmigo });
    salvarAmigosNaNuvem();

    // 2. Apaga o pedido da sua "caixa de entrada"
    set(ref(db, 'jogadores/' + uid + '/pedidos/' + uidAmigo), null);

    // 3. (Opcional) Adiciona você na lista dele automaticamente!
    get(ref(db, 'jogadores/' + uidAmigo + '/amigos')).then((snap) => {
        let amigosDele = snap.exists() ? snap.val() : [];
        amigosDele.push({ uid: uid, nome: perfilJogador.nome, avatar: perfilJogador.avatar });
        set(ref(db, 'jogadores/' + uidAmigo + '/amigos'), amigosDele);
    });

    mostrarMensagemScanner(nomeAmigo.toUpperCase() + " AGORA É SEU ALIADO!");
}

// Função para EXCLUIR o amigo da lista
window.excluirAmigo = function(index) {
    let amigoRemovido = amigos[index];
    amigos.splice(index, 1); // Remove da sua lista local
    salvarAmigosNaNuvem();   // Atualiza a nuvem
    
    // Remove você da lista do seu amigo também (Corte definitivo)
    get(ref(db, 'jogadores/' + amigoRemovido.uid + '/amigos')).then((snap) => {
        if (snap.exists()) {
            let amigosDele = snap.val();
            let novaListaDele = amigosDele.filter(a => a.uid !== uid);
            set(ref(db, 'jogadores/' + amigoRemovido.uid + '/amigos'), novaListaDele);
        }
    });
    
    mostrarMensagemScanner("CONEXÃO COM " + amigoRemovido.nome.toUpperCase() + " CORTADA!");
    renderizarAmigos();
}

// Função para ver o perfil do amigo em tempo real!
window.mostrarPerfilDoAmigo = function(index) {
    let amigo = amigos[index];
    mostrarMensagemScanner("Acessando dados de " + amigo.nome.toUpperCase() + "...");
    
    // Conecta na pasta pessoal do amigo na nuvem
    get(ref(db, 'jogadores/' + amigo.uid)).then((snapshot) => {
        if (snapshot.exists()) {
            let dadosAmigo = snapshot.val();
            
            // Preenche o nome
            document.getElementById("nome-amigo-modal").innerText = dadosAmigo.nome;
            
            // Preenche o Avatar (suporta Emojis e Fotos com compressão)
            let avatarBox = document.getElementById("avatar-amigo-modal");
            if (dadosAmigo.avatar && (dadosAmigo.avatar.startsWith("http") || dadosAmigo.avatar.startsWith("data:"))) {
                avatarBox.innerHTML = "";
                avatarBox.style.backgroundImage = `url('${dadosAmigo.avatar}')`;
            } else {
                avatarBox.style.backgroundImage = "none";
                avatarBox.innerHTML = dadosAmigo.avatar || "👤";
            }

            // Preenche as estatísticas de batalha
            document.getElementById("vitorias-amigo-modal").innerText = dadosAmigo.vitorias || 0;
            document.getElementById("derrotas-amigo-modal").innerText = dadosAmigo.derrotas || 0;
            
            // Exibe a tela hacker!
            document.getElementById("modal-perfil-amigo").style.display = "flex";
            
        } else {
            mostrarMensagemScanner("SINAL PERDIDO! Dados corrompidos.");
        }
    }).catch(error => {
        mostrarMensagemScanner("ERRO DE COMUNICAÇÃO NO RADAR!");
    });
}

// O botão de fechar a inspeção
window.fecharPerfilAmigo = function() {
    document.getElementById("modal-perfil-amigo").style.display = "none";
}

// Cria a sala e chama o amigo
window.iniciarTroca = function(index) {
    amigoAtualTroca = amigos[index];
    let salaId = uid + "_" + amigoAtualTroca.uid; // ID único da sala
    
    mostrarMensagemScanner("CHAMANDO " + amigoAtualTroca.nome.toUpperCase() + "...");

    // Cria a sala no servidor
    set(ref(db, 'salas_troca/' + salaId), {
        p1: { uid: uid, nome: perfilJogador.nome, carta: null, pronto: false },
        p2: { uid: amigoAtualTroca.uid, nome: amigoAtualTroca.nome, carta: null, pronto: false },
        status: "aberta"
    });

    // Envia o "toca o telefone" pro celular do amigo
    set(ref(db, 'jogadores/' + amigoAtualTroca.uid + '/chamada_troca'), {
        de: uid, nome: perfilJogador.nome, salaId: salaId
    });

    entrarNaSalaDeTroca(salaId, true, amigoAtualTroca.uid, amigoAtualTroca.nome);
}

window.trocaEmAndamento = false; // O Cadeado Global

function entrarNaSalaDeTroca(salaId, isP1, idAmigo, nomeAmigo) {
    mudarMusicaFundo('lobby');
    salaTrocaAtual = salaId;
    souP1 = isP1;
    minhaCartaOfertada = null;
    cartaSimuladaAmigo = null;
    window.trocaEmAndamento = false; // Destranca o cadeado ao entrar

    document.getElementById("nome-troca-amigo").innerText = "Lobby com " + nomeAmigo;
    document.getElementById("modal-troca").style.display = "flex";
    
    document.getElementById("slot-minha-carta").style.backgroundImage = "none";
    document.getElementById("slot-minha-carta").innerHTML = "+";
    document.getElementById("slot-carta-amigo").style.backgroundImage = "none";
    document.getElementById("slot-carta-amigo").innerHTML = "?";
    
    let btnConf = document.getElementById("btn-confirmar-troca");
    btnConf.disabled = true;
    btnConf.innerText = "CONFIRMAR";
    btnConf.style.background = "#555"; btnConf.style.color = "#222";

    onValue(ref(db, 'salas_troca/' + salaId), (snapshot) => {
        if (!snapshot.exists()) {
            if (document.getElementById("modal-troca").style.display === "flex") {
                fecharTroca();
                mostrarMensagemScanner("A SALA DE TROCA FOI FECHADA.");
            }
            return;
        }

        let sala = snapshot.val();
        
        if (sala.status === "concluida") {
            mostrarMensagemScanner("TROCA ÉPICA CONCLUÍDA!");
            fecharTroca();
            return;
        }

        if (sala.status === "ocupado" && isP1) {
            mostrarMensagemScanner("O JOGADOR PEDIU PARA ESPERAR!");
            fecharTroca();
            return;
        }
        if (sala.status === "recusado" && isP1) {
            mostrarMensagemScanner("O JOGADOR RECUSOU A TROCA.");
            fecharTroca();
            return;
        }

        let meusDados = isP1 ? sala.p1 : sala.p2;
        let dadosAmigo = isP1 ? sala.p2 : sala.p1;

        let slotAmigo = document.getElementById("slot-carta-amigo");
        slotAmigo.style.position = "relative";
        slotAmigo.onclick = null; 
        
        if (dadosAmigo.carta) {
            cartaSimuladaAmigo = dadosAmigo.carta;
            slotAmigo.innerHTML = `<div style="position:absolute; top: -8px; right: -8px; background: #000; border: 1px solid #4CAF50; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; z-index: 10;">🔍</div>`;
            slotAmigo.style.backgroundImage = `url('${dadosAmigo.carta.img}')`;
            slotAmigo.style.backgroundSize = "cover";
            slotAmigo.style.cursor = "pointer";
            slotAmigo.onclick = () => inspecionarCartaTroca(cartaSimuladaAmigo);
            
        } else {
            slotAmigo.innerHTML = "?";
            slotAmigo.style.backgroundImage = "none";
            slotAmigo.style.cursor = "default";
            cartaSimuladaAmigo = null;
        }

        // CADEADO ATIVADO: Só roda a matemática UMA VEZ!
        if (sala.p1.pronto && sala.p2.pronto && isP1 && sala.status === "aberta" && !window.trocaEmAndamento) {
            window.trocaEmAndamento = true; // Tranca a porta!
            executarTrocaFinal(sala);
        }
    });
}
// Função para Inspecionar Cartas dentro do Lobby de Troca
window.inspecionarCartaTroca = function(carta) {
    if(!carta) return;
    abrirDetalheCarta(carta.nome, carta.tribo, carta.img, "inspecao_troca");
    
    if (carta.tipoCarta === "Local") {
        document.getElementById("camada-stats").style.display = "none";
    } else {
        document.getElementById("camada-stats").style.display = "block";
        document.getElementById("stat-coragem").innerText = carta.stats.c;
        document.getElementById("stat-poder").innerText = carta.stats.p;
        document.getElementById("stat-sabedoria").innerText = carta.stats.s;
        document.getElementById("stat-velocidade").innerText = carta.stats.v;
        document.getElementById("stat-energia").innerText = carta.stats.e;
    }
}


// Quando você clica no [+] para escolher a sua carta
window.abrirSelecaoTroca = function() {
    document.getElementById("modal-selecao-troca").style.display = "flex";
    let lista = document.getElementById("lista-cartas-troca"); 
    lista.innerHTML = "";
    
    let disponiveis = inventario.filter(c => !c.favorito); 
    if(disponiveis.length === 0) { lista.innerHTML = "<p style='color:#ff5555; font-size:10px; text-align:center;'>Nenhuma carta disponível.</p>"; return; }

    disponiveis.forEach(item => {
        let div = document.createElement("div");
        div.style = "background: #111; border: 1px solid #ff5555; padding: 5px; display: flex; align-items: center; gap: 10px; cursor: pointer;";
        div.onclick = () => selecionarMinhaCartaTroca(item.id);
        
        let qtd = item.quantidade || 1;
        let detalhesCarta = "";
        
        // Puxa os stats para mostrar na tela de escolha!
        if (item.tipoCarta === "Local") {
            detalhesCarta = `<div style="font-size: 9px; color: #4CAF50; margin-top: 2px;">TIPO: LOCAL | CÓPIAS: ${qtd}</div>`;
        } else {
            detalhesCarta = `<div style="font-size: 8px; color: #4CAF50; line-height: 1.2; margin-top: 2px;">E:${item.stats.e} | C:${item.stats.c} | P:${item.stats.p} | S:${item.stats.s} | V:${item.stats.v}</div>`;
        }

        div.innerHTML = `
            <img src="${item.img}" style="width: 40px; border-radius: 3px;">
            <div style="text-align: left; flex: 1;">
                <span style="color: white; font-size: 11px; font-weight: bold;">${item.nome}</span>
                ${detalhesCarta}
            </div>
        `;
        lista.appendChild(div);
    });
}

// Quando você escolhe a carta, ela vai para a nuvem na hora!
window.selecionarMinhaCartaTroca = function(idCarta) {
    minhaCartaOfertada = inventario.find(c => c.id === idCarta);
    
    let slot = document.getElementById("slot-minha-carta");
    slot.style.position = "relative";
    
    // Adiciona uma Lupa no canto. Clicar nela inspeciona a carta!
    slot.innerHTML = `<div onclick="event.stopPropagation(); inspecionarCartaTroca(minhaCartaOfertada)" style="position:absolute; top: -8px; right: -8px; background: #000; border: 1px solid #ff5555; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; z-index: 10;">🔍</div>`;
    
    slot.style.backgroundImage = `url('${minhaCartaOfertada.img}')`;
    slot.style.backgroundSize = "cover";
    
    let jogadorKey = souP1 ? 'p1' : 'p2';
    update(ref(db, 'salas_troca/' + salaTrocaAtual + '/' + jogadorKey), { carta: minhaCartaOfertada });
    
    let btnConf = document.getElementById("btn-confirmar-troca");
    btnConf.disabled = false;
    btnConf.style.background = "#4CAF50"; btnConf.style.color = "#000";
    
    fecharSelecaoTroca();
}

window.confirmarTroca = function() {
    if(!minhaCartaOfertada || !cartaSimuladaAmigo) {
        mostrarMensagemScanner("Aguarde a oferta do outro escaneador!"); return;
    }
    
    // Avisa a sala que você está pronto
    let jogadorKey = souP1 ? 'p1' : 'p2';
    update(ref(db, 'salas_troca/' + salaTrocaAtual + '/' + jogadorKey), { pronto: true });
    
    let btnConf = document.getElementById("btn-confirmar-troca");
    btnConf.innerText = "AGUARDANDO O OUTRO...";
    btnConf.disabled = true;
    btnConf.style.background = "#ffd700";
}

function executarTrocaFinal(sala) {
    update(ref(db, 'salas_troca/' + salaTrocaAtual), { status: "processando" });

    // A REGRA DE OURO: Quais cartas podem ser empilhadas? (Tudo, menos Criatura!)
    const podeEmpilhar = (tipo) => ["Local", "Magia", "Ataque", "Equipamento"].includes(tipo);

    // Puxa o álbum do Amigo (P2)
    get(ref(db, 'jogadores/' + sala.p2.uid + '/album')).then(snap2 => {
        let albumAmigo = snap2.exists() ? snap2.val() : [];

        // 1. REMOVE A CARTA DO AMIGO (P2) DA NUVEM DELE
        let c2Index = albumAmigo.findIndex(c => c.id === sala.p2.carta.id);
        if(c2Index > -1) {
            if(albumAmigo[c2Index].quantidade > 1) { albumAmigo[c2Index].quantidade--; }
            else { albumAmigo.splice(c2Index, 1); }
        }

        // 2. REMOVE A SUA CARTA (P1) DA SUA NUVEM
        let meuAlbum = [...window.inventario]; 
        let c1Index = meuAlbum.findIndex(c => c.id === sala.p1.carta.id);
        if(c1Index > -1) {
            if(meuAlbum[c1Index].quantidade > 1) { meuAlbum[c1Index].quantidade--; }
            else { meuAlbum.splice(c1Index, 1); }
        }

        // 3. DÁ A SUA CARTA PARA O AMIGO (P2)
        if (podeEmpilhar(sala.p1.carta.tipoCarta)) {
            // Procura se o amigo já tem essa carta específica
            let cartaExistente = albumAmigo.find(c => c.nome === sala.p1.carta.nome && c.tipoCarta === sala.p1.carta.tipoCarta);
            if (cartaExistente) { cartaExistente.quantidade = (cartaExistente.quantidade || 1) + 1; }
            else {
                let nova = {...sala.p1.carta}; nova.id = Date.now() + 10; nova.quantidade = 1; albumAmigo.push(nova);
            }
        } else {
            // É criatura, então cria uma única com DNA/Stats próprios
            let nova = {...sala.p1.carta}; nova.id = Date.now() + 10; nova.quantidade = 1; albumAmigo.push(nova);
        }

        // 4. DÁ A CARTA DO AMIGO PARA VOCÊ (P1)
        if (podeEmpilhar(sala.p2.carta.tipoCarta)) {
            // Procura se você já tem essa carta específica
            let cartaExistente = meuAlbum.find(c => c.nome === sala.p2.carta.nome && c.tipoCarta === sala.p2.carta.tipoCarta);
            if (cartaExistente) { cartaExistente.quantidade = (cartaExistente.quantidade || 1) + 1; }
            else {
                let nova = {...sala.p2.carta}; nova.id = Date.now() + 20; nova.quantidade = 1; meuAlbum.push(nova);
            }
        } else {
            // É criatura, então cria uma única com DNA/Stats próprios
            let nova = {...sala.p2.carta}; nova.id = Date.now() + 20; nova.quantidade = 1; meuAlbum.push(nova);
        }

        // SALVA AS DUAS CONTAS NA NUVEM!
        set(ref(db, 'jogadores/' + sala.p2.uid + '/album'), albumAmigo); 
        window.inventario = meuAlbum; 
        salvarAlbumNaNuvem(); 

        // ENCERRA E DESTRÓI A SALA
        update(ref(db, 'salas_troca/' + salaTrocaAtual), { status: "concluida" });
        setTimeout(() => {
            remove(ref(db, 'salas_troca/' + salaTrocaAtual));
            window.trocaEmAndamento = false; // Destranca a porta pro futuro
        }, 2000);
    });
}

window.fecharTroca = function() { 
    mudarMusicaFundo('menu');
    if(salaTrocaAtual && souP1) { remove(ref(db, 'salas_troca/' + salaTrocaAtual)); }
    salaTrocaAtual = null;
    window.trocaEmAndamento = false; // Garante o reset do cadeado
    document.getElementById("modal-troca").style.display = "none"; 
}

window.fecharSelecaoTroca = function() { document.getElementById("modal-selecao-troca").style.display = "none"; }

// Ativando o botão Voltar da Aba Social
let btnVoltarSocial = document.getElementById("btn-voltar-social");
if(btnVoltarSocial) { btnVoltarSocial.onclick = () => location.reload(); }

// ==========================================
// 9. CARROSSEL DINÂMICO E BOTÕES FÍSICOS
// ==========================================
let locaisDesbloqueados = [];
let indiceLocalAtual = 0;

// O Motor que constrói a tela de seleção de lugares
window.renderizarCarrosselLocais = function() {
    let locaisUnicos = {};
    window.inventario.forEach(item => {
        if (item.tipoCarta === "Local") {
            locaisUnicos[item.nome] = item;
        }
    });
    locaisDesbloqueados = Object.values(locaisUnicos);

    if (locaisDesbloqueados.length === 0) return;

    if (indiceLocalAtual >= locaisDesbloqueados.length) indiceLocalAtual = 0;
    if (indiceLocalAtual < 0) indiceLocalAtual = locaisDesbloqueados.length - 1;

    let localAtual = locaisDesbloqueados[indiceLocalAtual];

    let container = document.querySelector(".carrossel-cartas");
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
            <p style="color: #4CAF50; font-weight: bold; margin-bottom: 15px; font-size: 15px; text-shadow: 0 0 5px #000; text-align: center; font-family: monospace; letter-spacing: 1px;">
                ${localAtual.nome.toUpperCase()}
            </p>
            <div class="carta-local-real" onclick="abrirDetalheCarta('${localAtual.nome}', '${localAtual.tribo}', '${localAtual.img}', 'local')">
                <img src="${localAtual.img}" alt="Carta ${localAtual.nome}">
            </div>
        </div>
    `;
}

// Configura as setinhas verdes da tela de Locais
document.addEventListener("DOMContentLoaded", () => {
    let sEsq = document.getElementById("seta-esq-local");
    if(sEsq) {
        sEsq.onclick = () => {
            if (locaisDesbloqueados.length <= 1) { mostrarMensagemScanner("Nenhum outro local desbloqueado!"); return; }
            if (navigator.vibrate) navigator.vibrate(50);
            indiceLocalAtual--;
            renderizarCarrosselLocais();
        };
    }
    
    let sDir = document.getElementById("seta-dir-local");
    if(sDir) {
        sDir.onclick = () => {
            if (locaisDesbloqueados.length <= 1) { mostrarMensagemScanner("Nenhum outro local desbloqueado!"); return; }
            if (navigator.vibrate) navigator.vibrate(50);
            indiceLocalAtual++;
            renderizarCarrosselLocais();
        };
    }
    
    let vMenu = document.getElementById("btn-voltar-menu");
    if(vMenu) vMenu.onclick = () => location.reload();
});

let apps = document.querySelectorAll(".app-icone");
apps.forEach((app, index) => {
    app.onclick = function() {
        if (window.modoMenu) {
            indexSelecionado = index;
            atualizarSelecao();
            if (index === 0) {
                document.getElementById("tela-menu").style.display = "none";
                document.getElementById("tela-locais").style.display = "flex";
                window.modoMenu = false;
                renderizarCarrosselLocais(); 
            } else if (index === 1) {
                abrirAlbum();
            } else if (index === 2) {
                // ⚔️ ABRE O TABULEIRO DO DROME!
                document.getElementById("tela-menu").style.display = "none";
                window.abrirEntradaDrome();
                window.modoMenu = false;
            } else if (index === 3) {
                abrirSocial();
            } else if (index === 4) {
                abrirPerfil();
            } else if (index === 5) {
                abrirOficinaDecks(); // <--- NOSSA NOVA TELA AQUI!
            }
        }
    };
});



// A função que liga a tela e o botão de voltar da Oficina
window.abrirOficinaDecks = function() {
    document.getElementById("tela-menu").style.display = "none";
    document.getElementById("tela-decks").style.display = "flex";
    window.modoMenu = false;
    
    if(typeof mudarMusicaFundo === 'function') mudarMusicaFundo('menu'); 

    // 💡 GATILHO DE ABERTURA: Lê o MODO e o SLOT para carregar a pasta certa!
    let seletorModo = document.getElementById("seletor-modo-deck");
    let seletorSlot = Array.from(document.querySelectorAll('#tela-decks select')).find(s => s.innerHTML.includes('Slot'));
    
    if (seletorSlot && seletorModo) {
        let modo = seletorModo.value;
        let slotId = seletorSlot.value.toLowerCase().replace(/salvar no /g, '').replace(/ /g, '_');
        
        let idFogo = modo + "_" + slotId; // Cria a pasta secreta (ex: "6x6_slot_1")
        
        if (typeof window.carregarDeckDaNuvem === "function") {
            window.carregarDeckDaNuvem(idFogo);
        }
    }
};


// ==========================================
// 📚 LÓGICA DO MANUAL DE REGRAS (LIVRO ANIMADO)
// ==========================================

// Função para Abrir o Modal do Livro
window.abrirLivroRegras = function() {
    let modal = document.getElementById("modal-livro-regras");
    if(modal) {
        modal.classList.remove("escondido"); // Mostra o modal
        tocarSFX('notificacao'); // Toca o som de notificação (opcional)
        // Reinicia para a primeira página ao abrir
        let paginas = document.querySelectorAll(".pagina");
        paginas.forEach((p, index) => {
            p.classList.remove("pagina-ativa", "pagina-anterior");
            if(index === 0) p.classList.add("pagina-ativa");
            else p.classList.add("pagina-proxima");
        });
        window.paginaAtualLivro = 0; // Controla a página atual globalmente
    }
};

// Função para Fechar o Modal do Livro
window.fecharLivroRegras = function() {
    let modal = document.getElementById("modal-livro-regras");
    if(modal) {
        modal.classList.add("escondido"); // Esconde o modal
        mudarMusicaFundo('menu'); // Toca a música do menu (opcional)
    }
};

// Função Inteligente para Mudar Página
window.mudarPaginaLivro = function(direcao) {
    let paginas = document.querySelectorAll(".pagina");
    let numPaginas = paginas.length;
    let novaPagina = window.paginaAtualLivro + direcao;

    // Impede de ir além da primeira ou última página
    if(novaPagina < 0 || novaPagina >= numPaginas) return;

    // Aplica as classes CSS para animação de virada
    paginas.forEach((p, index) => {
        p.classList.remove("pagina-ativa", "pagina-anterior", "pagina-proxima");
        
        if(index === novaPagina) {
            p.classList.add("pagina-ativa"); // A página que está sendo lida
        } else if(index < novaPagina) {
            p.classList.add("pagina-anterior"); // Páginas que já foram viradas
        } else {
            p.classList.add("pagina-proxima"); // Páginas que ainda não foram lidas
        }
    });

    window.paginaAtualLivro = novaPagina; // Atualiza o índice da página atual
    tocarSFX('viajar'); // Toca o som de virar página (opcional, use o mesmo som de 'viajar')
};

// Adiciona os Ouvintes de Evento (onclick)
if(document.getElementById("btn-help-decks")) {
    document.getElementById("btn-help-decks").onclick = () => abrirLivroRegras();
}

if(document.getElementById("btn-close-livro")) {
    document.getElementById("btn-close-livro").onclick = () => fecharLivroRegras();
}

if(document.getElementById("btn-pagina-anterior")) {
    document.getElementById("btn-pagina-anterior").onclick = () => mudarPaginaLivro(-1);
}

if(document.getElementById("btn-pagina-proxima")) {
    document.getElementById("btn-pagina-proxima").onclick = () => mudarPaginaLivro(1);
}

// ==========================================
// ⚙️ LÓGICA DO TABULEIRO DE DECKS
// ==========================================

// 1. Botão de Sair (Corrigido o travamento do Menu!)
let btnSairOficina = document.getElementById("btn-voltar-decks");
if (btnSairOficina) {
    btnSairOficina.addEventListener("click", function() {
        document.getElementById("tela-decks").style.display = "none";
        document.getElementById("tela-menu").style.display = "flex";
        window.slotSelecionadoAtual = null; // Limpa a memória por segurança
        
        // 💡 A MÁGICA DO DESCONGELAMENTO: Religa os botões físicos do Scanner!
        window.modoMenu = true; 
    });
}
let seletorModo = document.getElementById("seletor-modo-deck");
if(seletorModo) {
    seletorModo.addEventListener("change", function() {
        let modo = this.value; // Pega o que você escolheu (6x6, 3x3 ou 1x1)
        
        let linha3 = document.querySelector(".linha-3"); // Fileira de trás (3 slots)
        let linha2 = document.querySelector(".linha-2"); // Fileira do meio (2 slots)
        let mugics = document.querySelectorAll(".slot-mugic-heptagono"); // Pega todos os 6 mugics

        // MODO 6x6 (Mostra tudo)
        if(modo === "6x6") {
            linha3.classList.remove("escondido");
            linha2.classList.remove("escondido");
            mugics.forEach(m => m.classList.remove("escondido"));
        } 
        // MODO 3x3 RÁPIDO (Referência 2-1)
        else if(modo === "3x3") {
            linha3.classList.add("escondido");   // Some com os 3 de trás
            linha2.classList.remove("escondido"); // Mantém os 2 do meio
            
            // Varre os Mugics e esconde os que passarem do número 3
            mugics.forEach((m, index) => {
                if(index >= 3) m.classList.add("escondido");
                else m.classList.remove("escondido");
            });
        } 
        // MODO 1x1 DUELO
        else if(modo === "1x1") {
            linha3.classList.add("escondido"); // Some com os 3 de trás
            linha2.classList.add("escondido"); // Some com os 2 do meio
            
            // Varre os Mugics e deixa apenas o PRIMEIRO
            mugics.forEach((m, index) => {
                if(index >= 1) m.classList.add("escondido");
                else m.classList.remove("escondido");
            });
        }
    });
}

function atualizarSelecao() {
    apps.forEach(app => app.classList.remove("app-selecionado"));
    if(apps[indexSelecionado]) apps[indexSelecionado].classList.add("app-selecionado");
}

document.getElementById("btn-escanear").onclick = function() {
    if (window.modoMenu) {
        if (indexSelecionado === 0) {
            document.getElementById("tela-menu").style.display = "none";
            document.getElementById("tela-locais").style.display = "flex";
            window.modoMenu = false;
            renderizarCarrosselLocais(); 
        } else if (indexSelecionado === 1) {
            abrirAlbum();
        } else if (indexSelecionado === 2) {
            // ⚔️ ABRE O TABULEIRO DO DROME PELO BOTÃO SCAN!
            document.getElementById("tela-menu").style.display = "none";
            window.abrirEntradaDrome();
            window.modoMenu = false;
        } else if (indexSelecionado === 3) {
            abrirSocial();
        } else if (indexSelecionado === 4) {
            abrirPerfil();
        } else if (indexSelecionado === 5) {
            abrirOficinaDecks(); 
        } else {
            mostrarMensagemScanner("Módulo em desenvolvimento...");
        }
    } else if (document.getElementById("tela-minigame") && document.getElementById("tela-minigame").style.display === "block") {
        verificarAcerto();
    } else if (document.getElementById("tela-mapa") && document.getElementById("tela-mapa").style.display === "flex") {
        escanearLocalAtual();
    }
};

document.getElementById("btn-dir").onclick = () => { 
    if(window.modoMenu && indexSelecionado < apps.length - 1) { indexSelecionado++; atualizarSelecao(); } 
};
document.getElementById("btn-esq").onclick = () => { 
    if(window.modoMenu && indexSelecionado > 0) { indexSelecionado--; atualizarSelecao(); } 
};

document.getElementById("btn-baixo").onclick = () => {
    let tAlbum = document.getElementById("lista-cartas");
    let tPerfil = document.getElementById("tela-perfil");
    let tSocial = document.getElementById("tela-social");
    if (document.getElementById("tela-album").style.display === "flex") tAlbum.scrollBy({ top: 50, behavior: 'smooth' });
    if (document.getElementById("tela-perfil").style.display === "flex") tPerfil.scrollBy({ top: 50, behavior: 'smooth' });
    if (document.getElementById("tela-social").style.display === "flex") tSocial.scrollBy({ top: 50, behavior: 'smooth' });
};

document.getElementById("btn-cima").onclick = () => {
    let tAlbum = document.getElementById("lista-cartas");
    let tPerfil = document.getElementById("tela-perfil");
    let tSocial = document.getElementById("tela-social");
    if (document.getElementById("tela-album").style.display === "flex") tAlbum.scrollBy({ top: -50, behavior: 'smooth' });
    if (document.getElementById("tela-perfil").style.display === "flex") tPerfil.scrollBy({ top: -50, behavior: 'smooth' });
    if (document.getElementById("tela-social").style.display === "flex") tSocial.scrollBy({ top: -50, behavior: 'smooth' });
};

atualizarSelecao();
// ==========================================
// ⚙️ MOTOR DA OFICINA DE DECKS (ID ÚNICO, NUVEM E GERENCIADOR VISUAL)
// ==========================================

// Cria o Novo Modal do Gerenciador Visual do Slot - Só roda uma vez
if (!document.getElementById("modal-hub-criatura")) {
    let m = document.createElement("div");
    m.id = "modal-hub-criatura";
    // Fundo mais escuro para as miniaturas brilharem
    m.style.cssText = "display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,10,10,0.95); z-index:9999; flex-direction:column; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;";
    
    m.innerHTML = `
        <div style="width: 100%; max-width: 340px; background: #000; border: 2px solid #00ffff; border-radius: 10px; padding: 15px; display: flex; flex-direction: column; align-items: center; gap: 20px; box-shadow: 0 0 30px rgba(0,255,255,0.4);">
            <h3 id="titulo-hub-criatura" style="color: #00ffff; text-align: center; margin: 0; font-family: monospace; font-size: 16px; letter-spacing: 1px;">GERENCIAR SLOT #</h3>
            
            <div style="display: flex; gap: 25px; align-items: center; justify-content: center;">
                
                <div id="mini-hub-criatura" style="width: 100px; height: 130px; background: #111; border: 2px solid #4CAF50; border-radius: 6px; cursor: pointer; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; position: relative; box-shadow: 0 0 15px rgba(76,175,80,0.5);">
                    <div class="empty-visual" style="color: #4CAF50; font-size: 30px; font-weight: bold;">+</div>
                    <div style="position: absolute; bottom: 3px; left: 0; width: 100%; text-align: center; color: #4CAF50; font-size: 9px; font-weight: bold; background: rgba(0,0,0,0.8); padding: 2px 0;">CRIATURA</div>
                </div>

                <div id="mini-hub-equip" style="width: 90px; height: 110px; background: #111; border: 2px solid #ffd700; border-radius: 6px; cursor: pointer; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; position: relative; box-shadow: 0 0 15px rgba(255,215,0,0.4);">
                    <div class="empty-visual" style="color: #ffd700; font-size: 30px; font-weight: bold;">+</div>
                    <div style="position: absolute; bottom: 3px; left: 0; width: 100%; text-align: center; color: #ffd700; font-size: 9px; font-weight: bold; background: rgba(0,0,0,0.8); padding: 2px 0;">EQUIP (1/1)</div>
                </div>

            </div>
            
            <button id="btn-hub-cancelar" style="background: #ff5555; color: #fff; border: 2px solid #aa0000; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; width: 100%; max-width: 150px; text-transform: uppercase;">FECHAR HUB</button>
        </div>
    `;
    document.getElementById("tela-jogo").appendChild(m);
    document.getElementById("btn-hub-cancelar").onclick = () => { m.style.display = "none"; };
}

// Ouvintes de Clique nos Buracos do Tabuleiro
window.slotSelecionadoAtual = null; 

// Intercepta clicks da Criatura para abrir o NOVO Hub Visual
document.querySelectorAll('.slot-criatura').forEach(s => s.addEventListener('click', function() { abrirHubModalSlot(this); }));

// Outras bindings normais (Magias, Ataques, Locais)
document.querySelectorAll('.slot-mugic-heptagono').forEach(s => s.addEventListener('click', function() { prepararSelecaoDeck('Magia', this); }));
// ==========================================
// 🗂️ GERENCIADOR DE PILHAS (MODAL DE EDIÇÃO)
// ==========================================

// Cria o Modal Invisível no HTML
if (!document.getElementById("modal-pilha-deck")) {
    let m = document.createElement("div");
    m.id = "modal-pilha-deck";
    m.style.cssText = "display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,15,15,0.95); z-index:9999; flex-direction:column; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;";
    m.innerHTML = `
        <div style="width: 100%; max-width: 320px; background: #111; border: 2px solid #00ffff; border-radius: 10px; padding: 15px; display: flex; flex-direction: column; max-height: 80%; box-shadow: 0 0 20px rgba(0,255,255,0.3);">
            <h3 id="titulo-modal-pilha" style="color: #00ffff; text-align: center; margin-bottom: 15px; font-family: monospace; font-size: 16px; letter-spacing: 1px;">PILHA</h3>
            <div id="lista-cartas-pilha" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; padding-right: 5px;"></div>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="btn-fechar-pilha" style="background: #ff5555; color: #fff; border: 2px solid #aa0000; padding: 12px; border-radius: 8px; font-weight: bold; flex: 1; cursor: pointer;">FECHAR</button>
                <button id="btn-add-pilha" style="background: #4CAF50; color: #000; border: 2px solid #2e7d32; padding: 12px; border-radius: 8px; font-weight: bold; flex: 1; cursor: pointer;">+ ADICIONAR</button>
            </div>
        </div>
    `;
    document.getElementById("tela-jogo").appendChild(m);
    document.getElementById("btn-fechar-pilha").onclick = () => { m.style.display = "none"; };
}

// Substitui o clique antigo para abrir o Modal
let btnPA = document.getElementById('pilha-ataques'); 
if(btnPA) btnPA.onclick = () => abrirModalPilha('Ataque', btnPA);

let btnPL = document.getElementById('pilha-locais'); 
if(btnPL) btnPL.onclick = () => abrirModalPilha('Local', btnPL);

// Função que monta a lista de cartas dentro do Modal (Agora usa ID e limpa fantasmas!)
window.abrirModalPilha = function(tipo, slotElement) {
    let m = document.getElementById("modal-pilha-deck");
    let titulo = document.getElementById("titulo-modal-pilha");
    let lista = document.getElementById("lista-cartas-pilha");
    
    titulo.innerText = `PILHA DE ${tipo.toUpperCase()}S`;
    titulo.style.color = tipo === 'Ataque' ? '#ff5555' : '#4CAF50';
    m.querySelector('div').style.borderColor = tipo === 'Ataque' ? '#ff5555' : '#4CAF50';
    
    lista.innerHTML = "";

    // Pega as memórias salvas na pilha
    let idsNaPilha = slotElement.dataset.cartas ? JSON.parse(slotElement.dataset.cartas) : [];
    
    // 🔥 AUTO-FIX (FAXINA DE FANTASMAS): Filtra e joga fora os IDs velhos que não existem mais!
    let idsValidos = idsNaPilha.filter(id => window.inventario.some(c => c.id == id));
    
    // Se ele achou fantasmas e limpou a lista, a gente atualiza os contadores na tela pra consertar o bug!
    if (idsValidos.length !== idsNaPilha.length) {
        idsNaPilha = idsValidos;
        slotElement.dataset.cartas = JSON.stringify(idsNaPilha); // Salva a lista limpa
        
        let maxCartas = tipo === 'Ataque' ? 20 : 10;
        let cont = slotElement.querySelector('.contador-cartas');
        if(cont) {
            cont.innerText = `${idsNaPilha.length}/${maxCartas}`;
            cont.style.color = idsNaPilha.length > 0 ? "#00ffff" : "white";
        }
        if (tipo === 'Ataque') {
            let custoTotal = 0;
            idsNaPilha.forEach(id => {
                let c = window.inventario.find(carta => carta.id == id);
                if (c) custoTotal += (parseInt(c.custo) || 0);
            });
            let contCusto = slotElement.querySelector('.contador-custo');
            if(contCusto) {
                contCusto.innerText = `Custo: ${custoTotal}/20`;
                contCusto.style.color = custoTotal > 20 ? "#ff5555" : (idsNaPilha.length > 0 ? "#00ffff" : "#ff5555");
            }
        }
    }

    // Agora sim, desenha a tela com segurança
    if (idsNaPilha.length === 0) {
        lista.innerHTML = "<p style='color:#aaa; text-align:center; font-size:12px; margin: 20px 0;'>A pilha está vazia.</p>";
    } else {
        idsNaPilha.forEach((id, index) => {
            let carta = window.inventario.find(c => c.id == id);
            if (!carta) return;
            
            let div = document.createElement("div");
            div.style = "display: flex; align-items: center; justify-content: space-between; background: #222; padding: 6px; border-radius: 5px; border: 1px solid #444;";
            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${carta.img}" style="width: 35px; height: 45px; object-fit: cover; border-radius: 3px; border: 1px solid ${tipo === 'Ataque' ? '#ff5555' : '#4CAF50'};">
                    <div>
                        <div style="color: white; font-size: 11px; font-weight: bold;">${carta.nome}</div>
                        ${tipo === 'Ataque' ? `<div style="color: #ff5555; font-size: 10px; margin-top: 3px;">Custo: ${carta.custo || 0}</div>` : ''}
                    </div>
                </div>
                <button style="background: #aa0000; color: white; border: none; border-radius: 5px; width: 30px; height: 30px; font-weight: bold; cursor: pointer; font-size: 14px;" onclick="removerCartaDaPilha('${tipo}', ${index})">X</button>
            `;
            lista.appendChild(div);
        });
    }

    document.getElementById("btn-add-pilha").onclick = () => {
        m.style.display = "none";
        prepararSelecaoDeck(tipo, slotElement);
    };

    m.style.display = "flex";
};

// Função para APAGAR a carta específica e recalcular a matemática
window.removerCartaDaPilha = function(tipo, index) {
    let slotElement = tipo === 'Ataque' ? document.getElementById('pilha-ataques') : document.getElementById('pilha-locais');
    let idsNaPilha = JSON.parse(slotElement.dataset.cartas);
    
    // Remove EXATAMENTE a carta que você clicou no "X"
    idsNaPilha.splice(index, 1); 
    slotElement.dataset.cartas = JSON.stringify(idsNaPilha);
    
    // Atualiza os Textos do Tabuleiro
    let maxCartas = tipo === 'Ataque' ? 20 : 10;
    let cont = slotElement.querySelector('.contador-cartas');
    if(cont) {
        cont.innerText = `${idsNaPilha.length}/${maxCartas}`;
        cont.style.color = idsNaPilha.length > 0 ? "#00ffff" : "white";
    }

    if (tipo === 'Ataque') {
        let custoTotal = 0;
        idsNaPilha.forEach(id => {
            let c = window.inventario.find(carta => carta.id == id);
            if (c) custoTotal += (parseInt(c.custo) || 0);
        });
        let contCusto = slotElement.querySelector('.contador-custo');
        if(contCusto) {
            contCusto.innerText = `Custo: ${custoTotal}/20`;
            contCusto.style.color = custoTotal > 20 ? "#ff5555" : (idsNaPilha.length > 0 ? "#00ffff" : "#ff5555");
        }
    }

    // Atualiza a tela do Modal na mesma hora!
    abrirModalPilha(tipo, slotElement);
};

// Função Mágica do Hub Visual: Carrega o Slot e suas Cartas em miniatura
window.abrirHubModalSlot = function(creatureSlotElement) {
    let m = document.getElementById("modal-hub-criatura");
    
    // Acha o índice CONCEITUAL do slot (0 a 5)
    const criaturaSlots = Array.from(document.querySelectorAll('.slot-criatura'));
    const index = criaturaSlots.indexOf(creatureSlotElement);
    
    document.getElementById("titulo-hub-criatura").innerText = `GERENCIAR SLOT #${index + 1}`;
    
    // Pega o Slot de Equipamento correspondente
    const equipSlots = document.querySelectorAll('.slot-equipamento');
    const targetEquipSlot = equipSlots[index];

    // Acessa as memórias de ID salvas nos quadradinhos do tabuleiro
    const idCriatura = creatureSlotElement.dataset.cartaId;
    const idEquip = targetEquipSlot.dataset.cartaId;

    // Acha as cartas reais na sua coleção
    const cartaCriatura = idCriatura ? window.inventario.find(c => c.id == idCriatura) : null;
    const cartaEquip = idEquip ? window.inventario.find(c => c.id == idEquip) : null;

    // Função Interna Mágica para Popular as Miniaturas
    const populateMiniature = (miniElement, carta, type) => {
        const emptyVisual = miniElement.querySelector('.empty-visual');
        const corAccent = type === 'Criatura' ? '#4CAF50' : '#ffd700';

        if (carta) {
            // Se tem carta, esconde o "+" e pinta a miniatura com o Zoom!
            if(emptyVisual) emptyVisual.style.display = 'none';
            miniElement.style.backgroundImage = `url('${carta.img}')`;
            
            // Re-aplica o Zoom que tínhamos no interceptador
            if (type === "Criatura") {
                miniElement.style.backgroundSize = '180%'; miniElement.style.backgroundPosition = 'center 15%';
            } else {
                miniElement.style.backgroundSize = '160%'; miniElement.style.backgroundPosition = 'center 20%';
            }
            miniElement.style.borderColor = corAccent;
        } else {
            // Se não tem carta, mostra o "+" e zera o visual
            if(emptyVisual) emptyVisual.style.display = 'block';
            miniElement.style.backgroundImage = 'none';
            miniElement.style.borderColor = "#333"; // Borda desativada
        }
    };

    // Popula as duas Miniaturas no Modal
    populateMiniature(document.getElementById("mini-hub-criatura"), cartaCriatura, 'Criatura');
    populateMiniature(document.getElementById("mini-hub-equip"), cartaEquip, 'Equipamento');
    
    // Configura os Clinks nas Miniaturas para irem pro Álbum
    document.getElementById("mini-hub-criatura").onclick = () => {
        m.style.display = "none";
        prepararSelecaoDeck('Criatura', creatureSlotElement); // Vai pro Álbum da Criatura
    };
    
    document.getElementById("mini-hub-equip").onclick = () => {
        m.style.display = "none";
        prepararSelecaoDeck('Equipamento', targetEquipSlot); // Vai pro Álbum do Equipamento
    };

    m.style.display = "flex";
};

function prepararSelecaoDeck(tipoDesejado, elementoSlot) {
    window.slotSelecionadoAtual = elementoSlot; 
    document.getElementById('tela-decks').style.display = 'none';
    document.getElementById('tela-album').style.display = 'flex';
    let tituloAlbum = document.querySelector('#tela-album .titulo-tela');
    if(tituloAlbum) tituloAlbum.innerText = "SELECIONE: " + tipoDesejado.toUpperCase();
    let selectTipo = document.getElementById('filtro-tipo');
    if(selectTipo) { selectTipo.value = tipoDesejado; selectTipo.dispatchEvent(new Event('change')); }
}

// 🛡️ O JUIZ: Trava de Segurança com REGRAS OFICIAIS DE TORNEIO
window.interceptarMontagemDeck = function(idCarta) {
    let slot = window.slotSelecionadoAtual;
    let cartaSelecionada = window.inventario.find(c => c.id === idCarta);
    if (!cartaSelecionada) return;

    let avisoDeck = document.getElementById('aviso-deck');
    let mostrarAviso = (msg) => {
        if(avisoDeck) { avisoDeck.innerText = msg; setTimeout(() => avisoDeck.innerText = "", 4000); } 
        else mostrarMensagemScanner(msg);
        tocarSFX('notificacao'); // Toca o som pra avisar o bloqueio
    };

    let fecharEVoltar = () => {
        document.getElementById('tela-album').style.display = 'none';
        document.getElementById('tela-decks').style.display = 'flex';
        window.slotSelecionadoAtual = null;
        let selectTipo = document.getElementById('filtro-tipo');
        if(selectTipo) { selectTipo.value = "Todas"; selectTipo.dispatchEvent(new Event('change')); }
        let tituloAlbum = document.querySelector('#tela-album .titulo-tela');
        if(tituloAlbum) tituloAlbum.innerText = "MINHA COLEÇÃO";
    };

    // 1. CHECA INVENTÁRIO FÍSICO (O jogador tem cartas suficientes na coleção?)
    let qtdNoDOM = document.querySelectorAll(`[data-carta-id="${idCarta}"]`).length;
    let qtdPilhas = 0;
    document.querySelectorAll('.pilha-cartas').forEach(p => {
        if(p.dataset.cartas) {
            let arr = JSON.parse(p.dataset.cartas);
            qtdPilhas += arr.filter(idSalvo => idSalvo == idCarta).length;
        }
    });
    if (slot.dataset.cartaId == idCarta) qtdNoDOM--; // Desconta se for o mesmo buraco

    let qtdTotal = qtdNoDOM + qtdPilhas;
    if (qtdTotal >= (cartaSelecionada.quantidade || 1)) {
        mostrarAviso(`INVENTÁRIO: VOCÊ SÓ POSSUI ${cartaSelecionada.quantidade || 1} CÓPIA(S) DESTA CARTA!`);
        fecharEVoltar(); return;
    }

    // ==========================================
    // 🚨 REGRAS OFICIAIS DE DECKBUILDING
    // ==========================================

    // REGRA A: Magias (Max 2 cópias, a menos que o efeito exija limite menor)
    if (cartaSelecionada.tipoCarta === "Magia") {
        let magiasAtuais = 0;
        // Olha se a carta tem limite próprio no BD, se não, usa o padrão 2.
        let maxMagia = cartaSelecionada.limiteDeck !== undefined ? cartaSelecionada.limiteDeck : 2; 
        
        document.querySelectorAll('.slot-mugic-heptagono').forEach(s => {
            if (s !== slot && s.dataset.cartaId == idCarta) magiasAtuais++;
        });
        if (magiasAtuais >= maxMagia) {
            mostrarAviso(`REGRA: MÁXIMO DE ${maxMagia} CÓPIA(S) DESTA MAGIA NO DECK!`);
            fecharEVoltar(); return;
        }
    }

    // REGRA DE EQUIPAMENTOS: Não há limite natural, a menos que a carta especifique!
    if (cartaSelecionada.tipoCarta === "Equipamento") {
        if (cartaSelecionada.limiteDeck !== undefined) {
            let equipsAtuais = 0;
            document.querySelectorAll('.slot-equipamento').forEach(s => {
                if (s !== slot && s.dataset.cartaId == idCarta) equipsAtuais++;
            });
            if (equipsAtuais >= cartaSelecionada.limiteDeck) {
                mostrarAviso(`REGRA: EFEITO LIMITA A ${cartaSelecionada.limiteDeck} CÓPIA(S) DESTE EQUIPAMENTO!`);
                fecharEVoltar(); return;
            }
        }
    }

   // REGRA B: Criaturas (Limites por Tipo da Criatura, Limite de Líder e Tribo)
    if (cartaSelecionada.tipoCarta === "Criatura") {
        // 💡 O Leitor Inteligente: Busca a classe verdadeira mesmo em cartas antigas bugadas!
        // 💡 FIX: O Juiz consulta o banco de dados oficial (MONSTROS) para garantir a classe de cartas antigas!
        let tipoBruto = cartaSelecionada.tipo || cartaSelecionada.tipoClasse;
        if (typeof MONSTROS !== 'undefined') {
            let cartaOriginal = MONSTROS.find(m => m.nome === cartaSelecionada.nome);
            if (cartaOriginal && cartaOriginal.tipoClasse) {
                tipoBruto = cartaOriginal.tipoClasse; // Agora ele lê a propriedade certinha do seu BD!
            }
        }
        tipoBruto = tipoBruto || "Subordinado"; // Se não achar de jeito nenhum, vira Subordinado.
        
        let tipoNormalizado = tipoBruto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        
        let limitePerCard = 3; // Padrão é 3 (Subordinado/Outros)
        let isLider = false;

        if (tipoNormalizado.includes("lider")) { limitePerCard = 1; isLider = true; }
        else if (tipoNormalizado.includes("mago")) limitePerCard = 2;
        else if (tipoNormalizado.includes("guerreiro")) limitePerCard = 2;

        // 🛠️ NOVA REGRA: Se a carta tiver um limite próprio no BD, ele esmaga as regras de classe!
        if (cartaSelecionada.limiteDeck !== undefined) {
            limitePerCard = cartaSelecionada.limiteDeck;
        }

        // Coleta as criaturas que já estão no deck (ignorando o slot atual)
        let criaturasNoDeck = [];
        document.querySelectorAll('.slot-criatura').forEach(s => {
            if (s !== slot && s.dataset.cartaId) {
                let cDeck = window.inventario.find(c => c.id == s.dataset.cartaId);
                if (cDeck) criaturasNoDeck.push(cDeck);
            }
        });

        // B.1 Limite de cópias da mesma carta de acordo com o Tipo
        // 🛠️ FIX: Agora conta pelo NOME da carta, já que criaturas têm IDs únicos!
        let qtdMesmaCriatura = criaturasNoDeck.filter(c => c.nome === cartaSelecionada.nome).length;
        if (qtdMesmaCriatura >= limitePerCard) {
            mostrarAviso(`REGRA: MÁXIMO DE ${limitePerCard} CÓPIA(S) DE "${cartaSelecionada.nome.toUpperCase()}"!`);
            fecharEVoltar(); return;
        }
        // B.2 Regras Absolutas de LÍDER
        if (isLider) {
            let temLider = criaturasNoDeck.some(c => {
                let t = (c.tipo || "Subordinado").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return t.includes("lider");
            });
            if (temLider) {
                mostrarAviso("REGRA: APENAS 1 LÍDER PERMITIDO POR DECK!");
                fecharEVoltar(); return;
            }
            
            // Verifica se você não tá colocando um líder de cor diferente das tropas que já estão lá
            let subordinados = criaturasNoDeck.filter(c => {
                let t = (c.tipo || "Subordinado").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return !t.includes("lider");
            });
            let conflitoTribo = subordinados.find(sub => sub.tribo !== cartaSelecionada.tribo);
            if (conflitoTribo) {
                mostrarAviso(`REGRA: LÍDER ${cartaSelecionada.tribo.toUpperCase()} NÃO PODE LIDERAR TROPAS ${conflitoTribo.tribo.toUpperCase()}!`);
                fecharEVoltar(); return;
            }
        }

        // B.3 Regras Absolutas de TROPAS (Não-líderes)
        if (!isLider) {
            let liderNoDeck = criaturasNoDeck.find(c => {
                let t = (c.tipo || "Subordinado").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return t.includes("lider");
            });
            if (liderNoDeck && liderNoDeck.tribo !== cartaSelecionada.tribo) {
                mostrarAviso(`REGRA: TROPAS DEVEM SER DA TRIBO DO LÍDER (${liderNoDeck.tribo.toUpperCase()})!`);
                fecharEVoltar(); return;
            }
        }
    }
    // REGRA C: Custo de Ataques (Matemática Automática)
    if (slot.id === 'pilha-ataques') {
        let contadorCusto = slot.querySelector('.contador-custo');
        if (contadorCusto) {
            let custoDaCarta = parseInt(cartaSelecionada.custo) || 0;
            let partes = contadorCusto.innerText.replace('Custo: ', '').split('/');
            let custoAtual = parseInt(partes[0]);
            let custoMax = parseInt(partes[1]);

            if ((custoAtual + custoDaCarta) > custoMax) {
                mostrarAviso(`CUSTO ESTOURADO! VOCÊ SÓ TEM ${custoMax - custoAtual} PONTOS DE ATAQUE LIVRES.`);
                fecharEVoltar(); return;
            }
        }
    }

    // ==========================================
    // FIM DAS REGRAS. SE PASSOU, APLICA A CARTA!
    // ==========================================

    if (!slot.classList.contains('pilha-cartas')) {
        slot.style.backgroundImage = `url('${cartaSelecionada.img}')`;
        if (cartaSelecionada.tipoCarta === "Criatura") {
            slot.style.backgroundSize = '180%'; slot.style.backgroundPosition = 'center 15%';
        } else if (cartaSelecionada.tipoCarta === "Equipamento") {
            slot.style.backgroundSize = '160%'; slot.style.backgroundPosition = 'center 20%';
        } else {
            slot.style.backgroundSize = 'cover'; slot.style.backgroundPosition = 'center';
        }
        slot.innerHTML = '';
        slot.dataset.cartaId = idCarta; // SALVA O ID
    } else {
        let contador = slot.querySelector('.contador-cartas');
        if(contador) {
            let valores = contador.innerText.split('/');
            let atual = parseInt(valores[0]);
            let max = parseInt(valores[1]);

            if (atual < max) {
                atual++;
                contador.innerText = `${atual}/${max}`;
                contador.style.color = "#00ffff";

                let cartasNaPilha = slot.dataset.cartas ? JSON.parse(slot.dataset.cartas) : [];
                cartasNaPilha.push(idCarta);
                slot.dataset.cartas = JSON.stringify(cartasNaPilha);

                if (slot.id === 'pilha-ataques') {
                    let contadorCusto = slot.querySelector('.contador-custo');
                    let custoDaCarta = parseInt(cartaSelecionada.custo) || 0;
                    let partes = contadorCusto.innerText.replace('Custo: ', '').split('/');
                    let custoAtual = parseInt(partes[0]) + custoDaCarta;
                    let custoMax = parseInt(partes[1]);
                    contadorCusto.innerText = `Custo: ${custoAtual}/${custoMax}`;
                    contadorCusto.style.color = custoAtual > custoMax ? "#ff5555" : "#00ffff";
                }
            } else {
                mostrarAviso("ESTA PILHA JÁ ESTÁ CHEIA!");
                fecharEVoltar(); return;
            }
        }
    }
    fecharEVoltar();
};

// 🧹 O ESPANADOR MÁGICO
window.limparTabuleiroDeck = function() {
    document.querySelectorAll('.slot-criatura, .slot-equipamento, .slot-mugic-heptagono').forEach(slot => {
        slot.style.backgroundImage = 'none'; slot.innerHTML = ''; delete slot.dataset.cartaId;
    });
    let pLocais = document.getElementById('pilha-locais');
    if(pLocais) {
        let cont = pLocais.querySelector('.contador-cartas');
        if(cont) { cont.innerText = "0/10"; cont.style.color = "white"; }
        delete pLocais.dataset.cartas;
    }
    let pAtaques = document.getElementById('pilha-ataques');
    if(pAtaques) {
        let cont = pAtaques.querySelector('.contador-cartas');
        if(cont) { cont.innerText = "0/20"; cont.style.color = "white"; }
        let custo = pAtaques.querySelector('.contador-custo');
        if(custo) { custo.innerText = "Custo: 0/20"; custo.style.color = "#ff5555"; }
        delete pAtaques.dataset.cartas;
    }
    let inputNome = document.querySelector('input[placeholder*="Nome do Deck"]');
    if(inputNome) inputNome.value = "";
};

// 💾 SISTEMA DE SALVAR NA NUVEM
let btnSalvarDeck = document.getElementById("btn-salvar-deck");
if (btnSalvarDeck) {
    btnSalvarDeck.addEventListener("click", function() {
        let inputNome = document.querySelector('input[placeholder*="Nome do Deck"]');
        let nomeDeck = inputNome && inputNome.value.trim() !== "" ? inputNome.value.trim() : "Deck Sem Nome";
        let modo = document.getElementById("seletor-modo-deck") ? document.getElementById("seletor-modo-deck").value : "6x6";
        let selectSlot = Array.from(document.querySelectorAll('#tela-decks select')).find(s => s.innerHTML.includes('Slot'));
        let slotEscolhido = selectSlot ? selectSlot.value : "slot_1";
        let slotId = slotEscolhido.toLowerCase().replace(/salvar no /g, '').replace(/ /g, '_');

        // 🔥 A MÁGICA: O Firebase agora guarda o Modo + Slot (ex: "1x1_slot_1")
        let idFogo = modo + "_" + slotId;

        let deckData = { nome: nomeDeck, modo: modo, criaturas: [], equipamentos: [], mugics: [], ataques: [], locais: [] };

        // 🐛 BUG DA CARTA FANTASMA CORRIGIDO: 
        // Ignora os slots que estão invisíveis (escondidos) pela mudança de modo!
        document.querySelectorAll('.slot-criatura').forEach(s => { 
            let invisivel = s.closest('.linha-2')?.classList.contains('escondido') || s.closest('.linha-3')?.classList.contains('escondido');
            deckData.criaturas.push(invisivel ? null : (s.dataset.cartaId || null)); 
        });
        document.querySelectorAll('.slot-equipamento').forEach(s => { 
            let invisivel = s.closest('.linha-2')?.classList.contains('escondido') || s.closest('.linha-3')?.classList.contains('escondido');
            deckData.equipamentos.push(invisivel ? null : (s.dataset.cartaId || null)); 
        });
        document.querySelectorAll('.slot-mugic-heptagono').forEach(s => { 
            deckData.mugics.push(s.classList.contains('escondido') ? null : (s.dataset.cartaId || null)); 
        });

        let pAtaques = document.getElementById('pilha-ataques');
        if(pAtaques && pAtaques.dataset.cartas) deckData.ataques = JSON.parse(pAtaques.dataset.cartas);
        let pLocais = document.getElementById('pilha-locais');
        if(pLocais && pLocais.dataset.cartas) deckData.locais = JSON.parse(pLocais.dataset.cartas);

        // ⚖️ JUIZ DE BATALHA: Checa se o deck está legalizado para a Arena!
        let custoTotalAtaques = 0;
        deckData.ataques.forEach(id => {
            let carta = window.inventario.find(c => c.id == id);
            if(carta) custoTotalAtaques += (parseInt(carta.custo) || 0);
        });
        
        // Verifica se tem 20 ataques, se a soma do custo é 20, e se tem 10 locais.
        deckData.validoParaBatalha = (deckData.ataques.length === 20 && custoTotalAtaques === 20 && deckData.locais.length === 10);

        if (deckData.criaturas.every(c => c === null)) {
            let avisoDeck = document.getElementById('aviso-deck');
            if(avisoDeck) { avisoDeck.innerText = "DECK VAZIO! ADICIONE CRIATURAS."; setTimeout(() => avisoDeck.innerText = "", 4000); }
            return;
        }

        // Mensagem dinâmica avisando o status do deck
        if(deckData.validoParaBatalha) {
            mostrarMensagemScanner("SALVANDO DECK PRONTO PARA BATALHA! ⚔️");
        } else {
            mostrarMensagemScanner("SALVANDO DECK INCOMPLETO... 🚧");
        }

        // 🔥 Salva usando o idFogo (Modo + Slot)
        set(ref(db, 'jogadores/' + uid + '/decks/' + idFogo), deckData).then(() => {
            mostrarMensagemScanner("DECK SALVO COM SUCESSO! ☁️✅");
            tocarSFX('notificacao');
            btnSalvarDeck.style.background = "#fff"; setTimeout(() => btnSalvarDeck.style.background = "#4CAF50", 300);
        }).catch(err => { mostrarMensagemScanner("ERRO AO SALVAR NA NUVEM!"); });
    });
}

// 📥 SISTEMA DE CARREGAR DA NUVEM
window.carregarDeckDaNuvem = function(idFogo) { // Agora recebe o ID combinado
    mostrarMensagemScanner("CARREGANDO DECK...");
    get(ref(db, 'jogadores/' + uid + '/decks/' + idFogo)).then((snapshot) => {
        window.limparTabuleiroDeck(); // 🔥 Sempre limpa a mesa antes! Se o slot for vazio, a mesa já fica pronta!
        
        if (snapshot.exists()) {
            let deckData = snapshot.val();
            let inputNome = document.querySelector('input[placeholder*="Nome do Deck"]');
            if(inputNome) inputNome.value = deckData.nome || "";

            let seletorModo = document.getElementById("seletor-modo-deck");
            if(seletorModo && deckData.modo) {
                seletorModo.value = deckData.modo;
                seletorModo.dispatchEvent(new Event('change'));
            }

            const carimbarSlot = (slot, idCarta, tipo) => {
                if (!idCarta) return;
                let carta = window.inventario.find(c => c.id == idCarta);
                if (!carta) return;

                slot.style.backgroundImage = `url('${carta.img}')`;
                if (tipo === "Criatura") { slot.style.backgroundSize = '180%'; slot.style.backgroundPosition = 'center 15%'; }
                else if (tipo === "Equipamento") { slot.style.backgroundSize = '160%'; slot.style.backgroundPosition = 'center 20%'; }
                else { slot.style.backgroundSize = 'cover'; slot.style.backgroundPosition = 'center'; }
                slot.dataset.cartaId = idCarta;
            };

            // 2. Restaura Imagens Individuais (Corrigido para driblar o Firebase!)
            setTimeout(() => {
                let slotsCriatura = document.querySelectorAll('.slot-criatura');
                slotsCriatura.forEach((slot, i) => {
                    // Pega pelo índice (funciona tanto se o Firebase devolver Lista quanto Objeto)
                    let id = deckData.criaturas ? deckData.criaturas[i] : null;
                    if (id) carimbarSlot(slot, id, "Criatura");
                });

                let slotsEquip = document.querySelectorAll('.slot-equipamento');
                slotsEquip.forEach((slot, i) => {
                    let id = deckData.equipamentos ? deckData.equipamentos[i] : null;
                    if (id) carimbarSlot(slot, id, "Equipamento");
                });

                let slotsMugic = document.querySelectorAll('.slot-mugic-heptagono');
                slotsMugic.forEach((slot, i) => {
                    let id = deckData.mugics ? deckData.mugics[i] : null;
                    if (id) carimbarSlot(slot, id, "Magia");
                });
            }, 50);

            if (deckData.locais && deckData.locais.length > 0) {
                let pLocais = document.getElementById('pilha-locais');
                if (pLocais) {
                    pLocais.dataset.cartas = JSON.stringify(deckData.locais);
                    let cont = pLocais.querySelector('.contador-cartas');
                    if (cont) { cont.innerText = `${deckData.locais.length}/10`; cont.style.color = "#00ffff"; }
                }
            }

            if (deckData.ataques && deckData.ataques.length > 0) {
                let pAtaques = document.getElementById('pilha-ataques');
                if (pAtaques) {
                    pAtaques.dataset.cartas = JSON.stringify(deckData.ataques);
                    let cont = pAtaques.querySelector('.contador-cartas');
                    if (cont) { cont.innerText = `${deckData.ataques.length}/20`; cont.style.color = "#00ffff"; }

                    let custoTotal = 0;
                    deckData.ataques.forEach(idAtaque => {
                        let cartaA = window.inventario.find(c => c.id == idAtaque);
                        if (cartaA) custoTotal += (parseInt(cartaA.custo) || 0);
                    });

                    let contadorCusto = pAtaques.querySelector('.contador-custo');
                    if (contadorCusto) {
                        contadorCusto.innerText = `Custo: ${custoTotal}/20`;
                        contadorCusto.style.color = custoTotal > 20 ? "#ff5555" : "#00ffff";
                    }
                }
            }
            mostrarMensagemScanner("DECK CARREGADO COM SUCESSO! 💾");
            tocarSFX('viajar');
        } else {
            mostrarMensagemScanner("SLOT VAZIO. CRIE SUA ESTRATÉGIA!");
        }
    }).catch(err => { mostrarMensagemScanner("FALHA AO CONECTAR COM A NUVEM!"); });
};

// ==========================================
// 🎯 OS GATILHOS INTELIGENTES DA OFICINA
// ==========================================
let evtSeletorModo = document.getElementById("seletor-modo-deck");
let evtSeletorSlot = Array.from(document.querySelectorAll('#tela-decks select')).find(s => s.innerHTML.includes('Slot'));

// Função que combina o Modo e o Slot pra achar a pasta certa!
function dispararCargaDaNuvem() {
    if (evtSeletorModo && evtSeletorSlot) {
        let modo = evtSeletorModo.value;
        let slotId = evtSeletorSlot.value.toLowerCase().replace(/salvar no /g, '').replace(/ /g, '_');
        let idFogo = modo + "_" + slotId;
        window.carregarDeckDaNuvem(idFogo);
    }
}

if (evtSeletorModo) {
    evtSeletorModo.addEventListener('change', (e) => { 
        if (e && e.isTrusted) dispararCargaDaNuvem(); 
    });
}

if (evtSeletorSlot) {
    evtSeletorSlot.addEventListener('change', (e) => {
        if (e && e.isTrusted) dispararCargaDaNuvem();
    });
}

// Fecha a tela do Drome e volta pro Menu
let btnSairDrome = document.getElementById("btn-sair-drome");
if (btnSairDrome) {
    btnSairDrome.onclick = () => {
        document.getElementById("tela-batalha").style.display = "none";
        document.getElementById("tela-menu").style.display = "flex";
        window.modoMenu = true;
    };
}
// ==========================================
// LÓGICA DOS BOTÕES DO PORTAL DO DROME
// ==========================================

// Função para Voltar ao Menu
window.fecharEntradaDrome = function() {
    document.getElementById("tela-entrada-drome").style.display = "none";
    document.getElementById("tela-menu").style.display = "flex";
    window.modoMenu = true;
};

// Função para, de fato, entrar no Tabuleiro de Batalha!
window.iniciarBatalhaDrome = function(modoEscolhido) {
    document.getElementById("tela-entrada-drome").style.display = "none";
    document.getElementById("tela-batalha").style.display = "flex";
    
    // Mostra o aviso de qual modo foi selecionado
    mostrarMensagemScanner("INICIANDO DROME: MODO " + modoEscolhido + "!");
    
    // Opcional: Aqui você pode colocar a lógica futura para esconder/mostrar 
    // os slots do tabuleiro dependendo se o jogador escolheu 1x1 ou 6x6.
};
