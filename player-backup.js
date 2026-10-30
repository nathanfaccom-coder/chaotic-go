// Exporta uma cópia pessoal de todos os nós privados do jogador atual.
export async function downloadPlayerBackup(){
  const client=window.ChaoticAuth?.getClient();
  const user=window.ChaoticAuthUser;
  if(!client || !user?.id)throw Error("Entre na sua conta para exportar.");
  const rows=[];
  let from=0;
  // Supabase PostgREST retorna linhas em páginas. Não presumir que sejam no máximo 1000.
  while(true){
    const {data,error}=await client.from("chaotic_game_nodes")
      .select("node_path,data,updated_at")
      .eq("user_id",user.id).order("node_path",{ascending:true}).range(from,from+499);
    if(error)throw error;
    rows.push(...(data||[]));
    if(!data || data.length<500)break;
    from+=500;
    if(from>20000)throw Error("Coleção acima do limite de exportação; contate o suporte.");
  }
  const payload={
    format:"chaotic-go-private-backup",version:1,exportedAt:new Date().toISOString(),
    nodes:rows.map(({node_path,data,updated_at})=>({node_path,data,updated_at}))
  };
  const json=JSON.stringify(payload,null,2);
  const file=new Blob([json],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(file),a=document.createElement("a");
  a.href=url;
  a.download="chaotic-go-backup-"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a);
  try{a.click();}finally{
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  return {nodes:rows.length,bytes:json.length};
}
