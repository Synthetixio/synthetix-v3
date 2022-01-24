const { ethers } = require('ethers');

const ElectionPeriod = {
  Null: 0,
  Idle: 1,
  Nomination: 2,
  Vote: 3,
  Evaluation: 4,
};

const assertDatesAreClose = (dateA, dateB) => {
  const numberDateA = ethers.BigNumber.isBigNumber(dateA) ? dateA.toNumber() : dateA;
  const numberDateB = ethers.BigNumber.isBigNumber(dateB) ? dateB.toNumber() : dateB;

  return Math.abs(numberDateB - numberDateA) <= 1;
};

module.exports = {
  ElectionPeriod,
  assertDatesAreClose,
};
