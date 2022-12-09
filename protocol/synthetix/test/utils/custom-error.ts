import { ethers } from 'ethers';

export function customErrorNotice(errorSignature: string) {
  console.log('ANVIL CUSTOM ERROR PROBLEM');

  console.log(
    'Anvil is failing to detect custom errors when the error is emitted from a contract which is not the one that the user is interacting with.'
  );

  console.log(
    'We can see the error when running tests with `DEBUG=cannon:cli:rpc npm t`, but we cannot detect it in these tests.'
  );

  console.log(
    `Please run tests in debug mode, and verify that the next tx is a custom error with id ${ethers.utils
      .id(errorSignature)
      .slice(0, 10)}`
  );

  console.log('If the above condition is not met, there probably is a bug in the contract code!');
}
