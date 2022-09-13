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

export default async function assertRevert(
  tx: Promise<ethers.providers.TransactionResponse>,
  expectedMessage = 'transaction failed',
  contract?: ethers.Contract
) {
  let error: any | null = null;

  try {
    await (await tx).wait();
    await tx;
  } catch (err) {
    error = err;
  }

  if (!error) {
    throw new Error('Transaction was expected to revert, but it did not');
  } else if (expectedMessage) {
    // parse the error
    const errorData = getErrorData(error);

    let receivedMessage = error.toString();
    if (errorData && contract) {
      const parsed = contract.interface.parseError(errorData);

      receivedMessage = `${parsed.name}(${
        parsed.args
          ? parsed.args.map((v) => (v.toString ? '"' + v.toString() + '"' : v)).join(', ')
          : ''
      })`;
    }

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
