import { AbiHelpers } from 'hardhat/internal/util/abi-helpers';
import { ethers } from 'ethers';

interface ErrorObject {
  data?: string;
  error?: ErrorObject;
}

function getErrorData(err: ErrorObject): string | null {
  if (!err) {
    throw new Error('Missing error object');
  }

  if (err.data) {
    return err.data;
  }

  if (err.error) {
    return getErrorData(err.error);
  }

  return null;
}

const CUSTOM_ERROR_PREFIX =
  'VM Exception while processing transaction: reverted with custom error ';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCustomError(error: any, contract?: ethers.Contract): string | null {
  const errorData = getErrorData(error);

  if (errorData && contract) {
    const parsed = contract.interface.parseError(errorData);
    return `${parsed.name}(${
      parsed.args ? AbiHelpers.formatValues(parsed.args as unknown[]) : ''
    })`;
  }

  if (typeof error?.reason === 'string' && error.reason.startsWith(CUSTOM_ERROR_PREFIX)) {
    return error?.reason.slice(CUSTOM_ERROR_PREFIX.length + 1, -1);
  }

  return null;
}

export default async function assertRevert(
  tx: Promise<ethers.providers.TransactionResponse>,
  expectedMessage?: string,
  contract?: ethers.Contract
) {
  let error: { [k: string]: unknown } | null = null;

  try {
    await (await tx).wait();
    await tx;
  } catch (err) {
    error = err as { [k: string]: unknown };
  }

  if (!error) {
    throw new Error('Transaction was expected to revert, but it did not');
  } else if (expectedMessage) {
    const receivedMessage = getCustomError(error, contract) ?? error.toString();

    if (!receivedMessage.includes(expectedMessage)) {
      // ----------------------------------------------------------------------------
      // TODO: Remove this check once the following issue is solved in hardhat:
      // https://github.com/nomiclabs/hardhat/issues/1996
      // Basically, the first time tests are run, the revert reason is not parsed,
      // but the second time it is parsed just fine;
      if (
        receivedMessage.includes('reverted with an unrecognized custom error') ||
        receivedMessage.includes('revert with unrecognized return data or custom error')
      ) {
        console.warn(
          `WARNING: assert-revert was unable to parse revert reason. The reason will be ignored in this test: ${receivedMessage}`
        );
        return;
      }
      // ----------------------------------------------------------------------------

      throw new Error(
        `Transaction was expected to revert with "${expectedMessage}", but reverted with "${receivedMessage}"`
      );
    }
  }
}
