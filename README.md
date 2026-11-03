Movimento cidadão e apartidário: o povo propõe e vota as 100 ações que o próximo presidente deve cumprir nos primeiros 100 dias de mandato, em 2031.

# 100em100 — Cem ações em 100 dias

Stack v1: Node 22+ (Express) + SQLite embutido (`node:sqlite`, sem dependência nativa) + frontend estático em `public/`.

## Rodar
    npm install && node server.js        # http://localhost:3100  (PORT, DB_PATH opcionais)
O banco `data.db` é criado e populado com as 100 medidas de `seed.txt` (formato `texto|área|combo|impacto`, a ordem do arquivo é o ranking de impacto usado como desempate) na primeira execução. Para zerar: apague `data.db`.

## API
- `GET /api/areas`
- `GET /api/measures` → lista com `rank`, `score`, `ups`, `downs`, `my_vote`, `recent` (saldo de votos nas últimas 24h, usado em "Em alta")
- `POST /api/measures` `{text, area}` → 10 a 200 caracteres, duplicadas rejeitadas, máx. 10/h por IP
- `POST /api/measures/:id/vote` `{value: 1|-1|0}` → 0 remove o voto; máx. 300/10min por IP
Votante identificado pelo cabeçalho `X-Voter-Id` (UUID anônimo do localStorage). Tabela `votes` tem PK `(measure_id, voter_id)` = um voto por pessoa por medida.

## Login futuro (Google / telefone)
Troque `voterId(req)` em `server.js` para ler o usuário da sessão (ex.: JWT do Supabase Auth) e `getVoterId()`/`H` em `public/app.js` para enviar o token. O esquema não muda: `voter_id` passa a ser o id do usuário.

## Deploy permanente em 100em100.com.br (Vercel + Supabase)
Contas: GitHub, Vercel (Hobby grátis serve para começar; Pro para uso comercial/tráfego alto), Supabase (Free; Pro US$25/mês para não pausar e ter backups), e acesso ao painel do Registro.br do domínio.
1. Supabase: criar projeto (região São Paulo, sa-east-1). No SQL editor, criar as tabelas `measures` e `votes` (mesmo esquema, `id bigserial`, `created_at timestamptz`) e importar `seed.txt`. Criar uma função `vote(measure_id, voter_id, value)` em plpgsql que faz upsert/delete e recalcula `score` na mesma transação.
2. Código: mover as rotas de `server.js` para funções serverless em `api/` (Vercel) usando `@supabase/supabase-js` com a service role key (só no servidor). `public/` vira o diretório estático. Rate limit: Upstash Redis (integração Vercel) ou Vercel Firewall rate limiting, já que memória não persiste em serverless.
3. Vercel: importar o repositório do GitHub, definir `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` nas Environment Variables, deploy.
4. Domínio: em Vercel → Settings → Domains adicionar `100em100.com.br` e `www.100em100.com.br`. No Registro.br, em DNS do domínio, criar `A @ 76.76.21.21` e `CNAME www cname.vercel-dns.com` (ou delegar os nameservers para a Vercel). HTTPS é automático.
5. Login (fase 2): Supabase Auth → habilitar Google (OAuth client no Google Cloud Console) e Phone (provedor SMS, ex. Twilio — tem custo por SMS).
6. Antiabuso recomendado antes de divulgar: Cloudflare Turnstile no envio de medidas e na primeira votação.

Alternativa mais simples sem reescrever: um VPS/Render/Railway/Fly.io rodando este `server.js` como está com disco persistente, apontando o domínio para lá.
