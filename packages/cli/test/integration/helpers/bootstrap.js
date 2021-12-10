const path = require('path');
const { loadEnvironment } = require('@synthetixio/deployer/test/helpers/use-environment');
const { deployIfNeeded } = require('./deploy-once');
const CliRunner = require('./cli-runner');

function bootstrap() {
  before('set fixture project', function () {
    this.hre = loadEnvironment(
      path.join(__dirname, '..', '..', '..', 'test', 'fixture-projects', 'sample-project')
    );
  });

  before('make a deployment', async function () {
    this.timeout(60000);

    await deployIfNeeded(this.hre);
  });

  before('prep the cli helper', async function () {
    this.cli = new CliRunner();
  });

  after('clear output buffer', async function () {
    this.cli.clear();
  });
}

module.exports = bootstrap;
