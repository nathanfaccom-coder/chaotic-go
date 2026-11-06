// Chaotic GO v0.1.130 — official reward receipts, authenticated read-only.
// This panel never calculates rewards from a DROME match or the editable profile.
(function(){
  "use strict";
  const playerId=window.ChaoticAuthUser?.id;
  const api=window.ChaoticAuth?.getClient?.();
  let serial=0;
  const $=id=>document.getElementById(id);
  const format=n=>Number(n).toLocaleString("pt-BR");
  async function refresh(){
    const status=$("lobby-rewards-status");
    const summary=$("lobby-rewards-summary");
    const list=$("lobby-rewards-list");
    if(!status||!summary||!list)return;
    const request=++serial;
    summary.textContent="";
    list.replaceChildren();
    if(!playerId||!api){
      status.textContent="Entre na sua conta para consultar o extrato.";
      return;
    }
    status.textContent="Consultando lançamentos oficiais protegidos no servidor...";
    try{
      // RLS exposes only this player's receipts. Authenticated SELECT only.
      const {data,error}=await api.from("chaotic_official_reward_ledger")
        .select("player_id,award_kind,xp_awarded,coins_awarded,awarded_at,reward_scope")
        .eq("player_id",playerId)
        .order("awarded_at",{ascending:false}).limit(20);
      if(request!==serial||$("lobby-rewards-list")!==list)return;
      if(error)throw error;
      const records=(Array.isArray(data)?data:[]).filter(entry=>
        entry&&entry.player_id===playerId
        &&entry.reward_scope==="official_verified_only"
        &&["official_victory","official_participation"].includes(entry.award_kind)
        &&[entry.xp_awarded,entry.coins_awarded].every(n=>
           Number.isSafeInteger(n)&&n>=0&&n<=10000)
        &&(entry.xp_awarded>0||entry.coins_awarded>0));
      if(!records.length){
        status.textContent="Nenhuma recompensa oficial lançada neste extrato. Treinos 3×3 não geram XP nem moedas oficiais.";
        return;
      }
      status.textContent="Lançamentos oficiais registrados no servidor (não representam o saldo total legado).";
      const xp=records.reduce((sum,x)=>sum+x.xp_awarded,0);
      const coins=records.reduce((sum,x)=>sum+x.coins_awarded,0);
      summary.textContent="Somente os últimos "+records.length+" lançamentos: "+
        format(xp)+" XP e "+format(coins)+" moedas. Limite: 20 lançamentos.";
      for(const entry of records){
        const div=document.createElement("div");
        div.className="lobby-reward-entry";
        div.style.cssText="border:1px solid #587390;border-radius:8px;padding:9px;margin:6px 0;color:#dbeaff;font-size:12px;overflow-wrap:anywhere";
        const date=new Date(entry.awarded_at);
        const when=Number.isFinite(date.getTime())?date.toLocaleString("pt-BR"):"Data indisponível";
        div.textContent=(entry.award_kind==="official_victory"?"Vitória oficial":"Participação oficial")+
          " · +"+format(entry.xp_awarded)+" XP · +"+format(entry.coins_awarded)+" moedas · "+when;
        list.appendChild(div);
      }
    }catch(_error){
      if(request!==serial||$("lobby-rewards-list")!==list)return;
      status.textContent="Não foi possível acessar o extrato. Confira sua conexão e tente novamente.";
      summary.textContent="";
      list.replaceChildren();
    }
  }
  window.ChaoticOfficialRewards={refresh};
})();
