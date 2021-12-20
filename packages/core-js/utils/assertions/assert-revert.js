module.exports = async function assertRevert(tx, expectedMessage) {
  let error;

  try {
    await (await tx).wait();
  } catch (err) {
    error = err;
  }

  if (!error) {
    throw new Error('Transaction was expected to revert, but it did not');
  } else if (expectedMessage) {
    const receivedMessage = error.toString();

    if (!receivedMessage.includes(expectedMessage)) {
      // ----------------------------------------------------------------------------
      // TODO: Remove this check once the following issue is solved in hardhat:
      // https://github.com/nomiclabs/hardhat/issues/1996
      // Basically, the first time tests are run, the revert reason is not parsed,
      // but the second time it is parsed just fine;
      if (receivedMessage.includes('reverted with an unrecognized custom error')) {
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
};
