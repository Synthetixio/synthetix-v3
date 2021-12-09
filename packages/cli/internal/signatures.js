function getFullFunctionSignature(functionAbi, functionParameters) {
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
  getFullFunctionSignature,
  getFullEventSignature,
};
