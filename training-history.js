// Chaotic GO v0.1.130 — authenticated, RLS-filtered training history.
// The UI reads only server-authenticated completed 3x3 TRAINING outcomes.
// No XP, money, official wins, inventory or wallet mutation is possible here.
(function(){
  "use strict";
  const currentPlayer=window.ChaoticAuthUser?.id;
  const api=window.ChaoticAuth?.getClient?.();
  let requestSerial=0;
  const $=id=>document.getElementById(id);
  async function refresh(){
    const status=$("lobby-history-status");
    const stats=$("lobby-history-stats");
    const list=$("lobby-history-list");
    if(!status||!stats||!list)return;
    const request=++requestSerial;
    stats.textContent="";
    list.replaceChildren();
    if(!api||!currentPlayer){
      status.textContent="Entre na sua conta para consultar o histórico.";
      return;
    }
    status.textContent="Consultando resultados de treino no servidor...";
    try{
      // The table's SELECT-only RLS allows only the winner or defeated player.
      // Display a recent WINDOW, never claim it is an all-time ranking.
      const {data,error}=await api.from("chaotic_training_match_history")
        .select("winner_id,defeated_id,decided_turn,recorded_at,outcome_scope")
        .order("recorded_at",{ascending:false}).limit(30);
      if(request!==requestSerial||$("lobby-history-list")!==list)return;
      if(error)throw error;
      const records=(Array.isArray(data)?data:[]).filter(row=>
        row&&row.outcome_scope==="training_only_no_official_victory"
        &&(row.winner_id===currentPlayer||row.defeated_id===currentPlayer)
        &&Number.isInteger(row.decided_turn)
        &&row.decided_turn>=1&&row.decided_turn<=120
      );
      const wins=records.filter(x=>x.winner_id===currentPlayer).length;
      const losses=records.length-wins;
      stats.textContent="Últimos "+records.length+" resultados: "+wins+
        " vitória(s) de treino e "+losses+" derrota(s) de treino. Limite: 30 registros.";
      if(typeof api.rpc==="function"){
        // A slow lifetime RPC must not repaint a new DROME screen or a newer read.
        const currentList=list,currentRequest=request;
        api.rpc("chaotic_my_training_stats").then(response=>{
          if(currentRequest!==requestSerial||$("lobby-history-list")!==currentList)return;
          if(response?.error)return;
          const raw=Array.isArray(response?.data)?response.data[0]:response?.data;
          if(!raw)return;
          const total=Number(raw.total_matches), careerWins=Number(raw.victories);
          const careerLosses=Number(raw.defeats);
          if(![total,careerWins,careerLosses].every(n=>Number.isSafeInteger(n)&&n>=0)
             ||careerWins+careerLosses!==total)return;
          stats.textContent="Carreira inteira de TREINO: "+total+" partida(s), "+
            careerWins+" vitória(s), "+careerLosses+" derrota(s). "+stats.textContent;
        }).catch(()=>{ /* Offline: keep valid last-30 summary, not a fake career total. */ });
      }
      if(records.length===0){
        status.textContent="Nenhum resultado de treino 3×3 com três nocautes confirmado neste histórico.";
        return;
      }
      status.textContent="Histórico de TREINO confirmado no servidor. Nenhuma recompensa oficial é concedida.";
      for(const entry of records){
        const row=document.createElement("div");
        row.className="lobby-training-history-entry";
        row.style.cssText="border:1px solid #47694b;border-radius:8px;padding:8px;margin:6px 0;color:#def5e2;font-size:12px;overflow-wrap:anywhere";
        const outcome=entry.winner_id===currentPlayer?"🏆 Vitória de treino":"• Derrota de treino";
        const date=new Date(entry.recorded_at);
        const when=Number.isFinite(date.getTime())?date.toLocaleString("pt-BR"):"Data indisponível";
        row.textContent=outcome+" · Turno "+entry.decided_turn+" · "+when;
        list.appendChild(row);
      }
    }catch(_error){
      if(request!==requestSerial||$("lobby-history-list")!==list)return;
      status.textContent="Não foi possível consultar o histórico. Confira sua conexão e tente novamente.";
      stats.textContent="";
      list.replaceChildren();
    }
  }
  window.ChaoticTrainingHistory={refresh};
})();
