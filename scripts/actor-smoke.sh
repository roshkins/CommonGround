set -eu
cd /srv/commonground
node=/opt/commonground-node/bin/node
"$node" tests/workspaces-runtime.mjs write
if [ "$(id -u)" -eq 0 ]; then systemctl restart commonground-actors.service; else sudo -n systemctl restart commonground-actors.service; fi
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if "$node" tests/workspaces-runtime.mjs read; then exit 0; fi
  sleep 2
done
printf '%s\n' 'Actor restart smoke did not recover in the expected interval.'
exit 1
