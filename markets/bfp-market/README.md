# bfp-market

**Welcome to bfp-market!**

The _big ~~fucking~~ freaking perp market_ (or just BFP-Market) is a perpetual swap market, leveraging the capabilities of Synthetix v3 as its underlying infrastructure. bfp-market inherits core features from [v2x](https://github.com/Synthetixio/synthetix/tree/develop/contracts), such as dynamic funding rates, PD (Premium/Discount) adjusted market prices, and asynchronous hybrid oracle-based order executions through [Pyth](https://pyth.network/).

In addition to these features, it also introduces various enhancements, including native multi-collateral support, improved dynamic keeper fees, user-adjustable keeper fees on order commitments, settlement hooks, account splitting/merging, improved liquidations, a host of quality-of-life improvements, a strong emphasis on gas optimization, and obviously built on [Synthetix v3](https://github.com/Synthetixio/synthetix-v3).

bfp-market's primary use case is to allow stable coin issuers, vaults, and other defi protocols to create a delta neutral perp, utilizing ETH and ETH LSTs as collateral. The end result is a new defi primitive that's yield bearing (through positive funding) and hyper-stable. All of this done completely decentralised and onchain.

<p align="center">
  <img src="./assets/overview.png">
</p>

## Development

```bash
# Ensure you're in the root of project.
cd synthetix-v3

# Install monorepo dependencies.
yarn

# Generate a testable artifacts.
yarn generate-testable
yarn build-testable

# Build and run bfp-market tests.
yarn workspace @synthetixio/bfp-market {build,test,test:stable}
```
