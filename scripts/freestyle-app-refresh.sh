set -eu
systemctl restart commonground-app
systemctl is-active commonground-app commonground-voice commonground-actors commonground-relay
