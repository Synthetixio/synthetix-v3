const { ethers } = hre;
const assert = require('assert/strict');
const { bnSqrt } = require('@synthetixio/core-js/utils/ethers/bignumber');
const { parseBalanceMap } = require('@synthetixio/core-js/utils/merkle-tree/parse-balance-tree');

let _debtShareData = {};
let _crossChainDebtShareData = {};

async function simulateDebtShareData(DebtShare, users) {
  const [user1, user2, user3] = users;

  _debtShareData = {
    42: {
      [user1.address]: ethers.utils.parseEther('1000'),
      [user2.address]: ethers.utils.parseEther('24000'),
      [user3.address]: ethers.utils.parseEther('2000000'),
    },
    1337: {
      [user1.address]: ethers.utils.parseEther('0'),
      [user2.address]: ethers.utils.parseEther('30000'),
      [user3.address]: ethers.utils.parseEther('2100000'),
    },
    2192: {
      [user1.address]: ethers.utils.parseEther('500'),
      [user2.address]: ethers.utils.parseEther('35000'),
      [user3.address]: ethers.utils.parseEther('2500000'),
    },
  };

  async function simulateDebtShareBalance(user, balance, periodId) {
    const tx = await DebtShare.setBalanceOfOnPeriod(user.address, balance, periodId);
    await tx.wait();
  }

  async function simulateDebtShareBalances(periodId) {
    await simulateDebtShareBalance(user1, _debtShareData[periodId][user1.address], periodId);
    await simulateDebtShareBalance(user2, _debtShareData[periodId][user2.address], periodId);
    await simulateDebtShareBalance(user3, _debtShareData[periodId][user3.address], periodId);
  }

  await simulateDebtShareBalances('42');
  await simulateDebtShareBalances('1337');
  await simulateDebtShareBalances('2192');

  let periodId = '42';
  assert.deepEqual(
    await DebtShare.balanceOfOnPeriod(user1.address, periodId),
    _debtShareData[periodId][user1.address]
  );
  assert.deepEqual(
    await DebtShare.balanceOfOnPeriod(user2.address, periodId),
    _debtShareData[periodId][user2.address]
  );
  assert.deepEqual(
    await DebtShare.balanceOfOnPeriod(user3.address, periodId),
    _debtShareData[periodId][user3.address]
  );

  periodId = '1337';
  assert.deepEqual(
    await DebtShare.balanceOfOnPeriod(user1.address, periodId),
    _debtShareData[periodId][user1.address]
  );
  assert.deepEqual(
    await DebtShare.balanceOfOnPeriod(user2.address, periodId),
    _debtShareData[periodId][user2.address]
  );
  assert.deepEqual(
    await DebtShare.balanceOfOnPeriod(user3.address, periodId),
    _debtShareData[periodId][user3.address]
  );

  periodId = '2192';
  assert.deepEqual(
    await DebtShare.balanceOfOnPeriod(user1.address, periodId),
    _debtShareData[periodId][user1.address]
  );
  assert.deepEqual(
    await DebtShare.balanceOfOnPeriod(user2.address, periodId),
    _debtShareData[periodId][user2.address]
  );
  assert.deepEqual(
    await DebtShare.balanceOfOnPeriod(user3.address, periodId),
    _debtShareData[periodId][user3.address]
  );
}

async function simulateCrossChainDebtShareData(users) {
  const [user1, user2, user3] = users;

  _crossChainDebtShareData = {
    42: {
      [user1.address]: ethers.utils.parseEther('1000').toString(),
      [user2.address]: ethers.utils.parseEther('24000').toString(),
      [user3.address]: ethers.utils.parseEther('2000000').toString(),
    },
    1337: {
      [user1.address]: ethers.utils.parseEther('1').toString(),
      [user2.address]: ethers.utils.parseEther('30000').toString(),
      [user3.address]: ethers.utils.parseEther('2100000').toString(),
    },
    2192: {
      [user1.address]: ethers.utils.parseEther('500').toString(),
      [user2.address]: ethers.utils.parseEther('35000').toString(),
      [user3.address]: ethers.utils.parseEther('2500000').toString(),
    },
  };

  _crossChainDebtShareData[42].merkleTree = parseBalanceMap(_crossChainDebtShareData[42]);
  _crossChainDebtShareData[1337].merkleTree = parseBalanceMap(_crossChainDebtShareData[1337]);
  _crossChainDebtShareData[2192].merkleTree = parseBalanceMap(_crossChainDebtShareData[2192]);
}

function expectedDebtShare(user, periodId) {
  if (!_debtShareData[periodId] || !_debtShareData[periodId][user]) {
    return 0;
  }

  return _debtShareData[periodId][user];
}

function expectedCrossChainDebtShare(user, periodId) {
  if (!_crossChainDebtShareData[periodId] || !_crossChainDebtShareData[periodId][user]) {
    return 0;
  }

  return _crossChainDebtShareData[periodId][user];
}

function expectedVotePower(user, periodId) {
  const debtShare = expectedDebtShare(user, periodId);
  const crossChainDebtShare = expectedCrossChainDebtShare(user, periodId);

  return bnSqrt(debtShare.add(crossChainDebtShare));
}

function getCrossChainMerkleTree(periodId) {
  return _crossChainDebtShareData[periodId].merkleTree;
}

module.exports = {
  simulateDebtShareData,
  simulateCrossChainDebtShareData,
  expectedDebtShare,
  expectedCrossChainDebtShare,
  expectedVotePower,
  getCrossChainMerkleTree,
};
