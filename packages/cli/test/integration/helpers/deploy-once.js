const { deployOnEnvironment } = require('@synthetixio/deployer/test/helpers/use-environment');

const SHOW_DEPLYER_OUTPUT = false;

let deployed = false;

async function deployIfNeeded(hre) {
  if (deployed) {
    return;
  }

  await deployOnEnvironment(hre, {
    instance: 'test',
    clear: true,
    quiet: !SHOW_DEPLYER_OUTPUT,
  });

  deployed = true;
}

module.exports = {
  deployIfNeeded,
};
