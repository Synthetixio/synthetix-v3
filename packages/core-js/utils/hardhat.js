async function getContractAST({ sourceName, contractName }) {
  const { output } = await hre.artifacts.getBuildInfo(`${sourceName}:${contractName}`);

  // Hardhat includes the contract name in the object if any .sol file has more than one contract.
  return output.sources[sourceName][contractName]
    ? output.sources[sourceName][contractName].ast
    : output.sources[sourceName].ast;
}

async function getAllContractASTs() {
  // A fully qualified name looks like "contracts/modules/OwnerModule.sol:OwnerModule"
  // i.e. "<path/to/file>:<contract-name>"
  const names = await hre.artifacts.getAllFullyQualifiedNames();

  const asts = {};

  for (const name of names) {
    const [sourceName, contractName] = name.split(':');

    asts[contractName] = await getContractAST({ sourceName, contractName });
  }

  return asts;
}

module.exports = {
  getContractAST,
  getAllContractASTs,
};
