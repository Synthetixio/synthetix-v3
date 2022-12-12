import { ethers } from 'ethers';

export default async function assertRevert(
  txResponsePromise: Promise<ethers.providers.TransactionResponse>,
  expectedMessage?: string,
  contract?: ethers.Contract
) {
  let error: { [k: string]: unknown } | null = null;
  let txResponse, txReceipt;

  // Try to trigger the reversion.
  try {
    txResponse = await txResponsePromise;
    txReceipt = await txResponse.wait(); // txReceipt
  } catch (err) {
    error = err as { [k: string]: unknown };
  }

  // Compare the error with the expected error message.
  if (error) {
    if (expectedMessage) {
      let msg = error.toString();

      // If no match,
      if (!msg.includes(expectedMessage)) {
        // Try decoding error message manually before throwing.
        if (contract) {
          txResponse = await _getLatestTransactionWithContract(contract);
          const txRequest = txResponse as ethers.providers.TransactionRequest;
          const customError = await _getCustomError(txRequest, contract);

          // If match,
          if (customError && customError.includes(expectedMessage)) {
            // Revert reason decoded manually and a match was found.
            return;
          }

          // Replace the uninformative message with the retrieved custom error, if possible.
          msg = customError || msg;
        }

        throw new Error(
          `Transaction was expected to revert with "${expectedMessage}", but reverted with "${msg}"`
        );
      }

      // Transaction reverted, and a match was found.
      return;
    }

    // Transaction reverted, but assertion does not need a revert reason.
    return;
  }

  throw new Error('Transaction was expected to revert, but it did not');
}

async function _getLatestTransactionWithContract(
  contract: ethers.Contract
): Promise<ethers.providers.TransactionResponse | null> {
  const provider = contract.provider;

  const latestBlock = await provider.getBlockWithTransactions('latest');

  return latestBlock.transactions[0];
}

async function _getCustomError(
  txRequest: ethers.providers.TransactionRequest,
  contract: ethers.Contract
) {
  const provider = contract.provider;
  const code = await provider.call(txRequest);

  for (const fragment of Object.values(contract.interface.errors)) {
    try {
      const errorValues = contract.interface.decodeErrorResult(fragment, code);
      return `${fragment.name}(${errorValues.join(', ')})`;
    } catch (err) {}
  }
}
