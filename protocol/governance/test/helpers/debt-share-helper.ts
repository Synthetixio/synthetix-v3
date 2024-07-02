import { bnSqrt } from '@synthetixio/core-utils/utils/ethers/bignumber';
import { parseBalanceMap } from '@synthetixio/core-utils/utils/merkle-tree/parse-balance-tree';
import { ethers } from 'ethers';

import type { DebtShareMock } from '../generated/typechain';

interface DebtShareData {
  [chainId: number]: {
    [address: string]: ethers.BigNumber;
  };
}

interface MerkleTreeData {
  [chainId: number]: ReturnType<typeof parseBalanceMap>;
}

let _debtShareData: DebtShareData = {};
let _crossChainDebtShareData: DebtShareData = {};
const _crossChainMerkleTreeData: MerkleTreeData = {};

export async function simulateDebtShareData(DebtShare: DebtShareMock, users: ethers.Signer[]) {
  const addresses = await Promise.all(users.map((u) => u.getAddress()));

  _debtShareData = {
    42: {
      [addresses[0]]: ethers.utils.parseEther('1000'),
      [addresses[1]]: ethers.utils.parseEther('24000'),
      [addresses[2]]: ethers.utils.parseEther('200000'),
      [addresses[3]]: ethers.utils.parseEther('30000'),
      [addresses[4]]: ethers.utils.parseEther('20'),
    },
    1337: {
      [addresses[0]]: ethers.utils.parseEther('0'),
      [addresses[1]]: ethers.utils.parseEther('30000'),
      [addresses[2]]: ethers.utils.parseEther('21000'),
      [addresses[3]]: ethers.utils.parseEther('459000'),
      [addresses[4]]: ethers.utils.parseEther('100'),
    },
    2192: {
      [addresses[0]]: ethers.utils.parseEther('500'),
      [addresses[1]]: ethers.utils.parseEther('10'),
      [addresses[2]]: ethers.utils.parseEther('2500'),
      [addresses[3]]: ethers.utils.parseEther('50000'),
      [addresses[4]]: ethers.utils.parseEther('1'),
    },
  };

  for (const periodId of Object.keys(_debtShareData)) {
    const balances = _debtShareData[Number.parseInt(periodId)]! as DebtShareData[number];
    for (const address of Object.keys(balances)) {
      const balance = balances[address];
      const tx = await DebtShare.setBalanceOfOnPeriod(address, balance, periodId);
      await tx.wait();
    }
  }
}

export async function simulateCrossChainDebtShareData(users: ethers.Signer[]) {
  const addresses = await Promise.all(users.map((u) => u.getAddress()));

  _crossChainDebtShareData = {
    42: {
      [addresses[0]]: ethers.utils.parseEther('1000000'),
      [addresses[1]]: ethers.utils.parseEther('240000'),
      [addresses[2]]: ethers.utils.parseEther('1000'),
    },
    1337: {
      [addresses[0]]: ethers.utils.parseEther('205000'),
      [addresses[1]]: ethers.utils.parseEther('300000'),
      [addresses[2]]: ethers.utils.parseEther('2100'),
    },
    2192: {
      [addresses[0]]: ethers.utils.parseEther('1'),
      [addresses[1]]: ethers.utils.parseEther('35000'),
      [addresses[2]]: ethers.utils.parseEther('250000'),
    },
    666: {
      [addresses[0]]: ethers.utils.parseEther('666'),
      [addresses[1]]: ethers.utils.parseEther('666'),
      [addresses[2]]: ethers.utils.parseEther('666'),
    },
  };

  for (const key of Object.keys(_crossChainDebtShareData)) {
    const periodId = Number.parseInt(key);
    _crossChainMerkleTreeData[periodId] = parseBalanceMap(
      _stringifyBalances(_crossChainDebtShareData[periodId])
    );
  }
}

function _stringifyBalances(balances: DebtShareData[number]) {
  return Object.fromEntries(
    Object.entries(balances).map(([user, balance]) => [user, balance.toString()])
  );
}

export async function expectedDebtShare(
  user: ethers.Signer,
  periodId: number
): Promise<ethers.BigNumber> {
  const address = await user.getAddress();
  return _debtShareData[periodId]?.[address] || ethers.BigNumber.from(0);
}

export async function expectedCrossChainDebtShare(
  user: ethers.Signer,
  periodId: number
): Promise<ethers.BigNumber> {
  const address = await user.getAddress();
  return _crossChainDebtShareData[periodId]?.[address] || ethers.BigNumber.from(0);
}

export async function expectedVotePower(
  user: ethers.Signer,
  periodId: number
): Promise<ethers.BigNumber> {
  const debtShare = await expectedDebtShare(user, periodId);
  const crossChainDebtShare = await expectedCrossChainDebtShare(user, periodId);
  return bnSqrt(debtShare.add(crossChainDebtShare));
}

export function getCrossChainMerkleTree(periodId: number) {
  return _crossChainMerkleTreeData[periodId]!;
}
