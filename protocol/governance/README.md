# Synthetix Governance Modules

Governance contracts for on chain voting.

## Code Status

This code is a WIP port from the [v1.0.0-governance-branch](https://github.com/Synthetixio/synthetix-v3/tree/v1.0.0-governance-branch), and is currently not functional. All releases and updates to the currently deployed election modules and councils are made from that branch, which has been audited by Iosiro.

The code currently in this main, under `protocol/governance` is a modernized port of the old code in the governance branch, and changes the storage layout of the election module. This makes this code incompatible with the old code and will require deployment of new proxies, new NFTs, etc.

The current state of the code is that tests are not passing, and the contracts need to be further modified to work correctly, and later re-audited.

The governance branch also contains tests that were not brought into the branch in the core-modules folder. These will also need to be ported here to prove correct functionality of the new code, and perhaps new tests will be needed for the generated storage objects.

Finally, it may be desired to remove old election code used in fixture tests in packages outside of `protocol/governance`.

## Cannon Usage

Local node spin up can be done using [`Cannon`](https://usecannon.com/), simply run the following command to startup a development hardhat node with all the Governance Modules deployed:

```bash
npx hardhat cannon
```

### Periods

Then, for development purposes, you can for example fast forward to the nomination period on the current running node (remember to use the `Proxy` address as the `--address` paramenter):

```basSh
npx hardhat --network local fast-forward-to --address 0x866cf0358C0514D4E63fCef80fD4B57C2eE5Fbe0 nomination
```

### Fixtures

Also, you can simulate complete epochs:

```bash
npx hardhat --network local fixture:epoch --address 0x866cf0358C0514D4E63fCef80fD4B57C2eE5Fbe0
```

Which will do the following steps

1. If on Administration Period, fast forward to Nomination
2. Create wallets and add them as nominees
3. Move on to Voting Period
4. Create voters and randomly vote on candidates
5. Move on to Evaluation Period
6. Evaluate Votes and resolve epoch (going back to point `1.`)
