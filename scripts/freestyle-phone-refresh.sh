set -eu
systemctl restart commonground-app commonground-voice
systemctl is-active commonground-app commonground-voice commonground-actors commonground-relay
