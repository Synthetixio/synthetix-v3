# Synthetix Governance Modules

Governance cotracts for on chain voting.

## Cannon Usage

Local node spin up can be done using [`Cannon`](https://usecannon.com/), simply run the following command to startup a development hardhat node with all the Governance Modules deployed:

```bash
npx hardhat cannon
```

Then, for development purposes, you can for example fast forward to the nomination period on the current running node:

```bash
npx hardhat run --network localhost scripts/cannon/set-period-nomination.js
```
