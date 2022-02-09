const path = require('path');
const { loadEnvironment } = require('@synthetixio/deployer/test/helpers/use-environment');
const CliRunner = require('./cli-runner');

function bootstrap(fixture) {
  before('set fixture project and network', function () {
    const folder = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'test',
      'fixture-projects',
      fixture ? fixture : path.dirname(require.resolve('@synthetixio/sample-project/package.json'))
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
