const fs = require('fs/promises');
const { task } = require('hardhat/config');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { TASK_SET_CROSS_CHAIN_DEBT } = require('../task-names');

task(TASK_SET_CROSS_CHAIN_DEBT, 'set the give merkle tree file on contract')
  .addParam('address', 'Deployed election module proxy address', undefined, types.address)
  .addParam('file', 'Path to the merkle tree json file')
  .addParam('blockNumber', 'block number from the origin chain', undefined, types.int)
  .setAction(async ({ address, file, blockNumber }) => {
    const ElectionModule = await hre.ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      address
    );

    const currentPeriod = Number(await ElectionModule.getCurrentPeriod());

    if (currentPeriod !== 1) {
      throw new Error('The election is not on ElectionPeriod.Nomination');
    }

    const tree = JSON.parse((await fs.readFile(file)).toString());

    console.log('Setting merkle tree:');
    console.log(`  address: ${address}`);
    console.log(`  file: ${file}`);
    console.log(`  merkleRoot: ${tree.merkleRoot}`);
    console.log(`  blockNumber: ${blockNumber}`);
    console.log();

    const tx = await ElectionModule.setCrossChainDebtShareMerkleRoot(
      tree.merkleRoot,
      Number(blockNumber)
    );

    await tx.wait();

    console.log(`Done (tx: ${tx.hash})`);
  });
