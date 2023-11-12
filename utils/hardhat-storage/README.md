# hardhat-storage

Hardhat Plugin to validate storage usage on a set of solidity contracts. The intention of this library is to avoid any unintended storage side effects when using Proxy architectures. E.g. when using [`@synthetixio/router`](https://github.com/Synthetixio/synthetix-router).

## Validations

### Mutable State Variables

It makes sure that your contracts are not using [state variables](https://docs.soliditylang.org/en/v0.8.17/internals/layout_in_storage.html) to avoid any storage collisions between different contracts executed behind the same Proxy.

To avoid this error it is recommended to use [Storage Namespaces](https://github.com/Synthetixio/synthetix-router#storage-namespaces).

### Storage Namespace Slots

This validation tries to verify that you are not using the same storage namespace name on different contracts, to avoid any namespace collisions.

### Invalid Storage Mutations

// TODO

## Usage

To enable the plugin in your [Hardhat](https://hardhat.org/) project you just need to import it in your config like so:

`hardhat.config.ts`:

```
import '@synthetixio/hardhat-storage';

export default {
  solidity: '0.8.11'
};
```

After that, you will be able to run the following command:

```bash
yarn hardhat storage:verify
```

Which will do the following steps:

1. It will execute the static storage validations on the contracts located at `contracts/**`.
2. If it exists, it will load the `storage.dump.sol` file and check for invalid storage mutations.
3. And, if all the previous validations passed, it will create or update the `storage.dump.sol` file, including the all the storage usage from your contracts.

> **NOTE:** You should make sure to add the `storage.dump.sol` file to your source control repository.
