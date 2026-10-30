// ==========================================
// CÉREBRO DE EFEITOS (O Dicionário de Mágicas)
// ==========================================

window.MotorDeEfeitos = {
    
    // Efeito do Vidal (ID 15) e Xamã (ID 16): Cura HP
    "cura_15": function(alvo, fullId, atualizarTela) {
        if (!alvo) return;
        let vidaMaxima = Number(alvo.hpMax || alvo.statsMax.energia);
        alvo.hpAtual = Number(alvo.hpAtual) + 15;
        if (alvo.hpAtual > vidaMaxima) alvo.hpAtual = vidaMaxima; 
        
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'sincronizar_hp', alvo: fullId, novoHp: alvo.hpAtual });
        }
        window.mostrarMensagemScanner(`✨ EFEITO ATIVADO: ${alvo.nome} recuperou 15 de Energia!`);
        if (window.tocarSFX) window.tocarSFX('notificacao');
        atualizarTela();
    },

    // Efeito do Johnes (ID 1): Espiar Mão
    "espiar_mao": function(alvo, fullId, atualizarTela) {
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.mostrarMensagemScanner("🕵️‍♂️ Johnes hackeando o scanner inimigo...");
            window.enviarAcaoRede({ tipo: 'hacker_pedir_mao' });
            if (window.tocarSFX) window.tocarSFX('notificacao');
        } else {
            window.mostrarMensagemScanner("🕵️‍♂️ Johnes: Oponente simulado não possui mão real.");
        }
    },

    // Efeito do Frador (ID 6): Causa 25 de Dano
    "dano_25": function(alvo, fullId, atualizarTela) {
        if (!alvo) return;
        alvo.hpAtual = Number(alvo.hpAtual) - 25;
        let morreu = false;
        if (alvo.hpAtual <= 0) { alvo.hpAtual = 0; morreu = true; }

        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'sincronizar_hp', alvo: fullId, novoHp: alvo.hpAtual });
        }

        window.mostrarMensagemScanner(`🔥 IMPACTO! ${alvo.nome} sofreu 25 de dano pelo efeito!`);
        if (window.tocarSFX) window.tocarSFX('notificacao'); 
        atualizarTela();

        if (morreu) {
            setTimeout(() => {
                if (typeof window.encerrarCombateMorte === 'function') window.encerrarCombateMorte(fullId);
            }, 800); 
        }
    },

    "doar_ficha": function(alvo, fullId, atualizarTela) {
        if (!alvo) return;
        if (alvo.dono !== 'jogador') {
            window.mostrarMensagemScanner("❌ Ação Invalida: Você só pode doar fichas para campeões aliados!");
            return;
        }
        alvo.fichasHabilidade = Number(alvo.fichasHabilidade) + 1;
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'sincronizar_fichas', alvo: fullId, qtd: alvo.fichasHabilidade });
        }
        window.mostrarMensagemScanner(`✨ Ficha doada! ${alvo.nome} recebeu +1 Ficha de Habilidade!`);
        if (window.tocarSFX) window.tocarSFX('notificacao');
        atualizarTela();
    },

    "guru_elemento": function(alvo, fullId, atualizarTela, contexto) {
        if (!alvo || !contexto || !contexto.elementoExtra) return;
        let elementoDado = contexto.elementoExtra;
        
        // Desconecta o array do banco de dados para evitar vazamento
        alvo.elementos = alvo.elementos ? [...alvo.elementos] : [];
        
        if (!alvo.elementos.includes(elementoDado)) {
            alvo.elementos.push(elementoDado);
        }
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'sincronizar_elementos', alvo: fullId, elementos: alvo.elementos });
        }
        window.mostrarMensagemScanner(`✨ Efeito Concluído! ${alvo.nome} ganhou o elemento ${elementoDado}!`);
        if (window.tocarSFX) window.tocarSFX('notificacao');
        atualizarTela();
    },

    "aumenta_energia_10": function(alvo, fullId, atualizarTela) {
        if (!alvo) return;
        alvo.hpMax = Number(alvo.hpMax || alvo.statsMax.energia) + 10;
        alvo.hpAtual = Number(alvo.hpAtual) + 10;
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ 
                tipo: 'sincronizar_hp', 
                alvo: fullId, 
                novoHp: alvo.hpAtual, 
                novoMax: alvo.hpMax
            });
        }
        window.mostrarMensagemScanner(`🦁 ROAR! A energia de ${alvo.nome} aumentou para ${alvo.hpAtual}!`);
        if (window.tocarSFX) window.tocarSFX('notificacao');
        atualizarTela();
    },

    "resetar_naty": function(alvo, fullId, atualizarTela) {
        if (!alvo) return;
        alvo.batalhasRealizadas = 0;
        alvo.elementos = []; 
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'sincronizar_elementos', alvo: fullId, elementos: alvo.elementos });
        }
        window.mostrarMensagemScanner(`🌟 A memória de ${alvo.nome} foi renovada! Ela ganhará os 4 elementos na próxima luta!`);
        if (window.tocarSFX) window.tocarSFX('notificacao');
        atualizarTela();
    },

    "cura_10": function(alvo, fullId, atualizarTela) {
        if (!alvo) return;
        let vidaMaxima = Number(alvo.hpMax || alvo.statsMax.energia);
        alvo.hpAtual = Number(alvo.hpAtual) + 10;
        if (alvo.hpAtual > vidaMaxima) alvo.hpAtual = vidaMaxima; 
        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'sincronizar_hp', alvo: fullId, novoHp: alvo.hpAtual });
        }
        window.mostrarMensagemScanner(`✨ EFEITO ATIVADO: ${alvo.nome} recuperou 10 de Energia!`);
        if (window.tocarSFX) window.tocarSFX('notificacao');
        atualizarTela();
    },

    // =====================================
    // 🔥 NOVO: MUGIC - Canção da Criação
    // =====================================
    "cancao_criacao": function(alvo, fullId, atualizarTela, contexto) {
        if (!alvo || !contexto || !contexto.origem) return;

        // 🔥 CHAVE MESTRA: Agora usamos a ponte para achar o conjurador!
        let conjurador = window.obterCriaturaNoSlot ? window.obterCriaturaNoSlot(contexto.origem) : null;

        let fichasRestantes = conjurador ? conjurador.fichasHabilidade : 0;
        let podePagarExtra = fichasRestantes >= 2;

        window.pausarCronometro();

        const modalHTML = `
            <div class="modal-overlay" id="overlay-cancao" style="z-index: 10000000; background: rgba(0,0,0,0.95); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div class="modal-content-fichas" style="text-align: center; border: 3px solid #00bcd4; background: #111; padding: 25px; border-radius: 10px; max-width: 380px;">
                    <h2 style="color: #00bcd4; font-family: 'Arial Black', sans-serif; margin-bottom: 10px;">🎵 CANÇÃO DA CRIAÇÃO</h2>
                    <p style="color: #fff; font-size: 13px; margin-bottom: 15px;">Escolha os elementos para <b>${alvo.nome}</b>:</p>
                    
                    <div style="margin-bottom: 15px; padding: 10px; background: #222; border-radius: 8px; border: 1px solid #444; text-align: left;">
                        <label style="color: #ffd700; font-weight: bold; cursor: pointer; display: block; margin-bottom: 10px; font-size: 14px;">
                            <input type="radio" name="opcao_cancao" value="1" checked onchange="window.atualizarLimiteCancao(1)" style="transform: scale(1.3); margin-right: 8px;"> 
                            1 Elemento (Custo Padrão: 1 Ficha)
                        </label>
                        <label style="color: ${podePagarExtra ? '#ffd700' : '#555'}; font-weight: bold; cursor: ${podePagarExtra ? 'pointer' : 'not-allowed'}; display: block; font-size: 14px;">
                            <input type="radio" name="opcao_cancao" value="2" ${!podePagarExtra ? 'disabled' : ''} onchange="window.atualizarLimiteCancao(2)" style="transform: scale(1.3); margin-right: 8px;"> 
                            2 Elementos (Pagar +2 Fichas extras)
                        </label>
                    </div>

                    <div id="cancao-checkboxes" style="display: flex; gap: 10px; justify-content: center; font-size: 16px; margin-bottom: 25px; flex-wrap: wrap;">
                        <label style="cursor:pointer; background:#222; border:2px solid red; border-radius:8px; padding:8px; display:flex; align-items:center; gap:5px;"><input type="checkbox" value="Fogo" class="cancao-cb"> 🔥</label>
                        <label style="cursor:pointer; background:#222; border:2px solid blue; border-radius:8px; padding:8px; display:flex; align-items:center; gap:5px;"><input type="checkbox" value="Água" class="cancao-cb"> 🌊</label>
                        <label style="cursor:pointer; background:#222; border:2px solid brown; border-radius:8px; padding:8px; display:flex; align-items:center; gap:5px;"><input type="checkbox" value="Terra" class="cancao-cb"> ⛰️</label>
                        <label style="cursor:pointer; background:#222; border:2px solid gray; border-radius:8px; padding:8px; display:flex; align-items:center; gap:5px;"><input type="checkbox" value="Ar" class="cancao-cb"> ☁️</label>
                    </div>
                    
                    <button class="btn-acao-modal" style="background:#222; border-color: #00bcd4; color: #00bcd4; font-size: 16px; width: 100%;" onclick="window.confirmarCancaoCriacao('${fullId}', '${contexto.origem}')">CONJURAR MAGIA</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        window.limiteCancao = 1;
        window.atualizarLimiteCancao = function(limite) {
            window.limiteCancao = limite;
            let marcados = document.querySelectorAll('.cancao-cb:checked');
            if (marcados.length > limite) {
                marcados.forEach(cb => cb.checked = false); 
            }
        };

        document.querySelectorAll('.cancao-cb').forEach(cb => {
            cb.addEventListener('change', function() {
                let marcados = document.querySelectorAll('.cancao-cb:checked').length;
                if (marcados > window.limiteCancao) {
                    this.checked = false; 
                }
            });
        });
    },

    // =====================================
    // 🔥 NOVO: MUGIC - Canção da Rejeição (COUNTER)
    // =====================================
    "cancao_rejeicao": function(alvo, fullId, atualizarTela, contexto) {
        if (window.pilhaBurst && window.pilhaBurst.length > 0) {
            let acaoAlvo = window.pilhaBurst[window.pilhaBurst.length - 1]; 
            
            if (acaoAlvo.dono !== 'jogador') {
                window.pilhaBurst.pop(); 
                window.mostrarMensagemScanner(`🚫 NEGADO! A Canção da Rejeição dissipou: ${acaoAlvo.nomeAcao}!`);
                if(window.tocarSFX) window.tocarSFX('notificacao');
                
                if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                    window.enviarAcaoRede({ tipo: 'anular_acao' });
                }
            } else {
                window.mostrarMensagemScanner(`⚠️ Você não pode anular sua própria ação! Magia desperdiçada.`);
            }
        } else {
            window.mostrarMensagemScanner(`⚠️ Não havia ação inimiga na Corrente para anular.`);
        }
        atualizarTela();
    },
};

// ==========================================
// 🔥 FUNÇÃO DE RESOLUÇÃO EXCLUSIVA DO MUGIC (Fora do dicionário!)
// ==========================================
window.confirmarCancaoCriacao = function(alvoId, conjuradorId) {
    let marcados = document.querySelectorAll('.cancao-cb:checked');
    if (marcados.length !== window.limiteCancao) {
        window.mostrarMensagemScanner(`⚠️ Você deve marcar exatamente ${window.limiteCancao} elemento(s)!`);
        if(window.tocarSFX) window.tocarSFX('erro');
        return;
    }

    let elementosEscolhidos = Array.from(marcados).map(cb => cb.value);
    document.getElementById('overlay-cancao').remove();
    
    // 🔥 CHAVE MESTRA: Acha as criaturas usando a ponte global
    let alvo = window.obterCriaturaNoSlot ? window.obterCriaturaNoSlot(alvoId) : null;
    let conjurador = window.obterCriaturaNoSlot ? window.obterCriaturaNoSlot(conjuradorId) : null;

    if (alvo) {
        // Cobra o custo extra do conjurador caso tenha marcado 2 elementos
        if (window.limiteCancao === 2 && conjurador) {
            conjurador.fichasHabilidade -= 2;
            if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
                window.enviarAcaoRede({ tipo: 'sincronizar_fichas', alvo: conjuradorId, qtd: conjurador.fichasHabilidade });
            }
        }

        if (!alvo.elementos || !Array.isArray(alvo.elementos)) {
            alvo.elementos = [];
        } else {
            alvo.elementos = [...alvo.elementos]; // Cópia segura para não corromper o banco de dados
        }

        elementosEscolhidos.forEach(el => {
            if (!alvo.elementos.includes(el)) alvo.elementos.push(el);
        });

        if (window.salaBatalhaAtual && window.salaBatalhaAtual !== "sala_simulada") {
            window.enviarAcaoRede({ tipo: 'sincronizar_elementos', alvo: alvoId, elementos: alvo.elementos });
        }

        window.mostrarMensagemScanner(`🎵 A Canção ecoou! ${alvo.nome} ganhou: ${elementosEscolhidos.join(", ")}!`);
        if(window.tocarSFX) window.tocarSFX('notificacao');
        
        window.retomarCronometro();
        if (typeof window.atualizarTelaBatalha === 'function') {
            window.atualizarTelaBatalha(); // Chama a ponte global para acender a luz na hora!
        } else {
            console.error("ERRO: A ponte do renderizador não foi encontrada!");
        }
    }
};
