import solc from 'solc';

export function getCompileInput(contractName: string, sourceCode: string) {
  return {
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
      evmVersion: 'paris', // lock to older evm version for the time b eing because there is no way to specify it from outside of the tool
    },
  };
}

export async function compileContract(contractName: string, sourceCode: string) {
  const input = getCompileInput(contractName, sourceCode);

  const solResult = JSON.parse(await solc.compile(JSON.stringify(input)));

  return solResult.contracts[`${contractName}.sol`][contractName];
}
