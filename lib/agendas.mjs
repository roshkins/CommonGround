import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createNotificationStore, POLL_MS, relevance, validateWatch, visitorKey } from './notifications.mjs';

export const AGENDA_SOURCE = 'https://www.sfmta.com/meetings-events';
const ARCHIVE = 'https://www.sfmta.com/past-meetings-and-events/2609';
export const INITIAL_MEETINGS = [
  { id: 'iscott-1626', body: 'ISCOTT', meetingDate: '2026-10-22T09:00:00-07:00', url: 'https://www.sfmta.com/calendar/iscott-meeting-1626', title: 'ISCOTT Meeting 1626' },
  { id: 'sfmta-cac-2026-11-05', body: 'SFMTA CAC', meetingDate: '2026-11-05T17:30:00-08:00', url: 'https://www.sfmta.com/calendar/citizens-advisory-council-cac-regular-meeting-november-5-2026', title: 'SFMTA CAC — November 5, 2026' },
  { id: 'iscott-1627', body: 'ISCOTT', meetingDate: '2026-11-12T09:00:00-08:00', url: 'https://www.sfmta.com/calendar/iscott-meeting-1627', title: 'ISCOTT Meeting 1627' },
];
const sha = value => createHash('sha256').update(value).digest('hex');
const issue = (message, status = 400) => Object.assign(new Error(message), { status });
const serverCorpusKey = key => {
  if(!key||key.startsWith('sb_publishable_'))return false;
  if(key.startsWith('eyJ')){
    try{return JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8')).role==='service_role';}catch{return false;}
  }
  return true; // Secret keys are checked by Supabase; this is only an early accidental-publishable-key guard.
};
const decode = value => String(value).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function officialUrl(value, base = AGENDA_SOURCE) {
  const u = new URL(decode(value), base);
  if (u.protocol !== 'https:' || !['www.sfmta.com','sfmta.com'].includes(u.hostname) || u.username || u.password || u.port) throw issue('Only official SFMTA source URLs are supported.');
  u.hostname = 'www.sfmta.com'; u.hash = ''; return u.href;
}
export function linksFromHtml(html, base) {
  const links = [];
  for (const match of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try { links.push({ url: officialUrl(match[1],base), title: decode(match[2]) }); } catch { /* Reject off-site links, JavaScript, mailto, and translated navigation. */ }
  }
  return links;
}
const MONTHS = { january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };
export function meetingFromHtml(html, url, known = {}) {
  const title = decode(String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || known.title || 'SFMTA public meeting');
  let meetingDate = known.meetingDate;
  if (!meetingDate) {
    const timeElement = String(html).match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/i);
    const t = timeElement?.[1];
    if (t?.includes('T') && Number.isFinite(Date.parse(t))) meetingDate = new Date(t).toISOString();
    else {
      const text = decode(timeElement?.[2] || html);
      const m = text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})\s*(?:-|–)?\s*(\d{1,2}):(\d{2})\s*(am|pm)/i);
      if (m) {
        const month=MONTHS[m[1].toLowerCase()];const hour=Number(m[4])%12+(m[6].toLowerCase()==='pm'?12:0);
        const offsetName=new Intl.DateTimeFormat('en',{timeZone:'America/Los_Angeles',timeZoneName:'shortOffset'}).formatToParts(new Date(Date.UTC(Number(m[3]),month,Number(m[2]),hour,Number(m[5])))).find(p=>p.type==='timeZoneName').value;
        const offset=offsetName==='GMT-7'?'-07:00':'-08:00';
        meetingDate=`${m[3]}-${String(month+1).padStart(2,'0')}-${m[2].padStart(2,'0')}T${String(hour).padStart(2,'0')}:${m[5]}:00${offset}`;
      }
    }
  }
  const id = known.id || /iscott-meeting-(\d+)/i.exec(url)?.[1] || sha(url).slice(0,20);
  const documents = [];
  for (const link of linksFromHtml(html,url)) {
    if (!/\/media\/\d+\/download|\.pdf(?:\?|$)/i.test(link.url)) continue;
    // Only meeting agendas and minutes. Slides and unrelated report attachments are outside this bounded corpus.
    if (!/agenda|minutes/i.test(link.title) && !(/^ISCOTT\s+Meeting\s+\d+/i.test(link.title))) continue;
    const kind = /minutes/i.test(link.title) ? 'minutes' : 'agenda';
    if (kind === 'minutes' && known.body === 'SFMTA CAC') continue; // Linked CAC minutes concern a different, previous meeting.
    if (!documents.some(d=>d.url===link.url)) documents.push({ ...link, kind });
  }
  return { ...known, id: String(id), title, url: officialUrl(url), meetingDate: meetingDate || null, body: known.body || (/ISCOTT/i.test(title)?'ISCOTT':'SFMTA CAC'), documents };
}

export function chunksFromPages(pages, metadata) {
  const result = []; let active = null; let skipBlock=false;
  const finish = () => {
    if (!active) return;
    const text = active.lines.join('\n').trim();
    if (text.length >= 25) {
      for (let offset = 0, part = 0; offset < text.length; offset += 2200, part++) {
        const content = text.slice(offset,offset+2400);
        result.push({ ...metadata, id: `${metadata.documentId}:${active.item || 'page'+active.page}:${part}`, item: active.item, page: active.page, text: content, title: `${metadata.title}${active.item ? ' · Item '+active.item : ''}`, url: `${metadata.documentUrl}#page=${active.page}`, contentHash: sha(content), embedding: undefined });
      }
    }
    active = null;
  };
  for (const page of pages) {
    for (const line of page.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)) {
      if (/^ISCOTT\s+(Agenda|Minutes)\s+\d+(?:\s|$)/i.test(line) || /^Page\s+\d+\s+of/i.test(line)) continue;
      if (/^(?:\**SUPPORTING\s+DOCUMENTATION|Know\s+Your\s+Rights|Lobbyist\s+Registration|ADJOURN)/i.test(line)) { finish(); break; }
      if (/^Categorically\s+exempt/i.test(line)) { finish();skipBlock=true;continue; }
      const marker = /^([A-Z]{1,2}|\d{1,2})[.)]\s+(.+)/.exec(line);
      if (marker) { finish();skipBlock=false;active = { item: marker[1], page: page.page, lines: [marker[2]] }; }
      else {
        if(skipBlock)continue;
        if (!active) active = { item: null, page: page.page, lines: [] };
        active.lines.push(line);
      }
    }
    // Keep a real item across page breaks; page-only context stays on its original page.
    if (active && !active.item) finish();
  }
  finish();
  return result.slice(0,80);
}

export async function extractPdfPages(buffer) {
  if (buffer.length > 12 * 1024 * 1024 || !buffer.subarray(0,5).equals(Buffer.from('%PDF-'))) throw issue('Invalid or oversized agenda PDF.');
  // Import the library implementation directly: pdf-parse's package entry runs its sample in some ESM callers.
  const { default: parse } = await import('pdf-parse/lib/pdf-parse.js');
  const pages = [];
  await parse(buffer, { max: 25, pagerender: async page => {
    const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
    let previousY = null; let text = '';
    for (const item of content.items) {
      const y = item.transform?.[5];
      text += previousY !== null && Math.abs(y-previousY) > 2 ? '\n' : (text ? ' ' : '');
      text += item.str; previousY = y;
    }
    pages.push({ page: (page.pageIndex ?? pages.length) + 1, text }); return text;
  } });
  if (!pages.some(p=>p.text.trim().length>20)) throw issue('No readable text was found in this PDF. The original source remains available.');
  return pages.sort((a,b)=>a.page-b.page);
}

export function createAgendaService({ root, config = () => ({}), dbPath = join(config().dataDir || join(root,'data'),'agendas.sqlite'), fetchImpl = fetch, parsePdf = extractPdfPages, now = () => Date.now(), sendPush } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS agenda_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agenda_documents(id TEXT PRIMARY KEY,body TEXT NOT NULL,hash TEXT NOT NULL,etag TEXT,modified TEXT);
    CREATE TABLE IF NOT EXISTS agenda_chunks(id TEXT PRIMARY KEY,document_id TEXT NOT NULL,body TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS agenda_chunks_document ON agenda_chunks(document_id);`);
  const notifications = createNotificationStore({ db,config,now,sendPush });
  const set = (k,v) => db.prepare('INSERT INTO agenda_meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,JSON.stringify(v));
  const get = (k,fallback=null) => { const r=db.prepare('SELECT value FROM agenda_meta WHERE key=?').get(k); return r?JSON.parse(r.value):fallback; };
  const iso = () => new Date(now()).toISOString();
  const localChunks = () => db.prepare('SELECT body FROM agenda_chunks').all().map(r=>JSON.parse(r.body));
  const present = chunk => { const { embedding, ...r }=chunk; return { ...r, period: Date.parse(r.meetingDate)>=now()?'upcoming':'past' }; };
  async function request(url, options = {}, max = 12*1024*1024) {
    const response = await fetchImpl(url,{...options,signal:AbortSignal.timeout(25000)});
    if (!response.ok && response.status !==304 && !(options.redirect==='manual'&&[301,302,303,307,308].includes(response.status))) throw issue(`Source request failed (${response.status}).`,502);
    if (Number(response.headers.get('content-length')) > max) throw issue('Source exceeds the size limit.',502);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length>max) throw issue('Source exceeds the size limit.',502);
    return { response,data };
  }
  async function official(url, options = {}) {
    let target=officialUrl(url);
    for(let redirects=0;redirects<4;redirects++) {
      const r=await request(target,{...options,redirect:'manual'});
      if([301,302,303,307,308].includes(r.response.status)) {
        target=officialUrl(r.response.headers.get('location'),target);continue;
      }
      return r;
    }
    throw issue('The official source redirected too many times.',502);
  }
  async function rest(path, payload) {
    const c=config();
    if (!c.supabaseUrl || !serverCorpusKey(c.supabaseKey)) throw issue('Supabase requires a server-side secret or service_role key for this private corpus.',503);
    const base = new URL(c.supabaseUrl);
    if (base.protocol!=='https:' || base.username || base.password) throw issue('Invalid Supabase server configuration.',503);
    const headers={apikey:c.supabaseKey,'Content-Type':'application/json'};
    if (c.supabaseKey.startsWith('eyJ')) headers.Authorization=`Bearer ${c.supabaseKey}`;
    const {data}=await request(`${base.origin}/rest/v1/${path}`,{method:'POST',headers,body:JSON.stringify(payload)});
    return data.length ? JSON.parse(data.toString('utf8')) : null;
  }
  async function embed(texts) {
    const c=config(); if (!c.openaiKey) throw issue('OpenAI embeddings are not configured.',503);
    const {data}=await request('https://api.openai.com/v1/embeddings',{method:'POST',headers:{Authorization:`Bearer ${c.openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'text-embedding-3-small',dimensions:1536,input:texts})});
    const result=JSON.parse(data.toString('utf8'));
    const vectors=result.data?.sort((a,b)=>a.index-b.index).map(x=>x.embedding);
    if (!vectors || vectors.length!==texts.length || vectors.some(v=>v.length!==1536 || v.some(n=>!Number.isFinite(n)))) throw issue('Invalid embedding response.',502);
    return vectors;
  }
  async function upload(document,chunks) {
    const c=config(); if (!c.supabaseUrl || !c.supabaseKey || !c.openaiKey) return false;
    if(!serverCorpusKey(c.supabaseKey))throw issue('Supabase requires a server-side secret or service_role key for this private corpus.',503);
    let vectors=chunks.map(x=>x.embedding);
    if (vectors.some(v=>!v)) vectors=await embed(chunks.map(x=>`${x.body}\n${x.title}\nHearing: ${x.meetingDate}\n${x.text}`));
    await rest('rpc/replace_agenda_document',{p_document:{id:document.id,title:document.title,body:document.body,meeting_date:document.meetingDate,url:document.url,meeting_url:document.meetingUrl,kind:document.kind,content_hash:document.contentHash,metadata:document},p_chunks:chunks.map((x,i)=>({id:x.id,item:x.item,page:x.page,title:x.title,text:x.text,embedding:vectors[i],metadata:present(x)}))});
    for(let i=0;i<chunks.length;i++) chunks[i].embedding=vectors[i];
    return true;
  }
  const service={
    ...notifications,
    getStatus() {
      const c=config(); const meetings=get('meetings',[]);
      return {source:'SFMTA ISCOTT and Citizens’ Advisory Council',sourceUrl:AGENDA_SOURCE,lastAttemptAt:get('lastAttemptAt'),lastSuccessfulAt:get('lastSuccessfulAt'),nextCheckAt:get('lastSuccessfulAt')?new Date(Date.parse(get('lastSuccessfulAt'))+POLL_MS).toISOString():null,documents:db.prepare('SELECT COUNT(*) AS n FROM agenda_documents').get().n,chunks:db.prepare('SELECT COUNT(*) AS n FROM agenda_chunks').get().n,vectorReady:Boolean(c.supabaseUrl&&serverCorpusKey(c.supabaseKey)&&get('vectorReady',false)),upcomingAwaiting:meetings.filter(m=>Date.parse(m.meetingDate)>=now()&&!m.documents.some(d=>d.kind==='agenda')).map(m=>({title:m.title,url:m.url,meetingDate:m.meetingDate,status:'Meeting scheduled; agenda not yet published'})),meetings:meetings.map(m=>({...m,period:Date.parse(m.meetingDate)>=now()?'upcoming':'past'})),error:get('error'),baselineAt:get('baselineAt')};
    },
    async search({query='',period='all',limit=6,visitorId}={}) {
      if (!['all','past','upcoming'].includes(period)) throw issue('Choose past, upcoming, or all meetings.');
      query=String(query).trim(); if(query.length>1500) throw issue('Search is limited to 1500 characters.');
      limit=Math.min(12,Math.max(1,Number(limit)||6));
      if(visitorId) visitorKey(visitorId);
      if(query&&service.getStatus().vectorReady) {
        try {
          const [vector]=await embed([query]);
          const rows=await rest('rpc/match_agenda_chunks',{query_embedding:vector,match_count:limit,match_threshold:0.2,period_filter:period,as_of:iso()});
          return {results:(rows??[]).map(r=>({...r.metadata,id:r.id,title:r.title,text:r.content,score:r.similarity,period:Date.parse(r.meeting_date)>=now()?'upcoming':'past'})),mode:'supabase-vector',status:service.getStatus()};
        } catch { /* Preserve usable cited local results without claiming vector retrieval succeeded. */ }
      }
      let chunks=localChunks().filter(x=>period==='all'||(Date.parse(x.meetingDate)>=now()?'upcoming':'past')===period);
      if(query) chunks=chunks.map(x=>({...x,score:relevance({needs:query,streets:[]},x)?.score??0})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
      else chunks.sort((a,b)=>Date.parse(b.meetingDate)-Date.parse(a.meetingDate));
      return {results:chunks.slice(0,limit).map(present),mode:'local-keyword',status:service.getStatus()};
    },
    saveWatch(visitor,input) {
      const watch=notifications.saveWatch(visitor,input);
      // Newly saved watches get a current inbox snapshot; old documents never generate push spam.
      notifications.ingest(localChunks(),{baseline:true}); return watch;
    },
    async sync({baseline=false}={}) {
      const owner=randomUUID();
      db.exec('BEGIN IMMEDIATE');
      try {
        const lease=get('syncLease');
        if(lease&&lease.until>now()){db.exec('ROLLBACK');return {...service.getStatus(),busy:true};}
        set('syncLease',{owner,until:now()+12*60*1000});db.exec('COMMIT');
      } catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}
      set('lastAttemptAt',iso());set('error',null);
      const initial=baseline||!get('baselineAt'); const errors=[]; let remote=true;
      try {
        const catalog=new Map(INITIAL_MEETINGS.map(m=>[m.url,m]));
        for(const index of [ARCHIVE,AGENDA_SOURCE]) {
          try {
            const {data}=await official(index);const links=linksFromHtml(data.toString('utf8'),index).filter(l=>/\/calendar\/iscott-meeting-/i.test(l.url));
            for(const link of links.slice(0,index===ARCHIVE?3:4)) if(!catalog.has(link.url)) catalog.set(link.url,{url:link.url,title:link.title,body:'ISCOTT'});
          } catch {errors.push('Could not refresh one meeting index; retaining previously known sources.');}
        }
        const meetings=[];let pastDocuments=0;
        for(const seed of catalog.values()) {
          try {
            const {data}=await official(seed.url);const meeting=meetingFromHtml(data.toString('utf8'),seed.url,seed);
            if(!meeting.meetingDate) {errors.push(`Could not verify meeting date: ${meeting.title}`);continue;}
            meetings.push(meeting);
            for(const link of meeting.documents) {
              const past=Date.parse(meeting.meetingDate)<now(); if(past&&pastDocuments>=8)continue;if(past)pastDocuments++;
              try {
                const documentId=sha(link.url).slice(0,24);const old=db.prepare('SELECT * FROM agenda_documents WHERE id=?').get(documentId);
                const headers={};if(old?.etag)headers['If-None-Match']=old.etag;if(old?.modified)headers['If-Modified-Since']=old.modified;
                const fetched=await official(link.url,{headers});
                if(fetched.response.status===304) {
                  const oldDoc=JSON.parse(old.body);
                  if(!oldDoc.vectorReady) {const oldChunks=db.prepare('SELECT body FROM agenda_chunks WHERE document_id=?').all(documentId).map(r=>JSON.parse(r.body));const ok=await upload(oldDoc,oldChunks);oldDoc.vectorReady=ok;remote=remote&&ok;db.prepare('UPDATE agenda_documents SET body=? WHERE id=?').run(JSON.stringify(oldDoc),documentId);}
                  continue;
                }
                const contentHash=sha(fetched.data);
                if(old?.hash===contentHash&&JSON.parse(old.body).vectorReady)continue;
                const pages=await parsePdf(fetched.data);
                const document={id:documentId,documentId,title:`${meeting.title} ${link.kind}`,body:meeting.body,meetingDate:meeting.meetingDate,meetingUrl:meeting.url,documentUrl:link.url,url:link.url,kind:link.kind,contentHash,fetchedAt:iso()};
                const chunks=chunksFromPages(pages,document);
                if(!chunks.length)throw issue('PDF produced no readable cited items.');
                try {document.vectorReady=await upload(document,chunks);remote=remote&&document.vectorReady;} catch {document.vectorReady=false;remote=false;errors.push('Supabase vector indexing is unavailable; cited local extraction was retained.');}
                db.exec('BEGIN IMMEDIATE');
                try {
                  db.prepare('INSERT INTO agenda_documents VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,hash=excluded.hash,etag=excluded.etag,modified=excluded.modified').run(documentId,JSON.stringify(document),contentHash,fetched.response.headers.get('etag'),fetched.response.headers.get('last-modified'));
                  db.prepare('DELETE FROM agenda_chunks WHERE document_id=?').run(documentId);
                  const insert=db.prepare('INSERT INTO agenda_chunks VALUES(?,?,?)');for(const chunk of chunks)insert.run(chunk.id,documentId,JSON.stringify(chunk));
                  db.exec('COMMIT');
                }catch(e){db.exec('ROLLBACK');throw e;}
                notifications.ingest(chunks,{baseline:initial});
              }catch {errors.push(`Could not index ${meeting.title} ${link.kind}; the original source is still available.`);}
            }
          }catch {errors.push(`Could not refresh ${seed.title}; retaining previous records.`);}
        }
        if(meetings.length)set('meetings',meetings);
        const docs=db.prepare('SELECT body FROM agenda_documents').all().map(r=>JSON.parse(r.body));
        set('vectorReady',docs.length>0&&docs.every(d=>d.vectorReady));
        if(!meetings.length)throw issue('Government sources could not be reached; no successful sync was recorded.',502);
        set('lastSuccessfulAt',iso());if(initial)set('baselineAt',iso());set('error',errors.length?[...new Set(errors)].join(' '):null);
        return {...service.getStatus(),baseline:initial};
      } catch(error){set('error',error.message);throw error;}
      finally {if(get('syncLease')?.owner===owner)set('syncLease',null);}
    },
    close(){db.close();},
  };
  return service;
}
