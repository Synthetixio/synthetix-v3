const fs = require('fs');

function getContractBytecodeHash({ contractName, isModule = false, hre }) {
  const path = `artifacts/contracts/${
    isModule ? 'modules/' : ''
  }${contractName}.sol/${contractName}.json`;

  const file = fs.readFileSync(path);
  const data = JSON.parse(file);

  return hre.ethers.utils.sha256(data.bytecode);
}

module.exports = {
  getContractBytecodeHash,
};
