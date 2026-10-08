import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL="https://wyxeluofzyvbbihikrct.supabase.co";
const SUPABASE_KEY="sb_publishable_RL1JIU9dK6hqpCq_nMUxXA_1QXGQikz";
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

const roleLabels={gat4_admin:"Tutoria GAT 4",eixo2_editor:"Tutoria Eixo 2",sus_editor:"Preceptoria / Cassino dos Oficiais",student:"Estudante",coordinator_view:"Coordenação — visualização"};
const statusLabels={planejado:"Planejado",em_andamento:"Em andamento",pendente:"Pendente",concluido:"Concluído",suspenso:"Suspenso"};
let session=null,profile=null,spaces=[],perms={},profiles={},previewRole=null,auditOverlay=true,planningCursor=new Date();

const el=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmt=d=>d?new Date(d+"T12:00:00").toLocaleDateString("pt-BR"):"";
const safeLink=u=>{try{const x=new URL(u);return ["http:","https:"].includes(x.protocol)?x.href:""}catch{return""}};
function flash(msg,type="ok"){const n=document.createElement("div");n.className="notice "+type;n.textContent=msg;el("flash")?.append(n);setTimeout(()=>n.remove(),5000)}

function ensureAuditStyles(){
 if(document.getElementById("auditStyles"))return;
 const s=document.createElement("style");s.id="auditStyles";
 s.textContent=".previewBanner{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 18px;background:#fff8d7;border-bottom:1px solid var(--line)}.editStamp{font-size:11px;color:var(--muted);font-weight:700}.modalBackdrop{position:fixed;inset:0;background:rgba(16,34,29,.45);display:grid;place-items:center;z-index:100;padding:20px}.modalCard{width:min(680px,96vw);max-height:88vh;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px}.modalCard.wide{width:min(1100px,96vw)}.historyGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.historyGrid pre{white-space:pre-wrap;word-break:break-word;background:#f6f3e8;padding:10px;border-radius:10px;font-size:11px}.calendarWeek,.calendarGrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.calendarDay{min-height:100px;border:1px solid var(--line);border-radius:12px;background:white;padding:8px;text-align:left;display:flex;flex-direction:column;gap:5px}.calendarDay.empty{background:transparent}.calendarItem{font-size:11px;background:#edf5f2;border-radius:7px;padding:4px 5px}.calendarToolbar{display:flex;justify-content:center;align-items:center;gap:12px;margin:14px 0}.postitReminder{display:grid;gap:5px;background:#fff1a8;border:1px solid #e2c95a;padding:14px 16px;border-radius:8px;margin-bottom:16px}.commentMiniActions{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.miniBtn{border:0;background:transparent;padding:3px 6px;border-radius:8px;cursor:pointer}.miniBtn.selected{background:#e9f4f0}.heroCompass{font-size:60px}@media(max-width:760px){.historyGrid{grid-template-columns:1fr}.calendarDay{min-height:82px}}";
 document.head.appendChild(s);
}
async function start(){
 ensureAuditStyles();
 const {data}=await supabase.auth.getSession(); session=data.session;
 if(!session) return renderLogin();
 await loadIdentity(); if(!profile) return renderNoAccess();
 await loadBase(); renderShell(); navigate("home");
 subscribeRealtime();
}
function renderLogin(){
 document.getElementById("app").innerHTML=`<div class="loginwrap"><div class="login">
 <div style="font-size:36px">🧭</div><h1>Expedição Mauá</h1><p>Diário de Bordo colaborativo — PET-Saúde: Clima · Eixo 2 · GAT 4 + GAT 3</p>
 <div id="loginmsg"></div><form id="loginform"><label>E-mail</label><input name="email" type="email" required>
 <label>Senha</label><input name="password" type="password" required><button class="btn">Entrar</button></form>
 <p style="color:var(--muted);font-size:13px">O acesso é criado pela administração do GAT 4.</p></div></div>`;
 el("loginform").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabase.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error){el("loginmsg").innerHTML='<div class="notice error">'+esc(error.message)+'</div>'}else location.reload()};
}
async function loadIdentity(){const {data}=await supabase.from("profiles").select("*").eq("user_id",session.user.id).maybeSingle();profile=data}
function renderNoAccess(){document.getElementById("app").innerHTML=`<div class="loginwrap"><div class="login"><h1>Acesso não habilitado</h1><p>Seu login existe, mas ainda não possui perfil ativo no Eixo 2.</p><button class="btn" id="logout">Sair</button></div></div>`;el("logout").onclick=()=>supabase.auth.signOut().then(()=>location.reload())}
async function loadBase(){
 const [{data:s},{data:p},{data:pr}]=await Promise.all([
  supabase.from("spaces").select("*").order("sort_order"),
  supabase.from("role_permissions").select("*").eq("role",profile.role),
  supabase.from("profiles").select("user_id,display_name,role")
 ]);
 spaces=s||[]; perms={}; (p||[]).forEach(x=>perms[x.space_slug]=x); (pr||[]).forEach(x=>profiles[x.user_id]=x);
}
async function applyPreviewRole(role){
 previewRole=role||null;
 const targetRole=previewRole||profile.role;
 const {data:p}=await supabase.from("role_permissions").select("*").eq("role",targetRole);
 perms={}; (p||[]).forEach(x=>perms[x.space_slug]=x);
 renderShell(); navigate("home");
}
function adminEditingEnabled(){return profile?.role==="gat4_admin"&&(!previewRole||auditOverlay)}
function renderShell(){
 const visibleSpaces=spaces.filter(s=>perms[s.slug]?.can_view===true);
 const shownRole=previewRole||profile.role;
 const previewControl=profile.role==="gat4_admin"?`<div class="previewControl"><label for="previewRole">Ver como</label><select id="previewRole"><option value="">Minha visão — Tutoria GAT 4</option><option value="eixo2_editor" ${previewRole==="eixo2_editor"?"selected":""}>Tutoria Eixo 2</option><option value="sus_editor" ${previewRole==="sus_editor"?"selected":""}>Preceptora / Orientadora</option><option value="student" ${previewRole==="student"?"selected":""}>Estudante</option><option value="coordinator_view" ${previewRole==="coordinator_view"?"selected":""}>Coordenação</option></select></div>`:"";
 document.getElementById("app").innerHTML=`<div class="shell"><header class="topbar"><div class="brand"><div class="brandmark">⛵</div><div><h1>Expedição Mauá — Diário de Bordo</h1><small>Eixo 2 · GAT 4 + GAT 3</small></div></div><div class="userbox">${previewControl}<span class="chip">${esc(profile.display_name)} · ${esc(roleLabels[shownRole])}</span><button class="btn secondary" id="logout">Sair</button></div></header>
 ${previewRole?`<div class="previewBanner">👁 Você está visualizando o Diário como <b>${esc(roleLabels[previewRole])}</b>. <span>${auditOverlay?"Ferramentas da tutoria estão visíveis para auditoria.":"Visão limpa, como esse perfil realmente vê."}</span><button class="btn secondary" id="toggleAudit">${auditOverlay?"Ocultar ferramentas da tutoria":"Mostrar ferramentas da tutoria"}</button><button class="btn secondary" id="exitPreview">Voltar à minha visão</button></div>`:""}
 <div class="layout"><aside class="sidebar" id="nav"><button class="navbtn" data-view="home">🏠 Painel</button>
 ${visibleSpaces.map(s=>`<button class="navbtn" data-view="${s.slug}">${iconFor(s.slug)} ${esc(s.title)}</button>`).join("")}
 ${adminEditingEnabled()?'<button class="navbtn" data-view="admin">⚙️ Usuários e permissões</button>':""}</aside>
 <main class="main"><div id="flash"></div><div id="content"></div></main></div></div>`;
 document.querySelectorAll(".navbtn").forEach(b=>b.onclick=()=>navigate(b.dataset.view));
 el("logout").onclick=()=>supabase.auth.signOut().then(()=>location.reload());
 if(el("previewRole")) el("previewRole").onchange=e=>applyPreviewRole(e.target.value);
 if(el("toggleAudit")) el("toggleAudit").onclick=()=>{auditOverlay=!auditOverlay;renderShell();navigate("home")};
 if(el("exitPreview")) el("exitPreview").onclick=()=>{auditOverlay=true;applyPreviewRole("")};
}
function iconFor(s){return ({cabine_gat4:"🧭",eixo2:"🤝",territorio_sus:"⚓",tripulacao:"👥",rota_registros:"🗺️",registros_bordo:"📓",atividades:"📚",praca_tripulacao:"☀️",estudio_tripulacao:"🎙️",minha_rota:"🧠",desafios_quiz:"🎯",radar_tripulacao:"📡",ideias_acao:"💡",vitrine_expedicao:"🏆",fontes_evidencias:"🗂️",planejamento:"🗓️",relatorio_mensal:"📄"})[s]||"•"}
async function navigate(view){
 document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 if(view==="home") return renderHome();
 if(view==="admin") return renderAdmin();
 if(view==="praca_tripulacao") return renderPlaza();
 if(view==="relatorio_mensal") return renderReports();
 if(view==="tripulacao") return renderCrew();
 if(view==="planejamento") return renderPlanning();
 return renderEntries(view);
}

function editorStamp(row){
 if(!row?.updated_by||!row?.updated_at)return "";
 const created=row?.created_at?new Date(row.created_at).getTime():0;
 const updated=new Date(row.updated_at).getTime();
 if(created&&Math.abs(updated-created)<2000)return "";
 const who=profiles[row.updated_by]?.display_name||"Tutoria";
 const when=new Date(row.updated_at).toLocaleString("pt-BR");
 return `<span class="editStamp">✎ Editado por ${esc(who)} · ${esc(when)}</span>`;
}
function spaceEditButton(slug){
 return adminEditingEnabled()?`<button class="btn secondary spaceEdit" data-space="${esc(slug)}">✏️ Editar área</button>`:"";
}
function bindSpaceEditButtons(){
 document.querySelectorAll(".spaceEdit").forEach(b=>b.onclick=()=>openSpaceEditor(b.dataset.space));
}
function openSpaceEditor(slug){
 const s=spaces.find(x=>x.slug===slug);if(!s)return;
 const wrap=document.createElement("div");wrap.className="modalBackdrop";wrap.id="spaceModal";
 wrap.innerHTML=`<div class="modalCard"><h3>Editar área</h3><form id="spaceForm"><label>Título</label><input name="title" required value="${esc(s.title)}"><label>Descrição</label><textarea name="description">${esc(s.description||"")}</textarea><div class="actions"><button class="btn">Salvar alterações</button><button type="button" class="btn secondary" id="closeSpaceModal">Cancelar</button></div></form></div>`;
 document.body.append(wrap);
 el("closeSpaceModal").onclick=()=>wrap.remove();
 el("spaceForm").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const {error}=await supabase.from("spaces").update({title:fd.get("title"),description:fd.get("description")||null,updated_at:new Date().toISOString(),updated_by:session.user.id}).eq("slug",slug);if(error){flash(error.message,"error");return}wrap.remove();await loadBase();renderShell();navigate(slug);flash("Área atualizada.")};
}
async function showHistory(tableName,recordId,title="Histórico de alterações"){
 const {data,error}=await supabase.from("audit_log").select("*").eq("table_name",tableName).eq("record_id",String(recordId)).order("changed_at",{ascending:false});
 if(error){flash(error.message,"error");return}
 const wrap=document.createElement("div");wrap.className="modalBackdrop";wrap.id="historyModal";
 const rows=(data||[]).map(x=>{const who=profiles[x.changed_by]?.display_name||"Tutoria";return `<details class="historyItem"><summary>${esc(new Date(x.changed_at).toLocaleString("pt-BR"))} · ${esc(who)} · ${esc(x.action)}</summary><div class="historyGrid"><div><b>Versão anterior</b><pre>${esc(JSON.stringify(x.before_data||{},null,2))}</pre></div><div><b>Versão resultante</b><pre>${esc(JSON.stringify(x.after_data||{},null,2))}</pre></div></div></details>`}).join("")||'<p>Nenhuma alteração registrada ainda.</p>';
 wrap.innerHTML=`<div class="modalCard wide"><div class="modalHead"><h3>${esc(title)}</h3><button class="btn secondary" id="closeHistory">Fechar</button></div>${rows}</div>`;
 document.body.append(wrap);el("closeHistory").onclick=()=>wrap.remove();
}
function historyButton(tableName,id){
 return adminEditingEnabled()?`<button class="btn secondary historyBtn" data-table="${esc(tableName)}" data-id="${esc(id)}">Histórico</button>`:"";
}
function bindHistoryButtons(){
 document.querySelectorAll(".historyBtn").forEach(b=>b.onclick=()=>showHistory(b.dataset.table,b.dataset.id));
}
async function renderHome(){
 const [{count:marcos},{count:gat4},{count:registros},{count:gestao},{data:panel}]=await Promise.all([
  supabase.from("entries").select("*",{count:"exact",head:true}).eq("space_slug","rota_registros"),
  supabase.from("crew_members").select("*",{count:"exact",head:true}).eq("gat","GAT 4"),
  supabase.from("entries").select("*",{count:"exact",head:true}).eq("space_slug","registros_bordo"),
  supabase.from("entries").select("*",{count:"exact",head:true}).eq("space_slug","cabine_gat4"),
  supabase.from("panel_settings").select("*").eq("id","home").maybeSingle()
 ]);
 const p=panel||{
  title:"Onde estamos",
  intro:"Acompanhamento integrado da rota, da tripulação, das decisões e das evidências da Expedição Mauá.",
  phase:"Em navegação",
  focus:"GAT 4 — Itinerário Terapêutico e Cuidado em Rede",
  integration:"GAT 3 + GAT 4 / Eixo 2",
  next_attraction:"16/10/2026",
  cabin_text:"Andreza + Raquel.",
  eixo2_text:"GAT 4 + GAT 3.",
  cassino_text:"preceptoras + orientadora de serviço + tutoria autorizada.",
  praca_text:"espaço comum de pertencimento, convivência e circulação de ideias.",
  coordination_text:"visualiza e exporta, sem editar.",
  next_milestones:"10/10/2026 — Entrega do relatório mensal referente a setembro.\n16/10/2026 — Reunião geral do PET-Saúde: Clima para apresentação das propostas em construção pelos GTs."
 };
 el("content").innerHTML=`<div class="hero expeditionHero"><div><div class="eyebrow">Caderno de campo vivo</div><h2>${esc(p.title)}</h2><p>${esc(p.intro)}</p></div><div class="heroCompass" aria-hidden="true">🧭</div>${adminEditingEnabled()?'<button class="btn secondary" id="editPanel">✏️ Editar painel</button>':""}</div>
 <div class="grid"><div class="stat"><b>${marcos||0}</b>marcos da rota</div><div class="stat"><b>${gat4||0}</b>participantes GAT 4</div><div class="stat"><b>${registros||0}</b>registros de bordo</div><div class="stat"><b>${gestao||0}</b>itens de gestão</div></div>
 <div class="card"><h3>Situação atual</h3><p><b>Fase:</b> ${esc(p.phase)}. <b>GAT em foco:</b> ${esc(p.focus)}. <b>Integração:</b> ${esc(p.integration)}.</p></div><div class="card"><h3>Próximos marcos</h3><p>${esc(p.next_milestones||"").replace(/\n/g,"<br>")}</p></div>
 <div class="card"><h3>Arquitetura de acesso</h3><p><b>Cabine GAT 4:</b> ${esc(p.cabin_text)} <b>Eixo 2:</b> ${esc(p.eixo2_text)} <b>Cassino dos Oficiais:</b> ${esc(p.cassino_text)} <b>Praça da Tripulação:</b> ${esc(p.praca_text)} <b>Coordenação:</b> ${esc(p.coordination_text)}</p></div>
 <div id="panelEditor"></div>`;
 if(adminEditingEnabled()) el("editPanel").onclick=()=>renderPanelEditor(p);
 const compass=document.querySelector(".heroCompass");if(compass&&!matchMedia("(prefers-reduced-motion: reduce)").matches)compass.animate([{transform:"translateY(0) rotate(-4deg)"},{transform:"translateY(-8px) rotate(4deg)"},{transform:"translateY(0) rotate(-4deg)"}],{duration:3200,iterations:Infinity,easing:"ease-in-out"});
}
function renderPanelEditor(p){
 el("panelEditor").innerHTML=`<div class="card"><h3>Editar texto do Painel</h3><form id="panelForm"><div class="formgrid">
 <div><label>Título</label><input name="title" value="${esc(p.title)}"></div>
 <div><label>Fase</label><input name="phase" value="${esc(p.phase)}"></div>
 <div class="full"><label>Texto de abertura</label><textarea name="intro">${esc(p.intro)}</textarea></div>
 <div class="full"><label>GAT em foco</label><input name="focus" value="${esc(p.focus)}"></div>
 <div><label>Integração</label><input name="integration" value="${esc(p.integration)}"></div>
 <div class="full"><label>Próximos marcos</label><textarea name="next_milestones">${esc(p.next_milestones||"")}</textarea></div>
 <div class="full"><label>Cabine GAT 4</label><input name="cabin_text" value="${esc(p.cabin_text)}"></div>
 <div class="full"><label>Eixo 2</label><input name="eixo2_text" value="${esc(p.eixo2_text)}"></div>
 <div class="full"><label>Cassino dos Oficiais</label><input name="cassino_text" value="${esc(p.cassino_text)}"></div>
 <div class="full"><label>Praça da Tripulação</label><input name="praca_text" value="${esc(p.praca_text)}"></div>
 <div class="full"><label>Coordenação</label><input name="coordination_text" value="${esc(p.coordination_text)}"></div>
 </div><div class="actions"><button class="btn">Salvar painel</button><button type="button" class="btn secondary" id="cancelPanel">Cancelar</button></div></form></div>`;
 el("cancelPanel").onclick=()=>el("panelEditor").innerHTML="";
 el("panelForm").onsubmit=async e=>{
  e.preventDefault(); const fd=new FormData(e.target);
  const payload={id:"home",updated_at:new Date().toISOString(),updated_by:session.user.id};
  ["title","intro","phase","focus","integration","next_milestones","cabin_text","eixo2_text","cassino_text","praca_text","coordination_text"].forEach(k=>payload[k]=fd.get(k)||"");
  const {error}=await supabase.from("panel_settings").upsert(payload);
  if(error) flash(error.message,"error"); else {flash("Painel atualizado.");renderHome()}
 };
}
async function renderCrew(){
 const {data,error}=await supabase.from("crew_members").select("*").order("sort_order").order("display_name");
 if(error){flash(error.message,"error");return}
 const rows=data||[];
 el("content").innerHTML=`<div class="hero"><div><h2>👥 ${esc(spaces.find(s=>s.slug==="tripulacao")?.title||"Tripulação")}</h2><p>${esc(spaces.find(s=>s.slug==="tripulacao")?.description||"Composição real do Eixo 2.")}</p></div><div class="actions">${spaceEditButton("tripulacao")}${adminEditingEnabled()?'<button class="btn" id="addCrew">+ Incluir participante</button>':""}</div></div>
 <div id="crewEditor"></div>
 <div class="card tablewrap"><table><thead><tr><th>Nome</th><th>Vínculo</th><th>Papel</th><th>Status</th>${adminEditingEnabled()?"<th>Ações</th>":""}</tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x.display_name)}</b></td><td>${esc(x.gat)}</td><td>${esc(x.participant_role)}</td><td>${esc(x.status)}</td>${adminEditingEnabled()?`<td>${editorStamp(x)}<div class="actions"><button class="btn secondary crewEdit" data-id="${x.id}">Corrigir</button>${historyButton("crew_members",x.id)}<button class="btn warn crewDel" data-id="${x.id}">Excluir</button></div></td>`:""}</tr>`).join("")}</tbody></table></div>`;
 bindSpaceEditButtons();bindHistoryButtons();
 if(adminEditingEnabled()){
  el("addCrew").onclick=()=>crewForm(null);
  document.querySelectorAll(".crewEdit").forEach(b=>b.onclick=()=>crewForm(rows.find(x=>x.id===b.dataset.id)));
  document.querySelectorAll(".crewDel").forEach(b=>b.onclick=async()=>{if(confirm("Excluir este participante da lista?")){const {error}=await supabase.from("crew_members").delete().eq("id",b.dataset.id);if(error)flash(error.message,"error");else renderCrew()}});
 }
}
function crewForm(row){
 el("crewEditor").innerHTML=`<div class="card"><h3>${row?"Corrigir participante":"Incluir participante"}</h3><form id="crewForm"><div class="formgrid">
 <div><label>Nome</label><input name="display_name" required value="${esc(row?.display_name||"")}"></div>
 <div><label>Eixo</label><input name="eixo" required value="${esc(row?.eixo||"Eixo 2")}"></div>
 <div><label>GAT / vínculo</label><input name="gat" required value="${esc(row?.gat||"GAT 4")}"></div>
 <div><label>Papel</label><input name="participant_role" required value="${esc(row?.participant_role||"")}"></div>
 <div><label>Status</label><input name="status" required value="${esc(row?.status||"ativo")}"></div>
 <div><label>Ordem</label><input name="sort_order" type="number" value="${row?.sort_order??100}"></div>
 <div class="full"><label>Seção</label><input name="section" value="${esc(row?.section||"")}"></div>
 </div><div class="actions"><button class="btn">Salvar alterações</button><button type="button" class="btn secondary" id="cancelCrew">Cancelar</button></div></form></div>`;
 el("cancelCrew").onclick=()=>el("crewEditor").innerHTML="";
 el("crewForm").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.target);const payload={display_name:fd.get("display_name"),eixo:fd.get("eixo"),gat:fd.get("gat"),participant_role:fd.get("participant_role"),status:fd.get("status"),sort_order:Number(fd.get("sort_order")||100),section:fd.get("section")||null,updated_at:new Date().toISOString(),updated_by:session.user.id};const q=row?supabase.from("crew_members").update(payload).eq("id",row.id):supabase.from("crew_members").insert(payload);const {error}=await q;if(error)flash(error.message,"error");else{flash("Tripulação atualizada.");renderCrew()}};
 setTimeout(()=>el("crewEditor")?.scrollIntoView({behavior:"smooth",block:"start"}),0);
}
async function renderEntries(slug){
 const space=spaces.find(s=>s.slug===slug); const pm=perms[slug]||{};
 let q=supabase.from("entries").select("*").eq("space_slug",slug).order("display_order",{ascending:true,nullsFirst:false}).order("event_date",{ascending:false,nullsFirst:false}); const {data}=await q;
 el("content").innerHTML=`<div class="hero"><div><h2>${iconFor(slug)} ${esc(space?.title||slug)}</h2><p>${esc(space?.description||"")}</p></div><div class="actions">${spaceEditButton(slug)}${adminEditingEnabled()?'<button class="btn secondary" id="resetOrder">↕ Ordem cronológica</button>':""}${(pm.can_create||adminEditingEnabled())?'<button class="btn" id="addEntry">+ Incluir</button>':""}</div></div><div id="entryForm"></div><div id="entryList"></div>`;
 if(adminEditingEnabled()&&el("resetOrder")) el("resetOrder").onclick=async()=>{const {error}=await supabase.rpc("reset_space_chronology",{p_space_slug:slug});if(error)flash(error.message,"error");else{flash("Ordem cronológica restaurada.");renderEntries(slug)}};
 bindSpaceEditButtons();
 if((pm.can_create||adminEditingEnabled())&&el("addEntry")) el("addEntry").onclick=()=>{entryForm(slug,null);el("entryForm")?.scrollIntoView({behavior:"smooth",block:"start"})};
 renderEntryList(slug,data||[],pm);
}
function renderMetaDetails(m){
 if(!m||typeof m!=="object")return "";
 const labels={phase:"Fase",scope:"Escopo",decision:"Decisão",action:"Ação",evidence:"Evidência",visibility:"Visibilidade",participants:"Participantes",responsible:"Responsável",origin:"Origem",note:"Nota factual",state:"Situação documental",week:"Semana",period:"Período",gat:"GAT",audience:"Público",delivery:"Entrega",weekly_hours:"Carga semanal",planned_hours:"Horas previstas",type:"Tipo",reading_status:"Leitura",source:"Fonte"};
 const parts=Object.entries(labels).filter(([k])=>m[k]!==undefined&&m[k]!==null&&String(m[k]).trim()!=="").map(([k,l])=>`<div><b>${l}</b><span>${esc(m[k])}${k==="weekly_hours"||k==="planned_hours"?" h":""}</span></div>`);
 return parts.length?`<div class="entryDetails">${parts.join("")}</div>`:"";
}
function renderEntryList(slug,rows,pm){
 const canEdit=pm.can_update||adminEditingEnabled(),canDelete=pm.can_delete||adminEditingEnabled(),canCreate=pm.can_create||adminEditingEnabled();
 el("entryList").innerHTML=rows.length?rows.map(r=>`<article class="entry"><div class="meta"><span class="badge">${esc(r.entry_type)}</span>${r.status?'<span class="badge">'+esc(statusLabels[r.status])+'</span>':""}${r.event_date?'<span>📅 '+fmt(r.event_date)+'</span>':""}${editorStamp(r)}</div><h3>${esc(r.title)}</h3><p>${esc(r.body||"").replace(/\n/g,"<br>")}</p>${renderMetaDetails(r.metadata)}${r.due_date?'<p class="due"><b>Prazo:</b> '+fmt(r.due_date)+'</p>':""}${safeLink(r.link_url)?'<p><a class="link" target="_blank" rel="noopener" href="'+esc(safeLink(r.link_url))+'">🔗 Abrir link</a></p>':""}<div id="files-${r.id}"></div><div class="actions">${adminEditingEnabled()?'<button class="btn secondary move up" title="Subir" data-id="'+r.id+'">↑</button><button class="btn secondary move down" title="Descer" data-id="'+r.id+'">↓</button>':""}${canEdit?'<button class="btn secondary edit" data-id="'+r.id+'">Corrigir</button>':""}${historyButton("entries",r.id)}${canDelete?'<button class="btn warn del" data-id="'+r.id+'">Excluir</button>':""}${canCreate?'<label class="btn secondary">📎 Anexar<input hidden type="file" class="upload" data-parent="'+r.id+'" data-space="'+slug+'"></label>':""}</div></article>`).join(""):'<div class="card">Nenhum registro ainda.</div>';
 document.querySelectorAll(".move.up").forEach(b=>b.onclick=async()=>{const {error}=await supabase.rpc("move_entry",{p_entry_id:b.dataset.id,p_direction:-1});if(error)flash(error.message,"error");else renderEntries(slug)});
 document.querySelectorAll(".move.down").forEach(b=>b.onclick=async()=>{const {error}=await supabase.rpc("move_entry",{p_entry_id:b.dataset.id,p_direction:1});if(error)flash(error.message,"error");else renderEntries(slug)});
 document.querySelectorAll(".edit").forEach(b=>b.onclick=async()=>{const {data,error}=await supabase.from("entries").select("*").eq("id",b.dataset.id).single();if(error){flash(error.message,"error");return}entryForm(slug,data);setTimeout(()=>el("entryForm")?.scrollIntoView({behavior:"smooth",block:"start"}),0)});
 document.querySelectorAll(".del").forEach(b=>b.onclick=async()=>{if(confirm("Excluir somente este registro?")){const {error}=await supabase.from("entries").delete().eq("id",b.dataset.id);if(error)flash(error.message,"error");else renderEntries(slug)}});
 document.querySelectorAll(".upload").forEach(i=>i.onchange=async()=>{const ok=await uploadFile(i.files[0],"entry",i.dataset.parent,i.dataset.space);if(ok)renderEntries(slug)});
 bindHistoryButtons();
 rows.forEach(r=>loadAttachments("entry",r.id,"files-"+r.id));
}
function entryMetaFields(slug,row){
 const defs={
  fontes_evidencias:[["type","Tipo da fonte"],["scope","Escopo"],["reading_status","Status de leitura"]],
  rota_registros:[["phase","Fase"],["scope","Escopo"],["decision","Decisão"],["action","Ação"],["evidence","Evidência"],["visibility","Visibilidade"]],
  registros_bordo:[["scope","Escopo"],["participants","Participantes"],["action","Ação / encaminhamento"],["evidence","Evidência"],["responsible","Responsável"],["visibility","Visibilidade"]],
  atividades:[["week","Semana"],["period","Período"],["gat","GAT"],["audience","Público"],["delivery","Entrega"],["weekly_hours","Carga semanal (h)"],["planned_hours","Horas previstas"]],
  eixo2:[["scope","Escopo"],["participants","Participantes"],["evidence","Evidência"],["state","Situação documental"],["note","Nota factual"],["visibility","Visibilidade"]],
  cabine_gat4:[["origin","Origem"],["responsible","Responsável"]],
  territorio_sus:[["scope","Escopo"],["participants","Participantes"],["evidence","Evidência"],["responsible","Responsável"]],
  estudio_tripulacao:[["audience","Público"],["delivery","Produto / entrega"]],
  minha_rota:[["phase","Etapa da rota"],["note","Reflexão / nota"]],
  desafios_quiz:[["audience","Público"],["delivery","Entrega"]],
  radar_tripulacao:[["type","Tipo"],["source","Fonte"]],
  ideias_acao:[["responsible","Responsável"],["state","Situação"]],
  vitrine_expedicao:[["type","Tipo de produto"],["evidence","Evidência"]],
  planejamento:[["responsible","Responsável"],["state","Situação"],["audience","Público"],["note","Lembrete / post-it"]]
 };
 const keys=defs[slug]||[];
 const m=row?.metadata||{};
 return keys.map(([k,l])=>{
  const v=esc(m[k]??"");
  const long=["decision","action","evidence","participants","note"].includes(k);
  return `<div class="${long?"full":""}"><label>${esc(l)}</label>${long?`<textarea name="meta_${k}">${v}</textarea>`:`<input name="meta_${k}" value="${v}">`}</div>`;
 }).join("");
}
function entryForm(slug,row){
 const sourceMode=slug==="fontes_evidencias";
 el("entryForm").innerHTML=`<div class="card editorCard"><h3>${row?"Corrigir registro":"+ Incluir registro"}</h3><form id="ef"><div class="formgrid">
 <div><label>${sourceMode?"Nome do arquivo / fonte":"Título"}</label><input name="title" required value="${esc(row?.title||"")}"></div>
 <div><label>Tipo de registro</label><input name="entry_type" value="${esc(row?.entry_type||"registro")}"></div>
 <div><label>Status</label><select name="status"><option value="">—</option>${Object.entries(statusLabels).map(([k,v])=>'<option value="'+k+'" '+(row?.status===k?"selected":"")+'>'+v+'</option>').join("")}</select></div>
 <div><label>Data</label><input name="event_date" type="date" value="${row?.event_date||""}"></div>
 <div><label>Prazo</label><input name="due_date" type="date" value="${row?.due_date||""}"></div>
 <div class="full"><label>${sourceMode?"Uso no Diário de Bordo":"Descrição"}</label><textarea name="body">${esc(row?.body||"")}</textarea></div>
 ${entryMetaFields(slug,row)}
 <div class="full"><label>Link (YouTube, Instagram, site etc.)</label><input name="link_url" type="url" value="${esc(row?.link_url||"")}"></div>
 </div><div class="actions"><button class="btn">Salvar alterações</button><button type="button" class="btn secondary" id="cancelE">Cancelar</button></div></form></div>`;
 el("cancelE").onclick=()=>el("entryForm").innerHTML="";
 el("ef").onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.target);
  const metadata={...(row?.metadata||{})};
  for(const [k,v] of f.entries()) if(k.startsWith("meta_")) metadata[k.slice(5)]=v===""?null:v;
  const payload={space_slug:slug,title:f.get("title"),entry_type:f.get("entry_type")||"registro",status:f.get("status")||null,event_date:f.get("event_date")||null,due_date:f.get("due_date")||null,body:f.get("body")||null,link_url:f.get("link_url")||null,metadata,updated_by:session.user.id};
  let q=row?supabase.from("entries").update(payload).eq("id",row.id):supabase.from("entries").insert({...payload,created_by:session.user.id});
  const {error}=await q;if(error)flash(error.message,"error");else{flash("Alterações salvas.");renderEntries(slug)}
 };
}

async function renderPlanning(){
 const slug="planejamento",space=spaces.find(s=>s.slug===slug),pm=perms[slug]||{};
 const visible=spaces.filter(s=>perms[s.slug]?.can_view).map(s=>s.slug);
 const y=planningCursor.getFullYear(),m=planningCursor.getMonth();
 const first=new Date(y,m,1),last=new Date(y,m+1,0);
 const start=`${y}-${String(m+1).padStart(2,"0")}-01`,end=`${y}-${String(m+1).padStart(2,"0")}-${String(last.getDate()).padStart(2,"0")}`;
 const {data:all}=await supabase.from("entries").select("*").in("space_slug",visible).gte("event_date",start).lte("event_date",end).order("event_date",{ascending:true});
 const {data:notes}=await supabase.from("entries").select("*").eq("space_slug",slug).order("event_date",{ascending:false,nullsFirst:false});
 const offset=(first.getDay()+6)%7,days=last.getDate(),cells=[];
 for(let i=0;i<offset;i++)cells.push('<div class="calendarDay empty"></div>');
 for(let d=1;d<=days;d++){
   const date=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
   const items=(all||[]).filter(x=>x.event_date===date);
   cells.push(`<button class="calendarDay" data-date="${date}"><b>${d}</b>${items.slice(0,3).map(x=>'<span class="calendarItem">'+iconFor(x.space_slug)+' '+esc(x.title)+'</span>').join("")}${items.length>3?'<small>+'+(items.length-3)+' itens</small>':""}</button>`);
 }
 const today=new Date(),weekEnd=new Date(today);weekEnd.setDate(today.getDate()+7);
 const upcoming=(notes||[]).filter(x=>x.event_date&&new Date(x.event_date+"T12:00:00")>=new Date(today.getFullYear(),today.getMonth(),today.getDate())&&new Date(x.event_date+"T12:00:00")<=weekEnd).slice(0,5);
 el("content").innerHTML=`<div class="hero planningHero"><div><h2>🗓️ ${esc(space?.title||"Planejamento & Calendário")}</h2><p>${esc(space?.description||"Agenda visual da Expedição.")}</p></div><div class="actions">${spaceEditButton(slug)}${(pm.can_create||adminEditingEnabled())?'<button class="btn" id="newPostit">+ Novo post-it</button>':""}</div></div>
 ${upcoming.length?'<div class="postitReminder"><b>📌 Não esqueça de olhar as atividades desta semana</b>'+upcoming.map(x=>'<span>'+fmt(x.event_date)+' — '+esc(x.title)+'</span>').join("")+'</div>':""}
 <div class="calendarToolbar"><button class="btn secondary" id="prevMonth">←</button><h3>${first.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</h3><button class="btn secondary" id="nextMonth">→</button></div>
 <div class="calendarWeek"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div>
 <div class="calendarGrid">${cells.join("")}</div>
 <div id="entryForm"></div><h3 class="sectionTitle">Post-its e compromissos</h3><div id="entryList"></div>`;
 bindSpaceEditButtons();
 el("prevMonth").onclick=()=>{planningCursor=new Date(y,m-1,1);renderPlanning()};
 el("nextMonth").onclick=()=>{planningCursor=new Date(y,m+1,1);renderPlanning()};
 if(el("newPostit"))el("newPostit").onclick=()=>entryForm(slug,null);
 document.querySelectorAll(".calendarDay[data-date]").forEach(b=>b.onclick=()=>{if(pm.can_create||adminEditingEnabled()){entryForm(slug,null);setTimeout(()=>{const form=el("ef");if(form){form.elements.event_date.value=b.dataset.date;form.elements.entry_type.value="post-it"}el("entryForm")?.scrollIntoView({behavior:"smooth"})},0)}});
 renderEntryList(slug,notes||[],pm);
 const reminder=document.querySelector(".postitReminder");if(reminder&&!matchMedia("(prefers-reduced-motion: reduce)").matches)reminder.animate([{transform:"scale(1)"},{transform:"scale(1.015)"},{transform:"scale(1)"}],{duration:1800,iterations:3,easing:"ease-in-out"});
}
function renderCommentThread(comments,reactions,parent=null,depth=0){
 const list=(comments||[]).filter(x=>(x.parent_comment_id||null)===parent);
 return list.map(x=>{const mine=(reactions||[]).find(r=>r.comment_id===x.id&&r.user_id===session.user.id)?.reaction||"";const counts={};(reactions||[]).filter(r=>r.comment_id===x.id).forEach(r=>counts[r.reaction]=(counts[r.reaction]||0)+1);const canEdit=x.created_by===session.user.id||adminEditingEnabled();return `<div class="commentThread" style="margin-left:${Math.min(depth,3)*18}px"><div class="comment"><div><b>${esc(profiles[x.created_by]?.display_name||"Tripulante")}</b> ${editorStamp(x)}<div>${esc(x.body)}</div><div class="commentMiniActions"><button class="miniBtn replyBtn" data-id="${x.id}">Responder</button>${["❤️","👍","🤔"].map(r=>'<button class="miniBtn commentReact '+(mine===r?'selected':'')+'" data-id="'+x.id+'" data-reaction="'+r+'">'+r+' '+(counts[r]||"")+'</button>').join("")}${canEdit?'<button class="miniBtn cedit" data-id="'+x.id+'">Editar</button><button class="miniBtn cdel" data-id="'+x.id+'">Excluir</button>':""}${adminEditingEnabled()?historyButton("plaza_comments",x.id):""}</div></div></div>${renderCommentThread(comments,reactions,x.id,depth+1)}</div>`}).join("");
}
async function renderPlaza(){
 const pm=perms.praca_tripulacao||{};
 const {data:posts}=await supabase.from("plaza_posts").select("*").order("created_at",{ascending:false});
 const ids=(posts||[]).map(p=>p.id);
 const [{data:comments},{data:reactions}]=ids.length?await Promise.all([supabase.from("plaza_comments").select("*").in("post_id",ids).order("created_at",{ascending:true}),supabase.from("plaza_reactions").select("*").in("post_id",ids)]):[{data:[]},{data:[]}];
 const commentIds=(comments||[]).map(x=>x.id);const {data:commentReactions}=commentIds.length?await supabase.from("plaza_comment_reactions").select("*").in("comment_id",commentIds):{data:[]};
 el("content").innerHTML=`<div class="hero"><div><h2>☀️ ${esc(spaces.find(s=>s.slug==="praca_tripulacao")?.title||"Praça da Tripulação")}</h2><p>${esc(spaces.find(s=>s.slug==="praca_tripulacao")?.description||"Espaço comum de pertencimento, convivência e circulação.")}</p></div><div class="actions">${spaceEditButton("praca_tripulacao")}</div></div>
 <div class="card plazaFlow"><b>Da Praça ao Diário:</b> observar → compartilhar → discutir → validar → virar rota, evidência ou ação.</div>
 ${pm.can_create?'<div class="card plazaComposer"><h3>Compartilhar com a tripulação</h3><form id="pf"><div class="formgrid"><div><label>Categoria</label><select name="category"><option>Bom dia</option><option>Ideia</option><option>Achado do território</option><option>ODS em ação</option><option>Sugestão de rota</option><option>Dúvida</option><option>Reconhecimento</option><option>Olha o que encontrei</option><option>Precisamos olhar isso</option><option>Cuidado em rede</option><option>Foto da Expedição</option><option>Vale ver</option></select></div><div><label>Link</label><input name="link_url" type="url" placeholder="https://..."></div><div class="full"><label>Mensagem</label><textarea name="body" required></textarea></div></div><button class="btn sun">Publicar na Praça</button></form></div>':""}<div id="posts"></div>`;
 bindSpaceEditButtons();
 if(pm.can_create||adminEditingEnabled()) el("pf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabase.from("plaza_posts").insert({category:f.get("category"),body:f.get("body"),link_url:f.get("link_url")||null,created_by:session.user.id});if(error)flash(error.message,"error");else renderPlaza()};
 el("posts").innerHTML=(posts||[]).map(p=>{
   const own=p.created_by===session.user.id||profile.role==="gat4_admin";
   const cs=(comments||[]).filter(x=>x.post_id===p.id), rs=(reactions||[]).filter(x=>x.post_id===p.id);
   const counts={};rs.forEach(x=>counts[x.reaction]=(counts[x.reaction]||0)+1);
   const mine=rs.find(x=>x.user_id===session.user.id)?.reaction||"";
   const react=["👍 Gostei","❤️ Amei","💡 Me fez pensar","😕 Não achei legal","🛠️ Pode melhorar","🧭 Vamos por aí"];
   return `<article class="entry post"><div class="meta"><span class="badge">${esc(p.category)}</span><span>${new Date(p.created_at).toLocaleString("pt-BR")}</span>${editorStamp(p)}</div><p class="author">${esc(profiles[p.created_by]?.display_name||"Tripulante")}</p><p>${esc(p.body).replace(/\n/g,"<br>")}</p>${safeLink(p.link_url)?'<a class="link" target="_blank" rel="noopener" href="'+esc(safeLink(p.link_url))+'">🔗 Abrir conteúdo</a>':""}<div id="pfiles-${p.id}"></div>
   <div class="reactionBar">${react.map(x=>'<button class="reaction '+(mine===x?'selected':'')+'" data-post="'+p.id+'" data-reaction="'+esc(x)+'">'+esc(x)+' '+(counts[x]||'')+'</button>').join("")}</div>
   <div class="commentList">${renderCommentThread(cs,commentReactions||[])}</div>
   ${pm.can_create?'<form class="commentForm" data-post="'+p.id+'"><input name="body" placeholder="Escreva um comentário..." required><button class="btn secondary">Comentar</button></form>':""}
   <div class="actions">${pm.can_create?'<label class="btn secondary">📎 Anexar<input hidden type="file" class="pupload" data-id="'+p.id+'"></label>':""}${own?'<button class="btn secondary pedit" data-id="'+p.id+'">Corrigir</button>'+historyButton("plaza_posts",p.id)+'<button class="btn warn pdel" data-id="'+p.id+'">Excluir</button>':""}</div></article>`;
 }).join("")||'<div class="card">A Praça está esperando a primeira mensagem.</div>';
 document.querySelectorAll(".reaction").forEach(b=>b.onclick=async()=>{const selected=b.classList.contains("selected");const q=selected?supabase.from("plaza_reactions").delete().eq("post_id",b.dataset.post).eq("user_id",session.user.id):supabase.from("plaza_reactions").upsert({post_id:b.dataset.post,user_id:session.user.id,reaction:b.dataset.reaction},{onConflict:"post_id,user_id"});const {error}=await q;if(error)flash(error.message,"error");else renderPlaza()});
 document.querySelectorAll(".commentForm").forEach(f=>f.onsubmit=async e=>{e.preventDefault();const fd=new FormData(f);const body=String(fd.get("body")||"").trim();if(!body)return;const {error}=await supabase.from("plaza_comments").insert({post_id:f.dataset.post,body,created_by:session.user.id,updated_by:session.user.id});if(error)flash(error.message,"error");else renderPlaza()});
 document.querySelectorAll(".pedit").forEach(b=>b.onclick=async()=>{const p=(posts||[]).find(x=>x.id===b.dataset.id);if(!p)return;const body=prompt("Corrigir publicação:",p.body);if(body===null)return;const category=prompt("Categoria:",p.category);if(category===null)return;const link=prompt("Link (opcional):",p.link_url||"");if(link===null)return;const {error}=await supabase.from("plaza_posts").update({body,category,link_url:link||null,updated_by:session.user.id,updated_at:new Date().toISOString()}).eq("id",p.id);if(error)flash(error.message,"error");else renderPlaza()});
 document.querySelectorAll(".replyBtn").forEach(b=>b.onclick=async()=>{const body=prompt("Responder ao comentário:");if(!body?.trim())return;const x=(comments||[]).find(y=>y.id===b.dataset.id);const {error}=await supabase.from("plaza_comments").insert({post_id:x.post_id,parent_comment_id:x.id,body:body.trim(),created_by:session.user.id,updated_by:session.user.id});if(error)flash(error.message,"error");else renderPlaza()});
 document.querySelectorAll(".commentReact").forEach(b=>b.onclick=async()=>{const selected=b.classList.contains("selected");const q=selected?supabase.from("plaza_comment_reactions").delete().eq("comment_id",b.dataset.id).eq("user_id",session.user.id):supabase.from("plaza_comment_reactions").upsert({comment_id:b.dataset.id,user_id:session.user.id,reaction:b.dataset.reaction},{onConflict:"comment_id,user_id"});const {error}=await q;if(error)flash(error.message,"error");else renderPlaza()});
 document.querySelectorAll(".cedit").forEach(b=>b.onclick=async()=>{const x=(comments||[]).find(y=>y.id===b.dataset.id);if(!x)return;const body=prompt("Corrigir comentário:",x.body);if(body===null)return;const {error}=await supabase.from("plaza_comments").update({body,updated_by:session.user.id,updated_at:new Date().toISOString()}).eq("id",x.id);if(error)flash(error.message,"error");else renderPlaza()});
 document.querySelectorAll(".cdel").forEach(b=>b.onclick=async()=>{if(confirm("Excluir este comentário?")){const {error}=await supabase.from("plaza_comments").delete().eq("id",b.dataset.id);if(error)flash(error.message,"error");else renderPlaza()}});
 document.querySelectorAll(".pdel").forEach(b=>b.onclick=async()=>{if(confirm("Excluir esta publicação?")){const {error}=await supabase.from("plaza_posts").delete().eq("id",b.dataset.id);if(error)flash(error.message,"error");else renderPlaza()}});
 document.querySelectorAll(".pupload").forEach(i=>i.onchange=async()=>{const ok=await uploadFile(i.files[0],"plaza_post",i.dataset.id,"praca_tripulacao");if(ok)renderPlaza()});
 bindHistoryButtons();
 (posts||[]).forEach(p=>loadAttachments("plaza_post",p.id,"pfiles-"+p.id));
}
const reportFields=[["activities","1. Principais atividades realizadas no mês"],["settings_services","2. Cenários, serviços ou espaços envolvidos"],["audiences_quantities","3. Público envolvido e quantitativos"],["goal_objective","4. Meta ou objetivo trabalhado no mês"],["results","5. Principais resultados alcançados"],["indicators","6. Indicadores e números do período"],["articulations","7. Articulações realizadas"],["service_supervisor_participation","8. Participação do orientador de serviço"],["barriers","9. Principais barreiras ou dificuldades"],["strategies","10. Estratégias adotadas para superar as barreiras"],["products","11. Produtos elaborados no mês"],["evidences","12. Evidências e documentos comprobatórios"],["next_steps","13. Próximos passos"]];
function reportCompletion(r){const done=reportFields.filter(([k])=>String(r?.[k]||"").trim()).length;return {done,total:reportFields.length,pct:Math.round(done/reportFields.length*100)}}
async function renderReports(){
 const pm=perms.relatorio_mensal||{}; const {data}=await supabase.from("monthly_reports").select("*").order("competence",{ascending:false});
 const structure=`<div class="card reportStructure"><div class="reportStructureHead"><div><h3>Os 13 campos do relatório mensal</h3><p>Esta estrutura permanece visível para que o relatório seja construído ao longo da Expedição, e não lembrado apenas no fechamento do mês.</p></div><span class="badge">13 campos oficiais</span></div><div class="reportChecklist">${reportFields.map(([k,l])=>'<div class="reportCheck"><span class="reportNumber">'+l.split(".")[0]+'</span><span>'+esc(l.replace(/^\\d+\\.\\s*/,''))+'</span></div>').join("")}</div></div>`;
 el("content").innerHTML=`<div class="hero"><div><h2>📄 ${esc(spaces.find(s=>s.slug==="relatorio_mensal")?.title||"Relatório Mensal / Registro Oficial")}</h2><p>${esc(spaces.find(s=>s.slug==="relatorio_mensal")?.description||"Dados construídos ao longo da Expedição.")}</p></div><div class="actions">${spaceEditButton("relatorio_mensal")}${(pm.can_create||adminEditingEnabled())?'<button class="btn" id="newReport">+ Nova competência</button>':""}</div></div>${structure}<div id="reportForm"></div><div id="reports"></div>`;
 bindSpaceEditButtons();
 if((pm.can_create||adminEditingEnabled())&&el("newReport")) el("newReport").onclick=()=>reportForm(null);
 el("reports").innerHTML=(data||[]).map(r=>{const cp=reportCompletion(r);return `<div class="card"><div class="meta"><span class="badge">${fmt(r.competence)}</span><span>${esc(r.gt)}</span></div><div class="reportCardHead"><div><h3>Competência ${fmt(r.competence)}</h3><p>${cp.done} de ${cp.total} campos preenchidos</p></div><strong class="reportPct">${cp.pct}%</strong></div><div class="progress"><span style="width:${cp.pct}%"></span></div><div class="meta">${editorStamp(r)}</div><div class="actions">${(pm.can_update||adminEditingEnabled())?'<button class="btn secondary redit" data-id="'+r.id+'">Abrir / corrigir os 13 campos</button>':""}${historyButton("monthly_reports",r.id)}<button class="btn secondary rexport" data-id="${r.id}">Exportar .doc</button></div></div>`}).join("")||'<div class="card"><h3>Nenhuma competência criada ainda.</h3><p>Os 13 campos acima já mostram a estrutura que será preenchida. Quando iniciar o mês, use “+ Nova competência”.</p></div>';
 document.querySelectorAll(".redit").forEach(b=>b.onclick=async()=>{const {data}=await supabase.from("monthly_reports").select("*").eq("id",b.dataset.id).single();reportForm(data)});
 bindHistoryButtons();
 document.querySelectorAll(".rexport").forEach(b=>b.onclick=async()=>{const {data}=await supabase.from("monthly_reports").select("*").eq("id",b.dataset.id).single();exportReport(data)});
}
function reportForm(r){
 el("reportForm").innerHTML=`<div class="card"><h3>${r?"Corrigir relatório":"Nova competência"}</h3><form id="rf"><div class="formgrid"><div><label>Competência</label><input type="month" name="competence" required value="${r?.competence?.slice(0,7)||""}"></div><div><label>GT</label><input name="gt" value="${esc(r?.gt||"GAT 4")}"></div></div><div class="reportFields">${reportFields.map(([k,l])=>'<section><h4>'+l+'</h4><textarea name="'+k+'">'+esc(r?.[k]||"")+'</textarea></section>').join("")}</div><div class="actions"><button class="btn">Salvar</button><button type="button" class="btn secondary" id="cancelR">Cancelar</button></div></form></div>`;
 el("cancelR").onclick=()=>el("reportForm").innerHTML="";
 el("rf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const payload={competence:f.get("competence")+"-01",gt:f.get("gt")||"GAT 4",updated_by:session.user.id};reportFields.forEach(([k])=>payload[k]=f.get(k)||null);let q=r?supabase.from("monthly_reports").update(payload).eq("id",r.id):supabase.from("monthly_reports").insert({...payload,created_by:session.user.id});const {error}=await q;if(error)flash(error.message,"error");else{flash("Relatório salvo.");renderReports()}};
}
function exportReport(r){let html='<html><meta charset="utf-8"><body><h1>RELATÓRIO MENSAL DO GT – PET-SAÚDE: CLIMA</h1><p><b>Competência:</b> '+fmt(r.competence)+'<br><b>GT:</b> '+esc(r.gt)+'</p>';reportFields.forEach(([k,l])=>html+='<h2>'+l+'</h2><p>'+esc(r[k]||"").replace(/\n/g,"<br>")+'</p>');html+='</body></html>';const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([html],{type:"application/msword"}));a.download='relatorio-'+r.competence+'.doc';a.click();URL.revokeObjectURL(a.href)}
async function renderAdmin(){
 if(!adminEditingEnabled()) return navigate("home");
 const [{data:ps},{data:inv}]=await Promise.all([supabase.from("profiles").select("*").order("display_name"),supabase.from("invites").select("*").order("created_at",{ascending:false})]);
 el("content").innerHTML=`<div class="hero"><div><h2>⚙️ Usuários e permissões</h2><p>Cadastre participantes e atribua o papel correto.</p></div></div>
 <div class="grid"><div class="card"><h3>Criar acesso</h3><form id="uf"><label>Nome</label><input name="display_name" required><label>E-mail</label><input name="email" type="email" required><label>Papel</label><select name="role"><option value="gat4_admin">Tutoria GAT 4</option><option value="eixo2_editor">Tutoria Eixo 2 (Jenifer/Kristianne)</option><option value="sus_editor">Preceptora / Orientadora — Cassino dos Oficiais</option><option value="student">Estudante</option><option value="coordinator_view">Coordenação — visualização/exportação</option></select><button class="btn">Criar acesso</button></form><div id="tempPass"></div></div>
 <div class="card"><h3>Infraestrutura</h3><p>Anexos ficam em bucket privado e obedecem às mesmas permissões.</p><button class="btn secondary" id="initStorage">Ativar anexos</button><hr><h3>Minha senha</h3><form id="pwf"><input name="password" type="password" minlength="8" placeholder="Nova senha" required><button class="btn secondary">Alterar minha senha</button></form></div></div>
 <div class="card tablewrap"><h3>Usuários ativos</h3><table><thead><tr><th>Nome</th><th>Papel</th><th>Ativo</th><th>Ações</th></tr></thead><tbody>${(ps||[]).map(p=>'<tr><td>'+esc(p.display_name)+'</td><td>'+esc(roleLabels[p.role])+'</td><td>'+(p.active?"Sim":"Não")+'</td><td><button class="btn secondary profileEdit" data-id="'+p.user_id+'">Corrigir</button></td></tr>').join("")}</tbody></table></div>
 <div class="card tablewrap"><h3>Convites / pré-cadastros</h3><table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th></tr></thead><tbody>${(inv||[]).map(i=>'<tr><td>'+esc(i.display_name||"")+'</td><td>'+esc(i.email)+'</td><td>'+esc(roleLabels[i.role])+'</td></tr>').join("")}</tbody></table></div>`;
 document.querySelectorAll(".profileEdit").forEach(b=>b.onclick=async()=>{const p=(ps||[]).find(x=>x.user_id===b.dataset.id);if(!p)return;const name=prompt("Nome:",p.display_name);if(name===null)return;const role=prompt("Papel: gat4_admin, eixo2_editor, sus_editor, student ou coordinator_view",p.role);if(role===null)return;const active=confirm("OK = usuário ativo. Cancelar = usuário inativo.");const {error}=await supabase.from("profiles").update({display_name:name.trim()||p.display_name,role,active,updated_at:new Date().toISOString()}).eq("user_id",p.user_id);if(error)flash(error.message,"error");else renderAdmin()});
 el("uf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {data,error}=await supabase.functions.invoke("admin-create-user",{body:{display_name:f.get("display_name"),email:f.get("email"),role:f.get("role")}});if(error||data?.error){el("tempPass").innerHTML='<div class="notice error">'+esc(data?.error||error.message)+'</div>'}else{el("tempPass").innerHTML='<div class="notice"><b>Acesso criado.</b><br>Senha temporária: <code>'+esc(data.temporary_password)+'</code><br>Envie esta senha à pessoa por canal privado e peça que ela altere no primeiro acesso.</div>';renderAdmin()}};
 el("initStorage").onclick=async()=>{const {data,error}=await supabase.functions.invoke("ensure-storage");if(error||data?.error)flash(data?.error||error.message,"error");else flash("Anexos privados ativados.")};
 el("pwf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabase.auth.updateUser({password:f.get("password")});if(error)flash(error.message,"error");else flash("Senha alterada.")};
}
async function uploadFile(file,parentKind,parentId,spaceSlug){
 if(!file)return false;
 if(file.size>20*1024*1024){flash("O arquivo excede o limite de 20 MB.","error");return false}
 const path=`${spaceSlug}/${session.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
 const {error}=await supabase.storage.from("e2g4-files").upload(path,file);
 if(error){flash("Não foi possível anexar: "+error.message,"error");return false}
 const {error:e2}=await supabase.from("attachments").insert({space_slug:spaceSlug,parent_kind:parentKind,parent_id:parentId,storage_path:path,file_name:file.name,mime_type:file.type||null,size_bytes:file.size,uploaded_by:session.user.id});
 if(e2){
  await supabase.storage.from("e2g4-files").remove([path]);
  flash("O arquivo foi enviado, mas o registro do anexo falhou: "+e2.message,"error");
  return false;
 }
 flash("Arquivo anexado com sucesso.");
 return true;
}
async function loadAttachments(kind,id,target){
 const node=el(target);if(!node)return;
 const {data,error}=await supabase.from("attachments").select("*").eq("parent_kind",kind).eq("parent_id",id).order("created_at");
 if(error){node.innerHTML='<span class="notice error">'+esc(error.message)+'</span>';return}
 if(!data?.length){node.innerHTML="";return}
 const parts=[];
 for(const a of data){
  const {data:signed}=await supabase.storage.from("e2g4-files").createSignedUrl(a.storage_path,300);
  const canEdit=adminEditingEnabled()||perms[a.space_slug]?.can_update;
  const canDelete=adminEditingEnabled()||perms[a.space_slug]?.can_delete||a.uploaded_by===session.user.id;
  parts.push(`<div class="fileRow">${signed?.signedUrl?'<a class="file link" target="_blank" rel="noopener" href="'+esc(signed.signedUrl)+'">📎 '+esc(a.file_name)+'</a>':'📎 '+esc(a.file_name)}<span class="fileActions">${canEdit?'<button class="btn secondary fileRename" data-id="'+a.id+'" data-name="'+esc(a.file_name)+'">Renomear</button>':""}${canDelete?'<button class="btn warn fileDelete" data-id="'+a.id+'" data-path="'+esc(a.storage_path)+'">Excluir</button>':""}</span></div>`);
 }
 node.innerHTML=parts.join("");
 node.querySelectorAll(".fileRename").forEach(b=>b.onclick=async()=>{const name=prompt("Novo nome do arquivo:",b.dataset.name);if(name===null||!name.trim())return;const {error}=await supabase.from("attachments").update({file_name:name.trim(),updated_by:session.user.id,updated_at:new Date().toISOString()}).eq("id",b.dataset.id);if(error)flash(error.message,"error");else{flash("Nome do arquivo atualizado.");loadAttachments(kind,id,target)}});
 node.querySelectorAll(".fileDelete").forEach(b=>b.onclick=async()=>{if(!confirm("Excluir este anexo?"))return;const {error:se}=await supabase.storage.from("e2g4-files").remove([b.dataset.path]);if(se){flash(se.message,"error");return}const {error}=await supabase.from("attachments").delete().eq("id",b.dataset.id);if(error)flash(error.message,"error");else{flash("Anexo excluído.");loadAttachments(kind,id,target)}});
}
function subscribeRealtime(){["entries","monthly_reports","plaza_posts","plaza_comments","plaza_reactions","plaza_comment_reactions","attachments","crew_members","spaces"].forEach(t=>supabase.channel("rt-"+t).on("postgres_changes",{event:"*",schema:"public",table:t},()=>{const active=document.querySelector(".navbtn.active")?.dataset.view;if(active)navigate(active)}).subscribe())}
start();
