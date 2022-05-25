const path = require('path');
const {
  loadEnvironment,
  deployOnEnvironment,
} = require('@synthetixio/deployer/test/helpers/use-environment');
const CliRunner = require('./cli-runner');

function bootstrap(fixture) {
  before('set fixture project and network', async function () {
    this.timeout(50000);

    const folder = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'test',
      'fixture-projects',
      fixture ? fixture : 'sample-project'
    );

    this.hre = loadEnvironment(folder, 'local');

    if (fixture !== 'sample-project') {
      await deployOnEnvironment(this.hre);
    }
  });

  before('prep the cli helper', async function () {
    this.cli = new CliRunner();
  });

  after('clear output buffer', async function () {
    this.cli.clear();
  });
}

module.exports = bootstrap;
