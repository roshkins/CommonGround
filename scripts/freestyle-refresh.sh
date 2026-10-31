set -eu
cd /srv/commonground
systemctl restart commonground-app commonground-voice
systemctl start commonground-agendas
systemctl is-active commonground-app commonground-voice commonground-actors commonground-relay commonground-agendas.timer
/opt/commonground-node/bin/node --input-type=module -e 'import {createAgendaService} from "./lib/agendas.mjs"; import{readConfig}from"./lib/config.mjs"; const s=createAgendaService({root:process.cwd(),config:()=>readConfig(process.cwd())}); console.log(JSON.stringify(s.getStatus()));s.close();'
