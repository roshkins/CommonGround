set -eu
cd /srv/commonground
machine=$(uname -m)
case "$machine" in
  x86_64) node_arch=x64 ;;
  aarch64) node_arch=arm64 ;;
  *) exit 2 ;;
esac
node_archive="node-v22.23.0-linux-${node_arch}.tar.xz"
bootstrap_dir=$(mktemp -d /tmp/commonground-runtime.XXXXXX)
curl -fsSL "https://nodejs.org/dist/v22.23.0/${node_archive}" -o "${bootstrap_dir}/${node_archive}"
curl -fsSL https://nodejs.org/dist/v22.23.0/SHASUMS256.txt -o "${bootstrap_dir}/node22-shasums.txt"
cd "$bootstrap_dir"
grep " ${node_archive}$" node22-shasums.txt | sha256sum -c -
mkdir -p /opt/commonground-node
tar -xJf "${bootstrap_dir}/${node_archive}" -C /opt/commonground-node --strip-components=1
export PATH="/opt/commonground-node/bin:$PATH"
cd /srv/commonground
node --version
npm ci --include=optional
node scripts/check.mjs
bun --version
