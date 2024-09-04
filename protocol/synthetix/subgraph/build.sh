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

build base-sepolia-andromeda
build base-mainnet-andromeda
build mainnet
build sepolia
build optimism-mainnet
build arbitrum-mainnet
build arbitrum-sepolia
