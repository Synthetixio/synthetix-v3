const path = require('path');
const { loadEnvironment, deployOnEnvironment } = require('@synthetixio/deployer/test/helpers/use-environment');
const assert = require('assert/strict');

// Handy configs for developing on this file:
const SHOW_CLI_OUTPUT = false; // CI needs this to be false
const DEPLOY_INSTANCE = true; // CI needs this to be true

describe('sample-project', function () {
  let hre;

  let child;
  let buffer = '';
  let status;

  const keys = {
    CTRLC: '\x03',
    ENTER: `\x0D`,
  };

  async function _startCli() {
    const spawn = require('child_process').spawn;
    child = spawn('npx', ['hardhat', 'interact']);

    status = 'running';

    child.stdin.setEncoding('utf-8');
    child.stdout.on('data', (data) => {
      if (SHOW_CLI_OUTPUT) {
        console.log(data.toString());
      }

      buffer += data.toString();
    });

    child.on('exit', () => {
      status = 'stopped';
    });

    return new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
  }

  async function _interactWithCli(cmd) {
    child.stdin.write(cmd);

    return new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  }

  function _clearCli() {
    buffer = '';
  }

  function _prints(txt) {
    assert.ok(buffer.includes(txt));
  }

  before('set fixture project', function () {
    hre = loadEnvironment(path.join(__dirname, '..', '..', 'test', 'fixture-projects', 'sample-project'));
  });

  before('make a deployment', async function () {
    if (DEPLOY_INSTANCE) {
      this.timeout(60000);

      await deployOnEnvironment(hre, {
        alias: 'first',
        clear: true,
        quiet: false,
      });
    }
  });

  describe('header and contract list', () => {
    before('start the cli', async function () {
      this.timeout(3000);

      await _startCli();
    });

    after('clear output buffer', async function () {
      _clearCli();
    });

    it('displays the project name and title', async function () {
      _prints('sample-project');
      _prints('CLI');
    });

    it('displays deployment info', async function () {
      _prints('network: hardhat');
      _prints('deployment: deployments/hardhat/official');
    });

    it('displays usage help', async function () {
      _prints('USAGE:');
      _prints('Use arrows to navigate, or type to autocomplete');
    });

    it('displays the contract list', async function () {
      _prints('Pick a CONTRACT');
      _prints('SomeModule');
      _prints('UpgradeModule');
      _prints('Proxy');
    });

    describe('when ctrl-c is pressed', function () {
      before('press ctrl-c', async function () {
        await _interactWithCli(keys.CTRLC);
      });

      it('exits', async function () {
        assert.equal(status, 'stopped');
      });
    });
  });

  describe('function list', function () {
    before('start the cli and navigate', async function () {
      this.timeout(5000);

      await _startCli();

      await _interactWithCli(keys.ENTER); // Selects SomeModule
    });

    after('clear output buffer', async function () {
      _clearCli();
    });

    it('displays the function list', async function () {
      _prints('SomeModule.setUintValue(uint256 newValue) 0x2f3b21a2');
    });

    describe('when ctrl-c is pressed', function () {
      before('press ctrl-c', async function () {
        await _interactWithCli(keys.CTRLC);
      });

      describe('when ctrl-c is pressed again', function () {
        before('press ctrl-c', async function () {
          await _interactWithCli(keys.CTRLC);
        });

        it('exits', async function () {
          assert.equal(status, 'stopped');
        });
      });
    });
  });
});
