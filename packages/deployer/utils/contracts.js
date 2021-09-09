const fs = require('fs');
const path = require('path');
const {
  getAddressBytecodeHash,
  getContractBytecodeHash,
} = require('@synthetixio/core-js/utils/contracts');

async function alreadyDeployed(contractPath, contractData) {
  if (!contractData.deployedAddress) return false;

  const sourceBytecodeHash = getContractBytecodeHash(contractPath);
  const remoteBytecodeHash = await getAddressBytecodeHash(contractData.deployedAddress);

  return sourceBytecodeHash === remoteBytecodeHash;
}

module.exports = {
  alreadyDeployed,
};
