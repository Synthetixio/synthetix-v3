# Synthetix v3

[![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg)](https://codecov.io/gh/Synthetixio/synthetix-v3)

| Package        | Coverage                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| core-utils     | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?flag=core-utils)](https://codecov.io/gh/Synthetixio/synthetix-v3)     |
| core-contracts | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?flag=core-contracts)](https://codecov.io/gh/Synthetixio/synthetix-v3) |
| core-modules   | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?flag=core-modules)](https://codecov.io/gh/Synthetixio/synthetix-v3)   |
| hardhat-router | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?flag=hardhat-router)](https://codecov.io/gh/Synthetixio/synthetix-v3) |
| synthetix-main | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?flag=main)](https://codecov.io/gh/Synthetixio/synthetix-v3) |

## Documentation

Please refer to the [Official Documentation](https://snx-v3-docs.vercel.app/) for high level concepts of the Synthetix v3 protocol, as well as auto generated docs from natspec.

## Package structure

This is a monorepo with the following folder structure and packages:

```
.
├── markets               // Standalone projects that extend the core Synthetix protocol with markets.
│   ├── legacy-market     // Market that connects Synthetix's v2 and v3 versions.
│   ├── sample-markets    // Example market extensions.
│   └── spot-market       // Market extension for spot synths.
│
├── protocol              // Core Synthetix protocol projects.
│   ├── oracle-manager    // Composable oracle and price provider for teh core protocol.
│   └── synthetix         // Core protocol (to be extended by markets).
│
└── utils                 // Utilities, plugins, tooling.
    ├── common-config     // Common npm and hardhat configuration for multiple packages in the monorepo.
    ├── core-contracts    // Standard contract implementations like ERC20, adapted for custom router storage.
    ├── core-modules      // Modules intended to be reused between multiple router based projects.
    ├── core-router       // TODO: Remove
    ├── core-utils        // Simple Javascript/Typescript utilities that are used in other packages (e.g. test utils, etc).
    ├── hardhat-router    // Hardhat plugin that merges multiple modules into a router contract.
    ├── hardhat-storage   // Hardhat plugin used to detect storage collisions between proxy implementations.
    └── sample-project    // Sample project based on hardhat-router and cannon.
```

## Router Proxy

All projects in this monorepo that involve contracts use a proxy architecture developed by Synthetix referred to as the "Router Proxy". It is basically a way to merge several contracts, which we call "modules", into a single implementation contract which is the router itself. This router is used as the implementation of the main proxy of the system.

See the [Router README](https://github.com/Synthetixio/synthetix-v3/blob/main/utils/hardhat-router/README.md) for more details.

## Deployments with Cannon

All projects in this repo that involve the deployment of contracts use [Cannon](https://usecannon.com/), a novel tool to manage protocol deployment and testing on blockchains.

Please refer to the [Cannon Documentation](https://usecannon.com/docs) for more details.

## Information for Developers

If you intend to develop in this repository, please read the following items.

### Installation Requirements

- [Foundry](https://getfoundry.sh/)
- NPM version 8
- Node version 16

### Console logs in contracts

In the contracts, use `import "hardhat/console.sol";`, then run `DEBUG=cannon:cli:rpc npm test`.
