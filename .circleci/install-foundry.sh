#!/bin/bash

pushd .
cd $HOME

export PATH="$PATH:$HOME/.foundry/bin"
echo 'export PATH=$PATH:$HOME/.foundry/bin' >> ~/.bashrc
curl -L https://foundry.paradigm.xyz | bash
foundryup

popd
