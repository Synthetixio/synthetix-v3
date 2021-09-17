async function getSourcesAST(hre) {
  const fqns = await hre.artifacts.getAllFullyQualifiedNames();

  const contracts = {};
  for (const fqn of fqns) {
    const bi = await hre.artifacts.getBuildInfo(fqn);
    const split = fqn.split(':');
    const solPath = split[0];
    const contractName = split[1];
    // Hardhat includes the contract name in the object if any .sol file has more than one contract.
    contracts[contractName] = bi.output.sources[solPath][contractName]
      ? bi.output.sources[solPath][contractName].ast
      : bi.output.sources[solPath].ast;
  }
  return { contracts };
}

module.exports = {
  getSourcesAST,
};
