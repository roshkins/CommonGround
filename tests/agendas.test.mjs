import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAgendaService,chunksFromPages,meetingFromHtml,officialUrl } from '../lib/agendas.mjs';
import { createNotificationStore,validateSubscription,relevance } from '../lib/notifications.mjs';

const fixed=()=>Date.parse('2026-10-31T19:00:00Z');
const futureChunk={id:'meeting:item7',title:'SFMTA CAC · Item 7',text:'Street closures and delivery vehicle access on Grant Avenue.',body:'SFMTA CAC',meetingDate:'2026-11-05T17:30:00-08:00',page:2,item:'7',url:'https://www.sfmta.com/media/50402/download?inline=#page=2',contentHash:'one'};
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}};

test('only official HTTPS SFMTA sources can enter the fetch adapter',()=>{
  assert.throws(()=>officialUrl('https://evil.example/agenda.pdf'));
  assert.throws(()=>officialUrl('http://www.sfmta.com/agenda'));
  assert.throws(()=>officialUrl('https://user:secret@www.sfmta.com/agenda'));
  assert.equal(officialUrl('/media/50302/download?inline='),'https://www.sfmta.com/media/50302/download?inline=');
});

test('scheduled meeting without an attachment stays awaiting publication; dates are not invented',()=>{
  const meeting=meetingFromHtml('<h1>ISCOTT Meeting 1627</h1><a href="https://teams.microsoft.com/x">Join</a>','https://www.sfmta.com/calendar/iscott-meeting-1627',{meetingDate:'2026-11-12T09:00:00-08:00'});
  assert.equal(meeting.documents.length,0);assert.equal(meeting.meetingDate,'2026-11-12T09:00:00-08:00');
  assert.equal(meetingFromHtml('<h1>Future meeting</h1>','https://www.sfmta.com/calendar/future').meetingDate,null);
});

test('date-only HTML attributes use actual hearing text and Pacific offset, not midnight UTC',()=>{
  const url='https://www.sfmta.com/calendar/iscott-meeting-1627';
  const m=meetingFromHtml('<h1>ISCOTT Meeting 1627</h1><time datetime="2026-11-12">Thursday, November 12, 2026 - 9:00am</time>',url);
  assert.equal(m.meetingDate,'2026-11-12T09:00:00-08:00');
});

test('an environmental determination does not hide later numbered items on the same PDF page',()=>{
  const chunks=chunksFromPages([{page:3,text:'Categorically exempt from CEQA\nLong boilerplate to exclude.\nROADWAY SHARED SPACES\nD. Elm Street between Van Ness Avenue and Polk Street\nDecember 7, 2026 through December 6, 2029.'}],{documentId:'doc',title:'ISCOTT',documentUrl:'https://www.sfmta.com/media/50302/download?inline='});
  assert.equal(chunks.length,1);assert.equal(chunks[0].item,'D');assert.equal(chunks[0].page,3);assert.ok(!chunks[0].text.includes('boilerplate'));
});

test('ISCOTT agenda link titled Meeting is accepted; slides and off-site documents are excluded',()=>{
  const meeting=meetingFromHtml('<h1>ISCOTT Meeting 1626</h1><a href="/media/50302/download?inline=">ISCOTT Meeting 1626</a><a href="/media/50353/download?inline=">ISCOTT 1626 Minutes</a><a href="/media/999/download?inline=">Slides</a><a href="https://evil.example/x.pdf">Agenda</a>','https://www.sfmta.com/calendar/iscott-meeting-1626');
  assert.deepEqual(meeting.documents.map(d=>d.kind),['agenda','minutes']);
});

test('item-level chunks preserve exact PDF page and source, including cross-page items',()=>{
  const chunks=chunksFromPages([{page:2,text:'REGULAR CALENDAR\nA. Grant Avenue street closure\nFriday, December 4, 2026\nVehicles need a signed route.'},{page:3,text:'Deliveries need access until 6 pm.\nB. Another long enough proposed street event\nA new topic requiring review.'}],{documentId:'doc',title:'ISCOTT 1626 agenda',body:'ISCOTT',meetingDate:'2026-10-22T09:00:00-07:00',documentUrl:'https://www.sfmta.com/media/50302/download?inline='});
  const a=chunks.find(c=>c.item==='A');assert.equal(a.page,2);assert.ok(a.text.includes('until 6 pm'));assert.match(a.url,/#page=2$/);assert.equal(chunks.find(c=>c.item==='B').page,3);
});

test('baseline inbox matches do not push; changes enqueue once and remain visitor-private',async()=>{
  const db=new DatabaseSync(':memory:');const delivered=[];
  const n=createNotificationStore({db,now:fixed,sendPush:async(s,p)=>delivered.push(p)});
  n.saveWatch('visitor-a',{needs:'Keep delivery access open',streets:['Grant Avenue']});n.subscribe('visitor-a',subscription);
  n.saveWatch('visitor-b',{needs:'Keep delivery access open',streets:['Other Street']});n.subscribe('visitor-b',subscription);
  assert.equal(n.ingest([futureChunk],{baseline:true}),1);await n.flushNotifications();assert.equal(delivered.length,0);
  const changed={...futureChunk,text:futureChunk.text+' Revised closure hours.',contentHash:'two'};
  assert.equal(n.ingest([changed]),1);assert.equal(n.ingest([changed]),0);await n.flushNotifications();await n.flushNotifications();assert.equal(delivered.length,1);
  assert.equal(n.alerts('visitor-b').length,0);assert.equal(n.markRead('visitor-b',n.alerts('visitor-a')[0].id),false);
  assert.equal(n.markRead('visitor-a',n.alerts('visitor-a')[0].id),true);db.close();
});

test('expired subscriptions are removed and user-controlled subscription URLs cannot target arbitrary servers',async()=>{
  assert.throws(()=>validateSubscription({...subscription,endpoint:'https://127.0.0.1/secret'}));
  assert.throws(()=>validateSubscription({...subscription,endpoint:'https://evil.example/collect'}));
  const db=new DatabaseSync(':memory:');const n=createNotificationStore({db,now:fixed,sendPush:async()=>{throw Object.assign(new Error('gone'),{statusCode:410});}});
  n.subscribe('visitor-a',subscription);const result=await n.sendTest('visitor-a');assert.equal(result.delivered,false);assert.equal(result.status,'expired');
  await assert.rejects(()=>n.sendTest('visitor-a'),{status:409});db.close();
});

test('Cantonese needs can match access topics but explicit streets prevent irrelevant geography',()=>{
  assert.ok(relevance({needs:'送貨車需要通行至下午六點',streets:['Grant Avenue']},futureChunk));
  assert.equal(relevance({needs:'delivery access',streets:['Stockton Street']},futureChunk),null);
});

test('sync persists page citations and cursors across restart, has no constructor network calls',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'common-ground-agenda-'));let fetches=0;
  const fakeFetch=async url=>{
    fetches++;const u=String(url);
    if(u.includes('/media/'))return new Response('%PDF-test',{headers:{etag:'v1'}});
    if(u.includes('iscott-meeting-1626'))return new Response('<h1>ISCOTT Meeting 1626</h1><a href="/media/50302/download?inline=">ISCOTT Meeting 1626</a>');
    if(u.includes('november-5-2026'))return new Response('<h1>CAC November 5</h1><a href="/media/50402/download?inline=">Agenda PDF</a>');
    return new Response('<h1>ISCOTT Meeting 1627</h1>');
  };
  const options={root:dir,now:fixed,config:()=>({}),fetchImpl:fakeFetch,parsePdf:async()=>[{page:2,text:'7. Delivery access and street closures on Grant Avenue.\nDiscuss future access and preserve vehicle routes.'}]};
  let s=createAgendaService(options);assert.equal(fetches,0);
  const status=await s.sync();assert.equal(status.baseline,true);assert.equal(status.documents,2);assert.equal(status.vectorReady,false);assert.equal(status.upcomingAwaiting.length,1);
  const result=await s.search({query:'delivery access',period:'upcoming'});assert.equal(result.mode,'local-keyword');assert.equal(result.results.length,1);assert.equal(result.results[0].page,2);
  s.saveWatch('visitor-a',{needs:'delivery access'});s.close();s=createAgendaService(options);assert.ok(s.getStatus().baselineAt);assert.equal(s.getWatch('visitor-a').needs,'delivery access');assert.equal((await s.search({query:'delivery access',period:'past'})).results.length,1);s.close();
  rmSync(dir,{recursive:true,force:true});
});

test('a complete source outage does not advance the successful cursor',async()=>{
  const s=createAgendaService({root:'.',dbPath:':memory:',now:fixed,fetchImpl:async()=>{throw new Error('offline');}});
  await assert.rejects(()=>s.sync());assert.equal(s.getStatus().lastSuccessfulAt,null);assert.ok(s.getStatus().error);s.close();
});

test('Supabase indexing and search use real RPC contracts and never expose the server key',async()=>{
  let embeddingCalls=0;const indexed=[];
  const fakeFetch=async(url,options={})=>{
    const u=String(url);
    if(u==='https://api.openai.com/v1/embeddings'){
      embeddingCalls++;const inputs=JSON.parse(options.body).input;
      assert.equal(JSON.parse(options.body).model,'text-embedding-3-small');
      return Response.json({data:inputs.map((_,index)=>({index,embedding:Array(1536).fill(0.01)}))});
    }
    if(u.includes('replace_agenda_document')){assert.equal(options.headers.apikey,'private-test-key');indexed.push(JSON.parse(options.body));return new Response('');}
    if(u.includes('match_agenda_chunks')){const call=JSON.parse(options.body);assert.equal(call.query_embedding.length,1536);assert.equal(call.period_filter,'upcoming');return Response.json([{id:'matched',title:'Cited agenda item',content:'Street access matters.',meeting_date:'2026-11-05T17:30:00-08:00',metadata:{page:2,item:'7',url:'https://www.sfmta.com/media/50402/download?inline=#page=2'},similarity:0.8}]);}
    if(u.includes('/media/'))return new Response('%PDF-test');
    if(u.includes('iscott-meeting-1626'))return new Response('<h1>ISCOTT Meeting 1626</h1><a href="/media/50302/download?inline=">ISCOTT Meeting 1626</a>');
    if(u.includes('november-5-2026'))return new Response('<h1>CAC November 5</h1><a href="/media/50402/download?inline=">Agenda PDF</a>');
    return new Response('<h1>ISCOTT Meeting 1627</h1>');
  };
  const s=createAgendaService({root:'.',dbPath:':memory:',now:fixed,config:()=>({supabaseUrl:'https://project.supabase.co',supabaseKey:'private-test-key',openaiKey:'private-openai-key'}),fetchImpl:fakeFetch,parsePdf:async()=>[{page:2,text:'7. Street closure and delivery access discussion\nVehicles need to retain access to this street.'}]});
  await s.sync();assert.equal(indexed.length,2);assert.equal(s.getStatus().vectorReady,true);assert.equal(indexed[0].p_chunks[0].page,2);
  const before=embeddingCalls;await s.sync();assert.equal(embeddingCalls,before,'unchanged documents must not be embedded again');
  const search=await s.search({query:'delivery access',period:'upcoming'});assert.equal(search.mode,'supabase-vector');assert.equal(search.results[0].page,2);assert.equal(JSON.stringify(search).includes('private-test-key'),false);s.close();
});

test('a publishable Supabase key never triggers paid embeddings for server-only indexing',async()=>{
  let embeddings=0;
  const fakeFetch=async url=>{
    const u=String(url);if(u.includes('api.openai.com')){embeddings++;throw new Error('must not call');}
    if(u.includes('/media/'))return new Response('%PDF-test');
    if(u.includes('iscott-meeting-1626'))return new Response('<h1>ISCOTT Meeting 1626</h1><a href="/media/50302/download?inline=">ISCOTT Meeting 1626</a>');
    return new Response('<h1>No attachment</h1>');
  };
  const s=createAgendaService({root:'.',dbPath:':memory:',now:fixed,config:()=>({supabaseUrl:'https://project.supabase.co',supabaseKey:'sb_publishable_test',openaiKey:'configured'}),fetchImpl:fakeFetch,parsePdf:async()=>[{page:2,text:'A. Street access is important for this delivery route.'}]});
  await s.sync();assert.equal(embeddings,0);assert.equal(s.getStatus().vectorReady,false);s.close();
});
