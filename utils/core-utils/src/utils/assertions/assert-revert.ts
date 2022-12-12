import { ethers } from 'ethers';
import { Deferrable } from 'ethers/lib/utils';
// import { AbiHelpers } from 'hardhat/internal/util/abi-helpers';

// interface ErrorObject {
//   data?: string;
//   error?: ErrorObject;
// }

// const CUSTOM_ERROR_PREFIX =
// 'VM Exception while processing transaction: reverted with custom error ';

export default async function assertRevert(
  txResponsePromise: Promise<ethers.providers.TransactionResponse>,
  expectedMessage?: string,
  contract?: ethers.Contract
) {
  let error: { [k: string]: unknown } | null = null;
  let txResponse, txReceipt;

  // Try to trigger the reversion.
  try {
    console.log('> bef:', JSON.stringify(txResponsePromise, null, 2));
    txResponse = await txResponsePromise;
    console.log('> res:', txResponse);
    txReceipt = await txResponse.wait(); // txReceipt
    console.log('> rec:', txReceipt);
  } catch (err) {
    error = err as { [k: string]: unknown };
    console.log('> error:', error);
  }

  // Compare the error with the expected error message.
  if (error) {
    if (expectedMessage) {
      const msg = error.toString();

      // If no match,
      if (!msg.includes(expectedMessage)) {
        // Try decoding error message manually before throwing.
        if (contract) {
          console.log('> tx from error:', error.transaction);
          const txRequest = error.transaction as ethers.providers.TransactionRequest;
          console.log('> req from tx:', txRequest);
          const customError = await getCustomError(txRequest, contract);

          // If match,
          if (customError && customError.includes(expectedMessage)) {
            // Revert reason decoded manually and a match was found.
            return;
          }
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

  // if (!error) {
  //   throw new Error('Transaction was expected to revert, but it did not');
  // } else if (expectedMessage) {
  //   const receivedMessage = getCustomError(error, await contract) ?? error.toString();

  //   if (!receivedMessage.includes(expectedMessage)) {
  //     // ----------------------------------------------------------------------------
  //     // TODO: Remove this check once the following issue is solved in hardhat:
  //     // https://github.com/nomiclabs/hardhat/issues/1996
  //     // Basically, the first time tests are run, the revert reason is not parsed,
  //     // but the second time it is parsed just fine;
  //     if (
  //       receivedMessage.includes('reverted with an unrecognized custom error') ||
  //       receivedMessage.includes('revert with unrecognized return data or custom error')
  //     ) {
  //       console.warn(
  //         `WARNING: assert-revert was unable to parse revert reason. The reason will be ignored in this test: ${receivedMessage}`
  //       );
  //       return;
  //     }
  //     // ----------------------------------------------------------------------------

  //     throw new Error(
  //       `Transaction was expected to revert with "${expectedMessage}", but reverted with "${receivedMessage}"`
  //     );
  //   }
  // }
}

async function getCustomError(
  txResponsePromise: ethers.providers.TransactionRequest,
  contract: ethers.Contract
) {
  const provider = contract.provider;
  const code = await provider.call(txResponsePromise);
  console.log('> code:', code);

  for (const fragment of Object.values(contract.interface.errors)) {
    console.log('> fragment:', fragment);
    try {
      const errorValues = contract.interface.decodeErrorResult(fragment, code);
      return `${fragment.name}(${errorValues.join(',')})`;
    } catch (err) {}
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// function getCustomError(error: any, contract?: ethers.Contract): string | null {
//   if (error?.errorSignature) {
//     return `${error.errorName}(${
//       Array.isArray(error.errorArgs) ? AbiHelpers.formatValues(error.errorArgs as unknown[]) : ''
//     })`;
//   }

//   if (error instanceof Error) {
//     const result = _parseCustomErrorString(error.message);
//     if (result) return result;
//   }

//   const errorData = getErrorData(error);

//   if (errorData && contract) {
//     const parsed = contract.interface.parseError(errorData);
//     return `${parsed.name}(${
//       parsed.args ? AbiHelpers.formatValues(parsed.args as unknown[]) : ''
//     })`;
//   }

//   if (typeof error?.reason === 'string') {
//     return _parseCustomErrorString(error!.reason!);
//   }

//   return null;
// }

// function getErrorData(err: ErrorObject): string | null {
//   if (!err) {
//     throw new Error('Missing error object');
//   }

//   if (err.data) {
//     return err.data;
//   }

//   if (err.error) {
//     return getErrorData(err.error);
//   }

//   return null;
// }

// function _parseCustomErrorString(msg: string) {
//   if (msg && msg.startsWith(CUSTOM_ERROR_PREFIX)) {
//     return msg.slice(CUSTOM_ERROR_PREFIX.length + 1, -1);
//   }

//   return null;
// }
