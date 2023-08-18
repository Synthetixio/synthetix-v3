#!/bin/bash

echo "Docgen ABIs..."

ROOT=$(yarn workspace synthetix-v3 exec pwd)
OUT="$ROOT/docs/addresses-+-abis.md"
mkdir -p $ROOT/deployments
mkdir -p $ROOT/docs
rm -rf $ROOT/docs/abis
rm -rf $OUT
touch $OUT

cat "./addresses-+-abis.md" > $OUT

generate () {
  _chainId=$1
  echo ""
  echo "-----------------------------"
  echo "Generating ABIs for $_chainId"
  echo "-----------------------------"
  echo "> cannon inspect synthetix-omnibus:latest --chain-id $_chainId --json > ./deployments/$_chainId.json"
  yarn cannon inspect synthetix-omnibus:latest --chain-id $_chainId --json > ./deployments/$_chainId.json
  node ./abis.js $_chainId ./deployments/$_chainId.json
  cat ./docs/$_chainId.md >> $OUT
  echo "" >> $OUT
  echo "-----------------------------"
  echo "OK Generating ABIs for $_chainId"
  echo "-----------------------------"
  echo ""
  echo ""
}

generate 1
generate 5
generate 11155111
generate 10
generate 420
generate 80001
generate 84531

cp -r ./abis $ROOT/docs/abis

echo "OK Generating ABIs"
