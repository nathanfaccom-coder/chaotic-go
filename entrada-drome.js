// ==========================================
// ⚔️ FLUXO DE ENTRADA DO DROME
// ==========================================

window.estadoDrome = {
    tipoJogo: null, modo: null,
    deckSelecionado: null, amigoDesafiado: null, naFila: false
};

// Helpers Firebase
function _dbGet(path) { return window._dbGet(path); }
function _dbSet(path, val) { return window._dbSet(path, val); }
function _dbUpdate(path, val) { return window._dbUpdate(path, val); }
function _dbRemove(path) { return window._dbRemove(path); }
function _dbOn(path, cb) { return window._dbOn(path, cb); }

// ==========================================
// ABRE A TELA DE ENTRADA
// ==========================================
window.abrirEntradaDrome = function() {
    document.getElementById("tela-menu").style.display = "none";
    window.modoMenu = false;
    renderizarPassoTipoJogo();
};

// ==========================================
// PASSO 1: Online ou Amigo
// ==========================================
function renderizarPassoTipoJogo() {
    let tela = document.getElementById("tela-entrada-drome");
    tela.style.display = "flex";
    tela.innerHTML = `
        <p class="titulo-tela" style="margin-top:20px;font-size:14px;letter-spacing:2px;">⚔️ DROME ⚔️</p>
        <p style="color:#4CAF50;font-size:10px;margin-bottom:30px;font-family:monospace;">SELECIONE O MODO DE BATALHA</p>
        <div style="display:flex;flex-direction:column;gap:15px;width:85%;">
            <button type="button" class="btn-entrada-drome online" style="width:100%;text-align:left;font:inherit;cursor:pointer;" onclick="window.selecionarTipoJogo('online')">
                <span style="font-size:28px;">🌐</span>
                <div>
                    <div style="font-size:13px;font-weight:bold;color:#fff;">JOGAR ONLINE (LEGADO)</div>
                    <div style="font-size:9px;color:#aaa;margin-top:3px;">Fila aleatória antiga; pode exigir serviços ainda em migração</div>
                </div>
            </button>
            <button type="button" class="btn-entrada-drome amigo" style="width:100%;text-align:left;font:inherit;cursor:pointer;" onclick="window.selecionarTipoJogo('amigo')">
                <span style="font-size:28px;">🤝</span>
                <div>
                    <div style="font-size:13px;font-weight:bold;color:#fff;">JOGAR COM AMIGO (LEGADO)</div>
                    <div style="font-size:9px;color:#aaa;margin-top:3px;">Modo de amigos antigo; sala por código é o caminho recomendado</div>
                </div>
            </button>
        </div>
        <button class="btn-entrada-drome modo" type="button" style="width:85%; margin:20px auto 0; padding:12px; border:2px solid #64cb83; border-radius:10px; background:#103321; color:white; cursor:pointer;"
          onclick="window.abrirSalaPrivadaDrome && window.abrirSalaPrivadaDrome()">🔐 TREINO 3x3 POR CÓDIGO</button>
        <p style="font-size:9px;color:#aaa;margin:6px auto;">Treino 3x3 com dois jogadores por código disponível em fase experimental. Modos oficiais ainda em desenvolvimento.</p>
        <button class="btn-voltar-pequeno" style="margin-top:18px;" onclick="window.voltarMenuDrome()">Voltar ao Menu</button>
    `;
}

// ==========================================
// PASSO 2: Modo
// ==========================================
function renderizarPassoModo() {
    let tela = document.getElementById("tela-entrada-drome");
    let labelTipo = window.estadoDrome.tipoJogo === 'online' ? '🌐 ONLINE' : '🤝 COM AMIGO';
    tela.innerHTML = `
        <p class="titulo-tela" style="margin-top:20px;font-size:14px;letter-spacing:2px;">⚔️ DROME ⚔️</p>
        <p style="color:#4CAF50;font-size:10px;margin-bottom:5px;font-family:monospace;">${labelTipo}</p>
        <p style="color:#fff;font-size:11px;margin-bottom:25px;">ESCOLHA O MODO DE JOGO</p>
        <div style="display:flex;flex-direction:column;gap:12px;width:85%;">
            <button type="button" class="btn-entrada-drome modo" style="width:100%;text-align:left;font:inherit;cursor:pointer;" onclick="window.selecionarModo('6x6')">
                <span style="font-size:24px;">⚔️</span>
                <div><div style="font-size:13px;font-weight:bold;color:#fff;">6x6 PRINCIPAL</div><div style="font-size:9px;color:#aaa;margin-top:2px;">6 Criaturas · 6 Mugics · 6 Equips · 20 Ataques · 10 Locais</div></div>
            </button>
            <button type="button" class="btn-entrada-drome modo" style="width:100%;text-align:left;font:inherit;cursor:pointer;" onclick="window.selecionarModo('3x3')">
                <span style="font-size:24px;">🗡️</span>
                <div><div style="font-size:13px;font-weight:bold;color:#fff;">3x3 RÁPIDO</div><div style="font-size:9px;color:#aaa;margin-top:2px;">3 Criaturas · 3 Mugics · 3 Equips · 20 Ataques · 10 Locais</div></div>
            </button>
            <button type="button" class="btn-entrada-drome modo" style="width:100%;text-align:left;font:inherit;cursor:pointer;" onclick="window.selecionarModo('1x1')">
                <span style="font-size:24px;">🎯</span>
                <div><div style="font-size:13px;font-weight:bold;color:#fff;">1x1 DUELO</div><div style="font-size:9px;color:#aaa;margin-top:2px;">1 Criatura · 1 Mugic · 1 Equip · 20 Ataques · 10 Locais</div></div>
            </button>
        </div>
        <button class="btn-voltar-pequeno" style="margin-top:30px;" onclick="renderizarPassoTipoJogo()">← Voltar</button>
    `;
}

// ==========================================
// PASSO 3: Escolher Deck
// ==========================================
window.renderizarPassoEscolhaDeck = function() {
    // A previously selected deck belongs to the previous mode/screen.
    // Never allow a hidden stale selection to launch a different mode.
    window.estadoDrome.deckSelecionado = null;
    let tela = document.getElementById("tela-entrada-drome");
    let modo = window.estadoDrome.modo;
    tela.innerHTML = `
        <p class="titulo-tela" style="margin-top:20px;font-size:14px;letter-spacing:2px;">⚔️ DROME ⚔️</p>
        <p style="color:#4CAF50;font-size:10px;margin-bottom:5px;font-family:monospace;">MODO ${modo.toUpperCase()}</p>
        <p style="color:#fff;font-size:11px;margin-bottom:20px;">ESCOLHA SEU DECK</p>
        <div id="lista-decks-drome" style="display:flex;flex-direction:column;gap:12px;width:85%;">
            <p style="color:#555;font-size:10px;text-align:center;font-family:monospace;">Carregando decks...</p>
        </div>
        <div id="aviso-deck-irregular" style="display:none;background:rgba(229,57,53,0.15);border:1px solid #e53935;border-radius:8px;padding:10px;width:85%;margin-top:15px;box-sizing:border-box;">
            <p style="color:#ff5555;font-size:10px;font-weight:bold;margin:0 0 5px 0;">⚠️ DECK IRREGULAR</p>
            <p id="texto-irregularidade" style="color:#ffaaaa;font-size:9px;margin:0;line-height:1.4;"></p>
        </div>
        <button id="btn-jogar-drome" style="display:none;margin-top:20px;background:#4CAF50;color:#000;font-weight:bold;font-size:14px;padding:14px;border-radius:8px;border:2px solid #1b5e20;width:85%;cursor:pointer;box-shadow:0 5px 0 #1b5e20;" onclick="window.confirmarEntradaDrome()">⚔️ ENTRAR NO DROME</button>
        <button class="btn-voltar-pequeno" style="margin-top:15px;" onclick="renderizarPassoModo()">← Voltar</button>
    `;
    carregarDecksParaEscolha(modo);
};

function carregarDecksParaEscolha(modo) {
    const lista = document.getElementById("lista-decks-drome");
    if (!lista) return;
    const uid = localStorage.getItem("chaoticUID");
    if (!uid || uid === "null" || uid === "undefined") {
        lista.textContent = "Entre na sua conta para carregar os Decks.";
        return;
    }

    // A request can become stale even when the same list DOM node is reused.
    // Bind its result to the current user, mode and request generation.
    const requestId = (window._dromeDeckRequestId || 0) + 1;
    window._dromeDeckRequestId = requestId;
    const isCurrent = () => window._dromeDeckRequestId === requestId &&
        document.getElementById("lista-decks-drome") === lista &&
        window.estadoDrome.modo === modo &&
        localStorage.getItem("chaoticUID") === uid;

    _dbGet('jogadores/' + uid + '/decks').then(snapshot => {
        // A delayed request from an older mode must NEVER overwrite the
        // list opened afterward (common on slow Android connections).
        if (!isCurrent()) return;
        lista.innerHTML = "";
        let encontrouAlgum = false;
        const todosOsDecks = snapshot.exists() ? (snapshot.val() || {}) : {};

        [1, 2, 3].forEach(numSlot => {
            const idFogo = modo + "_slot_" + numSlot;
            const deckData = todosOsDecks[idFogo] || todosOsDecks[modo+"_"+numSlot] || null;
            const div = document.createElement("div");
            if (deckData && typeof deckData === "object") {
                encontrouAlgum = true;
                const irreg = verificarIrregularidadeDeck(deckData, modo);
                div.className = "card-deck-drome";
                div.style.borderColor = irreg ? "#e53935" : "#4CAF50";
                // Only static markup is inserted. Names and modes come from
                // saved player data and must be rendered as TEXT, not HTML.
                div.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
                        <div style="text-align:left;min-width:0;">
                            <div class="drome-saved-deck-name" style="font-size:13px;font-weight:bold;color:#fff;overflow-wrap:anywhere;"></div>
                            <div class="drome-saved-deck-detail" style="font-size:9px;color:#aaa;margin-top:3px;"></div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:18px;">${irreg ? '⚠️' : '✅'}</div>
                            <div style="font-size:8px;color:${irreg ? '#ff5555' : '#4CAF50'};font-weight:bold;">${irreg ? 'IRREGULAR' : 'PRONTO'}</div>
                        </div>
                    </div>
                `;
                div.querySelector(".drome-saved-deck-name").textContent = String(deckData.nome || "Deck Sem Nome");
                div.querySelector(".drome-saved-deck-detail").textContent =
                    "Slot " + numSlot + " · Modo " + String(deckData.modo || modo);
                div.onclick = () => selecionarDeckDrome(deckData, numSlot, irreg, div);
            } else {
                div.className = "card-deck-drome vazio";
                div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;width:100%;opacity:0.4;"><div><div style="font-size:12px;font-weight:bold;color:#777;">Slot ${numSlot} — Vazio</div><div style="font-size:9px;color:#555;margin-top:3px;">Nenhum deck ${modo} salvo aqui</div></div><div style="font-size:20px;">🔒</div></div>`;
            }
            lista.appendChild(div);
        });
        if (!encontrouAlgum) {
            // This message contains only a mode from the fixed set 1x1/3x3/6x6.
            lista.textContent = "Nenhum deck " + modo + " encontrado. Crie um deck na Oficina primeiro!";
        }
    }).catch(err => {
        // A failed request from a previous account or mode must not erase
        // a newer successful Deck list (or disclose the old account state).
        if (!isCurrent()) return;
        console.error("Erro na leitura da Nuvem:", err);
        lista.textContent = "Falha ao carregar decks! Verifique sua conexão.";
        window.estadoDrome.deckSelecionado = null;
        const btn = document.getElementById("btn-jogar-drome");
        if (btn) btn.style.display = "none";
    });
}

function verificarIrregularidadeDeck(deck, modo) {
    const required = {"1x1": 1, "3x3": 3, "6x6": 6}[modo];
    if (!required || !deck || typeof deck !== "object" || Array.isArray(deck)) {
        return "Deck ou modo inválido.";
    }
    const problems = [];
    // Count only occupied slots. Arrays with nulls and sparse keyed objects
    // must not pass validation simply because they have the expected length.
    function occupied(value) {
        if (!value || typeof value !== "object") return [];
        return Object.values(value).filter(item =>
            item !== null && item !== undefined &&
            (typeof item !== "string" || item.trim() !== "") &&
            (typeof item !== "object" || Object.keys(item).length > 0)
        );
    }
    const attacks = occupied(deck.ataques).length;
    const locations = occupied(deck.locais).length;
    const creatures = occupied(deck.criaturas).length;
    if (attacks !== 20) problems.push(`Ataques: ${attacks}/20`);
    if (locations !== 10) problems.push(`Locais: ${locations}/10`);
    if (creatures !== required) problems.push(`Criaturas: ${creatures}/${required}`);
    // Legacy decks can store equipment and Mugic under different keys.
    // Do not reject them solely for an unrecognized schema; the server
    // remains responsible for validating the complete official deck.
    if (deck.modo && deck.modo !== modo) problems.push("Modo do Deck incompatível");
    return problems.length ? problems.join(" · ") : null;
}

function selecionarDeckDrome(deckData, numSlot, irreg, divEl) {
    document.querySelectorAll('.card-deck-drome').forEach(d => d.classList.remove('selecionado'));
    divEl.classList.add('selecionado');
    window.estadoDrome.deckSelecionado = Object.assign({}, deckData, { slot: numSlot });
    let aviso = document.getElementById("aviso-deck-irregular");
    let btn = document.getElementById("btn-jogar-drome");
    if (irreg) {
        aviso.style.display = "block";
        document.getElementById("texto-irregularidade").innerText = irreg;
        if (btn) btn.style.display = "none";
    } else {
        aviso.style.display = "none";
        if (btn) btn.style.display = "block";
    }
}

window.confirmarEntradaDrome = function() {
    const selected = window.estadoDrome.deckSelecionado;
    if (!selected) return;
    // Revalidate on entry: a saved selection may become stale after navigation.
    const mode = window.estadoDrome.modo;
    if (!["1x1", "3x3", "6x6"].includes(mode) ||
        (selected.modo && selected.modo !== mode) ||
        verificarIrregularidadeDeck(selected, mode)) {
        window.estadoDrome.deckSelecionado = null;
        const aviso = document.getElementById("aviso-deck-irregular");
        const texto = document.getElementById("texto-irregularidade");
        if (aviso && texto) {
            aviso.style.display = "block";
            texto.textContent = "Deck incompatível ou incompleto para este modo. Selecione um Deck válido novamente.";
        }
        const btn = document.getElementById("btn-jogar-drome");
        if (btn) btn.style.display = "none";
        return;
    }
    // Não iniciar matchmaking Firebase nesta prévia: o backend online
    // ainda não foi portado. Preservamos a lógica abaixo para reativá-la
    // quando salas, transações e presença estiverem protegidas no servidor.
    if (window.CHAOTIC_MULTIPLAYER_ENABLED !== true) {
        const aviso = document.getElementById("aviso-deck-irregular");
        const texto = document.getElementById("texto-irregularidade");
        if (aviso && texto) {
            aviso.style.display = "block";
            texto.textContent = "Seu deck está salvo. As batalhas online serão ativadas após a migração segura do multiplayer.";
        }
        if (typeof window.mostrarMensagemScanner === "function") {
            window.mostrarMensagemScanner("DECK PRONTO! BATALHAS ONLINE AINDA EM MIGRAÇÃO.");
        }
        return;
    }
    // Cached Deck selection is not proof of an active login.
    // The server must still authenticate every multiplayer action.
    const activeUid = localStorage.getItem("chaoticUID");
    if (!activeUid || activeUid === "null" || activeUid === "undefined") {
        window.estadoDrome.deckSelecionado = null;
        const aviso = document.getElementById("aviso-deck-irregular");
        const texto = document.getElementById("texto-irregularidade");
        if (aviso && texto) {
            aviso.style.display = "block";
            texto.textContent = "Sua sessão não está disponível. Entre novamente e escolha seu Deck.";
        }
        const btn = document.getElementById("btn-jogar-drome");
        if (btn) btn.style.display = "none";
        return;
    }
    if (window.estadoDrome.tipoJogo === 'online') {
        window.mostrarMensagemScanner("Conectando aos servidores do Drome...");
        renderizarFilaOnline(); 
    } else {
        renderizarPassoEscolhaAmigo();
    }
};

window.ajustarTabuleiroBatalha = function(modo) {
    let opZona = document.querySelector('.lado-oponente .zona-central');
    let jogZona = document.querySelector('.lado-jogador .zona-central');
    // Some mobile/legacy layouts omit slots while their view is mounting.
    // Do not crash the battle entry flow when a slot is absent.
    const parentOf = id => document.getElementById(id)?.parentElement || null;
    let opLinha3 = parentOf('op-c1');
    let opLinha2 = parentOf('op-c4');
    let opLinha1 = parentOf('op-c6');
    let jogLinha3 = parentOf('jog-c1');
    let jogLinha2 = parentOf('jog-c4');
    let jogLinha1 = parentOf('jog-c6');
    let opMugics = document.querySelectorAll('.lado-oponente .hex-mugic');
    let jogMugics = document.querySelectorAll('.lado-jogador .hex-mugic');
    [opZona, jogZona].forEach(zona => {
        if(zona) {
            zona.style.display = "flex"; zona.style.flexDirection = "column"; zona.style.height = "100%"; 
            zona.style.justifyContent = modo === "6x6" ? "space-evenly" : "flex-start"; zona.style.padding = "0"; 
        }
    });
    [opLinha1, opLinha2, opLinha3, jogLinha1, jogLinha2, jogLinha3].forEach(linha => {
        if(linha) { linha.style.marginTop = "0"; linha.style.marginBottom = "0"; }
    });
    if (modo === "6x6") {
        if (opLinha3) opLinha3.style.display = "flex"; if (opLinha2) opLinha2.style.display = "flex"; if (opLinha1) opLinha1.style.display = "flex";
        if (jogLinha3) jogLinha3.style.display = "flex"; if (jogLinha2) jogLinha2.style.display = "flex"; if (jogLinha1) jogLinha1.style.display = "flex";
        opMugics.forEach(m => m.style.display = "block"); jogMugics.forEach(m => m.style.display = "block");
    } else if (modo === "3x3") {
        if (opLinha3) opLinha3.style.display = "none"; if (opLinha2) opLinha2.style.display = "flex"; if (opLinha1) opLinha1.style.display = "flex";
        if (jogLinha3) jogLinha3.style.display = "none"; if (jogLinha2) jogLinha2.style.display = "flex"; if (jogLinha1) jogLinha1.style.display = "flex";
        if(jogLinha2) jogLinha2.style.marginTop = "10px"; if(opLinha2) opLinha2.style.marginTop = "10px";
        opMugics.forEach((m, i) => m.style.display = i >= 3 ? "none" : "block");
        jogMugics.forEach((m, i) => m.style.display = i >= 3 ? "none" : "block");
    } else if (modo.includes("1x1")) {
        if (opLinha3) opLinha3.style.display = "none"; if (opLinha2) opLinha2.style.display = "none"; if (opLinha1) opLinha1.style.display = "flex";
        if (jogLinha3) jogLinha3.style.display = "none"; if (jogLinha2) jogLinha2.style.display = "none"; if (jogLinha1) jogLinha1.style.display = "flex";
        if(jogLinha1) jogLinha1.style.marginTop = "2px"; if(opLinha1) opLinha1.style.marginTop = "2px";
        opMugics.forEach((m, i) => m.style.display = i >= 1 ? "none" : "block");
        jogMugics.forEach((m, i) => m.style.display = i >= 1 ? "none" : "block");
    }
}

window.expandirDeckParaOnline = function(deckIds) {
    let deckExpandido = { nome: deckIds.nome, modo: deckIds.modo };
    
    // 🔥 TRADUTOR FLEXÍVEL: Ele não descarta o array se encontrar um null, ele mantém a posição!
    let expandirArray = (arr) => {
        if (!arr) return [];
        // Converte o objeto/array do Firebase em um array real mantendo os índices
        let lista = Array.isArray(arr) ? arr : Object.values(arr);
        return lista.map(id => id ? window.inventario.find(c => String(c.id) === String(id)) || null : null);
    };
    
    deckExpandido.criaturas_objs = expandirArray(deckIds.criaturas);
    deckExpandido.equipamentos_objs = expandirArray(deckIds.equipamentos);
    deckExpandido.ataques_objs = expandirArray(deckIds.ataques);
    deckExpandido.locais_objs = expandirArray(deckIds.locais);
    deckExpandido.mugics_objs = expandirArray(deckIds.mugics);
    
    return deckExpandido;
};
function iniciarPartidaDrome(salaId, souP1) {
    clearInterval(window._timerFila);
    window.estadoDrome.naFila = false;
    document.getElementById("tela-entrada-drome").style.display = "none";
    window.ajustarTabuleiroBatalha(window.estadoDrome.modo);
    if (typeof window.carregarDeckParaBatalha === "function") {
        window.carregarDeckParaBatalha(salaId, souP1); 
    }
    document.getElementById("tela-batalha").style.display = "flex";
    window.modoMenu = false;
    window.mostrarMensagemScanner("⚔️ ARENA PRONTA!");
}

function renderizarFilaOnline() {
    let tela = document.getElementById("tela-entrada-drome");
    window.estadoDrome.naFila = true;
    let modo = window.estadoDrome.modo;
    let uid = localStorage.getItem("chaoticUID");
    let filaPath = 'fila_drome/' + modo; 
    tela.innerHTML = `
        <p class="titulo-tela" style="margin-top:30px;font-size:14px;letter-spacing:2px;">⚔️ DROME ONLINE ⚔️</p>
        <p style="color:#4CAF50;font-size:10px;margin-bottom:40px;font-family:monospace;">MODO ${modo.toUpperCase()} · <span id="nome-deck-fila"></span></p>
        <div style="display:flex;flex-direction:column;align-items:center;gap:20px;">
            <div style="width:80px;height:80px;border:4px solid #4CAF50;border-top-color:transparent;border-radius:50%;animation:girar 1s linear infinite;"></div>
            <p class="texto-carregando" style="font-size:13px;">Procurando adversário...</p>
            <p id="tempo-fila" style="color:#555;font-size:10px;font-family:monospace;">00:00</p>
        </div>
        <button class="btn-voltar-pequeno" style="margin-top:40px;border-color:#e53935;color:#e53935;" onclick="window.cancelarFila()">Cancelar e Voltar</button>
        <style>@keyframes girar{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}</style>
    `;
    // Saved Deck names are user-controlled and must never be parsed as HTML.
    const nomeDeckFila = document.getElementById("nome-deck-fila");
    if (nomeDeckFila) nomeDeckFila.textContent = String(window.estadoDrome.deckSelecionado?.nome || "Deck Sem Nome");
    let s = 0;
    window._timerFila = setInterval(() => {
        s++;
        let el = document.getElementById("tempo-fila");
        if (el) el.innerText = String(Math.floor(s/60)).padStart(2,'0') + ":" + String(s%60).padStart(2,'0');
    }, 1000);
    let deckPronto = window.expandirDeckParaOnline(window.estadoDrome.deckSelecionado);
    window._dbOn('jogadores/' + uid + '/match_drome', snap => {
        if (!snap.exists() || !window.estadoDrome.naFila) return;
        let match = snap.val();
        window.cancelarFila(); 
        window._dbRemove('jogadores/' + uid + '/match_drome'); 
        iniciarPartidaDrome(match.salaId, false); 
    });
    window._dbSet(filaPath + '/' + uid, { uid, nome: window.perfilJogador.nome, deck: deckPronto, timestamp: Date.now() });
    window._dbOn(filaPath, snapshot => {
        if (!snapshot.exists() || !window.estadoDrome.naFila) return;
        let lista = Object.entries(snapshot.val()).sort((a,b) => a[1].timestamp - b[1].timestamp);
        if (lista.length >= 2) {
            let p1 = lista[0], p2 = lista[1];
            if (p1[0] === uid) {
                let salaId = "online_" + p1[0] + "_" + p2[0];
                window._dbRemove(filaPath + '/' + p1[0]); window._dbRemove(filaPath + '/' + p2[0]);
                window._dbSet('salas_drome/' + salaId, { p1: {uid:p1[0],nome:p1[1].nome,deck:p1[1].deck}, p2: {uid:p2[0],nome:p2[1].nome,deck:p2[1].deck}, modo: modo, status: "iniciando" });
                window._dbSet('jogadores/' + p2[0] + '/match_drome', { salaId: salaId });
                window.cancelarFila(); iniciarPartidaDrome(salaId, true); 
            }
        }
    });
}

window.cancelarFila = function() {
    window.estadoDrome.naFila = false;
    clearInterval(window._timerFila);
    let uid = localStorage.getItem("chaoticUID");
    _dbRemove('fila_drome/' + window.estadoDrome.modo + '/' + uid);
    window.renderizarPassoEscolhaDeck();
};

function renderizarPassoEscolhaAmigo() {
    let tela = document.getElementById("tela-entrada-drome");
    let amigos = window.amigos || [];
    tela.innerHTML = `
        <p class="titulo-tela" style="margin-top:20px;font-size:14px;letter-spacing:2px;">⚔️ DESAFIAR AMIGO ⚔️</p>
        <p style="color:#4CAF50;font-size:10px;margin-bottom:20px;font-family:monospace;">MODO <span id="modo-amigo-drome"></span> · <span id="deck-amigo-drome"></span></p>
        <div id="lista-amigos-drome" style="display:flex;flex-direction:column;gap:10px;width:85%;margin-bottom:10px;">
            ${amigos.length === 0 ? '<p style="color:#555;font-size:10px;text-align:center;">Nenhum amigo na lista.</p>' : ''}
        </div>
        <button class="btn-voltar-pequeno" style="margin-top:20px;" onclick="window.renderizarPassoEscolhaDeck()">← Voltar</button>
    `;
    // The selected deck name comes from player storage and must never be parsed as markup.
    const modoAmigo = document.getElementById("modo-amigo-drome");
    const deckAmigo = document.getElementById("deck-amigo-drome");
    if (modoAmigo) modoAmigo.textContent = String(window.estadoDrome.modo || "").toUpperCase();
    if (deckAmigo) deckAmigo.textContent = String(window.estadoDrome.deckSelecionado?.nome || "Deck Sem Nome");
    let lista = document.getElementById("lista-amigos-drome");
    amigos.forEach((amigo, i) => {
        // Friend profiles are remote data: never interpolate names or avatars
        // into innerHTML (including CSS url() and inline onclick attributes).
        const div = document.createElement("div");
        div.style.cssText = "background:#112211;border:1px solid #4CAF50;border-radius:8px;padding:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;";
        const identity = document.createElement("div");
        identity.style.cssText = "display:flex;align-items:center;gap:10px;min-width:0;";
        const avatar = document.createElement("div");
        avatar.style.cssText = "width:35px;height:35px;background:#000;border-radius:50%;border:2px solid #4CAF50;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;overflow:hidden;";
        const avatarValue = typeof amigo.avatar === "string" ? amigo.avatar : "";
        if (/^https:\/\//i.test(avatarValue)) {
            const img = document.createElement("img");
            img.alt = "";
            img.loading = "lazy";
            img.referrerPolicy = "no-referrer";
            img.style.cssText = "width:100%;height:100%;object-fit:cover;";
            img.src = avatarValue;
            avatar.appendChild(img);
        } else {
            avatar.textContent = avatarValue.slice(0, 2) || "👤";
        }
        const info = document.createElement("div");
        info.style.cssText = "text-align:left;min-width:0;";
        const name = document.createElement("div");
        name.style.cssText = "color:#fff;font-size:11px;font-weight:bold;overflow-wrap:anywhere;";
        name.textContent = String(amigo.nome || "Jogador");
        const status = document.createElement("div");
        status.style.cssText = "color:#4CAF50;font-size:9px;";
        status.textContent = "Amigo";
        info.append(name, status);
        identity.append(avatar, info);
        const challenge = document.createElement("button");
        challenge.type = "button";
        challenge.style.cssText = "background:#e53935;color:white;border:none;padding:8px 12px;border-radius:5px;font-weight:bold;cursor:pointer;font-size:10px;flex-shrink:0;";
        challenge.textContent = "DESAFIAR";
        challenge.addEventListener("click", () => window.desafiarAmigoDrome(i));
        div.append(identity, challenge);
        lista.appendChild(div);
    });
}

window.desafiarAmigoDrome = function(index) {
    let amigo = window.amigos[index];
    let uid = localStorage.getItem("chaoticUID");
    let salaId = "drome_" + uid + "_" + amigo.uid;
    let deckPronto = window.expandirDeckParaOnline(window.estadoDrome.deckSelecionado);
    _dbSet('salas_drome/' + salaId, { p1:{uid,nome:window.perfilJogador.nome,deck:deckPronto}, p2:{uid:amigo.uid,nome:amigo.nome,deck:null}, modo:window.estadoDrome.modo, status:"aguardando" });
    _dbSet('jogadores/' + amigo.uid + '/desafio_drome', { de:uid, nome:window.perfilJogador.nome, salaId, modo:window.estadoDrome.modo });
    renderizarAguardandoAmigo(salaId, amigo.nome);
};

function renderizarAguardandoAmigo(salaId, nomeAmigo) {
    let tela = document.getElementById("tela-entrada-drome");
    tela.innerHTML = `
        <p class="titulo-tela" style="margin-top:30px;font-size:14px;letter-spacing:2px;">⚔️ AGUARDANDO ⚔️</p>
        <p id="drome-nome-amigo-aguardando" style="color:#4CAF50;font-size:10px;margin-bottom:40px;font-family:monospace;"></p>
        <div style="display:flex;flex-direction:column;align-items:center;gap:20px;"><div style="font-size:50px;">⚔️</div><p class="texto-carregando" style="font-size:12px;">Aguardando resposta...</p></div>
        <button id="drome-cancelar-desafio" type="button" class="btn-voltar-pequeno" style="margin-top:50px;border-color:#e53935;color:#e53935;">Cancelar Desafio</button>
    `;
    document.getElementById("drome-nome-amigo-aguardando").textContent = "DESAFIO ENVIADO PARA " + String(nomeAmigo || "Jogador").toUpperCase();
    document.getElementById("drome-cancelar-desafio").addEventListener("click", () => window.cancelarDesafioDrome(salaId));
    _dbOn('salas_drome/' + salaId, snapshot => {
        if (!snapshot.exists()) return;
        let sala = snapshot.val();
        if (sala.status === "pronta") iniciarPartidaDrome(salaId, true);
        else if (sala.status === "recusado") { window.mostrarMensagemScanner(nomeAmigo.toUpperCase() + " RECUSOU!"); window.renderizarPassoEscolhaDeck(); }
    });
}

window.cancelarDesafioDrome = function(salaId) {
    _dbUpdate('salas_drome/' + salaId, { status:"cancelado" });
    setTimeout(() => _dbRemove('salas_drome/' + salaId), 2000);
    window.renderizarPassoEscolhaDeck();
};

window.escutarDesafiosDrome = function() {
    let uid = localStorage.getItem("chaoticUID");
    _dbOn('jogadores/' + uid + '/desafio_drome', snapshot => {
        if (!snapshot.exists()) return;
        let desafio = snapshot.val();
        _dbRemove('jogadores/' + uid + '/desafio_drome');
        mostrarModalDesafioDrome(desafio);
    });
};

function mostrarModalDesafioDrome(desafio) {
    if (!document.getElementById("modal-desafio-drome")) {
        let m = document.createElement("div");
        m.id = "modal-desafio-drome";
        m.style.cssText = "display:none;position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,15,0,0.97);z-index:500;justify-content:center;align-items:center;flex-direction:column;padding:20px;box-sizing:border-box;border:2px solid #e53935;";
        document.getElementById("tela-jogo").appendChild(m);
    }
    let m = document.getElementById("modal-desafio-drome");
    // Challenge fields originate from another player's profile/database.
    // Render them as text and bind actions without interpolating into HTML.
    const nome = String(desafio?.nome ?? "Jogador");
    const modo = String(desafio?.modo ?? "");
    const salaId = String(desafio?.salaId ?? "");
    m.replaceChildren();
    const titulo = document.createElement("p");
    titulo.style.cssText = "color:#e53935;font-weight:bold;font-size:16px;margin-bottom:5px;text-align:center;";
    titulo.textContent = "⚔️ DESAFIO RECEBIDO!";
    const remetente = document.createElement("p");
    remetente.style.cssText = "color:#fff;font-size:12px;margin-bottom:5px;text-align:center;";
    remetente.textContent = nome.toUpperCase() + " te desafiou!";
    const descricao = document.createElement("p");
    descricao.style.cssText = "color:#4CAF50;font-size:10px;margin-bottom:25px;text-align:center;";
    descricao.textContent = "Modo: " + modo.toUpperCase();
    const acoes = document.createElement("div");
    acoes.style.cssText = "display:flex;gap:10px;";
    for (const [resposta, rotulo, cor, texto] of [
        ["recusar", "RECUSAR", "#e53935", "white"],
        ["aceitar", "ACEITAR", "#4CAF50", "black"]
    ]) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = rotulo;
        botao.style.cssText = "background:" + cor + ";color:" + texto + ";font-weight:bold;padding:10px 15px;border-radius:5px;cursor:pointer;border:none;font-size:11px;";
        botao.addEventListener("click", () => window.responderDesafioDrome(resposta, salaId, modo));
        acoes.appendChild(botao);
    }
    m.append(titulo, remetente, descricao, acoes);
    m.style.display = "flex";
    if (navigator.vibrate) navigator.vibrate([100,50,100]);
}

window.responderDesafioDrome = function(resposta, salaId, modo) {
    document.getElementById("modal-desafio-drome").style.display = "none";
    if (resposta === 'recusar') {
        _dbUpdate('salas_drome/' + salaId, { status:"recusado" });
    } else {
        window.estadoDrome.tipoJogo = 'amigo';
        window.estadoDrome.modo = modo;
        document.getElementById("tela-menu").style.display = "none";
        document.getElementById("tela-entrada-drome").style.display = "flex";
        window.modoMenu = false;
        window.renderizarPassoEscolhaDeck();
        setTimeout(() => {
            let btn = document.getElementById("btn-jogar-drome");
            if (btn) btn.onclick = () => { 
                let deckPronto = window.expandirDeckParaOnline(window.estadoDrome.deckSelecionado);
                _dbUpdate('salas_drome/' + salaId, { status: "pronta", "p2/deck": deckPronto }); 
                iniciarPartidaDrome(salaId, false); 
            };
        }, 1500);
    }
};

window.voltarMenuDrome = function() {
    document.getElementById("tela-entrada-drome").style.display = "none";
    document.getElementById("tela-menu").style.display = "flex";
    window.modoMenu = true;
    window.estadoDrome = { tipoJogo:null, modo:null, deckSelecionado:null, amigoDesafiado:null, naFila:false };
};

window.selecionarTipoJogo = function(tipo) { 
    window.estadoDrome.tipoJogo = tipo; 
    renderizarPassoModo(); 
};

window.selecionarModo = function(modo) { window.estadoDrome.modo = modo; window.renderizarPassoEscolhaDeck(); };

setTimeout(function() {
    if (window._dbOn && window.escutarDesafiosDrome) window.escutarDesafiosDrome();
}, 1500);
