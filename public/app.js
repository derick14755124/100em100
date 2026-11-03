// Identidade anônima do navegador. Para login futuro, troque getVoterId() pelo token da sessão.
function getVoterId(){let v=localStorage.getItem('voter_id');if(!v){v=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2));localStorage.setItem('voter_id',v);}return v;}
const H={'Content-Type':'application/json','X-Voter-Id':getVoterId()};
let AREAS={},COMBOS={},items=[],tab='top';const $=s=>document.querySelector(s);
const SITE=location.origin+'/';const fmt=n=>n.toLocaleString('pt-BR');
function shareHtml(text,url){const t=encodeURIComponent(text),u=encodeURIComponent(url);
 return `<a target="_blank" rel="noopener" href="https://wa.me/?text=${t}%20${u}">WhatsApp</a><a target="_blank" rel="noopener" href="https://x.com/intent/post?text=${t}&url=${u}">X</a><button type="button" data-copy="${url}">Copiar link</button>`;}
function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),1800);}
document.addEventListener('click',e=>{const c=e.target.closest('[data-copy]');if(c){navigator.clipboard.writeText(c.dataset.copy).then(()=>toast('Link copiado'));}});
async function load(){items=await (await fetch('/api/measures',{headers:H})).json();rerank();render();}
function rerank(){[...items].sort((a,b)=>b.score-a.score||a.impact_rank-b.impact_rank||a.created_at-b.created_at).forEach((x,i)=>x.rank=i+1);}
function hot(m){const age=(Date.now()-m.created_at)/3600000;return (m.recent*2+m.score)/Math.pow(age+2,0.8);}
function div(m){const t=m.ups+m.downs;return t?t*(1-Math.abs(m.ups-m.downs)/t):0;}
function stats(){const v=items.reduce((s,m)=>s+m.ups+m.downs,0),mine=items.filter(m=>m.my_vote).length;
 $('#stats').innerHTML=`<div><b>${fmt(items.length)}</b><span>medidas na lista</span></div><div><b>${fmt(v)}</b><span>votos registrados</span></div><div><b>${fmt(mine)}</b><span>seus votos</span></div>`;}
function card(m){const t=m.ups+m.downs,pa=t?Math.round(m.ups*100/t):0,pc=t?100-pa:0;
 return `<li class="m${m.rank<=3?' top3':''}" id="m${m.id}"><div class="pos" title="Posição no ranking">${m.rank}</div>
 <div class="body"><p class="txt">${esc(m.text)}</p>${m.impact?`<p class="impact">${esc(m.impact)}</p>`:''}
 <div class="meta"><span class="tag${m.combo==='pub'?' pub':''}">${COMBOS[m.combo]||''}</span><span class="tag">${AREAS[m.area]||'Outros'}</span><span class="share">${shareHtml('Medida #'+m.rank+' no 100em100: '+m.text,SITE+'#m'+m.id)}</span></div></div>
 <div class="voting"><div class="btns">
  <button class="btn yes${m.my_vote===1?' on':''}" data-id="${m.id}" data-v="1" aria-pressed="${m.my_vote===1}">✓ Concordo <span class="n">${fmt(m.ups)}</span></button>
  <button class="btn no${m.my_vote===-1?' on':''}" data-id="${m.id}" data-v="-1" aria-pressed="${m.my_vote===-1}">✕ Discordo <span class="n">${fmt(m.downs)}</span></button></div>
  <div class="bar" role="img" aria-label="${pa}% a favor"><i class="a" style="width:${pa}%"></i><i class="c" style="width:${pc}%"></i></div>
  <div class="summary"><span>${t?`<b>${pa}%</b> de aprovação · ${fmt(m.ups)} a favor · ${fmt(m.downs)} contra`:'Ainda sem votos. Seja o primeiro.'}</span><span>Saldo <b>${m.score>0?'+':''}${fmt(m.score)}</b>${m.my_vote?` · <span class="mine">Você ${m.my_vote===1?'concorda':'discorda'}</span>`:''}</span></div></div></li>`;}
function render(){stats();const q=$('#q').value.toLowerCase().normalize('NFD').replace(/\p{M}/gu,''),fa=$('#farea').value,fc=$('#fcombo').value;
 document.querySelectorAll('#chips button').forEach(b=>b.classList.toggle('on',b.dataset.c===fc));
 let l=items.filter(m=>(!fa||m.area===fa)&&(!fc||m.combo===fc)&&(!q||m.text.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').includes(q)));
 if(tab==='top')l.sort((a,b)=>a.rank-b.rank);else if(tab==='new')l.sort((a,b)=>b.created_at-a.created_at);else if(tab==='div')l.sort((a,b)=>div(b)-div(a)||a.rank-b.rank);else l.sort((a,b)=>hot(b)-hot(a));
 $('#list').innerHTML=l.length?l.map(card).join(''):'<p class="muted">Nenhuma medida encontrada.</p>';}
function esc(s){return s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
$('#list').addEventListener('click',async e=>{const b=e.target.closest('.btn');if(!b)return;const id=+b.dataset.id,m=items.find(x=>x.id===id);let v=+b.dataset.v;if(m.my_vote===v)v=0;
 const r=await fetch(`/api/measures/${id}/vote`,{method:'POST',headers:H,body:JSON.stringify({value:v})});const d=await r.json();if(!r.ok)return toast(d.error);
 Object.assign(m,d);rerank();render();toast(v===1?'Voto registrado: Concordo':v===-1?'Voto registrado: Discordo':'Voto retirado');});
$('#form').addEventListener('submit',async e=>{e.preventDefault();const r=await fetch('/api/measures',{method:'POST',headers:H,body:JSON.stringify({text:$('#text').value,area:$('#area').value})});const d=await r.json();
 $('#msg').textContent=r.ok?'Sugestão enviada. Ela já está na lista e pode receber Concordo e Discordo.':d.error;if(r.ok){$('#text').value='';$('#count').textContent='0/200';tab='new';setTab();await load();document.querySelector('#m'+d.id)?.scrollIntoView({block:'center',behavior:'smooth'});}});
$('#text').addEventListener('input',()=>$('#count').textContent=$('#text').value.length+'/200');
$('#q').addEventListener('input',render);$('#farea').addEventListener('change',render);$('#fcombo').addEventListener('change',render);
$('#chips').addEventListener('click',e=>{const b=e.target.closest('button');if(b){$('#fcombo').value=b.dataset.c;render();}});
function setTab(){document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));render();}
$('#tabs').addEventListener('click',e=>{if(e.target.dataset.t){tab=e.target.dataset.t;setTab();}});
(async()=>{AREAS=await (await fetch('/api/areas')).json();COMBOS=await (await fetch('/api/combos')).json();
 $('#fcombo').innerHTML='<option value="">Todos os combos</option>'+Object.entries(COMBOS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
 $('#chips').innerHTML='<button data-c="">Todos</button>'+Object.entries(COMBOS).map(([k,v])=>`<button data-c="${k}">${v}</button>`).join('');
 const o=Object.entries(AREAS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
 $('#area').innerHTML='<option value="out">Área (opcional)</option>'+o;$('#farea').innerHTML='<option value="">Todas as áreas</option>'+o;
 $('#siteShare').innerHTML=shareHtml('100em100: a lista do que o próximo presidente tem que fazer nos primeiros 100 dias. Concorde, discorde e sugira.',SITE);await load();
 if(location.hash&&location.hash!=='#sugira')document.querySelector(location.hash)?.scrollIntoView({block:'center'});})();

let POLL={sim:0,nao:0,my_vote:0};
function renderPoll(){const t=POLL.sim+POLL.nao,pa=t?Math.round(POLL.sim*100/t):0;$('#psim').textContent=fmt(POLL.sim);$('#pnao').textContent=fmt(POLL.nao);
 $('#pba').style.width=pa+'%';$('#pbc').style.width=(t?100-pa:0)+'%';
 document.querySelectorAll('.pb').forEach(b=>{b.classList.toggle('on',+b.dataset.v===POLL.my_vote);b.setAttribute('aria-pressed',+b.dataset.v===POLL.my_vote);});
 $('#pinfo').textContent=POLL.my_vote?`Você respondeu ${POLL.my_vote===1?'Sim':'Não'}. ${t?pa+'% dizem Sim · ':''}Toque de novo para retirar.`:'Um voto por pessoa. Responda e veja as medidas abaixo.';}
document.querySelector('.pbtns').addEventListener('click',async e=>{const b=e.target.closest('.pb');if(!b)return;let v=+b.dataset.v;if(POLL.my_vote===v)v=0;
 const r=await fetch('/api/poll',{method:'POST',headers:H,body:JSON.stringify({value:v})});const d=await r.json();if(!r.ok)return toast(d.error);POLL=d;renderPoll();
 if(v){toast('Resposta registrada. Agora vote nas medidas');setTimeout(()=>$('#ranking').scrollIntoView({behavior:'smooth'}),700);}});
fetch('/api/poll',{headers:H}).then(r=>r.json()).then(d=>{POLL=d;renderPoll();});
