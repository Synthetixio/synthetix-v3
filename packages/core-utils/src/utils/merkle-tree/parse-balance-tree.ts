// based on https://github.com/Uniswap/merkle-distributor/tree/master/src
import { BigNumber, BigNumberish, utils } from 'ethers';

import BalanceTree from './balance-tree';

const { isAddress, getAddress } = utils;

interface Balance {
  address: string;
  balance: string;
}

export function parseBalanceMap(balances: Balance[] | { [addr: string]: BigNumberish }) {
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
  }, {} as { [key: string]: { amount: BigNumber } });

  const sortedAddresses = Object.keys(dataByAddress).sort();

  // construct a tree
  const tree = new BalanceTree(
    sortedAddresses.map((address) => ({
      account: address,
      amount: dataByAddress[address].amount,
    }))
  );

  // generate claims
  const claims = sortedAddresses.reduce((memo, address) => {
    const { amount } = dataByAddress[address];
    memo[address] = {
      amount: amount.toHexString(),
      proof: tree.getProof(address, amount),
    };
    return memo;
  }, {} as { [key: string]: { amount: string; proof: string[] } });

  return {
    merkleRoot: tree.getHexRoot(),
    claims,
  };
}
