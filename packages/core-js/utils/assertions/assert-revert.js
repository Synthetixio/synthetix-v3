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

    // TODO The condition covering 'unrecognized' is added temporarily to hack another issue.
    // Remove it when https://github.com/Synthetixio/synthetix-v3/issues/273 is resolved
    if (
      !receivedMessage.includes(expectedMessage) &&
      !receivedMessage.includes('reverted with an unrecognized custom error')
    ) {
      throw new Error(
        `Transaction was expected to revert with "${expectedMessage}", but reverted with "${receivedMessage}"`
      );
    }
  }
};
