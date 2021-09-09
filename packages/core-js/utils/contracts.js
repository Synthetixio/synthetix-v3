const ethers = require('ethers');

async function deployedContractHasBytescode(contractAddress, bytecode, provider) {
  const sourceBytecodeHash = getBytecodeHash(bytecode);
  const remoteBytecodeHash = getBytecodeHash(await getRemoteBytecode(contractAddress, provider));

  return sourceBytecodeHash === remoteBytecodeHash;
}

function getBytecodeHash(bytecode) {
  return ethers.utils.sha256(bytecode);
}

async function getRemoteBytecode(address, provider) {
  return await (provider || ethers.provider).getCode(address);
}

async function getSelectors(contractAbi) {
  const contract = await new ethers.Contract(
    '0x0000000000000000000000000000000000000001',
    contractAbi
  );

  return contract.interface.fragments.reduce((selectors, fragment) => {
    if (fragment.type === 'function') {
      selectors.push({
        name: fragment.name,
        selector: contract.interface.getSighash(fragment),
      });
    }

    return selectors;
  }, []);
}

module.exports = {
  deployedContractHasBytescode,
  getBytecodeHash,
  getRemoteBytecode,
  getSelectors,
};
