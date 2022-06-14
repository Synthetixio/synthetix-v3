const periods = {
  Nomination: async (Proxy) => {
    return (await Proxy.getNominationPeriodStartDate()).toNumber() + 1;
  },
  Vote: async (Proxy) => {
    return (await Proxy.getVotingPeriodStartDate()).toNumber() + 1;
  },
  Evaluation: async (Proxy) => {
    return (await Proxy.getEpochEndDate()).toNumber() + 1;
  },
};

module.exports = async function getPeriodDate(Proxy, periodName) {
  if (!periods[periodName]) throw new Error(`Invalid period "${periodName}"`);
  return await periods[periodName](Proxy);
};

module.exports.periods = Object.keys(periods);
