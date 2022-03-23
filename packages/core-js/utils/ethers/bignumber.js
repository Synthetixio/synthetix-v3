const ethers = require('ethers');

const BN_ONE = ethers.BigNumber.from(1);
const BN_TWO = ethers.BigNumber.from(2);

function bnSqrt(value) {
  let z = value.add(BN_ONE).div(BN_TWO);
  let y = value;

  while (z.sub(y).isNegative()) {
    y = z;
    z = value.div(z).add(z).div(BN_TWO);
  }

  return y;
}

module.exports = {
  BN_ONE,
  BN_TWO,
  bnSqrt,
};
