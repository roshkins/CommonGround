import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgendaService } from '../lib/agendas.mjs';
import { readConfig } from '../lib/config.mjs';
import { createPhoneService } from '../lib/phone.mjs';

// Invoke with a persistent host scheduler every 15 minutes. A database lease prevents overlap.
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const service=createAgendaService({root,config:()=>readConfig(root)});
try {
  const status=await service.sync({baseline:process.argv.includes('--baseline')});
  const delivery=await service.flushNotifications();
  const phone=createPhoneService({root,config:()=>readConfig(root),workspaces:null,agendas:service});
  const outbound=await service.flushAgendaCalls(intent=>phone.createAgendaCall(intent));
  console.log(JSON.stringify({documents:status.documents,chunks:status.chunks,vectorReady:status.vectorReady,lastSuccessfulAt:status.lastSuccessfulAt,error:status.error,...delivery,outbound}));
  if(status.error)process.exitCode=1;
} catch(error){console.error('Agenda worker failed:',error.message);process.exitCode=1;}
finally{service.close();}
