# Synthetix

### Generating Documentation

Documentation is generated from Natspec comments in the interface files using [solidity-docgen](https://github.com/OpenZeppelin/solidity-docgen). Relevant configuration is specified in `hardhat.config.ts` and theme overrides are in `/docs/theme`. **Note that natspec information for inherited functions are not consumed by the docgen unless they are defined in the interface file. This is an issue for [events](https://github.com/ethereum/solidity/issues/8911#issuecomment-654774228)**

Run `npx hardhat docgen` to update `/docs/index.md`. (If this is behaving strangely, try deleting the `artifacts` and `cache` directories and re-running to troubleshoot.) This file can be manually copied into the `v3/docs` package in the [js-monorepo](https://github.com/synthetixio/js-monorepo).


Steps to add a new Node Type:
 1. add the new node type to NodeType enum in NodeDefinition.sol 
 2. add a new library in utils. It must have the following function interface: 
   ``` function process(Node.Data[] memory prices, bytes memory parameters) internal view returns (Node.Data memory)```
 3. add the new node type into ``_validateNodeType()`` in ``OracleManagerModule.sol``
 4. add a condition for new node type in ``_process`` in ``OracleManagerModule.sol`` and make sure it's calling the node library that you made in step 2