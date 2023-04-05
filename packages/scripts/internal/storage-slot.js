const { ethers } = require('ethers');

module.exports = {
  getStorageSlot(label) {
    const hash = ethers.utils.id(label);
    const offsetedHash = ethers.BigNumber.from(hash).sub(1);
    return offsetedHash.toHexString(32);
  },
};
