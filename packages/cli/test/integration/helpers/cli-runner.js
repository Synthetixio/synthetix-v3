const assert = require('assert/strict');
const chalk = require('chalk');
const { spawn } = require('child_process');

const SHOW_CLI_OUTPUT = false;
const START_DELAY = 2000;
const INTERACT_DELAY = 500;

class CliRunner {
  constructor() {}

  async start() {
    this.errors = [];
    this.buffer = '';

    this.cliProcess = spawn('npx', ['hardhat', 'interact', '--instance', 'test'], {
      env: {
        ...process.env,
        FORCE_COLOR: 0, // Disables chalk colors in the subprocess
      },
    });

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
      console.error(
        `CLI output was expected to include "${chalk.red(
          txt
        )}", but it does not. CLI output is: "${chalk.gray(this.buffer)}"`
      );
    }

    assert.ok(includes);
  }

  get keys() {
    return {
      CTRLC: '\x03',
      ENTER: '\x0D',
      DOWN: '\x28',
      UP: '\x26',
    };
  }
}

module.exports = CliRunner;
