import { LogDescription } from '@ethersproject/abi/lib/interface';
import { Result } from '@ethersproject/abi';
import { ethers } from 'ethers';

/**
 * Finds an event in a transaction receipt. If the events are unparsed,
 * will parse them if a suggested contract interface is provided.
 * @param receipt An ethers transaction receipt
 * @param eventName The name of the event to find, e.g. "Transfer"
 * @param contract The contract to use for identifying unparsed logs
 * @returns The array of parsed events
 */
export function findEvent({
  receipt,
  eventName,
  contract = undefined,
}: {
  receipt: ethers.providers.TransactionReceipt;
  eventName: string;
  contract?: ethers.Contract;
}) {
  if (!receipt) {
    throw new Error(`receipt when searching for event ${eventName} is null/undefined.`);
  }

  let { events } = receipt as ethers.ContractReceipt;

  if (!receipt.logs) {
    throw new Error(
      `no logs found when searching for event ${eventName}. Did you actually pass a transaction receipt into findEvent?`
    );
  }

  if (
    (contract && !events) ||
    (Array.isArray(events) && events.some((e) => e.event === undefined) && contract)
  ) {
    events = parseLogs({ contract, logs: receipt.logs });
  }

  if (!Array.isArray(events)) {
    throw new Error('missing events object');
  }

  events = events.filter((e) => e.event === eventName);
  if (events.length === 0) {
    return undefined;
  }

  return events.length === 1 ? events[0] : events;
}

/**
 * Manually parses raw event logs with the given contract interface
 * @param contract The contract to use for identifying the logs
 * @param logs An array of raw unparsed logs
 * @returns The array of parsed events
 */
export function parseLogs({
  contract,
  logs,
}: {
  contract: ethers.Contract;
  logs: ethers.providers.Log[];
}) {
  return logs.map((log) => {
    const event = contract.interface.parseLog(log) as unknown as ethers.Event;
    event.event = (event as unknown as LogDescription).name;
    return event;
  });
}

interface EventWithArgs extends ethers.Event {
  args: Result;
}

/**
 * findEvent function but validates that theres only a single result
 * @param receipt An ethers transaction receipt
 * @param eventName The name of the event to find, e.g. "Transfer"
 * @param contract The contract to use for identifying unparsed logs
 * @returns The found Event
 */
export function findSingleEvent(params: Parameters<typeof findEvent>[0]) {
  const event = findEvent(params);

  if (!event) throw new Error('Event not found');
  if (Array.isArray(event)) throw new Error('Multiple events found');
  if (!event.args) throw new Error('The event does not have args');

  return event as EventWithArgs;
}
