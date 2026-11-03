// 100em100 — servidor Express + SQLite (node:sqlite embutido no Node 22+)
const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');

const PORT = process.env.PORT || 3100;
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'data.db'));
const COMBOS = { jur:'Juros e Dívida', prev:'Previdência', custo:'Custo Brasil', isen:'Isenções e Tributos', maq:'Máquina Pública', just:'Justiça', pol:'Político', soc:'Saúde e Social', edu:'Educação', seg:'Segurança', amb:'Meio Ambiente', inst:'Institucional', pub:'Sugestão do público' };
const AREAS = { est:'Estado e Contas Públicas', pol:'Política e Justiça', seg:'Segurança', eco:'Economia e Tributos', edu:'Educação', sau:'Saúde e Social', inf:'Infraestrutura e Energia', amb:'Meio Ambiente e Agro', out:'Outros' };

db.exec(`
CREATE TABLE IF NOT EXISTS measures(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, area TEXT NOT NULL DEFAULT 'out',
  score INTEGER NOT NULL DEFAULT 0, ups INTEGER NOT NULL DEFAULT 0, downs INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, author_id TEXT, ip_hash TEXT,
  combo TEXT NOT NULL DEFAULT 'pub', impact TEXT, impact_rank INTEGER NOT NULL DEFAULT 100000);
-- voter_id: hoje um id anônimo do navegador; depois pode ser o id de usuário (Google/telefone)
CREATE TABLE IF NOT EXISTS votes(measure_id INTEGER NOT NULL, voter_id TEXT NOT NULL, value INTEGER NOT NULL, ip_hash TEXT, created_at INTEGER NOT NULL,
  PRIMARY KEY(measure_id, voter_id));
CREATE TABLE IF NOT EXISTS poll_votes(voter_id TEXT PRIMARY KEY, value INTEGER NOT NULL, ip_hash TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS votes_time ON votes(created_at);`);

if (db.prepare('SELECT COUNT(*) c FROM measures').get().c === 0) {
  // seed.txt: texto|área|combo|impacto estimado (ordem = ranking de impacto)
  const ins = db.prepare('INSERT INTO measures(text,area,combo,impact,impact_rank,created_at) VALUES(?,?,?,?,?,?)');
  const base = Date.now() - 86400000;
  fs.readFileSync(path.join(__dirname,'seed.txt'),'utf8').trim().split('\n').forEach((l,i)=>{const [t,a,c,im]=l.split('|'); ins.run(t,a,c||'pub',im||null,i+1,base-i);});
}

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ipHash = req => crypto.createHash('sha256').update((req.headers['cf-connecting-ip']||req.ip||'')+'100em100').digest('hex').slice(0,16);
// Rate limit simples em memória por IP
const buckets = new Map();
function limit(name, max, windowMs) {
  return (req,res,next)=>{ const k=name+ipHash(req), now=Date.now(); let b=buckets.get(k);
    if(!b||now>b.reset){b={n:0,reset:now+windowMs};buckets.set(k,b);} if(++b.n>max) return res.status(429).json({error:'Muitas solicitações. Tente de novo em instantes.'}); next(); };
}
// Identidade do votante: ponto único para trocar por sessão de login no futuro
function voterId(req){ const v=String(req.headers['x-voter-id']||''); return /^[a-zA-Z0-9-]{16,64}$/.test(v)?v:null; }

app.get('/api/areas', (req,res)=>res.json(AREAS));
app.get('/api/combos', (req,res)=>res.json(COMBOS));
app.get('/api/measures', (req,res)=>{
  const vid = voterId(req);
  const rows = db.prepare(`SELECT m.id,m.text,m.area,m.score,m.ups,m.downs,m.created_at,m.combo,m.impact,m.impact_rank,
     (SELECT value FROM votes v WHERE v.measure_id=m.id AND v.voter_id=?) my_vote,
     (SELECT COALESCE(SUM(value),0) FROM votes v WHERE v.measure_id=m.id AND v.created_at>?) recent
     FROM measures m`).all(vid||'', Date.now()-86400000);
  // posição oficial = ranking por score
  const ranked=[...rows].sort((a,b)=>b.score-a.score||a.impact_rank-b.impact_rank||a.created_at-b.created_at); ranked.forEach((r,i)=>r.rank=i+1);
  res.json(rows.map(r=>({...r,my_vote:r.my_vote||0})));
});
app.post('/api/measures', limit('post',10,3600000), (req,res)=>{
  const vid=voterId(req); if(!vid) return res.status(400).json({error:'Identificação ausente.'});
  const text=String(req.body.text||'').replace(/\s+/g,' ').trim(); let area=String(req.body.area||'out');
  if(text.length<10||text.length>200) return res.status(400).json({error:'A medida deve ter entre 10 e 200 caracteres.'});
  if(!AREAS[area]) area='out';
  if(db.prepare('SELECT 1 FROM measures WHERE lower(text)=lower(?)').get(text)) return res.status(409).json({error:'Essa medida já está na lista.'});
  const r=db.prepare("INSERT INTO measures(text,area,combo,created_at,author_id,ip_hash) VALUES(?,?,'pub',?,?,?)").run(text,area,Date.now(),vid,ipHash(req));
  res.status(201).json({id:Number(r.lastInsertRowid)});
});
app.post('/api/measures/:id/vote', limit('vote',300,600000), (req,res)=>{
  const vid=voterId(req); if(!vid) return res.status(400).json({error:'Identificação ausente.'});
  const id=Number(req.params.id), value=Number(req.body.value);
  if(![1,-1,0].includes(value)) return res.status(400).json({error:'Voto inválido.'});
  if(!db.prepare('SELECT 1 FROM measures WHERE id=?').get(id)) return res.status(404).json({error:'Medida não encontrada.'});
  db.exec('BEGIN');
  try{
    if(value===0) db.prepare('DELETE FROM votes WHERE measure_id=? AND voter_id=?').run(id,vid);
    else db.prepare(`INSERT INTO votes(measure_id,voter_id,value,ip_hash,created_at) VALUES(?,?,?,?,?)
      ON CONFLICT(measure_id,voter_id) DO UPDATE SET value=excluded.value,created_at=excluded.created_at`).run(id,vid,value,ipHash(req),Date.now());
    db.prepare(`UPDATE measures SET ups=(SELECT COUNT(*) FROM votes WHERE measure_id=? AND value=1),
      downs=(SELECT COUNT(*) FROM votes WHERE measure_id=? AND value=-1) WHERE id=?`).run(id,id,id);
    db.prepare('UPDATE measures SET score=ups-downs WHERE id=?').run(id);
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  const m=db.prepare('SELECT id,score,ups,downs FROM measures WHERE id=?').get(id);
  res.json({...m,my_vote:value});
});
// Pergunta de entrada: "Você concorda que o Brasil precisa de medidas?"
function pollState(vid){const r=db.prepare('SELECT COALESCE(SUM(value=1),0) sim, COALESCE(SUM(value=-1),0) nao FROM poll_votes').get();
  const m=vid?db.prepare('SELECT value FROM poll_votes WHERE voter_id=?').get(vid):null; return {sim:Number(r.sim),nao:Number(r.nao),my_vote:m?m.value:0};}
app.get('/api/poll',(req,res)=>res.json(pollState(voterId(req))));
app.post('/api/poll', limit('poll',60,600000), (req,res)=>{
  const vid=voterId(req); if(!vid) return res.status(400).json({error:'Identificação ausente.'});
  const value=Number(req.body.value); if(![1,-1,0].includes(value)) return res.status(400).json({error:'Voto inválido.'});
  if(value===0) db.prepare('DELETE FROM poll_votes WHERE voter_id=?').run(vid);
  else db.prepare(`INSERT INTO poll_votes(voter_id,value,ip_hash,created_at) VALUES(?,?,?,?) ON CONFLICT(voter_id) DO UPDATE SET value=excluded.value,created_at=excluded.created_at`).run(vid,value,ipHash(req),Date.now());
  res.json(pollState(vid));
});
app.listen(PORT,()=>console.log('100em100 em http://localhost:'+PORT));
