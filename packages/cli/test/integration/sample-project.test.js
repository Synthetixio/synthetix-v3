const path = require('path');
const {
  loadEnvironment,
  deployOnEnvironment,
} = require('@synthetixio/deployer/test/helpers/use-environment');
const assert = require('assert/strict');
const { spawn } = require('child_process');
const { StringDecoder } = require('string_decoder');

// Handy configs for developing on this file:
const SHOW_CLI_OUTPUT = true; // CI needs this to be false
const SHOW_DEPLOY_OUTPUT = true; // CI needs this to be false
const DEPLOY_INSTANCE = false; // CI needs this to be true
const START_DELAY = 5000;
const INTERACT_DELAY = 2000;
const DELTA_DELAY = 100;

describe('sample-project', function () {
  let hre;

  let child;
  let buffer = '';
  let status;

  const keys = {
    CTRLC: '\x03',
    ENTER: '\x0D',
  };

  async function _startCli() {
    child = spawn('npx', ['hardhat', 'interact'], {
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: 0,
      }
    });

    status = 'running';

    child.stdin.setEncoding('utf-8');

    const decoder = new StringDecoder('utf-8');
    child.stdout.on('data', (data) => {
      // str = Buffer.from(data, 'utf-8').toString();
      // const str = '0101';
      // const str = decoder.write(data);
      const str = `${data}`;

      if (SHOW_CLI_OUTPUT) {
        console.log('Received data:', data.length, str.length);
        console.log(str);
      }

      buffer += str;
    });

    child.on('exit', () => {
      status = 'stopped';
    });

    return new Promise((resolve) => {
      setTimeout(resolve, START_DELAY);
    });
  }

  async function _interactWithCli(cmd) {
    child.stdin.write(cmd);

    return new Promise((resolve) => {
      setTimeout(resolve, INTERACT_DELAY);
    });
  }

  function _clearCli() {
    buffer = '';
  }

  function _prints(txt) {
    assert.ok(buffer.includes(txt));
  }

  before('set fixture project', function () {
    hre = loadEnvironment(
      path.join(__dirname, '..', '..', 'test', 'fixture-projects', 'sample-project')
    );
  });

  before('make a deployment', async function () {
    if (DEPLOY_INSTANCE) {
      this.timeout(60000);

      await deployOnEnvironment(hre, {
        alias: 'first',
        clear: true,
        quiet: !SHOW_DEPLOY_OUTPUT,
      });
    }
  });

  describe('header and contract list', () => {
    before('start the cli', async function () {
      this.timeout(START_DELAY + DELTA_DELAY);

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
        this.timeout(INTERACT_DELAY + DELTA_DELAY);

        await _interactWithCli(keys.CTRLC);
      });

      it('exits', async function () {
        assert.equal(status, 'stopped');
      });
    });
  });

  describe('function list', function () {
    before('start the cli and navigate', async function () {
      this.timeout(START_DELAY + INTERACT_DELAY * 2 + DELTA_DELAY);

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
        this.timeout(INTERACT_DELAY + DELTA_DELAY);

        await _interactWithCli(keys.CTRLC);
      });

      describe('when ctrl-c is pressed again', function () {
        before('press ctrl-c', async function () {
          this.timeout(INTERACT_DELAY + DELTA_DELAY);

          await _interactWithCli(keys.CTRLC);
        });

        it('exits', async function () {
          assert.equal(status, 'stopped');
        });
      });
    });
  });
});
