/**
 * Finds an event in a transaction receipt. If the events are unparsed,
 * will parse them if a suggested contract interface is provided.
 * @param {Object} receipt An ethers transaction receipt
 * @param {string} eventName The name of the event to find, e.g. "Transfer"
 * @param {contract} contract The contract to use for identifying unparsed logs
 * @returns {array} The array of parsed events
 */
function findEvent({ receipt, eventName, contract = undefined }) {
  const eventsAreParsed = !receipt.events.some((e) => e.event === undefined);

  let events = receipt.events;

  if (!eventsAreParsed) {
    if (!contract) {
      throw new Error(
        `Cannot find event ${eventName} in logs, and no contract interface was provided for manual parsing.`
      );
    }

    events = parseLogs({ contract, logs: events });
  }

  return events.find((e) => e.event === eventName);
}

/**
 * Manually parses raw event logs with the given contract interface
 * @param {contract} contract The contract to use for identifying the logs
 * @param {logs} logs An array of raw unparsed logs
 * @returns {array} The array of parsed events
 */
function parseLogs({ contract, logs }) {
  return logs.map((log) => {
    const event = contract.interface.parseLog(log);
    event.event = event.name;

    return event;
  });
}

module.exports = {
  findEvent,
  parseLogs,
};
