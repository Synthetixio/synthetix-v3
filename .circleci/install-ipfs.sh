#!/bin/bash

pushd .
cd $HOME

export PATH="$PATH:$HOME/go-ipfs"
echo 'export PATH=$PATH:$HOME/go-ipfs' >> ~/.bashrc
LATEST_VERSION=$(curl -sSL https://dist.ipfs.tech/go-ipfs/versions | tail -n 1)
LATEST_VERSION_NUMBER=${LATEST_VERSION#*v}
DOWNLOAD_URL="https://dist.ipfs.tech/go-ipfs/${LATEST_VERSION}/go-ipfs_${LATEST_VERSION}_linux-amd64.tar.gz"
echo "DOWNLOAD_URL=$DOWNLOAD_URL"
curl -sSL -o ipfs.tar.gz $DOWNLOAD_URL
tar -xzf ipfs.tar.gz
ipfs init

popd
