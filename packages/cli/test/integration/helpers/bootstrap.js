const path = require('path');
const { loadEnvironment } = require('@synthetixio/deployer/test/helpers/use-environment');
const CliRunner = require('./cli-runner');

function bootstrap() {
  before('set fixture project and network', async function () {
    const folder = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'test',
      'fixture-projects',
      'sample-project'
    );

    this.hre = loadEnvironment(folder, 'local');
  });

  before('prep the cli helper', async function () {
    this.cli = new CliRunner();
  });

  after('clear output buffer', async function () {
    this.cli.clear();
  });
}

module.exports = bootstrap;
