## Synthetix-v3

### Project structure

This repository consists of a main hardhat project at the project root, and sub-packages in `packages/*`.

The main hardhat project is where all contract code lives, and any other functionality is isolated into `packages/*`. All sub-packages are automatically symlinked using [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces).

```
contracts
packages
├── deployer
│   └── package.json
└── cli
    └── package.json
hardhat.config.js
package.json
```

#### Root package

Hardhat project which contains all the Synthetix smart contract code, tests, etc.

#### Deployer package

Hardhat plugin that provides tasks for the router proxy architecture of the root package, including contract deployment, upgrades, etc.

#### CLI package

Hardhat plugin that provides tasks for interacting with deployed instances of the synthetix via the command line.

### Troubleshooting

*package/* not found*

Make sure that you've run `npm install` at the project root, and that you're using version 7+ of npm.
