const { ok, deepEqual } = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { loadEnvironment, deployOnEnvironment } = require('../../helpers/use-environment');
const {
  getDeploymentExtendedFiles,
  getProxyAddress,
  getRouterAddress,
  getDeploymentSources,
  getDeploymentAbis,
  getDeployment,
  getDeploymentFile,
  getAllDeploymentFiles,
  getDeploymentFolder,
} = require('../../../src/utils/deployments');

describe.only('utils/deployments.js', function () {
  let hre, info, deploymentFile;

  const parseDeploymentFile = () => JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));

  before('prepare environment', async function () {
    this.timeout(60000);

    hre = loadEnvironment(
      path.dirname(require.resolve('@synthetixio/sample-project/package.json'))
    );

    await deployOnEnvironment(hre, {
      alias: 'deployments',
      clear: true,
    });

    info = {
      folder: hre.config.router.paths.deployments,
      network: hre.config.defaultNetwork,
      instance: 'test',
    };

    deploymentFile = getDeploymentFile(info);
  });

  describe('#getDeploymentExtendedFiles', function () {
    it('gets the list of extended files for the given deployment file', function () {
      const result = getDeploymentExtendedFiles(deploymentFile);
      const expectedFile = path.basename(deploymentFile, '.json');
      const expected = {
        abis: `${info.folder}/${info.network}/${info.instance}/extended/${expectedFile}.abis.json`,
        sources: `${info.folder}/${info.network}/${info.instance}/extended/${expectedFile}.sources.json`,
      };
      deepEqual(result, expected);
    });
  });

  describe('#getProxyAddress', function () {
    it('gets the current Proxy deployment address', function () {
      const result = getProxyAddress(info);
      const { deployedAddress } = Object.values(parseDeploymentFile().contracts).find(
        (contract) => contract.isProxy
      );
      deepEqual(result, deployedAddress);
    });
  });

  describe('#getRouterAddress', function () {
    it('gets the current Router deployment address', function () {
      const result = getRouterAddress(info);
      const { deployedAddress } = Object.values(parseDeploymentFile().contracts).find(
        (contract) => contract.isRouter
      );
      deepEqual(result, deployedAddress);
    });
  });

  describe('#getDeploymentAbis', function () {
    it('gets the newest deployment abis', function () {
      const result = getDeploymentAbis(info);
      ok(Array.isArray(result['contracts/Router.sol:Router']));
    });

    it('returns null if the given instance does not have any deployments', function () {
      const result = getDeploymentAbis({ ...info, instance: 'optimism' });
      deepEqual(result, null);
    });
  });

  describe('#getDeploymentSources', function () {
    it('gets the newest deployment abis', function () {
      const result = getDeploymentSources(info);
      ok(result['contracts/Router.sol']);
      ok(result['contracts/Router.sol'].ast);
      deepEqual(typeof result['contracts/Router.sol'].sourceCode, 'string');
    });

    it('returns null if the given instance does not have any deployments', function () {
      const result = getDeploymentSources({ ...info, instance: 'optimism' });
      deepEqual(result, null);
    });
  });

  describe('#getDeployment', function () {
    it('gets the newest deployment data', function () {
      const result = getDeployment(info);
      deepEqual(result, parseDeploymentFile());
    });

    it('returns null if the given instance does not have any deployments', function () {
      const result = getDeployment({ ...info, instance: 'optimism' });
      deepEqual(result, null);
    });
  });

  describe('#getDeploymentFile', function () {
    it('gets the newest deployment file', function () {
      const result = getDeploymentFile(info);
      deepEqual(result, deploymentFile);
    });
  });

  describe('#getAllDeploymentFiles', function () {
    it('get the historical sorted deployment files', function () {
      const result = getAllDeploymentFiles(info);
      deepEqual(result, [deploymentFile]);
    });
  });

  describe('#getDeploymentFolder', function () {
    it('correctly calculates deployments instance folder', function () {
      const result = getDeploymentFolder(info);
      deepEqual(result, path.dirname(deploymentFile));
    });
  });
});
