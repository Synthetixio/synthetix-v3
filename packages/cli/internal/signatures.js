function getSignatureWithParameterNamesAndValues(contractName, functionName, functionParameters) {
  const abi = hre.deployer.deployment.abis[contractName];
  const functionAbi = abi.find((abiItem) => abiItem.name === functionName);

  const multiline = !!functionParameters && functionParameters.length > 0;

  const parameterDescriptions = [];
  for (let i = 0; i < functionAbi.inputs.length; i++) {
    const input = functionAbi.inputs[i];

    const valueDescription = functionParameters ? ` = ${functionParameters[i]}` : '';

    parameterDescriptions.push(`${input.type} ${input.name}${valueDescription}`);
  }

  let str = `${contractName}.${functionAbi.name}${multiline ? '(\n' : '('}`;
  str += `${multiline ? '  ' : ''}${parameterDescriptions.join(multiline ? ',\n  ' : ', ')}`;
  str += `${multiline ? '\n)' : ')'}`;

  return str;
}

module.exports = {
  getSignatureWithParameterNamesAndValues,
};
