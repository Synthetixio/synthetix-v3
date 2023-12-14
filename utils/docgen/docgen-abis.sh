#!/bin/bash

set -e

echo "Docgen ABIs..."

ROOT=$(yarn workspace synthetix-v3 exec pwd)
OUT="$ROOT/docs/addresses-+-abis.md"
mkdir -p $ROOT/docs
rm -rf $ROOT/docs/abis
rm -rf $OUT
touch $OUT

cat "./addresses-+-abis.md" > $OUT

node ./abis.js 1 main
echo "## Mainnet" >> $OUT
echo "" >> $OUT
cat ./docs/1-main.md >> $OUT
echo "" >> $OUT

node ./abis.js 5 main
echo "## Goerli" >> $OUT
echo "" >> $OUT
cat ./docs/5-main.md >> $OUT
echo "" >> $OUT

node ./abis.js 11155111 main
echo "## Sepolia" >> $OUT
echo "" >> $OUT
cat ./docs/11155111-main.md >> $OUT
echo "" >> $OUT

node ./abis.js 10 main
echo "## Optimism" >> $OUT
echo "" >> $OUT
cat ./docs/10-main.md >> $OUT
echo "" >> $OUT

node ./abis.js 420 main
echo "## Optimistic Goerli" >> $OUT
echo "" >> $OUT
cat ./docs/420-main.md >> $OUT
echo "" >> $OUT

node ./abis.js 420 dev
echo "## Dev on Optimism Goerli" >> $OUT
echo "" >> $OUT
cat ./docs/420-dev.md >> $OUT
echo "" >> $OUT

node ./abis.js 8453 andromeda
echo "## Andromeda on Base" >> $OUT
echo "" >> $OUT
cat ./docs/8453-andromeda.md >> $OUT
echo "" >> $OUT

node ./abis.js 84531 main
echo "## Base Goerli" >> $OUT
echo "" >> $OUT
cat ./docs/84531-main.md >> $OUT
echo "" >> $OUT

node ./abis.js 84531 competition
echo "## Competition on Base Goerli" >> $OUT
echo "" >> $OUT
cat ./docs/84531-competition.md >> $OUT
echo "" >> $OUT

node ./abis.js 84531 andromeda
echo "## Andromeda on Base Goerli" >> $OUT
echo "" >> $OUT
cat ./docs/84531-andromeda.md >> $OUT
echo "" >> $OUT

node ./abis.js 80001 main
echo "## Polygon Mumbai" >> $OUT
echo "" >> $OUT
cat ./docs/80001-main.md >> $OUT
echo "" >> $OUT

cp -r ./abis $ROOT/docs/abis

echo "OK Generating ABIs"
