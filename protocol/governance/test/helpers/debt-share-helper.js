const { ethers } = hre;
const { bnSqrt } = require('@synthetixio/core-utils/utils/ethers/bignumber');
const { parseBalanceMap } = require('@synthetixio/core-utils/utils/merkle-tree/parse-balance-tree');

let _debtShareData = {};
let _crossChainDebtShareData = {};

async function simulateDebtShareData(DebtShare, users) {
  const [user1, user2, user3, user4, user5] = users;

  _debtShareData = {
    42: {
      [user1.address]: ethers.utils.parseEther('1000'),
      [user2.address]: ethers.utils.parseEther('24000'),
      [user3.address]: ethers.utils.parseEther('200000'),
      [user4.address]: ethers.utils.parseEther('30000'),
      [user5.address]: ethers.utils.parseEther('20'),
    },
    1337: {
      [user1.address]: ethers.utils.parseEther('0'),
      [user2.address]: ethers.utils.parseEther('30000'),
      [user3.address]: ethers.utils.parseEther('21000'),
      [user4.address]: ethers.utils.parseEther('459000'),
      [user5.address]: ethers.utils.parseEther('100'),
    },
    2192: {
      [user1.address]: ethers.utils.parseEther('500'),
      [user2.address]: ethers.utils.parseEther('10'),
      [user3.address]: ethers.utils.parseEther('2500'),
      [user4.address]: ethers.utils.parseEther('50000'),
      [user5.address]: ethers.utils.parseEther('1'),
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
    await simulateDebtShareBalance(user4, _debtShareData[periodId][user4.address], periodId);
    await simulateDebtShareBalance(user5, _debtShareData[periodId][user5.address], periodId);
  }

  await simulateDebtShareBalances('42');
  await simulateDebtShareBalances('1337');
  await simulateDebtShareBalances('2192');
}

async function simulateCrossChainDebtShareData(users) {
  const [user1, user2, user3] = users;

  _crossChainDebtShareData = {
    42: {
      [user1.address]: ethers.utils.parseEther('1000000'),
      [user2.address]: ethers.utils.parseEther('240000'),
      [user3.address]: ethers.utils.parseEther('1000'),
    },
    1337: {
      [user1.address]: ethers.utils.parseEther('205000'),
      [user2.address]: ethers.utils.parseEther('300000'),
      [user3.address]: ethers.utils.parseEther('2100'),
    },
    2192: {
      [user1.address]: ethers.utils.parseEther('1'),
      [user2.address]: ethers.utils.parseEther('35000'),
      [user3.address]: ethers.utils.parseEther('250000'),
    },
    666: {
      [user1.address]: ethers.utils.parseEther('666'),
      [user2.address]: ethers.utils.parseEther('666'),
      [user3.address]: ethers.utils.parseEther('666'),
    },
  };

  function stringifyBalances(balances) {
    Object.keys(balances).forEach((user) => (balances[user] = balances[user].toString()));

    return balances;
  }

  _crossChainDebtShareData[42].merkleTree = parseBalanceMap(
    stringifyBalances(_crossChainDebtShareData[42])
  );
  _crossChainDebtShareData[1337].merkleTree = parseBalanceMap(
    stringifyBalances(_crossChainDebtShareData[1337])
  );
  _crossChainDebtShareData[2192].merkleTree = parseBalanceMap(
    stringifyBalances(_crossChainDebtShareData[2192])
  );
  _crossChainDebtShareData[666].merkleTree = parseBalanceMap(
    stringifyBalances(_crossChainDebtShareData[666])
  );
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
