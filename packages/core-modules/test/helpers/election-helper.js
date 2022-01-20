const { ethers } = require('ethers');

const ElectionPeriod = {
  Idle: 0,
  Nomination: 1,
  Vote: 2,
  Evaluation: 3,
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
