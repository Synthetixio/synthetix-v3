# Synthetix Governance Modules

Governance contracts for on chain voting.

## Cannon Usage

Local node spin up can be done using [`Cannon`](https://usecannon.com/), simply run the following command to startup a development hardhat node with all the Governance Modules deployed:

```bash
yarn hardhat cannon
```

### Periods

Then, for development purposes, you can for example fast forward to the nomination period on the current running node (remember to use the `Proxy` address as the `--address` paramenter):

```bash
yarn hardhat --network local fast-forward-to --address 0x866cf0358C0514D4E63fCef80fD4B57C2eE5Fbe0 nomination
```

### Fixtures

Also, you can simulate complete epochs:

```bash
yarn hardhat --network local fixture:epoch --address 0x866cf0358C0514D4E63fCef80fD4B57C2eE5Fbe0
```

Which will do the following steps

1. If on Administration Period, fast forward to Nomination
2. Create wallets and add them as nominees
3. Move on to Voting Period
4. Create voters and randomly vote on candidates
5. Move on to Evaluation Period
6. Evaluate Votes and resolve epoch (going back to point `1.`)
