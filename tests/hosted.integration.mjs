// Manual, paid, hosted verification. This file is intentionally outside *.test.mjs.
// Run only after authorization: node tests/hosted.integration.mjs --run-paid
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile,mkdir } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

if(!process.argv.includes('--run-paid')){
  console.error('This manual verification uses paid live models. Supply --run-paid only after authorization.');
  process.exitCode=1;
}else{
  const base='https://commonground-ac9dc2.style.dev';
  const output=resolve('artifacts/hosted-proof.json');
  const proof={label:'FICTIONAL PRIVATE INTEGRATION TEST — NOT REAL BUSINESS CONSENT — NOT SUBMITTED',base,startedAt:new Date().toISOString(),stages:[],checks:{},proposal:null,revisedProposal:null,agendaResults:[]};
  const started=performance.now();let state;
  function client(){
    let cookie='';
    return {async request(path,{data,expected=200}={}){
      const headers={Origin:base,Accept:'application/json'};
      if(cookie)headers.Cookie=cookie;
      if(data)headers['Content-Type']='application/json';
      const response=await fetch(base+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(300000)});
      const set=response.headers.getSetCookie?.()||[];
      for(const value of set)if(value.startsWith('cg_visitor='))cookie=value.split(';')[0];
      let result;try{result=await response.json();}catch{throw new Error(`${path} returned non-JSON HTTP ${response.status}; no response body logged.`);}
      if(response.status!==expected)throw Object.assign(new Error(`${path} returned HTTP ${response.status}: ${String(result.error||'Unexpected status').slice(0,600)}`),{status:response.status});
      return result;
    }};
  }
  const a=client();const b=client();
  async function stage(name,work){
    const t=performance.now();
    try{const result=await work();const seconds=Number(((performance.now()-t)/1000).toFixed(3));proof.stages.push({name,status:'passed',seconds});console.log(JSON.stringify({stage:name,status:'passed',seconds}));return result;}
    catch(error){const seconds=Number(((performance.now()-t)/1000).toFixed(3));proof.stages.push({name,status:'failed',seconds,error:error.message});throw error;}
  }
  const post=async(path,data)=>{state=await a.request(path,{data:{participant:'garage',revision:state.revision,...data}});assert.equal(state.workspace.mode,'private','Test must never leave its private workspace.');return state;};
  try{
    state=await stage('private-session',()=>a.request('/api/state?participant=garage'));
    assert.equal(state.workspace.mode,'private');assert.ok(state.id.startsWith('private-'));
    assert.equal(state.contributors.length,0);assert.equal(state.proposal,null);assert.equal(state.services.model,'gpt-6.1-terra');
    proof.model=state.services.model;proof.persistence=state.services.persistence;
    const marker=`KEEP_PRIVATE_${randomUUID()}`;
    const concern=`This is a fictional private integration test for a demo garage. Cars must be able to enter our garage. Deliveries need access until 6 pm. I could support only a two-event market trial after deliveries finish, with a signed vehicle route to the garage and amplified music ending at 9 pm. Private note, exclude this from any shared brief: ${marker}.`;
    const brief='Fictional garage demo: deliveries need access until 6 pm. A market may start only after deliveries finish, while a signed route keeps cars able to enter the garage. Support is conditional on a two-event trial and amplified music ending at 9 pm.';
    await stage('live-understanding',()=>post('/api/understand',{text:concern,language:'en',mode:'live'}));
    assert.equal(state.self.draft.understanding.allowed,true);assert.ok(state.self.draft.original.includes(marker));
    const otherBefore=await stage('second-private-session',()=>b.request('/api/state?participant=garage'));
    assert.equal(otherBefore.workspace.mode,'private');assert.notEqual(otherBefore.id,state.id);assert.equal(otherBefore.self.draft,null);assert.ok(!JSON.stringify(otherBefore).includes(marker));
    const draftId=state.self.draft.id;
    await stage('explicit-reviewed-relay-share',()=>post('/api/share',{brief,draftId,consent:true,transport:'relaycast'}));
    assert.equal(state.contributors.length,1);assert.equal(state.approvals.length,1);
    const shareReceipts=state.exchanges.filter(e=>e.verified===true);
    assert.ok(shareReceipts.length>=2,'Actual reviewed-send receipts must exist.');assert.ok(!JSON.stringify(state.exchanges).includes(marker));
    await stage('live-relay-negotiation',()=>post('/api/negotiate',{mode:'live',transport:'relaycast'}));
    assert.equal(state.proposal.mode,'live');assert.equal(state.proposal.transport,'relaycast');assert.equal(state.allApproved,false);
    assert.ok(state.exchanges.every(e=>e.verified===true),'No simulated receipt may enter this proof.');
    proof.receiptCount=state.exchanges.length;proof.shareReceiptCount=shareReceipts.length;
    proof.receipts=state.exchanges.map(e=>({id:e.id,from:e.from,to:e.to,verified:e.verified,kind:e.payload?.kind}));
    proof.proposal={version:state.proposal.version,content:state.proposal.content,critiqueIssues:state.proposal.critiqueIssues,mode:state.proposal.mode,transport:state.proposal.transport};
    const firstVersion=state.proposal.version;
    await stage('fictional-operator-version-approval',()=>post('/api/decision',{version:firstVersion,status:'approved',reviewed:true}));
    assert.equal(state.allApproved,true);assert.equal(state.approvals.length,1);assert.equal(state.approvals[0].status,'approved');
    await stage('live-bilingual-material-revision',()=>post('/api/revise',{version:firstVersion,note:'Change the amplified music cutoff from 9 pm to 8 pm. Keep the two-event trial, deliveries until 6 pm, the later market start, and a signed vehicle route into the garage. Produce this actual change in both English and Traditional Chinese.',mode:'live',transport:'relaycast'}));
    assert.equal(state.proposal.version,firstVersion+1);assert.equal(state.allApproved,false);assert.ok(state.approvals.every(x=>x.status==='pending'));assert.equal(state.proposal.translationPending,false);
    assert.ok(state.proposal.content.en.terms.some(t=>/amplified/i.test(t)&&/8\s*(?:p\.?m\.?|:00\s*p\.?m\.?|o['’]?clock)|20:00|eight\s+p\.?m\.?/i.test(t)),'English amplified-music terms must contain the actual 8 pm cutoff.');
    assert.ok(state.proposal.content['zh-Hant'].terms.some(t=>/擴音/.test(t)&&/(?:晚上|晚間|下午)?\s*[8八]\s*(?:時|點)|20[:：]00/.test(t)),'Traditional Chinese amplified-music terms must carry the changed cutoff.');
    proof.checks.bilingualEightPm=true;
    proof.revisedProposal={version:state.proposal.version,content:state.proposal.content,critiqueIssues:state.proposal.critiqueIssues,translationPending:state.proposal.translationPending};
    const stale=await stage('old-version-rejected',()=>a.request('/api/decision',{expected:409,data:{participant:'garage',revision:state.revision,version:firstVersion,status:'approved',reviewed:true}}));
    assert.ok(stale.error);proof.checks.oldVersionHttp=409;proof.checks.approvalReset=true;proof.checks.singleContributorOnly=true;
    const otherAfter=await stage('isolation-after-negotiation',()=>b.request('/api/state?participant=garage'));
    assert.equal(otherAfter.self.draft,null);assert.equal(otherAfter.proposal,null);assert.equal(otherAfter.contributors.length,0);assert.ok(!JSON.stringify(otherAfter).includes(marker));proof.checks.visitorIsolation=true;
    for(const [period,query]of[['past','Grant Avenue Winter Walk street closure'],['upcoming','legislative program safe school accessibility']]){
      const result=await stage(`hosted-agendas-${period}`,()=>a.request(`/api/agendas?period=${period}&q=${encodeURIComponent(query)}`));
      assert.equal(result.mode,'supabase-vector');assert.ok(result.results.length>0);
      proof.agendaResults.push({period,mode:result.mode,results:result.results.slice(0,3).map(x=>({title:x.title,page:x.page,item:x.item,url:x.url,meetingDate:x.meetingDate,score:x.score}))});
    }
    proof.status='passed';proof.completedAt=new Date().toISOString();proof.totalSeconds=Number(((performance.now()-started)/1000).toFixed(3));
    console.log(JSON.stringify({status:'passed',model:proof.model,persistence:proof.persistence,receiptCount:proof.receiptCount,version:proof.revisedProposal.version,totalSeconds:proof.totalSeconds,artifact:output}));
  }catch(error){proof.status='failed';proof.error=error.message;proof.completedAt=new Date().toISOString();proof.totalSeconds=Number(((performance.now()-started)/1000).toFixed(3));process.exitCode=1;console.error(JSON.stringify({status:'failed',error:error.message,artifact:output}));}
  finally{await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(proof,null,2)+'\n');}
}
