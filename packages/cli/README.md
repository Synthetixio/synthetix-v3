## hh-cli (Hardhat CLI)

**IMPORTANT**
This repository is a work in progress.

This package adds a series of tasks to any hardhat project that loads the plugin, replacing the functionality of https://github.com/Synthetixio/synthetix-cli (which should be deprecated afterwards). The target project only requires to contain compatible artifacts.

### Hardhat Configuration File
// **hardhat.config.js**
```
{
  solidity: {
    version: ‘0.7.3’,
  },
  defaultNetwork: ‘local’,
  networks: {
    mainnet: {...},
    kovan: {...},
    mainnet-optimism: {...},
    kovan-optimism: {...}
  },
  ...
  // this package configuration
  cli: { 
    artifacts: ‘./deployments’,
  }
}
```

### CLI Tasks
#### Interact
`npx hardhat interact`

Spins up an interactive ui simmilar to the one exposed by **syntethix-cli** but simplified.

Some design considerations
- Works for any artifacts folder specified in the configuration.
- Can handle universal proxies (old CLI cant)
- Wallet support - re-use code from core-js package?
- Supports simple EOAs
- Can use hardware wallet signers
- If the signer belongs to a known multisig, it will stage txs
- Compatible with gnosis safe and gnosis multisig
#### Nominate-owner
`npx hardhat nominate-owner`

Nominates a new owner on a particular instance, for all contracts
#### Accept-ownership
`npx hardhat accept-ownership`

Accepts an ownership nomination on a particular instance

#### Status
`npx hardhat status`

Prints out general status of a particular instance

