const assert = require('assert/strict');
const chalk = require('chalk');
const { spawn } = require('child_process');

// Set these to false on CI
const SHOW_CLI_OUTPUT = false;
const SHOW_CLI_INTERACTIONS = false;

const START_DELAY = 3000;
const INTERACT_DELAY = 1000;

class CliRunner {
  constructor() {}

  async start() {
    this.errors = [];
    this.buffer = '';

    this.cliProcess = spawn(
      'npx',
      ['hardhat', 'interact', '--instance', 'test', '--network', 'local'],
      {
        env: {
          ...process.env,
          FORCE_COLOR: 0, // Disables chalk colors in the subprocess
        },
      }
    );

    this.cliProcess.stdin.setEncoding('utf-8');

    this.cliProcess.stdout.on('data', (data) => {
      const str = data.toString();

      if (SHOW_CLI_OUTPUT) {
        console.log(chalk.gray(str));
      }

      this.buffer += str;
    });
    this.cliProcess.stderr.on('data', (data) => {
      console.error(data.toString());

      this.errors.push(data.toString());
    });

    return new Promise((resolve) => {
      setTimeout(resolve, START_DELAY);
    });
  }

  async interact(cmd) {
    if (SHOW_CLI_INTERACTIONS) {
      console.log(`CLI input: ${cmd}`);
    }

    this.cliProcess.stdin.write(cmd);

    return new Promise((resolve) => {
      setTimeout(resolve, INTERACT_DELAY);
    });
  }

  clear() {
    this.buffer = '';
  }

  printed(txt) {
    const includes = this.buffer.includes(txt);
    if (!includes) {
      console.error(`CLI output was expected to include "${chalk.red(txt)}", but it does not.`);
    }

    assert.ok(includes);
  }

  get keys() {
    // These are ascii hex key codes
    return {
      CTRLC: '\x03',
      ENTER: '\x0D',
    };
  }
}

module.exports = CliRunner;
