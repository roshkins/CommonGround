set -eu
cd /srv/commonground
node=/opt/commonground-node/bin/node
service_path=/opt/commonground-node/bin:/root/.bun/bin:/usr/local/bin:/usr/bin:/bin

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo -n "$@"; fi
}

test -x "$node"
test -r /srv/commonground/.env
as_root mkdir -p /srv/commonground/data

install_service() {
  unit="$1"
  entrypoint="$2"
  description="$3"
  dependencies="$4"
  as_root tee "/etc/systemd/system/${unit}.service" >/dev/null <<EOF
[Unit]
Description=${description}
Wants=network-online.target
After=network-online.target ${dependencies}

[Service]
Type=simple
User=root
WorkingDirectory=/srv/commonground
Environment=PATH=${service_path}
Environment=TAC_ANALYTICS_DISABLED=true
ExecStart=${node} /srv/commonground/${entrypoint}
Restart=on-failure
RestartSec=3
TimeoutStartSec=180
TimeoutStopSec=30
KillMode=control-group
UMask=0077

[Install]
WantedBy=multi-user.target
EOF
}

# The processes read the permission-restricted .env with readConfig themselves.
# Credentials never appear in unit files, process arguments or this script output.
install_service commonground-actors scripts/actors-server.mjs 'CommonGround private Terse actor runtime' ''
install_service commonground-relay scripts/relay-server.mjs 'CommonGround private Agent Relay transport' ''
install_service commonground-app server.mjs 'CommonGround hosted application' 'commonground-actors.service commonground-relay.service'
install_service commonground-voice scripts/voice-server.mjs 'CommonGround inbound GPT-Live phone service' 'commonground-app.service'

as_root tee /etc/systemd/system/commonground-agendas.service >/dev/null <<EOF
[Unit]
Description=CommonGround official agenda ingestion and durable notification delivery
Wants=network-online.target
After=network-online.target commonground-app.service

[Service]
Type=oneshot
User=root
WorkingDirectory=/srv/commonground
Environment=PATH=${service_path}
ExecStart=${node} /srv/commonground/scripts/agenda-worker.mjs
TimeoutStartSec=720
UMask=0077
EOF

as_root tee /etc/systemd/system/commonground-agendas.timer >/dev/null <<'EOF'
[Unit]
Description=Check official agendas every fifteen minutes

[Timer]
OnBootSec=120
OnUnitActiveSec=15min
AccuracySec=15s
Unit=commonground-agendas.service

[Install]
WantedBy=timers.target
EOF

as_root systemctl daemon-reload
as_root systemctl enable --now commonground-actors.service commonground-relay.service commonground-app.service

if "$node" --input-type=module -e 'import { readConfig } from "./lib/config.mjs"; const c=readConfig(process.cwd()); process.exit(["twilioSid","twilioToken","twilioApiKey","twilioApiSecret","phoneNumber","voiceOrigin","openaiKey","internalToken"].every(k=>Boolean(c[k]))?0:1)'; then
  as_root systemctl enable --now commonground-voice.service
else
  printf '%s\n' 'Voice service not started: required inbound phone configuration is incomplete.'
fi

as_root systemctl enable --now commonground-agendas.timer
as_root systemctl is-active commonground-actors.service commonground-relay.service commonground-app.service
printf '%s\n' 'CommonGround services installed. Actor state and Relay remain private on loopback; only app and voice HTTPS ingress should be routed.'
