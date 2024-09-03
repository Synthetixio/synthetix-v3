#!/bin/bash

set -e
export CANNON_IPFS_URL="https://ipfs.synthetix.io"

build() {
  namespace=$1

  echo
  echo
  echo
  echo '>' graph build "subgraph.$namespace.yaml" --output-dir "./build/$namespace"
  yarn graph build "subgraph.$namespace.yaml" --output-dir "./build/$namespace"
  yarn prettier --write "subgraph.$namespace.yaml"
}

codegen base-sepolia-andromeda
codegen base-mainnet-andromeda
codegen mainnet
codegen sepolia
codegen optimism-mainnet
codegen arbitrum-mainnet
codegen arbitrum-sepolia
