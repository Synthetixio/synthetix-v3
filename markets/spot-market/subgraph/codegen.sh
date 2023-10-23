#!/bin/bash

set -e
export CANNON_IPFS_URL="https://ipfs.synthetix.io"

codegen() {
  namespace=$1
  chainId=$2
  cannonPackage=$3
  cannonPreset=$4

  echo
  echo
  echo
  echo '>' cannon inspect "$cannonPackage" --preset $cannonPreset --chain-id "$chainId" --write-deployments "./$namespace/deployments"
  yarn cannon inspect "$cannonPackage" --preset $cannonPreset --chain-id "$chainId" --write-deployments "./$namespace/deployments"

  echo
  echo
  echo
  echo '>' graph codegen "subgraph.$namespace.yaml" --output-dir "$namespace/generated"
  yarn graph codegen "subgraph.$namespace.yaml" --output-dir "$namespace/generated"
  yarn prettier --write "$namespace/generated"

  echo
  echo
  echo
  echo '>' graph build "subgraph.$namespace.yaml" --output-dir "./build/$namespace"
  yarn graph build "subgraph.$namespace.yaml" --output-dir "./build/$namespace"
  yarn prettier --write "subgraph.$namespace.yaml"
}


# releaseVersion=$(yarn workspace '@synthetixio/spot-market' node -p 'require(`./package.json`).version')
releaseVersion="latest"

#codegen mainnet 1 "synthetix-spot-market:$releaseVersion" main
#codegen goerli 5 "synthetix-spot-market:$releaseVersion" main
codegen optimism-mainnet 10 "synthetix-spot-market:$releaseVersion" main
codegen optimism-goerli 420 "synthetix-spot-market:$releaseVersion" main
#codegen base-goerli 84531 "synthetix-spot-market:$releaseVersion" main
codegen base-goerli-competition 84531 "synthetix-spot-market:latest" competition
