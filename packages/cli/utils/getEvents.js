async function getPastEvents({ contract, eventName, provider, fromBlock, toBlock }) {
	let filter = { address: contract.address };

	if (eventName) {
		filter = contract.filters[eventName]();
		if (!filter) throw new Error(`Event ${eventName} not found in contract abi.`);
	}

	filter.fromBlock = +fromBlock || 'earliest';
	filter.toBlock = +toBlock || 'latest';

	let logs = await provider.getLogs(filter);

	logs = logs.map(log =>
		Object.assign({ transactionHash: log.transactionHash, logIndex: log.logIndex }, contract.interface.parseLog(log)),
	);

	return logs;
}

module.exports = {
	getPastEvents,
};
