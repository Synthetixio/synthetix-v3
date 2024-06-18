import { Contract, ContractReceipt, ContractTransaction } from 'ethers';
import assert from 'assert';
import { LogDescription } from 'ethers/lib/utils';

// --- Helpers --- //

const formatDecodedArg = (value: LogDescription['args'][number]): string => {
  // print nested values as [value1, value2, ...]
  if (Array.isArray(value)) {
    return `[${value.map((v) => formatDecodedArg(v)).join(', ')}]`;
  }

  // surround string values with quotes
  if (typeof value === 'string') {
    return `"${value}"`;
  }

  return value.toString();
};
const formatDecodedArgs = (values: LogDescription['args']) =>
  values.map((x) => formatDecodedArg(x)).join(', ');

// --- Public --- //

/** Similar to `/assertions/assert-event`, this asserts event in `expected` exist in `receipt.wait()` in a specific order. */
export const assertEvents = async (
  txOrReceipt: ContractTransaction | ContractReceipt,
  expected: (string | RegExp)[],
  contract: Contract
) => {
  // TODO: Consider wrapping this in autoMine: false; .wait(); mine(); autoMine: true.
  const receipt = 'wait' in txOrReceipt ? await txOrReceipt.wait() : txOrReceipt;
  const spaces = ' '.repeat(6); // Used to align with assert output.

  const { logs } = receipt;
  const seenEvents: string[] = [];
  const parsedLogs = logs.map((log, i) => {
    try {
      const parsed = contract.interface.parseLog(log);
      const event = `${parsed.name}(${parsed.args ? formatDecodedArgs(parsed.args) : ''})`;
      seenEvents.push(event);
      return event;
    } catch (error) {
      throw new Error(
        `Failed to parse log at index: ${i} \n${spaces}List of parsed events:\n${spaces}${seenEvents.join(
          `\n${spaces}`
        )} \n${spaces}Ethers error: ${(error as Error).message} (len: ${logs.length})`
      );
    }
  });

  if (logs.length !== expected.length) {
    throw new Error(
      `Expected ${expected.length} events, got ${logs.length}.\n${spaces}${seenEvents.join(`\n${spaces}`)}`
    );
  }

  parsedLogs.forEach((event, i) => {
    const expectedAtIndex = expected[i];
    if (
      typeof expectedAtIndex === 'string' ? event === expectedAtIndex : event.match(expectedAtIndex)
    ) {
      return;
    } else {
      const allEvents = parsedLogs.join(`\n${spaces}`);

      typeof expectedAtIndex === 'string'
        ? assert.strictEqual(
            event,
            expectedAtIndex,
            `Event at index ${i} did not match. \n${spaces}List of parsed events:\n${spaces}${allEvents}`
          )
        : assert.match(event, expectedAtIndex);
    }
  });
};
