import { ethers } from 'ethers';

/**
 * Finds an event in a transaction receipt. If the events are unparsed,
 * will parse them if a suggested contract interface is provided.
 * @param {Object} receipt An ethers transaction receipt
 * @param {string} eventName The name of the event to find, e.g. "Transfer"
 * @param {contract} contract The contract to use for identifying unparsed logs
 * @returns {array} The array of parsed events
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
  let events = (receipt as any).events as any;

  if (!receipt) {
    throw new Error(
      `receipt when searching for event ${eventName} is null/undefined.`
    );
  }

  if (!receipt.logs) {
    throw new Error(
      `no logs found when searching for event ${eventName}. Did you actually pass a transaction receipt into findEvent?`
    );
  }

  if (
    (contract && !events) ||
    (events.some((e: any) => e.event === undefined) && contract)
  ) {
    events = parseLogs({ contract, logs: receipt.logs });
  }

  events = events.filter((e: any) => e.event === eventName);
  if (!events || events.length === 0) {
    return undefined;
  }

  return events.length === 1 ? events[0] : events;
}

/**
 * Manually parses raw event logs with the given contract interface
 * @param {contract} contract The contract to use for identifying the logs
 * @param {logs} logs An array of raw unparsed logs
 * @returns {array} The array of parsed events
 */
export function parseLogs({
  contract,
  logs,
}: {
  contract: ethers.Contract;
  logs: any[];
}) {
  // TODO
  return logs.map((log) => {
    const event: any = contract.interface.parseLog(log);
    event.event = event.name;

    return event;
  });
}
