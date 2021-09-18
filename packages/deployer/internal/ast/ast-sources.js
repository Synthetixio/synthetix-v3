async function getContractAST({ sourceName, contractName }) {
  const { output } = await hre.artifacts.getBuildInfo(`${sourceName}:${contractName}`);
  // Hardhat includes the contract name in the object if any .sol file has more than one contract.
  return output.sources[sourceName][contractName]
    ? output.sources[sourceName][contractName].ast
    : output.sources[sourceName].ast;
}

async function getSourcesAST(hre) {
  const fqns = await hre.artifacts.getAllFullyQualifiedNames();

  const contracts = {};
  for (const fqn of fqns) {
    const [sourceName, contractName] = fqn.split(':');
    contracts[contractName] = await getContractAST({ sourceName, contractName });
  }

  return { contracts };
}

module.exports = {
  getContractAST,
  getSourcesAST,
};
