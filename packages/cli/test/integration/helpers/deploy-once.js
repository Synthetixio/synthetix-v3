const { deployOnEnvironment } = require('@synthetixio/deployer/test/helpers/use-environment');

let deployed = false;

async function deployIfNeeded(hre) {
  if (deployed) {
    return;
  }

  await deployOnEnvironment(hre, {
    instance: 'test',
    clear: true,
    quiet: true,
  });

  deployed = true;
}

module.exports = {
  deployIfNeeded,
};
