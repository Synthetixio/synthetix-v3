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

const LabelRegex = /\/\/ bytes32\(uint\(keccak256\("([^"]+)"\)\) - 1\)/;
const HashRegex = /store\.slot := (0x[0-9A-Fa-f]{64})/;

function toEip1967Hash(label) {
  const hash = ethers.utils.id(label);
  const offsetedHash = ethers.BigNumber.from(hash).sub(1);
  return offsetedHash.toHexString(32);
}

async function main() {
  const contracts = await glob(
    path.join(__dirname, '..', 'packages', '**', 'contracts', '**', '*.sol'),
    {
      ignore: ['**/node_modules/**', '**/artifacts/**'],
    }
  );

  for (const contractPath of contracts) {
    const source = await fs.readFile(contractPath).then((buff) => buff.toString());
    const labelMatch = source.match(LabelRegex);
    const oldHashMatch = source.match(HashRegex);

    if (!labelMatch || !oldHashMatch) continue;

    const [, label] = labelMatch;
    const [, oldHash] = oldHashMatch;

    const newHash = toEip1967Hash(label);

    if (newHash !== oldHash) {
      console.log(
        `Updating label "${label}" on "${path.relative(
          path.resolve(__dirname, '..'),
          contractPath
        )}"`
      );

      const result = source.replace(oldHash, newHash);
      await fs.writeFile(contractPath, result);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
