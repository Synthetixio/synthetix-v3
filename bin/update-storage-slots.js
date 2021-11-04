#!/usr/bin/env node

/**

Helper script for searching all the storage files that define a hash slot and update
it if necessary using the label on the comment.

Usage:
  npm run update-storage-slots

This script will find all the contracts that have something like this defined:

```
        assembly {
            // bytes32(uint(keccak256("io.synthetix.proxy")) - 1)
            store.slot := 0x0000000000000000000000000000000000000000000000000000000000000000
        }
```

And replace it with the correct calculated hash from the label:

```
        assembly {
            // bytes32(uint(keccak256("io.synthetix.proxy")) - 1)
            store.slot := 0x9dbde58b6f7305fccdc5abd7ea1096e84de3f9ee47d83d8c3efc3e5557ac9c74
        }
```

*/

const path = require('path');
const fs = require('fs/promises');
const { promisify } = require('util');
const { ethers } = require('ethers');

const glob = promisify(require('glob'));

const SlotRegex =
  /^\s*\/\/ bytes32\(uint\(keccak256\("([^"]+)"\)\) - 1\)\n\s*store\.slot := (0x[0-9A-Fa-f]{64})$/gm;

function toEip1967Hash(label) {
  const hash = ethers.utils.id(label);
  const offsetedHash = ethers.BigNumber.from(hash).sub(1);
  return offsetedHash.toHexString(32);
}

async function main() {
  const contracts = await glob(
    path.resolve(__dirname, '..', 'packages', '**', 'contracts', '**', '*.sol'),
    {
      ignore: ['**/node_modules/**', '**/artifacts/**'],
    }
  );

  await Promise.all(
    contracts.map(async (contractPath) => {
      const source = await fs.readFile(contractPath).then((buff) => buff.toString());

      const result = source.replace(SlotRegex, (...args) => {
        const [match, label, oldHash] = args;
        const newHash = toEip1967Hash(label);

        if (newHash === oldHash) return match;

        console.log(
          `Updating label "${label}" on "${path.relative(
            path.resolve(__dirname, '..'),
            contractPath
          )}"`
        );

        return match.replace(oldHash, newHash);
      });

      if (source !== result) {
        await fs.writeFile(contractPath, result);
      }
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
