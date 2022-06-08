const { task } = require('hardhat/config');
const inquirer = require('inquirer');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { formatDate } = require('@synthetixio/core-js/utils/misc/dates');
const getPackageProxy = require('../internal/get-package-proxy');
const getPeriodDate = require('../internal/get-period-date');
const getTimestamp = require('../internal/get-timestamp');
const { COUNCILS, ElectionPeriod } = require('../internal/constants');

task('governance-fixtures', 'CLI tools for managing governance fixtures')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .setAction(async ({ instance }, hre) => {
    //eslint-disable-next-line no-constant-condition
    while (true) {
      const councils = await initCouncils(hre, instance);

      const ui = new inquirer.ui.BottomBar();

      const timestamp = await getTimestamp(hre);
      const blockNumber = await hre.ethers.provider.getBlockNumber();

      const time = new Date(timestamp * 1000);
      ui.log.write(
        toOneLine({
          Network: hre.network.name,
          BlockNumber: blockNumber,
          Timestamp: timestamp,
          Date: formatDate(time),
        })
      );

      const choices = [];

      await Promise.all(
        councils.map(async (council) => {
          choices.push(
            new inquirer.Separator(
              `${council.name.toLocaleUpperCase().replace('-', ' ')} (Period: ${
                council.currentPeriod
              })`
            )
          );

          if (council.currentPeriod === 'Evaluation') {
            choices.push({
              name: '  Evaluate election',
              value: {
                type: 'run',
                name: 'evaluate-election',
                args: { instance, council: council.name },
              },
            });
          } else {
            const nextPeriod = getNext(Object.keys(ElectionPeriod), council.currentPeriod);
            const nextPeriodDate = await getPeriodDate(council.Proxy, nextPeriod);
            choices.push({
              name: `  Forward to next period "${nextPeriod}" (timestamp: ${nextPeriodDate})`,
              value: {
                type: 'run',
                name: 'fast-forward-to',
                args: { instance, council: council.name, period: nextPeriod },
              },
            });
          }
        })
      );

      const { response } = await inquirer.prompt({
        type: 'list',
        name: 'response',
        message: 'What action do you want to perform?',
        pageSize: 10,
        choices,
      });

      if (response.type === 'run') {
        await hre.run(response.name, response.args);
        continue;
      }
    }
  });

async function initCouncils(hre, instance) {
  return await Promise.all(
    COUNCILS.map(async (name) => {
      const council = { name };
      council.Proxy = await getPackageProxy(hre, name, instance);
      council.currentPeriod = Object.keys(ElectionPeriod)[await council.Proxy.getCurrentPeriod()];
      return council;
    })
  );
}

function getNext(arr, curr) {
  if (!Array.isArray(arr)) throw new Error('Expected array value');
  const currIndex = arr.findIndex((val) => val === curr);
  if (currIndex === -1) throw new Error(`Item "${curr}" not found in "${JSON.stringify(arr)}"`);
  return arr[currIndex === arr.length - 1 ? 0 : currIndex + 1];
}

function toOneLine(obj = {}) {
  return Object.entries(obj)
    .map(([key, val]) => `${key}: ${val}`)
    .join(' | ');
}
