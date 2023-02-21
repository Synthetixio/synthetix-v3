import { ethers, Transaction } from 'ethers';

// Verifies that a given transaction reverts with the specified error message.
// Will throw if no expectedMessage is specified.
// If expectedMessage is a custom error, always wrap its parameters in quotes,
// E.g. 'ErrorName("1", "0xabc"), no matter the type of the parameter.
// Specifying a contract will help the utility decode custom errors manually,
// when the error is not found in the revert reason.
export default async function assertRevert(
  txResponsePromise: Promise<unknown>,
  expectedMessage?: string,
  contract?: ethers.Contract
) {
  let error;
  try {
    const txResponse = (await txResponsePromise) as ethers.providers.TransactionResponse;

    if (txResponse.wait) {
      await txResponse.wait(); // txReceipt.
    }
  } catch (err) {
    error = err as { [k: string]: unknown };
  }

  if (!error) {
    throw new Error('Transaction was expected to revert, but it did not');
  }

  if (!expectedMessage || expectedMessage === '') {
    throw new Error(
      `No "expectedMessage" specified. This is not recommended. Please specify any type of message to check against.\n${error}`
    );
  }

  let errorMessage = formatErrorMessage(error);
  if (errorMessage.includes(expectedMessage)) {
    return; // Expected message found.
  }

  if (errorMessage.replace(/"/g, '').includes(expectedMessage.replace(/"/g, ''))) {
    console.warn('assertRevert: matched by removing quotes');
    return; // Expected message found (albeit, without quotes).
  }

  // Before giving up, try to extract the custom error from the transaction manually.
  if (contract) {
    const transaction =
      (error.transaction as Transaction) || (await _getLatestTransaction(contract.provider));
    const customError = await _getCustomErrorFromTransaction(transaction, contract);

    if (customError && customError.includes(expectedMessage)) {
      return; // Expected message found in custom error.
    }

    // Before throwing, replace the uninformative original message
    // with the retrieved custom error (if retrieved).
    errorMessage = customError || errorMessage;
  }

  throw new Error(
    `Transaction was expected to revert with "${expectedMessage}", but reverted with "${errorMessage}"\n${error}`
  );
}

const HARDHAT_CUSTOM_PREFIX =
  'VM Exception while processing transaction: reverted with custom error ';

// Converts an error into a string, and handles edge cases.
export function formatErrorMessage(error: { [k: string]: unknown }): string {
  // Custom error is found in the error message as
  // 'errorArgs=[{"type":"BigNumber","hex":"0x0539"}], errorName="ErrorName"'.
  if (error.errorName) {
    const formattedErrorArgs =
      error.errorArgs && Array.isArray(error.errorArgs) ? _wrapInQuotes(error.errorArgs) : '';

    return `${error.errorName}(${formattedErrorArgs})`;
  }

  // Custom errors when using network Hardhat, no need to parse them.
  if (error.error instanceof Error && error.error.message.startsWith(HARDHAT_CUSTOM_PREFIX)) {
    return error.error.message.slice(HARDHAT_CUSTOM_PREFIX.length + 1, -1);
  }

  // Custom error is found in the error message as
  // 'reverted with custom error ErrorName(1, "0xabc")' - no quotes in numeric values.
  if (typeof error.message === 'string' && error.message.includes('custom error')) {
    let msg = error.message as string;

    const regex = /\((.*?)\)/; // Match stuff within quotes.
    const matches = msg.match(regex);

    if (matches) {
      const withinParentheses = matches[1]; // idx 0 includes parentheses, idx 1 does not.
      const values = withinParentheses.split(', ');

      values.forEach((v) => {
        if (!v.includes('"')) {
          msg = msg.replace(v, `"${v}"`);
        }
      });
    }

    return msg;
  }

  // No edge cases, just stringify.
  return error.toString();
}

// Tries to retrieve a formatted custom error from the specified transaction.
// Uses a low level call to retrieve the encoded hex response from the rpc,
// and parses the response manually using the specified contract interface.
async function _getCustomErrorFromTransaction(transaction: Transaction, contract: ethers.Contract) {
  const txRequest: ethers.providers.TransactionRequest = {
    from: transaction.from,
    to: transaction.to,
    data: transaction.data,
  };

  // Retrieve the error code of the transaction.
  const provider = contract.provider;
  const code = await provider.call(txRequest);

  // Try decoding the returned code of the call with all the errors
  // defined in the contract's interface.
  for (const fragment of Object.values(contract.interface.errors)) {
    try {
      // This line will throw if the code is not decodable with this error fragment.
      const values = contract.interface.decodeErrorResult(fragment, code);

      return `${fragment.name}(${_wrapInQuotes(values as unknown[])})`;
    } catch (err) {
      // Decoding failed, try another fragment.
    }
  }
}

// Retrieves the latest transaction from the latest mined block.
async function _getLatestTransaction(
  provider: ethers.providers.Provider
): Promise<ethers.providers.TransactionResponse> {
  const latestBlock = await provider.getBlockWithTransactions('latest');

  return latestBlock.transactions[0];
}

// Wraps a list of parameters in quotes.
// E.g. [1, 2, 0xabc] to ["1", "2", "0xabc"].
function _wrapInQuotes(values: unknown[]): string {
  return values.map((v) => `"${String(v)}"`).join(', ');
}
