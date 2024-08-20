# Synthetix v3

[![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?token=B9BK0U5KAT)](https://codecov.io/gh/Synthetixio/synthetix-v3)

| Package                     | Coverage                                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @synthetixio/core-utils     | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?token=B9BK0U5KAT&flag=core-utils)](https://codecov.io/gh/Synthetixio/synthetix-v3)     |
| @synthetixio/core-contracts | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?token=B9BK0U5KAT&flag=core-contracts)](https://codecov.io/gh/Synthetixio/synthetix-v3) |
| @synthetixio/core-modules   | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?token=B9BK0U5KAT&flag=core-modules)](https://codecov.io/gh/Synthetixio/synthetix-v3)   |
| @synthetixio/main           | [![codecov](https://codecov.io/gh/Synthetixio/synthetix-v3/branch/main/graph/badge.svg?token=B9BK0U5KAT&flag=synthetix)](https://codecov.io/gh/Synthetixio/synthetix-v3)      |

## Documentation

Please refer to the [Official Documentation](https://docs.synthetix.io/) for high level concepts of the Synthetix v3 protocol, as well as auto generated docs from natspec.

## Package structure

This is a monorepo with the following folder structure and packages:

```
.
├── markets                      // Standalone projects that extend the core Synthetix protocol with markets.
│   ├── legacy-market            // Market that connects Synthetix's v2 and v3 versions.
│   └── perps-market             // Market extension for perps.
│   └── spot-market              // Market extension for spot synths.
│   └── bfp-market               // Market extension for eth l1 perp.
│
├── protocol                     // Core Synthetix protocol projects.
│   ├── governance               // Governance contracts for on chain voting.
│   ├── oracle-manager           // Composable oracle and price provider for the core protocol.
│   └── synthetix                // Core protocol (to be extended by markets).
│
└── utils                        // Utilities, plugins, tooling.
    ├── common-config            // Common npm and hardhat configuration for multiple packages in the monorepo.
    ├── core-contracts           // Standard contract implementations like ERC20, adapted for custom router storage.
    ├── core-modules             // Modules intended to be reused between multiple router based projects.
    ├── core-utils               // Simple Javascript/Typescript utilities that are used in other packages (e.g. test utils, etc).
    ├── deps                     // Dependency handling (e.g. mismatched, circular etc.)
    ├── docgen                   // Auto-generate docs from natspec etc.
    ├── hardhat-storage          // Hardhat plugin used to detect storage collisions between proxy implementations.
    └── sample-project           // Sample project based on router proxy and cannon.
```

## Router Proxy

All projects in this monorepo that involve contracts use a proxy architecture developed by Synthetix referred to as the "Router Proxy". It is basically a way to merge several contracts, which we call "modules", into a single implementation contract which is the router itself. This router is used as the implementation of the main proxy of the system.

See the [Router README](https://github.com/Synthetixio/synthetix-router) for more details.

⚠️ When using the Router as an implementation of a UUPS [Universal Upgradeable Proxy Standard](https://eips.ethereum.org/EIPS/eip-1822) be aware that any of the public functions defined in the Proxy could clash and override any of the Router modules functions. A malicious proxy owner could use this type of obfuscation to have users run code which they do not want to run. You can imagine scenarios where the function names do not look similar but share a function selector. ⚠️

## Information for Developers

If you intend to develop in this repository, please read the following items.

### Installation Requirements

- [Foundry](https://getfoundry.sh/)
- NPM version 8
- Node version 16

### Console logs in contracts

In the contracts, use `import "hardhat/console.sol";`, then run `DEBUG=cannon:cli:rpc yarn test`.

## Deployment Guide

Deployment of the protocol is managed in the [synthetix-deployments repository](https://github.com/synthetixio/synthetix-deployments).

To prepare for system upgrades, this repository is used to release new versions of the [protocol](/protocol) and [markets](/markets).

### Preparing a Release

#### Setup Cannon

- Run `yarn upgrade-interactive` and make sure that `@usecannon/cli` and `hardhat-cannon` are updated to the latest versions.
- After installing for the first time, run `yarn cannon:setup` to configure a reliable IPFS URL for publishing packages and any other preferred settings.

#### Setup npm

- Unless `npm whoami` returns an npm account with publishing permissions for the `@synthetixio` organization, confirm an `@synthetixio` npm publishing key is set as `$NPM_TOKEN` in the `.env` file or prepend `NPM_TOKEN=_` to the command used for publishing below.

#### Publish Dev Release

- Confirm you are on the development branch you’d like to release and that there are no git changes `git diff --exit-code .`
- Publish the release with `yarn publish:dev` for the pre-release (no git tag, version looks like `1.2.3-<GIT_SHA>.0`)
- If you aren't using an EIP-1193 compatible wallet, prepend `CANNON_PRIVATE_KEY=<PRIVATE_KEY>` to the following command.
- In the directory for each package you’d like to publish to cannon, run `yarn deploy`
- After successful publish, there should be no diff in git. But if there is a diff - make sure you reset any changes, fix publishing issues and re-publish again. Double-check all the package.json files, revert dependencies' version changes back to `"workspaces:*"`.

#### Publish Official Release

**Each step is necessary, do not skip any steps.**

- Verify what has changed since the last release

  ```sh
  yarn changed
  ```

- Confirm you are on the `main` branch and that there are no git changes `git diff --exit-code .` and you have write access to `main` branch
  ```sh
  git fetch --all
  git checkout main
  git pull
  git diff --exit-code .
  ```
- Publish the release with `yarn publish:release`. (After successful publish, there should be no diff in git.)
- If you aren't using an EIP-1193 compatible wallet, prepend `CANNON_PRIVATE_KEY=<PRIVATE_KEY>` to the following command.
- In the directory for each package you’d like to publish to cannon, run `yarn deploy`
