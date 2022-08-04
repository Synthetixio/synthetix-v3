const assert = require('assert/strict');
const { spawn } = require('child_process');
const { setTimeout } = require('timers/promises');
const chalk = require('chalk');

// Set these to false on CI
const SHOW_CLI_OUTPUT = false;
const SHOW_CLI_INTERACTIONS = false;

const START_DELAY = 3000;
const INTERACT_DELAY = 1000;

class CliRunner {
  constructor() {}

  start() {
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

    return setTimeout(START_DELAY);
  }

  interact(cmd) {
    if (SHOW_CLI_INTERACTIONS) {
      console.log(`CLI input: ${cmd}`);
    }

    this.cliProcess.stdin.write(cmd);

    return setTimeout(INTERACT_DELAY);
  }

  clear() {
    this.buffer = '';
  }

  printed(txt) {
    const includes = this.buffer.includes(txt);
    if (!includes) {
      console.error(
        `CLI output should contain "${chalk.white(txt)}", but it was "${chalk.red(
          this.buffer.toString()
        )}".`
      );
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
