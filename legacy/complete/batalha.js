// ==========================================
// CONFIGURAÇÕES DE DESIGN
// ==========================================
const URL_FUNDO_CARTA = 'cartas/verso.jpg'; 

// ==========================================
// MOTOR DA MINI-CARTA (AGORA COM FOG OF WAR!)
// ==========================================
function desenharMiniCarta(criaturaObj) {
    let img = "", hpAtual = 0, c = 0, p = 0, s = 0, v = 0, pct = 0;
    let corHp = '#444', triboClass = "", htmlEquipamento = ""; 
    let temFogo = false, temAgua = false, temTerra = false, temAr = false;

    if (!criaturaObj) {
        return `<div class="mini-card-wrapper" style="opacity:0.3; display:flex; justify-content:center; align-items:center;">🛡️</div>`; 
    }

    // 🔥 DETETIVE DO BLEFE: A carta está virada para baixo?
    let isOculta = criaturaObj.revelada === false;

    // Se estiver oculta, mostra o verso. Se revelada, mostra a arte real!
    img = isOculta ? URL_FUNDO_CARTA : criaturaObj.cartaBlank; 
    
    let hpMax = criaturaObj.hpMax || criaturaObj.statsMax?.energia || 0;
    hpAtual = criaturaObj.hpAtual !== undefined ? criaturaObj.hpAtual : hpMax;
    c = criaturaObj.coragem || criaturaObj.statsMax?.coragem || 0;
    p = criaturaObj.poder || criaturaObj.statsMax?.poder || 0;
    s = criaturaObj.sabedoria || criaturaObj.statsMax?.sabedoria || 0;
    v = criaturaObj.velocidade || criaturaObj.statsMax?.velocidade || 0;
    
    let elemsBrutos = criaturaObj.elementos;
    if ((!elemsBrutos || elemsBrutos.length === 0) && typeof MONSTROS !== 'undefined') {
        let dbCarta = MONSTROS.find(m => m.nome === criaturaObj.nome);
        if (dbCarta && dbCarta.elementos) elemsBrutos = dbCarta.elementos;
    }

    let textoElementos = JSON.stringify(elemsBrutos || "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
    temFogo = textoElementos.includes('fogo');
    temAgua = textoElementos.includes('agua');
    temTerra = textoElementos.includes('terra');
    temAr = textoElementos.includes('ar');
    
    const triboMap = {'Azul': 'tribo-azul', 'Vermelho': 'tribo-vermelho', 'Amarelo': 'tribo-amarelo', 'Verde': 'tribo-verde', 'Ciano': 'tribo-ciano', 'Cinza': 'tribo-cinza'};
    // Se oculta, não mostra a tribo (fica cinza). Se revelada, mostra a cor real.
    triboClass = isOculta ? 'tribo-cinza' : (triboMap[criaturaObj.tribo] || 'tribo-cinza');
    pct = Math.max(0, Math.min(100, (hpAtual / hpMax) * 100));
    corHp = pct <= 20 ? 'red' : (pct <= 50 ? 'orange' : 'lime');

    // Equipamentos SÓ aparecem se a criatura estiver revelada!
    if (criaturaObj.equipamento && !isOculta) {
        if (criaturaObj.equipamentoRevelado) {
            htmlEquipamento = `<div class="mini-equip-icon revelado" style="background-image: url('${criaturaObj.equipamento.img}'); background-color: #ffd700; display: block !important; width: 26px !important; height: 26px !important; border: 2px solid #ffd700 !important; border-radius: 50%; background-size: cover; background-position: center;" onpointerdown="event.stopPropagation()" ontouchstart="event.stopPropagation()" onclick="event.stopPropagation(); window.ampliarCartaClicada('${criaturaObj.equipamento.img}')"></div>`;
        } else {
            let msgOculto = criaturaObj.dono === 'jogador' ? 'Seu equipamento secreto.' : 'Equipamento inimigo oculto.';
            htmlEquipamento = `<div class="mini-equip-icon oculto" style="display: flex !important; justify-content: center !important; align-items: center !important;" onpointerdown="event.stopPropagation()" ontouchstart="event.stopPropagation()" onclick="event.stopPropagation(); window.mostrarMensagemScanner('${msgOculto}')">?</div>`;
        }
    }

    // 🔥 BLINDAGEM DE DADOS: Troca todos os números por "?" se estiver oculta!
    let displayHP = isOculta ? '???' : (hpAtual > 0 ? hpAtual : '');
    let displayCorHp = isOculta ? '#222' : corHp;
    let displayPct = isOculta ? 100 : pct;

    return `
        <div class="mini-card-wrapper ${criaturaObj.moveuNesteTurno ? 'esgotado' : ''}">
            ${htmlEquipamento}
            <div class="mini-card-body ${triboClass}">
                <div class="mini-top-row"><div class="mini-art" style="${img ? `background-image: url('${img}');` : ''}">${!img ? '🛡️' : ''}</div></div>
                <div class="mini-hp-row"><div class="mini-hp-fill" style="width: ${displayPct}%; background-color: ${displayCorHp};"></div><span class="mini-hp-text">${displayHP}</span></div>
                <div class="mini-stats-container">
                    <div class="mini-stats-band">
                        <div class="mini-stat-item"><span>❤️</span><b>${isOculta ? '?' : c}</b></div><div class="mini-stat-item"><span>⚡</span><b>${isOculta ? '?' : p}</b></div>
                        <div class="mini-stat-item"><span>👁️</span><b>${isOculta ? '?' : s}</b></div><div class="mini-stat-item"><span>💨</span><b>${isOculta ? '?' : v}</b></div>
                    </div>
                    <div class="mini-elements-band">
                        <div class="mini-el fogo ${!isOculta && temFogo ? 'ativo' : ''}">🔥</div><div class="mini-el ar ${!isOculta && temAr ? 'ativo' : ''}">☁️</div>
                        <div class="mini-el terra ${!isOculta && temTerra ? 'ativo' : ''}">⛰️</div><div class="mini-el agua ${!isOculta && temAgua ? 'ativo' : ''}">🌊</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}




// ==========================================

// SISTEMA DE CONTADOR INTELIGENTE, CARGA DE DECK E COMPRA DE MÃO 🔥

// ==========================================



let campoJogador = { c1: null, c2: null, c3: null, c4: null, c5: null, c6: null };

window.baralhoAtaques = []; 

window.maoAtaques = [];     

window.jogadorMugics = []; 



function embaralharArray(array) {

    let arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [arr[i], arr[j]] = [arr[j], arr[i]];

    }

    return arr;

}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

window.carregarDeckParaBatalha = function(salaId, souP1) {
    campoJogador = { c1: null, c2: null, c3: null, c4: null, c5: null, c6: null };
    window.campoOponente = { c1: null, c2: null, c3: null, c4: null, c5: null, c6: null };
    window.slotSelecionadoMovimento = null;
    window.jogadorMugics = []; 
    window.lixoAtaques = []; 
    window.lixoAtaquesOponente = 0; 
    window.cemiterio = [];
    window.cemiterioOponente = [];
    window.deckInimigoMontado = false; // 🔥 O CADEADO DE SEGURANÇA!

    if (typeof limparDestaquesMovimento === "function") limparDestaquesMovimento();

    let deck = window.estadoDrome.deckSelecionado;
    if (!deck || !deck.criaturas) return;

    // 1. CARREGA O SEU DECK (P1 ou P2 local)
    if (deck.ataques && deck.ataques.length > 0) {
        window.baralhoAtaques = embaralharArray(deck.ataques); 
        window.maoAtaques = window.baralhoAtaques.splice(0, 3); 
    } else {
        window.baralhoAtaques = [];
        window.maoAtaques = [];
    }

    if (deck.mugics && deck.mugics.length > 0) {
        deck.mugics.forEach(idMagia => {
            if (idMagia) {
                let magiaReal = window.inventario.find(c => c.id == idMagia);
                if (magiaReal) window.jogadorMugics.push(magiaReal);
            }
        });
    }

    let chaves = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

    // 🔥 ALINHAMENTO INTELIGENTE: Puxa todos os equipamentos reais ignorando buracos
    let equipsLocaisFlat = [];
    if (deck.equipamentos) {
        for (let k in deck.equipamentos) if (deck.equipamentos[k]) equipsLocaisFlat.push(deck.equipamentos[k]);
    }
    let eqIndex = 0;
    
    chaves.forEach((chave, index) => {
        let idCarta = deck.criaturas[index]; 
        let idEquip = deck.equipamentos ? deck.equipamentos[index] : null; 
        
        // Se o deck builder salvou fora de ordem (ex: monstros no 3,4,5 e equips no 0,1,2)
        if (idCarta && !idEquip && eqIndex < equipsLocaisFlat.length) {
            idEquip = equipsLocaisFlat[eqIndex];
        }
        if (idCarta) eqIndex++; 
        
        if (idCarta) {
            let cartaOriginal = window.inventario.find(c => c.id == idCarta);
            let equipOriginal = idEquip ? window.inventario.find(c => c.id == idEquip) : null; 
            
            if (cartaOriginal) {
                let fichasReais = 0;
                let temEfeitoReal = false;
                let textoCartaReal = "";

                if (typeof MONSTROS !== 'undefined') {
                    let cartaDB = MONSTROS.find(m => m.nome === cartaOriginal.nome);
                    if (cartaDB) {
                        if (cartaDB.fichasHabilidade !== undefined) fichasReais = parseInt(cartaDB.fichasHabilidade);
                        temEfeitoReal = cartaDB.temEfeito || false;
                        textoCartaReal = cartaDB.textoCarta || "";
                    }
                }

                campoJogador[chave] = {
                    dono: 'jogador',
                    nome: cartaOriginal.nome,
                    tribo: cartaOriginal.tribo || "Azul",
                    elementos: cartaOriginal.elementos || [],
                    cartaBlank: cartaOriginal.img,
                    statsMax: { 
                        coragem: cartaOriginal.stats?.c || 0, 
                        poder: cartaOriginal.stats?.p || 0, 
                        sabedoria: cartaOriginal.stats?.s || 0, 
                        velocidade: cartaOriginal.stats?.v || 0, 
                        energia: cartaOriginal.stats?.e || 0 
                    },
                    hpAtual: cartaOriginal.stats?.e || 0,
                    fichasHabilidade: fichasReais,
                    temEfeito: temEfeitoReal,
                    textoCarta: textoCartaReal,
                    equipamento: equipOriginal ? { nome: equipOriginal.nome, img: equipOriginal.img, efeito: equipOriginal.efeito } : null,
                    equipamentoRevelado: false,
                    revelada: false
                };
            }
        }
    });

  // 2. PUXA O DECK DO OPONENTE DA NUVEM (O Handshake)
    window.montarDeckOponente = function(deckOp) {
        if (!deckOp || window.deckInimigoMontado) return; 
        window.deckInimigoMontado = true; 
        
        // Se a expansão ainda não foi feita (ex: simulador offline)
        if (!deckOp.criaturas_objs && typeof window.expandirDeckParaOnline === "function") {
            deckOp = window.expandirDeckParaOnline(deckOp);
        }

        let equipsOpFlat = [];
        if (deckOp.equipamentos_objs) {
            for (let k in deckOp.equipamentos_objs) if (deckOp.equipamentos_objs[k]) equipsOpFlat.push(deckOp.equipamentos_objs[k]);
        }
        let eqOpIndex = 0;

        // 🔥 CORREÇÃO DO 1x1: Oponente precisa usar o Object.keys real do banco, não apenas forçar nos primeiros slots
        let temCriaturaArray = Array.isArray(deckOp.criaturas_objs);
        let modoBatalha = deckOp.modo || (window.estadoDrome ? window.estadoDrome.modo : "6x6"); // Descobre o modo da partida
        
        chaves.forEach((chave, index) => {
            let cartaOp = null;
            let equipOp = null;

            // Se for modo 1x1, a única carta sempre tem que ir para a gaveta c6 (index 5)
            if (modoBatalha === "1x1" || modoBatalha.includes("1x1")) {
                if (index === 5) { // Index 5 é a gaveta 'c6'
                    // Pega o primeiro item da lista do Firebase (que ele espremeu para a posição 0)
                    cartaOp = temCriaturaArray ? deckOp.criaturas_objs[0] : (deckOp.criaturas_objs[5] || deckOp.criaturas_objs[0] || null);
                    equipOp = deckOp.equipamentos_objs ? (deckOp.equipamentos_objs[5] || deckOp.equipamentos_objs[0] || null) : null;
                }
            } else {
                // Comportamento normal para batalhas 6x6 e 3x3
                cartaOp = temCriaturaArray ? deckOp.criaturas_objs[index] : (deckOp.criaturas_objs[index] || null);
                equipOp = deckOp.equipamentos_objs ? deckOp.equipamentos_objs[index] : null;
            }
            
            if (cartaOp && !equipOp && eqOpIndex < equipsOpFlat.length) {
                equipOp = equipsOpFlat[eqOpIndex];
            }
            if (cartaOp) eqOpIndex++;
            
            if (cartaOp) {
                let fichasReais = 0;
                let temEfeitoReal = false;
                let textoCartaReal = "";

                if (typeof MONSTROS !== 'undefined') {
                    let cartaDB = MONSTROS.find(m => m.nome === cartaOp.nome);
                    if (cartaDB) {
                        if (cartaDB.fichasHabilidade !== undefined) fichasReais = parseInt(cartaDB.fichasHabilidade);
                        temEfeitoReal = cartaDB.temEfeito || false;
                        textoCartaReal = cartaDB.textoCarta || "";
                    }
                }

                window.campoOponente[chave] = {
                    dono: 'oponente',
                    nome: cartaOp.nome,
                    tribo: cartaOp.tribo || "Azul",
                    elementos: cartaOp.elementos || [],
                    cartaBlank: cartaOp.img || cartaOp.cartaBlank,
                    statsMax: { 
                        coragem: cartaOp.stats?.c || 0, 
                        poder: cartaOp.stats?.p || 0, 
                        sabedoria: cartaOp.stats?.s || 0, 
                        velocidade: cartaOp.stats?.v || 0, 
                        energia: cartaOp.stats?.e || 0 
                    },
                    hpAtual: cartaOp.stats?.e || 0,
                    fichasHabilidade: fichasReais,
                    temEfeito: temEfeitoReal,
                    textoCarta: textoCartaReal,
                    equipamento: equipOp ? { nome: equipOp.nome, img: equipOp.img, efeito: equipOp.efeito } : null,
                    equipamentoRevelado: false,
                    revelada: false
                };
            }
        });
        // 🔥 MEMÓRIA DO OPONENTE: Salva os locais do inimigo na nossa máquina!
        window.locaisOponente = deckOp.locais || deckOp.locais_objs || [];
        window.qtdBaralhoOponente = deckOp.ataques_objs ? deckOp.ataques_objs.length : 20;
        window.qtdMaoOponente = 3;
        window.qtdBaralhoOponente -= 3; 

        atualizarTelaBatalha(); 
        
        if (salaId && salaId !== "sala_simulada") {
            window.salaBatalhaAtual = salaId;
            window.souP1Batalha = souP1;
            
            localStorage.setItem('drome_ticket_batalha', JSON.stringify({ salaId: salaId, souP1: souP1 }));
            
            window.iniciarEscutaDeTurnoOnline(); 
            if (typeof window.iniciarEscutaAcoesOnline === 'function') window.iniciarEscutaAcoesOnline(); 
            if (typeof window.iniciarSistemaAntiAFK === 'function') window.iniciarSistemaAntiAFK(); 
        }
        
        setTimeout(() => { window.abrirJokenpo(); }, 800); 
    }; // <-- Fecha apenas a função montarDeckOponente!

    // 👇 A CONEXÃO COM O FIREBASE AGORA ESTÁ DENTRO DA FUNÇÃO PRINCIPAL NOVAMENTE!
    if (salaId && salaId !== "sala_simulada") {
        window.mostrarMensagemScanner("📡 Conectando ao oponente...");
        
        window._dbGet('salas_drome/' + salaId).then(snap => {
            let sala = snap.val();
            let deckInimigo = souP1 ? sala.p2.deck : sala.p1.deck;
            
            if (!deckInimigo) {
                window.mostrarMensagemScanner("Aguardando sincronização do oponente...");
                window._dbOn('salas_drome/' + salaId, snapEspera => {
                    let s = snapEspera.val();
                    if (s && s.status === "pronta") {
                        let deckAtualizado = souP1 ? s.p2.deck : s.p1.deck;
                        if (deckAtualizado) {
                            window.mostrarMensagemScanner("⚡ Sinal interceptado! Carregando monstros...");
                            window.montarDeckOponente(deckAtualizado);
                        }
                    }
                });
            } else {
                window.mostrarMensagemScanner("⚡ Sinal interceptado! Carregando monstros...");
                window.montarDeckOponente(deckInimigo);
            }
        });
    } else {
        window.mostrarMensagemScanner("Simulando batalha...");
        window.montarDeckOponente(window.estadoDrome.deckSelecionado);
    }
}; // ✅ AGORA SIM! A função principal carregarDeckParaBatalha fecha AQUI no lugar certo!


function atualizarTelaBatalha() {
    const slots = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

    // 🔥 NOVO: DETETIVE DE LOCAIS (Para Auras Globais da Mesa de forma Sincronizada)
    let temAuraMagma = window.nomeLocalAtivoAtual === "A Barragem de Magma";

    // ==========================================
    // 🕵️‍♂️ DETETIVE DE AURAS - SEU LADO DA MESA
    // ==========================================
    let temGuruAuraJog = false;
    slots.forEach(slotId => {
        let carta = campoJogador[slotId];
        if (carta && carta.nome === "Guru" && carta.hpAtual > 0) temGuruAuraJog = true;
    });

    slots.forEach(slotId => {
        const el = document.getElementById('jog-' + slotId);
        let carta = campoJogador[slotId];
        
        if (carta) {
            let dbCartaOriginal = typeof MONSTROS !== 'undefined' ? MONSTROS.find(m => m.nome === carta.nome) : null;
            let ehNaty = carta.nome === "Naty";

            // 🌪️ AURA GURU (VENTO)
            if (temGuruAuraJog && carta.nome !== "Guru") {
                if (!carta.elementos) carta.elementos = [];
                if (!carta.elementos.includes('Ar')) carta.elementos.push('Ar');
            } else {
                let temArNatural = dbCartaOriginal && dbCartaOriginal.elementos && dbCartaOriginal.elementos.map(e => e.toLowerCase()).includes('ar');
                if (!temArNatural && !ehNaty && carta.elementos) {
                    carta.elementos = carta.elementos.filter(el => el.toLowerCase() !== 'ar');
                }
            }

            // 🔥 AURA BARRAGEM DE MAGMA (FOGO) - Sincronização Global por Nome
            if (temAuraMagma) {
                if (!carta.elementos) carta.elementos = [];
                if (!carta.elementos.map(e => e.toLowerCase()).includes('fogo')) {
                    carta.elementos.push('Fogo');
                }
            } else {
                let temFogoNatural = dbCartaOriginal && dbCartaOriginal.elementos && dbCartaOriginal.elementos.map(e => e.toLowerCase()).includes('fogo');
                if (!temFogoNatural && !ehNaty && carta.elementos) {
                    carta.elementos = carta.elementos.filter(el => el.toLowerCase() !== 'fogo');
                }
            }
        }
        if(el) el.innerHTML = desenharMiniCarta(carta);
    });

    // ==========================================
    // 🕵️‍♂️ DETETIVE DE AURAS - LADO DO OPONENTE
    // ==========================================
    const slotsOp = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
    let temGuruAuraOp = false;

    if (window.campoOponente) {
        slotsOp.forEach(slotId => {
            let cartaOp = window.campoOponente[slotId];
            if (cartaOp && cartaOp.nome === "Guru" && cartaOp.hpAtual > 0) temGuruAuraOp = true;
        });
    }

    slotsOp.forEach(slotId => {
        const el = document.getElementById('op-' + slotId);
        let cartaOp = window.campoOponente ? window.campoOponente[slotId] : null;

        if (cartaOp) {
            let dbCartaOpOriginal = typeof MONSTROS !== 'undefined' ? MONSTROS.find(m => m.nome === cartaOp.nome) : null;
            let ehNatyOp = cartaOp.nome === "Naty";

            // 🌪️ AURA GURU (VENTO) oponente
            if (temGuruAuraOp && cartaOp.nome !== "Guru") {
                if (!cartaOp.elementos) cartaOp.elementos = [];
                if (!cartaOp.elementos.includes('Ar')) cartaOp.elementos.push('Ar');
            } else {
                let temArNaturalOp = dbCartaOpOriginal && dbCartaOpOriginal.elementos && dbCartaOpOriginal.elementos.map(e => e.toLowerCase()).includes('ar');
                if (!temArNaturalOp && !ehNatyOp && cartaOp.elementos) {
                    cartaOp.elementos = cartaOp.elementos.filter(el => el.toLowerCase() !== 'ar');
                }
            }

            // 🔥 AURA BARRAGEM DE MAGMA (FOGO) oponente - Sincronização Global por Nome
            if (temAuraMagma) {
                if (!cartaOp.elementos) cartaOp.elementos = [];
                if (!cartaOp.elementos.map(e => e.toLowerCase()).includes('fogo')) {
                    cartaOp.elementos.push('Fogo');
                }
            } else {
                let temFogoNaturalOp = dbCartaOpOriginal && dbCartaOpOriginal.elementos && dbCartaOpOriginal.elementos.map(e => e.toLowerCase()).includes('fogo');
                if (!temFogoNaturalOp && !ehNatyOp && cartaOp.elementos) {
                    cartaOp.elementos = cartaOp.elementos.filter(el => el.toLowerCase() !== 'fogo');
                }
            }
        }
        if(el) el.innerHTML = desenharMiniCarta(cartaOp); 
    });

    atualizarContadorFichasHabilidade();
    atualizarDecksEMaoCards(); 
    atualizarMugicsDaTela(); 
    
    // 🔥 AUTO-SAVE (CHECKPOINT)
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        let modoAtual = window.estadoDrome ? window.estadoDrome.modo : "6x6";
        let saveState = {
            campoJogador: campoJogador,
            campoOponente: window.campoOponente,
            cemiterio: window.cemiterio,
            cemiterioOponente: window.cemiterioOponente,
            lixoAtaques: window.lixoAtaques,
            lixoAtaquesOponente: window.lixoAtaquesOponente,
            pontosAtaque: window.pontosAtaque,
            maoAtaques: window.maoAtaques,
            baralhoAtaques: window.baralhoAtaques,
            jogadorMugics: window.jogadorMugics,
            qtdBaralhoOponente: window.qtdBaralhoOponente,
            qtdMaoOponente: window.qtdMaoOponente,
            estadoTurno: window.estadoTurno,
            ultimaAcaoProcessada: window.ultimaAcaoProcessada,
            modo: modoAtual, 
            localAtivoAtual: window.localAtivoAtual,
            nomeLocalAtivoAtual: window.nomeLocalAtivoAtual,
            estadoCombate: window.estadoCombate,
            combateFinalizadoNesteTurno: window.combateFinalizadoNesteTurno,
            combateIniciadoNesteTurno: window.combateIniciadoNesteTurno,
            modoAlvo: window.modoAlvo,
            conjuradorMugicAtual: window.conjuradorMugicAtual,
            slotSelecionadoMovimento: window.slotSelecionadoMovimento,
            deckSelecionado: window.estadoDrome ? window.estadoDrome.deckSelecionado : null,
            locaisOponente: window.locaisOponente,
            donoDaRoletaLocal: window.donoDaRoletaLocal
        };
        localStorage.setItem('drome_save_state', JSON.stringify(saveState));
    }
}

function atualizarMugicsDaTela() {

    let slotsJogador = document.querySelectorAll('.lado-jogador .hex-mugic');

    slotsJogador.forEach((slot, index) => {

        let mugic = window.jogadorMugics[index];

        if (mugic) {

            slot.style.backgroundImage = `url('${mugic.img}')`;

            slot.style.backgroundSize = 'cover';

            slot.style.backgroundPosition = 'center';

            slot.style.cursor = 'pointer';

            slot.onclick = () => window.verMugicModal(index);

        } else {

            slot.style.backgroundImage = 'none';

            slot.style.cursor = 'default';

            slot.onclick = null;

        }

    });



    let slotsOponente = document.querySelectorAll('.lado-oponente .hex-mugic');

    slotsOponente.forEach((slot) => {

        slot.style.backgroundImage = `url('${URL_FUNDO_CARTA}')`;

        slot.style.backgroundSize = 'cover';

        slot.style.backgroundPosition = 'center';

    });

}



function atualizarContadorFichasHabilidade() {

    function renderizarBotaoFichas(seletorLado, ladoId, totalFichas) {

        const containerFichas = document.querySelector(`${seletorLado} .container-fichas-js`);

        if(containerFichas && !document.getElementById(`btn-contador-${ladoId}`)) {

            const btnHTML = `

                <button class="btn-total-fichas" id="btn-contador-${ladoId}">

                    <span id="txt-fichas-${ladoId}">Fichas: <span class="total-number" id="valor-total-${ladoId}">${totalFichas}</span></span>

                </button>

            `;

            containerFichas.innerHTML = btnHTML;

            document.getElementById(`btn-contador-${ladoId}`).addEventListener('click', () => abrirModalFichas(ladoId));

        } else if (document.getElementById(`valor-total-${ladoId}`)) {

            document.getElementById(`valor-total-${ladoId}`).textContent = totalFichas;

        }

    }



    if(!window.campoOponente) window.campoOponente = { c1: null, c2: null, c3: null, c4: null, c5: null, c6: null };



    let totalJogador = 0;

    let totalOponente = 0;

    

    let todasAsCartas = [...Object.values(campoJogador), ...Object.values(window.campoOponente)];



    todasAsCartas.forEach(c => { 

        if (c && c.fichasHabilidade) {

            if (c.dono === 'jogador') totalJogador += c.fichasHabilidade;

            else if (c.dono === 'oponente') totalOponente += c.fichasHabilidade;

        }

    });



    renderizarBotaoFichas('.lado-jogador', 'jogador', totalJogador);

    renderizarBotaoFichas('.lado-oponente', 'oponente', totalOponente);

}



function abrirModalFichas(ladoId) {

    let listaHTML = '';

    const tituloModal = ladoId === 'oponente' ? 'FICHAS DO OPONENTE' : 'MINHAS FICHAS';

    

    let todasAsCartas = [...Object.values(campoJogador), ...Object.values(window.campoOponente)];

    

    todasAsCartas.forEach(c => {

        if (c && c.dono === ladoId) {

            const fichas = c.fichasHabilidade || 0;

            const semFichasClass = fichas === 0 ? 'sem-fichas' : '';

            listaHTML += `

                <div class="criatura-fichas-item ${semFichasClass}">

                    <div class="criatura-fichas-art" style="background-image: url('${c.cartaBlank}')"></div>

                    <div class="criatura-fichas-info">

                        <div class="criatura-fichas-nome">${c.nome}</div>

                        <div class="criatura-fichas-tribo">${c.tribo}</div>

                    </div>

                    <div class="criatura-fichas-valor">${fichas}</div>

                </div>

            `;

        }

    });



    if(listaHTML === '') listaHTML = '<p style="color:#aaa; text-align:center;">Sem criaturas com fichas no momento.</p>';



    const modalHTML = `

        <div class="modal-overlay" id="overlay-fichas">

            <div class="modal-content-fichas">

                <span class="fechar-modal-fichas" id="fechar-modal-fichas">×</span>

                <h3>${tituloModal}</h3>

                <div class="fichas-lista">

                    ${listaHTML}

                </div>

            </div>

        </div>

    `;



    document.getElementById('tela-batalha').insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('fechar-modal-fichas').addEventListener('click', fecharModalFichas);

    document.getElementById('overlay-fichas').addEventListener('click', function(e) { if(e.target === this) fecharModalFichas(); });

}



function fecharModalFichas() {

    const el = document.getElementById('overlay-fichas');

    if(el) el.remove();

}



window.abrirModalAcoesCriatura = function(fullId, criatura) {
    if (document.getElementById('overlay-acoes')) return;

    let botoesHTML = "";
    let emCombate = window.estadoCombate && window.estadoCombate.ativo;

    // ==========================================
    // 👁️ SE A CRIATURA ESTIVER OCULTA (VIRADA PARA BAIXO)
    // ==========================================
    if (criatura.revelada === false) {
        botoesHTML += `<p style="font-size: 11px; color: #aaa; margin-bottom: 10px;">Esta criatura está oculta. Revele-a para usar habilidades, magias e equipamentos.</p>`;
        
        // Pode colocar no Burst para revelar!
        if (!window.aguardandoResposta) {
            botoesHTML += `<button class="btn-acao-modal" style="border-color: #ffd700; color: #ffd700; font-size: 16px; margin-bottom: 10px;" onclick="window.acionarRevelarCriatura('${fullId}')">👁️ Revelar Campeão</button>`;
        }

        // Criaturas ocultas podem se mover!
        if (!emCombate && !criatura.moveuNesteTurno) {
            botoesHTML += `<button class="btn-acao-modal btn-mover" onclick="window.selecionarParaMovimento('${fullId}')">Prepara para Mover</button>`;
        } else if (!emCombate && criatura.moveuNesteTurno) {
            botoesHTML += `<p style="font-size: 10px; color: #ff9800; margin-bottom: 10px;">Esta criatura já se moveu neste turno.</p>`;
        } else if (emCombate) {
            botoesHTML += `<p style="font-size: 10px; color: #ff9800; margin-bottom: 10px;">Movimento bloqueado durante o Combate!</p>`;
        }
    } 
    // ==========================================
    // 🌟 SE A CRIATURA ESTIVER REVELADA (FACE PARA CIMA)
    // ==========================================
    else {
        if (!emCombate && !criatura.moveuNesteTurno) {
            botoesHTML += `<button class="btn-acao-modal btn-mover" onclick="window.selecionarParaMovimento('${fullId}')">Prepara para Mover</button>`;
        } else if (!emCombate && criatura.moveuNesteTurno) {
            botoesHTML += `<p style="font-size: 10px; color: #ff9800; margin-bottom: 10px;">Esta criatura já se moveu neste turno.</p>`;
        } else if (emCombate) {
            botoesHTML += `<p style="font-size: 10px; color: #ff9800; margin-bottom: 10px;">Movimento bloqueado durante o Combate!</p>`;
        }

        let textoMinusculo = (criatura.textoCarta || "").toLowerCase();
        let habilidadeAtiva = textoMinusculo.includes('descarte') || textoMinusculo.includes('gaste') || textoMinusculo.includes('ficha');
        let dbCarta = typeof MONSTROS !== 'undefined' ? MONSTROS.find(m => m.nome === criatura.nome) : null;
        let custoHab = (dbCarta && dbCarta.custoHabilidade !== undefined) ? dbCarta.custoHabilidade : 1;

        if (criatura.temEfeito && habilidadeAtiva) {
            if (criatura.fichasHabilidade >= custoHab) {
                botoesHTML += `<button class="btn-acao-modal" style="border-color: #ff9800; color: #ff9800;" onclick="window.usarHabilidade('${fullId}')">Usar Habilidade</button>`;
            } else {
                botoesHTML += `<button class="btn-acao-modal" style="border-color: #555; color: #555; background: #222;" disabled>Usar Habilidade (${custoHab} Fichas)</button>`;
            }
        }

        if (criatura.fichasHabilidade > 0) {
            botoesHTML += `<button class="btn-acao-modal" style="border-color: #00bcd4; color: #00bcd4;" onclick="window.prepararMugic('${fullId}')">Usar Mugic</button>`;
        }

        if (criatura.equipamento) {
            if (!criatura.equipamentoRevelado) {
                botoesHTML += `<button class="btn-acao-modal btn-revelar" onclick="window.revelarEquipamento('${fullId}')">Revelar Equipamento</button>`;
            } else {
                botoesHTML += `<button class="btn-acao-modal btn-ver" onclick="window.verEquipamentoModal('${fullId}')">Ver Equipamento</button>`;
                botoesHTML += `<button class="btn-acao-modal" style="border-color: #ff5555; color: #ff5555; margin-top: 10px;" onclick="window.descartarEquipamentoMesa('${fullId}')">Descartar Equipamento</button>`;
                if (criatura.equipamento.nome === "Bracelete de cristal" || criatura.equipamento.nome === "Bracelete de Cristal") {
                    botoesHTML += `<button class="btn-acao-modal" style="border-color: #00bcd4; color: #00bcd4; margin-top: 5px;" onclick="window.iniciarMiraCuraVeneno('${fullId}')">🤝 Curar Veneno</button>`;
                }
            }
        }
    }

    botoesHTML += `<button class="btn-acao-modal btn-cancelar" onclick="fecharModalAcoes()">Cancelar</button>`;

    // Imagem do modal: se oculta, mostra o verso.
    let imgModal = criatura.revelada === false ? URL_FUNDO_CARTA : criatura.cartaBlank;
    let nomeModal = criatura.revelada === false ? "Campeão Oculto" : criatura.nome;

    const modalHTML = `
        <div class="modal-overlay" id="overlay-acoes">
            <div class="modal-content-fichas" style="text-align:center; max-height: 90vh; overflow-y: auto;">
                <h3 style="color:#4CAF50;margin-bottom:5px;">${nomeModal}</h3>
                
                <div onclick="window.ampliarCartaClicada('${imgModal}', '${fullId}')" style="width:140px;height:200px;margin:0 auto 10px auto;background-image:url('${imgModal}');background-size:cover;background-position:center;border:2px solid #4CAF50;border-radius:10px;box-shadow: 0 0 15px rgba(76, 175, 80, 0.4); cursor: pointer;">
                    <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; opacity: 0; background: rgba(0,0,0,0.5); border-radius: 8px; transition: 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                        <span style="color: white; font-weight: bold; font-size: 12px;">🔍 AMPLIAR</span>
                    </div>
                </div>
                
                <p style="font-size:14px; color:#ffd700; margin-bottom:5px;">Fichas Atuais: <b style="font-size:18px;">${criatura.fichasHabilidade}</b></p>
                <p style="font-size:10px;color:#aaa;margin-bottom:15px;line-height:1.3;">${criatura.revelada === false ? 'Revele o campeão para ler suas habilidades.' : (criatura.textoCarta || 'Sem efeito especial.')}</p>
                
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${botoesHTML}
                </div>
            </div>
        </div>
    `;

    document.getElementById('tela-batalha').insertAdjacentHTML('beforeend', modalHTML);
    
    let modalOpcoes = document.getElementById('overlay-acoes');
    if (modalOpcoes) {
        modalOpcoes.style.pointerEvents = 'none';
        setTimeout(() => { modalOpcoes.style.pointerEvents = 'auto'; }, 350);
    }
    document.getElementById('overlay-acoes').addEventListener('click', function(e) { if(e.target === this) fecharModalAcoes(); });
};


// 🔥 FUNÇÃO NOVA E TURBINADA: Amplia a carta com HUD de Batalha e Modo Detetive!
window.ampliarCartaClicada = function(imgUrl, fullId) {
    let overlayHTML = "";
    let corBorda = "rgba(76, 175, 80, 0.8)"; // Verde base

    // 1. Tenta achar a criatura VIVA na mesa usando o Slot
    let criatura = null;
    if (fullId) {
        criatura = obterCriaturaNoSlot(fullId);
    }

    // 2. 🕵️‍♂️ MODO DETETIVE: Se não achou na mesa (Lixo, Mão, etc), procura no Banco de Dados Global usando a Imagem!
    let cartaDB = null;
    if (!criatura) {
        if (typeof MONSTROS !== 'undefined') cartaDB = MONSTROS.find(m => m.img === imgUrl || m.cartaBlank === imgUrl);
        if (!cartaDB && typeof ATAQUES !== 'undefined') cartaDB = ATAQUES.find(a => a.img === imgUrl || a.cartaBlank === imgUrl);
        if (!cartaDB && typeof MAGIAS !== 'undefined') cartaDB = MAGIAS.find(ma => ma.img === imgUrl || ma.cartaBlank === imgUrl);
        if (!cartaDB && typeof EQUIPAMENTOS !== 'undefined') cartaDB = EQUIPAMENTOS.find(e => e.img === imgUrl || e.cartaBlank === imgUrl);
        if (!cartaDB && typeof LOCAIS_DB !== 'undefined') cartaDB = LOCAIS_DB.find(l => l.img === imgUrl || l.cartaBlank === imgUrl);
    }

    // 3. Monta o HUD se for uma CRIATURA (Viva ou Morta)
    if (criatura || (cartaDB && cartaDB.statsMax)) {
        corBorda = (criatura && criatura.dono === 'oponente') ? "#e53935" : "#4CAF50"; // Verde (Você) ou Vermelho (Inimigo)
        
        let baseStats = criatura ? criatura.statsMax : cartaDB.statsMax;
        
        let hpMax = criatura ? (criatura.hpMax || baseStats?.energia || 0) : (cartaDB.energia || baseStats?.energia || 0);
        let hpAtual = criatura ? (criatura.hpAtual !== undefined ? criatura.hpAtual : hpMax) : 0; // Se estiver no lixo, HP = 0
        
        let pct = Math.max(0, Math.min(100, (hpAtual / hpMax) * 100));
        let corHp = pct > 50 ? 'lime' : pct > 20 ? 'orange' : 'red';
        
        let c = criatura ? (criatura.coragem || baseStats?.coragem || 0) : (cartaDB.coragem || baseStats?.coragem || 0);
        let p = criatura ? (criatura.poder || baseStats?.poder || 0) : (cartaDB.poder || baseStats?.poder || 0);
        let s = criatura ? (criatura.sabedoria || baseStats?.sabedoria || 0) : (cartaDB.sabedoria || baseStats?.sabedoria || 0);
        let v = criatura ? (criatura.velocidade || baseStats?.velocidade || 0) : (cartaDB.velocidade || baseStats?.velocidade || 0);

        let statusMorte = (!criatura && hpAtual === 0) ? `<span style="position:absolute; top:-25px; left:50%; transform:translateX(-50%); background:#e53935; color:#fff; font-size:10px; font-weight:bold; padding:2px 8px; border-radius:4px; border:1px solid #fff; z-index:100; text-shadow:none;">DESTRUÍDA</span>` : "";

        overlayHTML = `
            ${statusMorte}
            <div style="position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); width: 95%; max-width: 350px; background: rgba(0,0,0,0.9); border: 2px solid ${corBorda}; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 0 25px black;">
                <div style="width: 100%; background: #222; height: 18px; border-radius: 8px; overflow: hidden; position: relative; border: 1px solid #555;">
                    <div style="width: ${pct}%; background: ${corHp}; height: 100%; transition: width 0.3s;"></div>
                    <span style="position: absolute; top:0; left:0; width:100%; text-align:center; font-size: 13px; font-weight: bold; color: white; line-height: 18px; text-shadow: 0 0 4px black, 0 0 4px black;">HP: ${hpAtual} / ${hpMax}</span>
                </div>
                <div style="display: flex; justify-content: space-around; font-size: 18px; color: white; font-family: monospace; font-weight: bold; text-shadow: 0 0 5px black;">
                    <span>❤️ ${c}</span>
                    <span>⚡ ${p}</span>
                    <span>👁️ ${s}</span>
                    <span>💨 ${v}</span>
                </div>
            </div>
        `;
    } 
    // 4. Monta um mini-HUD descritivo para CARTAS NORMAIS (Ataques, Magias, Equipamentos, Locais)
    else if (cartaDB) {
        corBorda = "#ffd700"; // Dourado
        let txtEfeito = cartaDB.efeito || cartaDB.textoCarta || "Sem descrição.";
        let subtitulo = cartaDB.custo !== undefined ? `Custo: ${cartaDB.custo} | Dano: ${cartaDB.danoBase || 0}` : "Especial";
        
        overlayHTML = `
            <div style="position: absolute; bottom: -45px; left: 50%; transform: translateX(-50%); width: 95%; max-width: 350px; background: rgba(0,0,0,0.95); border: 2px solid ${corBorda}; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 5px; box-shadow: 0 0 25px black; text-align: center;">
                <span style="color: ${corBorda}; font-weight: bold; font-size: 16px; font-family: 'Arial Black', sans-serif;">${cartaDB.nome}</span>
                <span style="color: #ff5555; font-weight: bold; font-size: 11px;">${subtitulo}</span>
                <span style="color: #ccc; font-size: 10px; font-style: italic; max-height: 50px; overflow-y: auto; padding: 0 5px;">"${txtEfeito}"</span>
            </div>
        `;
    }

    const modalAmpliadoHTML = `
        <div class="modal-overlay" id="overlay-carta-ampliada" style="z-index: 1000000; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; flex-direction: column;" onclick="this.remove()">
            <div style="position: relative; display: flex; justify-content: center; align-items: center; margin-bottom: ${cartaDB && !cartaDB.statsMax ? '50px' : '20px'};">
                <img src="${imgUrl}" style="max-width: 95vw; max-height: 75vh; border-radius: 15px; box-shadow: 0 0 30px ${corBorda};">
                ${overlayHTML}
            </div>
            <p style="color: #aaa; font-size: 12px; font-family: monospace; margin-top: 15px; text-shadow: 0 0 5px black;">Toque em qualquer lugar para fechar</p>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalAmpliadoHTML);
};



window.fecharModalAcoes = function() {

    const el = document.getElementById('overlay-acoes');

    if(el) el.remove();

}



window.verEquipamentoModal = function(fullId) {

    window.fecharModalAcoes();

    let criatura = obterCriaturaNoSlot(fullId);

    if (!criatura || !criatura.equipamento) return;

    

    const equip = criatura.equipamento;

    const modalHTML = `

        <div class="modal-overlay" id="overlay-ver-equip">

            <div class="modal-content-fichas" style="text-align:center;">

                <span class="fechar-modal-fichas" onclick="document.getElementById('overlay-ver-equip').remove()">×</span>

                <h3 style="color:#ffd700;margin-bottom:15px;">Equipamento</h3>

                <div style="width:120px;height:120px;margin:0 auto 15px auto;background-image:url('${equip.img}');background-size:cover;border:2px solid #ffd700;border-radius:10px;"></div>

                <h4 style="color:#fff;margin-bottom:5px;">${equip.nome}</h4>

                <p style="font-size:11px;color:#ccc;line-height:1.4;">${equip.efeito}</p>

            </div>

        </div>

    `;

    document.getElementById('tela-batalha').insertAdjacentHTML('beforeend', modalHTML);

}



window.verMugicModal = function(index) {

    let mugic = window.jogadorMugics[index];

    if (!mugic) return;

    

    const modalHTML = `

        <div class="modal-overlay" id="overlay-ver-mugic">

            <div class="modal-content-fichas" style="text-align:center; border: 2px solid #00bcd4;">

                <span class="fechar-modal-fichas" onclick="document.getElementById('overlay-ver-mugic').remove()">×</span>

                <h3 style="color:#00bcd4;margin-bottom:15px;">Magia (Mugic)</h3>

                <div style="width:120px;height:170px;margin:0 auto 15px auto;background-image:url('${mugic.img}');background-size:cover;background-position:center;border:2px solid #00bcd4;border-radius:8px;box-shadow: 0 0 15px rgba(0,188,212,0.5);"></div>

                <h4 style="color:#fff;margin-bottom:5px;">${mugic.nome}</h4>

                <p style="font-size:11px;color:#ccc;line-height:1.4;">${mugic.efeito || 'Use suas fichas de habilidade para conjurar.'}</p>

                

                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 15px;">

                    <button class="btn-acao-modal" style="background:#e53935;color:#fff;border:none;flex:1;" onclick="window.descartarMugic(${index})">USAR E DESCARTAR</button>

                    <button class="btn-acao-modal" style="background:#555;color:#fff;border:none;flex:1;" onclick="document.getElementById('overlay-ver-mugic').remove()">FECHAR</button>

                </div>

            </div>

        </div>

    `;

    document.getElementById('tela-batalha').insertAdjacentHTML('beforeend', modalHTML);

}





// 🔥 FUNÇÃO NOVA QUE JOGA A MAGIA NO LIXO
window.descartarMugic = function(index) {
    let mugic = window.jogadorMugics[index];
    if (mugic) {
        if (!window.cemiterio) window.cemiterio = [];
        window.cemiterio.push(mugic.id); // Manda pro lixo permanente
        window.jogadorMugics[index] = null; // Tira do slot heptagonal da tela
        
        // 🔥 AVISA A NUVEM: "Acabei de gastar esta Magia!"
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'descarte_lixo', idCarta: mugic.id, categoria: 'mugic' });
        }
        
        document.getElementById('overlay-ver-mugic').remove();
        window.mostrarMensagemScanner(`✨ Mugic ${mugic.nome} ativado e enviado para o Lixo!`);
        if(window.tocarSFX) window.tocarSFX('notificacao');
        
        atualizarMugicsDaTela();
        atualizarDecksEMaoCards(); // Sobe o número do lixo
    }
};



window.ajustarTabuleiroBatalha = function(modo) {

    let opZona = document.querySelector('.lado-oponente .zona-central');

    let jogZona = document.querySelector('.lado-jogador .zona-central');



    let opLinha3 = document.getElementById('op-c1').parentElement; 

    let opLinha2 = document.getElementById('op-c4').parentElement; 

    let opLinha1 = document.getElementById('op-c6').parentElement; 

    let jogLinha3 = document.getElementById('jog-c1').parentElement; 

    let jogLinha2 = document.getElementById('jog-c4').parentElement; 

    let jogLinha1 = document.getElementById('jog-c6').parentElement; 

    

    let opMugics = document.querySelectorAll('.lado-oponente .hex-mugic');

    let jogMugics = document.querySelectorAll('.lado-jogador .hex-mugic');



    let jogDecksBottom = document.querySelectorAll('.lado-jogador .zona-lateral > div[style*="bottom: 0"]');

    let opDecksBottom = document.querySelectorAll('.lado-oponente .zona-lateral > div[style*="bottom: 0"]');



    let contadoresJog = document.querySelector('.lado-jogador .container-fichas-js')?.parentElement;

    let contadoresOp = document.querySelector('.lado-oponente .container-fichas-js')?.parentElement;



    if (modo === "6x6") {

        opLinha3.style.display = "flex"; opLinha2.style.display = "flex"; opLinha1.style.display = "flex";

        jogLinha3.style.display = "flex"; jogLinha2.style.display = "flex"; jogLinha1.style.display = "flex";

        opMugics.forEach(m => m.style.display = "block");

        jogMugics.forEach(m => m.style.display = "block");



        if(jogZona) jogZona.style.transform = "translateY(-71px)";

        if(opZona) opZona.style.transform = "translateY(-71px)"; 

        

        jogDecksBottom.forEach(el => el.style.transform = "translateY(15px)"); 

        opDecksBottom.forEach(el => el.style.transform = "translateY(15px)");



        if(contadoresJog) contadoresJog.style.transform = "translateY(-80px)";

        if(contadoresOp) contadoresOp.style.transform = "translateY(-80px)";

    } 

    else if (modo === "3x3") {

        opLinha3.style.display = "none"; opLinha2.style.display = "flex"; opLinha1.style.display = "flex";

        jogLinha3.style.display = "none"; jogLinha2.style.display = "flex"; jogLinha1.style.display = "flex";

        opMugics.forEach((m, i) => m.style.display = i >= 3 ? "none" : "block");

        jogMugics.forEach((m, i) => m.style.display = i >= 3 ? "none" : "block");



        if(jogZona) jogZona.style.transform = "translateY(-124px)"; 

        if(opZona) opZona.style.transform = "translateY(-124px)";

        

        jogDecksBottom.forEach(el => el.style.transform = "translateY(15px)"); 

        opDecksBottom.forEach(el => el.style.transform = "translateY(15px)"); 

        

        if(contadoresJog) contadoresJog.style.transform = "translateY(-80px)"; 

        if(contadoresOp) contadoresOp.style.transform = "translateY(-80px)"; 

    } 

    else if (modo && modo.includes("1x1")) {

        opLinha3.style.display = "none"; opLinha2.style.display = "none"; opLinha1.style.display = "flex";

        jogLinha3.style.display = "none"; jogLinha2.style.display = "none"; jogLinha1.style.display = "flex";

        opMugics.forEach((m, i) => m.style.display = i >= 1 ? "none" : "block");

        jogMugics.forEach((m, i) => m.style.display = i >= 1 ? "none" : "block");



        if(jogZona) jogZona.style.transform = "translateY(-176px)";

        if(opZona) opZona.style.transform = "translateY(-176px)";

        

        jogDecksBottom.forEach(el => el.style.transform = "translateY(15px)");

        opDecksBottom.forEach(el => el.style.transform = "translateY(15px)");



        if(contadoresJog) contadoresJog.style.transform = "translateY(-80px)";

        if(contadoresOp) contadoresOp.style.transform = "translateY(-80px)";

    }

}



setTimeout(atualizarTelaBatalha, 500);



const baseAdjacencia = {

    'jog-c1': ['jog-c2', 'jog-c4'],

    'jog-c2': ['jog-c1', 'jog-c3', 'jog-c4', 'jog-c5'],

    'jog-c3': ['jog-c2', 'jog-c5'],

    'jog-c4': ['jog-c1', 'jog-c2', 'jog-c5', 'jog-c6'],

    'jog-c5': ['jog-c2', 'jog-c3', 'jog-c4', 'jog-c6'],

    'jog-c6': ['jog-c4', 'jog-c5'], 

    

    'op-c1': ['op-c2', 'op-c4'],

    'op-c2': ['op-c1', 'op-c3', 'op-c4', 'op-c5'],

    'op-c3': ['op-c2', 'op-c5'],

    'op-c4': ['op-c1', 'op-c2', 'op-c5', 'op-c6'],

    'op-c5': ['op-c2', 'op-c3', 'op-c4', 'op-c6'],

    'op-c6': ['op-c4', 'op-c5']

};



window.slotSelecionadoMovimento = null;



function obterAdjacencias(fullId) {

    let adj = [...(baseAdjacencia[fullId] || [])];

    let modo = window.estadoDrome ? window.estadoDrome.modo : "6x6";



    if (modo === "6x6") {

        if (fullId === 'jog-c1') adj.push('op-c3', 'op-c2'); 

        if (fullId === 'jog-c2') adj.push('op-c3', 'op-c2', 'op-c1'); 

        if (fullId === 'jog-c3') adj.push('op-c2', 'op-c1'); 

        

        if (fullId === 'op-c3') adj.push('jog-c1', 'jog-c2');

        if (fullId === 'op-c2') adj.push('jog-c1', 'jog-c2', 'jog-c3');

        if (fullId === 'op-c1') adj.push('jog-c2', 'jog-c3');

    } 

    else if (modo === "3x3") {

        if (fullId === 'jog-c4') adj.push('op-c5', 'op-c4'); 

        if (fullId === 'jog-c5') adj.push('op-c5', 'op-c4');

        

        if (fullId === 'op-c4') adj.push('jog-c5', 'jog-c4');

        if (fullId === 'op-c5') adj.push('jog-c5', 'jog-c4');

    } 

    else if (modo && modo.includes("1x1")) {

        if (fullId === 'jog-c6') adj.push('op-c6');

        if (fullId === 'op-c6') adj.push('jog-c6');

    }



    return adj;

}



function obterCriaturaNoSlot(fullId) {

    if (fullId.startsWith('jog-')) return campoJogador[fullId.replace('jog-', '')];

    if (fullId.startsWith('op-')) return window.campoOponente[fullId.replace('op-', '')];

    return null;

}

window.obterCriaturaNoSlot = obterCriaturaNoSlot; // 🔥 A PONTE GLOBAL PARA O EFEITOS.JS
window.atualizarTelaBatalha = atualizarTelaBatalha; // 🔥 A PONTE DO RENDERIZADOR VISUAL

function setarCriaturaNoSlot(fullId, criatura) {

    if (fullId.startsWith('jog-')) campoJogador[fullId.replace('jog-', '')] = criatura;

    if (fullId.startsWith('op-')) window.campoOponente[fullId.replace('op-', '')] = criatura;

}



window.modoAlvo = null; // Guarda o que você está mirando

window.conjuradorMugicAtual = null; // Guarda quem vai lançar a magia



window.lidarComCliqueTabuleiro = function(fullId) {

    // 🔥 1. INTERCEPTADOR DE ALVOS (MIRA HOLOGRÁFICA) 🔥
    if (window.modoAlvo) {

        let alvo = obterCriaturaNoSlot(fullId);
        if (!alvo) { window.modoAlvo = null; window.retomarCronometro(); window.mostrarMensagemScanner("Mira desativada."); return; }
        // ==========================================
        // 💣 INTERCEPTADOR DA BOMBA DE FOGO
        // ==========================================
        if (window.modoAlvo.tipo === 'bomba_fogo') {
            window.modoAlvo = null; // Desliga a mira
            
            let danoBomba = 25;
            alvo.hpAtual -= danoBomba;
            if (alvo.hpAtual < 0) alvo.hpAtual = 0;

            window.mostrarMensagemScanner(`💥 KABOOM! A Bomba de Fogo explodiu em ${alvo.nome}, causando ${danoBomba} de dano!`);
            
            // O truque de Arquitetura: Reutilizamos a rede de "Dano" normal para o oponente processar o impacto sozinho!
            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                window.enviarAcaoRede({ tipo: 'dano', alvo: fullId, valor: danoBomba }); 
            }

            let elAlvo = document.getElementById(fullId);
            if(elAlvo) {
                elAlvo.style.animation = "shake 0.5s";
                setTimeout(() => { elAlvo.style.animation = ""; }, 500);
            }

            atualizarTelaBatalha();
            
           // Depois que o dano for causado, checamos se matou alguém e liberamos o jogo para continuar!
            if (alvo.hpAtual === 0) setTimeout(() => window.encerrarCombateMorte(fullId), 1000);
            else if (typeof window.checarFimDeJogo === 'function') window.checarFimDeJogo();
            
            return; 
        }

        // ==========================================
        // 🤝 INTERCEPTADOR DA CURA DE VENENO (BRACELETE)
        // ==========================================
        if (window.modoAlvo.tipo === 'cura_veneno') {
            let oradorFullId = window.modoAlvo.origem; 
            window.modoAlvo = null; 
            
            let nomeEq = window.removerEquipamentoMesa(oradorFullId, true, 'descarte'); 
            
            // 🐍 TRAVA DE INCURÁVEL
            if (alvo.envenenadoLetal) {
                window.mostrarMensagemScanner(`❌ O ${nomeEq} quebrou, mas o Veneno de Víbora em ${alvo.nome} é INCURÁVEL!`);
            } else {
                alvo.envenenado = false;
                window.mostrarMensagemScanner(`✨ Cura! ${alvo.nome} foi curado de envenenamento pelo poder do ${nomeEq}!`);
            }
            
            if(window.tocarSFX) window.tocarSFX('notificacao');
            
            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                window.enviarAcaoRede({ tipo: 'curar_veneno', alvo: fullId });
            }
            window.retomarCronometro(); // Destrava o relógio
            atualizarTelaBatalha();
            return;
        }
// ==========================================
        // 🌪️ INTERCEPTADOR DO VENTO FORTE (REVELAR INIMIGO)
        // ==========================================
        if (window.modoAlvo.tipo === 'revelar_inimigo') {
            if (alvo.dono === 'oponente' && alvo.revelada === false) {
                window.modoAlvo = null; // Desliga a mira
                
                // Revela a carta no nosso banco de dados local
                alvo.revelada = true;
                window.mostrarMensagemScanner(`👁️ A névoa dissipou! ${alvo.nome} foi revelado pelo Vento Forte!`);
                if(window.tocarSFX) window.tocarSFX('notificacao');
                
                // Treme a carta para dar impacto
                let elAlvo = document.getElementById(fullId);
                if(elAlvo) {
                    elAlvo.style.animation = "pulse 0.5s";
                    setTimeout(() => { elAlvo.style.animation = ""; }, 500);
                }

                // 🌐 O pulo do gato: já temos um sinal de rede perfeito para isso!
                if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                    window.enviarAcaoRede({ tipo: 'revelar_criatura_direto', alvo: fullId });
                }
                
                atualizarTelaBatalha();
                window.retomarCronometro();
            } else {
                window.mostrarMensagemScanner("❌ Alvo inválido! Selecione uma criatura do oponente que esteja virada para baixo.");
            }
            return; 
        }
        let ctx = window.modoAlvo;
        window.modoAlvo = null;
        
    
        
        let conjurador = obterCriaturaNoSlot(ctx.origem);
        let custo = ctx.custo || 1; // Puxa o custo salvo da habilidade (ou 1 se for Magia)

        if (!conjurador || conjurador.fichasHabilidade < custo) return;

        conjurador.fichasHabilidade -= custo; // 🔥 GASTA AS 2 FICHAS DO FRADOR AQUI!
        
        // Avisa a rede que a arma descarregou as fichas!
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'sincronizar_fichas', alvo: ctx.origem, qtd: conjurador.fichasHabilidade });
        }
        
        atualizarTelaBatalha();

        if (ctx.tipo === 'habilidade') {
            let acao = { 
                dono: conjurador.dono, 
                nomeAcao: `Habilidade de ${conjurador.nome} ➔ ${alvo.nome}`, 
                tipo: 'habilidade', 
                executar: function() { 
    // 1. Tenta achar o ID do efeito na própria carta
    let cartaOriginal = window.inventario.find(c => c.nome === conjurador.nome);
    let efeitoIdEncontrado = cartaOriginal ? cartaOriginal.efeitoId : null;

    // 2. SE NÃO ACHOU, busca no Banco de Dados oficial (MONSTROS) pelo nome!
    if (!efeitoIdEncontrado && typeof MONSTROS !== 'undefined') {
        let monstroDB = MONSTROS.find(m => m.nome === conjurador.nome);
        if (monstroDB && monstroDB.efeitoId) {
            efeitoIdEncontrado = monstroDB.efeitoId;
        }
    }

    console.log("GATILHO: Buscando efeito para ", conjurador.nome);
    console.log("GATILHO: Efeito ID encontrado:", efeitoIdEncontrado);

    if (efeitoIdEncontrado && window.MotorDeEfeitos && window.MotorDeEfeitos[efeitoIdEncontrado]) {
        window.MotorDeEfeitos[efeitoIdEncontrado](alvo, fullId, atualizarTelaBatalha, ctx);
    } else {
        window.mostrarMensagemScanner(`⚡ Efeito ativado em ${alvo.nome} (Efeito não programado).`); 
    }
}
            };


            
            window.adicionarAoBurst(acao);
        } else if (ctx.tipo === 'mugic') {
            if (!window.cemiterio) window.cemiterio = [];
            window.cemiterio.push(ctx.mugicObj.nome); // 🔥 Salvamos o NOME para o detetive achar fácil
            window.jogadorMugics[ctx.mugicIndex] = null;
            atualizarMugicsDaTela(); atualizarDecksEMaoCards();
            
            // 🔥 NUVEM: Avisa o oponente para jogar o NOME dessa magia no cemitério dele!
            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                window.enviarAcaoRede({ tipo: 'descarte_lixo', idCarta: ctx.mugicObj.nome, categoria: 'mugic' });
            }

            let acao = { 
                dono: 'jogador', 
                nomeAcao: `Mugic: ${ctx.mugicObj.nome} ➔ ${alvo.nome}`, 
                tipo: 'mugic', 
                executar: function() { 
                    // 1. Tenta achar o ID do efeito
                    let efeitoIdEncontrado = ctx.mugicObj.efeitoId;
                    if (!efeitoIdEncontrado && typeof MAGIAS !== 'undefined') {
                        let magiaDB = MAGIAS.find(m => m.nome === ctx.mugicObj.nome);
                        if (magiaDB && magiaDB.efeitoId) efeitoIdEncontrado = magiaDB.efeitoId;
                    }

                    // 2. Chama o Motor de Efeitos, igual as Habilidades!
                    if (efeitoIdEncontrado && window.MotorDeEfeitos && window.MotorDeEfeitos[efeitoIdEncontrado]) {
                        window.MotorDeEfeitos[efeitoIdEncontrado](alvo, fullId, atualizarTelaBatalha, ctx);
                    } else {
                        window.mostrarMensagemScanner(`✨ Mugic explodiu em ${alvo.nome}!`); 
                        if(window.tocarSFX) window.tocarSFX('notificacao'); 
                    }
                } 
            };
           window.adicionarAoBurst(acao);
            

        } else if (ctx.tipo === 'passiva_leona') {
            // 🔥 LEONA ATIRA NA MIRA! Coloca o tiro na Corrente (Burst)
            let acaoLeona = {
                dono: 'jogador',
                nomeAcao: `Passiva da Leona ➔ ${alvo.nome}`,
                tipo: 'habilidade',
                executar: function() {
                    alvo.hpAtual -= 5;
                    if (alvo.hpAtual < 0) alvo.hpAtual = 0;
                    
                    window.mostrarMensagemScanner(`🦁 Leona atirou e causou 5 de dano em ${alvo.nome}!`);
                    if(window.tocarSFX) window.tocarSFX('notificacao');
                    
                    // Avisa a rede pra tirar a vida do inimigo
                    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                        window.enviarAcaoRede({ tipo: 'dano', alvo: fullId, valor: 5 });
                    }
                    
                    // Treme a carta atingida
                    let elAlvo = document.getElementById(fullId);
                    if(elAlvo) {
                        elAlvo.style.animation = "shake 0.5s";
                        setTimeout(() => { elAlvo.style.animation = ""; }, 500);
                    }
                    
                    atualizarTelaBatalha();
                    if (alvo.hpAtual === 0) setTimeout(() => window.encerrarCombateMorte(fullId), 1000);
                }
            };
            window.adicionarAoBurst(acaoLeona);
            window.retomarCronometro();
        }

        return;
    }



   // 🔥 O CADEADO MODIFICADO: Se for turno do inimigo e não for Burst, permite APENAS olhar as cartas!
    if (window.estadoTurno.jogadorAtual !== 'jogador' && !window.aguardandoResposta) {
        let criaturaAlvoParaOlhar = obterCriaturaNoSlot(fullId);
        if (criaturaAlvoParaOlhar && typeof window.ampliarCartaClicada === 'function') {
            window.ampliarCartaClicada(criaturaAlvoParaOlhar.cartaBlank, fullId);
        }
        return; // Bloqueia qualquer movimentação ou menu de ação ilegal
    }



    let criaturaAlvo = obterCriaturaNoSlot(fullId);

    let el = document.getElementById(fullId);

    if (!el || el.parentElement.style.display === 'none') return;



    if (!window.slotSelecionadoMovimento) {

        if (criaturaAlvo) {

            if (criaturaAlvo.dono === 'jogador') { window.abrirModalAcoesCriatura(fullId, criaturaAlvo); } 

           else if (criaturaAlvo.dono === 'oponente') {
                // 🔥 CORREÇÃO: Clicou no oponente? Abre a visão do monstro! 
                // O equipamento pode ser lido tocando no ícone do equipamento na mini-carta.
                if (typeof window.ampliarCartaClicada === 'function') window.ampliarCartaClicada(criaturaAlvo.cartaBlank, fullId);
            }

        }

        return;

    }



    // 🔥 TRAVA: Não deixa arrastar/mover carta se a corrente estiver aberta

    if (window.aguardandoResposta) {

        window.mostrarMensagemScanner("Ação inválida. Resolva a Corrente primeiro!");

        limparDestaquesMovimento(); window.slotSelecionadoMovimento = null; return;

    }



    let idOrigem = window.slotSelecionadoMovimento;

    let criaturaOrigem = obterCriaturaNoSlot(idOrigem);



    if (idOrigem === fullId) { limparDestaquesMovimento(); window.slotSelecionadoMovimento = null; return; }



    if (criaturaAlvo && criaturaAlvo.dono === 'jogador') {

        if (criaturaAlvo.moveuNesteTurno) { window.mostrarMensagemScanner("Já agiu neste turno!"); limparDestaquesMovimento(); window.slotSelecionadoMovimento = null; return; }

        limparDestaquesMovimento(); window.slotSelecionadoMovimento = fullId; destacarAdjacentes(fullId); if(window.tocarSFX) window.tocarSFX('notificacao'); return;

    }



    if (!obterAdjacencias(idOrigem).includes(fullId)) { limparDestaquesMovimento(); window.slotSelecionadoMovimento = null; return; }



if (!criaturaAlvo) {
        // Mover para um espaço vazio sempre é permitido
        setarCriaturaNoSlot(fullId, criaturaOrigem); setarCriaturaNoSlot(idOrigem, null); criaturaOrigem.moveuNesteTurno = true; window.mostrarMensagemScanner("Avançando!");
        if (typeof window.enviarAcaoRede === 'function') window.enviarAcaoRede({ tipo: 'mover', origem: idOrigem, destino: fullId });
    } else if (criaturaAlvo.dono === 'oponente') {
        
        // 🔥 A TRAVA DE DESTRUIÇÃO: Checa se uma criatura já foi morta neste turno
        // ou se já existe um combate acontecendo agora!
        if (window.combateFinalizadoNesteTurno || (window.estadoCombate && window.estadoCombate.ativo)) {
            window.mostrarMensagemScanner("❌ AÇÃO INVÁLIDA: Uma criatura já foi destruída neste turno! Você deve passar a vez.");
            limparDestaquesMovimento(); window.slotSelecionadoMovimento = null; return;
        }

        criaturaOrigem.moveuNesteTurno = true; window.mostrarMensagemScanner("⚔️ COMBATE INICIADO!");
        if (typeof window.enviarAcaoRede === 'function') window.enviarAcaoRede({ tipo: 'combate', origem: idOrigem, destino: fullId });
        if(typeof window.iniciarCombate === 'function') window.iniciarCombate(idOrigem, fullId);
    }

    limparDestaquesMovimento(); window.slotSelecionadoMovimento = null; atualizarTelaBatalha(); 
};



function destacarAdjacentes(fullId) {

    limparDestaquesMovimento(); document.getElementById(fullId).classList.add('slot-selecionado');

    obterAdjacencias(fullId).forEach(adjId => {

        let el = document.getElementById(adjId);

        if (el && el.parentElement.style.display !== 'none') {

            let cAlvo = obterCriaturaNoSlot(adjId);

            if (!cAlvo) el.classList.add('slot-livre-movimento'); else if (cAlvo.dono === 'oponente') el.classList.add('slot-alvo-combate'); 

        }

    });

}



function limparDestaquesMovimento() { document.querySelectorAll('.slot-criatura, .zona-central > div').forEach(el => { el.classList.remove('slot-selecionado', 'slot-livre-movimento', 'slot-alvo-combate'); }); }



setTimeout(() => {

    let arena = document.querySelector('.arena-drome-container');

    if (arena) { arena.style.paddingBottom = "15px"; arena.style.paddingTop = "15px"; arena.style.boxSizing = "border-box"; }

    // ... [CSS Movement Block Skipped for brevity, already loaded normally via timeout] ...

    

    if (!document.getElementById("css-movimento")) {

        let style = document.createElement('style');

        style.id = "css-movimento";

        style.innerHTML = `
            .zona-central {
                justify-content: flex-start !important; 
                gap: 5px !important;
                position: relative !important;
                z-index: 1000 !important; /* 🔥 Joga toda a arena de criaturas pra FRENTE! */
            }
            .zona-lateral {
                position: relative !important;
                z-index: 10 !important; /* 🔥 Mantém os Locais ATRÁS da arena! */
            }
            .linha-formacao-batalha { margin: 0 !important; position: relative; z-index: 500; }


            [id^="jog-"], [id^="op-"] {

                touch-action: none !important; 

            }



            .slot-selecionado { box-shadow: 0 0 20px #ffd700, inset 0 0 10px #ffd700 !important; border-color: #ffd700 !important; transform: scale(1.05); transition: 0.2s; z-index: 100;}

            .slot-livre-movimento { box-shadow: inset 0 0 25px rgba(0,255,0,0.8), 0 0 15px rgba(0,255,0,0.5) !important; border-color: #00ff00 !important; cursor: pointer; transition: 0.2s; z-index: 90;}

            .slot-livre-movimento:hover { background: rgba(0,255,0,0.15); transform: scale(1.02); }

            .slot-alvo-combate { box-shadow: inset 0 0 25px rgba(255,0,0,0.8), 0 0 15px rgba(255,0,0,0.5) !important; border-color: #ff0000 !important; cursor: pointer; transition: 0.2s; z-index: 90;}

            .slot-alvo-combate:hover { background: rgba(255,0,0,0.15); transform: scale(1.02); }

            .mini-card-wrapper { position: relative; pointer-events: none; } 
            .mini-card-wrapper:hover { z-index: 999999; } /* 🔥 CARTA VEM PRA FRENTE AO PASSAR O DEDO */
            .mini-equip-icon { pointer-events: auto; position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; border-radius: 50%; z-index: 50; cursor: help; border: 2px solid #ffd700; display:flex; justify-content:center; align-items:center; }
            .mini-equip-icon:hover { z-index: 9999999; } /* 🔥 ÍCONE VEM MAIS PRA FRENTE AINDA */

            
            /* 🔥 O PULO DO GATO: A carta inteira salta pra frente pra não ser esmagada! */
            [id^="jog-"], [id^="op-"] { position: relative; z-index: 10; }
            [id^="jog-"]:hover, [id^="op-"]:hover { z-index: 999999 !important; }

             .mini-equip-icon.revelado { background-size: cover; background-position: center; }

            .mini-equip-icon.oculto { background: #222; color: #fff; font-weight: bold; font-size: 14px; border-color: #aaa; }

            /* 🔥 BALÃO TURBINADO: Imune às cartas da linha de baixo! */
            .equip-tooltip { display: none; position: absolute; bottom: 130%; left: 50%; transform: translateX(-50%); width: 140px; background: rgba(0,10,0,0.95); border: 1px solid #4CAF50; color: white; text-align: center; font-size: 10px; padding: 8px; border-radius: 5px; pointer-events: none; z-index: 99999999 !important; line-height: 1.4; box-shadow: 0 0 15px #000; }

            .mini-equip-icon:hover .equip-tooltip { display: block; }

            

            .btn-acao-modal { background: #112211; border: 1px solid #4CAF50; color: white; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: bold; width: 100%; transition: 0.2s; }

            .btn-acao-modal:hover { background: #4CAF50; color: black; }

            .btn-acao-modal.btn-mover { border-color: #00bcd4; color: #00bcd4; }

            .btn-acao-modal.btn-mover:hover { background: #00bcd4; color: black; }

            .btn-acao-modal.btn-revelar { border-color: #ffd700; color: #ffd700; }

            .btn-acao-modal.btn-revelar:hover { background: #ffd700; color: black; }

            .btn-acao-modal.btn-cancelar { border-color: #e53935; color: #e53935; margin-top: 10px; }

            .btn-acao-modal.btn-cancelar:hover { background: #e53935; color: white; }



            .fundo-carta-personalizado {

                background-image: url('${URL_FUNDO_CARTA}') !important;

                background-size: cover !important;

                background-position: center !important;

                background-color: transparent !important;

                color: #fff !important;

                text-shadow: 0px 0px 4px #000, 0px 0px 6px #000 !important;

                border: 2px solid #555 !important;

                position: relative !important;

            }

            .texto-deck-baixo {

                position: absolute;

                bottom: 5px;

                left: 0;

                width: 100%;

                text-align: center;

                line-height: 1.2;

                font-size: 8px; 

            }

        `;

        document.head.appendChild(style);

    }



    let zonas = document.querySelectorAll('.zona-central');

    if (zonas) zonas.forEach(z => z.style.pointerEvents = "none"); 



    let interacao = { idOrigem: null, isDragging: false, clone: null, startX: 0, startY: 0 };



    window.iniciarInteracaoSlot = function(e, fullId) {

        if (e.button === 2) return; 



        // 🔥 O CADEADO DO ARRASTAR MODIFICADO: Se for turno do inimigo, permite apenas olhar a sua carta!
        if (window.estadoTurno.jogadorAtual !== 'jogador' && !window.aguardandoResposta) {
            let criaturaAlvoParaOlhar = obterCriaturaNoSlot(fullId);
            if (criaturaAlvoParaOlhar && typeof window.ampliarCartaClicada === 'function') {
                window.ampliarCartaClicada(criaturaAlvoParaOlhar.cartaBlank, fullId);
            }
            return; // Bloqueia o arraste ilegal
        }


        let pointer = e.touches ? e.touches[0] : e; 

        interacao.idOrigem = fullId; interacao.isDragging = false; interacao.startX = pointer.clientX; interacao.startY = pointer.clientY;



        let criatura = obterCriaturaNoSlot(fullId);



        if (criatura && criatura.dono === 'jogador') {

            let emCombate = window.estadoCombate && window.estadoCombate.ativo;

            if (criatura.moveuNesteTurno && !emCombate) { window.mostrarMensagemScanner("Esta criatura já agiu!"); interacao.idOrigem = null; return; }

            

            // 🛑 Bloqueia o "arrastar" carta (criar clone visual) se a corrente estiver pedindo resposta!

            if (!emCombate && !criatura.moveuNesteTurno && !window.aguardandoResposta) {

                let elOriginal = document.getElementById(fullId);

                let rect = elOriginal.getBoundingClientRect();

                

                interacao.clone = elOriginal.cloneNode(true);

                interacao.clone.style.position = 'fixed'; interacao.clone.style.left = rect.left + 'px'; interacao.clone.style.top = rect.top + 'px';

                interacao.clone.style.width = rect.width + 'px'; interacao.clone.style.height = rect.height + 'px';

                interacao.clone.style.pointerEvents = 'none'; interacao.clone.style.zIndex = '999999';

                interacao.clone.style.opacity = '0.9'; interacao.clone.style.transform = 'scale(1.1)';

                interacao.clone.style.display = 'none'; 

                document.body.appendChild(interacao.clone);



                document.addEventListener('pointermove', moverInteracao, {passive: false});

                document.addEventListener('touchmove', moverInteracao, {passive: false});

            }

        }

        

        document.addEventListener('pointerup', soltarInteracao);

        document.addEventListener('touchend', soltarInteracao);

    };



  let ultimaSyncDrag = 0; // A memória do atraso de 80ms



    function moverInteracao(e) {

        if (!interacao.idOrigem || !interacao.clone) return;

        

        let pointer = e.touches ? e.touches[0] : e;

        

        let moveX = Math.abs(pointer.clientX - interacao.startX);

        let moveY = Math.abs(pointer.clientY - interacao.startY);



        if (!interacao.isDragging && (moveX > 25 || moveY > 25)) {

            interacao.isDragging = true;

            interacao.clone.style.display = 'flex';

            

            window.fecharModalAcoes(); 

            

            window.slotSelecionadoMovimento = interacao.idOrigem;

            destacarAdjacentes(interacao.idOrigem);

            if(window.tocarSFX) window.tocarSFX('notificacao'); 

        }



        if (interacao.isDragging) {

            if(e.cancelable) e.preventDefault(); 

            interacao.clone.style.left = (pointer.clientX - interacao.clone.offsetWidth / 2) + 'px';

            interacao.clone.style.top = (pointer.clientY - interacao.clone.offsetHeight / 2) + 'px';



            // 🌐 O TRANSMISSOR FANTASMA: Envia a posição do dedo a cada 80ms!

            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {

                let agora = Date.now();

                if (agora - ultimaSyncDrag > 80) {

                    ultimaSyncDrag = agora;

                    // Converte pixels em Porcentagem (pra funcionar em qualquer tamanho de tela)

                    let pctX = (pointer.clientX / window.innerWidth) * 100;

                    let pctY = (pointer.clientY / window.innerHeight) * 100;

                    let criaturaDrag = obterCriaturaNoSlot(interacao.idOrigem);

                    

                    if (criaturaDrag) {

                        window._dbUpdate('salas_drome/' + window.salaBatalhaAtual + '/drag/' + (window.souP1Batalha ? 'p1' : 'p2'), {

                            ativo: true, x: pctX, y: pctY, img: criaturaDrag.cartaBlank

                        });

                    }

                }

            }

        }

    }



    function soltarInteracao(e) {

        document.removeEventListener('pointermove', moverInteracao);

        document.removeEventListener('touchmove', moverInteracao);

        document.removeEventListener('pointerup', soltarInteracao);

        document.removeEventListener('touchend', soltarInteracao);



        let origem = interacao.idOrigem;



        // 🌐 DESLIGA O FANTASMA QUANDO SOLTAR A CARTA

        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {

            window._dbUpdate('salas_drome/' + window.salaBatalhaAtual + '/drag/' + (window.souP1Batalha ? 'p1' : 'p2'), { ativo: false });

        }

        

        if (interacao.isDragging) {

            let pointer = e.changedTouches ? e.changedTouches[0] : e;

            

            interacao.clone.style.display = 'none';

            let elementoAbaixo = document.elementFromPoint(pointer.clientX, pointer.clientY);

            

            let slotDestino = null;

            if (elementoAbaixo) {

                let hitBox = elementoAbaixo.closest('[id^="jog-"], [id^="op-"]');

                if (hitBox) slotDestino = hitBox.id;

            }



            interacao.clone.remove();

            interacao = { idOrigem: null, isDragging: false, clone: null };



            if (slotDestino && slotDestino !== origem) {

                if (obterAdjacencias(origem).includes(slotDestino)) {

                    window.slotSelecionadoMovimento = origem;

                    window.lidarComCliqueTabuleiro(slotDestino);

                } else {

                    limparDestaquesMovimento();

                    window.slotSelecionadoMovimento = null;

                }

            } else {

                if (slotDestino === origem) {

                    window.lidarComCliqueTabuleiro(origem);

                } else {

                    limparDestaquesMovimento();

                    window.slotSelecionadoMovimento = null;

                }

            }



        } else {

            if (interacao.clone) interacao.clone.remove();

            interacao = { idOrigem: null, isDragging: false, clone: null };

            

            window.lidarComCliqueTabuleiro(origem);

        }

    }

   ['jog', 'op'].forEach(lado => {
        ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].forEach(slot => {
            let el = document.getElementById(`${lado}-${slot}`);
            if (el) {
                if (el.parentElement) el.parentElement.style.pointerEvents = "none";
                el.style.pointerEvents = "auto";
                
                el.onclick = null; 
                el.onpointerdown = null;
                el.ontouchstart = null;

                // 🔥 CORREÇÃO: Agora a mesa INTEIRA suporta o toque de arrasto!
                // O sistema já checa de quem é a carta antes de permitir puxar.
                el.onpointerdown = (e) => window.iniciarInteracaoSlot(e, `${lado}-${slot}`);
                el.ontouchstart = (e) => window.iniciarInteracaoSlot(e, `${lado}-${slot}`);
            }
        });
    });

}, 1000);



setTimeout(() => {

    if (!document.getElementById("css-mao-cartas")) {

        let style = document.createElement('style');

        style.id = "css-mao-cartas";

        style.innerHTML = `

            .container-mao-ataques {

                position: fixed;

                bottom: -20px; 

                left: 50%;

                transform: translateX(-50%);

                display: flex;

                justify-content: center;

                align-items: flex-end;

                z-index: 9999;

                pointer-events: none; 

            }



            .carta-na-mao {

                width: 60px; 

                height: 90px;

                background: #111; 

                border: 2px solid #e53935;

                border-radius: 6px;

                margin: 0 -15px; 

                box-shadow: -4px 4px 10px rgba(0,0,0,0.6);

                transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); 

                transform-origin: bottom center; 

                pointer-events: auto; 

                cursor: pointer;

                display: flex;

                justify-content: center;

                align-items: center;

                color: #e53935;

                font-family: monospace;

                font-weight: bold;

                font-size: 10px;

                text-align: center;

            }



            .carta-na-mao:nth-child(1) { transform: rotate(-15deg) translateY(12px); }

            .carta-na-mao:nth-child(2) { transform: rotate(0deg) translateY(0px); z-index: 2; }

            .carta-na-mao:nth-child(3) { transform: rotate(15deg) translateY(12px); }



            .carta-na-mao:hover {

                transform: rotate(0deg) translateY(-40px) scale(1.4) !important;

                z-index: 100 !important;

                box-shadow: 0 15px 25px rgba(0,0,0,0.9);

                border-color: #ffd700; 

                color: #ffd700;

            }



            .container-mao-oponente {

                position: fixed;

                top: -25px; 

                left: 50%;

                transform: translateX(-50%) rotate(180deg); 

                display: flex;

                justify-content: center;

                align-items: flex-end;

                z-index: 9999;

                pointer-events: none;

            }



            .carta-oponente-na-mao {

                width: 50px; 

                height: 75px;

                background-image: url('${URL_FUNDO_CARTA}'); 

                background-size: cover;

                background-position: center;

                border: 2px solid #555;

                border-radius: 6px;

                margin: 0 -10px;

                box-shadow: -4px 4px 10px rgba(0,0,0,0.6);

            }



            .carta-oponente-na-mao:nth-child(1) { transform: rotate(-15deg) translateY(12px); }

            .carta-oponente-na-mao:nth-child(2) { transform: rotate(0deg) translateY(0px); z-index: 2; }

            .carta-oponente-na-mao:nth-child(3) { transform: rotate(15deg) translateY(12px); }

        `;

        document.head.appendChild(style);

    }



    let todasAsCartas = document.querySelectorAll('.carta-mao'); 

    if(todasAsCartas.length > 0) {

        let caixaPai = todasAsCartas[0].parentElement;

        caixaPai.className = "container-mao-ataques"; 

        todasAsCartas.forEach(carta => {

            carta.className = "carta-na-mao"; 

        });

    }



    if(!document.getElementById('mao-oponente-ui')) {

        let maoOp = document.createElement('div');

        maoOp.id = 'mao-oponente-ui';

        maoOp.className = 'container-mao-oponente';

        maoOp.innerHTML = `

            <div class="carta-oponente-na-mao"></div>

            <div class="carta-oponente-na-mao"></div>

            <div class="carta-oponente-na-mao"></div>

        `;

        document.getElementById('tela-batalha').appendChild(maoOp);

    }



}, 1200);



setTimeout(() => {

    atualizarDecksEMaoCards();

    atualizarMugicsDaTela();

}, 1300);



window.estadoTurno = {

    jogadorAtual: null, 

    turnoNumero: 0,

    fase: 'pre-jogo'

};



setTimeout(() => {

    if (!document.getElementById("css-turnos-tcg")) {

        let style = document.createElement('style');

        style.id = "css-turnos-tcg";

        style.innerHTML = `

            .tcg-banner-container {

                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;

                display: flex; justify-content: center; align-items: center;

                pointer-events: none; z-index: 100000; overflow: hidden;

            }

            .tcg-banner-bg {

                position: absolute; width: 100%; height: 150px;

                background: linear-gradient(90deg, transparent, rgba(0,0,0,0.9), transparent);

                transform: scaleY(0); transition: transform 0.2s;

            }

            .tcg-banner-texto {

                font-family: 'Arial Black', sans-serif; font-size: 45px; font-weight: 900;

                color: transparent; -webkit-text-stroke: 2px #fff;

                text-transform: uppercase; letter-spacing: 15px;

                transform: translateX(150vw) skewX(-15deg); text-shadow: 0 0 20px rgba(255,255,255,0);

            }

            

            .banner-ativo .tcg-banner-bg { transform: scaleY(1); }

            .banner-ativo .tcg-banner-texto {

                animation: rasgarTela 2.5s cubic-bezier(0.1, 0.8, 0.1, 1) forwards;

            }

            @keyframes rasgarTela {

                0% { transform: translateX(150vw) skewX(-15deg); color: transparent; text-shadow: 0 0 0px transparent; }

                20% { transform: translateX(0) skewX(-15deg); color: #fff; text-shadow: 0 0 30px currentColor; }

                80% { transform: translateX(-20px) skewX(-15deg); color: #fff; text-shadow: 0 0 10px currentColor; }

                100% { transform: translateX(-150vw) skewX(-15deg); color: transparent; text-shadow: 0 0 0px transparent; }

            }



            .jokenpo-btn {

                font-size: 40px; background: #222; border: 3px solid #4CAF50;

                border-radius: 50%; width: 80px; height: 80px; cursor: pointer;

                transition: 0.2s; color: white; display: flex; justify-content: center; align-items: center;

            }

            .jokenpo-btn:hover { background: #4CAF50; transform: scale(1.2); box-shadow: 0 0 20px #4CAF50; }

        `;

        document.head.appendChild(style);

    }

}, 1000);



window.mostrarBannerTCG = function(texto, corCorpo, corBorda, callback) {

    const container = document.createElement('div');

    container.className = 'tcg-banner-container banner-ativo';

    container.innerHTML = `

        <div class="tcg-banner-bg" style="border-top: 3px solid ${corBorda}; border-bottom: 3px solid ${corBorda}; background: linear-gradient(90deg, transparent, ${corCorpo}, transparent);"></div>

        <div class="tcg-banner-texto" style="-webkit-text-stroke: 2px ${corBorda};">${texto}</div>

    `;

    document.getElementById('tela-batalha').appendChild(container);

    

    if(window.tocarSFX) window.tocarSFX('notificacao'); 



    setTimeout(() => {

        container.remove();

        if(callback) callback();

    }, 2500); 

};







window.abrirJokenpo = function() {

    window.estadoTurno.fase = 'jokenpo';



    // Limpa a mesa de Jokenpo antiga do servidor se você for o dono da sala (P1)

    if (window.salaBatalhaAtual && window.souP1Batalha) {

        window._dbUpdate('salas_drome/' + window.salaBatalhaAtual, { jokenpo: null });

    }



    const modalHTML = `

        <div class="modal-overlay" id="overlay-jokenpo" style="z-index: 99990; background: rgba(0,0,0,0.9);">

            <div style="text-align:center; display: flex; flex-direction: column; align-items: center;">

                <h2 style="color:#ffd700; font-size:24px; margin-bottom:10px; text-shadow: 0 0 10px #ffd700;">DECIDA QUEM COMEÇA!</h2>

                <p id="jokenpo-status" style="color:#fff; margin-bottom: 30px; font-family: monospace;">Escolha sua arma...</p>

                

                <div id="jokenpo-botoes" style="display:flex; gap: 20px; margin-bottom: 30px;">

                    <button class="jokenpo-btn" onclick="window.resolverJokenpo('pedra')">✊</button>

                    <button class="jokenpo-btn" onclick="window.resolverJokenpo('papel')">✋</button>

                    <button class="jokenpo-btn" onclick="window.resolverJokenpo('tesoura')">✌️</button>

                </div>

            </div>

        </div>

    `;

    document.getElementById('tela-batalha').insertAdjacentHTML('beforeend', modalHTML);

};



window.resolverJokenpo = function(escolhaJogador) {

    const emojis = { 'pedra': '✊', 'papel': '✋', 'tesoura': '✌️' };

    const statusEl = document.getElementById('jokenpo-status');

    const boxBotoes = document.getElementById('jokenpo-botoes');



    if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") {

        // 🤖 MODO BOT (Sorteio Rápido)

        const opcoes = ['pedra', 'papel', 'tesoura'];

        const escolhaOp = opcoes[Math.floor(Math.random() * opcoes.length)];

        

        statusEl.innerHTML = `Você: ${emojis[escolhaJogador]} <br> Oponente: ${emojis[escolhaOp]}`;



        setTimeout(() => {

            if (escolhaJogador === escolhaOp) {

                statusEl.innerHTML = `<span style="color:#ff9800; font-weight:bold; font-size:18px;">EMPATE! JOGUE DE NOVO!</span>`;

                document.getElementById('overlay-jokenpo').style.animation = "shake 0.5s";

                setTimeout(() => document.getElementById('overlay-jokenpo').style.animation = "", 500);

            } 

            else if ((escolhaJogador === 'pedra' && escolhaOp === 'tesoura') || (escolhaJogador === 'papel' && escolhaOp === 'pedra') || (escolhaJogador === 'tesoura' && escolhaOp === 'papel')) {

                statusEl.innerHTML = `<span style="color:#4CAF50; font-weight:bold; font-size:24px;">VOCÊ VENCEU!</span>`;

                window.abrirEscolhaDeTurno('jogador');

            } else {

                statusEl.innerHTML = `<span style="color:#e53935; font-weight:bold; font-size:24px;">OPONENTE VENCEU!</span>`;

                setTimeout(() => {

                    document.getElementById('overlay-jokenpo').remove();

                    window.iniciarTurnoReal('oponente');

                }, 1500);

            }

        }, 1000);

    } 

    else {

        // 🌐 MODO ONLINE (Nuvem)

        boxBotoes.style.display = 'none'; // Some com os botões pra não clicar duas vezes!

        statusEl.innerHTML = `Sua arma: ${emojis[escolhaJogador]} <br> <span style="color:#00ffff; font-size:12px; margin-top: 10px; display:block;">Aguardando adversário...</span>`;

        

        let meuSlot = window.souP1Batalha ? 'p1' : 'p2';

        window._dbUpdate('salas_drome/' + window.salaBatalhaAtual + '/jokenpo', { [meuSlot]: escolhaJogador });



        // Fica escutando as duas jogadas no Firebase

        window._dbOn('salas_drome/' + window.salaBatalhaAtual + '/jokenpo', (snap) => {

            if (!snap.exists()) return;

            let jogoData = snap.val();



            if (jogoData.p1 && jogoData.p2) {

                let minhaEscolha = window.souP1Batalha ? jogoData.p1 : jogoData.p2;

                let escolhaDele = window.souP1Batalha ? jogoData.p2 : jogoData.p1;



                statusEl.innerHTML = `Você: ${emojis[minhaEscolha]} <br> Oponente: ${emojis[escolhaDele]}`;



                setTimeout(() => {

                    if (minhaEscolha === escolhaDele) {

                        statusEl.innerHTML = `<span style="color:#ff9800; font-weight:bold; font-size:18px;">EMPATE! DE NOVO!</span>`;

                        document.getElementById('overlay-jokenpo').style.animation = "shake 0.5s";

                        setTimeout(() => document.getElementById('overlay-jokenpo').style.animation = "", 500);

                        

                        boxBotoes.style.display = 'flex';

                        if (window.souP1Batalha) window._dbUpdate('salas_drome/' + window.salaBatalhaAtual, { jokenpo: null });

                    } 

                    else if ((minhaEscolha === 'pedra' && escolhaDele === 'tesoura') || (minhaEscolha === 'papel' && escolhaDele === 'pedra') || (minhaEscolha === 'tesoura' && escolhaDele === 'papel')) {

                        statusEl.innerHTML = `<span style="color:#4CAF50; font-weight:bold; font-size:24px;">VOCÊ VENCEU!</span>`;

                        window.abrirEscolhaDeTurno('jogador');

                    } else {

                        statusEl.innerHTML = `<span style="color:#e53935; font-weight:bold; font-size:24px;">OPONENTE VENCEU!</span><br><span style="font-size:11px;color:#aaa;">Aguardando escolha de turno...</span>`;

                    }

                }, 1500);

            }

        });

    }

};



window.abrirEscolhaDeTurno = function(vencedor) {

    const modal = document.getElementById('overlay-jokenpo');

    modal.innerHTML = `

        <div style="text-align:center; display: flex; flex-direction: column; align-items: center;">

            <h2 style="color:#4CAF50; font-size:24px; margin-bottom:10px;">VITÓRIA!</h2>

            <p style="color:#fff; margin-bottom: 30px;">Você ganhou o direito de escolha:</p>

            <div style="display:flex; gap: 20px;">

                <button class="btn-acao-modal" style="width: 120px;" onclick="window.enviarEscolhaDeTurno('eu')">EU COMEÇO</button>

                <button class="btn-acao-modal" style="width: 120px; border-color:#e53935; color:#e53935;" onclick="window.enviarEscolhaDeTurno('ele')">OPONENTE COMEÇA</button>

            </div>

        </div>

    `;

};













window.enviarEscolhaDeTurno = function(quemComeca) {

    let modalJokenpo = document.getElementById('overlay-jokenpo');

    if (modalJokenpo) modalJokenpo.remove();

    

    if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") {

        // MODO BOT (Liga a partida direto)

        let jog = quemComeca === 'eu' ? 'jogador' : 'oponente';

        iniciarTurnoReal(jog);

    } else {

        // MODO ONLINE (Avisa na nuvem quem o ganhador escolheu pra começar)

        let turnoInicial = '';

        if (quemComeca === 'eu') turnoInicial = window.souP1Batalha ? 'p1' : 'p2';

        else turnoInicial = window.souP1Batalha ? 'p2' : 'p1';

        

        window._dbUpdate('salas_drome/' + window.salaBatalhaAtual, { turno_ativo: turnoInicial });

    }

};









setTimeout(() => {
    if (!document.getElementById("css-botao-turno")) {
        let style = document.createElement('style');
        style.id = "css-botao-turno";
        style.innerHTML = `
            #btn-passar-turno {
                position: absolute; right: 5%; top: 45%; width: 90px; height: 50px;
                background: #4CAF50; color: black; font-family: 'Arial Black', sans-serif;
                font-size: 11px; font-weight: bold; border: 2px solid #fff; border-radius: 8px;
                cursor: pointer; z-index: 10000; box-shadow: 0 0 15px #4CAF50; transition: 0.3s;
                display: none; text-align: center; line-height: 1.2;
            }
            #btn-passar-turno:hover:not(:disabled) { transform: scale(1.1); background: #fff; }
            #btn-passar-turno:disabled { background: #e53935 !important; color: white !important; box-shadow: 0 0 15px #e53935 !important; cursor: not-allowed; }
            
            /* 🔥 NOVO: BOTÃO DE CANCELAR RESPOSTA */
            #btn-cancelar-burst {
                position: absolute; right: 5%; top: calc(45% + 65px); width: 90px; height: 50px;
                background: #e53935; color: white; font-family: 'Arial Black', sans-serif;
                font-size: 10px; font-weight: bold; border: 2px solid #fff; border-radius: 8px;
                cursor: pointer; z-index: 10000; box-shadow: 0 0 15px #e53935; transition: 0.3s;
                display: none; text-align: center; line-height: 1.2;
            }
            #btn-cancelar-burst:hover { transform: scale(1.1); background: #fff; color: #e53935; }
            
            .esgotado { filter: grayscale(80%) brightness(0.6); }
        `;
        document.head.appendChild(style);
    }

    if (!document.getElementById('btn-passar-turno')) {
        let btn = document.createElement('button');
        btn.id = 'btn-passar-turno';
        btn.onclick = window.passarTurno;
        document.getElementById('tela-batalha').appendChild(btn);
    }

    // 🔥 GERA O BOTÃO FÍSICO NA TELA
    if (!document.getElementById('btn-cancelar-burst')) {
        let btnC = document.createElement('button');
        btnC.id = 'btn-cancelar-burst';
        btnC.onclick = window.cancelarRespostaBurst;
        btnC.innerHTML = "CANCELAR<br>RESPOSTA";
        document.getElementById('tela-batalha').appendChild(btnC);
    }
}, 1500);



const desenharMiniCartaOriginal = desenharMiniCarta;

window.desenharMiniCarta = function(criaturaObj) {

    let html = desenharMiniCartaOriginal(criaturaObj);

    if (criaturaObj && criaturaObj.moveuNesteTurno) {

        html = html.replace('class="mini-card-wrapper"', 'class="mini-card-wrapper esgotado"');

    }

    return html;

};



window.localAtivoAtual = null;



window.localAtivoAtual = null;

window.sortearLocalAnimado = function(jogadorDaVez, callback, localForcado = null, nomeForcado = null) {
window.pausarCronometro();
    
    // 🔥 O RELÓGIO DE ALTERNÂNCIA: Descobre de quem é o deck que fornecerá o Local agora!
    let donoDesteLocal = window.donoDaRoletaLocal || 'jogador';
    let imagensDoDeck = [];
    
    // 1. CARREGA OS POSSÍVEIS RESULTADOS REAIS (Do Deck do dono da vez)
    if (donoDesteLocal === 'jogador') {
        let deck = window.estadoDrome.deckSelecionado;
        if (deck && deck.locais && deck.locais.length > 0) {
            imagensDoDeck = deck.locais.map(id => {
                let loc = null;
                if (typeof LOCAIS_DB !== 'undefined') loc = LOCAIS_DB.find(x => x.id == id || x.nome == id);
                if (!loc && window.inventario) loc = window.inventario.find(x => x.id == id || x.nome == id);
                return loc ? (loc.img || loc.cartaBlank) : null;
            }).filter(Boolean);
        }
    } else {
        // 🔥 CORREÇÃO PAYLOAD: Trata os locais do oponente tanto se forem IDs brutos quanto objetos do Handshake!
        let locaisOp = window.locaisOponente || [];
        if (locaisOp && locaisOp.length > 0) {
            imagensDoDeck = locaisOp.map(item => {
                if (!item) return null;
                // Se já for um objeto vindo do Handshake expandido, extrai a imagem direto!
                if (typeof item === 'object') return item.img || item.cartaBlank || null;
                
                // Se for ID ou Nome string/numérico, procura nos bancos globais
                let loc = null;
                if (typeof LOCAIS_DB !== 'undefined') loc = LOCAIS_DB.find(x => x.id == item || x.nome == item);
                if (!loc && window.inventario) loc = window.inventario.find(x => x.id == item || x.nome == item);
                return loc ? (loc.img || loc.cartaBlank) : null;
            }).filter(Boolean);
        }
    }

    if (imagensDoDeck.length === 0) imagensDoDeck = [URL_FUNDO_CARTA];

    // 🔥 GIRA O RELÓGIO: Inverte a posse do próximo local para a próxima vez que a roleta for chamada!
    window.donoDaRoletaLocal = (donoDesteLocal === 'jogador') ? 'oponente' : 'jogador';

    // 2. CARREGA O EFEITO VISUAL DE CASSINO (Pisca todas as cartas do jogo)
    let imagensParaPiscar = [];
    if (typeof LOCAIS_DB !== 'undefined' && LOCAIS_DB.length > 0) {
        imagensParaPiscar = LOCAIS_DB.map(loc => loc.img || loc.cartaBlank).filter(Boolean);
    }
    if (imagensParaPiscar.length === 0) imagensParaPiscar = [...imagensDoDeck];

    // 3. DECIDE A CARTA VENCEDORA ANTES DA ANIMAÇÃO (Previsão do Futuro Sincronizada)
    let resultadoFinal = localForcado;
    let nomeDoLocalVencedor = nomeForcado;

    if (!resultadoFinal) {
        resultadoFinal = imagensDoDeck[Math.floor(Math.random() * imagensDoDeck.length)];
        
        let objLocalVencedor = null;
        if (typeof LOCAIS_DB !== 'undefined') objLocalVencedor = LOCAIS_DB.find(x => x.img === resultadoFinal || x.cartaBlank === resultadoFinal);
        if (!objLocalVencedor && window.inventario) objLocalVencedor = window.inventario.find(x => x.img === resultadoFinal || x.cartaBlank === resultadoFinal);
        nomeDoLocalVencedor = objLocalVencedor ? objLocalVencedor.nome : "A Barragem de Magma";
        
        // 🔥 BLINDAGEM DA REDE: Passando Imagem E Nome para o Oponente não quebrar as Auras!
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada" && jogadorDaVez === 'jogador') {
            window.enviarAcaoRede({ tipo: 'girar_roleta_local', img: resultadoFinal, nome: nomeDoLocalVencedor });
        }
    } else {
        if (!nomeDoLocalVencedor) {
            let objLocalVencedor = null;
            if (typeof LOCAIS_DB !== 'undefined') objLocalVencedor = LOCAIS_DB.find(x => x.img === resultadoFinal || x.cartaBlank === resultadoFinal);
            if (!objLocalVencedor && window.inventario) objLocalVencedor = window.inventario.find(x => x.img === resultadoFinal || x.cartaBlank === resultadoFinal);
            nomeDoLocalVencedor = objLocalVencedor ? objLocalVencedor.nome : "A Barragem de Magma";
        }
    }

    const roletaHTML = `
        <div class="modal-overlay" id="overlay-roleta-local" style="z-index: 1000000; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <h2 style="color: #00bcd4; font-family: 'Arial Black', sans-serif; letter-spacing: 5px; text-shadow: 0 0 15px #00bcd4; margin-bottom: 20px; animation: pulse 1s infinite;">SORTEANDO LOCAL...</h2>
            <div id="roleta-imagem" style="width: 400px; height: 280px; background-size: 100% 100%; background-repeat: no-repeat; background-position: center; border: 4px solid #fff; border-radius: 15px; box-shadow: 0 0 40px #fff; transition: background-image 0.1s;"></div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', roletaHTML);

    let divImagem = document.getElementById('roleta-imagem');
    let tempo = 50; 
    let giros = 0;

    if(window.tocarSFX) window.tocarSFX('notificacao');

    function girar() {
        divImagem.style.backgroundImage = `url('${imagensParaPiscar[Math.floor(Math.random() * imagensParaPiscar.length)]}')`;
        giros++;
        tempo += 10; 

        if (giros < 25) {
            setTimeout(girar, tempo);
        } else {
            // FREIO OBRIGATÓRIO: A roleta para cravada na carta prevista pela lógica/nuvem
            divImagem.style.backgroundImage = `url('${resultadoFinal}')`;
            divImagem.style.borderColor = "#ffd700";
            divImagem.style.boxShadow = "0 0 50px #ffd700";
            
            let titulo = document.querySelector('#overlay-roleta-local h2');
            if(titulo) {
                titulo.innerText = "LOCAL DEFINIDO!";
                titulo.style.color = "#ffd700";
            }

            // 🔥 A MÁGICA DA LIMPEZA: Desliga o Fogo da Barragem ANTES de aplicar o novo local!
            let locAntigo = null;
            if (window.localAtivoAtual && typeof LOCAIS_DB !== 'undefined') {
                locAntigo = LOCAIS_DB.find(l => l.img === window.localAtivoAtual);
                if (!locAntigo && window.inventario) locAntigo = window.inventario.find(l => l.img === window.localAtivoAtual);
            }
            
            if (locAntigo && locAntigo.nome === "A Barragem de Magma") {
                let todasAsCartas = [...Object.values(campoJogador), ...(window.campoOponente ? Object.values(window.campoOponente) : [])];
                todasAsCartas.forEach(c => {
                    if (c && c.auraMagma) {
                        c.elementos = c.elementos.filter(el => el !== 'Fogo');
                        c.auraMagma = false;
                    }
                });
                window.mostrarMensagemScanner("A fumaça da Barragem de Magma se dissipou!");
            }
            
           // Grava o estado do NOVO local ativo de forma unificada
            window.localAtivoAtual = resultadoFinal;
            window.nomeLocalAtivoAtual = nomeDoLocalVencedor; // Registra o nome globalmente
            
            if (typeof atualizarLocaisAtivosNaMesa === "function") atualizarLocaisAtivosNaMesa();
            
            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                window._dbUpdate('salas_drome/' + window.salaBatalhaAtual, { 
                    localDaBatalha: resultadoFinal,
                    nomeLocalDaBatalha: nomeDoLocalVencedor 
                });
            }

            setTimeout(() => {
                let modal = document.getElementById('overlay-roleta-local');
                if (modal) modal.remove();
                
                // 🔥 O EXORCISTA EM AÇÃO: Força o recálculo e renderização da mesa assim que a roleta fecha!
                atualizarTelaBatalha();
                
                if(callback) callback();
                window.retomarCronometro();
            }, 2000);
        }
    }
    
    girar(); 
};

const scannerOriginal = window.mostrarMensagemScanner;

window.mostrarMensagemScanner = function(msg) {

    try {

        if (typeof scannerOriginal === 'function') {

            scannerOriginal(msg);

        }

    } catch(e) {

        console.warn("Scanner não encontrado. Usando Toast flutuante. Mensagem:", msg);

        let toast = document.createElement('div');

        toast.innerText = msg;

        toast.style.cssText = "position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,10,0,0.9); color:#00ff00; padding:10px 20px; border-radius:8px; border:2px solid #00ff00; z-index:999999; font-family:monospace; font-weight:bold; box-shadow:0 0 15px #00ff00;";

        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3500);

    }

};



function atualizarLocaisAtivosNaMesa() {

    let candidatos = document.querySelectorAll('.zona-lateral > div, .box-local-ativo-js');

    let boxesLocais = [];



    candidatos.forEach(div => {

        let texto = div.innerText || div.textContent || "";

        

        if (texto.includes('LOCAL ATIVO') || div.classList.contains('box-local-ativo-js')) {

            if (!boxesLocais.includes(div)) {

                boxesLocais.push(div);

            }

        }

    });



    boxesLocais.forEach(box => {

        box.classList.add('box-local-ativo-js'); 

        

        if (window.localAtivoAtual) {

            box.style.backgroundImage = `url('${window.localAtivoAtual}')`;

            box.style.backgroundSize = '100% 100%'; 

            box.style.backgroundPosition = 'center';

            box.style.backgroundRepeat = 'no-repeat';

            box.style.border = "2px solid #ffd700";

            box.style.boxShadow = "0 0 15px rgba(255, 215, 0, 0.4)";

            

            box.style.cursor = 'pointer';

            box.onclick = function() {

                if (typeof window.ampliarCartaClicada === 'function') {

                    if(window.tocarSFX) window.tocarSFX('notificacao'); 

                    window.ampliarCartaClicada(window.localAtivoAtual);

                }

            };

            

            box.innerHTML = `

                <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; opacity: 0; background: rgba(0,0,0,0.5); transition: 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">

                    <span style="color: white; font-weight: bold; font-size: 14px; font-family: 'Arial Black', sans-serif; text-shadow: 0 0 10px black, 0 0 5px #000;">🔍 LER CARTA</span>

                </div>

            `; 

            

        } else {

            box.style.backgroundImage = 'none';

            box.style.border = "1px solid #4CAF50";

            box.style.boxShadow = "none";

            box.style.cursor = 'default';

            box.onclick = null; 

            box.innerHTML = '<span style="font-size: 10px; color: white; font-family: monospace; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; text-align: center;">LOCAL ATIVO</span>';

        }

    });

}



window.estadoCombate = { ativo: false, atacante: null, defensor: null };



window.encerrarCombateMorte = function(idMorto) {
    if (!window.cemiterio) window.cemiterio = [];
    if (!window.cemiterioOponente) window.cemiterioOponente = [];

    let morto = obterCriaturaNoSlot(idMorto);
    if(!morto || morto.morrendo) return; 
    morto.morrendo = true;

    // 🔥 DETETIVE DE BOMBA: Verifica se ele morreu com a bomba nas mãos!
    let donoBombaMortal = null;
    if (morto.equipamento && morto.equipamentoRevelado && morto.equipamento.nome === "Bomba de Fogo") {
        donoBombaMortal = morto.dono; // Salva de quem é a bomba para dar o direito de mira!
    }

    window.mostrarMensagemScanner(`💀 ${morto.nome} FOI DESTRUÍDO! O tabuleiro será redefinido.`);
    
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        if (window.estadoTurno.jogadorAtual === 'jogador') {
            window.enviarAcaoRede({ tipo: 'morte', alvo: idMorto });
        }
    }

    if (morto) {
        let isPlayer = morto.dono === 'jogador';
        let arrayCemiterio = isPlayer ? window.cemiterio : window.cemiterioOponente;
        arrayCemiterio.push(morto.nome);
        if (morto.equipamento) arrayCemiterio.push(morto.equipamento.nome);
    }

    window.animarExplosaoCodigo(idMorto, () => {
        setarCriaturaNoSlot(idMorto, null);
        let estavamosEmCombateReal = window.estadoCombate && window.estadoCombate.ativo;

        window.estadoCombate.ativo = false;
        window.estadoCombate.atacante = null;
        window.estadoCombate.defensor = null;
        
        if (estavamosEmCombateReal) {
            window.pontosAtaque = { jogador: 3, oponente: 3 };
            
            if (window.cartaRoubadaMaoNegra) {
                let indexRoubada = window.maoAtaques.findIndex(a => (typeof a === 'object' ? a.id : a) == window.cartaRoubadaMaoNegra);
                if (indexRoubada !== -1) {
                    window.maoAtaques.splice(indexRoubada, 1);
                    window.mostrarMensagemScanner("A carta roubada (Mão Negra) fugiu e voltou para o oponente!");
                    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                        window.enviarAcaoRede({ tipo: 'devolver_carta_roubada', idCarta: window.cartaRoubadaMaoNegra });
                    } else {
                        window.qtdBaralhoOponente++; 
                    }
                }
                window.cartaRoubadaMaoNegra = null; 
            }
            
            let todasMinhasCartas = [...(window.baralhoAtaques || []), ...(window.maoAtaques || []), ...(window.lixoAtaques || [])];
            if (todasMinhasCartas.length > 0) {
                window.baralhoAtaques = embaralharArray(todasMinhasCartas);
                window.maoAtaques = window.baralhoAtaques.splice(0, 3);
            }
            window.lixoAtaques = []; 
            
            window.qtdBaralhoOponente = 17;
            window.qtdMaoOponente = 3;
            window.lixoAtaquesOponente = 0;
            
            window.combateFinalizadoNesteTurno = true;
        }
        
        atualizarTelaBatalha();
        if (typeof window.atualizarSeusContadoresDeAtaque === 'function') window.atualizarSeusContadoresDeAtaque();

        if (donoBombaMortal === 'jogador') {
            window.modoAlvo = { tipo: 'bomba_fogo', origem: idMorto };
            window.atualizarInterfaceMira("A Bomba de Fogo vai explodir! Clique em QUALQUER criatura para causar 25 de dano.");
            return; 
        } else if (donoBombaMortal === 'oponente') {
            window.mostrarMensagemScanner("💣 Oponente está mirando a Bomba de Fogo...");
        }

        if (typeof window.checarFimDeJogo === 'function') window.checarFimDeJogo();
    });
};







window.pilhaBurst = []; 

window.aguardandoResposta = false;



window.pilhaBurst = []; 
window.aguardandoResposta = false;

window.adicionarAoBurst = function(acaoObj) {
    window.pausarCronometro();
    window.pilhaBurst.push(acaoObj);
    window.mostrarMensagemScanner(`⚡ BURST ATIVADO: ${acaoObj.nomeAcao} entrou na corrente!`);

    // 🔥 INTELIGÊNCIA: Se VOCÊ acabou de jogar uma carta na corrente, a sua vez de responder acabou!
    // O botão some e o sistema volta ao normal para aguardar o inimigo.
    if (acaoObj.dono === 'jogador') {
        window.aguardandoResposta = false;
        let btnC = document.getElementById('btn-cancelar-burst');
        if (btnC) btnC.style.display = 'none';
    }

    // 🌐 MODO ONLINE: Avisa a rede e aguarda a resposta do inimigo!
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        if (acaoObj.dono === 'jogador') {
            window.mostrarMensagemScanner("⏳ Aguardando a resposta do Oponente...");
            window.enviarAcaoRede({ tipo: 'abrir_burst', nomeAcao: acaoObj.nomeAcao });
        } else {
            setTimeout(() => window.perguntarResposta('jogador', acaoObj), 500);
        }
    } else {
        // 🤖 MODO BOT OFFLINE
        let jogadorAlvo = acaoObj.dono === 'jogador' ? 'oponente' : 'jogador';
        setTimeout(() => window.perguntarResposta(jogadorAlvo, acaoObj), 1000);
    }
};

window.iniciarRespostaBurst = function(jogadorAlvo) {
    document.getElementById('overlay-burst').remove();
    window.mostrarMensagemScanner(`⏳ Escolha a sua Magia ou Habilidade para responder!`);
    
    // 🔥 BOTÃO ENTRA EM CENA: O jogador quer responder, mostra a rota de fuga!
    let btnC = document.getElementById('btn-cancelar-burst');
    if (btnC) btnC.style.display = 'block';
};

window.negarRespostaBurst = function() {
    let modal = document.getElementById('overlay-burst');
    if(modal) modal.remove();
    
    window.aguardandoResposta = false;
    
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        window.enviarAcaoRede({ tipo: 'fechar_burst' });
    }
    
    window.mostrarMensagemScanner("Você não respondeu. Resolvendo as ações...");
    setTimeout(() => window.resolverBurst(), 1000);
};

window.resolverBurst = function() {
    // 🔥 FAXINA VISUAL: Garante que o botão vai sumir quando a corrente resolver
    let btnC = document.getElementById('btn-cancelar-burst');
    if (btnC) btnC.style.display = 'none';

    window.retomarCronometro();
    if (window.pilhaBurst.length === 0) {
        window.mostrarMensagemScanner("Todas as ações resolvidas.");
        atualizarTelaBatalha();
        return;
    }

    let acaoAtual = window.pilhaBurst.pop();
    window.mostrarMensagemScanner(`✨ Resolvendo: ${acaoAtual.nomeAcao}`);
    acaoAtual.executar();
    setTimeout(() => window.resolverBurst(), 2500);
};

window.cancelarRespostaBurst = function() {
    if (window.aguardandoResposta) {
        window.aguardandoResposta = false;
        
        // 🔥 BOTÃO SAI DE CENA: Ele clicou pra desistir da resposta
        let btnC = document.getElementById('btn-cancelar-burst');
        if (btnC) btnC.style.display = 'none';

        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'fechar_burst' });
        }
        window.mostrarMensagemScanner("Resposta cancelada. Resolvendo a corrente...");
        window.resolverBurst();
    }
};

window.spedmanProtecaoAtiva = false;
window.spedmanProtecaoAtivaInimiga = false;

window.interceptarComSpedman = function(slotSpedman, slotDefensor) {
    let spedman = campoJogador[slotSpedman];
    let aliadoDefendendo = campoJogador[slotDefensor];
    
    if (!spedman || spedman.fichasHabilidade <= 0 || !aliadoDefendendo) return;
    
    spedman.fichasHabilidade -= 1;
    window.spedmanProtecaoAtiva = true; // Prepara a armadura para o dano que vai chegar
    spedman.revelada = true; // 🔥 CORREÇÃO: Spedman se revela ao pular na frente!
    
    // 🔥 A GRANDE TROCA FÍSICA NA MESA!
 
    if (slotSpedman !== slotDefensor) {
        campoJogador[slotSpedman] = aliadoDefendendo;
        campoJogador[slotDefensor] = spedman;
    }
    
    let novoFullIdSpedman = 'jog-' + slotDefensor;
    if (window.estadoCombate && window.estadoCombate.ativo) {
        window.estadoCombate.defensor = novoFullIdSpedman; // Spedman assume a briga oficialmente!
    }
    
    document.getElementById('overlay-burst').remove();
    
    // 🌐 AVISA A REDE QUE ACONTECEU UMA TROCA TÁTICA!
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        window.enviarAcaoRede({ 
            tipo: 'spedman_ativado', 
            slotOriginalSpedman: 'jog-' + slotSpedman, 
            slotOriginalDefensor: 'jog-' + slotDefensor 
        });
    }
    
    window.mostrarMensagemScanner("⚡ TROCA TÁTICA! Spedman pulou na frente do aliado e assumiu o combate!");
    if (window.tocarSFX) window.tocarSFX('notificacao');
    atualizarTelaBatalha();
    
    // Destrava a corrente para o ataque inimigo vir (e dar zero)
    window.aguardandoResposta = false;
    window.resolverBurst();
};

window.atualizarSeusContadoresDeAtaque = function() {

    let ptsJogador = window.pontosAtaque ? (window.pontosAtaque['jogador'] || 0) : 0;

    let ptsOponente = window.pontosAtaque ? (window.pontosAtaque['oponente'] || 0) : 0;



    let displayPontosJogador = document.getElementById('contador-ataque-jogador');

    let displayPontosOponente = document.getElementById('contador-ataque-oponente');



    if (displayPontosJogador) displayPontosJogador.innerText = `Cont. Ataque: ${ptsJogador}`;

    if (displayPontosOponente) displayPontosOponente.innerText = `Cont. Ataque: ${ptsOponente}`;

};


// ==========================================
// 🔥 MOTOR DE COBRANÇA DE TEMPO E STRIKES (SMART CLOCK) 🔥
// ==========================================
window.strikesJogador = 0;
window.strikesOponente = 0;
window.cronometroTurnoInterval = null;
window.cronometroPausado = false;
window.tempoRestanteTurno = 45;

window.pausarCronometro = function() { window.cronometroPausado = true; };
window.retomarCronometro = function() { window.cronometroPausado = false; };

window.iniciarCronometroTurno = function() {
    clearInterval(window.cronometroTurnoInterval);
    window.tempoRestanteTurno = 45;
    window.cronometroPausado = false;
    
    let btn = document.getElementById('btn-passar-turno');

    window.cronometroTurnoInterval = setInterval(() => {
        // 🔥 CORREÇÃO: O relógio agora olha de quem é a vez A CADA SEGUNDO!
        let jogadorAtual = window.estadoTurno.jogadorAtual; 

        // 🛑 CONGELA O TEMPO: Se o jogo estiver rodando animações ou resolvendo mágicas!
        if (window.cronometroPausado) {
            if (btn) btn.innerHTML = jogadorAtual === 'jogador' ? `PASSAR<br>TURNO (⏳)` : `TURNO<br>OPONENTE (⏳)`;
            return;
        }

        window.tempoRestanteTurno--;

        // Atualiza o botão visualmente e garante que a cor bate com o texto!
        if (btn) {
            if (jogadorAtual === 'jogador') {
                btn.disabled = false; // Garante que fica VERDE
                btn.innerHTML = `PASSAR<br>TURNO (${window.tempoRestanteTurno}s)`;
            } else {
                btn.disabled = true; // Garante que fica VERMELHO e bloqueado
                btn.innerHTML = `TURNO<br>OPONENTE (${window.tempoRestanteTurno}s)`;
            }
        }

        // 🌐 SINCRONIZAÇÃO DE REDE: O dono do turno dita o tempo exato para o inimigo!
        if (jogadorAtual === 'jogador' && window.tempoRestanteTurno % 5 === 0 && window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window._dbUpdate('salas_drome/' + window.salaBatalhaAtual, { sync_tempo: window.tempoRestanteTurno });
        }

        // O tempo estourou!
        if (window.tempoRestanteTurno <= 0) {
            clearInterval(window.cronometroTurnoInterval);
            window.processarEstouroDeTempo(jogadorAtual);
        }
    }, 1000);
};

window.processarEstouroDeTempo = function(jogadorDefeituoso) {
    if (jogadorDefeituoso === 'jogador') {
        window.strikesJogador++;
        
        // Modal explicativo que surge na sua tela
        const modalStrikeHTML = `
            <div class="modal-overlay" id="overlay-strike" style="z-index: 10000000; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div class="modal-content-fichas" style="text-align: center; border: 3px solid #ff9800; box-shadow: 0 0 30px rgba(255, 152, 0, 0.5); background: #111; padding: 25px; border-radius: 10px; max-width: 330px;">
                    <h2 style="color: #ff9800; font-family: 'Arial Black', sans-serif; text-shadow: 0 0 10px #ff9800; margin-bottom: 15px; font-size: 20px;">⚠️ SEU TEMPO ESGOTOU!</h2>
                    <p style="color: #ffd700; font-size: 16px; font-weight: bold; margin-bottom: 15px;">STRIKES ATUAIS: ${window.strikesJogador} / 3</p>
                    <p style="color: #fff; font-size: 11px; font-family: monospace; text-align: left; line-height: 1.4; margin-bottom: 20px; background: #000; padding: 10px; border-radius: 5px; border: 1px solid #333;">
                        <strong>O que é STRIKE?</strong><br>
                        Para manter o jogo dinâmico e evitar que jogadores segurem o turno de propósito (Stalling) para vencer pelo cansaço, cada rodada tem um limite de tempo. Estourar o cronômetro passa seu turno automaticamente e te dá 1 Strike. Se atingir 3 Strikes, você perde a partida por W.O.
                    </p>
                    <button class="btn-acao-modal" style="background: #ff9800; color: black; border: none; width: 100%; padding: 12px; border-radius: 5px; font-weight: bold; cursor: pointer;" onclick="document.getElementById('overlay-strike').remove()">ENTENDIDO</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalStrikeHTML);
        if(window.tocarSFX) window.tocarSFX('notificacao');

      if (window.strikesJogador >= 3) {
            window.declararVitoria('oponente', 'Você foi desclassificado por atingir o limite máximo de 3 Strikes de tempo (Inatividade/Stalling).');
            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
                window.enviarAcaoRede({ tipo: 'declarar_vitoria_oponente' }); // 🔥 Correção aqui!
            }
        }
        else {
            window.passarTurno(true); // Passa o turno automaticamente
        }
    } else {
        window.strikesOponente++;
        
        const modalStrikeOpHTML = `
            <div class="modal-overlay" id="overlay-strike-op" style="z-index: 10000000; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div class="modal-content-fichas" style="text-align: center; border: 3px solid #ff5555; box-shadow: 0 0 30px rgba(255, 85, 85, 0.5); background: #111; padding: 25px; border-radius: 10px; max-width: 330px;">
                    <h2 style="color: #ff5555; font-family: 'Arial Black', sans-serif; text-shadow: 0 0 10px #ff5555; margin-bottom: 15px; font-size: 18px;">⚠️ TEMPO DO INIMIGO ESGOTOU!</h2>
                    <p style="color: #ff5555; font-size: 16px; font-weight: bold; margin-bottom: 15px;">STRIKES DELE: ${window.strikesOponente} / 3</p>
                    <p style="color: #fff; font-size: 11px; font-family: monospace; line-height: 1.4; margin-bottom: 20px;">
                        O oponente estourou o limite de tempo do turno dele. O controle da partida foi transferido para você e ele recebeu uma advertência por lentidão (Stalling).
                    </p>
                    <button class="btn-acao-modal" style="background: #ff5555; color: white; border: none; width: 100%; padding: 12px; border-radius: 5px; font-weight: bold; cursor: pointer;" onclick="document.getElementById('overlay-strike-op').remove()">CONTINUAR LUTANDO</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalStrikeOpHTML);
        if(window.tocarSFX) window.tocarSFX('notificacao');

        if (window.strikesOponente >= 3) {
            window.declararVitoria('jogador', 'O oponente foi desclassificado por atingir o limite máximo de 3 Strikes de tempo (Inatividade/Stalling).');
        } else {
            if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") {
                window.executarPassagemDeTurnoLocal();
            }
        }
    }
};



window.iniciarTurnoReal = function(primeiroJogador) {
    let modal = document.getElementById('overlay-jokenpo');
    if (modal) modal.remove();

    window.estadoTurno.jogadorAtual = primeiroJogador;
    window.estadoTurno.turnoNumero = 1;
    window.estadoTurno.fase = 'principal';
    // 🔥 O RELÓGIO: O vencedor do Jokenpô fornece o 1º Local do jogo!
    window.donoDaRoletaLocal = primeiroJogador;

    // 🔥 RESETA OS STRIKES PARA A NOVA PARTIDA 🔥
    window.strikesJogador = 0;
    window.strikesOponente = 0;


    window.pontosAtaque = { jogador: 3, oponente: 3 };

    

    window.qtdMaoOponente = 3;

    window.qtdBaralhoOponente = 17;



    Object.values(campoJogador).forEach(c => { if(c) c.moveuNesteTurno = false; });

    if(window.campoOponente) Object.values(window.campoOponente).forEach(c => { if(c) c.moveuNesteTurno = false; });



    let btnTurno = document.getElementById('btn-passar-turno');

    if (btnTurno) btnTurno.style.display = 'block';



   let iniciarOpc = () => {
        if (primeiroJogador === 'jogador') {
            window.sortearLocalAnimado('jogador', () => {
                window.mostrarMensagemScanner("Seu turno! Movimente suas criaturas.");
                 window.iniciarCronometroTurno(); // 🔥 ADICIONE AQUI
            });
        } else {
            if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") {
                window.sortearLocalAnimado('oponente', () => {
                    window.mostrarMensagemScanner("Aguarde a jogada do oponente...");
                     window.iniciarCronometroTurno(); // 🔥 ADICIONE AQUI
                    setTimeout(() => { window.passarTurno(); }, 3000);
                });
            } else {
                window.mostrarMensagemScanner("Aguardando oponente sortear o Local...");
                 window.iniciarCronometroTurno(); // 🔥 ADICIONE AQUI
            }
        }
    };


    if (primeiroJogador === 'jogador') {

        if(btnTurno) { btnTurno.disabled = false; btnTurno.innerHTML = "PASSAR<br>TURNO"; }

        window.mostrarBannerTCG('SUA VEZ', 'rgba(0, 100, 0, 0.8)', '#4CAF50', iniciarOpc);

    } else {

        if(btnTurno) { btnTurno.disabled = true; btnTurno.innerHTML = "TURNO<br>OPONENTE"; }

        window.mostrarBannerTCG('TURNO DO INIMIGO', 'rgba(100, 0, 0, 0.8)', '#e53935', iniciarOpc);

    }

    atualizarTelaBatalha(); 

};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function atualizarDecksEMaoCards() {

    document.querySelectorAll('.box-deck').forEach(deck => {

        let isPlayer = deck.closest('.lado-jogador') !== null;

        let textoAtual = deck.textContent || ""; 



        if (textoAtual.includes('DECK') && textoAtual.includes('ATAQUE')) {

            let qtd = isPlayer ? (window.baralhoAtaques ? window.baralhoAtaques.length : 20) : (window.qtdBaralhoOponente !== undefined ? window.qtdBaralhoOponente : 17);

            deck.innerHTML = `<span class="texto-deck-baixo">DECK<br>ATAQUE<br><span style="font-size:9px; color:#fff; text-shadow: 0 0 3px black;">${qtd}/20</span></span>`;

            deck.classList.add('fundo-carta-personalizado');

        }

        else if (textoAtual.includes('LIXO')) {
            // 🔥 CÁLCULO SEGURO: Soma os ataques reais + cemitério!
            let qtdOpAtaquesReal = Array.isArray(window.lixoAtaquesOponente) ? window.lixoAtaquesOponente.length : (window.lixoAtaquesOponente || 0);
            
            let qtdLixo = isPlayer ? 
                ((window.lixoAtaques ? window.lixoAtaques.length : 0) + (window.cemiterio ? window.cemiterio.length : 0)) : 
                (qtdOpAtaquesReal + (window.cemiterioOponente ? window.cemiterioOponente.length : 0));
         
            

            // Layout perfeito centralizado que não vaza da caixa!

            deck.innerHTML = `

                <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; height: 100%;">

                    <span style="font-size: 10px; font-weight: bold; color: #fff;">LIXO</span>

                    <span style="font-size: 14px; font-weight: bold; color: #fff; text-shadow: 0 0 5px black; margin-top: 2px;">${qtdLixo}</span>

                </div>

            `;

            deck.style.background = 'rgba(255, 0, 0, 0.15)'; // Fundo vermelho transparente

            deck.style.border = '2px dashed #ff5555'; // Borda tracejada vermelha

            deck.style.cursor = 'pointer'; // Mostra a mãozinha de clique

            

            // Evento para abrir a janela do cemitério

            deck.onclick = () => window.abrirModalVerLixo(isPlayer ? 'jogador' : 'oponente');

        }

        else if (textoAtual.trim() === 'DECK' || textoAtual.includes('LOCAIS')) {

            deck.innerHTML = `<span class="texto-deck-baixo">DECK<br>LOCAIS</span>`;

            deck.classList.add('fundo-carta-personalizado');

        }

    });



    let caixaMao = document.querySelector('.container-mao-ataques') || document.querySelector('.mao-jogador');

    if(caixaMao) {

        caixaMao.className = 'container-mao-ataques'; 

        caixaMao.style.pointerEvents = 'none'; 

        caixaMao.style.zIndex = '99999';

        caixaMao.innerHTML = ''; 



        let totalCartas = window.maoAtaques.length;

        let meio = (totalCartas - 1) / 2;



        window.maoAtaques.forEach((idAtaque, index) => {
            // 🔥 DETETIVE DE ATAQUES NÍVEL MESTRE 🔥
            console.log(`🕵️‍♂️ RASTREADOR [Renderizador Mão] - Posição ${index}: Tipo do dado:`, typeof idAtaque, "| Valor:", idAtaque);

            let cartaOriginal = null;
            let idParaBusca = idAtaque;

            // 1. Se a carta já for um objeto completo, extraímos o ID e usamos ela mesma!
            if (idAtaque && typeof idAtaque === 'object') {
                cartaOriginal = idAtaque;
                idParaBusca = idAtaque.id || idAtaque.nome;
                console.log(`🕵️‍♂️ RASTREADOR [Renderizador Mão] - Posição ${index}: Sucesso! É um objeto válido.`);
            } 
            // 2. Se for só o texto/número, procuramos no banco de dados blindado!
            else {
                if (typeof window.inventario !== 'undefined' && Array.isArray(window.inventario)) {
                    cartaOriginal = window.inventario.find(c => String(c.id) === String(idAtaque) || c.nome === idAtaque);
                }
                if (!cartaOriginal && typeof ATAQUES !== 'undefined' && Array.isArray(ATAQUES)) {
                    cartaOriginal = ATAQUES.find(a => String(a.id) === String(idAtaque) || a.nome === idAtaque);
                }
                console.log(`🕵️‍♂️ RASTREADOR [Renderizador Mão] - Posição ${index}: Achou no banco de dados?`, cartaOriginal ? "SIM" : "NÃO");
            }

            // 3. O SEGREDO ANTI-INVISIBILIDADE: Se a carta não for achada, cria uma carta fantasma!
            if (!cartaOriginal) {
                console.error(`🚨 ALERTA BUG 1: A carta na posição ${index} não é objeto e não está no banco! Renderizando o verso.`);
                cartaOriginal = {
                    id: idParaBusca,
                    nome: "Carta Oculta",
                    img: typeof URL_FUNDO_CARTA !== 'undefined' ? URL_FUNDO_CARTA : 'cartas/verso.jpg',
                    custo: 0,
                    danoBase: 0,
                    efeito: "Efeito desconhecido."
                };
            }

            // Agora desenha a carta com 100% de certeza que ela existe!
            let el = document.createElement('div');
            el.className = 'carta-na-mao';
            
            let imagemParaExibir = cartaOriginal.img || cartaOriginal.cartaBlank || (typeof URL_FUNDO_CARTA !== 'undefined' ? URL_FUNDO_CARTA : 'cartas/verso.jpg');
            
            el.style.backgroundImage = `url('${imagemParaExibir}')`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.pointerEvents = 'auto';
            el.style.cursor = 'pointer';

            let offset = index - meio;
            let angulo = offset * 12; 
            let descida = Math.abs(offset) * 6; 
            
            el.style.transform = `rotate(${angulo}deg) translateY(${descida}px)`;
            el.style.zIndex = index + 1;
            
            el.onclick = function(e) {
                e.stopPropagation(); 
                window.abrirModalAtaque(index, cartaOriginal.id, cartaOriginal);
            };
            caixaMao.appendChild(el);
        });
 }


    let caixaMaoOp = document.getElementById('mao-oponente-ui');

    if (caixaMaoOp) {

        caixaMaoOp.innerHTML = ''; 

        

        let totalOp = window.qtdMaoOponente !== undefined ? window.qtdMaoOponente : 3;

        let meioOp = (totalOp - 1) / 2;

        

        for(let i = 0; i < totalOp; i++) {

            let el = document.createElement('div');

            el.className = 'carta-oponente-na-mao';

            

            let offset = i - meioOp;

            let angulo = offset * 12; 

            let descida = Math.abs(offset) * 6; 

            

            el.style.transform = `rotate(${angulo}deg) translateY(${descida}px)`;

            el.style.zIndex = i + 1;

            

            caixaMaoOp.appendChild(el);

        }

    }

}



window.iniciarCombate = function(idAtacante, idDefensor) {
    window.pausarCronometro();

    let atacante = obterCriaturaNoSlot(idAtacante);

    let defensor = obterCriaturaNoSlot(idDefensor);



    window.estadoCombate = { ativo: true, atacante: idAtacante, defensor: idDefensor };
// 🔥 REMOVENDO A NÉVOA DE GUERRA: Força as duas cartas a virarem para cima no momento que a briga começa!
    if (atacante) atacante.revelada = true;
    if (defensor) defensor.revelada = true;


   let nomeLocal = "Local Desconhecido";
    let locDB = null;
    if (window.localAtivoAtual) {
        if (typeof LOCAIS_DB !== 'undefined') locDB = LOCAIS_DB.find(l => l.img === window.localAtivoAtual);
        if (!locDB && window.inventario) locDB = window.inventario.find(l => l.img === window.localAtivoAtual);
        if (locDB) nomeLocal = locDB.nome;
    }

    // ==========================================
    // 🗺️ MOTOR DE LOCAIS: EFEITOS DE INÍCIO DE COMBATE
    // ==========================================
    if (locDB && locDB.nome === "Cidade de Kiru") {
        [atacante, defensor].forEach(criatura => {
            if (criatura && criatura.tribo === "Azul" && !criatura.buffKiruAplicado) {
                criatura.hpMax = Number(criatura.hpMax || criatura.statsMax.energia) + 10;
                criatura.hpAtual = Number(criatura.hpAtual) + 10;
                criatura.buffKiruAplicado = true; 
                setTimeout(() => window.mostrarMensagemScanner(`🏰 Cidade de Kiru: ${criatura.nome} ganhou +10 de Energia!`), 1000);
            }
        });
    }

    

    // 🔥 CÁLCULO DE INICIATIVA CORRIGIDO 🔥
    let atributoIniciativa = locDB && locDB.iniciativa ? locDB.iniciativa.toLowerCase() : "velocidade"; // Velocidade é o padrão se falhar
    let prop = 'velocidade';
    if (atributoIniciativa.includes('coragem')) prop = 'coragem';
    if (atributoIniciativa.includes('poder')) prop = 'poder';
    if (atributoIniciativa.includes('sabedoria')) prop = 'sabedoria';

    // 💡 PASSO EDUCATIVO: Forçamos o uso do Number() para garantir que "5" não seja maior que "25" por erro de texto
    let valAta = atacante.statsMax ? Number(atacante.statsMax[prop]) : 0;
    let valDef = defensor.statsMax ? Number(defensor.statsMax[prop]) : 0;

    let vencedorIniciativa = atacante.dono; // Regra de Ouro: Empate vai para o Atacante (quem iniciou a briga)
    if (valDef > valAta) {
        vencedorIniciativa = defensor.dono;
    }



    let textoNarracao = `${atacante.nome} ataca ${defensor.nome} em ${nomeLocal}`;



    try {

        window.speechSynthesis.cancel(); 

        let vozRobo = new SpeechSynthesisUtterance(textoNarracao);

        vozRobo.lang = 'pt-BR'; vozRobo.rate = 1.0; vozRobo.pitch = 0.5; vozRobo.volume = 1.0; 

        window.speechSynthesis.speak(vozRobo);

    } catch(e) {}



    let iconeAtacante = atacante.cartaBlank;

    let iconeDefensor = defensor.cartaBlank;

    if (typeof MONSTROS !== 'undefined') {

        let dbAta = MONSTROS.find(m => m.nome === atacante.nome);

        if (dbAta && dbAta.iconeMapa) iconeAtacante = dbAta.iconeMapa;

        let dbDef = MONSTROS.find(m => m.nome === defensor.nome);

        if (dbDef && dbDef.iconeMapa) iconeDefensor = dbDef.iconeMapa;

    }



    const vsHTML = `

        <div class="modal-overlay" id="overlay-combate-vs" style="z-index: 1000000; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100vw; height: 100vh; overflow: hidden;">

            <div style="position: relative; width: 160px; height: 230px; margin-bottom: 20px; animation: dropInTop 0.5s forwards;">

                <div class="carta-base" style="position: absolute; width: 100%; height: 100%; background-image: url('${defensor.cartaBlank}'); background-size: 100% 100%; border: 3px solid #e53935; border-radius: 10px; box-shadow: 0 0 30px #e53935; animation: fadeOutScan 0.5s 1.5s forwards;"></div>

                <div class="criatura-revelada" style="position: absolute; width: 100%; height: 100%; background-image: url('${iconeDefensor}'); background-size: contain; background-repeat: no-repeat; background-position: center; filter: drop-shadow(0 0 15px #e53935) brightness(1.2); opacity: 0; animation: revelarCarta 0.5s 1.5s forwards;"></div>

            </div>

            <div style="position: relative; width: 100%; display: flex; justify-content: center; align-items: center; height: 60px;">

                <div style="font-family: 'Arial Black', sans-serif; font-size: 60px; color: #fff; text-shadow: 0 0 20px #e53935, 0 0 30px #ffd700; z-index: 10; animation: pulseVS 0.5s infinite alternate;">VS</div>

            </div>

            <div style="position: relative; width: 160px; height: 230px; margin-top: 20px; animation: dropInBottom 0.5s forwards;">

                <div class="carta-base" style="position: absolute; width: 100%; height: 100%; background-image: url('${atacante.cartaBlank}'); background-size: 100% 100%; border: 3px solid #4CAF50; border-radius: 10px; box-shadow: 0 0 30px #4CAF50; animation: fadeOutScan 0.5s 1.5s forwards;"></div>

                <div class="criatura-revelada" style="position: absolute; width: 100%; height: 100%; background-image: url('${iconeAtacante}'); background-size: contain; background-repeat: no-repeat; background-position: center; filter: drop-shadow(0 0 15px #4CAF50) brightness(1.2); opacity: 0; animation: revelarCarta 0.5s 1.5s forwards;"></div>

            </div>

            <div style="position: absolute; bottom: 5%; width: 90%; text-align: center; font-family: monospace; font-size: 14px; font-weight: bold; color: #00ff00; background: rgba(0, 20, 0, 0.8); padding: 10px; border: 1px solid #00ff00; border-radius: 5px; opacity: 0; animation: revelarCarta 0.5s 0.5s forwards;">

                > ${textoNarracao.toUpperCase()}

            </div>

        </div>

        <style>

            @keyframes dropInTop { from { transform: translateY(-100vh); } to { transform: translateY(0); } }

            @keyframes dropInBottom { from { transform: translateY(100vh); } to { transform: translateY(0); } }

            @keyframes revelarCarta { to { opacity: 1; } }

            @keyframes fadeOutScan { to { opacity: 0; visibility: hidden; } }

            @keyframes pulseVS { from { transform: scale(1); } to { transform: scale(1.2); } }

        </style>

    `;

    document.body.insertAdjacentHTML('beforeend', vsHTML);



    setTimeout(() => {

        let telaVS = document.getElementById('overlay-combate-vs');

        if (telaVS) telaVS.remove();

        

       // 🔥 APLICA A INICIATIVA 🔥
        window.estadoTurno.jogadorAtual = vencedorIniciativa;
        window.pontosAtaque[vencedorIniciativa] += 1; 
        if (typeof window.atualizarSeusContadoresDeAtaque === 'function') window.atualizarSeusContadoresDeAtaque();
        
        let btn = document.getElementById('btn-passar-turno');

        

        if (vencedorIniciativa === 'jogador') {

            if(btn) { btn.disabled = false; btn.innerHTML = "PASSAR<br>TURNO"; }

            window.mostrarBannerTCG('SUA INICIATIVA', 'rgba(0, 100, 0, 0.8)', '#4CAF50', () => {

                window.mostrarMensagemScanner(`⚠️ Você ganhou a Iniciativa de ${prop.toUpperCase()} (${valAta} vs ${valDef}). Ataque primeiro!`);

            });

        } else {

            if(btn) { btn.disabled = true; btn.innerHTML = "TURNO<br>OPONENTE"; }

            window.mostrarBannerTCG('INICIATIVA DO INIMIGO', 'rgba(100, 0, 0, 0.8)', '#e53935', () => {

                window.mostrarMensagemScanner(`⚠️ Oponente ganhou a Iniciativa de ${prop.toUpperCase()} (${valDef} vs ${valAta}). Ele ataca primeiro!`);

                

                // 🤖 Só o Bot passa o turno sozinho! Online você tem que esperar.

                if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") {

                    setTimeout(() => { window.passarTurno(true); }, 4000);

                }

            });

        }

        
window.retomarCronometro();
        atualizarTelaBatalha();

        // ==========================================
        // 🌟 GATILHO PASSIVO P2P: NATY ENTRA EM BATALHA! (REDE BLINDADA)
        // ==========================================
        let idMinhaNaty = null;
        let idNatyInimiga = null;

        if (atacante && atacante.nome === "Naty") {
            if (atacante.dono === 'jogador') idMinhaNaty = idAtacante;
            else idNatyInimiga = idAtacante;
        }
        if (defensor && defensor.nome === "Naty") {
            if (defensor.dono === 'jogador') idMinhaNaty = idDefensor;
            else idNatyInimiga = idDefensor;
        }

        if (idMinhaNaty) {
            let minhaNaty = obterCriaturaNoSlot(idMinhaNaty);
            minhaNaty.batalhasRealizadas = (minhaNaty.batalhasRealizadas || 0) + 1;
            
            if (minhaNaty.batalhasRealizadas === 1) {
                minhaNaty.elementos = ["Fogo", "Água", "Terra", "Ar"];
                window.mostrarMensagemScanner("🌟 1ª Batalha de Naty: Ela evocou os 4 Elementos automaticamente!");
                if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                    window.enviarAcaoRede({ tipo: 'naty_escolha_pronta', alvo: idMinhaNaty, elementos: minhaNaty.elementos, rodada: 1 });
                }
                atualizarTelaBatalha();
            } else {
                let qtdEscolha = 5 - minhaNaty.batalhasRealizadas;
                if (qtdEscolha < 1) qtdEscolha = 1;
                
                window.pausarCronometro(); // Tranca o Smart Clock local
                setTimeout(() => {
                    window.openModalNatyFix(idMinhaNaty, qtdEscolha);
                }, 600); 
            }
        } 
       else if (idNatyInimiga) {
            let natyInimiga = obterCriaturaNoSlot(idNatyInimiga);
            let numBatalha = (natyInimiga.batalhasRealizadas || 0) + 1;

            if (numBatalha === 1) {
                // 🔥 CORREÇÃO: Na primeira batalha, o computador do inimigo sabe que é automático! Não precisa travar a tela.
                natyInimiga.batalhasRealizadas = 1;
                natyInimiga.elementos = ["Fogo", "Água", "Terra", "Ar"];
                window.mostrarMensagemScanner("🌟 1ª Batalha de Naty: Ela evocou os 4 Elementos automaticamente!");
                atualizarTelaBatalha();
            } else {
                // ⏳ SE VOCÊ É O OPONENTE DA NATY: Congela sua tela com um escudo de rede até o dono dela escolher!
                window.pausarCronometro();
                if (!document.getElementById('bloqueio-espera-naty')) {
                    let msgNaty = document.createElement('div');
                    msgNaty.id = 'bloqueio-espera-naty';
                    msgNaty.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:9999999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; font-family:monospace; font-weight:bold; text-align:center;";
                    msgNaty.innerHTML = `<h2 style="color:#ffd700; font-size:22px; letter-spacing:3px; animation: pulse 1s infinite;">⏳ MOLDANDO ELEMENTOS...</h2><br><p style="color:#ccc; font-size:12px;">Aguardando oponente escolher os elementos da Naty.</p>`;
                    document.body.appendChild(msgNaty);
                }
                
                // 🤖 SALVA-VIDAS MODO BOT: Se for contra a máquina, ele solta a tela depois de um tempinho!
                if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") {
                    setTimeout(() => {
                        let banner = document.getElementById('bloqueio-espera-naty');
                        if (banner) banner.remove();
                        window.retomarCronometro();
                        natyInimiga.batalhasRealizadas = numBatalha;
                        atualizarTelaBatalha();
                    }, 2500);
                }
            }
        }

    }, 8000); 
}; // <-- Aqui fecha a função iniciarCombate


// ==========================================
// 🌟 TELA BOSS: SELETOR DE ELEMENTOS DA NATY
// ==========================================
window.abrirModalNaty = function(fullId, qtdGanha) {
    window.pausarCronometro(); 
    
    const modalHTML = `
        <div class="modal-overlay" id="overlay-naty" style="z-index: 10000000; background: rgba(0,0,0,0.95); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="modal-content-fichas" style="text-align: center; border: 3px solid #ffd700; background: #111; padding: 25px; border-radius: 10px; max-width: 340px;">
                <h2 style="color: #ffd700; font-family: 'Arial Black', sans-serif; margin-bottom: 10px; text-shadow: 0 0 10px #ffd700;">🌟 O PODER DA NATY</h2>
                <p style="color: #fff; font-size: 14px; margin-bottom: 20px;">Marque exatamente <b style="color:#00bcd4; font-size: 20px;">${qtdGanha}</b> elemento(s) para ela evocar nesta batalha!</p>
                
                <div id="naty-checkboxes" style="display: flex; gap: 15px; justify-content: center; font-size: 18px; margin-bottom: 25px; flex-wrap: wrap;">
                    <label style="cursor:pointer; background:#222; border:2px solid red; border-radius:8px; padding:10px; display:flex; align-items:center; gap:8px;"><input type="checkbox" value="Fogo" class="naty-cb" style="transform: scale(1.5);"> 🔥 Fogo</label>
                    <label style="cursor:pointer; background:#222; border:2px solid blue; border-radius:8px; padding:10px; display:flex; align-items:center; gap:8px;"><input type="checkbox" value="Água" class="naty-cb" style="transform: scale(1.5);"> 🌊 Água</label>
                    <label style="cursor:pointer; background:#222; border:2px solid brown; border-radius:8px; padding:10px; display:flex; align-items:center; gap:8px;"><input type="checkbox" value="Terra" class="naty-cb" style="transform: scale(1.5);"> ⛰️ Terra</label>
                    <label style="cursor:pointer; background:#222; border:2px solid gray; border-radius:8px; padding:10px; display:flex; align-items:center; gap:8px;"><input type="checkbox" value="Ar" class="naty-cb" style="transform: scale(1.5);"> ☁️ Ar</label>
                </div>
                
                <button class="btn-acao-modal" style="background:#222; border-color: #ffd700; color: #ffd700; font-size: 16px; width: 100%;" onclick="window.confirmarElementosNaty('${fullId}', ${qtdGanha})">CONFIRMAR E LUTAR</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 🔒 TRAVA DE SEGURANÇA: Se o jogador tentar roubar e marcar mais que o limite, desmarca sozinho!
    let checkboxes = document.querySelectorAll('.naty-cb');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', function() {
            let marcados = document.querySelectorAll('.naty-cb:checked').length;
            if (marcados > qtdGanha) {
                this.checked = false; 
            }
        });
    });
};

window.confirmarElementosNaty = function(fullId, qtdDesejada) {
    let marcados = document.querySelectorAll('.naty-cb:checked');
    
    // Se o teimoso não marcou a quantidade certa, recusa!
    if (marcados.length !== qtdDesejada) {
        window.mostrarMensagemScanner(`⚠️ Você DEVE marcar exatamente ${qtdDesejada} elemento(s)!`);
        if(window.tocarSFX) window.tocarSFX('erro');
        return;
    }

    let elementosEscolhidos = Array.from(marcados).map(cb => cb.value);
    document.getElementById('overlay-naty').remove();
    window.retomarCronometro(); // Destrava seu relógio
    
    let criatura = obterCriaturaNoSlot(fullId);
    if (criatura) {
        criatura.elementos = elementosEscolhidos;
        
        // 🔥 TRANSMISSOR CORRIGIDO: Avisa a rede global para destravar o celular do inimigo!
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'naty_escolha_pronta', alvo: fullId, elementos: criatura.elementos });
        }

        window.mostrarMensagemScanner(`🌟 Naty moldou seus elementos para: ${elementosEscolhidos.join(", ")}!`);
        if(window.tocarSFX) window.tocarSFX('notificacao');
        atualizarTelaBatalha();
    }
};

// Pequeno ajuste de nome para blindar a chamada
window.openModalNatyFix = function(fullId, qtdGanha) {
    if(typeof window.abrirModalNaty === 'function') window.abrirModalNaty(fullId, qtdGanha);
};

/////////////////////////////////////////////////////////////////////


// 🔥 MOTOR DO SONAR: Busca de Cartas (AGORA BLINDADO PARA REDE E OBJETOS)
window.abrirModalSonar = function() {
    let cartasBusca = [];
    
    // Filtra cartas de custo 1 ou menos (procurando no banco ATAQUES e Inventário)
    window.baralhoAtaques.forEach(item => {
        let buscaId = (typeof item === 'object') ? (item.id || item.nome) : item;
        let cardData = null;
        
        if (typeof ATAQUES !== 'undefined') cardData = ATAQUES.find(a => String(a.id) === String(buscaId) || a.nome === buscaId);
        if (!cardData && window.inventario) cardData = window.inventario.find(a => String(a.id) === String(buscaId) || a.nome === buscaId);

        if (cardData && cardData.custo <= 1) {
            cartasBusca.push({ idOriginal: item, idLimpo: buscaId, data: cardData });
        }
    });

    if (cartasBusca.length === 0) {
        window.mostrarMensagemScanner("⚠️ Nenhuma carta de custo 1 ou inferior encontrada no baralho.");
        return;
    }

    let htmlCartas = "";
    cartasBusca.forEach(item => {
        htmlCartas += `
            <div onclick="window.confirmarEscolhaSonar('${item.idLimpo}')" style="width: 80px; height: 115px; background-image: url('${item.data.img}'); background-size: cover; background-position: center; border: 2px solid #00bcd4; border-radius: 5px; cursor: pointer; box-shadow: 0 0 10px #00bcd4; transition: 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            </div>
        `;
    });

    const modalHTML = `
        <div class="modal-overlay" id="overlay-sonar" style="z-index: 10000000; background: rgba(0,0,0,0.95); flex-direction: column; display:flex; justify-content:center; align-items:center;">
            <h2 style="color: #00bcd4; font-family: 'Arial Black', sans-serif; text-shadow: 0 0 15px #00bcd4; margin-bottom: 20px;">🕵️‍♂️ SONAR ATIVADO</h2>
            <p style="color: #fff; margin-bottom: 20px; font-size: 14px;">Escolha uma carta de Custo 1 ou inferior:</p>
            <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; max-width: 90%;">${htmlCartas}</div>
            <button class="btn-acao-modal" style="width: 150px; background: #222; border: 2px solid #ff5555; color: #ff5555; margin-top: 30px;" onclick="document.getElementById('overlay-sonar').remove(); window.mostrarMensagemScanner('Busca no Sonar cancelada.');">CANCELAR</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.confirmarEscolhaSonar = function(idLimpoRecebido) {
    document.getElementById('overlay-sonar').remove();
    
    // Busca a carta usando a chave mestra (Ignora se o array tem Números, Strings ou Objetos)
    let index = window.baralhoAtaques.findIndex(item => {
        let cid = (typeof item === 'object') ? (item.id || item.nome) : item;
        return String(cid) === String(idLimpoRecebido);
    });

    if (index > -1) {
        let cartaRemovida = window.baralhoAtaques.splice(index, 1)[0]; 
        window.maoAtaques.push(cartaRemovida);
        
        // Embaralha o deck pós-busca
        window.baralhoAtaques = embaralharArray(window.baralhoAtaques);
        
        window.mostrarMensagemScanner("✅ Carta encontrada e adicionada à mão.");
        atualizarDecksEMaoCards();
        
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'sonar_busca_concluida' });
        }
    } else {
        window.mostrarMensagemScanner("❌ Erro de sincronia: Carta não encontrada no deck.");
    }
};


window.passarTurno = function(ignorarLimite) {
    let emCombate = window.estadoCombate && window.estadoCombate.ativo;

    if (emCombate && window.estadoTurno.jogadorAtual === 'jogador' && ignorarLimite !== true) {
        if (window.maoAtaques && window.maoAtaques.length > 5) {
            window.abrirModalDescarte();
            return; 
        }
    }

    // 🌐 SE FOR ONLINE: Envia o comando de passar o turno para a nuvem!
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        if (window.estadoTurno.jogadorAtual === 'jogador') {
            let proximoTurno = window.souP1Batalha ? 'p2' : 'p1';
            window.mostrarMensagemScanner("Enviando turno...");
            
            let btn = document.getElementById('btn-passar-turno');
            if (btn) btn.style.display = 'none'; // Some pra não clicar duas vezes
            
            // 🔥 O SEGREDO DO ANTI-TRAVAMENTO: Colamos um carimbo de tempo para o Firebase NUNCA ignorar a mensagem!
            let turnoComCarimbo = proximoTurno + '_' + Date.now();
            window._dbUpdate('salas_drome/' + window.salaBatalhaAtual, { turno_ativo: turnoComCarimbo });
            
            // Trava de segurança extra
            setTimeout(() => {
                if (window.estadoTurno.jogadorAtual === 'jogador') {
                    window.executarPassagemDeTurnoLocal();
                }
            }, 2500);
            
            return; 
        }
    }

    // Se for Bot ou Modo Simulado, roda o script local direto!
    window.executarPassagemDeTurnoLocal();
};




// 🌐 O RÁDIO DO FIREBASE: Fica escutando quem é o dono do turno

// 🔥 SISTEMA DE FILA PARA TURNOS RÁPIDOS
window.filaDeTurnos = [];
window.processandoTurno = false;

window.iniciarEscutaDeTurnoOnline = function() {
    window._dbOn('salas_drome/' + window.salaBatalhaAtual + '/turno_ativo', (snapshot) => {
        if (!snapshot.exists()) return;
        
        // Recebe o pacote do Firebase (Ex: "p1_1714000000")
        let turnoBruto = snapshot.val(); 
        
        // 🔥 Limpa o carimbo de tempo e pega só o 'p1' ou 'p2'
        let turnoVigente = turnoBruto;
        if (typeof turnoBruto === 'string' && turnoBruto.includes('_')) {
            turnoVigente = turnoBruto.split('_')[0]; 
        }
        
        let minhaVez = (window.souP1Batalha && turnoVigente === 'p1') || (!window.souP1Batalha && turnoVigente === 'p2');
        
        // Coloca o pedido de turno na fila para não atropelar animações!
        window.filaDeTurnos.push(minhaVez);
        window.processarFilaDeTurnos();
    });
};




window.processarFilaDeTurnos = function() {
    if (window.processandoTurno || window.filaDeTurnos.length === 0) return;
    window.processandoTurno = true; // Tranca a porta!
    
    let minhaVez = window.filaDeTurnos.shift();
    
    let modalJokenpo = document.getElementById('overlay-jokenpo');
    if (modalJokenpo) modalJokenpo.remove();

    if (window.estadoTurno.fase !== 'principal') {
        window.iniciarTurnoReal(minhaVez ? 'jogador' : 'oponente');
        // Libera a porta mais rápido na primeira rodada
        setTimeout(() => { window.processandoTurno = false; window.processarFilaDeTurnos(); }, 1000);
    } 
    else {
        if (minhaVez && window.estadoTurno.jogadorAtual === 'oponente') {
            window.executarPassagemDeTurnoLocal();
        } else if (!minhaVez && window.estadoTurno.jogadorAtual === 'jogador') {
            window.executarPassagemDeTurnoLocal();
        } else {
            // Se já for a vez de quem foi chamado, só ignora e destranca!
            window.processandoTurno = false; 
            window.processarFilaDeTurnos();
        }
    }
};




// O verdadeiro motor que vira a mesa (Separado do clique do botão)
window.executarPassagemDeTurnoLocal = function() {
    clearInterval(window.cronometroTurnoInterval); // Interrompe o relógio antigo
    let emCombate = window.estadoCombate && window.estadoCombate.ativo;

    if (typeof window.qtdMaoOponente === 'undefined') window.qtdMaoOponente = 3;
    if (typeof window.qtdBaralhoOponente === 'undefined') window.qtdBaralhoOponente = 17;
    if (typeof window.lixoAtaquesOponente === 'undefined') window.lixoAtaquesOponente = 0;
    if (typeof window.lixoAtaques === 'undefined') window.lixoAtaques = [];

    window.combateIniciadoNesteTurno = false;

    // 🔥 TIMING REVOLUCIONÁRIO (End of Turn): O Veneno pune o jogador que está TERMINANDO o turno!
    let jogadorSaindo = window.estadoTurno.jogadorAtual;
    
    // 🔥 LIMPEZA DA VINHA: Se quem está saindo do turno estava preso, a prisão acaba agora!
    if (window.turnosPresoVinha && window.turnosPresoVinha[jogadorSaindo] > 0) {
        window.turnosPresoVinha[jogadorSaindo] = 0;
    }

    // 🔥 CONTAGEM REGRESSIVA: Mão Eletrônica (Diminui 1 turno da penalidade)
    if (!window.bloqueioAtaqueTurnos) window.bloqueioAtaqueTurnos = { jogador: 0, oponente: 0 };
    if (window.bloqueioAtaqueTurnos[jogadorSaindo] > 0) {
        window.bloqueioAtaqueTurnos[jogadorSaindo] -= 1;
        if (window.bloqueioAtaqueTurnos[jogadorSaindo] === 0) {
            window.mostrarMensagemScanner(`⚡ Sistema restaurado! ${jogadorSaindo === 'jogador' ? 'Você' : 'O Oponente'} pode voltar a atacar.`);
        }
    }

    let ladoParaSofrerDano = jogadorSaindo === 'jogador' ? campoJogador : window.campoOponente;
    let prefixoLado = jogadorSaindo === 'jogador' ? 'jog-' : 'op-';

    if (ladoParaSofrerDano) {
        Object.keys(ladoParaSofrerDano).forEach(chave => {
            let monstro = ladoParaSofrerDano[chave];
            if (monstro && monstro.hpAtual > 0 && monstro.envenenadoLetal) {
                monstro.hpAtual -= 5;
                if (monstro.hpAtual < 0) monstro.hpAtual = 0;
                
                let nomeDono = jogadorSaindo === 'jogador' ? "Seu" : "O";
                window.mostrarMensagemScanner(`🐍 FIM DE TURNO: ${nomeDono} campeão ${monstro.nome} sofreu 5 de dano do Veneno Letal!`);
                if(window.tocarSFX) window.tocarSFX('notificacao');
                
                let elCard = document.getElementById(prefixoLado + chave);
                if(elCard) {
                    elCard.style.filter = "hue-rotate(270deg) saturate(200%)";
                    elCard.style.animation = "shake 0.5s";
                    setTimeout(() => { elCard.style.filter = ""; elCard.style.animation = ""; }, 600);
                }

                if (monstro.hpAtual === 0) {
                    setTimeout(() => window.encerrarCombateMorte(prefixoLado + chave), 500);
                }
            }
        });
    }

    if (window.estadoTurno.jogadorAtual === 'jogador') {
        window.estadoTurno.jogadorAtual = 'oponente';
        window.estadoTurno.turnoNumero++;
        
        if(window.campoOponente) Object.values(window.campoOponente).forEach(c => { if(c) c.moveuNesteTurno = false; });
        if(campoJogador) Object.values(campoJogador).forEach(c => { if(c) c.moveuNesteTurno = false; });
        
       if (emCombate) {
            if (window.turnosPresoVinha && window.turnosPresoVinha['oponente'] > 0) {
                window.mostrarMensagemScanner("🌿 Oponente preso na Vinha! Sem saque de cartas ou pontos de ataque neste turno.");
            } else {
                window.pontosAtaque['oponente'] += 1;
                
                // 🔥 CORREÇÃO: Conta o lixo corretamente, seja número ou lista online!
                let qtdLixoOp = Array.isArray(window.lixoAtaquesOponente) ? window.lixoAtaquesOponente.length : window.lixoAtaquesOponente;
                if (window.qtdBaralhoOponente <= 0 && qtdLixoOp > 0) {
                    window.qtdBaralhoOponente = qtdLixoOp;
                    window.lixoAtaquesOponente = Array.isArray(window.lixoAtaquesOponente) ? [] : 0;
                }
                if (window.qtdBaralhoOponente > 0) {
                    window.qtdMaoOponente++; 
                    window.qtdBaralhoOponente--; 
                }
            }
        }

        let btn = document.getElementById('btn-passar-turno');
        if(btn) { btn.style.display = 'block'; btn.disabled = true; btn.innerHTML = "TURNO<br>OPONENTE"; }
        
        window.mostrarBannerTCG('TURNO DO INIMIGO', 'rgba(100, 0, 0, 0.8)', '#e53935', () => {
            window.iniciarCronometroTurno(); // ⏱️ Liga o relógio na vez dele
            if (emCombate) {
                window.mostrarMensagemScanner("Turno do oponente no combate...");
                if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") setTimeout(() => { window.passarTurno(); }, 4000);
            } else {
                if (window.combateFinalizadoNesteTurno) {
                    window.combateFinalizadoNesteTurno = false; 
                    if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") {
                        window.sortearLocalAnimado('oponente', () => {
                            window.mostrarMensagemScanner("Turno de movimento do oponente...");
                            setTimeout(() => { window.passarTurno(); }, 4000);
                        });
                    } else { window.mostrarMensagemScanner("Aguardando oponente sortear o Local..."); }
                } else {
                    window.mostrarMensagemScanner("Turno de movimento do oponente...");
                    if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") setTimeout(() => { window.passarTurno(); }, 4000);
                }
            }
            
        });
    } else {
        if (emCombate && window.qtdMaoOponente > 5) {
            let excesso = window.qtdMaoOponente - 5;
            window.qtdMaoOponente = 5;
            // 🔥 CORREÇÃO: Adiciona genéricos na lista, em vez de bugar somando texto com número!
            if (Array.isArray(window.lixoAtaquesOponente)) {
                for(let i=0; i<excesso; i++) window.lixoAtaquesOponente.push("Carta Descartada");
            } else {
                window.lixoAtaquesOponente += excesso;
            }
        }

        window.estadoTurno.jogadorAtual = 'jogador';
        window.estadoTurno.turnoNumero++;
        window.combateIniciadoNesteTurno = false;
        
        if(window.campoOponente) Object.values(window.campoOponente).forEach(c => { if(c) c.moveuNesteTurno = false; });
        if(campoJogador) Object.values(campoJogador).forEach(c => { if(c) c.moveuNesteTurno = false; });
        
        if (emCombate) {
            if (window.turnosPresoVinha && window.turnosPresoVinha['jogador'] > 0) {
                window.mostrarMensagemScanner("🌿 Preso na Vinha! Você não comprou carta nem ganhou pontos de ataque neste turno.");
            } else {
                window.pontosAtaque['jogador'] += 1;
                if ((!window.baralhoAtaques || window.baralhoAtaques.length === 0) && window.lixoAtaques && window.lixoAtaques.length > 0) {
                    window.mostrarMensagemScanner("Baralho vazio! Reembaralhando o Lixo...");
                    window.baralhoAtaques = embaralharArray(window.lixoAtaques);
                    window.lixoAtaques = []; 
                }
                if (window.baralhoAtaques && window.baralhoAtaques.length > 0) window.maoAtaques.push(window.baralhoAtaques.shift());
            }
        }

        let btn = document.getElementById('btn-passar-turno');
        if(btn) { btn.style.display = 'block'; btn.disabled = false; btn.innerHTML = "PASSAR<br>TURNO"; }
        
        window.mostrarBannerTCG('SUA VEZ', 'rgba(0, 100, 0, 0.8)', '#4CAF50', () => {
            window.iniciarCronometroTurno(); // ⏱️ Liga o relógio na sua vez
            if (emCombate) {
                window.mostrarMensagemScanner("Sua vez de atacar! +1 Ponto e +1 Carta.");
            } else {
                if (window.combateFinalizadoNesteTurno) {
                    window.combateFinalizadoNesteTurno = false;
                    window.sortearLocalAnimado('jogador', () => { window.mostrarMensagemScanner("Sua vez! Movimente suas criaturas."); });
                } else {
                    window.mostrarMensagemScanner("Sua vez! Movimente suas criaturas.");
                }
            }
          
        });
    }

    
    atualizarTelaBatalha(); 
    if (typeof window.atualizarSeusContadoresDeAtaque === 'function') window.atualizarSeusContadoresDeAtaque();

    setTimeout(() => {
        window.processandoTurno = false;
        window.processarFilaDeTurnos();
    }, 1500); 
};

// ==========================================
// 🔥 MOTOR DE DESCARTE E LIXO DA MÃO 🔥
// ==========================================
window.abrirModalDescarte = function() {
    let excesso = window.maoAtaques.length - 5;
    let htmlCartas = "";

    window.maoAtaques.forEach((idAtaque, index) => {
        let cartaOriginal = window.inventario.find(c => c.id == idAtaque);
        if (cartaOriginal) {
            htmlCartas += `
                <div onclick="window.descartarCartaAtaque(${index}, '${idAtaque}')" style="width: 70px; height: 100px; background-image: url('${cartaOriginal.img}'); background-size: cover; background-position: center; border: 2px solid #ff5555; border-radius: 5px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                </div>
            `;
        }
    });

    const modalHTML = `
        <div class="modal-overlay" id="overlay-descarte" style="z-index: 1000000; background: rgba(0,0,0,0.95); flex-direction: column;">
            <h2 style="color: #ff5555; text-shadow: 0 0 10px #ff5555; margin-bottom: 10px;">LIMITE DE MÃO EXCEDIDO!</h2>
            <p style="color: #fff; margin-bottom: 20px; font-size: 14px;">Selecione e descarte <b style="color:#ffd700; font-size: 18px;">${excesso}</b> carta(s) para passar o turno.</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; max-width: 90%;">
                ${htmlCartas}
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.descartarCartaAtaque = function(index, idAtaque) {
    document.getElementById('overlay-descarte').remove();
    
    // Tira da mão e joga pro Lixo Local
    window.maoAtaques.splice(index, 1);
    if (typeof window.lixoAtaques === 'undefined') window.lixoAtaques = [];
    window.lixoAtaques.push(idAtaque);

    // 🔥 CORREÇÃO NUVEM: Acha o NOME da carta para mandar pela rede (o inimigo não tem seu ID numérico)
    let carta = window.inventario.find(c => c.id == idAtaque);
    let nomeAtaque = carta ? carta.nome : idAtaque;

    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        window.enviarAcaoRede({ tipo: 'descarte_lixo', idCarta: nomeAtaque, categoria: 'ataque' });
    }
    
    atualizarDecksEMaoCards(); 

    if (window.maoAtaques.length > 5) {
        window.abrirModalDescarte();
    } else {
        window.mostrarMensagemScanner("Descarte concluído! Passando o turno...");
        window.passarTurno(true);
    }
};


window.abrirModalAtaque = function(indexMao, idAtaque, cartaInventario) {
    if (document.getElementById('overlay-ataque')) return;

    let ataqueDB = typeof ATAQUES !== 'undefined' ? ATAQUES.find(a => a.nome === cartaInventario.nome) : null;
    let custo = ataqueDB ? ataqueDB.custo : 0;
    let dano = ataqueDB ? ataqueDB.danoBase : 0;
    let img = ataqueDB ? ataqueDB.img : cartaInventario.img;

    let ptsAtuais = window.pontosAtaque['jogador'] || 0;
    let emCombate = window.estadoCombate && window.estadoCombate.ativo;
    let ehMeuTurno = (window.estadoTurno.jogadorAtual === 'jogador');
    
    // 🔥 REGRA OFICIAL TCG: Ataques NORMAIS só entram no SEU turno (sem burst inimigo)
    let podeAtacar = (emCombate && ehMeuTurno && !window.aguardandoResposta);
    let temPontos = (ptsAtuais >= custo);

    // 🌪️ CADEADO ELEMENTAL: TORNADO (Checa os elementos dinâmicos do momento)
    let bloqueioTornado = false;
    if (cartaInventario.nome === "TORNADO" && emCombate) {
        let idMeuAtivo = window.estadoCombate.atacante;
        let p1Card = obterCriaturaNoSlot(idMeuAtivo);
        if (p1Card && p1Card.dono !== 'jogador') idMeuAtivo = window.estadoCombate.defensor;
        
        let meuMonstro = obterCriaturaNoSlot(idMeuAtivo);
        if (meuMonstro) {
            let elementosAtuais = meuMonstro.elementos || [];
            // O '.some()' checa se há QUALQUER Ar/Vento correndo nas veias dele
            let temAr = elementosAtuais.some(e => e.toLowerCase() === 'ar' || e.toLowerCase() === 'vento');
            if (!temAr) bloqueioTornado = true;
        }
    }

    let btnUsarHTML = "";
    
    // Inicia a variável caso seja a primeira vez abrindo
    if (!window.bloqueioAtaqueTurnos) window.bloqueioAtaqueTurnos = { jogador: 0, oponente: 0 };

    if (window.turnosPresoVinha && window.turnosPresoVinha['jogador'] > 0) {
        btnUsarHTML = `<p style="font-size: 10px; color: #4CAF50; margin-bottom: 10px;">🌿 Preso na Vinha! Ataques bloqueados neste turno.</p>`;
    } else if (window.bloqueioAtaqueTurnos['jogador'] > 0) {
        btnUsarHTML = `<button class="btn-acao-modal" style="border-color: #555; color: #555; background: #222;" disabled>⚡ Hackeado! (${window.bloqueioAtaqueTurnos['jogador']} Turno(s) Restante(s))</button>`;
    } else if (window.aguardandoResposta) {
        btnUsarHTML = `<p style="font-size: 10px; color: #ff9800; margin-bottom: 10px;">Ataques não podem ser ativados em resposta na Corrente (Burst)!</p>`;
    } else if (bloqueioTornado) {
        btnUsarHTML = `<button class="btn-acao-modal" style="border-color: #555; color: #555; background: #222;" disabled>☁️ Requer Elemento Ar</button>`;
    } else if (podeAtacar) {
        if (temPontos) {
            // 🤝 SE FOR A ALIANÇA, O BOTÃO É OUTRO!
            if (ataqueDB && ataqueDB.id === 103) {
                btnUsarHTML = `<button class="btn-acao-modal" style="border-color: #4CAF50; color: #4CAF50; background: #002200; font-size: 16px;" onclick="window.abrirModalAlianca(${indexMao}, '${idAtaque}', ${custo}, '${cartaInventario.nome}')">🤝 ESCOLHER ALIADO MORTO</button>`;
            } else {
                btnUsarHTML = `<button class="btn-acao-modal" style="border-color: #e53935; color: #e53935; background: #220000; font-size: 16px;" onclick="window.usarCartaAtaque(${indexMao}, '${idAtaque}', ${custo}, ${dano}, '${cartaInventario.nome}')">💥 USAR ATAQUE</button>`;
            }
        } else {
            btnUsarHTML = `<button class="btn-acao-modal" style="border-color: #555; color: #555; background: #222;" disabled>Sem Pontos Suficientes</button>`;
        }
    } else {
        btnUsarHTML = `<p style="font-size: 10px; color: #ff9800; margin-bottom: 10px;">Ataques permitidos apenas durante o seu turno no Combate!</p>`;
    }

    const modalHTML = `
        <div class="modal-overlay" id="overlay-ataque" style="z-index: 9999999;" onclick="if(event.target === this) this.remove()">
            <div class="modal-content-fichas" style="text-align:center;">
                <h3 style="color:#e53935;margin-bottom:5px;">${cartaInventario.nome}</h3>
                <div onclick="window.ampliarCartaClicada('${img}')" style="width:140px;height:200px;margin:0 auto 10px auto;background-image:url('${img}');background-size:cover;background-position:center;border:2px solid #e53935;border-radius:10px;box-shadow: 0 0 15px rgba(229, 57, 53, 0.4); cursor: pointer;">
                    <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; opacity: 0; background: rgba(0,0,0,0.5); border-radius: 8px; transition: 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                        <span style="color: white; font-weight: bold; font-size: 12px;">🔍 VER CARTA</span>
                    </div>
                </div>
                <p style="font-size:14px; color:#ffd700; margin-bottom:5px;">Seus Pontos de Ataque: <b style="font-size:18px;">${ptsAtuais}</b></p>
                <p style="font-size:12px; color:#fff; margin-bottom:15px;">Dano Base: <b>${dano}</b> | Custo: <b>${custo}</b></p>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${btnUsarHTML}
                    <button class="btn-acao-modal btn-cancelar" onclick="document.getElementById('overlay-ataque').remove()">Cancelar</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('tela-batalha').insertAdjacentHTML('beforeend', modalHTML);
};


window.usarCartaAtaque = function(indexMao, idAtaque, custo, danoBase, nomeAtaque) {
    let modalAtaque = document.getElementById('overlay-ataque');
    if (modalAtaque) modalAtaque.remove();

    window.pontosAtaque['jogador'] -= custo;
    window.maoAtaques.splice(indexMao, 1);
    window.lixoAtaques.push(idAtaque); // ID local para o baralho embaralhar depois
    
    // 🔥 CORREÇÃO NUVEM: Envia o NOME (nomeAtaque) em vez do ID, para o detetive inimigo achar a arte!
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        window.enviarAcaoRede({ tipo: 'descarte_lixo', idCarta: nomeAtaque, categoria: 'ataque' });
    }

    atualizarDecksEMaoCards();
 
    
    if (typeof window.atualizarSeusContadoresDeAtaque === 'function') window.atualizarSeusContadoresDeAtaque();

    // ==========================================
    // 🧠 MOTOR DE CONTINUAÇÃO (Roda APÓS os dados ou imediatamente)
    // ==========================================
    let processarAtaqueFinal = function(dadoSorteado) {
        let nomeAcaoBurst = nomeAtaque;
        let msgBonus = "";

        // 🔥 SE TEVE DADO, MULTIPLICA O DANO E MUDA O NOME DA AÇÃO!
        if (dadoSorteado !== null) {
            danoBase = danoBase * dadoSorteado;
            nomeAcaoBurst = `${nomeAtaque} [🎲 x${dadoSorteado}]`;
            msgBonus += `[🎲 x${dadoSorteado}] `;
        }

        // 🔥 LÓGICA DO DANO (ELEMENTAL + CHECAGEM DE ATRIBUTOS) 🔥
        let ataqueDB = typeof ATAQUES !== 'undefined' ? ATAQUES.find(a => a.nome === nomeAtaque) : null;
        let danoExtra = 0;

        let idMeuMonstro = null;
        let idMonstroInimigo = null;

        if (window.estadoCombate && window.estadoCombate.ativo) {
            let p1Card = obterCriaturaNoSlot(window.estadoCombate.atacante);
            let p2Card = obterCriaturaNoSlot(window.estadoCombate.defensor);

            if (p1Card && p1Card.dono === 'jogador') { idMeuMonstro = window.estadoCombate.atacante; } 
            else { idMonstroInimigo = window.estadoCombate.atacante; }

            if (p2Card && p2Card.dono === 'jogador') { idMeuMonstro = window.estadoCombate.defensor; } 
            else { idMonstroInimigo = window.estadoCombate.defensor; }
        }

        if (ataqueDB && idMeuMonstro && idMonstroInimigo) {
            let minhaCriatura = obterCriaturaNoSlot(idMeuMonstro);
            let criaturaInimiga = obterCriaturaNoSlot(idMonstroInimigo); 
            
            if (minhaCriatura) {
                let dFogo = ataqueDB.fogo || ataqueDB.danoElemental?.fogo || 0;
                let dAgua = ataqueDB.agua || ataqueDB.danoElemental?.agua || 0;
                let dTerra = ataqueDB.terra || ataqueDB.danoElemental?.terra || 0;
                let dAr = ataqueDB.ar || ataqueDB.vento || ataqueDB.danoElemental?.ar || ataqueDB.danoElemental?.vento || 0;

                if (dFogo > 0 || dAgua > 0 || dTerra > 0 || dAr > 0) {
                    // ==========================================
                    // ⚙️ MOTOR DE EQUIPAMENTOS: IMUNIDADE ELEMENTAL
                    // ==========================================
                    let imunidadeElemental = false;
                    if (criaturaInimiga && criaturaInimiga.equipamento && criaturaInimiga.equipamentoRevelado) {
                        if (criaturaInimiga.equipamento.nome === "Anel Precioso") {
                            imunidadeElemental = true;
                            msgBonus += "[💍 IMUNE A ELEMENTOS] ";
                        }
                    }

                    if (!imunidadeElemental) {
                        let elemsBrutos = minhaCriatura.elementos;
                        if ((!elemsBrutos || elemsBrutos.length === 0) && typeof MONSTROS !== 'undefined') {
                            let dbCarta = MONSTROS.find(m => m.nome === minhaCriatura.nome);
                            if (dbCarta && dbCarta.elementos) elemsBrutos = dbCarta.elementos;
                        }
                        let textoElementos = JSON.stringify(elemsBrutos || "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

                        if (textoElementos.includes('fogo') && dFogo > 0) { danoExtra += parseInt(dFogo); msgBonus += `[+${dFogo} 🔥] `; }
                        if (textoElementos.includes('agua') && dAgua > 0) { danoExtra += parseInt(dAgua); msgBonus += `[+${dAgua} 🌊] `; }
                        if (textoElementos.includes('terra') && dTerra > 0) { danoExtra += parseInt(dTerra); msgBonus += `[+${dTerra} ⛰️] `; }
                        if ((textoElementos.includes('ar') || textoElementos.includes('vento')) && dAr > 0) { danoExtra += parseInt(dAr); msgBonus += `[+${dAr} ☁️] `; }
                    }
                }
            // ==========================================
                // ⚔️ MOTOR DE EQUIPAMENTOS: BÔNUS DE DANO (Braceletes)
                // ==========================================
                if (minhaCriatura.equipamento && minhaCriatura.equipamentoRevelado) {
                    let eqNome = minhaCriatura.equipamento.nome.toLowerCase();
                    
                    // Buff: Bracelete de Cristal (Terra +5)
                    if ((eqNome === "bracelete de cristal" || eqNome === "bracelete da terra") && dTerra > 0) {
                        danoExtra += 5;
                        msgBonus += "[⛰️ +5 Bracelete] ";
                    }
                    
                    // Buff: Bracelete de Água (Água +5)
                    if ((eqNome === "bracelete de água" || eqNome === "bracelete de agua") && dAgua > 0) {
                        danoExtra += 5;
                        msgBonus += "[🌊 +5 Bracelete] ";
                    }
                }

                if (ataqueDB.checkAtributo && criaturaInimiga) {
                    let attr = ataqueDB.checkAtributo.atributo.toLowerCase(); 
                    let bonus = ataqueDB.checkAtributo.danoExtra;
                    let valAta = minhaCriatura.statsMax ? (minhaCriatura.statsMax[attr] || 0) : 0;
                    let valDef = criaturaInimiga.statsMax ? (criaturaInimiga.statsMax[attr] || 0) : 0;
                    if (valAta > valDef) {
                        danoExtra += bonus;
                        let iconesAttr = { 'coragem': '❤️', 'poder': '⚡', 'sabedoria': '👁️', 'velocidade': '💨' };
                        msgBonus += `[+${bonus} Check ${iconesAttr[attr] || ''}] `;
                    }
                }
            } // <-- Fecha o if (minhaCriatura)
        } // <-- Fecha o if (ataqueDB && idMeuMonstro && idMonstroInimigo)

        // ==========================================
        // 👻 EFEITOS DINÂMICOS DE CARTA (Graveyard Scaling)
        // ==========================================
       // ==========================================
        // 👻 EFEITOS DINÂMICOS DE CARTA (Graveyard Scaling)
        // ==========================================
        if (ataqueDB && (ataqueDB.id === 113 || ataqueDB.id === 114)) {
            let qtdMortos = 0;
            // Filtra o seu cemitério contando APENAS nomes de monstros (ignora magias e equips)
            if (window.cemiterio && window.cemiterio.length > 0 && typeof MONSTROS !== 'undefined') {
                qtdMortos = window.cemiterio.filter(nomeMorto => MONSTROS.some(m => m.nome === nomeMorto)).length;
            }
            
            if (qtdMortos > 0) {
                let bonusCemiterio = qtdMortos * 5;
                danoExtra += bonusCemiterio;
                // Exibe dinamicamente o nome da carta que ativou o efeito (Purgatório ou Esqueleto)
                msgBonus += `[👻 +${bonusCemiterio} ${ataqueDB.nome}] `;
            }
        }
        
        // ==========================================
        // 🗺️ MOTOR DE LOCAIS: MODIFICADORES DE DANO
        // ==========================================
        let locDBAtual = null;
        if (window.localAtivoAtual) {
            if (typeof LOCAIS_DB !== 'undefined') locDBAtual = LOCAIS_DB.find(l => l.img === window.localAtivoAtual);
            if (!locDBAtual && window.inventario) locDBAtual = window.inventario.find(l => l.img === window.localAtivoAtual);
        }

        if (locDBAtual && locDBAtual.nome === "O Túnel da Tempestade") {
            let ataqueTemVento = (ataqueDB && (ataqueDB.ar > 0 || ataqueDB.vento > 0 || (ataqueDB.danoElemental && (ataqueDB.danoElemental.ar > 0 || ataqueDB.danoElemental.vento > 0))));
            let ataqueTemAgua = (ataqueDB && (ataqueDB.agua > 0 || (ataqueDB.danoElemental && ataqueDB.danoElemental.agua > 0)));

            if (ataqueTemVento) {
                danoExtra += 5;
                msgBonus += "[🌪️ +5 Dano Aéreo] ";
            }
            if (ataqueTemAgua) {
                danoExtra -= 5;
                msgBonus += "[💧 -5 Dano Aquático] ";
            }
        }

        // 🔥 CORREÇÃO MATEMÁTICA: Garante que o dano não fique negativo e cure o inimigo por acidente!
        let danoTotal = Math.max(0, danoBase + danoExtra);

        // ==========================================
        // 🛡️ GATILHOS PASSIVOS: Imunidades (Rex, Amuleto do Vácuo, etc)
        // ==========================================
        if (ataqueDB && idMonstroInimigo) {
            let defensorAtual = obterCriaturaNoSlot(idMonstroInimigo);
            // Descobre se o ataque possui elemento Vento/Ar na raiz dele
            let ataqueTemVento = (ataqueDB.ar > 0 || ataqueDB.vento > 0 || (ataqueDB.danoElemental && (ataqueDB.danoElemental.ar > 0 || ataqueDB.danoElemental.vento > 0)));
            
            if (defensorAtual && ataqueTemVento) {
                // Checa se o equipamento está equipado e revelado (virado para cima)
                let temAmuleto = (defensorAtual.equipamento && defensorAtual.equipamentoRevelado && defensorAtual.equipamento.nome === "Amuleto do Vácuo");
                
                // Se for o Rex OU se estiver usando o Amuleto... anula o dano!
                if (defensorAtual.nome === "Rex" || temAmuleto) {
                    danoTotal = 0; 
                    msgBonus = "[🛡️ IMUNE A VENTO] ";
                }
            }
        }

        let acaoDoAtaque = {
            dono: 'jogador',
            nomeAcao: nomeAcaoBurst,
            tipo: 'ataque',
            executar: function() {
                // 1. ATUALIZA A MIRA DINAMICAMENTE (Caso o Spedman tenha trocado de lugar com o alvo original)
                let alvoAtualId = idMonstroInimigo;
                if (window.estadoCombate && window.estadoCombate.ativo) {
                    alvoAtualId = (window.estadoCombate.atacante === idMeuMonstro) ? window.estadoCombate.defensor : window.estadoCombate.atacante;
                }
                
                if (!alvoAtualId) return;

                // 2. APLICA A PROTEÇÃO DO SPEDMAN NO EXATO MOMENTO DO IMPACTO
                let danoFinalAposBurst = danoTotal;
                let mensagemFinalBonus = msgBonus;
                
                if (window.spedmanProtecaoAtivaInimiga) {
                    window.spedmanProtecaoAtivaInimiga = false;
                    danoFinalAposBurst = 0;
                    mensagemFinalBonus = "[⚡ ANULADO POR SPEDMAN] ";
                }

                let alvo = obterCriaturaNoSlot(alvoAtualId);
                
                if (alvo) {
                    // ==========================================
                    // 1º PASSO: APLICAR O DANO BRUTO IMEDIATAMENTE
                    // ==========================================
                    alvo.hpAtual -= danoFinalAposBurst; 
                    if (alvo.hpAtual < 0) alvo.hpAtual = 0; // Trava o negativo
                    if(window.tocarSFX) window.tocarSFX('notificacao'); 
                    
                    let msgScanner = `💥 Dano aplicado! ${alvo.nome} perdeu ${danoFinalAposBurst} de energia!`;
                    
                    if (danoFinalAposBurst === 0 && mensagemFinalBonus.includes("SPEDMAN")) {
                        msgScanner = `⚡ SPEDMAN DEFENDEU! Ele assumiu a linha de frente e o dano foi reduzido a ZERO!`;
                    } else if (danoExtra > 0 || dadoSorteado !== null) {
                        msgScanner = `💥 DANO AUMENTADO! ${alvo.nome} perdeu ${danoFinalAposBurst} de energia! (${danoBase} Base + ${danoExtra} Bônus ${mensagemFinalBonus})`;
                    }
                    if (danoFinalAposBurst === 0 && alvo.nome === "Rex") {
                        msgScanner = `🛡️ REX IMUNE! O ataque de Vento se dissipou nas escamas dele (0 de dano)!`;
                    }
                    
                    window.mostrarMensagemScanner(msgScanner);

                    // 🌐 O TRANSMISSOR IMEDIATO: O Dano viaja na frente!
                    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                        window.enviarAcaoRede({ tipo: 'dano', alvo: alvoAtualId, valor: danoFinalAposBurst });
                    }
                    
                    let elAlvo = document.getElementById(alvoAtualId);
                    if(elAlvo) {
                        elAlvo.style.animation = "shake 0.5s";
                        setTimeout(() => { elAlvo.style.animation = ""; }, 500);
                    }
                    atualizarTelaBatalha();

                    let morreuPeloDanoBruto = (alvo.hpAtual === 0);
                    if (morreuPeloDanoBruto) {
                        setTimeout(() => window.encerrarCombateMorte(alvoAtualId), 1000);
                    }

                    // ==========================================
                    // 2º PASSO: EFEITOS SECUNDÁRIOS DO ATAQUE 
                    // ==========================================
                    setTimeout(() => {
                        // 🧪 EFEITO: Ácido Gástrico (ID 101)
                        if (ataqueDB && ataqueDB.id === 101) {
                            if (alvo.equipamento) {
                                let eqText = (alvo.equipamento.efeito || "").toLowerCase();
                                if (eqText.includes('indestrutível') || eqText.includes('indestrutivel')) {
                                    window.mostrarMensagemScanner("🛡️ O equipamento resistiu ao Ácido (Indestrutível)!");
                                } else {
                                    let nomeEqRemovido = window.removerEquipamentoMesa(alvoAtualId, true); 
                                    window.mostrarMensagemScanner(`🧪 Ácido derreteu o equipamento: ${nomeEqRemovido}!`);
                                    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                                        window.enviarAcaoRede({ tipo: 'destruir_equipamento', alvo: alvoAtualId, nomeEquip: nomeEqRemovido });
                                    }
                                }
                            }
                        }


                        
                        // 🌑 EFEITO: Mão Negra (ID 102)
                        if (ataqueDB && ataqueDB.id === 102) {
                            window.mostrarMensagemScanner("🌑 Mão Negra ativada! Roubando carta da mente do inimigo...");
                            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                                window.enviarAcaoRede({ tipo: 'mao_negra_roubar' });
                            } else {
                                if (window.qtdMaoOponente > 0) {
                                    window.qtdMaoOponente--; 
                                    let todosAtaques = typeof ATAQUES !== 'undefined' ? ATAQUES : window.inventario.filter(c => c.tipoCarta === 'Ataque');
                                    let cartaSimulada = todosAtaques[Math.floor(Math.random() * todosAtaques.length)];
                                    window.receberCartaRoubada(cartaSimulada.id || cartaSimulada.nome); 
                                } else {
                                    window.mostrarMensagemScanner("O oponente tentou roubar, mas não há cartas!");
                                }
                            }
                        }


                        
                        // 🌪️ EFEITO: Vento Forte (ID 105)
                        if (ataqueDB && ataqueDB.id === 105 && danoFinalAposBurst > 0) {
                            let temOculta = false;
                            if (window.campoOponente) {
                                Object.values(window.campoOponente).forEach(c => {
                                    if (c && c.hpAtual > 0 && c.revelada === false) temOculta = true;
                                });
                            }
                            
                            if (temOculta) {
                                window.modoAlvo = { tipo: 'revelar_inimigo' };
                                window.atualizarInterfaceMira("Vento Forte ativado! Clique em um campeão inimigo oculto para revelá-lo.");
                                window.pausarCronometro(); 
                            } else {
                                window.mostrarMensagemScanner("🌪️ Vento Forte teve sucesso, mas não há campeões ocultos para revelar.");
                            }
                        }

                        
                        // 🐍 EFEITO: Armadilha de Víbora (ID 106)
                        if (ataqueDB && ataqueDB.id === 106 && danoFinalAposBurst > 0) {
                            alvo.envenenadoLetal = true; // Cria a flag de Incurável!
                            
                            window.mostrarMensagemScanner(`🐍 TSSSS! ${alvo.nome} foi infectado pela Armadilha de Víbora (Veneno Letal Incurável)!`);
                            
                            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                                 window.enviarAcaoRede({ tipo: 'aplicar_status', alvo: alvoAtualId, status: 'envenenadoLetal', valor: true });
                            }
                        }

                        
                        // 🌿 EFEITO: Armadilha de Vinha (ID 107)
                        if (ataqueDB && ataqueDB.id === 107 && danoFinalAposBurst > 0) {
                            let vitima = (window.estadoTurno.jogadorAtual === 'jogador') ? 'oponente' : 'jogador';
                            if (!window.turnosPresoVinha) window.turnosPresoVinha = { jogador: 0, oponente: 0 };
                            window.turnosPresoVinha[vitima] = 1;
                            
                            window.mostrarMensagemScanner(`🌿 ARMADILHA DE VINHA! O próximo turno de ${vitima === 'jogador' ? 'Você' : 'Oponente'} foi anulado!`);
                            
                            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                                 window.enviarAcaoRede({ tipo: 'ativar_armadilha_vinha' });
                            }
                        }


                        
                        // 🕵️‍♂️ EFEITO: SONAR (ID 110)
                        if (ataqueDB && ataqueDB.id === 110) {
                            setTimeout(() => {
                                window.abrirModalSonar();
                            }, 500);
                        }

                        // ⚡ EFEITO: MÃO ELETRÔNICA (ID 111)
                        if (ataqueDB && ataqueDB.id === 111 && danoFinalAposBurst > 0) {
                            let vitima = (window.estadoTurno.jogadorAtual === 'jogador') ? 'oponente' : 'jogador';
                            if (!window.bloqueioAtaqueTurnos) window.bloqueioAtaqueTurnos = { jogador: 0, oponente: 0 };
                            window.bloqueioAtaqueTurnos[vitima] = 2; // Trava por 2 turnos
                            
                            window.mostrarMensagemScanner(`⚡ MÃO ELETRÔNICA! O sistema de ataque de ${vitima === 'jogador' ? 'Você' : 'Oponente'} foi hackeado por 2 turnos!`);
                            
                            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                                 window.enviarAcaoRede({ tipo: 'ativar_mao_eletronica' });
                            }
                        }


                        // 👊 EFEITO: MÃO MÃO (ID 112)
                        if (ataqueDB && ataqueDB.id === 112 && danoFinalAposBurst > 0) {
                            let vitima = (window.estadoTurno.jogadorAtual === 'jogador') ? 'oponente' : 'jogador';
                            if (!window.bloqueioAtaqueTurnos) window.bloqueioAtaqueTurnos = { jogador: 0, oponente: 0 };
                            
                            // Math.max garante que se ele já estiver preso por 2 turnos, a carta não vai reduzir pra 1 turno!
                            window.bloqueioAtaqueTurnos[vitima] = Math.max(window.bloqueioAtaqueTurnos[vitima], 1);
                            
                            window.mostrarMensagemScanner(`👊 MÃO MÃO! O sistema de ataque de ${vitima === 'jogador' ? 'Você' : 'Oponente'} foi esmagado por 1 turno!`);
                            
                            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                                 window.enviarAcaoRede({ tipo: 'ativar_mao_mao' });
                            }
                        }

                        // 💨 EFEITO: SOPRO (ID 115)
                        if (ataqueDB && ataqueDB.id === 115) {
                            window.mostrarMensagemScanner(`💨 SOPRO! Uma ventania atinge a mão do oponente...`);
                            
                            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                                window.enviarAcaoRede({ tipo: 'ativar_sopro' });
                            } else {
                                // Lógica para o modo offline (bot)
                                if (window.qtdMaoOponente > 0) {
                                    window.qtdMaoOponente--;
                                    window.mostrarMensagemScanner(`💨 O oponente descartou uma carta.`);
                                    atualizarDecksEMaoCards();
                                }
                            }
                        }

                        
                        
                        // 🌪️ EFEITO: TORNADO (ID 109)
                        if (ataqueDB && ataqueDB.id === 109) {
                            window.mostrarMensagemScanner("🌪️ TORNADO ATIVADO! A mão inimiga foi varrida de volta para o baralho!");
                            
                            // Ajuste visual numérico na nossa tela do que aconteceu com ele
                            if (window.qtdMaoOponente > 0) {
                                window.qtdBaralhoOponente += window.qtdMaoOponente;
                                window.qtdMaoOponente = 0;
                            }
                            
                            let saque = Math.min(2, window.qtdBaralhoOponente);
                            window.qtdBaralhoOponente -= saque;
                            window.qtdMaoOponente += saque;

                            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                                 window.enviarAcaoRede({ tipo: 'ativar_tornado' });
                            }
                        }

                        
                        // ⚡ EFEITO: SPEED (ID 108) - Compra de Carta Extra
                        if (ataqueDB && ataqueDB.id === 108) {
                            // Inteligência do Motor: Se o deck estiver vazio, reembaralha o lixo para você comprar!
                            if ((!window.baralhoAtaques || window.baralhoAtaques.length === 0) && window.lixoAtaques && window.lixoAtaques.length > 0) {
                                window.baralhoAtaques = embaralharArray(window.lixoAtaques);
                                window.lixoAtaques = [];
                                window.mostrarMensagemScanner("Baralho vazio! Reembaralhando o Lixo para o efeito de SPEED...");
                            }

                            if (window.baralhoAtaques && window.baralhoAtaques.length > 0) {
                                window.maoAtaques.push(window.baralhoAtaques.shift());
                                window.mostrarMensagemScanner(`⚡ SPEED ativado! Você comprou uma carta de ataque extra.`);
                                atualizarDecksEMaoCards(); // Desenha a nova carta na tela
                                
                                // Avisa o adversário para colocar a carta na sua mão virtual
                                if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                                    window.enviarAcaoRede({ tipo: 'comprar_carta_extra' });
                                }
                            } else {
                                window.mostrarMensagemScanner(`⚡ SPEED ativado, mas você não tem mais cartas no jogo!`);
                            }
                        }


                        
                        if (!morreuPeloDanoBruto && alvo.hpAtual === 0) {
                            setTimeout(() => window.encerrarCombateMorte(alvoAtualId), 1000);
                        }
                    }, 200); 
                }
            }
        };

        window.adicionarAoBurst(acaoDoAtaque);

        // ==========================================
        // 🦁 GATILHO PASSIVO: A Fúria Sniper da Leona!
        // ==========================================
        let atacanteAtual = idMeuMonstro ? obterCriaturaNoSlot(idMeuMonstro) : null;
        
        if (atacanteAtual && atacanteAtual.nome === "Leona") {
            window.modoAlvo = {
                tipo: 'passiva_leona',
                origem: idMeuMonstro
            };
            window.pausarCronometro();
            
            // 🔥 ANIMAÇÃO ÉPICA PARA CHAMAR ATENÇÃO DO JOGADOR
            if(typeof window.mostrarBannerTCG === 'function') {
                window.mostrarBannerTCG('PASSIVA DA LEONA', 'rgba(229, 57, 53, 0.8)', '#ffd700');
            }
            
           setTimeout(() => {
                window.atualizarInterfaceMira("Selecione o alvo para o efeito passivo de 5 de dano da Leona!");
            }, 300);
            
            if (window.tocarSFX) window.tocarSFX('notificacao');
        }
    }; // FECHA A FUNÇÃO processarAtaqueFinal


    // ==========================================
    // 🎲 O GATILHO DA ANIMAÇÃO (Antes do Burst)
    // ==========================================
    if (nomeAtaque === "Fogo Primordial 2.0") {
        let dadoSorteado = Math.floor(Math.random() * 6) + 1; // Rola de 1 a 6
        
        // Manda o sinal de rádio para o oponente rodar a animação na tela dele também!
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'animacao_dado', valor: dadoSorteado, nomeCarta: nomeAtaque });
        }
        
        // Abre o Dado em 3D na sua tela, e quando ele parar, continua o ataque!
        if (typeof window.rolarDadoAnimado === 'function') {
            window.rolarDadoAnimado(dadoSorteado, () => {
                processarAtaqueFinal(dadoSorteado);
            });
        } else {
            // Fallback caso a animação do dado não tenha sido colada no final do arquivo ainda
            processarAtaqueFinal(dadoSorteado);
        }
    } else {
        // Se não for o Fogo Primordial, ataca direto sem pausar e sem dado
        processarAtaqueFinal(null);
    }
};

window.abrirModalAlianca = function(indexMao, idAtaque, custo, nomeAtaque) {
    document.getElementById('overlay-ataque').remove();
    
    // Procura monstros mortos no seu cemitério
    let monstrosMortosHTML = "";
    let temMonstro = false;

    (window.cemiterio || []).forEach(nomeMorto => {
        let db = typeof MONSTROS !== 'undefined' ? MONSTROS.find(m => m.nome === nomeMorto) : null;
        if (db) {
            temMonstro = true;
            let curaCalculada = Math.floor((db.statsMax.energia / 2) / 5) * 5; // Metade arredondada pra baixo em múltiplos de 5
            
            monstrosMortosHTML += `
                <div onclick="window.confirmarAlianca(${indexMao}, '${idAtaque}', ${custo}, '${nomeAtaque}', ${curaCalculada}, '${db.nome}')" style="width: 80px; height: 115px; background-image: url('${db.cartaBlank}'); background-size: cover; background-position: center; border: 2px solid #4CAF50; border-radius: 5px; cursor: pointer; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px;">
                    <span style="background: rgba(0,0,0,0.8); color: #00ff00; font-weight: bold; padding: 2px 5px; border-radius: 3px; font-size: 11px;">+${curaCalculada} HP</span>
                </div>
            `;
        }
    });

    if (!temMonstro) {
        window.mostrarMensagemScanner("❌ Você não possui Monstros no Lixo para fazer a Aliança!");
        return;
    }

    const modalHTML = `
        <div class="modal-overlay" id="overlay-alianca" style="z-index: 10000000; background: rgba(0,0,0,0.95); flex-direction: column; align-items: center; justify-content: center; display: flex;">
            <h2 style="color: #4CAF50; text-shadow: 0 0 10px #4CAF50; margin-bottom: 20px;">🤝 ALIANÇA</h2>
            <p style="color: #fff; margin-bottom: 15px;">Escolha a essência de um campeão derrotado:</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; max-width: 400px; padding: 15px; background: rgba(0,255,0,0.05); border-radius: 10px; border: 1px dashed #4CAF50;">
                ${monstrosMortosHTML}
            </div>
            <button class="btn-acao-modal" style="width: 150px; background: #222; color: #fff; margin-top: 25px;" onclick="document.getElementById('overlay-alianca').remove()">CANCELAR</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.confirmarAlianca = function(indexMao, idAtaque, custo, nomeAtaque, curaFinal, nomeMorto) {
    document.getElementById('overlay-alianca').remove();
    
    // Gasta o ataque normalmente
    window.pontosAtaque['jogador'] -= custo;
    window.maoAtaques.splice(indexMao, 1);
    window.lixoAtaques.push(idAtaque); 
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        window.enviarAcaoRede({ tipo: 'descarte_lixo', idCarta: nomeAtaque, categoria: 'ataque' });
    }
    atualizarDecksEMaoCards();
    if (typeof window.atualizarSeusContadoresDeAtaque === 'function') window.atualizarSeusContadoresDeAtaque();

    // 🌟 Manda para a corrente (Burst)
    let acaoAlianca = {
        dono: 'jogador',
        nomeAcao: nomeAtaque,
        tipo: 'ataque',
        executar: function() {
            let idMeuAtivo = window.estadoCombate.atacante;
            if (obterCriaturaNoSlot(idMeuAtivo).dono !== 'jogador') idMeuAtivo = window.estadoCombate.defensor;
            
            let meuMonstro = obterCriaturaNoSlot(idMeuAtivo);
            if (meuMonstro) {
                let vidaMax = Number(meuMonstro.hpMax || meuMonstro.statsMax.energia);
                meuMonstro.hpAtual = Number(meuMonstro.hpAtual) + curaFinal;
                if (meuMonstro.hpAtual > vidaMax) meuMonstro.hpAtual = vidaMax;

                window.mostrarMensagemScanner(`🤝 Aliança com ${nomeMorto}! ${meuMonstro.nome} recuperou ${curaFinal} de HP!`);
                if(window.tocarSFX) window.tocarSFX('notificacao'); 
                
                if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                    window.enviarAcaoRede({ tipo: 'sincronizar_hp', alvo: idMeuAtivo, novoHp: meuMonstro.hpAtual });
                }
                atualizarTelaBatalha();
            }
        }
    };
    window.adicionarAoBurst(acaoAlianca);
};
/////////////////////////////////////////////////////////////////////////////////





let btnSairDrome = document.getElementById("btn-sair-drome");

if (btnSairDrome) {

    btnSairDrome.onclick = () => {

        let vivasJogador = Object.values(campoJogador).filter(c => c !== null).length;

        let vivasOp = window.campoOponente ? Object.values(window.campoOponente).filter(c => c !== null).length : 0;

        

        // Se a partida estiver rolando, abre o Modal Personalizado de Fuga

        if (vivasJogador > 0 && vivasOp > 0) {

            if (document.getElementById('overlay-fuga')) return;



            const modalHTML = `

                <div class="modal-overlay" id="overlay-fuga" style="z-index: 9999999; background: rgba(0,0,0,0.95); display: flex; flex-direction: column; align-items: center; justify-content: center;">

                    <div class="modal-content-fichas" style="text-align: center; border: 3px solid #e53935; box-shadow: 0 0 30px rgba(229, 57, 53, 0.5); background: #111; padding: 30px; border-radius: 10px; max-width: 400px;">

                        <h2 style="color: #e53935; font-family: 'Arial Black', sans-serif; text-shadow: 0 0 10px #e53935; margin-bottom: 20px; font-size: 24px;">ATENÇÃO!</h2>

                        <p style="color: #fff; font-size: 14px; font-family: monospace; margin-bottom: 30px; line-height: 1.5;">

                            A Batalha está rolando! Se você sair agora, contará como <b style="color: #e53935; font-size: 16px;">DESISTÊNCIA (Derrota)</b>.<br><br>Deseja fugir do Drome?

                        </p>

                        <div style="display: flex; gap: 15px; justify-content: center;">

                            <button class="btn-acao-modal" style="background: #220000; color: #e53935; border: 1px solid #e53935; width: 130px;" onclick="
                                document.getElementById('overlay-fuga').remove();
                                // 🔥 AVISA A NUVEM QUE VOCÊ CORREU DA BATALHA!
                                if (window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
                                    window.enviarAcaoRede({ tipo: 'desistencia' });
                                }
                                window.declararVitoria('oponente', 'Você fugiu covardemente do Drome (Desistência).');
                            ">FUGIR</button>

                            <button class="btn-acao-modal" style="background: #112211; color: #4CAF50; border: 1px solid #4CAF50; width: 160px;" onclick="document.getElementById('overlay-fuga').remove()">VOLTAR À LUTA</button>

                        </div>

                    </div>

                </div>

            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);

            if(window.tocarSFX) window.tocarSFX('notificacao');

            return;

        }



        // Se o jogo não tinha começado ou já tinha acabado, apenas sai direto

        window.sairDaBatalhaAposFim();

    };

}



window.perguntarResposta = function(jogadorAlvo, acaoAnterior) {
    if (jogadorAlvo === 'oponente') {
        window.mostrarMensagemScanner("Oponente pensando...");
        setTimeout(() => {
            window.mostrarMensagemScanner("Oponente não tem respostas! O ataque vai acertar!");
            window.aguardandoResposta = false;
            window.resolverBurst(); 
        }, 2000);
        return; 
    }

    window.aguardandoResposta = true;
    let cor = jogadorAlvo === 'jogador' ? '#4CAF50' : '#e53935';
    let nomeJogador = jogadorAlvo === 'jogador' ? 'VOCÊ' : 'OPONENTE';

   // 🔍 DETETIVE DE CARTAS: Extrai o nome da carta da mensagem da rede!
    let nomeBusca = acaoAnterior.nomeAcao;
    if (nomeBusca.includes('Mugic:')) {
        nomeBusca = nomeBusca.split('Mugic: ')[1].split(' ➔')[0].trim();
    } else if (nomeBusca.includes('Habilidade de')) {
        nomeBusca = nomeBusca.split('Habilidade de ')[1].split(' ➔')[0].trim();
    } else if (nomeBusca.includes('Revelar Equipamento')) {
        nomeBusca = nomeBusca.replace('Revelar Equipamento (', '').replace(')', '').trim();
    } else if (nomeBusca.includes(' [🎲')) {
        // 🔥 NOVO: Corta a tag do dado fora para achar a foto do ataque certinho!
        nomeBusca = nomeBusca.split(' [🎲')[0].trim(); 
    }

    // 📚 Procura a carta em todos os bancos de dados para mostrar a foto!
    let cartaDB = null;
    if(typeof ATAQUES !== 'undefined') cartaDB = ATAQUES.find(c => c.nome === nomeBusca);
    if(!cartaDB && typeof MAGIAS !== 'undefined') cartaDB = MAGIAS.find(c => c.nome === nomeBusca);
    if(!cartaDB && typeof MONSTROS !== 'undefined') cartaDB = MONSTROS.find(c => c.nome === nomeBusca);
    if(!cartaDB && typeof EQUIPAMENTOS !== 'undefined') cartaDB = EQUIPAMENTOS.find(c => c.nome === nomeBusca);

    let htmlVisualCarta = "";
    if (cartaDB) {
        let imgCard = cartaDB.img || cartaDB.cartaBlank;
        let txtEfeito = cartaDB.efeito || cartaDB.textoCarta || "Sem efeito descrito.";
        htmlVisualCarta = `
            <div style="display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.5); padding: 15px 10px; border-radius: 8px; margin: 15px 0; border: 1px solid #444; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);">
                <div onclick="if(typeof window.ampliarCartaClicada === 'function') window.ampliarCartaClicada('${imgCard}')" style="width: 70px; height: 100px; background-image: url('${imgCard}'); background-size: cover; background-position: center; border: 2px solid #ffd700; border-radius: 5px; cursor: pointer; box-shadow: 0 0 15px rgba(255,215,0,0.4); margin-bottom: 10px; transition: 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"></div>
                <p style="font-size: 11px; color: #ccc; max-width: 250px; line-height: 1.4; font-style: italic; text-shadow: 0 0 3px #000;">"${txtEfeito}"</p>
                <p style="font-size: 9px; color: #888; margin-top: 8px; text-transform: uppercase;">(Toque na carta para ver detalhes)</p>
            </div>
        `;
    }

    // ==================================================
    // ⚡ GATILHO SPEDMAN: O botão surge se ele puder salvar alguém!
    // ==================================================
    let btnSpedmanHTML = "";
    // 🔥 O segredo: Avaliamos se é um Ataque checando o Banco de Dados, independente do sinal da rede!
    let ehUmAtaque = (cartaDB && cartaDB.tipoCarta === 'Ataque'); 

    if (jogadorAlvo === 'jogador' && window.estadoCombate && window.estadoCombate.ativo && ehUmAtaque) {
        // Acha o Spedman nas gavetas
        let slotSpedman = Object.keys(campoJogador).find(k => campoJogador[k] && campoJogador[k].nome === "Spedman" && campoJogador[k].hpAtual > 0 && campoJogador[k].fichasHabilidade > 0);
        let idDefensorAtual = window.estadoCombate.defensor; 
        
        // Só aparece o botão se nosso aliado (jog-) está apanhando!
        if (slotSpedman && idDefensorAtual && idDefensorAtual.startsWith('jog-')) {
            let slotDefendendo = idDefensorAtual.replace('jog-', '');
            btnSpedmanHTML = `<button class="btn-acao-modal" style="width: 170px; border-color:#ff9800; color:#ff9800; background: #221100; font-size: 12px; margin-top: 10px;" onclick="window.interceptarComSpedman('${slotSpedman}', '${slotDefendendo}')">⚡ TROCA TÁTICA (SPEDMAN)</button>`;
        }
    }

    const modalHTML = `
        <div class="modal-overlay" id="overlay-burst" style="z-index: 1000000; background: rgba(0,0,0,0.9);">
            <div class="modal-content-fichas" style="text-align:center; border: 3px solid ${cor}; box-shadow: 0 0 30px ${cor};">
                <h3 style="color:${cor}; margin-bottom:15px; font-size: 24px; text-shadow: 0 0 10px ${cor};">AÇÃO DO ADVERSÁRIO!</h3>
                <p style="color:#fff; font-size: 14px; margin-bottom: 5px;">
                    O adversário ativou: <b style="color:#ffd700; font-size: 16px;">${acaoAnterior.nomeAcao}</b>
                </p>
                ${htmlVisualCarta}
                <p style="color:#fff; font-size: 16px; margin-bottom: 20px;">
                    ${nomeJogador}, deseja responder a essa ação?
                </p>
                <div style="display:flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn-acao-modal" style="width: 90px; border-color:#00bcd4; color:#00bcd4; background: #002222; font-size: 14px;" onclick="window.iniciarRespostaBurst('${jogadorAlvo}')">SIM</button>
                    <button class="btn-acao-modal" style="width: 90px; border-color:#e53935; color:#e53935; background: #220000; font-size: 14px;" onclick="window.negarRespostaBurst()">NÃO</button>
                    ${btnSpedmanHTML}
                </div>
                <p style="font-size: 10px; color: #888; margin-top: 15px;">Se clicar em SIM e não fizer nada, basta cancelar na sua carta.</p>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};


// ==========================================
// 🔥 NOVO MOTOR: VISUALIZAR CEMITÉRIO (LIXO) 🔥
// ==========================================

window.abrirModalVerLixo = function(dono) {
    if (document.getElementById('overlay-ver-lixo')) return;

    let cartasHTML = "";
    let titulo = dono === 'jogador' ? "SEU CEMITÉRIO (LIXO)" : "CEMITÉRIO DO OPONENTE";
    let cor = dono === 'jogador' ? "#4CAF50" : "#e53935";

    // 🕵️‍♂️ FUNÇÃO DETETIVE: Nível Mestre! Procura por ID ou Nome em TODOS os lugares!
    const acharImagemCarta = (idOuNome) => {
        let c = null;
        let busca = String(idOuNome); // Padroniza tudo para texto para não ter erro de tipo
        
        // 1. Procura no seu inventário
        if (window.inventario) c = window.inventario.find(x => String(x.id) === busca || x.nome === idOuNome);
        
        // 2. Vasculha os Bancos Globais (Agora cruza NOME e ID para os dois lixos funcionarem!)
        if (!c && typeof MONSTROS !== 'undefined') c = MONSTROS.find(x => String(x.id) === busca || x.nome === idOuNome);
        if (!c && typeof ATAQUES !== 'undefined') c = ATAQUES.find(x => String(x.id) === busca || x.nome === idOuNome);
        if (!c && typeof MAGIAS !== 'undefined') c = MAGIAS.find(x => String(x.id) === busca || x.nome === idOuNome);
        if (!c && typeof EQUIPAMENTOS !== 'undefined') c = EQUIPAMENTOS.find(x => String(x.id) === busca || x.nome === idOuNome);
        
        // 3. Retorna a imagem ou o verso protetor
        return c ? (c.img || c.cartaBlank || URL_FUNDO_CARTA) : URL_FUNDO_CARTA;
    };
    let lixoArray = [];
    if (dono === 'jogador') {
        // 🔥 JUNTA SEUS ATAQUES + MONSTROS + EQUIPAMENTOS + MAGIAS
        lixoArray = [...(window.lixoAtaques || []), ...(window.cemiterio || [])];
    } else {
        // 🔥 AGORA PUXA AS CARTAS REAIS DO OPONENTE (Ataques enviados pela rede + Monstros/Equips destruídos)
        let ataquesOp = Array.isArray(window.lixoAtaquesOponente) ? window.lixoAtaquesOponente : [];
        lixoArray = [...ataquesOp, ...(window.cemiterioOponente || [])];
    }

    if (lixoArray.length === 0 && (dono === 'jogador' || Array.isArray(window.lixoAtaquesOponente))) {
        cartasHTML = `<p style="color:#aaa; font-size:12px; margin-top: 20px;">O lixo está vazio.</p>`;
    } else {
        // Mapeia as cartas usando o Detetive
        lixoArray.forEach(idOuNome => {
            let imgEncontrada = acharImagemCarta(idOuNome);
            cartasHTML += `
                <div onclick="if(typeof window.ampliarCartaClicada === 'function') window.ampliarCartaClicada('${imgEncontrada}')" style="width: 80px; height: 115px; background-image: url('${imgEncontrada}'); background-size: cover; background-position: center; border: 2px solid ${cor}; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.8); cursor: pointer; transition: 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"></div>
            `;
        });

        // 🤖 MODO BOT OFFLINE: Simula cartas de ataque se estiver jogando contra a máquina
        if (dono === 'oponente' && !Array.isArray(window.lixoAtaquesOponente) && window.lixoAtaquesOponente > 0) {
            let todosAtaques = typeof ATAQUES !== 'undefined' ? ATAQUES : window.inventario.filter(c => c.tipoCarta === 'Ataque');
            for (let i = 0; i < window.lixoAtaquesOponente; i++) {
                let cartaSimulada = todosAtaques[Math.floor(Math.random() * todosAtaques.length)];
                let imgBot = cartaSimulada ? cartaSimulada.img : URL_FUNDO_CARTA;
                cartasHTML += `
                    <div onclick="if(typeof window.ampliarCartaClicada === 'function') window.ampliarCartaClicada('${imgBot}')" style="width: 80px; height: 115px; background-image: url('${imgBot}'); background-size: cover; background-position: center; border: 2px solid ${cor}; border-radius: 5px; box-shadow: 0 0 10px rgba(229,57,53,0.8); cursor: pointer; transition: 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"></div>
                `;
            }
        }
    }

    const modalHTML = `
        <div class="modal-overlay" id="overlay-ver-lixo" style="z-index: 1000000; background: rgba(0,0,0,0.95); flex-direction: column; align-items: center; justify-content: center; display: flex;">
            <h2 style="color: ${cor}; text-shadow: 0 0 10px ${cor}; margin-bottom: 20px; font-family: 'Arial Black', sans-serif;">${titulo}</h2>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; width: 90%; max-width: 400px; max-height: 50vh; overflow-y: auto; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px; border: 1px solid #333;">
                ${cartasHTML}
            </div>
            <button class="btn-acao-modal" style="width: 150px; background: #222; color: #fff; border: 2px solid #fff; margin-top: 25px;" onclick="document.getElementById('overlay-ver-lixo').remove()">FECHAR</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};








// ==========================================

// 🔥 MOTOR DE EXPLOSÃO DE CÓDIGOS (ANIME) 🔥

// ==========================================

window.animarExplosaoCodigo = function(idElemento, callback) {

    let el = document.getElementById(idElemento);

    if (!el) { callback(); return; }



    let rect = el.getBoundingClientRect();

    

    // Efeito de Tela "Bugando" e Ficando Verde (Matrix)

    el.style.transition = "all 0.5s";

    el.style.filter = "sepia(1) hue-rotate(90deg) saturate(500%) brightness(1.5)";

    el.style.transform = "scale(1.1)";

    el.style.opacity = "0";



    // Cria as partículas de Binários (Zeros e Uns) voando

    for(let i = 0; i < 40; i++) {

        let part = document.createElement('div');

        part.innerText = Math.random() > 0.5 ? "1" : "0";

        part.style.position = "fixed";

        part.style.left = (rect.left + rect.width / 2) + "px";

        part.style.top = (rect.top + rect.height / 2) + "px";

        part.style.color = "#00ff00"; // Verde neon

        part.style.fontFamily = "monospace";

        part.style.fontWeight = "bold";

        part.style.fontSize = (Math.random() * 15 + 10) + "px";

        part.style.pointerEvents = "none";

        part.style.zIndex = "9999999";

        part.style.textShadow = "0 0 8px #00ff00";

        

        // Direção aleatória da explosão

        let moveX = (Math.random() - 0.5) * 250;

        let moveY = (Math.random() - 0.5) * 250;

        

        part.style.transition = "all 1s cubic-bezier(0.1, 0.8, 0.3, 1)";

        document.body.appendChild(part);

        

        // Dispara o movimento 10ms depois para a transição funcionar

        setTimeout(() => {

            part.style.transform = `translate(${moveX}px, ${moveY}px) rotate(${Math.random()*360}deg) scale(0)`;

            part.style.opacity = "0";

        }, 10);

        

        // Limpa o lixo HTML

        setTimeout(() => part.remove(), 1000);

    }



    // Espera a animação acabar para apagar a criatura de verdade (callback)

    setTimeout(() => {

        el.style.filter = "";

        el.style.transform = "";

        el.style.opacity = "1";

        callback();

    }, 1000);

};



// ==========================================

// 🏆 SISTEMA DE VITÓRIA E DERROTA 🏆

// ==========================================

window.checarFimDeJogo = function() {
    // 🔥 JUNTA A MESA INTEIRA PRIMEIRO (Para não confundir de quem é a cadeira)
    let todasNaMesa = [...Object.values(campoJogador), ...(window.campoOponente ? Object.values(window.campoOponente) : [])];
    
    // 🔥 FILTRO DE DONO: Conta os vivos pela tag "dono", não importa onde estejam pisando!
    let vivasJogador = todasNaMesa.filter(c => c && c.hpAtual > 0 && c.dono === 'jogador').length;
    let vivasOponente = todasNaMesa.filter(c => c && c.hpAtual > 0 && c.dono === 'oponente').length;

    if (vivasJogador === 0 && vivasOponente > 0) {
        window.declararVitoria('oponente', 'Todo o seu exército foi aniquilado.');
        // 🔥 AVISO DE REDUNDÂNCIA: Garante que o inimigo saiba que você perdeu (Entrega a taça pela rede)!
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
            window.enviarAcaoRede({ tipo: 'declarar_vitoria_oponente' });
        }
    } else if (vivasOponente === 0 && vivasJogador > 0) {
        window.declararVitoria('jogador', 'Você destruiu todas as criaturas inimigas e dominou o Drome!');
    } else if (vivasJogador === 0 && vivasOponente === 0) {
        window.declararVitoria('empate', 'Ambos os exércitos foram destruídos simultaneamente!');
    }
};


window.declararVitoria = function(vencedor, motivo) {
    // 🔥 PROTEÇÃO CONTRA TELA DUPLA: Se já tem uma tela de fim de jogo aberta, ignora o resto!
    if (document.getElementById('overlay-vitoria')) return;

    // 🔥 PARADA DE EMERGÊNCIA: A partida acabou! Desliga o Anti-AFK IMEDIATAMENTE para evitar W.O. Fantasma!
    if (typeof window.desligarSistemaAntiAFK === 'function') window.desligarSistemaAntiAFK();

    let cor = vencedor === 'jogador' ? '#4CAF50' : '#e53935';
    let titulo = vencedor === 'jogador' ? 'VITÓRIA!' : 'DERROTA!';
    let subtitulo = vencedor === 'jogador' ? 'O DROME É SEU.' : 'VOCÊ FOI DESTRUÍDO.';
    
    // Toca som de fim de partida (se tiver)
    if(window.tocarSFX) window.tocarSFX('notificacao');



    const modalHTML = `

        <div class="modal-overlay" id="overlay-vitoria" style="z-index: 99999999; background: rgba(0,0,0,0.95); flex-direction: column; display:flex; justify-content:center; align-items:center;">

            <h1 style="color: ${cor}; font-size: 60px; font-family: 'Arial Black', sans-serif; text-shadow: 0 0 20px ${cor}, 0 0 40px ${cor}; margin-bottom: 10px; text-transform: uppercase;">${titulo}</h1>

            <h3 style="color: #fff; font-size: 20px; font-family: monospace; margin-bottom: 30px;">${subtitulo}</h3>

            <p style="color: #ffd700; font-size: 14px; margin-bottom: 40px; text-align: center; max-width: 80%;">Motivo: ${motivo}</p>

            <button class="btn-acao-modal" style="width: 200px; background: #222; border-color: ${cor}; color: ${cor}; font-size: 18px;" onclick="window.sairDaBatalhaAposFim()">SAIR DA ARENA</button>

        </div>

    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

};



window.sairDaBatalhaAposFim = function() {
    let modal = document.getElementById('overlay-vitoria');
    if(modal) modal.remove();
    
    // Volta pro Menu Principal
    document.getElementById("tela-batalha").style.display = "none";
    document.getElementById("tela-menu").style.display = "flex";
    window.modoMenu = true;
    
    // 🔥 DESLIGA O RADAR, MATA O RELÓGIO E EXORCIZA OS FANTASMAS DA NUVEM!
    if (typeof window.desligarSistemaAntiAFK === 'function') window.desligarSistemaAntiAFK();
    
    // 🛑 MATA O RELÓGIO FANTASMA DO TURNO
    if (window.cronometroTurnoInterval) {
        clearInterval(window.cronometroTurnoInterval);
        window.cronometroTurnoInterval = null;
    }
    
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
        if (typeof window._dbOff === 'function') {
            window._dbOff('salas_drome/' + window.salaBatalhaAtual + '/ultima_acao');
            window._dbOff('salas_drome/' + window.salaBatalhaAtual + '/turno_ativo');
            window._dbOff('salas_drome/' + window.salaBatalhaAtual + '/pings');
            window._dbOff('salas_drome/' + window.salaBatalhaAtual + '/sync_tempo');
        }
        window.salaBatalhaAtual = null; 
    }
    localStorage.removeItem('drome_ticket_batalha'); // A batalha acabou, lixo no ticket!
    localStorage.removeItem('drome_save_state'); // 🔥 JOGA A FOTO DO TABULEIRO FORA!
    
    // FAXINA GERAL: Limpa a memória para uma próxima batalha limpa
    window.estadoCombate = { ativo: false, atacante: null, defensor: null };
    window.estadoTurno = { jogadorAtual: null, turnoNumero: 0, fase: 'pre-jogo' };
    window.pontosAtaque = { jogador: 3, oponente: 3 };
    window.baralhoAtaques = [];
    window.maoAtaques = [];
    window.lixoAtaques = [];
    window.campoJogador = { c1: null, c2: null, c3: null, c4: null, c5: null, c6: null };
    window.campoOponente = { c1: null, c2: null, c3: null, c4: null, c5: null, c6: null };
    
    // Zera os strikes para não vazar pra próxima luta!
    window.strikesJogador = 0;
    window.strikesOponente = 0;
};






// ==========================================

// 🔥 MOTOR DE AÇÕES DA CRIATURA (HABILIDADE, MUGIC E EQUIPAMENTO) 🔥

// ==========================================



// 1. REVELAR EQUIPAMENTO (AGORA NO BURST)
window.revelarEquipamento = function(fullId) {
    let criatura = obterCriaturaNoSlot(fullId);
    if (criatura && criatura.equipamento && !criatura.equipamentoRevelado) {
        window.fecharModalAcoes();
        
        let acaoRevelar = {
            dono: criatura.dono,
            nomeAcao: `Revelar Equipamento (${criatura.equipamento.nome})`,
            tipo: 'equipamento',
            executar: function() {
                criatura.equipamentoRevelado = true;
                window.mostrarMensagemScanner(`✨ EQUIPAMENTO REVELADO: ${criatura.nome} revelou ${criatura.equipamento.nome}!`);
                if(window.tocarSFX) window.tocarSFX('notificacao');
                
                let eqNome = criatura.equipamento.nome.toLowerCase();

                // EFEITO 1: ANEL PRECIOSO
                if (eqNome === "anel precioso") {
                    criatura.hpAtual = Number(criatura.hpAtual) - 15;
                    setTimeout(() => window.mostrarMensagemScanner(`💍 O peso do Anel Precioso drenou 15 de energia de ${criatura.nome}!`), 1500); 
                    if (criatura.dono === 'jogador' && window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
                        window.enviarAcaoRede({ tipo: 'sincronizar_hp', alvo: fullId, novoHp: criatura.hpAtual });
                    }
                    if (criatura.hpAtual <= 0) {
                        criatura.hpAtual = 0;
                        setTimeout(() => {
                            window.mostrarMensagemScanner(`💀 A energia de ${criatura.nome} foi esgotada pelo equipamento!`);
                            window.encerrarCombateMorte(fullId);
                        }, 3000);
                    }
                }

                // 🔥 EFEITO 2: BASTÃO DA SABEDORIA (Agora com Sincronização de Rede!)
                if (eqNome === "bastão da sabedoria" || eqNome === "bastao da sabedoria") {
                    if(criatura.statsMax) criatura.statsMax.sabedoria = Number(criatura.statsMax.sabedoria) + 40;
                    window.mostrarMensagemScanner(`📖 Sabedoria Ancestral! A Sabedoria de ${criatura.nome} aumentou em +40!`);
                    
                    if (criatura.dono === 'jogador' && window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
                        window.enviarAcaoRede({ tipo: 'sincronizar_stats', alvo: fullId, statsMax: criatura.statsMax });
                    }
                }

                // 🔥 EFEITO: BOMBA DE FOGO
                if (eqNome === "bomba de fogo") {
                    criatura.hpMax = Number(criatura.hpMax || criatura.statsMax.energia) + 5;
                    criatura.hpAtual = Number(criatura.hpAtual) + 5;
                    window.mostrarMensagemScanner(`💣 Bomba de Fogo armada! ${criatura.nome} ganhou +5 de Energia.`);
                    
                    if (criatura.dono === 'jogador' && window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
                        window.enviarAcaoRede({ tipo: 'sincronizar_hp', alvo: fullId, novoHp: criatura.hpAtual, novoMax: criatura.hpMax });
                    }
                }

                
                if (criatura.dono === 'jogador' && window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
                    window.enviarAcaoRede({ tipo: 'revelar_equipamento_direto', alvo: fullId });
                }
                atualizarTelaBatalha(); 
            }
        };
        window.adicionarAoBurst(acaoRevelar);
    }
};

// ==========================================
// ⚙️ MOTOR CENTRAL: REMOVER EQUIPAMENTO (UNIVERSAL v2.0)
// ==========================================
window.removerEquipamentoMesa = function(fullId, enviarCemiterio = true) {
    let criatura = obterCriaturaNoSlot(fullId);
    if (!criatura || !criatura.equipamento) return null;

    let eqNomeOriginal = criatura.equipamento.nome;
    let eqNome = eqNomeOriginal.toLowerCase();
    let estavaRevelado = criatura.equipamentoRevelado;

    // 1. REVERTE EFEITOS PASSIVOS (Se a carta estava ativada/revelada)
    if (estavaRevelado) {
        if (eqNome === "bastão da sabedoria" || eqNome === "bastao da sabedoria") {
            if (criatura.statsMax) criatura.statsMax.sabedoria = Number(criatura.statsMax.sabedoria) - 40;
            if (criatura.dono === 'jogador' && window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
                window.enviarAcaoRede({ tipo: 'sincronizar_stats', alvo: fullId, statsMax: criatura.statsMax });
            }
        }
        
        // 🔥 A CORREÇÃO DE OURO: A BOMBA NÃO ROUBA SANGUE AO QUEBRAR!
        if (eqNome === "bomba de fogo") {
            criatura.hpMax = Number(criatura.hpMax || criatura.statsMax.energia) - 5;
            
            // Só abaixa o HP atual se ele estiver vazando para fora do novo limite máximo!
            if (Number(criatura.hpAtual) > criatura.hpMax) {
                criatura.hpAtual = criatura.hpMax;
            }
            // (Removemos o sincronizador de rede daqui para o Ácido Gástrico poder causar o dano em paz sem colisão!)
        }
    }

    // 2. MANDA PRO LIXO
    if (enviarCemiterio) {
        let alvoCemiterio = criatura.dono === 'jogador' ? window.cemiterio : window.cemiterioOponente;
        if (!alvoCemiterio) alvoCemiterio = [];
        alvoCemiterio.push(eqNomeOriginal);
        if (criatura.dono === 'jogador') window.cemiterio = alvoCemiterio;
        else window.cemiterioOponente = alvoCemiterio;
    }

    // 3. APAGA A CARTA DA MESA
    criatura.equipamento = null;
    criatura.equipamentoRevelado = false;

    return eqNomeOriginal;
};

// 🔥 DESCARTAR EQUIPAMENTO (AÇÃO MANUAL NO BURST)
window.descartarEquipamentoMesa = function(fullId) {
    window.fecharModalAcoes();
    let criatura = obterCriaturaNoSlot(fullId);
    if (!criatura || !criatura.equipamento) return;

    let acaoDescarte = {
        dono: criatura.dono,
        nomeAcao: `Descartar Equipamento (${criatura.equipamento.nome})`,
        tipo: 'equipamento',
        executar: function() {
            let eqNomeParaEfeito = criatura.equipamento.nome.toLowerCase();
            
            // Usa o Motor Central que criamos para limpar os status e jogar no lixo com segurança!
            let eqNomeOriginal = window.removerEquipamentoMesa(fullId, true);

            window.mostrarMensagemScanner(`🗑️ ${criatura.nome} descartou o equipamento ${eqNomeOriginal}.`);
            if(window.tocarSFX) window.tocarSFX('notificacao');

            // 🔥 O GATILHO DA ARPA MÁGICA CONTINUA FUNCIONANDO AQUI!
            if (eqNomeParaEfeito === "arpa mágica" || eqNomeParaEfeito === "arpa magica") {
                criatura.fichasHabilidade = Number(criatura.fichasHabilidade) + 1;
                setTimeout(() => window.mostrarMensagemScanner(`🎵 A Arpa Mágica tocou ao ser descartada! ${criatura.nome} ganhou +1 Ficha!`), 1500);
                if (criatura.dono === 'jogador' && window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
                    window.enviarAcaoRede({ tipo: 'sincronizar_fichas', alvo: fullId, qtd: criatura.fichasHabilidade });
                }
            }

            // Avisa a rede do descarte
            if (criatura.dono === 'jogador' && window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
                window.enviarAcaoRede({ tipo: 'descarte_equipamento_mesa', alvo: fullId, nomeEquip: eqNomeOriginal });
            }

            atualizarTelaBatalha();
        }
    };
    window.adicionarAoBurst(acaoDescarte);
};

window.iniciarMiraCuraVeneno = function(fullId) {
    window.fecharModalAcoes();
    window.modoAlvo = { tipo: 'cura_veneno', origem: fullId };
    window.atualizarInterfaceMira("Clique na criatura que deseja curar do veneno.");
};
   
////////////
    
// 2. USAR HABILIDADE (AGORA INTELIGENTE: COM OU SEM MIRA)
window.usarHabilidade = function(fullId) {
    let criatura = obterCriaturaNoSlot(fullId);
    
    let monstroDB = typeof MONSTROS !== 'undefined' ? MONSTROS.find(m => m.nome === criatura.nome) : null;
    let custoHab = (monstroDB && monstroDB.custoHabilidade !== undefined) ? monstroDB.custoHabilidade : 1;

    if (criatura && criatura.fichasHabilidade >= custoHab) {
        if (window.turnosPresoVinha && window.turnosPresoVinha['jogador'] > 0) {
            window.mostrarMensagemScanner("🌿 Você está preso na Armadilha de Vinha! Habilidades bloqueadas.");
            if(window.tocarSFX) window.tocarSFX('erro');
            return;
        }
        window.fecharModalAcoes();

        // 🕵️‍♂️ DETETIVE: Busca a carta no banco para saber se ela precisa de alvo
        let efeitoIdEncontrado = monstroDB ? monstroDB.efeitoId : null;
        let precisaAlvo = monstroDB && monstroDB.precisaAlvo !== undefined ? monstroDB.precisaAlvo : true; 

        if (precisaAlvo === false) {
            // ==========================================
            // 🔥 ATIVAÇÃO INSTANTÂNEA (SEM MIRA) 🔥
            // ==========================================
            criatura.fichasHabilidade -= custoHab; // DEDUZ O CUSTO CORRETO!
            
            // Avisa o oponente que a ficha foi gasta
            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                window.enviarAcaoRede({ tipo: 'sincronizar_fichas', alvo: fullId, qtd: criatura.fichasHabilidade });
            }
            atualizarTelaBatalha();

            let acao = {
                dono: criatura.dono,
                nomeAcao: `Habilidade de ${criatura.nome}`,
                tipo: 'habilidade',
                executar: function() {
                    if (efeitoIdEncontrado && window.MotorDeEfeitos && window.MotorDeEfeitos[efeitoIdEncontrado]) {
                        window.MotorDeEfeitos[efeitoIdEncontrado](criatura, fullId, atualizarTelaBatalha);
                    } else {
                        window.mostrarMensagemScanner(`⚡ Efeito ativado!`);
                    }
                }
            };
            window.adicionarAoBurst(acao);

        } else {
            // ==========================================
            // 🎯 ATIVAÇÃO COM MIRA (PADRÃO)
            // ==========================================
            if (efeitoIdEncontrado === "guru_elemento") {
                window.abrirModalEscolhaElemento(fullId, criatura);
                return; 
            }

           window.modoAlvo = { tipo: 'habilidade', origem: fullId, custo: custoHab };
            window.atualizarInterfaceMira(`Clique na criatura alvo para usar a habilidade de ${criatura.nome}.`);
        }

    } else {
        window.mostrarMensagemScanner(`❌ Fichas insuficientes! Essa habilidade requer ${custoHab}.`);
    }
};

// 🔥 MOTOR VISUAL: Menu de Escolha de Elemento (Totalmente isolado das outras funções!)
window.abrirModalEscolhaElemento = function(fullId, criatura) {
    window.pausarCronometro(); // Pausa o tempo enquanto o jogador pensa!
    const modalHTML = `
        <div class="modal-overlay" id="overlay-elemento" style="z-index: 10000000; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="modal-content-fichas" style="text-align: center; border: 3px solid #00bcd4; background: #111; padding: 20px; border-radius: 10px;">
                <h2 style="color: #00bcd4; margin-bottom: 15px;">QUAL ELEMENTO DESEJA DOAR?</h2>
                <div style="display: flex; gap: 15px; justify-content: center; font-size: 35px;">
                    <button onclick="window.confirmarElemento('${fullId}', 'Fogo')" style="cursor:pointer; background:#222; border:2px solid red; border-radius:10px; padding:10px 20px; transition: 0.2s;" onmouseover="this.style.background='red'" onmouseout="this.style.background='#222'">🔥</button>
                    <button onclick="window.confirmarElemento('${fullId}', 'Água')" style="cursor:pointer; background:#222; border:2px solid blue; border-radius:10px; padding:10px 20px; transition: 0.2s;" onmouseover="this.style.background='blue'" onmouseout="this.style.background='#222'">🌊</button>
                    <button onclick="window.confirmarElemento('${fullId}', 'Terra')" style="cursor:pointer; background:#222; border:2px solid brown; border-radius:10px; padding:10px 20px; transition: 0.2s;" onmouseover="this.style.background='brown'" onmouseout="this.style.background='#222'">⛰️</button>
                    <button onclick="window.confirmarElemento('${fullId}', 'Ar')" style="cursor:pointer; background:#222; border:2px solid gray; border-radius:10px; padding:10px 20px; transition: 0.2s;" onmouseover="this.style.background='gray'" onmouseout="this.style.background='#222'">☁️</button>
                </div>
                <button class="btn-acao-modal" style="margin-top: 25px; border-color: #e53935; color: #e53935;" onclick="document.getElementById('overlay-elemento').remove(); window.retomarCronometro();">Cancelar</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.confirmarElemento = function(fullId, elementoEscolhido) {
    document.getElementById('overlay-elemento').remove();
    window.retomarCronometro(); // Retoma o relógio

    // Liga a mira guardando a escolha secreta no "elementoExtra"
   window.modoAlvo = { tipo: 'habilidade', origem: fullId, elementoExtra: elementoEscolhido };
    window.atualizarInterfaceMira(`Você escolheu ${elementoEscolhido}. Clique no monstro que vai recebê-lo!`);
};


// 3. PREPARAR MUGIC (Registra quem é o Conjurador sem gastar a ficha)

window.prepararMugic = function(fullId) {

    let criatura = obterCriaturaNoSlot(fullId);

    

    if (criatura && criatura.fichasHabilidade > 0) {
    if (window.turnosPresoVinha && window.turnosPresoVinha['jogador'] > 0) {
            window.mostrarMensagemScanner("🌿 Você está preso na Armadilha de Vinha! Magias bloqueadas.");
            if(window.tocarSFX) window.tocarSFX('erro');
            return;
        }
        window.conjuradorMugicAtual = fullId; // Salva o mago escolhido!

        window.fecharModalAcoes();

        window.mostrarMensagemScanner(`🎵 PREPARANDO: ${criatura.nome} está pronto para conjurar. Clique na Magia na lateral direita!`);

        if(window.tocarSFX) window.tocarSFX('notificacao');

    } else {

        window.mostrarMensagemScanner("❌ Fichas insuficientes para conjurar um Mugic!");

    }

};


// 4. USAR MUGIC (CHECA A TRIBO E ABRE A MIRA)
window.descartarMugic = function(index) {
    let mugic = window.jogadorMugics[index];
    if (!mugic) return;

    let conjuradorId = window.conjuradorMugicAtual;
    if (!conjuradorId) {
        window.mostrarMensagemScanner("❌ Erro: Selecione primeiro uma criatura (Usar Mugic) antes de escolher a carta!");
        return;
    }

    let criatura = obterCriaturaNoSlot(conjuradorId);
    let custoReal = mugic.custoAtivacao || 1;

    if (!criatura || criatura.fichasHabilidade < custoReal) {
        window.mostrarMensagemScanner(`❌ Fichas insuficientes! A magia custa ${custoReal}.`);
        return; 
    }

    if (mugic.triboRestricao && mugic.triboRestricao.toLowerCase() !== criatura.tribo.toLowerCase()) {
        window.mostrarMensagemScanner(`❌ Tribo incompatível!`);
        return;
    }

    document.getElementById('overlay-ver-mugic').remove();

    // 🔥 SISTEMA INTELIGENTE DE MIRA (NOVA LÓGICA) 🔥
    if (mugic.efeitoId === "cancao_rejeicao") {
        // Essa magia não mira numa criatura física, ela abre o painel de anulação direto!
        window.abrirModalConfirmacaoMugic(conjuradorId, index, mugic, custoReal);
        return;
    }

    // Magias normais de alvo continuam usando a mira no tabuleiro
   window.modoAlvo = { tipo: 'mugic', origem: conjuradorId, mugicIndex: index, mugicObj: mugic, custo: custoReal };
    window.atualizarInterfaceMira(`Clique na criatura alvo para conjurar o Mugic ${mugic.nome}.`);
};

// ==========================================
// 🔥 NOVO: MOTOR DE MAGIAS SEM ALVO FÍSICO 🔥
// ==========================================
window.abrirModalConfirmacaoMugic = function(conjuradorId, index, mugic, custoReal) {
    let conjurador = obterCriaturaNoSlot(conjuradorId);
    // Lê qual foi o último golpe que o inimigo ativou
    let acaoAlvo = window.pilhaBurst.length > 0 ? window.pilhaBurst[window.pilhaBurst.length - 1].nomeAcao : "Nenhuma ação na corrente";

    const modalHTML = `
        <div class="modal-overlay" id="overlay-confirma-mugic" style="z-index: 10000000; background: rgba(0,0,0,0.95); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="modal-content-fichas" style="text-align: center; border: 3px solid #00bcd4; background: #111; padding: 25px; border-radius: 10px; max-width: 380px; box-shadow: 0 0 30px rgba(0,188,212,0.4);">
                <h2 style="color: #00bcd4; font-family: 'Arial Black', sans-serif; margin-bottom: 10px;">🛡️ CONJURAR MAGIA?</h2>
                <p style="color: #fff; font-size: 13px; margin-bottom: 15px;">Deseja que <b>${conjurador.nome}</b> pague ${custoReal} fichas para usar <b>${mugic.nome}</b>?</p>
                
                <div style="background: #222; border: 1px dashed #ff5555; padding: 10px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="color: #aaa; font-size: 10px; margin-bottom: 5px; text-transform: uppercase;">Alvo da Anulação:</p>
                    <p style="color: #ff5555; font-size: 14px; font-weight: bold; margin: 0;">${acaoAlvo}</p>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="btn-acao-modal" style="background:#220000; border-color: #ff5555; color: #ff5555;" onclick="document.getElementById('overlay-confirma-mugic').remove(); window.mostrarMensagemScanner('Magia cancelada.');">CANCELAR</button>
                    <button class="btn-acao-modal" style="background:#002222; border-color: #00bcd4; color: #00bcd4;" onclick="window.dispararMugicSemAlvo('${conjuradorId}', ${index}, ${custoReal})">CONJURAR</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.dispararMugicSemAlvo = function(conjuradorId, index, custoReal) {
    document.getElementById('overlay-confirma-mugic').remove();
    
    let mugic = window.jogadorMugics[index];
    let conjurador = obterCriaturaNoSlot(conjuradorId);
    
    // 1. Cobra o custo da criatura
    conjurador.fichasHabilidade -= custoReal;
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        window.enviarAcaoRede({ tipo: 'sincronizar_fichas', alvo: conjuradorId, qtd: conjurador.fichasHabilidade });
    }
    
    // 2. Manda a carta pro lixo visualmente
    if (!window.cemiterio) window.cemiterio = [];
    window.cemiterio.push(mugic.nome);
    window.jogadorMugics[index] = null;
    
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        window.enviarAcaoRede({ tipo: 'descarte_lixo', idCarta: mugic.nome, categoria: 'mugic' });
    }
    
    atualizarMugicsDaTela(); 
    atualizarDecksEMaoCards();

    // 3. Coloca a ação na Corrente (Burst)
    let ctx = { origem: conjuradorId, custo: custoReal, mugicObj: mugic };
    
    let acao = { 
        dono: 'jogador', 
        nomeAcao: `Mugic: ${mugic.nome}`, 
        tipo: 'mugic', 
        executar: function() { 
            let efeitoIdEncontrado = mugic.efeitoId;
            if (efeitoIdEncontrado && window.MotorDeEfeitos && window.MotorDeEfeitos[efeitoIdEncontrado]) {
                // Passa "null" pro alvo já que não clicamos em ninguém na mesa!
                window.MotorDeEfeitos[efeitoIdEncontrado](null, null, atualizarTelaBatalha, ctx);
            } else {
                window.mostrarMensagemScanner(`✨ Mugic conjurado sem alvo definido!`); 
            }
        } 
    };
    
    window.adicionarAoBurst(acao);
};



    







                 // ==========================================

// 📡 PILAR 3: CENTRAL DE RÁDIO ONLINE (O GRANDE SINCRONIZADOR)

// ==========================================



window.ultimaAcaoProcessada = 0; // Memória anti-eco



// 🎤 O TRANSMISSOR: Envia o que você fez para a Nuvem
window.enviarAcaoRede = function(acaoData) {
    if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") return;
    // 🔥 CORREÇÃO DE COLISÃO: Soma um número aleatório para garantir que nenhum milissegundo seja igual ao outro!
    acaoData.timestamp = Date.now() + Math.random(); 
    acaoData.remetente = window.souP1Batalha ? 'p1' : 'p2';
    window._dbUpdate('salas_drome/' + window.salaBatalhaAtual, { ultima_acao: acaoData });
};



// 🎧 O RECEPTOR: Fica escutando a Nuvem o tempo todo
window.iniciarEscutaAcoesOnline = function() {
    if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") return;

    // 👻 O NOVO EXORCISTA: Blindado contra salas vazias!
    let escutaIniciada = false;

    // Rádio 1: Escuta as ações pesadas (Movimento final, combate, magias)
    window._dbOn('salas_drome/' + window.salaBatalhaAtual + '/ultima_acao', (snap) => {
        // O Firebase sempre dispara o evento na primeira leitura (trazendo dados velhos ou vazio).
        // Nós ignoramos ESSE primeiro disparo do listener, para não engolir a primeira ação real!
        if (!escutaIniciada) {
            escutaIniciada = true;
            return;
        }

        if (!snap.exists()) return;

        let acao = snap.val();
        if (acao.remetente === (window.souP1Batalha ? 'p1' : 'p2')) return;
        if (window.ultimaAcaoProcessada === acao.timestamp) return;

        window.ultimaAcaoProcessada = acao.timestamp;
        window.processarAcaoInimiga(acao);
    });

    // 👻 Rádio 2: O Radar de Fantasmas (Vê a carta do oponente flutuando na tela)

    let inimigo = window.souP1Batalha ? 'p2' : 'p1';

    window._dbOn('salas_drome/' + window.salaBatalhaAtual + '/drag/' + inimigo, (snap) => {

        if (!snap.exists()) return;

        let drag = snap.val();

        let cloneFantasma = document.getElementById('clone-drag-inimigo');

        

        if (drag.ativo) {

            if (!cloneFantasma) {

                cloneFantasma = document.createElement('div');

                cloneFantasma.id = 'clone-drag-inimigo';

                // Cria a carta flutuante com brilho vermelho (inimigo)

                cloneFantasma.style.cssText = 'position:fixed; width:80px; height:115px; background-size:cover; border:2px solid #e53935; border-radius:5px; box-shadow:0 0 20px #e53935; z-index:999998; pointer-events:none; opacity:0.8; transition: transform 0.1s linear, left 0.1s linear, top 0.1s linear;';

                document.body.appendChild(cloneFantasma);

            }

            cloneFantasma.style.backgroundImage = `url('${drag.img}')`;

            

            // 🧠 A GRANDE SACADA: A tela dele é de ponta-cabeça em relação à sua!

            // Se ele move pra BAIXO na tela dele, pra você tem que ir pra CIMA.

            let xInvertido = 100 - drag.x;

            let yInvertido = 100 - drag.y;

            

            // Centraliza a miniatura no mouse invertido

            cloneFantasma.style.left = `calc(${xInvertido}vw - 40px)`;

            cloneFantasma.style.top = `calc(${yInvertido}vh - 57px)`;

            cloneFantasma.style.transform = "scale(1.1)";

        } else {

            // Ele soltou a carta, deleta o fantasma instantaneamente!

            if (cloneFantasma) cloneFantasma.remove();

        }

    });
    // ⏰ Rádio 3: O Sincronizador de Relógio (Fim dos travamentos de lag)
    window._dbOn('salas_drome/' + window.salaBatalhaAtual + '/sync_tempo', (snap) => {
        if (!snap.exists()) return;
        let tempoRede = snap.val();
        
        // Se for o turno do oponente, eu obedeço o relógio da internet dele!
        if (window.estadoTurno.jogadorAtual === 'oponente') {
            // Só corrige se a diferença for maior que 2 segundos (pra ignorar delay normal de ping)
            if (Math.abs(window.tempoRestanteTurno - tempoRede) > 2) {
                window.tempoRestanteTurno = tempoRede;
            }
        }
    });

};



// 🤖 O FANTASMA: Pega o sinal do rádio e mexe as cartas na sua mesa
window.processarAcaoInimiga = function(acao) {
    
    // 🔄 O TRADUTOR DE ESPELHO: O que é 'jog' pra ele, é 'op' pra você, e vice-versa!
    const inverterId = (id) => {
        if (!id) return id;
        return id.startsWith('jog-') ? id.replace('jog-', 'op-') : id.replace('op-', 'jog-');
    };

    if (acao.tipo === 'mover') {
        let origemReal = inverterId(acao.origem);
        let destinoReal = inverterId(acao.destino);
        let criatura = obterCriaturaNoSlot(origemReal);
        setarCriaturaNoSlot(destinoReal, criatura); 
        setarCriaturaNoSlot(origemReal, null); 
        if(criatura) criatura.moveuNesteTurno = true;
        window.mostrarMensagemScanner("O inimigo reposicionou uma criatura!");
        if(window.tocarSFX) window.tocarSFX('notificacao');
        atualizarTelaBatalha();
    }
        // 🌑 RECEPTOR: O Inimigo não usou a Mão Negra e a carta voltou para o nosso baralho!
    else if (acao.tipo === 'devolver_carta_roubada') {
        if (!window.baralhoAtaques) window.baralhoAtaques = [];
        window.baralhoAtaques.push(acao.idCarta); // Coloca no fundo do deck (vai ser embaralhado logo logo)
        atualizarDecksEMaoCards();
    }
        // 📊 RECEPTOR: O inimigo ganhou ou perdeu atributos na mesa!
    else if (acao.tipo === 'sincronizar_stats') {
        let alvoReal = inverterId(acao.alvo); 
        let criatura = obterCriaturaNoSlot(alvoReal);
        if (criatura) {
            criatura.statsMax = acao.statsMax;
            atualizarTelaBatalha(); 
        }
    }
    // 🗑️ RECEPTOR: O inimigo jogou o equipamento dele no lixo de propósito!
    else if (acao.tipo === 'descarte_equipamento_mesa') {
        let alvoReal = inverterId(acao.alvo); 
        let criatura = obterCriaturaNoSlot(alvoReal);
        if (criatura && criatura.equipamento) {
            criatura.equipamento = null;
            criatura.equipamentoRevelado = false;
            if (!window.cemiterioOponente) window.cemiterioOponente = [];
            window.cemiterioOponente.push(acao.nomeEquip);
            window.mostrarMensagemScanner(`🗑️ O Inimigo descartou o equipamento: ${acao.nomeEquip}!`);
            atualizarTelaBatalha();
        }
    }
    else if (acao.tipo === 'combate') {
        let origemReal = inverterId(acao.origem);
        let destinoReal = inverterId(acao.destino);
        let criatura = obterCriaturaNoSlot(origemReal);
        if(criatura) criatura.moveuNesteTurno = true;
        window.mostrarMensagemScanner("⚔️ ALERTA: O INIMIGO INICIOU UM COMBATE!");
        if(typeof window.iniciarCombate === 'function') window.iniciarCombate(origemReal, destinoReal);
        atualizarTelaBatalha();
    }
        else if (acao.tipo === 'sincronizar_elementos') {
        let alvoReal = inverterId(acao.alvo); 
        let criatura = obterCriaturaNoSlot(alvoReal);
        if (criatura) {
            criatura.elementos = acao.elementos; 
            atualizarTelaBatalha(); 
        }
    }
        else if (acao.tipo === 'sincronizar_fichas') {
        // 🔥 NUVEM AVISOU: Alguém ganhou ou perdeu fichas por efeito!
        let alvoReal = inverterId(acao.alvo); 
        let criatura = obterCriaturaNoSlot(alvoReal);
        if (criatura) {
            criatura.fichasHabilidade = acao.qtd; 
            atualizarTelaBatalha(); 
        }
    }
       else if (acao.tipo === 'sincronizar_hp') {
        let alvoReal = inverterId(acao.alvo); 
        let criatura = obterCriaturaNoSlot(alvoReal);
        
        // 🧟 TRAVA ZUMBI: Se ela já levou o golpe fatal na nossa tela, ignora a cura atrasada da rede!
        if (criatura && !criatura.morrendo) {
            criatura.hpAtual = acao.novoHp; 
            if (acao.novoMax) criatura.hpMax = acao.novoMax; 
            atualizarTelaBatalha(); 
        }
    }
// 🎲 RECEPTOR: O inimigo ativou uma carta de sorte, roda o dado na nossa tela!
    else if (acao.tipo === 'animacao_dado') {
        window.mostrarMensagemScanner(`Oponente está rolando os dados para ${acao.nomeCarta}...`);
        if (typeof window.rolarDadoAnimado === 'function') {
            // Roda a animação. O callback é vazio porque o Dano Oficial vai chegar pelo Burst logo depois!
            window.rolarDadoAnimado(acao.valor, () => {});
        }
    }
                             
   else if (acao.tipo === 'dano') {
        let alvoReal = inverterId(acao.alvo);
        let valorDanoFinal = acao.valor;
        
        // ⚡ O MEU SPEDMAN PULOU NA FRENTE! Anula o dano que veio da rede!
        if (window.spedmanProtecaoAtiva) {
            window.spedmanProtecaoAtiva = false;
            valorDanoFinal = 0;
            // Garante que a animação da pancada vá no Spedman que trocou de lugar
            if (window.estadoCombate.ativo) alvoReal = window.estadoCombate.defensor; 
        }
        
        let criatura = obterCriaturaNoSlot(alvoReal);
        if (criatura) {
            criatura.hpAtual -= valorDanoFinal;
            if (criatura.hpAtual <= 0) criatura.hpAtual = 0;
            
            let elAlvo = document.getElementById(alvoReal);
            if(elAlvo) {
                elAlvo.style.animation = "shake 0.5s";
                setTimeout(() => { elAlvo.style.animation = ""; }, 500);
            }
            atualizarTelaBatalha();

            if (criatura.hpAtual === 0) {
                setTimeout(() => window.encerrarCombateMorte(alvoReal), 1000);
            }
        }
    }
      // 🧪 RECEPTOR: Ácido Gástrico (Inimigo derreteu nosso item)
    else if (acao.tipo === 'destruir_equipamento') {
        let alvoReal = inverterId(acao.alvo);
        let def = obterCriaturaNoSlot(alvoReal);
        if (def && def.equipamento) {
            window.removerEquipamentoMesa(alvoReal, true); // O Motor Central limpa a Sabedoria aqui também!
            window.mostrarMensagemScanner(`🧪 O Ácido inimigo derreteu seu equipamento: ${acao.nomeEquip}!`);
            atualizarTelaBatalha();
        }
    }
    // 🗑️ RECEPTOR: O inimigo jogou o equipamento dele no lixo de propósito!
    else if (acao.tipo === 'descarte_equipamento_mesa') {
        let alvoReal = inverterId(acao.alvo); 
        let criatura = obterCriaturaNoSlot(alvoReal);
        if (criatura && criatura.equipamento) {
            window.removerEquipamentoMesa(alvoReal, true); // O Motor Central limpa a Sabedoria e põe no lixo!
            window.mostrarMensagemScanner(`🗑️ O Inimigo descartou o equipamento: ${acao.nomeEquip}!`);
            atualizarTelaBatalha();
        }
    }
        else if (acao.tipo === 'curar_veneno') {
        let alvoReal = inverterId(acao.alvo);
        let criatura = obterCriaturaNoSlot(alvoReal);
        if (criatura) {
            criatura.envenenado = false;
            window.mostrarMensagemScanner(`✨ ${criatura.nome} foi curado do veneno!`);
            atualizarTelaBatalha();
        }
    }
    // 🌑 RECEPTOR: Mão Negra (Inimigo está pedindo uma carta nossa)
    else if (acao.tipo === 'mao_negra_roubar') {
        if (window.maoAtaques && window.maoAtaques.length > 0) {
            let indexAleatorio = Math.floor(Math.random() * window.maoAtaques.length);
            let idRoubado = window.maoAtaques.splice(indexAleatorio, 1)[0]; // Arranca da nossa mão
            atualizarDecksEMaoCards();
            
            // 🔥 TRADUTOR UNIVERSAL: Acha o nome real da carta antes de mandar pela rede!
            let nomeParaEnviar = idRoubado; // Valor padrão de segurança
            if (typeof idRoubado === 'object' && idRoubado.nome) {
                nomeParaEnviar = idRoubado.nome;
            } else {
                let cartaLocal = window.inventario ? window.inventario.find(c => String(c.id) === String(idRoubado) || c.nome === idRoubado) : null;
                if (cartaLocal) nomeParaEnviar = cartaLocal.nome;
            }

            window.enviarAcaoRede({ tipo: 'mao_negra_entregar', idCarta: nomeParaEnviar });
            window.mostrarMensagemScanner("🌑 Mão Negra! O oponente roubou uma carta sua!");
        } else {
            window.mostrarMensagemScanner("O oponente tentou roubar, mas sua mão está vazia!");
        }
    }
    // 🌑 RECEPTOR: Mão Negra (Recebendo a carta que roubamos)
    else if (acao.tipo === 'mao_negra_entregar') {
        window.receberCartaRoubada(acao.idCarta);
    }
    // ⚡ RECEPTOR SPEDMAN: O Inimigo trocou as cartas dele lá, vamos espelhar aqui!
    else if (acao.tipo === 'spedman_ativado') {
        let origemSpedmanReal = inverterId(acao.slotOriginalSpedman); 
        let origemDefensorReal = inverterId(acao.slotOriginalDefensor); 
        
        let slotSpedman = origemSpedmanReal.replace('op-', '');
        let slotDefensor = origemDefensorReal.replace('op-', '');
        
        let spedmanInimigo = window.campoOponente[slotSpedman];
        let aliadoDefendendo = window.campoOponente[slotDefensor];
        
       if (spedmanInimigo && aliadoDefendendo) {
            spedmanInimigo.fichasHabilidade -= 1;
            spedmanInimigo.revelada = true; // 🔥 CORREÇÃO: Revela o Spedman inimigo na nossa tela!
            
            // Troca as cartas de lugar no alto da sua tela!
            if (slotSpedman !== slotDefensor) {
                window.campoOponente[slotSpedman] = aliadoDefendendo;
                window.campoOponente[slotDefensor] = spedmanInimigo;
            }
            
            if (window.estadoCombate && window.estadoCombate.ativo) {
                window.estadoCombate.defensor = origemDefensorReal; 
            }
            
            window.spedmanProtecaoAtivaInimiga = true; // Trava o seu ataque!
            window.mostrarMensagemScanner("⚡ TROCA INIMIGA: Spedman assumiu a defesa! O seu ataque causará 0 de dano.");
            atualizarTelaBatalha();
            
            // 🔥 CORREÇÃO DO TRAVAMENTO: Destrava o Burst do atacante!
            window.aguardandoResposta = false;
            window.resolverBurst();
        }
    }
    else if (acao.tipo === 'morte') {
        let alvoReal = inverterId(acao.alvo);
        window.encerrarCombateMorte(alvoReal);
    }
    else if (acao.tipo === 'comprar_carta_extra') {
        // 🔥 RECEPTOR: O oponente usou a carta SPEED e comprou uma carta extra!
        
        // Corrige os baralhos do inimigo se o deck dele esvaziou e ele comprou do lixo
        let qtdLixoOp = Array.isArray(window.lixoAtaquesOponente) ? window.lixoAtaquesOponente.length : window.lixoAtaquesOponente;
        if (window.qtdBaralhoOponente <= 0 && qtdLixoOp > 0) {
             window.qtdBaralhoOponente = qtdLixoOp;
             window.lixoAtaquesOponente = Array.isArray(window.lixoAtaquesOponente) ? [] : 0;
        }

        if (window.qtdBaralhoOponente > 0) {
            window.qtdBaralhoOponente--;
            window.qtdMaoOponente++;
            window.mostrarMensagemScanner("⚡ O oponente usou SPEED e comprou uma carta extra!");
            atualizarDecksEMaoCards(); // Desenha a carta extra na tela fantasma do oponente
        }
    }    



        else if (acao.tipo === 'ativar_sopro') {
        window.mostrarMensagemScanner(`💨 SOPRO INIMIGO! Uma ventania atingiu sua mão!`);
        
        if (window.maoAtaques && window.maoAtaques.length > 0) {
            // Sorteia um índice aleatório da sua própria mão
            let indexAleatorio = Math.floor(Math.random() * window.maoAtaques.length);
            
            // Remove a carta daquele índice
            window.maoAtaques.splice(indexAleatorio, 1);
            
            window.mostrarMensagemScanner(`❌ Você perdeu uma carta de ataque aleatória!`);
            atualizarDecksEMaoCards();
            
            if(window.tocarSFX) window.tocarSFX('erro'); // Toca o som de alerta/perda
        } else {
            window.mostrarMensagemScanner(`💨 O Sopro não teve efeito porque sua mão já estava vazia.`);
        }
    }
        else if (acao.tipo === 'ativar_mao_mao') {
        if (!window.bloqueioAtaqueTurnos) window.bloqueioAtaqueTurnos = { jogador: 0, oponente: 0 };
        // Nós recebemos a ação, então nós somos a vítima
        window.bloqueioAtaqueTurnos['jogador'] = Math.max(window.bloqueioAtaqueTurnos['jogador'], 1); 
        window.mostrarMensagemScanner(`👊 MÃO MÃO! Seus ataques foram esmagados e bloqueados por 1 turno!`);
        if(window.tocarSFX) window.tocarSFX('erro');
    }

            
        else if (acao.tipo === 'ativar_mao_eletronica') {
        if (!window.bloqueioAtaqueTurnos) window.bloqueioAtaqueTurnos = { jogador: 0, oponente: 0 };
        window.bloqueioAtaqueTurnos['jogador'] = 2; // Nós recebemos o ataque, nós somos a vítima
        window.mostrarMensagemScanner(`⚡ MÃO ELETRÔNICA! Seus ataques foram hackeados e bloqueados por 2 turnos!`);
        if(window.tocarSFX) window.tocarSFX('erro');
    }

            
        else if (acao.tipo === 'sonar_busca_concluida') {
        window.mostrarMensagemScanner("🕵️‍♂️ O oponente usou SONAR e buscou uma carta no deck!");
        // Incrementa a mão virtual dele na nossa tela
        if (window.qtdMaoOponente > 0) window.qtdMaoOponente++;
        if (window.qtdBaralhoOponente > 0) window.qtdBaralhoOponente--;
        atualizarDecksEMaoCards();
    }
        else if (acao.tipo === 'ativar_tornado') {
        window.mostrarMensagemScanner(`🌪️ FULMINANTE! O Tornado oponente varreu a sua mão!`);
        if(window.tocarSFX) window.tocarSFX('erro');
        
        // Suga a mão do jogador para dentro do baralho
        if (window.maoAtaques && window.maoAtaques.length > 0) {
            window.baralhoAtaques = window.baralhoAtaques.concat(window.maoAtaques);
            window.maoAtaques = [];
        }
        
        // Embaralha tudo e devolve apenas 2 cartas miseráveis!
        if (window.baralhoAtaques && window.baralhoAtaques.length > 0) {
            window.baralhoAtaques = embaralharArray(window.baralhoAtaques);
            
            let limiteComprar = Math.min(2, window.baralhoAtaques.length);
            for (let i = 0; i < limiteComprar; i++) {
                window.maoAtaques.push(window.baralhoAtaques.shift());
            }
        }
        
        atualizarDecksEMaoCards(); // Renderiza o buraco na mão na tela da vítima
    }
    else if (acao.tipo === 'ativar_armadilha_vinha') {
        if (!window.turnosPresoVinha) window.turnosPresoVinha = { jogador: 0, oponente: 0 };
        window.turnosPresoVinha['jogador'] = 1; // Nós somos a vítima se recebemos isso da rede
        window.mostrarMensagemScanner(`🌿 ARMADILHA DE VINHA! Você não poderá agir ou comprar cartas no seu próximo turno!`);
    }
        else if (acao.tipo === 'aplicar_status') {
        // 🔥 RECEPTOR: O inimigo aplicou um status especial (como Veneno Letal) numa carta nossa!
        let alvoReal = inverterId(acao.alvo);
        let criatura = obterCriaturaNoSlot(alvoReal);
        if (criatura) {
            criatura[acao.status] = acao.valor;
            atualizarTelaBatalha();
        }
    }
    else if (acao.tipo === 'abrir_burst') {
        let acaoInimiga = {
            dono: 'oponente',
            nomeAcao: acao.nomeAcao,
            tipo: 'rede',
            executar: function() { window.mostrarMensagemScanner(`✨ Resolvido: ${acao.nomeAcao}`); }
        };
        window.adicionarAoBurst(acaoInimiga);
    }
    else if (acao.tipo === 'fechar_burst') {
        window.aguardandoResposta = false;
        window.mostrarMensagemScanner("O Oponente não respondeu. Resolvendo a corrente...");
        setTimeout(() => window.resolverBurst(), 1000);
    }
   else if (acao.tipo === 'girar_roleta_local') {
        window.mostrarMensagemScanner("O Oponente está sorteando o Local...");
        
        window.sortearLocalAnimado('oponente', () => {
            window.localAtivoAtual = acao.img;
            window.nomeLocalAtivoAtual = acao.nome; // Sincroniza o nome recebido da rede
            
            if (typeof atualizarLocaisAtivosNaMesa === 'function') atualizarLocaisAtivosNaMesa();
            
            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                window._dbUpdate('salas_drome/' + window.salaBatalhaAtual, { 
                    localDaBatalha: acao.img,
                    nomeLocalDaBatalha: acao.nome
                });
            }
            window.mostrarMensagemScanner("Local revelado! Aguarde a jogada do oponente.");
        }, acao.img, acao.nome); // Encaminha imagem e nome para a roleta local piscar
    }
        else if (acao.tipo === 'naty_escolha_pronta') {
        let alvoReal = inverterId(acao.alvo); 
        let criatura = obterCriaturaNoSlot(alvoReal);
        if (criatura) {
            criatura.elementos = acao.elementos;
            if(acao.rodada) {
                criatura.batalhasRealizadas = acao.rodada;
            } else {
                criatura.batalhasRealizadas = (criatura.batalhasRealizadas || 0) + 1;
            }
            
            // 🔓 RECEPTOR DE DESTRAVAMENTO: Apaga a tela preta e libera o Smart Clock dele!
            let bannerEspera = document.getElementById('bloqueio-espera-naty');
            if (bannerEspera) bannerEspera.remove();
            
            window.retomarCronometro();
            window.mostrarMensagemScanner(`🌟 Naty inimiga moldou os elementos para: ${acao.elementos.join(", ")}!`);
            atualizarTelaBatalha();
        }
    }
            else if (acao.tipo === 'anular_acao') {
        // 🔥 NUVEM AVISOU: O Inimigo usou um Counter (Rejeição) e deletou a nossa ação!
        if (window.pilhaBurst && window.pilhaBurst.length > 0) {
            let acaoAnulada = window.pilhaBurst.pop();
            window.mostrarMensagemScanner(`🚫 NEGADO! O oponente anulou a sua ação: ${acaoAnulada.nomeAcao}!`);
        }
    }
    else if (acao.tipo === 'descarte_lixo') {
        // 🔥 NUVEM AVISOU: O inimigo descartou uma carta e mandou a identidade dela!
      if (acao.categoria === 'ataque') {
            if (!Array.isArray(window.lixoAtaquesOponente)) window.lixoAtaquesOponente = [];
            window.lixoAtaquesOponente.push(acao.idCarta);
            // 🔥 CORREÇÃO BUG 2: A mão visual do oponente também deve diminuir quando ele descarta/usa um ataque!
            if (window.qtdMaoOponente > 0) window.qtdMaoOponente--;
        } else if (acao.categoria === 'mugic') {
            if (!window.cemiterioOponente) window.cemiterioOponente = [];
            window.cemiterioOponente.push(acao.idCarta);
        }
        atualizarDecksEMaoCards();
    }
    else if (acao.tipo === 'desistencia') {
        // 🔥 NUVEM AVISOU: O Inimigo apertou o botão de fugir da partida!
        window.mostrarMensagemScanner("O oponente fugiu da batalha!");
        window.declararVitoria('jogador', 'O oponente fugiu covardemente do Drome!');
    }
    else if (acao.tipo === 'derrota_wo') {
        // 🔥 NUVEM AVISOU: O tempo do inimigo estourou e o juiz declarou WO!
        window.mostrarMensagemScanner("Conexão perdida ou inatividade prolongada!");
        window.declararVitoria('oponente', 'Você foi desconectado ou ficou inativo por tempo demais (W.O.).');
    }
        else if (acao.tipo === 'revelar_criatura_direto') {
        // 🔥 NUVEM AVISOU: O Oponente virou a carta de monstro dele para cima!
        let alvoReal = inverterId(acao.alvo);
        let criatura = obterCriaturaNoSlot(alvoReal);
        if (criatura) {
            criatura.revelada = true;
            window.mostrarMensagemScanner(`👁️ O inimigo revelou o campeão: ${criatura.nome}!`);
            atualizarTelaBatalha();
        }
    }
    else if (acao.tipo === 'revelar_equipamento_direto') {
        // 🔥 NUVEM AVISOU: O Oponente revelou um equipamento no lado dele!
        let alvoReal = inverterId(acao.alvo);
        let criatura = obterCriaturaNoSlot(alvoReal);
        if (criatura) {
            criatura.equipamentoRevelado = true;
            atualizarTelaBatalha(); // Redesenha a mesa instantaneamente
        }
    }
    else if (acao.tipo === 'declarar_vitoria_oponente') {
        // 🔥 REDUNDÂNCIA DE FIM DE JOGO: O oponente reconheceu a própria derrota e te enviou a taça!
        window.declararVitoria('jogador', 'Todo o exército inimigo foi aniquilado!');
    }
   else if (acao.tipo === 'hacker_pedir_mao') {
        // 🔥 NUVEM AVISOU: O Oponente usou o Johnes em você!
        // O seu celular vai olhar o número de série da sua mão, achar o NOME das cartas no seu álbum e vazar os NOMES.
        let maoVazadaNomes = window.maoAtaques.map(idDaCarta => {
            let cartaReal = window.inventario.find(c => c.id == idDaCarta);
            return cartaReal ? cartaReal.nome : "Carta Desconhecida"; 
        });
        
        window.enviarAcaoRede({ tipo: 'hacker_receber_mao', maoVazada: maoVazadaNomes });
    }
    else if (acao.tipo === 'hacker_receber_mao') {
        // 🔥 NUVEM AVISOU: Os dados do Johnes chegaram! Mostre na tela.
        window.mostrarMensagemScanner("✅ Dados interceptados com sucesso!");
        console.log("🕵️‍♂️ MÃO RECEBIDA DA REDE:", acao.maoVazada);
        
        let cartasHTML = "";
        let maoInimiga = acao.maoVazada || [];
        
        if (maoInimiga.length > 0) {
            maoInimiga.forEach(item => {
                let c = null;
                let buscaStr = String(item); // Nome ou ID limpo
                
                // Busca mega agressiva em todos os bancos
                if (window.inventario) c = window.inventario.find(x => String(x.id) === buscaStr || String(x.nome) === buscaStr);
                if (!c && typeof ATAQUES !== 'undefined') c = ATAQUES.find(x => String(x.id) === buscaStr || String(x.nome) === buscaStr);
                if (!c && typeof MAGIAS !== 'undefined') c = MAGIAS.find(x => String(x.id) === buscaStr || String(x.nome) === buscaStr);
                
                if (c) {
                    let imgCard = c.img || c.cartaBlank;
                    cartasHTML += `
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div onclick="if(typeof window.ampliarCartaClicada === 'function') window.ampliarCartaClicada('${imgCard}')" style="width: 80px; height: 115px; background-image: url('${imgCard}'); background-size: cover; background-position: center; border: 2px solid #00bcd4; border-radius: 5px; box-shadow: 0 0 10px rgba(0, 188, 212, 0.8); cursor:pointer; transition: 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"></div>
                            <span style="color:#00bcd4; font-size:9px; font-weight:bold; margin-top:5px; text-align:center;">${c.nome}</span>
                        </div>
                    `;
                } else {
                    // Carta Misteriosa: Se a foto falhar, mostra o Nome/ID num fundo preto hacker!
                    cartasHTML += `
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div style="width: 80px; height: 115px; background-color: #111; border: 2px dashed #00bcd4; border-radius: 5px; display:flex; align-items:center; justify-content:center; padding: 5px; cursor: help;">
                                <span style="color:#00bcd4; font-size:10px; font-weight:bold; text-align:center; word-break: break-word;">${buscaStr}</span>
                            </div>
                        </div>
                    `;
                }
            });
        }
        
        if (cartasHTML === "") {
            cartasHTML = `<p style="color:#aaa; font-size:12px;">A mão do oponente está vazia (ou os dados falharam).</p>`;
        }

        const modalVisaoHTML = `
            <div class="modal-overlay" id="overlay-espiando" style="z-index: 10000000; background: rgba(0,0,0,0.95); flex-direction: column; align-items: center; justify-content: center; display: flex;">
                <h2 style="color: #00bcd4; text-shadow: 0 0 10px #00bcd4; margin-bottom: 20px; font-family: 'Arial Black', sans-serif;">🕵️‍♂️ VISÃO HACKER: MÃO DO INIMIGO</h2>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; width: 90%; max-width: 400px; padding: 15px; background: rgba(0, 188, 212, 0.05); border-radius: 10px; border: 1px dashed #00bcd4;">
                    ${cartasHTML}
                </div>
                <p style="color: #aaa; font-size: 9px; margin-top: 10px;">Toque na carta para ampliá-la</p>
                <button class="btn-acao-modal" style="width: 150px; background: #222; color: #00bcd4; border: 2px solid #00bcd4; margin-top: 15px;" onclick="document.getElementById('overlay-espiando').remove()">FECHAR</button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalVisaoHTML);
    }
};
window.cartaRoubadaMaoNegra = null; // Memória da carta roubada

window.receberCartaRoubada = function(idCartaRoubada) {
    console.log("🕵️‍♂️ RASTREADOR [Mão Negra]: Pacote recebido da rede:", idCartaRoubada);

    // 1. O SEGREDO DA IMAGEM: Mantém o objeto completo para o renderizador não falhar!
    let cartaParaMao = (typeof idCartaRoubada === 'object' && idCartaRoubada.nome) ? idCartaRoubada : idCartaRoubada;
    let idLimpo = (typeof idCartaRoubada === 'object') ? (idCartaRoubada.id || idCartaRoubada.nome) : idCartaRoubada;
    
    console.log("🕵️‍♂️ RASTREADOR [Mão Negra]: Variável idLimpo ficou:", idLimpo);
    console.log("🕵️‍♂️ RASTREADOR [Mão Negra]: O que está sendo salvo na Mão:", cartaParaMao);
    
    window.cartaRoubadaMaoNegra = idLimpo; // Marca a carta na memória de devolução
    
    // 🔥 CORREÇÃO BUG 1: Guarda o dado completo na mão, para a imagem carregar direto!
    window.maoAtaques.push(cartaParaMao); 
    
    // 2. O SEGREDO DA MÃO INIMIGA: Tira visualmente a carta da mão do oponente na sua tela!
    if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
        if (window.qtdMaoOponente > 0) window.qtdMaoOponente--; 
    }
    
    // Procura o nome da carta roubada nos bancos para anunciar no Scanner
    let db = null;
    if (typeof ATAQUES !== 'undefined') db = ATAQUES.find(a => String(a.id) === String(idLimpo) || a.nome === idLimpo);
    if (!db && window.inventario) db = window.inventario.find(a => String(a.id) === String(idLimpo) || a.nome === idLimpo);
    
    window.mostrarMensagemScanner(`🌑 SUCESSO! Você roubou: ${db ? db.nome : "Carta Secreta"}`);
    if(window.tocarSFX) window.tocarSFX('notificacao');
    
    atualizarDecksEMaoCards(); // Desenha a sua carta e a do oponente na tela!
};
// ==========================================
// ⏳ SISTEMA DE RECONEXÃO E ANTI-AFK (W.O.) ⏳
// ==========================================
window.loopPingAFK = null;
window.loopMonitorAFK = null;
window.ultimaMemoriaPingInimigo = null;

window.iniciarSistemaAntiAFK = function() {
    if (!window.salaBatalhaAtual || window.salaBatalhaAtual === "sala_simulada") return;
    
    // 🔥 PREVENÇÃO ZUMBI: Se a tela de batalha está escondida, é impossível iniciar o cronômetro!
    let telaBatalha = document.getElementById("tela-batalha");
    if (telaBatalha && telaBatalha.style.display === "none") return;

    // 🔥 PREVENÇÃO DE CLONES: Mata qualquer cronômetro antigo antes de iniciar um novo!
    window.desligarSistemaAntiAFK();

    let meuSlot = window.souP1Batalha ? 'p1' : 'p2';
    let opSlot = window.souP1Batalha ? 'p2' : 'p1';
    
    // Usamos o cronômetro do seu próprio celular para evitar bugs de fuso-horário!
    window.ultimoPingRecebidoLocal = Date.now(); 
    
    // 1. O CORAÇÃO (Ping): Muda um valor na nuvem a cada 5 segundos
    window.loopPingAFK = setInterval(() => {
        window._dbUpdate('salas_drome/' + window.salaBatalhaAtual + '/pings', {
            [meuSlot]: Date.now() 
        });
    }, 5000);

    // 2. O RADAR (Pong): Escuta as batidas de coração do inimigo na nuvem
    window._dbOn('salas_drome/' + window.salaBatalhaAtual + '/pings', (snap) => {
        if (!snap.exists()) return;
        let pings = snap.val();
        
        // Se o valor dele mudou, significa que a internet dele está viva!
        if (pings[opSlot] && pings[opSlot] !== window.ultimaMemoriaPingInimigo) {
            window.ultimaMemoriaPingInimigo = pings[opSlot];
            window.ultimoPingRecebidoLocal = Date.now(); // Zera o seu cronômetro de tolerância!
        }
    });

    // 3. O JUIZ: O cronômetro impiedoso que gera o W.O.
    let tempoLimite = 45000; // 45 segundos fora do jogo = W.O.
    let tempoAviso = 15000;  // 15 segundos de lag/fora da aba = Mostra a tela de aviso

    window.loopMonitorAFK = setInterval(() => {
        let tempoInativo = Date.now() - window.ultimoPingRecebidoLocal;
        let bannerAfk = document.getElementById('aviso-afk-tela');

        if (tempoInativo > tempoLimite) {
            window.desligarSistemaAntiAFK();
            window.declararVitoria('jogador', 'O oponente caiu ou fugiu desconectando (Vitória por W.O.).');
            window.enviarAcaoRede({ tipo: 'derrota_wo' }); 
        } 
        else if (tempoInativo > tempoAviso) {
            let seg = Math.ceil((tempoLimite - tempoInativo) / 1000);
            if (!bannerAfk) {
                bannerAfk = document.createElement('div');
                bannerAfk.id = 'aviso-afk-tela';
                bannerAfk.style.cssText = "position:fixed; top:15%; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.95); color:white; padding:20px; border-radius:10px; border:2px solid #ff5555; z-index:9999999; font-family:monospace; text-align:center; box-shadow:0 0 30px rgba(255,0,0,0.8); pointer-events:none;";
                document.body.appendChild(bannerAfk);
            }
            bannerAfk.innerHTML = `<span style="color:#ff5555; font-weight:bold; font-size:16px;">⚠️ CONEXÃO DO OPONENTE INSTÁVEL ⚠️</span><br><br>Aguardando reconexão...<br><span style="font-size:35px; color:#ffd700; font-weight:bold;">${seg}s</span>`;
        } 
        else {
            // O inimigo voltou a tempo! O Juiz apaga o aviso e a batalha segue normal.
            if (bannerAfk) bannerAfk.remove();
        }
    }, 1000);
};

window.desligarSistemaAntiAFK = function() {
    if (window.loopPingAFK) { clearInterval(window.loopPingAFK); window.loopPingAFK = null; }
    if (window.loopMonitorAFK) { clearInterval(window.loopMonitorAFK); window.loopMonitorAFK = null; }
    let banner = document.getElementById('aviso-afk-tela');
    if (banner) banner.remove();
};

// ==========================================
// 🔄 SISTEMA DE RECUPERAÇÃO DE ESTADO (RECONEXÃO) 🔄
// ==========================================
window.checarReconexaoAtiva = function() {
    let ticket = localStorage.getItem('drome_ticket_batalha');
    if (ticket) {
        let dados = JSON.parse(ticket);
        
        // Verifica na nuvem se a sala ainda existe
        window._dbGet('salas_drome/' + dados.salaId).then(snap => {
            let sala = snap.val();
            
            // 🕵️‍♂️ MODO DETETIVE: O jogo já tinha acabado enquanto eu estava fora?
            let jogoAcabou = false;
            if (sala && sala.ultima_acao) {
                let tipoUltimaAcao = sala.ultima_acao.tipo;
                // Se a última coisa registrada foi alguém fugir, tomar WO ou a vitória ser declarada
                if (tipoUltimaAcao === 'desistencia' || tipoUltimaAcao === 'derrota_wo' || tipoUltimaAcao === 'declarar_vitoria_oponente') {
                    jogoAcabou = true;
                }
            }

            // 🔥 A FAXINA SILENCIOSA: Se a sala sumiu OU se a partida já acabou, rasga o ticket e não faz nada!
            if (!sala || jogoAcabou) {
                localStorage.removeItem('drome_ticket_batalha');
                localStorage.removeItem('drome_save_state');
                return; // Sai da função sem mostrar a tela de reconexão
            }

            // Monta a tela épica de retorno!

            // Monta a tela épica de retorno!
            const modalReconexao = `
                <div class="modal-overlay" id="overlay-reconexao" style="z-index: 9999999; background: rgba(0,0,0,0.95); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div class="modal-content-fichas" style="text-align: center; border: 3px solid #00bcd4; box-shadow: 0 0 30px rgba(0, 188, 212, 0.5); background: #111; padding: 30px; border-radius: 10px; max-width: 400px;">
                        <h2 style="color: #00bcd4; font-family: 'Arial Black', sans-serif; text-shadow: 0 0 10px #00bcd4; margin-bottom: 20px; font-size: 24px;">RECONEXÃO!</h2>
                        <p style="color: #fff; font-size: 14px; font-family: monospace; margin-bottom: 30px; line-height: 1.5;">
                            Detectamos que você caiu ou fechou o jogo no meio de uma batalha!<br><br>Deseja retornar à arena antes que o juiz declare W.O.?
                        </p>
                        <div style="display: flex; gap: 15px; justify-content: center;">
                            <button class="btn-acao-modal" style="background: #112211; color: #4CAF50; border: 1px solid #4CAF50; width: 160px;" onclick="
                                document.getElementById('overlay-reconexao').remove();
                                document.getElementById('tela-menu').style.display = 'none';
                                document.getElementById('tela-batalha').style.display = 'block';
                                
                                // 🔥 O DESFIBRILADOR: Bate o coração na nuvem IMEDIATAMENTE pra cancelar o W.O.!
                                window._dbUpdate('salas_drome/' + '${dados.salaId}' + '/pings', {
                                    '${dados.souP1 ? 'p1' : 'p2'}': Date.now() 
                                });

                                // 🔥 PUXA O CHECKPOINT PERFEITO
                                window.recuperarBatalhaSalva('${dados.salaId}', ${dados.souP1});
                                window.mostrarMensagemScanner('Mesa restaurada com sucesso!');
                            ">VOLTAR À LUTA</button>
                            
                            <button class="btn-acao-modal" style="background: #220000; color: #e53935; border: 1px solid #e53935; width: 130px;" onclick="
                                document.getElementById('overlay-reconexao').remove();
                                localStorage.removeItem('drome_ticket_batalha');
                                localStorage.removeItem('drome_save_state');
                                window._dbUpdate('salas_drome/${dados.salaId}', { ultima_acao: { tipo: 'desistencia', remetente: '${dados.souP1 ? 'p1' : 'p2'}', timestamp: Date.now() } });
                            ">DESISTIR</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalReconexao);
        });
    }
};

// 🔥 A FUNÇÃO MÁGICA: Lê o Save e redesenha a mesa perfeitamente como estava!
window.recuperarBatalhaSalva = function(salaId, souP1) {
    let saved = localStorage.getItem('drome_save_state');
    if (saved) {
        let s = JSON.parse(saved);
        campoJogador = s.campoJogador || { c1: null, c2: null, c3: null, c4: null, c5: null, c6: null };
        window.campoOponente = s.campoOponente || { c1: null, c2: null, c3: null, c4: null, c5: null, c6: null };
        window.cemiterio = s.cemiterio || [];
        window.cemiterioOponente = s.cemiterioOponente || [];
        window.lixoAtaques = s.lixoAtaques || [];
        window.lixoAtaquesOponente = s.lixoAtaquesOponente || 0;
        window.pontosAtaque = s.pontosAtaque || { jogador: 3, oponente: 3 };
        window.maoAtaques = s.maoAtaques || [];
        window.baralhoAtaques = s.baralhoAtaques || [];
        window.jogadorMugics = s.jogadorMugics || [];
        window.qtdBaralhoOponente = s.qtdBaralhoOponente !== undefined ? s.qtdBaralhoOponente : 17;
        window.qtdMaoOponente = s.qtdMaoOponente !== undefined ? s.qtdMaoOponente : 3;
        window.estadoTurno = s.estadoTurno || { jogadorAtual: null, turnoNumero: 0, fase: 'pre-jogo' };
        window.ultimaAcaoProcessada = s.ultimaAcaoProcessada || 0; 
        
        window.localAtivoAtual = s.localAtivoAtual || null;
        window.nomeLocalAtivoAtual = s.nomeLocalAtivoAtual || null;
        window.estadoCombate = s.estadoCombate || { ativo: false, atacante: null, defensor: null };
        window.combateFinalizadoNesteTurno = s.combateFinalizadoNesteTurno || false;
        window.combateIniciadoNesteTurno = s.combateIniciadoNesteTurno || false;
       window.modoAlvo = s.modoAlvo || null;
        window.conjuradorMugicAtual = s.conjuradorMugicAtual || null;
        window.slotSelecionadoMovimento = s.slotSelecionadoMovimento || null;
        window.locaisOponente = s.locaisOponente || [];
        window.donoDaRoletaLocal = s.donoDaRoletaLocal || 'jogador';

        
        if (!window.estadoDrome) window.estadoDrome = {};
        window.estadoDrome.modo = s.modo || "6x6"; // Recupera o formato do tabuleiro!
        // 🔥 RESTAURA O DECK ORIGINAL: A roleta de locais vai funcionar perfeitamente!
        window.estadoDrome.deckSelecionado = s.deckSelecionado || null;
    } else {
        window.carregarDeckParaBatalha(salaId, souP1);
        return;
    }

    window.salaBatalhaAtual = salaId;
    window.souP1Batalha = souP1;
    
    // 🔥 FORÇA O CSS A EXISTIR IMEDIATAMENTE (Cura a bagunça do tabuleiro)
    if (!document.getElementById("css-movimento")) {
        let style = document.createElement('style');
        style.id = "css-movimento";
        style.innerHTML = `
            .zona-central { justify-content: flex-start !important; gap: 5px !important; position: relative !important; z-index: 1000 !important; }
            .zona-lateral { position: relative !important; z-index: 10 !important; }
            .linha-formacao-batalha { margin: 0 !important; }
            [id^="jog-"], [id^="op-"] { touch-action: none !important; }
           .mini-equip-icon.revelado { 
    display: block !important;
    width: 26px !important;
    height: 26px !important;
    background-size: cover !important; 
    background-position: center !important; 
    border: 2px solid #ffd700 !important; 
    border-radius: 50% !important;
}
            .slot-selecionado { box-shadow: 0 0 20px #ffd700, inset 0 0 10px #ffd700 !important; border-color: #ffd700 !important; transform: scale(1.05); transition: 0.2s; z-index: 100;}
            .slot-alvo-combate { box-shadow: inset 0 0 25px rgba(255,0,0,0.8), 0 0 15px rgba(255,0,0,0.5) !important; border-color: #ff0000 !important; cursor: pointer; transition: 0.2s; z-index: 90;}
        `;
        document.head.appendChild(style);
    }
    
    window.ajustarTabuleiroBatalha(window.estadoDrome.modo); 
    atualizarTelaBatalha(); 
    if (typeof window.atualizarSeusContadoresDeAtaque === 'function') window.atualizarSeusContadoresDeAtaque();
    
    if (typeof atualizarLocaisAtivosNaMesa === 'function') atualizarLocaisAtivosNaMesa();
    
    // 🔥 CURA A AMNÉSIA DE COMBATE: Pinta a mesa de vermelho e verde se estivessem lutando!
    if (window.estadoCombate && window.estadoCombate.ativo) {
        let elAtaque = document.getElementById(window.estadoCombate.atacante);
        let elDefesa = document.getElementById(window.estadoCombate.defensor);
        if (elAtaque) elAtaque.classList.add('slot-selecionado');
        if (elDefesa) elDefesa.classList.add('slot-alvo-combate');
    }
    
    window.iniciarEscutaDeTurnoOnline(); 
    if (typeof window.iniciarEscutaAcoesOnline === 'function') window.iniciarEscutaAcoesOnline(); 
    if (typeof window.iniciarSistemaAntiAFK === 'function') window.iniciarSistemaAntiAFK();
};

setTimeout(() => {
    if (typeof window.checarReconexaoAtiva === 'function') {
        window.checarReconexaoAtiva();
    }
}, 2000);


// ==========================================
// 🛡️ BLINDAGEM DE CAMADAS (CSS DE EMERGÊNCIA) 🛡️
// ==========================================
let styleSuperFix = document.createElement('style');
styleSuperFix.innerHTML = `
    /* 1. As cartas base ficam baixinhas, mas ao passar o dedo, saltam pra cara do jogador! */
    [id^="jog-"], [id^="op-"] { position: relative; z-index: 10; transition: z-index 0s; }
    [id^="jog-"]:hover, [id^="op-"]:hover { z-index: 99999 !important; }

    /* 2. O Balão do equipamento ganha super prioridade para NUNCA ficar atrás de nada na mesa */
    .equip-tooltip { z-index: 99999999 !important; bottom: 130% !important; box-shadow: 0 0 20px black; background: rgba(0,20,0,0.95) !important; border: 2px solid #4CAF50 !important; }
    .mini-equip-icon:hover { z-index: 99999999 !important; }

    /* 3. A Tela Preta dos Modais (Ações, Vitória, etc) VENCE de qualquer carta! */
    .modal-overlay { z-index: 999999999 !important; }
    
    /* 4. Centraliza perfeitamente a janela de Ações (como o seu Frador) no meio da tela */
    #overlay-acoes { display: flex !important; align-items: center !important; justify-content: center !important; background: rgba(0,0,0,0.85) !important; }
`;
document.head.appendChild(styleSuperFix);


// ==========================================
// 🎲 MOTOR DE ANIMAÇÃO: DADO 6 LADOS
// ==========================================
window.rolarDadoAnimado = function(resultadoFinal, callback) {
    window.pausarCronometro();
    if(window.tocarSFX) window.tocarSFX('notificacao');

    const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const faceFinal = faces[resultadoFinal - 1];

    const modalHTML = `
        <div class="modal-overlay" id="overlay-dado" style="z-index: 10000000; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <h2 style="color: #ff9800; font-family: 'Arial Black', sans-serif; letter-spacing: 3px; text-shadow: 0 0 15px #ff9800; margin-bottom: 20px; animation: pulse 0.5s infinite alternate;">ROLANDO OS DADOS...</h2>
            <div id="dado-animacao" style="font-size: 100px; color: #fff; text-shadow: 0 0 20px #fff; background: #222; border: 4px solid #ff9800; border-radius: 20px; width: 150px; height: 150px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 40px #ff9800; transition: transform 0.1s;">
                ⚅
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    let divDado = document.getElementById('dado-animacao');
    let giros = 0;
    let tempo = 50;

    function girar() {
        divDado.innerText = faces[Math.floor(Math.random() * 6)];
        divDado.style.transform = `rotate(${Math.random() * 360}deg) scale(${1 + Math.random() * 0.5})`;
        giros++;
        tempo += 5;

        if (giros < 30) {
            setTimeout(girar, tempo);
        } else {
            // Parada dramática no resultado
            divDado.innerText = faceFinal;
            divDado.style.transform = "rotate(0deg) scale(1.5)";
            divDado.style.borderColor = "#4CAF50";
            divDado.style.boxShadow = "0 0 60px #4CAF50";
            divDado.style.color = "#4CAF50";
            
            let titulo = document.querySelector('#overlay-dado h2');
            if(titulo) {
                titulo.innerText = `RESULTADO: ${resultadoFinal}!`;
                titulo.style.color = "#4CAF50";
                titulo.style.textShadow = "0 0 20px #4CAF50";
                titulo.style.animation = "none";
            }

            // Espera 2 segundos para o jogador ver o resultado e continua o ataque!
            setTimeout(() => {
                let modal = document.getElementById('overlay-dado');
                if (modal) modal.remove();
                window.retomarCronometro();
                if (callback) callback();
            }, 2000);
        }
    }
    girar();
};

// ==========================================
// 👁️ AÇÃO NO BURST: REVELAR CAMPEÃO OCULTO
// ==========================================
window.acionarRevelarCriatura = function(fullId) {
    window.fecharModalAcoes();
    let criatura = obterCriaturaNoSlot(fullId);
    if (!criatura || criatura.revelada) return;

    let acaoRevelar = {
        dono: criatura.dono,
        nomeAcao: `Revelar Campeão (${criatura.nome})`,
        tipo: 'revelar_criatura',
        executar: function() {
            criatura.revelada = true;
            window.mostrarMensagemScanner(`👁️ O campeão ${criatura.nome} saiu das sombras e se revelou!`);
            if(window.tocarSFX) window.tocarSFX('notificacao');
            
            let elAlvo = document.getElementById(fullId);
            if(elAlvo) {
                elAlvo.style.animation = "pulse 0.5s";
                setTimeout(() => { elAlvo.style.animation = ""; }, 500);
            }

            if (criatura.dono === 'jogador' && window.salaBatalhaAtual && window.salaBatalhaAtual !== 'sala_simulada') {
                window.enviarAcaoRede({ tipo: 'revelar_criatura_direto', alvo: fullId });
            }
            atualizarTelaBatalha();
        }
    };
    window.adicionarAoBurst(acaoRevelar);
};


// ==========================================
// 🎯 NOVO MOTOR DE HUD: MIRA HOLOGRÁFICA
// ==========================================
window.atualizarInterfaceMira = function(mensagem) {
    let banner = document.getElementById('aviso-mira-fixa');
    
    // Se a mensagem for nula, deleta a interface
    if (!mensagem) {
        if (banner) banner.remove();
        return;
    }

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'aviso-mira-fixa';
        // pointer-events: none é a mágica que deixa você clicar NAS CARTAS mesmo com o aviso na frente delas!
        banner.style.cssText = "position:fixed; top:12%; left:50%; transform:translateX(-50%); background:rgba(0, 5, 0, 0.95); color:white; padding:15px 30px; border-radius:15px; border:3px solid #00bcd4; z-index:9999999; font-family:'Arial Black', sans-serif; text-align:center; box-shadow:0 0 40px rgba(0, 188, 212, 0.8); pointer-events:none; animation: pulse 1.5s infinite alternate; width: 85%; max-width: 450px; display:flex; flex-direction:column; justify-content:center; align-items:center;";
        document.body.appendChild(banner);
    }
    
    let cor = "#00bcd4";
    let icone = "🎯";
    let msgMin = mensagem.toLowerCase();
    
    // Inteligência de Cores: Muda a cor do painel de acordo com o contexto
    if (msgMin.includes("bomba") || msgMin.includes("dano") || msgMin.includes("vento") || msgMin.includes("leona")) {
        cor = "#ff5555"; // Vermelho Perigo
        icone = "⚔️";
    } else if (msgMin.includes("cura") || msgMin.includes("veneno") || msgMin.includes("aliança")) {
        cor = "#4CAF50"; // Verde Cura
        icone = "✨";
    }
    
    banner.style.borderColor = cor;
    banner.style.boxShadow = `0 0 40px ${cor}`;

    banner.innerHTML = `
        <h2 style="color:${cor}; font-size:22px; margin-bottom:10px; text-shadow: 0 0 15px ${cor}; text-transform:uppercase;">${icone} MIRA ATIVADA</h2>
        <p style="color:#fff; font-size:14px; font-weight:normal; font-family:monospace; line-height: 1.4; margin-bottom: 10px;">${mensagem}</p>
        <div style="background: rgba(255,255,255,0.1); padding: 5px 15px; border-radius: 5px; border: 1px dashed #777;">
            <p style="color:#aaa; font-size:10px; text-transform: uppercase;">(Toque num espaço vazio da mesa para cancelar)</p>
        </div>
    `;
};

// 🔥 O TRUQUE DO ARQUITETO: Apaga o HUD sozinho!
// Observamos a variável window.modoAlvo. Sempre que ela virar "null", a tela apaga automaticamente!
let valorModoAlvoOriginal = window.modoAlvo;
Object.defineProperty(window, 'modoAlvo', {
    get: function() { return valorModoAlvoOriginal; },
    set: function(novoValor) {
        valorModoAlvoOriginal = novoValor;
        if (novoValor === null) {
            window.atualizarInterfaceMira(null); 
        }
    }
});

// ==========================================
// 🐍 EXORCISTA DO VENENO: Execução Segura Pós-Banner
// ==========================================
window.aplicarDanoVenenoLetalSeguro = function() {
    let ladoParaSofrerDano = window.estadoTurno.jogadorAtual === 'jogador' ? campoJogador : window.campoOponente;
    let prefixoLado = window.estadoTurno.jogadorAtual === 'jogador' ? 'jog-' : 'op-';

    if (ladoParaSofrerDano) {
        Object.keys(ladoParaSofrerDano).forEach(chave => {
            let monstro = ladoParaSofrerDano[chave];
            if (monstro && monstro.hpAtual > 0 && monstro.envenenadoLetal) {
                monstro.hpAtual -= 5;
                if (monstro.hpAtual < 0) monstro.hpAtual = 0;
                
                let nomeDono = window.estadoTurno.jogadorAtual === 'jogador' ? "Seu" : "O";
                window.mostrarMensagemScanner(`🐍 ${nomeDono} campeão ${monstro.nome} sofreu 5 de dano do Veneno Letal!`);
                if(window.tocarSFX) window.tocarSFX('notificacao');
                
                let elCard = document.getElementById(prefixoLado + chave);
                if(elCard) {
                    elCard.style.filter = "hue-rotate(270deg) saturate(200%)";
                    elCard.style.animation = "shake 0.5s";
                    setTimeout(() => { elCard.style.filter = ""; elCard.style.animation = ""; }, 600);
                }

                // Se o veneno matar a criatura aqui, o turno NÃO vai bugar porque os banners já resolveram!
                if (monstro.hpAtual === 0) {
                    setTimeout(() => window.encerrarCombateMorte(prefixoLado + chave), 1000);
                }
            }
        });
    }
};
