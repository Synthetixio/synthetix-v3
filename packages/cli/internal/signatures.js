function getFullFunctionSignature(contractName, functionName, functionParameters) {
  const abi = hre.deployer.deployment.abis[contractName];
  const functionAbi = abi.find((abiItem) => abiItem.name === functionName);

  const multiline = !!functionParameters && functionParameters.length > 0;

  const parameterDescriptions = [];
  for (let i = 0; i < functionAbi.inputs.length; i++) {
    const input = functionAbi.inputs[i];

    const valueDescription = functionParameters ? ` = ${functionParameters[i]}` : '';

    parameterDescriptions.push(`${input.type} ${input.name}${valueDescription}`);
  }

  let str = `${functionAbi.name}${multiline ? '(\n' : '('}`;
  str += `${multiline ? '  ' : ''}${parameterDescriptions.join(multiline ? ',\n  ' : ', ')}`;
  str += `${multiline ? '\n)' : ')'}`;

  return str;
}

function getFullEventSignature(contractName, event) {
  const abi = hre.deployer.deployment.abis[contractName];
  const eventAbi = abi.find((entry) => entry.name === event.event);

  let i = 0;
  const namedArgs = event.args.map((arg) => {
    const input = eventAbi.inputs[i];
    i++;

    return `${input.type} ${input.name} = ${arg}`;
  });

  let str = `${event.event}(\n`;
  str += `  ${namedArgs.join(',\n  ')}`;
  str += '\n)';

  return str;
}

module.exports = {
  getFullFunctionSignature,
  getFullEventSignature,
};
