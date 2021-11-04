#!/usr/bin/env node

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
    path.join(__dirname, '..', '**', 'contracts', 'storage', '**', '*.sol'),
    { ignore: ['**/node_modules/**', '**/artifacts/**'] }
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
