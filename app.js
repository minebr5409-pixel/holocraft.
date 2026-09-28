const cfg = window.HOLOCRAFT_CONFIG || {};
const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.startsWith('COLE_') && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith('COLE_');
let sb = null, currentUser = null, allPrints = [];
const $ = s => document.querySelector(s);
const escapeHtml = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function status(msg, bad=false){ $('#status').textContent=msg; $('#status').className=bad?'bad':'good'; }
function authStatus(msg, bad=false){ $('#authMsg').textContent=msg; $('#authMsg').className=bad?'bad':'good'; }
function safeName(name){ return name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120); }
function setSearch(v){ $('#search').value=v; filterCards(); }
function filterCards(){ const q=$('#search').value.trim().toLowerCase(); render(allPrints.filter(p => (`${p.title} ${p.category} ${p.description} ${p.author}`).toLowerCase().includes(q))); }
function render(items){
  $('#cards').innerHTML = items.length ? items.map(p=>`<article class="card">
    <div class="preview">${p.image_url?`<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title)}" loading="lazy">`:'🧱'}</div>
    <div class="content"><span class="pill">${escapeHtml(p.category)}</span><h3>${escapeHtml(p.title)}</h3>
    <div class="meta">Minecraft ${escapeHtml(p.minecraft_version)} • por ${escapeHtml(p.author)}</div>
    <p>${escapeHtml(p.description || 'Sem descrição.')}</p>
    <a class="btn secondary" href="${escapeHtml(p.file_url)}" download target="_blank" rel="noopener">⬇ Baixar ${escapeHtml(p.file_name)}</a>
    ${currentUser?.id===p.user_id?`<button class="danger" onclick="deletePrint(${p.id})">Excluir meu upload</button>`:''}</div></article>`).join('') : '<div class="empty">Nenhum Holoprint encontrado.</div>';
}
async function loadPrints(){ if(!sb) return; const {data,error}=await sb.from('holoprints').select('*').order('created_at',{ascending:false}); if(error){status('Erro ao carregar: '+error.message,true);return;} allPrints=data||[]; filterCards(); }
async function updateUser(){ if(!sb) return; const {data}=await sb.auth.getUser(); currentUser=data.user||null; $('#userState').textContent=currentUser?`Conectado: ${currentUser.email}`:'Você não está conectado.'; $('#logoutBtn').hidden=!currentUser; $('#authBox').hidden=!!currentUser; $('#uploadLocked').hidden=!!currentUser; $('#uploadForm').hidden=!currentUser; render(allPrints); }
async function signUp(){ const email=$('#email').value.trim(), password=$('#password').value; if(!email||password.length<6){authStatus('Use um e-mail válido e senha com pelo menos 6 caracteres.',true);return;} const {error}=await sb.auth.signUp({email,password}); authStatus(error?error.message:'Cadastro criado. Se a confirmação de e-mail estiver ativa, confirme pelo e-mail.',!!error); await updateUser(); }
async function signIn(){ const {error}=await sb.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value}); authStatus(error?error.message:'Login realizado.',!!error); await updateUser(); await loadPrints(); }
async function logout(){ await sb.auth.signOut(); await updateUser(); }
async function deletePrint(id){ if(!confirm('Excluir este Holoprint da lista?')) return; const {error}=await sb.from('holoprints').delete().eq('id',id); if(error) status(error.message,true); else {status('Holoprint excluído da lista.'); await loadPrints();} }
async function publish(e){
 e.preventDefault(); if(!currentUser){status('Entre na sua conta primeiro.',true);return;}
 const f=new FormData(e.target), file=f.get('file'), image=f.get('image'); if(!file?.size){status('Escolha o arquivo do Holoprint.',true);return;} if(file.size>50*1024*1024){status('O arquivo deve ter no máximo 50 MB.',true);return;} if(image?.size>5*1024*1024){status('A imagem deve ter no máximo 5 MB.',true);return;}
 const btn=$('#publishBtn'); btn.disabled=true; btn.textContent='Enviando...';
 try{
   const stamp=Date.now(), filePath=`${currentUser.id}/${stamp}-${safeName(file.name)}`;
   let r=await sb.storage.from('holoprints').upload(filePath,file,{upsert:false}); if(r.error) throw r.error;
   const fileUrl=sb.storage.from('holoprints').getPublicUrl(filePath).data.publicUrl;
   let imageUrl=null;
   if(image?.size){ const imagePath=`${currentUser.id}/${stamp}-${safeName(image.name)}`; r=await sb.storage.from('previews').upload(imagePath,image,{upsert:false}); if(r.error) throw r.error; imageUrl=sb.storage.from('previews').getPublicUrl(imagePath).data.publicUrl; }
   const row={user_id:currentUser.id,title:f.get('title').trim(),author:f.get('author').trim(),minecraft_version:f.get('version'),category:f.get('category'),description:f.get('description').trim(),image_url:imageUrl,file_url:fileUrl,file_name:file.name};
   const {error}=await sb.from('holoprints').insert(row); if(error) throw error;
   e.target.reset(); status('✅ Holoprint publicado!'); await loadPrints(); window.scrollTo({top:$('#explorar').offsetTop-70,behavior:'smooth'});
 }catch(err){status('Erro ao publicar: '+err.message,true);} finally{btn.disabled=false;btn.textContent='Publicar Holoprint';}
}
async function init(){
 if(!configured){ $('#setupNotice').hidden=false; $('#authBox').hidden=true; $('#uploadForm').hidden=true; return; }
 sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY); sb.auth.onAuthStateChange(()=>updateUser());
 $('#loginBtn').onclick=signIn; $('#signupBtn').onclick=signUp; $('#logoutBtn').onclick=logout; $('#uploadForm').addEventListener('submit',publish); $('#search').addEventListener('input',filterCards);
 await updateUser(); await loadPrints();
}
window.setSearch=setSearch; window.deletePrint=deletePrint; init();
