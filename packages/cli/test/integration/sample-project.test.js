const path = require('path');
const { loadEnvironment, deployOnEnvironment } = require('@synthetixio/deployer/test/integration/helpers/use-environment');

describe('sample-project', function () {
  let hre;

  before('set fixture project', function () {
    // console.log(process.cwd());
    hre = loadEnvironment('sample-project');
    // console.log(hre);
  });

  // before('make a deployment', async function () {
  //   this.timeout(60000);

  //   await deployOnEnvironment(hre, {
  //     alias: 'first',
  //     clear: true,
  //     quiet: false,
  //   });
  // });

  // describe('when starting the cli', () => {
  //   before('start the cli', async function () {
  //     await hre.run('interact');
  //   });

  //   it('displays the expected contract list', async function () {
  //     // this.timeout(60000);
  //   });
  // });

  it('', async function () {});
});
