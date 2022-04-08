const { getTime } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');

exports.calculateEpochDates = async function calculateEpochDates(...args) {
  const epochDuration = JSON.parse(args[0]);
  const votingPeriodDuration = JSON.parse(args[1]);

  const now = await getTime(hre.ethers.provider);

  const epochEndDate = now + daysToSeconds(epochDuration);
  const votingPeriodStartDate = epochEndDate - daysToSeconds(votingPeriodDuration);
  const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(votingPeriodDuration);

  return {
    nominationPeriodStartDate,
    votingPeriodStartDate,
    epochEndDate,
  };
};
