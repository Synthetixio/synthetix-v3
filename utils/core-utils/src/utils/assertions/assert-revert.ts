import { ethers } from 'ethers';
import { AbiHelpers } from 'hardhat/internal/util/abi-helpers';

export default async function assertRevert(
  txResponsePromise: Promise<ethers.providers.TransactionResponse>,
  expectedMessage?: string,
  contract?: ethers.Contract
) {
  let errorMessage = '';

  try {
    const txResponse = await txResponsePromise;
    await txResponse.wait(); // txReceipt.
  } catch (error) {
    errorMessage = _formatError(error as { [k: string]: unknown });
  }

  if (errorMessage === '') {
    throw new Error('Transaction was expected to revert, but it did not');
  }

  if (!expectedMessage) {
    return; // No expected message to check against.
  }

  if (errorMessage.includes(expectedMessage)) {
    return; // Expected message seen in error.
  }

  // Before giving up, try to extract the custom error from the latest transaction manually.
  if (contract) {
    const customError = await _getCustomErrorFromLatestTransaction(contract);

    if (customError && customError.includes(expectedMessage)) {
      return; // Expected message seen in custom error.
    }

    // Replace the uninformative message with the retrieved custom error, if possible.
    errorMessage = customError || errorMessage;
  }

  throw new Error(
    `Transaction was expected to revert with "${expectedMessage}", but reverted with "${errorMessage}"`
  );
}

function _formatError(error: { [k: string]: unknown }): string {
  // Format text encoded custom error.
  if (error.errorName) {
    const formattedErrorArgs =
      error.errorArgs && Array.isArray(error.errorArgs)
        ? AbiHelpers.formatValues(error.errorArgs as unknown[])
        : '';
    return `${error.errorName}(${formattedErrorArgs})`;
  }

  return (error.reason as string) || (error.message as string) || error.toString();
}

async function _getCustomErrorFromLatestTransaction(contract: ethers.Contract) {
  const txResponse = await _getLatestTransaction(contract);
  const txRequest: ethers.providers.TransactionRequest = {
    from: txResponse.from,
    to: txResponse.to,
    data: txResponse.data,
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

      return `${fragment.name}(${AbiHelpers.formatValues(values as unknown[])})`;
    } catch (err) {
      // Decoding failed, try another decoder.
    }
  }
}

async function _getLatestTransaction(
  contract: ethers.Contract
): Promise<ethers.providers.TransactionResponse> {
  const provider = contract.provider;

  const latestBlock = await provider.getBlockWithTransactions('latest');

  return latestBlock.transactions[0];
}
