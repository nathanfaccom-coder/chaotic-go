(function () {
"use strict";
const $ = id => document.getElementById(id);
const feedback = msg => $("auth-feedback").textContent = msg;
const show = id => { $("modal-login").className=id==="modal-login"?"modal-ativo":"modal-oculto"; $("modal-cadastro").className=id==="modal-cadastro"?"modal-ativo":"modal-oculto"; };
$("btn-abrir-login").onclick=()=>show("modal-login");
$("btn-abrir-cadastro").onclick=()=>show("modal-cadastro");
$("btn-fechar-login").onclick=()=>show("");
$("btn-fechar-cadastro").onclick=()=>show("");
$("btn-entrar").onclick=async ()=>{
  try {
    const email=$("usuario").value.trim().toLowerCase(),password=$("senha").value;
    if(!email || !password) throw Error("Informe e-mail e senha.");
    feedback("Validando credenciais...");
    const {error}=await ChaoticAuth.getClient().auth.signInWithPassword({email,password});
    if(error) throw error;
    window.location.replace("scanner-completo.html");
  } catch(e) { feedback("Não foi possível entrar: "+e.message); }
};
$("btn-cadastrar").onclick=async ()=>{
  try {
    const email=$("novo-email").value.trim().toLowerCase();
    const username=$("novo-usuario").value.trim();
    const password=$("nova-senha").value;
    if(!email || !username || password.length<8) throw Error("Preencha e-mail, nome e senha com pelo menos 8 caracteres.");
    feedback("Criando conta...");
    const {data,error}=await ChaoticAuth.getClient().auth.signUp({email,password,options:{data:{username},emailRedirectTo:"https://nathanfaccom-coder.github.io/chaotic-go/login.html"}});
    if(error) throw error;
    if(data.session) window.location.replace("scanner-completo.html");
    else { show("");feedback("Cadastro recebido. Confira seu e-mail para confirmar a conta antes de entrar."); }
  } catch(e){feedback("Não foi possível cadastrar: "+e.message);}
};
$("btn-recuperar-senha").onclick=async ()=>{
  try {
    const email=$("usuario").value.trim().toLowerCase();
    if(!email) throw Error("Informe seu e-mail acima.");
    const {error}=await ChaoticAuth.getClient().auth.resetPasswordForEmail(email,{redirectTo:"https://nathanfaccom-coder.github.io/chaotic-go/redefinir-senha.html"});
    if(error) throw error;
    feedback("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
  } catch(e){feedback(e.message);}
};
(async()=>{try{if(await ChaoticAuth.currentUser()) location.replace("scanner-completo.html");}catch(e){feedback(e.message);}})();
})();