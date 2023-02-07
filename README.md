# Synthetix v3

[![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?token=B9BK0U5KAT)](https://codecov.io/gh/Synthetixio/synthetix-v3)

| Package                     | Coverage                                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @synthetixio/core-utils     | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?token=B9BK0U5KAT&flag=core-utils)](https://codecov.io/gh/Synthetixio/synthetix-v3)     |
| @synthetixio/core-contracts | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?token=B9BK0U5KAT&flag=core-contracts)](https://codecov.io/gh/Synthetixio/synthetix-v3) |
| @synthetixio/core-modules   | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?token=B9BK0U5KAT&flag=core-modules)](https://codecov.io/gh/Synthetixio/synthetix-v3)   |
| @synthetixio/hardhat-router | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?token=B9BK0U5KAT&flag=hardhat-router)](https://codecov.io/gh/Synthetixio/synthetix-v3) |
| @synthetixio/main           | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?token=B9BK0U5KAT&flag=synthetix)](https://codecov.io/gh/Synthetixio/synthetix-v3)      |

## Documentation

Please refer to the [Official Documentation](https://snx-v3-docs.vercel.app/) for high level concepts of the Synthetix v3 protocol, as well as auto generated docs from natspec.

## Package structure

This is a monorepo with the following folder structure and packages:

```
.
├── markets                      // Standalone projects that extend the core Synthetix protocol with markets.
│   ├── legacy-market            // Market that connects Synthetix's v2 and v3 versions.
│   └── spot-market              // Market extension for spot synths.
│
├── protocol                     // Core Synthetix protocol projects.
│   ├── oracle-manager           // Composable oracle and price provider for teh core protocol.
│   └── synthetix                // Core protocol (to be extended by markets).
│
└── utils                        // Utilities, plugins, tooling.
    ├── common-config            // Common npm and hardhat configuration for multiple packages in the monorepo.
    ├── core-contracts           // Standard contract implementations like ERC20, adapted for custom router storage.
    ├── core-modules             // Modules intended to be reused between multiple router based projects.
    ├── core-utils               // Simple Javascript/Typescript utilities that are used in other packages (e.g. test utils, etc).
    ├── hardhat-router           // Hardhat plugin that merges multiple modules into a router contract.
    ├── hardhat-storage          // Hardhat plugin used to detect storage collisions between proxy implementations.
    ├── sample-project           // Sample project based on hardhat-router and cannon.
    └── solhint-plugin-numcast   // Solidity linter plugin to avoid low level numeric casts which can lead to silent overflows.
```

## Router Proxy

All projects in this monorepo that involve contracts use a proxy architecture developed by Synthetix referred to as the "Router Proxy". It is basically a way to merge several contracts, which we call "modules", into a single implementation contract which is the router itself. This router is used as the implementation of the main proxy of the system.

See the [Router README](utils/hardhat-router/README.md) for more details.

## Information for Developers

If you intend to develop in this repository, please read the following items.

### Installation Requirements

- [Foundry](https://getfoundry.sh/)
- NPM version 8
- Node version 16

### Console logs in contracts

In the contracts, use `import "hardhat/console.sol";`, then run `DEBUG=cannon:cli:rpc npm test`.

## Deployment Guide

Deployment of the protocol is managed in the [synthetix-deployments repository](https://github.com/synthetixio/synthetix-deployments).

To prepare for system upgrades, this repository is used to release new versions of the [protocol](/protocol) and [markets](/markets).

### Preparing a Release

- Ensure you have the latest version of [Cannon](https://usecannon.com) installed: `npm i -g @usecannon/cli`.
- After installing for the first time, run `cannon setup` to configure IPFS and a reliable RPC endpoint to communicate with the Cannon package registry.
- Run `npm i` and `npm run build` in the root directory of the repository.
- From the directory of the package you're releasing, run `npx hardhat cannon:build`.
- Confirm the private key that owns the corresponding namespace in the package registry is set in the `.env` file as `DEPLOYER_PRIVATE_KEY`.
- Publish the release to Cannon package registry with `npx hardhat cannon:publish --network mainnet`.
- Increment the version in the relevant `package.json` and push the change to this repository. (The repositories should always contain the version number of the next release.)

Then, follow the instructions in the [synthetix-deployments repository](https://github.com/synthetixio/synthetix-deployments).

### Finalizing a Release

After the new version of the [synthetix-omnibus](https://usecannon.com/packages/synthetix-omnibus) package has been published, the previously published packages can be updated to include the deployment data from remote networks from the omnibus release. The contracts from that release can also be verified on Etherscan.

- Check out the commit prior to the version increment above and run `cannon publish <PACKAGE_NAME>:<VERSION> --private-key xxx --tags latest,3`
- From the relevant package's directory, run the following command for each network it was deployed on: `npx hardhat cannon:verify <PACKAGE_NAME>:<VERSION> --network <NETWORK_NAME>`
