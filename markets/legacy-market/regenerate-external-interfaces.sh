#!/bin/bash

set -x

CANNON="${CANNON:-cannon}"

cannon inspect synthetix:latest --chain-id 1 --json | jq '.state["router.CoreRouter"].artifacts.contracts.CoreRouter.abi' -cM | abi-to-sol IV3CoreProxy -V '^0.8.4' > contracts/interfaces/external/IV3CoreProxy.sol
