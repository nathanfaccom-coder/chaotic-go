// Convites privados do DROME — sem iniciar batalhas nem transferir cartas.
(function () {
  "use strict";
  const api = window.ChaoticAuth?.getClient();
  const userId = window.ChaoticAuthUser?.id;
  if (!api || !userId) return;
  let room = null, poll = null, liveChannel = null, busy = false, match = null, declarations = [], board = [];
  const $ = id => document.getElementById(id);
  function halt() {
    if (poll !== null) { clearInterval(poll); poll = null; }
    if (liveChannel) {
      const channel=liveChannel;
      liveChannel=null;
      if(typeof api.removeChannel === "function") api.removeChannel(channel);
      else if(typeof channel.unsubscribe === "function")channel.unsubscribe();
    }
  }
  function note(message, error = false) {
    const label = $("lobby-notice");
    if (label) {
      label.textContent = message;
      label.style.color = error ? "#ff8888" : "#c2ecc5";
    }
  }
  async function rpc(method, args) {
    const { data, error } = await api.rpc(method, args);
    if (error) throw new Error(error.message);
    return data;
  }
  async function action(fn) {
    if (busy) return;
    busy = true;
    const buttons = [...document.querySelectorAll("#tela-entrada-drome button")];
    buttons.forEach(btn => { btn.disabled = true; });
    try { await fn(); }
    catch (error) { note(error.message || "Falha ao conectar com a sala.", true); }
    finally { busy = false; buttons.forEach(btn => { if (btn.isConnected) btn.disabled = false; }); }
  }
  function updateMatchUI() {
    const panel = $("lobby-turns");
    if (!panel) return;
    panel.hidden = !room || (room.status !== "ready" && !match);
    if (!room || panel.hidden) return;
    const active = match?.status === "active" && room.status === "ready"
      && new Date(room.expires_at).getTime() > Date.now();
    $("lobby-turn-state").textContent = !match
      ? "Dois jogadores conectados. O anfitrião pode começar o teste."
      : match.status === "finished" ? "Teste de turnos encerrado."
      : !active ? "Sala encerrada ou expirada. Nenhuma jogada permitida."
      : (match.current_player === userId
        ? "Sua vez de agir. Turno " + match.turn_no + "."
        : "Aguardando a vez do outro jogador. Turno " + match.turn_no + ".");
    $("lobby-turn-count").textContent = match ? String(match.turn_no) : "—";
    updateBoardUI();
    const combatPanel = $("lobby-combat");
    if (combatPanel) {
      combatPanel.hidden = !match;
      const mine = declarations.some(d=>d.actor_id === userId && d.turn_no === match?.turn_no);
      const canAct = active && match.current_player === userId && !mine;
      $("lobby-combat-submit").hidden = !canAct;
      $("lobby-combat-hint").textContent = !active ? "Teste encerrado ou sala indisponível."
        : mine ? "Ação registrada. Passe o turno para continuar."
        : match.current_player !== userId ? "Aguarde seu adversário."
        : "Escolha uma carta do seu deck salvo para registrar uma declaração de teste.";
    }
    // Prévia do tabuleiro: indica o jogador ativo sem modificar o motor DROME.
    const hostTile = $("lobby-board-host"), guestTile = $("lobby-board-guest");
    if (hostTile && guestTile) {
      hostTile.textContent = room.host_id === userId ? "🟩 Você · Anfitrião" : "⬜ Anfitrião";
      guestTile.textContent = room.guest_id === userId ? "🟩 Você · Convidado" : "⬜ Convidado";
      hostTile.style.borderColor = active && match.current_player === room.host_id ? "#86ff9b" : "#315b43";
      guestTile.style.borderColor = active && match.current_player === room.guest_id ? "#86ff9b" : "#315b43";
    }
    $("lobby-turn-start").hidden = !!match || room.host_id !== userId || room.status !== "ready";
    $("lobby-turn-pass").hidden = !active || match.current_player !== userId;
    $("lobby-turn-stop").hidden = !active;
  }
  function updateBoardUI() {
    const box=$("lobby-hex-board");
    if(!box) return;
    box.hidden=!match;
    if(!match || !room) return;
    const mine=board.find(x=>x.actor_id===userId);
    const chosen=declarations.find(x=>x.actor_id===userId && x.kind==="creature");
    const active=match.status==="active" && room.status==="ready"
      && new Date(room.expires_at).getTime()>Date.now();
    const ownTurn=active && match.current_player===userId;
    $("lobby-hex-place").hidden=!(ownTurn && chosen && !mine);
    $("lobby-hex-move").hidden=!(ownTurn && mine && room.mode!=="1x1"
      && mine.moved_turn!==match.turn_no);
    $("lobby-hex-destination").hidden=room.mode==="1x1";
    const hint=$("lobby-hex-message");
    hint.textContent=!chosen
      ?"Primeiro declare uma criatura de um slot do seu deck."
      :!mine
        ?"Posicione a criatura escolhida no slot correspondente (modo 1x1: c6; 3x3: c4–c6; 6x6: c1–c6)."
        :room.mode==="1x1"
          ?"No 1x1, c6 é o único hexágono de cada lado: não existe movimento para casa vazia."
          :ownTurn
            ?"Sua criatura está em c"+mine.position+". Você pode mover uma vez por turno para casa adjacente vazia."
            :"Aguardando sua vez. Posição atual: c"+mine.position+".";
    const positions=room.mode==="1x1"?[6]:room.mode==="3x3"?[4,5,6]:[1,2,3,4,5,6];
    for(const side of ["host","guest"]) {
      const actor=side==="host"?room.host_id:room.guest_id;
      const unit=board.find(x=>x.actor_id===actor);
      for(let n=1;n<=6;n++){
        const hex=$("lobby-hex-"+side+"-"+n);
        if(!hex)continue;
        const enabled=positions.includes(n),occupied=!!unit && unit.position===n;
        hex.hidden=!enabled;
        hex.textContent="c"+n+(occupied?" · #"+unit.card_id:"");
        hex.classList.toggle("ocupado",occupied);
        hex.classList.toggle("sua-vez",occupied && active && actor===match.current_player);
      }
    }
  }
  async function refreshBoard(){
    if(!$("lobby-hex-board"))return;
    if(!room || !match){board=[];updateBoardUI();return;}
    const {data,error}=await api.from("chaotic_preview_board")
      .select("actor_id,card_id,position,moved_turn")
      .eq("lobby_id",room.id);
    if(error)throw new Error(error.message);
    board=data||[];
    updateBoardUI();
  }
  async function refreshDeclarations() {
    const log = $("lobby-combat-history");
    if (!log) return;
    if (!room || !match) {
      declarations=[];
      log.textContent="As escolhas de cartas aparecerão aqui.";
      return;
    }
    const {data,error} = await api.from("chaotic_combat_declarations")
      .select("turn_no,actor_id,kind,deck_slot,card_slot,card_id")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(24);
    if(error) throw new Error(error.message);
    declarations = data || [];
    const rows=declarations.slice().reverse();
    log.textContent=rows.length ? rows.map(x=>{
      const side = x.actor_id===room.host_id ? "Anfitrião" : "Convidado";
      return "T"+x.turn_no+" · "+side+(x.kind==="creature"?" escolheu criatura ":" declarou ataque ")
        +"#"+x.card_id+" (deck "+x.deck_slot+", posição "+x.card_slot+")";
    }).join("\n"):"Nenhuma escolha de carta registrada.";
    $("lobby-combat-host").textContent="Anfitrião: "+(
      declarations.find(x=>x.actor_id===room.host_id && x.kind==="creature")?.card_id || "sem criatura"
    );
    $("lobby-combat-guest").textContent="Convidado: "+(
      declarations.find(x=>x.actor_id===room.guest_id && x.kind==="creature")?.card_id || "sem criatura"
    );
    updateMatchUI();
  }
  async function refreshHistory() {
    const log = $("lobby-events");
    if (!log) return;
    if (!room || !match) { log.textContent = "O histórico aparecerá quando o teste começar."; return; }
    const {data,error} = await api.from("chaotic_match_events")
      .select("seq,event_type,turn_no,actor_id,created_at")
      .eq("lobby_id",room.id).order("seq",{ascending:false}).limit(12);
    if (error) throw new Error(error.message);
    const entries = (data || []).slice().reverse();
    log.textContent = entries.length ? entries.map(entry => {
      const side = entry.actor_id === room.host_id ? "Anfitrião" : "Convidado";
      if (entry.event_type === "start") return "⚔️ "+side+" iniciou o teste";
      if (entry.event_type === "stop") return "⏹️ "+side+" encerrou o teste";
      return "↪ "+side+" passou o turno "+(entry.turn_no - 1);
    }).join("\n") : "Nenhum evento registrado.";
  }
  async function refreshMatch() {
    if (!room) { match = null; updateMatchUI(); return; }
    const {data,error} = await api.from("chaotic_match_turns")
      .select("lobby_id,host_id,guest_id,status,current_player,turn_no,last_player,updated_at")
      .eq("lobby_id",room.id).maybeSingle();
    if (error) throw new Error(error.message);
    match = data; updateMatchUI();
    await refreshHistory();
    await refreshDeclarations();
    await refreshBoard();
  }
  function updateRoomUI() {
    if (!$("lobby-create")) return;
    const panel = $("lobby-current"), creation = $("lobby-create"), join = $("lobby-join");
    panel.hidden = !room; creation.hidden = !!room; join.hidden = !!room;
    if (!room) return;
    $("lobby-room-code").textContent = room.code;
    $("lobby-mode").textContent = room.mode;
    $("lobby-status").textContent = room.status === "ready"
      ? "✅ Dois jogadores conectados. Batalha ainda em desenvolvimento."
      : room.status === "cancelled" ? "Sala encerrada."
      : new Date(room.expires_at).getTime() <= Date.now() ? "Sala expirada. Crie outra."
      : "Aguardando outro jogador entrar com o código...";
    $("lobby-close").textContent = room.host_id === userId ? "Encerrar sala" : "Sair da sala";
    updateMatchUI();
    if (room.status === "cancelled" || new Date(room.expires_at).getTime() <= Date.now()) halt();
  }
  async function refreshRoom() {
    if (!room || !$("lobby-current")) { halt(); return; }
    const { data, error } = await api.from("chaotic_lobbies")
      .select("id,code,host_id,guest_id,mode,status,expires_at")
      .eq("id", room.id).maybeSingle();
    if (error) { note("Falha ao atualizar sala: " + error.message, true); return; }
    if (!data) { room = null; halt(); updateRoomUI(); note("Sala não encontrada."); return; }
    room = data; updateRoomUI();
    await refreshMatch();
  }
  function watch() {
    halt();
    if (room && typeof api.channel === "function") {
      const lobbyId = room.id;
      const sync = () => {
        if (room?.id !== lobbyId) return;
        refreshRoom().catch(error=>note("Erro ao sincronizar sala: "+error.message,true));
      };
      // A mesma sala acompanha presença, turno, histórico e cartas declaradas.
      liveChannel=api.channel("chaotic-drome-"+lobbyId+"-"+userId)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_lobbies",filter:"id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_match_turns",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_match_events",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_combat_declarations",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_board",filter:"lobby_id=eq."+lobbyId
        },sync)
        .subscribe(status=>{
          if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")
            console.warn("DROME: canal em tempo real temporariamente indisponível; consultas periódicas seguem ativas.");
        });
    }
    // Plano B para celular sem conexão Realtime ou serviço suspenso em segundo plano.
    poll = setInterval(() => {
      if (!$("lobby-current") || $("tela-entrada-drome")?.style.display !== "flex") { halt(); return; }
      refreshRoom().catch(error => note(error.message, true));
    }, 6000);
  }
  function show() {
    halt(); room = null; match = null; declarations = []; board = [];
    const screen = $("tela-entrada-drome");
    if (!screen) return;
    $("tela-menu").style.display = "none";
    screen.style.display = "flex";
    window.modoMenu = false;
    screen.innerHTML = [
      '<div class="lobby-test">',
      '<h3>🔐 SALA PRIVADA</h3>',
      '<p>Convite por código — teste de conexão. Nenhuma batalha ou troca acontece aqui.</p>',
      '<div id="lobby-create">',
      '<label for="lobby-select-mode">Modo da sala</label>',
      '<select id="lobby-select-mode"><option value="1x1">1x1 Duelo</option>',
      '<option value="3x3">3x3 Rápido</option><option value="6x6">6x6 Principal</option></select>',
      '<button id="lobby-create-btn" type="button">Criar sala</button></div>',
      '<div id="lobby-join"><label for="lobby-input-code">Código recebido de outro jogador</label>',
      '<input id="lobby-input-code" type="text" maxlength="12" autocomplete="off"',
      ' autocapitalize="characters" placeholder="12 caracteres" aria-label="Código de convite">',
      '<button id="lobby-join-btn" type="button">Entrar pelo código</button></div>',
      '<div id="lobby-current" hidden><p>Modo: <strong id="lobby-mode"></strong></p>',
      '<p>Código: <strong id="lobby-room-code"></strong></p>',
      '<p id="lobby-status" role="status"></p>',
      '<section id="lobby-turns" class="lobby-turns" hidden>',
      '<strong>⚔️ SINCRONIZAÇÃO DE TURNOS — TESTE</strong>',
      '<p>Não utiliza cartas nem decide vitórias.</p>',
      '<p id="lobby-turn-state" role="status"></p>',
      '<p>Turno: <b id="lobby-turn-count">—</b></p>',
      '<div class="lobby-mini-board" role="group" aria-label="Posição dos jogadores">',
      '<div id="lobby-board-host" class="lobby-board-slot">⬜ Anfitrião</div>',
      '<span class="lobby-board-versus">VS</span>',
      '<div id="lobby-board-guest" class="lobby-board-slot">⬜ Convidado</div>',
      '</div>',
      '<section id="lobby-combat" class="lobby-combat" hidden>',
      '<strong>🃏 DECLARAÇÃO DE CARTAS (TESTE)</strong>',
      '<p>Sem dano, efeitos, vitória ou recompensas.</p>',
      '<div class="lobby-card-sides"><span id="lobby-combat-host">Anfitrião: sem criatura</span>',
      '<span id="lobby-combat-guest">Convidado: sem criatura</span></div>',
      '<label for="lobby-combat-kind">Ação</label>',
      '<select id="lobby-combat-kind"><option value="creature">Escolher criatura</option>',
      '<option value="attack">Declarar ataque</option></select>',
      '<label for="lobby-combat-deck">Slot do deck salvo</label>',
      '<select id="lobby-combat-deck"><option value="1">Deck 1</option>',
      '<option value="2">Deck 2</option><option value="3">Deck 3</option></select>',
      '<label for="lobby-combat-slot">Posição da carta nesse deck</label>',
      '<input type="number" id="lobby-combat-slot" min="1" max="20" step="1" value="1">',
      '<p id="lobby-combat-hint" role="status"></p>',
      '<button type="button" id="lobby-combat-submit" hidden>Registrar escolha</button>',
      '<p class="lobby-history-label">Histórico das escolhas</p>',
      '<p id="lobby-combat-history" class="lobby-events" aria-live="polite">Nenhuma.</p>',
      '</section>',
      '<section id="lobby-hex-board" class="lobby-hex-board" hidden>',
      '<strong>🛡️ TABULEIRO COMPARTILHADO — MOVIMENTO DE TESTE</strong>',
      '<p>Somente posição. Ataques, equipamentos e efeitos continuam no motor original.</p>',
      '<p class="lobby-history-label">Área do anfitrião</p>',
      '<div class="lobby-hex-row">',
      ...[1,2,3,4,5,6].map(n=>'<span id="lobby-hex-host-'+n+'" class="lobby-hex">c'+n+'</span>'),
      '</div>',
      '<p class="lobby-history-label">Área do convidado</p>',
      '<div class="lobby-hex-row">',
      ...[1,2,3,4,5,6].map(n=>'<span id="lobby-hex-guest-'+n+'" class="lobby-hex">c'+n+'</span>'),
      '</div>',
      '<p id="lobby-hex-message" role="status"></p>',
      '<button id="lobby-hex-place" type="button" hidden>Posicionar minha criatura</button>',
      '<label for="lobby-hex-destination">Destino da movimentação</label>',
      '<select id="lobby-hex-destination"><option value="1">c1</option><option value="2">c2</option>',
      '<option value="3">c3</option><option value="4">c4</option>',
      '<option value="5">c5</option><option value="6">c6</option></select>',
      '<button id="lobby-hex-move" type="button" hidden>Mover para a casa escolhida</button>',
      '</section>',
      '<p class="lobby-history-label">📜 Histórico de turnos</p>',
      '<p id="lobby-events" class="lobby-events" aria-live="polite">Aguardando início.</p>',
      '<button id="lobby-turn-start" type="button" hidden>Iniciar teste de turnos</button>',
      '<button id="lobby-turn-pass" type="button" hidden>Passar meu turno</button>',
      '<button id="lobby-turn-stop" class="lobby-danger" type="button" hidden>Encerrar teste</button>',
      '<button id="lobby-turn-refresh" class="lobby-outline" type="button">Atualizar turnos</button>',
      '</section>',
      '<button id="lobby-copy" type="button">Copiar convite</button>',
      '<button id="lobby-refresh" type="button">Atualizar status</button>',
      '<button id="lobby-close" class="lobby-danger" type="button">Encerrar sala</button></div>',
      '<p id="lobby-notice" role="status" aria-live="polite"></p>',
      '<button id="lobby-back" class="lobby-outline" type="button">Voltar ao DROME</button>',
      '</div>'
    ].join("");
    // Usa por padrão os slots da linha correta no tabuleiro original.
    // Ataques usam a posição da carta no baralho (1–20), não a posição de criatura.
    function setDefaultCreatureSlot() {
      const slot=$("lobby-combat-slot");
      if(slot)slot.value=room?.mode==="1x1"?"6":room?.mode==="3x3"?"4":"1";
    }
    $("lobby-combat-kind").onchange = () => {
      if($("lobby-combat-kind").value==="creature")setDefaultCreatureSlot();
      else $("lobby-combat-slot").value="1";
    };
    $("lobby-create-btn").onclick = () => action(async () => {
      note("Criando sala...");
      const mode = $("lobby-select-mode").value;
      if (!["1x1","3x3","6x6"].includes(mode)) throw new Error("Modo inválido");
      room = await rpc("chaotic_create_lobby", { p_mode: mode });
      setDefaultCreatureSlot();
      updateRoomUI(); watch(); note("Sala criada. Compartilhe o código com outro jogador.");
    });
    $("lobby-join-btn").onclick = () => action(async () => {
      const code = $("lobby-input-code").value.trim().toUpperCase();
      if (!/^[A-F0-9]{12}$/.test(code)) throw new Error("Digite um código de 12 caracteres válido.");
      note("Entrando na sala...");
      room = await rpc("chaotic_join_lobby", { p_code: code });
      setDefaultCreatureSlot();
      updateRoomUI(); watch(); note("Você entrou na sala. O anfitrião será avisado.");
    });
    $("lobby-copy").onclick = () => action(async () => {
      if (!room) return;
      const invite = "Convite Chaotic GO (" + room.mode + "): " + room.code
        + " — Entre em DROME > Sala privada e informe este código.";
      if (!navigator.clipboard?.writeText) throw new Error("Cópia indisponível neste navegador.");
      await navigator.clipboard.writeText(invite);
      note("Convite copiado!");
    });
    $("lobby-refresh").onclick = () => action(refreshRoom);
    $("lobby-turn-refresh").onclick = () => action(refreshRoom);
    $("lobby-hex-place").onclick = () => action(async()=>{
      if(!room || !match || match.status!=="active" || match.current_player!==userId)return;
      await rpc("chaotic_place_preview_creature",{p_lobby_id:room.id,p_expected_turn:match.turn_no});
      await refreshBoard();
      note("Criatura posicionada no tabuleiro de teste. Agora pode passar a vez.");
    });
    $("lobby-hex-move").onclick = () => action(async()=>{
      if(!room || !match || match.status!=="active" || match.current_player!==userId)return;
      const target=Number($("lobby-hex-destination").value);
      if(!Number.isInteger(target) || target<1 || target>6)throw Error("Escolha um hexágono válido.");
      await rpc("chaotic_move_preview_creature",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no,p_target_slot:target
      });
      await refreshBoard();
      note("Movimento aceito pelo servidor. A criatura mudou de posição.");
    });
    $("lobby-combat-submit").onclick = () => action(async()=>{
      if(!room || !match || match.status!=="active" || match.current_player!==userId) return;
      const kind=$("lobby-combat-kind").value;
      const deck=Number($("lobby-combat-deck").value);
      const slot=Number($("lobby-combat-slot").value);
      if(!["creature","attack"].includes(kind) || ![1,2,3].includes(deck)
        || !Number.isInteger(slot) || slot<1 || slot>20) {
        throw new Error("Escolha uma ação e posições válidas.");
      }
      const chosen=await rpc("chaotic_declare_combat_action",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no,p_kind:kind,
        p_deck_slot:deck,p_card_slot:slot
      });
      await refreshDeclarations();
      note("Servidor registrou "+(chosen.kind==="creature"?"criatura ":"ataque ")+"#"+chosen.card_id
        +". Agora você pode passar o turno.");
    });
    $("lobby-turn-start").onclick = () => action(async () => {
      if (!room || room.host_id !== userId || room.status !== "ready") return;
      match = await rpc("chaotic_start_match", { p_lobby_id: room.id });
      updateMatchUI();
      await refreshHistory();
      note("Teste de turnos iniciado. O anfitrião começa.");
    });
    $("lobby-turn-pass").onclick = () => action(async () => {
      if (!room || !match || match.status !== "active" || match.current_player !== userId) return;
      // O servidor rejeita turnos antigos e ações de quem não está jogando.
      match = await rpc("chaotic_pass_turn", { p_lobby_id: room.id, p_expected_turn: match.turn_no });
      updateMatchUI();
      await refreshHistory();
      note("Turno registrado. O outro jogador já pode agir.");
    });
    $("lobby-turn-stop").onclick = () => action(async () => {
      if (!room || match?.status !== "active") return;
      match = await rpc("chaotic_stop_match", { p_lobby_id: room.id });
      updateMatchUI();
      await refreshHistory();
      note("Teste encerrado sem alterar cartas nem estatísticas.");
    });
    $("lobby-close").onclick = () => action(async () => {
      if (!room) return;
      const method = room.host_id === userId ? "chaotic_close_lobby" : "chaotic_leave_lobby";
      const success = await rpc(method, { p_id: room.id });
      if (!success) throw new Error("A sala já pode ter sido encerrada. Atualize.");
      halt(); room = null; match = null; updateRoomUI(); note("Você saiu da sala.");
    });
    $("lobby-back").onclick = () => {
      halt();
      if (room && room.status !== "cancelled") {
        note("Use Encerrar/Sair da sala antes de voltar.", true);
        return;
      }
      if (typeof window.abrirEntradaDrome === "function") window.abrirEntradaDrome();
    };
    updateMatchUI();
    note("Salas privadas expiram após duas horas.");
  }
  window.abrirSalaPrivadaDrome = show;
})();