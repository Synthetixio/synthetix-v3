const chalk = require('chalk');

function getFunctionSignature(functionAbi) {
  return `${functionAbi.name}(${functionAbi.inputs.map((input) => input.type).join(',')})`;
}

function getFullFunctionSignature(functionAbi, functionParameters) {
  const multiline = !!functionParameters && functionParameters.length > 0;

  const isWriteCall =
    functionAbi.stateMutability !== 'view' && functionAbi.stateMutability !== 'pure';

  // Collect parameter list
  const parameterDescriptions = [];
  for (let i = 0; i < functionAbi.inputs.length; i++) {
    const input = functionAbi.inputs[i];

    const valueDescription = functionParameters ? ` = ${functionParameters[i]}` : '';

    parameterDescriptions.push(`${input.type} ${input.name}${valueDescription}`);
  }

  // Collect return values
  const outputDescriptions = functionAbi.outputs.map(
    (output) => `${output.type}${output.name ? ` ${output.name}` : ''}`
  );

  // Function name
  let str = `${functionAbi.name}${multiline ? '(\n' : '('}`;
  str += `${multiline ? '  ' : ''}${parameterDescriptions.join(multiline ? ',\n  ' : ', ')}`;
  str += `${multiline ? '\n)' : ')'}`;

  // Function decorators
  if (!isWriteCall) {
    str += ` ${functionAbi.stateMutability}`;
  }

  // Return values
  if (outputDescriptions.length > 0) {
    str += ` returns (${outputDescriptions.join(', ')})`;
  }

  return isWriteCall ? chalk.yellowBright.bold(str) : str;
}

function getFullEventSignature(eventAbi, event) {
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
  getFunctionSignature,
  getFullFunctionSignature,
  getFullEventSignature,
};
