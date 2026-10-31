import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { join } from 'node:path';

export function readConfig(root) {
  const path = join(root, '.env');
  const local = existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
  const secretsPath = join(root, 'data', 'runtime-secrets.json');
  const runtime = existsSync(secretsPath) ? JSON.parse(readFileSync(secretsPath, 'utf8')) : {};
  const get = (key, fallback = '') => local[key]?.trim() || process.env[key]?.trim() || fallback;
  return {
    openaiKey: get('OPENAI_API_KEY'), model: get('OPENAI_MODEL', 'gpt-6.1-terra'), reasoningEffort: get('OPENAI_REASONING_EFFORT', 'low'),
    transcriptionModel: get('OPENAI_TRANSCRIPTION_MODEL', 'gpt-transcribe'),
    relayKey: get('RELAY_WORKSPACE_KEY'), relayUrl: get('RELAY_BASE_URL', 'http://127.0.0.1:8787'),
    terseUrl: get('TERSE_ACTOR_URL'), terseKey: get('TERSE_API_KEY'),
    supabaseUrl: get('SUPABASE_URL'), supabaseKey: get('SUPABASE_SERVICE_ROLE_KEY'),
    port: Number(get('PORT', '3000')), host: get('HOST', '127.0.0.1'),
    publicOrigin: get('PUBLIC_ORIGIN'), dataDir: get('DATA_DIR', join(root, 'data')),
    workspaceStorage: get('WORKSPACE_STORAGE', get('TERSE_ACTOR_URL') ? 'terse' : 'sqlite'),
    freestyleKey: get('FREESTYLE_API_KEY'),
    liveModel: get('OPENAI_LIVE_MODEL', 'gpt-live-1'), liveVoice: get('OPENAI_LIVE_VOICE', 'marin'),
    twilioSid: get('TWILIO_ACCOUNT_SID'), twilioToken: get('TWILIO_AUTH_TOKEN'),
    twilioApiKey: get('TWILIO_API_KEY'), twilioApiSecret: get('TWILIO_API_SECRET'),
    phoneNumber: get('TWILIO_PHONE_NUMBER'), voiceOrigin: get('VOICE_PUBLIC_ORIGIN'), voicePort: Number(get('VOICE_PORT', '3001')),
    internalToken: get('INTERNAL_API_TOKEN', runtime.internalToken || ''),
    vapidPublicKey: get('VAPID_PUBLIC_KEY', runtime.vapidPublicKey || ''), vapidPrivateKey: get('VAPID_PRIVATE_KEY', runtime.vapidPrivateKey || ''),
    vapidSubject: get('VAPID_SUBJECT', 'https://commonground.example'),
  };
}
