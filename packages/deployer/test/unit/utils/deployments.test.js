const { deepEqual } = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { loadEnvironment, deployOnEnvironment } = require('../../helpers/use-environment');
const {
  getDeploymentExtendedFiles,
  getProxyAddress,
  getRouterAddress,
  getDeployment,
  getDeploymentFile,
  getAllDeploymentFiles,
  getDeploymentFolder,
} = require('../../../utils/deployments');

describe('utils/deployments.js', function () {
  let hre, info, deploymentFile;

  before('prepare environment', async function () {
    this.timeout(60000);

    hre = loadEnvironment('sample-project');

    await deployOnEnvironment(hre, {
      alias: 'deployments',
      clear: true,
    });

    info = {
      folder: hre.config.deployer.paths.deployments,
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
      deepEqual(result, '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853');
    });
  });

  describe('#getRouterAddress', function () {
    it('gets the current Router deployment address', function () {
      const result = getRouterAddress(info);
      deepEqual(result, '0x0165878A594ca255338adfa4d48449f69242Eb8F');
    });
  });

  describe('#getDeployment', function () {
    it('gets the newest deployment data', function () {
      const result = getDeployment(info);
      const expected = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
      deepEqual(result, expected);
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
