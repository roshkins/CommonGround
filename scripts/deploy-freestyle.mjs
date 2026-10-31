import { Freestyle } from 'freestyle';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { readConfig } from '../lib/config.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const c = readConfig(root);
if (!c.freestyleKey) throw new Error('FREESTYLE_API_KEY is missing. Add it locally; do not paste it in chat.');
const client = new Freestyle({ apiKey: c.freestyleKey });
const file = join(root, 'data', 'freestyle-deployment.json');
mkdirSync(join(root, 'data'), { recursive: true });
let state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const persist = () => writeFileSync(file, JSON.stringify(state, null, 2));
const action = process.argv[2] || 'status';
if (action === 'provision') {
  if (!state.vmId) {
    const listed = await client.vms.list();
    const existing = listed.vms.find(vm => vm.slug === 'commonground-demo');
    if (existing) state.vmId = existing.id;
    else {
      const created = await client.vms.create({ snapshotId: 'freestyle/ubuntu-sm', slug: 'commonground-demo', displayName: 'CommonGround hackathon demo', idleTimeoutSeconds: 900, maxRunSeconds: 21600, maxRunTotalSeconds: 21600,
        firewall: { rules: [
          { action: 'allow', source: {}, destination: { public: true, port: 443, protocol: 'tcp' } },
          { action: 'allow', source: {}, destination: { public: true, port: 80, protocol: 'tcp' } },
          { action: 'allow', source: {}, destination: { public: true, port: 53, protocol: 'udp' } },
          { action: 'allow', source: {}, destination: { public: true, port: 53, protocol: 'tcp' } }
        ] }, metadata: { app: 'commonground', purpose: 'hackathon-demo' } });
      state.vmId = created.vmId;
    }
    persist();
  }
  if (!state.domain) { const suffix = randomBytes(3).toString('hex'); state.domain = `commonground-${suffix}.style.dev`; state.voiceDomain = `commonground-voice-${suffix}.style.dev`; persist(); }
  console.log(JSON.stringify({ vmId: state.vmId, domain: state.domain, voiceDomain: state.voiceDomain }));
} else {
  if (!state.vmId) throw new Error('Provision the intended VM first.');
  const vm = client.vms.ref(state.vmId);
  if (action === 'status') { const v = await vm.data(); console.log(JSON.stringify({ id: v.id, state: v.state, resources: v.resources, domain: state.domain })); }
  else if (action === 'probe') { const r = await vm.exec('node --version; npm --version; bun --version; command -v systemctl'); console.log(JSON.stringify(r)); }
  else if (action === 'upload') {
    await vm.exec('mkdir -p /srv/commonground/data');
    const files = ['server.mjs', 'package.json', 'package-lock.json', 'README.md', '.gitignore'];
    function walk(dir) { if (!existsSync(join(root, dir))) return; for (const ent of readdirSync(join(root, dir), { withFileTypes: true })) { const path = join(dir, ent.name); if (ent.isDirectory()) walk(path); else files.push(path); } }
    for (const dir of ['lib', 'scripts', 'public', 'actors', 'supabase', 'tests', 'docs']) walk(dir);
    const directories = [...new Set(files.map(p => dirname(p).replaceAll('\\', '/')).filter(p => p !== '.'))];
    for (const d of directories) await vm.exec(`mkdir -p /srv/commonground/${d}`);
    for (let i = 0; i < files.length; i += 6) await Promise.all(files.slice(i, i + 6).map(p => vm.fs.writeFile(`/srv/commonground/${relative(root, join(root, p)).replaceAll('\\', '/')}`, readFileSync(join(root, p)))));
    console.log(JSON.stringify({ uploadedFiles: files.length, credentials: 'No credentials uploaded in source-only action.' }));
  }
  else if (action === 'secrets') {
    const env = { OPENAI_API_KEY: c.openaiKey, OPENAI_MODEL: c.model, OPENAI_REASONING_EFFORT: c.reasoningEffort, OPENAI_TRANSCRIPTION_MODEL: c.transcriptionModel,
      SUPABASE_URL: c.supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: c.supabaseKey,
      HOST: '0.0.0.0', PORT: '3000', PUBLIC_ORIGIN: `https://${state.domain}`, DATA_DIR: '/srv/commonground/data',
      WORKSPACE_STORAGE: 'terse', TERSE_ACTOR_URL: 'http://127.0.0.1:7100/v1/projects/commonground/actors', TERSE_API_KEY: c.internalToken,
      INTERNAL_API_TOKEN: c.internalToken, VAPID_PUBLIC_KEY: c.vapidPublicKey, VAPID_PRIVATE_KEY: c.vapidPrivateKey, VAPID_SUBJECT: `https://${state.domain}`,
      TWILIO_ACCOUNT_SID: c.twilioSid, TWILIO_AUTH_TOKEN: c.twilioToken, TWILIO_API_KEY: c.twilioApiKey, TWILIO_API_SECRET: c.twilioApiSecret, TWILIO_PHONE_NUMBER: c.phoneNumber,
      VOICE_PUBLIC_ORIGIN: `https://${state.voiceDomain}`, TWILIO_VOICE_PUBLIC_DOMAIN: state.voiceDomain, VOICE_PORT: '3001', OPENAI_LIVE_MODEL: c.liveModel, OPENAI_LIVE_VOICE: c.liveVoice };
    await vm.fs.writeFile('/srv/commonground/.env', Object.entries(env).map(([k, v]) => `${k}=${JSON.stringify(v || '')}`).join('\n') + '\n', { mode: 0o600 });
    console.log(JSON.stringify({ credentials: 'Only required runtime credentials transferred privately; Freestyle and unused keys excluded.' }));
  }
  else if (action === 'route') {
    state.appRoute ??= await client.tls.rules.create({ action: 'allow', domain: state.domain, source: { public: true }, destination: { vmId: state.vmId, port: 3000 } }); persist();
    state.voiceRoute ??= await client.tls.rules.create({ action: 'allow', domain: state.voiceDomain, source: { public: true }, destination: { vmId: state.vmId, port: 3001 } }); persist();
    console.log(JSON.stringify({ app: `https://${state.domain}`, voice: `https://${state.voiceDomain}` }));
  }
  else if (action === 'exec') {
    const commandFile = process.argv[3]; if (!commandFile) throw new Error('Pass a reviewed local command file.');
    const result = await vm.exec({ command: readFileSync(commandFile, 'utf8'), timeoutMs: 900000, linuxUser: 'root' });
    const safe = JSON.stringify(result);
    // Redact secrets defensively even if a command accidentally emits one.
    let output = safe; for (const v of [c.openaiKey, c.supabaseKey, c.twilioToken, c.twilioApiSecret, c.internalToken, c.vapidPrivateKey]) if (v) output = output.replaceAll(v, '[REDACTED]');
    console.log(output);
  } else throw new Error('Unknown deployment action.');
}
