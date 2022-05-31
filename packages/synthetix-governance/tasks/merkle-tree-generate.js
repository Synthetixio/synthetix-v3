const fs = require('fs/promises');
const { task, types: hardhatTypes } = require('hardhat/config');
const { parseBalanceMap } = require('@synthetixio/core-js/utils/merkle-tree/parse-balance-tree');
const { TASK_MERKLE_TREE_GENERATE } = require('../task-names');

task(TASK_MERKLE_TREE_GENERATE, 'generate a merkle tree from a debts file')
  .addParam(
    'file',
    'Path to the debts file, with format { [wallet:address]: amount:string }',
    undefined,
    hardhatTypes.inputFile
  )
  .setAction(async ({ file }) => {
    const debts = JSON.parse(await fs.readFile(file));
    const tree = parseBalanceMap(debts);

    console.log(JSON.stringify(tree, null, 2));
  });
