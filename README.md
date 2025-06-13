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

## Releasing requirements

**Important** to not use global `cannon` installation and rely on cannon cli from the repo by running it with `yarn cannon` command.
Sometimes newer or older versions of cannon may produce incompatible state and as a result deployment state will be borked.
Using exactly same cannon version as all the repo maintainers use is a requirement and not an recommendation.

Run `yarn upgrade-interactive` and make sure that `@usecannon/cli` and `hardhat-cannon` are updated to the latest versions.
If not, make a separate PR with cannon update (even though cannon updates are automated, there is a delay up to a day for that to happen)

After installing for the first time, run `yarn cannon setup` to configure a reliable IPFS URL for publishing packages and any other preferred settings,
Cannon keeps its settings in file `~/.local/share/cannon/settings.json` and it might be more convenient to update it instead of using setup wizard.

Required options to set:

- `ipfsUrl`: `https://ipfs.synthetix.io`
- `writeIpfsUrl`: `https://<USER>:<PASS>@ipfs.synthetix.io`
- `publishIpfsUrl`: `https://<USER>:<PASS>@ipfs.synthetix.io`
- `registries`: list of per-chain registries with infura RPCs

Here is how your `settings.json` should look like (with sensitive fields stripped)

```json
{
  "ipfsUrl": "https://ipfs.synthetix.io",
  "writeIpfsUrl": "https://<USER>:<PASS>@ipfs.synthetix.io",
  "publishIpfsUrl": "https://<USER>:<PASS>@ipfs.synthetix.io",
  "registries": [
    {
      "name": "OP Mainnet",
      "chainId": 10,
      "rpcUrl": ["https://optimism-mainnet.infura.io/v3/<INFURA_KEY>"],
      "address": "0x8E5C7EFC9636A6A0408A46BB7F617094B81e5dba"
    },
    {
      "name": "Ethereum Mainnet",
      "chainId": 1,
      "rpcUrl": ["https://mainnet.infura.io/v3/<INFURA_KEY>"],
      "address": "0x8E5C7EFC9636A6A0408A46BB7F617094B81e5dba"
    }
  ]
}
```

You need to have publish access to the `@synthetixio` NPM org.
Check your currently logged in npm user with

```sh
npm whoami
```

Open https://www.npmjs.com, login with your account and verify your name is present in the list of members on https://www.npmjs.com/settings/synthetixio/members page

If needed you can login and logout with npm cli

```sh
npm login
npm logout
```

## Publish Dev Release

**Each step is necessary, do not skip any steps.**

Dev releases are expected to be done from _ANY_ branch without restrictions at any moment of code readiness.

Do **NOT** manually update `package.json` of any package.

1.  Confirm there are no git changes

    ```sh
    git diff --exit-code
    ```

    This step is important as dev release will create changes in the process which must **NOT** be committed
    and after successful release all changes should be fully reset.

2.  Bump all the package versions to a dev variant that will be in a format of `0.0.0-dev.$GIT_SHA_SHORT`

    ```sh
    # make sure to run it in the repo ROOT
    yarn version:dev
    ```

    This will execute lerna command to bump all packages (without doing any commits).
    Underlying command can always be checked in `package.json` scripts. Full version is:

    ```sh
    yarn lerna version 0.0.0-dev.$(git rev-parse --short HEAD) --no-changelog --no-push --no-git-tag-version --force-publish --allow-branch $(git branch --show-current)
    ```

3.  Run publish of all packages to NPM registry under `dev` tag
    This will execute lerna command to publish all packages (still, without doing any commits).
    This step will update lock file as well as all the internal workspace references.

    ```sh
    yarn publish:dev
    ```

    Underlying command can always be checked in `package.json` scripts. Full version is:

    ```sh
    yarn lerna publish from-package --force-publish --dist-tag dev --no-git-reset
    ```

    If there is no intention to publish to NPM or cannon registry at all for testing locally only, you can do a dry-run instead
    It will not run npm publish but still will do all the necessary updates to local package.json files.

    ```sh
    yarn publish:dev --dry-run
    ```

4.  Deploy each individual package to cannon, make sure you still have all the results of steps 2 and 3 in working tree.
    For each package you'd like to publish to cannon, call package script `deploy`
    Note that each publish comes at a mainnet fee cost of `0.0025 ETH`, so it is wide not to publish more than required

    ```sh
    yarn workspace @synthetixio/perps-market deploy
    yarn workspace @synthetixio/main deploy
    # and so on
    ```

    Same can be achieved by executing `yarn deploy` inside each package folder

    ```sh
    pushd .
    cd markets/perps-market
    yarn deploy
    popd

    pushd .
    cd protocol/synthetix
    yarn deploy
    popd

    # and so on
    ```

    Each package may define its own way to deploy with cannon, please refer to package.json scripts section.
    The most common list of operation `deploy` shortcut will execute (example from `protocol/synthetix`):

    ```sh
    # This is only an example to illustrate what deploy shortcut is doing under the hood
    # 1. Compile the contracts and all the support files
    yarn hardhat compile --force
    # 2. Dump the contract storage
    yarn hardhat storage:dump --output storage.new.dump.json
    # 3. Deploy on chain (cannon's chain only 13370) and generate all the IPFS artifacts in cannon local folder
    #    CANNON_REGISTRY_PRIORITY=local ensures that cannon uses local cache first and not pulling packages from outside
    #    This is needed when there is a dependency between packages and we publishing a chain of packages one by one
    CANNON_REGISTRY_PRIORITY=local yarn hardhat cannon:build
    # 4. Publish given package to the cannon registry
    yarn cannon publish synthetix:$(node -p 'require(`./package.json`).version') --chain-id 13370 --quiet --tags $(node -p '/^\d+\.\d+\.\d+$/.test(require(`./package.json`).version) ? `latest` : `dev`')
    ```

5.  After successful publishing of all needed packages, reset your git working tree to avoid accidentally
    committing dev version changes and dependency references upstream.
    ```sh
    git reset --hard
    ```
    And ensure working tree is clean again
    ```sh
    git diff --exit-code
    ```

## Publish Official Release

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
