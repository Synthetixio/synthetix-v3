# Synthetix

### Generating Documentation

Documentation is generated from Natspec comments in the interface files using [solidity-docgen](https://github.com/OpenZeppelin/solidity-docgen). Relevant configuration is specified in `hardhat.config.ts` and theme overrides are in `/docs/theme`. **Note that natspec information for inherited functions are not consumed by the docgen unless they are defined in the interface file. This is an issue for [events](https://github.com/ethereum/solidity/issues/8911#issuecomment-654774228)**

Run `npx hardhat docgen` to update `/docs/index.md`. (If this is behaving strangely, try deleting the `artifacts` and `cache` directories and re-running to troubleshoot.) This file can be manually copied into the `v3/docs` package in the [js-monorepo](https://github.com/synthetixio/js-monorepo).
