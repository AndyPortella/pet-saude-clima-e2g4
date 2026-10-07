import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL="https://wyxeluofzyvbbihikrct.supabase.co";
const SUPABASE_KEY="sb_publishable_RL1JIU9dK6hqpCq_nMUxXA_1QXGQikz";
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

const roleLabels={gat4_admin:"Tutoria GAT 4",eixo2_editor:"Tutoria Eixo 2",sus_editor:"Preceptoria / Cassino dos Oficiais",student:"Estudante",coordinator_view:"Coordenação — visualização"};
const statusLabels={planejado:"Planejado",em_andamento:"Em andamento",pendente:"Pendente",concluido:"Concluído",suspenso:"Suspenso"};
let session=null,profile=null,spaces=[],perms={},profiles={};

const el=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmt=d=>d?new Date(d+"T12:00:00").toLocaleDateString("pt-BR"):"";
const safeLink=u=>{try{const x=new URL(u);return ["http:","https:"].includes(x.protocol)?x.href:""}catch{return""}};
function flash(msg,type="ok"){const n=document.createElement("div");n.className="notice "+type;n.textContent=msg;el("flash")?.append(n);setTimeout(()=>n.remove(),5000)}

async function start(){
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
 spaces=s||[]; (p||[]).forEach(x=>perms[x.space_slug]=x); (pr||[]).forEach(x=>profiles[x.user_id]=x);
}
function renderShell(){
 const visibleSpaces=spaces.filter(s=>perms[s.slug]?.can_view===true);
 document.getElementById("app").innerHTML=`<div class="shell"><header class="topbar"><div class="brand"><div class="brandmark">⛵</div><div><h1>Expedição Mauá — Diário de Bordo</h1><small>Eixo 2 · GAT 4 + GAT 3</small></div></div><div class="userbox"><span class="chip">${esc(profile.display_name)} · ${esc(roleLabels[profile.role])}</span><button class="btn secondary" id="logout">Sair</button></div></header>
 <div class="layout"><aside class="sidebar" id="nav"><button class="navbtn" data-view="home">🏠 Painel</button>
 ${visibleSpaces.map(s=>`<button class="navbtn" data-view="${s.slug}">${iconFor(s.slug)} ${esc(s.title)}</button>`).join("")}
 ${profile.role==="gat4_admin"?'<button class="navbtn" data-view="admin">⚙️ Usuários e permissões</button>':""}</aside>
 <main class="main"><div id="flash"></div><div id="content"></div></main></div></div>`;
 document.querySelectorAll(".navbtn").forEach(b=>b.onclick=()=>navigate(b.dataset.view));
 el("logout").onclick=()=>supabase.auth.signOut().then(()=>location.reload());
}
function iconFor(s){return ({cabine_gat4:"🧭",eixo2:"🤝",territorio_sus:"⚓",tripulacao:"👥",rota_registros:"🗺️",registros_bordo:"📓",atividades:"📚",praca_tripulacao:"☀️",fontes_evidencias:"🗂️",relatorio_mensal:"📄"})[s]||"•"}
async function navigate(view){
 document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 if(view==="home") return renderHome();
 if(view==="admin") return renderAdmin();
 if(view==="praca_tripulacao") return renderPlaza();
 if(view==="relatorio_mensal") return renderReports();
 if(view==="tripulacao") return renderCrew();
 return renderEntries(view);
}
async function renderHome(){
 const [{count:marcos},{count:gat4},{count:registros},{count:gestao}]=await Promise.all([
  supabase.from("entries").select("*",{count:"exact",head:true}).eq("space_slug","rota_registros"),
  supabase.from("crew_members").select("*",{count:"exact",head:true}).eq("gat","GAT 4"),
  supabase.from("entries").select("*",{count:"exact",head:true}).eq("space_slug","registros_bordo"),
  supabase.from("entries").select("*",{count:"exact",head:true}).eq("space_slug","cabine_gat4")
 ]);
 el("content").innerHTML=`<div class="hero"><div><h2>Onde estamos</h2><p>Acompanhamento integrado da rota, da tripulação, das decisões e das evidências da Expedição Mauá.</p></div></div>
 <div class="grid"><div class="stat"><b>${marcos||0}</b>marcos da rota</div><div class="stat"><b>${gat4||0}</b>participantes GAT 4</div><div class="stat"><b>${registros||0}</b>registros de bordo</div><div class="stat"><b>${gestao||0}</b>itens de gestão</div></div>
 <div class="card"><h3>Situação atual</h3><p><b>GAT em foco:</b> GAT 4 — Itinerário Terapêutico e Cuidado em Rede. <b>Integração:</b> GAT 3 + GAT 4 / Eixo 2. <b>Próxima atracação:</b> 16/10/2026.</p></div>
 <div class="card"><h3>Arquitetura de acesso</h3><p><b>Cabine GAT 4:</b> Andreza + Raquel. <b>Eixo 2:</b> GAT 4 + GAT 3. <b>Cassino dos Oficiais:</b> preceptoras + orientadora de serviço + tutoria autorizada. <b>Praça da Tripulação:</b> espaço comum de pertencimento, convivência e circulação de ideias. <b>Coordenação:</b> visualiza e exporta, sem editar.</p></div>`;
}
async function renderCrew(){
 const {data,error}=await supabase.from("crew_members").select("*").order("sort_order").order("display_name");
 if(error){flash(error.message,"error");return}
 const rows=data||[];
 el("content").innerHTML=`<div class="hero"><div><h2>👥 Tripulação</h2><p>Composição real do Eixo 2: GAT 3 + GAT 4, preceptoras, orientadora e estudantes.</p></div></div>
 <div class="card tablewrap"><table><thead><tr><th>Nome</th><th>Vínculo</th><th>Papel</th><th>Status</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x.display_name)}</b></td><td>${esc(x.gat)}</td><td>${esc(x.participant_role)}</td><td>${esc(x.status)}</td></tr>`).join("")}</tbody></table></div>`;
}
async function renderEntries(slug){
 const space=spaces.find(s=>s.slug===slug); const pm=perms[slug]||{};
 const {data}=await supabase.from("entries").select("*").eq("space_slug",slug).order("created_at",{ascending:false});
 el("content").innerHTML=`<div class="hero"><div><h2>${iconFor(slug)} ${esc(space?.title||slug)}</h2><p>${esc(space?.description||"")}</p></div><div class="actions">${pm.can_create?'<button class="btn" id="addEntry">+ Incluir</button>':""}</div></div><div id="entryForm"></div><div id="entryList"></div>`;
 if(pm.can_create) el("addEntry").onclick=()=>entryForm(slug,null);
 renderEntryList(slug,data||[],pm);
}
function renderEntryList(slug,rows,pm){
 el("entryList").innerHTML=rows.length?rows.map(r=>`<article class="entry"><div class="meta"><span class="badge">${esc(r.entry_type)}</span>${r.status?'<span class="badge">'+esc(statusLabels[r.status])+'</span>':""}${r.event_date?'<span>📅 '+fmt(r.event_date)+'</span>':""}</div><h3>${esc(r.title)}</h3><p>${esc(r.body||"").replace(/\n/g,"<br>")}</p>${safeLink(r.link_url)?'<p><a class="link" target="_blank" rel="noopener" href="'+esc(safeLink(r.link_url))+'">🔗 Abrir link</a></p>':""}<div id="files-${r.id}"></div><div class="actions">${pm.can_update?'<button class="btn secondary edit" data-id="'+r.id+'">Corrigir</button>':""}${pm.can_delete?'<button class="btn warn del" data-id="'+r.id+'">Excluir</button>':""}${pm.can_create?'<label class="btn secondary">📎 Anexar<input hidden type="file" class="upload" data-parent="'+r.id+'" data-space="'+slug+'"></label>':""}</div></article>`).join(""):'<div class="card">Nenhum registro ainda.</div>';
 document.querySelectorAll(".edit").forEach(b=>b.onclick=async()=>{const {data}=await supabase.from("entries").select("*").eq("id",b.dataset.id).single();entryForm(slug,data)});
 document.querySelectorAll(".del").forEach(b=>b.onclick=async()=>{if(confirm("Excluir somente este registro?")){const {error}=await supabase.from("entries").delete().eq("id",b.dataset.id);if(error)flash(error.message,"error");else renderEntries(slug)}});
 document.querySelectorAll(".upload").forEach(i=>i.onchange=()=>uploadFile(i.files[0],"entry",i.dataset.parent,i.dataset.space).then(()=>renderEntries(slug)));
 rows.forEach(r=>loadAttachments("entry",r.id,"files-"+r.id));
}
function entryForm(slug,row){
 el("entryForm").innerHTML=`<div class="card"><h3>${row?"Corrigir registro":"+ Incluir registro"}</h3><form id="ef"><div class="formgrid"><div><label>Título</label><input name="title" required value="${esc(row?.title||"")}"></div><div><label>Tipo</label><input name="entry_type" value="${esc(row?.entry_type||"registro")}"></div><div><label>Status</label><select name="status"><option value="">—</option>${Object.entries(statusLabels).map(([k,v])=>'<option value="'+k+'" '+(row?.status===k?"selected":"")+'>'+v+'</option>').join("")}</select></div><div><label>Data</label><input name="event_date" type="date" value="${row?.event_date||""}"></div><div class="full"><label>Descrição</label><textarea name="body">${esc(row?.body||"")}</textarea></div><div class="full"><label>Link (YouTube, Instagram, site etc.)</label><input name="link_url" type="url" value="${esc(row?.link_url||"")}"></div></div><div class="actions"><button class="btn">Salvar</button><button type="button" class="btn secondary" id="cancelE">Cancelar</button></div></form></div>`;
 el("cancelE").onclick=()=>el("entryForm").innerHTML="";
 el("ef").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const payload={space_slug:slug,title:f.get("title"),entry_type:f.get("entry_type")||"registro",status:f.get("status")||null,event_date:f.get("event_date")||null,body:f.get("body")||null,link_url:f.get("link_url")||null,updated_by:session.user.id};let q=row?supabase.from("entries").update(payload).eq("id",row.id):supabase.from("entries").insert({...payload,created_by:session.user.id});const {error}=await q;if(error)flash(error.message,"error");else{flash("Registro salvo.");renderEntries(slug)}};
}
async function renderPlaza(){
 const pm=perms.praca_tripulacao||{}; const {data}=await supabase.from("plaza_posts").select("*").order("created_at",{ascending:false});
 el("content").innerHTML=`<div class="hero"><div><h2>☀️ Praça da Tripulação</h2><p>Trabalho, convivência e boas vibrações: música, mensagem, Instagram, achados, ideias e conquistas.</p></div></div>
 ${pm.can_create?'<div class="card plazaComposer"><h3>Compartilhar com a tripulação</h3><form id="pf"><div class="formgrid"><div><label>Categoria</label><select name="category"><option>Bom dia</option><option>Música</option><option>Vale ver</option><option>Instagram / Reels</option><option>Foto da Expedição</option><option>Ideia</option><option>Fórum</option><option>Conquista</option><option>Mensagem</option></select></div><div><label>Link</label><input name="link_url" type="url" placeholder="https://..."></div><div class="full"><label>Mensagem</label><textarea name="body" required></textarea></div></div><button class="btn sun">Publicar</button></form></div>':""}<div id="posts"></div>`;
 if(pm.can_create) el("pf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabase.from("plaza_posts").insert({category:f.get("category"),body:f.get("body"),link_url:f.get("link_url")||null,created_by:session.user.id});if(error)flash(error.message,"error");else renderPlaza()};
 el("posts").innerHTML=(data||[]).map(p=>{const own=p.created_by===session.user.id||profile.role==="gat4_admin";return `<article class="entry post"><div class="meta"><span class="badge">${esc(p.category)}</span><span>${new Date(p.created_at).toLocaleString("pt-BR")}</span></div><p class="author">${esc(profiles[p.created_by]?.display_name||"Tripulante")}</p><p>${esc(p.body).replace(/\n/g,"<br>")}</p>${safeLink(p.link_url)?'<a class="link" target="_blank" rel="noopener" href="'+esc(safeLink(p.link_url))+'">🔗 Abrir conteúdo</a>':""}<div id="pfiles-${p.id}"></div><div class="actions">${pm.can_create?'<label class="btn secondary">📎 Anexar<input hidden type="file" class="pupload" data-id="'+p.id+'"></label>':""}${own?'<button class="btn warn pdel" data-id="'+p.id+'">Excluir</button>':""}</div></article>`}).join("")||'<div class="card">A Praça está esperando a primeira mensagem.</div>';
 document.querySelectorAll(".pdel").forEach(b=>b.onclick=async()=>{if(confirm("Excluir esta publicação?")){await supabase.from("plaza_posts").delete().eq("id",b.dataset.id);renderPlaza()}});
 document.querySelectorAll(".pupload").forEach(i=>i.onchange=()=>uploadFile(i.files[0],"plaza_post",i.dataset.id,"praca_tripulacao").then(renderPlaza));
 (data||[]).forEach(p=>loadAttachments("plaza_post",p.id,"pfiles-"+p.id));
}
const reportFields=[["activities","1. Principais atividades realizadas no mês"],["settings_services","2. Cenários, serviços ou espaços envolvidos"],["audiences_quantities","3. Público envolvido e quantitativos"],["goal_objective","4. Meta ou objetivo trabalhado no mês"],["results","5. Principais resultados alcançados"],["indicators","6. Indicadores e números do período"],["articulations","7. Articulações realizadas"],["service_supervisor_participation","8. Participação do orientador de serviço"],["barriers","9. Principais barreiras ou dificuldades"],["strategies","10. Estratégias adotadas para superar as barreiras"],["products","11. Produtos elaborados no mês"],["evidences","12. Evidências e documentos comprobatórios"],["next_steps","13. Próximos passos"]];
function reportCompletion(r){const done=reportFields.filter(([k])=>String(r?.[k]||"").trim()).length;return {done,total:reportFields.length,pct:Math.round(done/reportFields.length*100)}}
async function renderReports(){
 const pm=perms.relatorio_mensal||{}; const {data}=await supabase.from("monthly_reports").select("*").order("competence",{ascending:false});
 const structure=`<div class="card reportStructure"><div class="reportStructureHead"><div><h3>Os 13 campos do relatório mensal</h3><p>Esta estrutura permanece visível para que o relatório seja construído ao longo da Expedição, e não lembrado apenas no fechamento do mês.</p></div><span class="badge">13 campos oficiais</span></div><div class="reportChecklist">${reportFields.map(([k,l])=>'<div class="reportCheck"><span class="reportNumber">'+l.split(".")[0]+'</span><span>'+esc(l.replace(/^\\d+\\.\\s*/,''))+'</span></div>').join("")}</div></div>`;
 el("content").innerHTML=`<div class="hero"><div><h2>📄 Relatório Mensal / Registro Oficial</h2><p>Dados construídos ao longo da Expedição. Visualize os 13 campos, acompanhe o preenchimento e exporte o registro oficial.</p></div>${pm.can_create?'<button class="btn" id="newReport">+ Nova competência</button>':""}</div>${structure}<div id="reportForm"></div><div id="reports"></div>`;
 if(pm.can_create) el("newReport").onclick=()=>reportForm(null);
 el("reports").innerHTML=(data||[]).map(r=>{const cp=reportCompletion(r);return `<div class="card"><div class="meta"><span class="badge">${fmt(r.competence)}</span><span>${esc(r.gt)}</span></div><div class="reportCardHead"><div><h3>Competência ${fmt(r.competence)}</h3><p>${cp.done} de ${cp.total} campos preenchidos</p></div><strong class="reportPct">${cp.pct}%</strong></div><div class="progress"><span style="width:${cp.pct}%"></span></div><div class="actions">${pm.can_update?'<button class="btn secondary redit" data-id="'+r.id+'">Abrir / corrigir os 13 campos</button>':""}<button class="btn secondary rexport" data-id="${r.id}">Exportar .doc</button></div></div>`}).join("")||'<div class="card"><h3>Nenhuma competência criada ainda.</h3><p>Os 13 campos acima já mostram a estrutura que será preenchida. Quando iniciar o mês, use “+ Nova competência”.</p></div>';
 document.querySelectorAll(".redit").forEach(b=>b.onclick=async()=>{const {data}=await supabase.from("monthly_reports").select("*").eq("id",b.dataset.id).single();reportForm(data)});
 document.querySelectorAll(".rexport").forEach(b=>b.onclick=async()=>{const {data}=await supabase.from("monthly_reports").select("*").eq("id",b.dataset.id).single();exportReport(data)});
}
function reportForm(r){
 el("reportForm").innerHTML=`<div class="card"><h3>${r?"Corrigir relatório":"Nova competência"}</h3><form id="rf"><div class="formgrid"><div><label>Competência</label><input type="month" name="competence" required value="${r?.competence?.slice(0,7)||""}"></div><div><label>GT</label><input name="gt" value="${esc(r?.gt||"GAT 4")}"></div></div><div class="reportFields">${reportFields.map(([k,l])=>'<section><h4>'+l+'</h4><textarea name="'+k+'">'+esc(r?.[k]||"")+'</textarea></section>').join("")}</div><div class="actions"><button class="btn">Salvar</button><button type="button" class="btn secondary" id="cancelR">Cancelar</button></div></form></div>`;
 el("cancelR").onclick=()=>el("reportForm").innerHTML="";
 el("rf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const payload={competence:f.get("competence")+"-01",gt:f.get("gt")||"GAT 4",updated_by:session.user.id};reportFields.forEach(([k])=>payload[k]=f.get(k)||null);let q=r?supabase.from("monthly_reports").update(payload).eq("id",r.id):supabase.from("monthly_reports").insert({...payload,created_by:session.user.id});const {error}=await q;if(error)flash(error.message,"error");else{flash("Relatório salvo.");renderReports()}};
}
function exportReport(r){let html='<html><meta charset="utf-8"><body><h1>RELATÓRIO MENSAL DO GT – PET-SAÚDE: CLIMA</h1><p><b>Competência:</b> '+fmt(r.competence)+'<br><b>GT:</b> '+esc(r.gt)+'</p>';reportFields.forEach(([k,l])=>html+='<h2>'+l+'</h2><p>'+esc(r[k]||"").replace(/\n/g,"<br>")+'</p>');html+='</body></html>';const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([html],{type:"application/msword"}));a.download='relatorio-'+r.competence+'.doc';a.click();URL.revokeObjectURL(a.href)}
async function renderAdmin(){
 if(profile.role!=="gat4_admin") return navigate("home");
 const [{data:ps},{data:inv}]=await Promise.all([supabase.from("profiles").select("*").order("display_name"),supabase.from("invites").select("*").order("created_at",{ascending:false})]);
 el("content").innerHTML=`<div class="hero"><div><h2>⚙️ Usuários e permissões</h2><p>Cadastre participantes e atribua o papel correto.</p></div></div>
 <div class="grid"><div class="card"><h3>Criar acesso</h3><form id="uf"><label>Nome</label><input name="display_name" required><label>E-mail</label><input name="email" type="email" required><label>Papel</label><select name="role"><option value="gat4_admin">Tutoria GAT 4</option><option value="eixo2_editor">Tutoria Eixo 2 (Jenifer/Kristianne)</option><option value="sus_editor">Preceptora / Orientadora — Cassino dos Oficiais</option><option value="student">Estudante</option><option value="coordinator_view">Coordenação — visualização/exportação</option></select><button class="btn">Criar acesso</button></form><div id="tempPass"></div></div>
 <div class="card"><h3>Infraestrutura</h3><p>Anexos ficam em bucket privado e obedecem às mesmas permissões.</p><button class="btn secondary" id="initStorage">Ativar anexos</button><hr><h3>Minha senha</h3><form id="pwf"><input name="password" type="password" minlength="8" placeholder="Nova senha" required><button class="btn secondary">Alterar minha senha</button></form></div></div>
 <div class="card tablewrap"><h3>Usuários ativos</h3><table><thead><tr><th>Nome</th><th>Papel</th><th>Ativo</th></tr></thead><tbody>${(ps||[]).map(p=>'<tr><td>'+esc(p.display_name)+'</td><td>'+esc(roleLabels[p.role])+'</td><td>'+(p.active?"Sim":"Não")+'</td></tr>').join("")}</tbody></table></div>
 <div class="card tablewrap"><h3>Convites / pré-cadastros</h3><table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th></tr></thead><tbody>${(inv||[]).map(i=>'<tr><td>'+esc(i.display_name||"")+'</td><td>'+esc(i.email)+'</td><td>'+esc(roleLabels[i.role])+'</td></tr>').join("")}</tbody></table></div>`;
 el("uf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {data,error}=await supabase.functions.invoke("admin-create-user",{body:{display_name:f.get("display_name"),email:f.get("email"),role:f.get("role")}});if(error||data?.error){el("tempPass").innerHTML='<div class="notice error">'+esc(data?.error||error.message)+'</div>'}else{el("tempPass").innerHTML='<div class="notice"><b>Acesso criado.</b><br>Senha temporária: <code>'+esc(data.temporary_password)+'</code><br>Envie esta senha à pessoa por canal privado e peça que ela altere no primeiro acesso.</div>';renderAdmin()}};
 el("initStorage").onclick=async()=>{const {data,error}=await supabase.functions.invoke("ensure-storage");if(error||data?.error)flash(data?.error||error.message,"error");else flash("Anexos privados ativados.")};
 el("pwf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabase.auth.updateUser({password:f.get("password")});if(error)flash(error.message,"error");else flash("Senha alterada.")};
}
async function uploadFile(file,parentKind,parentId,spaceSlug){
 if(!file)return; const path=`${spaceSlug}/${session.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
 const {error}=await supabase.storage.from("e2g4-files").upload(path,file); if(error){flash("Anexo: "+error.message,"error");return}
 const {error:e2}=await supabase.from("attachments").insert({space_slug:spaceSlug,parent_kind:parentKind,parent_id:parentId,storage_path:path,file_name:file.name,mime_type:file.type,size_bytes:file.size,uploaded_by:session.user.id});if(e2)flash(e2.message,"error");else flash("Arquivo anexado.");
}
async function loadAttachments(kind,id,target){
 const node=el(target);if(!node)return;const {data}=await supabase.from("attachments").select("*").eq("parent_kind",kind).eq("parent_id",id).order("created_at");if(!data?.length)return;
 const parts=[];for(const a of data){const {data:s}=await supabase.storage.from("e2g4-files").createSignedUrl(a.storage_path,300);if(s?.signedUrl)parts.push('<a class="file link" target="_blank" rel="noopener" href="'+esc(s.signedUrl)+'">📎 '+esc(a.file_name)+'</a>')}node.innerHTML=parts.join("<br>");
}
function subscribeRealtime(){["entries","monthly_reports","plaza_posts","plaza_comments","plaza_reactions","attachments","crew_members"].forEach(t=>supabase.channel("rt-"+t).on("postgres_changes",{event:"*",schema:"public",table:t},()=>{const active=document.querySelector(".navbtn.active")?.dataset.view;if(active)navigate(active)}).subscribe())}
start();
