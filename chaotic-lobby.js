// Convites privados do DROME — sem iniciar batalhas nem transferir cartas.
(function () {
  "use strict";
  const api = window.ChaoticAuth?.getClient();
  const userId = window.ChaoticAuthUser?.id;
  if (!api || !userId) return;
  let room = null, poll = null, liveChannel = null, busy = false, match = null, declarations = [], board = [], clashes = [], baseDamage = [], modifiers = [], dice = [], loadouts = [];
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
    updateClashUI();
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
  // Conexões entre lados extraídas de batalha.js/obterAdjacencias.
  // Mesmo mapa para anfitrião e convidado: os pares são simétricos.
  function contactBetweenSides(mode,source,target) {
    const a=Number(source),b=Number(target);
    if(!Number.isInteger(a)||!Number.isInteger(b))return false;
    if(mode==="1x1")return a===6 && b===6;
    if(mode==="3x3")return [4,5].includes(a)&&[4,5].includes(b);
    if(mode==="6x6")return (a===1&&[2,3].includes(b))
      || (a===2&&[1,2,3].includes(b))
      || (a===3&&[1,2].includes(b));
    return false;
  }
  window.chaoticPreviewContact=contactBetweenSides;
  function updateClashUI(){
    const panel=$("lobby-clash-panel");
    if(!panel)return;
    panel.hidden=!room || !match;
    if(panel.hidden)return;
    const mine=board.find(x=>x.actor_id===userId);
    const other=board.find(x=>x.actor_id!==userId);
    const attack=declarations.find(x=>x.actor_id===userId&&x.turn_no===match.turn_no&&x.kind==="attack");
    const already=clashes.some(x=>x.turn_no===match.turn_no);
    const myTurn=match.status==="active"&&room.status==="ready"&&
      match.current_player===userId&&new Date(room.expires_at).getTime()>Date.now();
    const adjacent=!!mine&&!!other&&contactBetweenSides(room.mode,mine.position,other.position);
    $("lobby-clash-open").hidden=!(myTurn&&attack&&adjacent&&!already);
    const clashToCalculate=clashes.find(x=>x.turn_no===match.turn_no && x.attacker_id===userId);
    $("lobby-damage-calculate").hidden=!(myTurn&&clashToCalculate &&
      !baseDamage.some(x=>x.turn_no===match.turn_no));
    $("lobby-modifiers-calculate").hidden=!(myTurn&&clashToCalculate &&
      baseDamage.some(x=>x.turn_no===match.turn_no) &&
      !modifiers.some(x=>x.turn_no===match.turn_no));
    $("lobby-dice-roll").hidden=!(myTurn && clashToCalculate &&
      modifiers.some(x=>x.turn_no===match.turn_no && x.formula_status==="roll_or_special_required"
        && x.attack_card_id==="104") &&
      !dice.some(x=>x.turn_no===match.turn_no));
    const label=$("lobby-clash-status");
    label.textContent=already?"Confronto deste turno registrado. Dano ainda não é aplicado."
      :!myTurn?"Aguarde a sua vez para declarar um confronto."
      :!mine||!other?"Os dois jogadores precisam posicionar uma criatura."
      :!adjacent?"Sem contato entre os lados. Aproxime sua criatura até a linha de combate."
      :!attack?"Declare uma carta de ataque do seu deck neste turno."
      :"Confronto permitido: use o botão para registrar a intenção no servidor.";
  }
  function showOfficialCard(side,unit){
    const img=$("lobby-official-"+side+"-img"),label=$("lobby-official-"+side+"-text");
    if(!img||!label)return;
    const record=(window.ChaoticOriginalCards?.creatures||[])
      .find(c=>String(c.id)===String(unit?.card_id));
    img.hidden=!record?.cartaBlank;
    if(record?.cartaBlank)img.src=record.cartaBlank;
    label.textContent=record
      ?record.nome+" · Energia base "+(record.statsMax?.energia??"—")+" · "+(record.tribo||"")
      :unit?"Carta #"+unit.card_id+" · c"+unit.position:"Sem criatura posicionada";
  }
  async function refreshDice(){
    const log=$("lobby-dice-history");
    if(!log)return;
    if(!room||!match){dice=[];log.textContent="Nenhum dado rolado.";return;}
    const {data,error}=await api.from("chaotic_preview_dice")
      .select("turn_no,actor_id,attack_id,die_faces,rolled_value,original_base,multiplied_base")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(12);
    if(error)throw new Error(error.message);
    dice=data||[];
    log.textContent=dice.length?dice.slice().reverse().map(x=>{
      const who=x.actor_id===room.host_id?"Anfitrião":"Convidado";
      return "Turno "+x.turn_no+" · "+who+" 🎲 "+x.rolled_value+
        " de "+x.die_faces+" · dano base "+x.original_base+
        " × "+x.rolled_value+" = "+x.multiplied_base+
        " (antes dos demais efeitos; HP inalterado).";
    }).join("\n"):"Nenhum dado rolado.";
    updateClashUI();
  }
  async function refreshModifiers(){
    const log=$("lobby-modifiers-history");
    if(!log)return;
    if(!room||!match){modifiers=[];log.textContent="Nenhuma conferência de bônus.";return;}
    const {data,error}=await api.from("chaotic_preview_modifiers")
      .select("turn_no,attacker_id,attack_card_id,base_damage,elemental_bonus,attribute_bonus,reference_subtotal,formula_status")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(12);
    if(error)throw new Error(error.message);
    modifiers=data||[];
    log.textContent=modifiers.length?modifiers.slice().reverse().map(x=>{
      const who=x.attacker_id===room.host_id?"Anfitrião":"Convidado";
      if(x.formula_status==="roll_or_special_required")
        return "Turno "+x.turn_no+" · "+who+": ataque "+x.attack_card_id+
          " exige dado/efeito especial. Dano total NÃO calculado.";
      if(x.formula_status!=="reference_only")
        return "Turno "+x.turn_no+" · "+who+": carta não identificada ("+x.formula_status+").";
      return "Turno "+x.turn_no+" · "+who+": base "+x.base_damage+
        " + elemental "+x.elemental_bonus+" + atributo "+x.attribute_bonus+
        " = "+x.reference_subtotal+" (referência do catálogo; NÃO é dano final).";
    }).join("\n"):"Nenhuma conferência de bônus.";
    updateClashUI();
  }
  async function refreshBaseDamage(){
    const log=$("lobby-damage-history");
    if(!log)return;
    if(!room||!match){baseDamage=[];log.textContent="Sem cálculos.";return;}
    const {data,error}=await api.from("chaotic_preview_damage")
      .select("turn_no,attacker_id,attack_card_id,attack_name,base_damage,defender_name,defender_energy_base,energy_after_base,calculation_status")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(12);
    if(error)throw new Error(error.message);
    baseDamage=data||[];
    log.textContent=baseDamage.length?baseDamage.slice().reverse().map(x=>{
      const who=x.attacker_id===room.host_id?"Anfitrião":"Convidado";
      if(x.calculation_status==="ambiguous_attack_id")
        return "Turno "+x.turn_no+" · "+who+": ID "+x.attack_card_id+
          " duplicado no catálogo original. Cálculo bloqueado para preservar as duas cartas.";
      if(x.calculation_status!=="base_only")
        return "Turno "+x.turn_no+" · "+who+": referência não identificada ("+x.calculation_status+").";
      if(x.attack_card_id==="104")
        return "Turno "+x.turn_no+" · "+who+" · Fogo Primordial 2.0: 5 de dano BASE, mas o efeito exige rolagem de dado. Energia NÃO calculada.";
      return "Turno "+x.turn_no+" · "+who+" · "+x.attack_name+
        ": dano BASE "+x.base_damage+" · "+x.defender_name+
        " (energia base "+x.defender_energy_base+
        " → "+x.energy_after_base+" APENAS se não houver modificadores).";
    }).join("\n"):"Nenhum dano base calculado.";
    updateClashUI();
  }
  async function refreshClashes(){
    const log=$("lobby-clash-history");
    if(!log)return;
    if(!room||!match){clashes=[];log.textContent="Sem confrontos.";updateClashUI();return;}
    const {data,error}=await api.from("chaotic_preview_clashes")
      .select("turn_no,attacker_id,defender_id,attacker_card,defender_card,attack_card,attacker_position,defender_position,result")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(12);
    if(error)throw new Error(error.message);
    clashes=data||[];
    log.textContent=clashes.length?clashes.slice().reverse().map(e=>{
      const side=e.attacker_id===room.host_id?"Anfitrião":"Convidado";
      const attackMatches=(window.ChaoticOriginalCards?.attacks||[])
        .filter(c=>String(c.id)===String(e.attack_card));
      const attackLabel=attackMatches.length===1?attackMatches[0].nome:
        attackMatches.length>1?"Ataque #"+e.attack_card+" (ID duplicado)":"Ataque #"+e.attack_card;
      return "Turno "+e.turn_no+" · "+side+": "+attackLabel
        +" (c"+e.attacker_position+" contra c"+e.defender_position+") · resolução pendente";
    }).join("\n"):"Nenhum confronto registrado.";
    updateClashUI();
  }
  function updateLoadoutUI(){
    const panel=$("lobby-loadout-panel");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden)return;
    const mine=board.find(x=>x.actor_id===userId);
    const has=loadouts.some(x=>x.actor_id===userId);
    const ownTurn=match.status==="active"&&room.status==="ready"&&
      match.current_player===userId&&new Date(room.expires_at).getTime()>Date.now();
    $("lobby-loadout-capture").hidden=!(ownTurn&&mine&&!has);
    const read=(actor,side)=>{
      const record=loadouts.find(x=>x.actor_id===actor);
      const label=$("lobby-loadout-"+side);
      if(!label)return;
      if(!record){label.textContent="Ainda sem ficha individual.";return;}
      const t=record.stats||{};
      label.textContent=record.creature_name+
        " · Energia "+t.e+" | Coragem "+t.c+" | Poder "+t.p+
        " | Sabedoria "+t.s+" | Velocidade "+t.v+
        (record.equipment_name?" · Equipamento: "+record.equipment_name:" · Sem equipamento");
    };
    read(room.host_id,"host");
    read(room.guest_id,"guest");
  }
  async function refreshLoadouts(){
    if(!$("lobby-loadout-panel"))return;
    if(!room||!match){loadouts=[];updateLoadoutUI();return;}
    const {data,error}=await api.from("chaotic_preview_loadouts")
      .select("actor_id,card_instance_id,creature_name,tribe,position,stats,equipment_name")
      .eq("lobby_id",room.id);
    if(error)throw new Error(error.message);
    loadouts=data||[];
    updateLoadoutUI();
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
    showOfficialCard("host",board.find(x=>x.actor_id===room.host_id));
    showOfficialCard("guest",board.find(x=>x.actor_id===room.guest_id));
    updateBoardUI();
    updateClashUI();
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
    await refreshLoadouts();
    await refreshClashes();
    await refreshBaseDamage();
    await refreshModifiers();
    await refreshDice();
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
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_clashes",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_damage",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_modifiers",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_dice",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_loadouts",filter:"lobby_id=eq."+lobbyId
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
    halt(); room = null; match = null; declarations = []; board = []; clashes = []; baseDamage = []; modifiers = []; dice = []; loadouts = [];
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
      '<section id="lobby-loadout-panel" class="lobby-combat" hidden>',
      '<strong>🧬 FICHAS INDIVIDUAIS — 1x1 (TESTE)</strong>',
      '<p>A ficha usa os atributos de cada carta salva no álbum, não somente o padrão do catálogo.</p>',
      '<p>Anfitrião: <span id="lobby-loadout-host">Ainda sem ficha individual.</span></p>',
      '<p>Convidado: <span id="lobby-loadout-guest">Ainda sem ficha individual.</span></p>',
      '<button id="lobby-loadout-capture" type="button" hidden>Preparar ficha da minha criatura</button>',
      '<p>Ficha congelada para este teste; nenhuma energia foi reduzida.</p>',
      '</section>',
      '<section id="lobby-clash-panel" class="lobby-clash-panel" hidden>',
      '<strong>⚔️ ENCONTRO DE CRIATURAS (TESTE)</strong>',
      '<p>Utiliza as posições originais do DROME. O dano e os efeitos ainda não são aplicados.</p>',
      '<div class="lobby-official-cards">',
      '<div class="lobby-official-card"><img id="lobby-official-host-img" alt="Criatura do anfitrião" hidden>',
      '<span id="lobby-official-host-text">Sem criatura</span></div>',
      '<div class="lobby-official-versus">VS</div>',
      '<div class="lobby-official-card"><img id="lobby-official-guest-img" alt="Criatura do convidado" hidden>',
      '<span id="lobby-official-guest-text">Sem criatura</span></div>',
      '</div>',
      '<p id="lobby-clash-status" role="status"></p>',
      '<button id="lobby-clash-open" type="button" hidden>Registrar confronto</button>',
      '<button id="lobby-damage-calculate" type="button" hidden>Conferir dano base no servidor</button>',
      '<p class="lobby-history-label">Prévia do dano (sem aplicar pontos de vida)</p>',
      '<p id="lobby-damage-history" class="lobby-events" aria-live="polite">Nenhum cálculo.</p>',
      '<button id="lobby-modifiers-calculate" type="button" hidden>Conferir bônus elementais e atributos</button>',
      '<p id="lobby-modifiers-history" class="lobby-events" aria-live="polite">Nenhuma conferência de bônus.</p>',
      '<button id="lobby-dice-roll" type="button" hidden>🎲 Rolar dado do Fogo Primordial (servidor)</button>',
      '<p id="lobby-dice-history" class="lobby-events" aria-live="polite">Nenhum dado rolado.</p>',
      '<p class="lobby-history-label">Confrontos registrados</p>',
      '<p id="lobby-clash-history" class="lobby-events" aria-live="polite">Nenhum confronto registrado.</p>',
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
    $("lobby-loadout-capture").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.status!=="active"
        ||match.current_player!==userId)return;
      await rpc("chaotic_capture_preview_loadout",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshLoadouts();
      note("Ficha individual da criatura confirmada no servidor, com equipamento do deck.");
    });
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
    $("lobby-dice-roll").onclick = () => action(async()=>{
      if(!room || !match || match.status!=="active" || match.current_player!==userId)return;
      const outcome=await rpc("chaotic_roll_preview_die",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshDice();
      note("Dado autorizado pelo servidor: "+outcome.rolled_value+
        ". Valor único registrado para os dois jogadores, sem alterar energia.");
    });
    $("lobby-modifiers-calculate").onclick = () => action(async()=>{
      if(!room||!match||match.status!=="active"||match.current_player!==userId)return;
      const result=await rpc("chaotic_preview_calculate_modifiers",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshModifiers();
      note(result.formula_status==="reference_only"
        ?"Bônus de catálogo conferidos; ainda não é dano final e não altera energia."
        :"Carta com efeitos ou referência incompleta: dano final não calculado.");
    });
    $("lobby-damage-calculate").onclick = () => action(async()=>{
      if(!room||!match||match.status!=="active"||match.current_player!==userId)return;
      const result=await rpc("chaotic_preview_calculate_base_damage",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBaseDamage();
      note(result.calculation_status==="base_only"
        ?"Dano BASE conferido pelo servidor. Efeitos e dano final ainda NÃO aplicados."
        :"Cálculo suspenso: referência de carta ambígua ou desconhecida. Nenhuma carta foi alterada.");
    });
    $("lobby-clash-open").onclick = () => action(async()=>{
      if(!room||!match||match.status!=="active"||match.current_player!==userId)return;
      await rpc("chaotic_open_preview_clash",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshClashes();
      note("Encontro validado e registrado no servidor. A resolução de danos segue em desenvolvimento.");
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