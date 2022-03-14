// based on https://github.com/Uniswap/merkle-distributor/tree/master/src
const { BigNumber, utils } = require('ethers');
const BalanceTree = require('./balance-tree');

const { isAddress, getAddress } = utils;

// This is the blob that gets distributed and pinned to IPFS.
// It is completely sufficient for recreating the entire merkle tree.
// Anyone can verify that all air drops are included in the tree,
// and the tree has no additional distributions.
// interface MerkleDistributorInfo {
//   merkleRoot: string
//   tokenTotal: string
//   claims: {
//     [account: string]: {
//       index: number
//       amount: string
//       proof: string[]
//       flags?: {
//         [flag: string]: boolean
//       }
//     }
//   }
// }

// type OldFormat = { [account: string]: number | string }
// type NewFormat = { address: string; earnings: string; reasons: string }

function parseBalanceMap(balances) {
  // if balances are in an old format, process them
  /* eslint-disable indent */
  const balancesInNewFormat = Array.isArray(balances)
    ? balances
    : Object.keys(balances).map((account) => ({
        address: account,
        balance: `${balances[account].toString(16)}`,
      }));
  /* eslint-enable indent */

  const dataByAddress = balancesInNewFormat.reduce((memo, { address: account, balance }) => {
    if (!isAddress(account)) {
      throw new Error(`Found invalid address: ${account}`);
    }
    const parsed = getAddress(account);
    if (memo[parsed]) throw new Error(`Duplicate address: ${parsed}`);
    const parsedNum = BigNumber.from(balance);
    if (parsedNum.lte(0)) throw new Error(`Invalid amount for account: ${account}`);

    memo[parsed] = { amount: parsedNum };
    return memo;
  }, {});

  const sortedAddresses = Object.keys(dataByAddress).sort();

  // construct a tree
  const tree = new BalanceTree(
    sortedAddresses.map((address) => ({ account: address, amount: dataByAddress[address].amount }))
  );

  // generate claims
  const claims = sortedAddresses.reduce((memo, address) => {
    const { amount } = dataByAddress[address];
    memo[address] = {
      amount: amount.toHexString(),
      proof: tree.getProof(address, amount),
    };
    return memo;
  }, {});

  return {
    merkleRoot: tree.getHexRoot(),
    claims,
  };
}

module.exports = {
  parseBalanceMap,
};
