#!/bin/bash

codegen() {
  namespace=$1
  chainId=$2
  cannonPackage=$3
  cannonPreset=$4

  echo
  echo
  echo
  echo '>' cannon inspect "$cannonPackage" --preset $cannonPreset --chain-id "$chainId" --write-deployments "./$namespace/deployments"
  cannon inspect "$cannonPackage" --preset $cannonPreset --chain-id "$chainId" --write-deployments "./$namespace/deployments"

  echo
  echo
  echo
  echo '>' graph codegen "subgraph.$namespace.yaml" --output-dir "$namespace/generated"
  graph codegen "subgraph.$namespace.yaml" --output-dir "$namespace/generated"
  prettier --write "$namespace/generated"

  echo
  echo
  echo
  echo '>' graph build "subgraph.$namespace.yaml" --output-dir "./build/$namespace"
  graph build "subgraph.$namespace.yaml" --output-dir "./build/$namespace"
  prettier --write "subgraph.$namespace.yaml"
}


releaseVersion=$(yarn workspace "@synthetixio/main" node -p 'require(`./package.json`).version')

codegen mainnet 1 "synthetix:$releaseVersion" main
codegen goerli 5 "synthetix:$releaseVersion" main
codegen optimism-mainnet 10 "synthetix:$releaseVersion" main
codegen optimism-goerli 420 "synthetix:$releaseVersion" main
codegen base-goerli 84531 "synthetix:$releaseVersion" main
codegen base-goerli-competition 84531 "synthetix:latest" competition
