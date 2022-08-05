const { ElectionPeriod } = require('../internal/constants');

/**
 * @param {Object} ElectionModule
 * @param {("Administration"|"Nomination"|"Vote"|"Evaluation")} period
 */
module.exports = async function assertPeriod(ElectionModule, period) {
  if (typeof ElectionPeriod[period] !== 'number') {
    throw new Error(`Invalid given period "${period}"`);
  }

  const currentPeriod = Number(await ElectionModule.getCurrentPeriod());

  if (currentPeriod !== ElectionPeriod[period]) {
    throw new Error(`The election is not on ElectionPeriod.${period}`);
  }
};
