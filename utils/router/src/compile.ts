import solc from 'solc';

export async function compileRouter(contractName: string, sourceCode: string) {
  const input = {
    language: 'Solidity',
    sources: {
      [`${contractName}.sol`]: {
        content: sourceCode,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['*'],
        },
      },
    },
  };

  const solResult = JSON.parse(await solc.compile(JSON.stringify(input)));

  return solResult.contracts[`${contractName}.sol`][contractName];
}
