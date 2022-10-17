const path = require('path');
const { resetHardhatContext } = require('hardhat/plugins-testing');
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

    this.hre = _loadEnvironment(folder, 'local');
  });

  before('prep the cli helper', async function () {
    this.cli = new CliRunner();
  });

  after('clear output buffer', async function () {
    this.cli.clear();
  });
}

function _loadEnvironment(fixtureProjectName, networkName = 'hardhat') {
  resetHardhatContext();

  process.chdir(fixtureProjectName);
  process.env.HARDHAT_NETWORK = networkName;

  return require('hardhat');
}

module.exports = bootstrap;
