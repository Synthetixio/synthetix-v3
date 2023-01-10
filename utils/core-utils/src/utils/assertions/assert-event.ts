import { AbiHelpers } from 'hardhat/internal/util/abi-helpers';
import { ethers } from 'ethers';

export default async function assertEvent(
  receipt: ethers.providers.TransactionReceipt | ethers.providers.TransactionResponse,
  expectedMatch: string,
  contract: ethers.Contract
) {
  if ((receipt as ethers.providers.TransactionResponse).wait) {
    receipt = await (receipt as ethers.providers.TransactionResponse).wait();
  }

  const seenEvents: string[] = [];

  for (const log of (receipt as ethers.providers.TransactionReceipt).logs) {
    try {
      const parsed = contract.interface.parseLog(log);

      const text = `${parsed.name}(${
        parsed.args ? AbiHelpers.formatValues(parsed.args as unknown[]) : ''
      })`;

      seenEvents.push(text);

      if (text.toLowerCase().includes(expectedMatch.toLowerCase()) || text.match(expectedMatch)) {
        return;
      }
    } catch {
      // noop
    }
  }

  throw new Error(
    `Receipt did not contain an event "${expectedMatch}". List of parsed events:\n${seenEvents.join(
      '\n'
    )}`
  );
}
