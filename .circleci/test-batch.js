const { execSync } = require('node:child_process');
const { existsSync } = require('node:fs');

const { TEST_FILES = '', BATCH_SIZE = '3', BATCH_RETRIES = '3', MOCHA_RETRIES = '2' } = process.env;

function padding() {
  console.log(Array(10).fill('\n').join(''));
  console.log(Array(80).fill('-').join(''));
  console.log(Array(10).fill('\n').join(''));
}

function executeBatch(index, batch) {
  console.log(`Running batch ${index}...`);
  const isHardhat = existsSync('hardhat.config.ts');

  for (let attempt = 1; attempt <= parseInt(BATCH_RETRIES); attempt++) {
    console.log(`Running attempt ${attempt}...`);

    const cmd = [
      `node ${require.resolve('mocha/bin/mocha.js')}`,
      '--jobs 1',
      `--retries ${MOCHA_RETRIES}`,
      `--timeout 30000`,
      isHardhat ? `--require hardhat/register` : '--require ts-node/register',
      `--reporter mocha-junit-reporter`,
      `--reporter-options mochaFile=/tmp/junit/batch-${index}.xml,outputs=true,toConsole=true`,
      `--exit`,
      `${batch.join(' ')}`,
    ].join(' ');
    console.log(`Running ${cmd}`);

    try {
      console.log(Array(10).fill('\n').join(''));
      console.log(Array(80).fill('-').join(''));
      execSync(cmd, { stdio: 'inherit' });
      console.log(Array(80).fill('-').join(''));
      console.log(Array(10).fill('\n').join(''));
      return;
    } catch (e) {
      console.log(Array(10).fill('\n').join(''));
      console.log(Array(80).fill('-').join(''));
      console.log(Array(10).fill('\n').join(''));
      console.log(`Batch ${index} failed... Retrying attempt ${attempt}...`);
      console.log(Array(10).fill('\n').join(''));
      console.log(Array(80).fill('-').join(''));
      console.log(Array(10).fill('\n').join(''));
      if (attempt >= parseInt(BATCH_RETRIES)) {
        throw e;
      }
    }
  }
}

const files = TEST_FILES.replaceAll(' ', '\n')
  .split('\n')
  .map((test) => test.trim())
  .filter(Boolean);

console.log('TEST_FILES:');
files.forEach((test) => console.log(`- ${test}`));
padding();
const batch = [];
let index = 0;
for (const file of files) {
  batch.push(file);
  if (batch.length >= BATCH_SIZE) {
    index++;
    executeBatch(index, batch.splice(0));
  }
}
if (batch.length > 0) {
  index++;
  executeBatch(index, batch.splice(0));
}
