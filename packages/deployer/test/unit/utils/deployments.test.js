const { deepEqual } = require('assert/strict');
const path = require('path');
const fs = require('fs');
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
  // Default configuration using as folder the tests fixtures
  const info = {
    folder: path.resolve(__dirname, '..', '..', 'fixtures', 'completed-deployment', 'deployments'),
    network: 'local',
    instance: 'official',
  };

  // Expected instance folder where the deployment files are located
  const folder = `${info.folder}/${info.network}/${info.instance}`;

  // Fixture deployment files
  const files = ['2021-12-23-00.json', '2021-12-23-01.json'].map((file) => `${folder}/${file}`);

  describe('#getDeploymentExtendedFiles', function () {
    it('gets the list of extended files for the given deployment file', function () {
      const result = getDeploymentExtendedFiles(files[files.length - 1]);
      const expected = {
        abis: `${folder}/extended/2021-12-23-01.abis.json`,
        sources: `${folder}/extended/2021-12-23-01.sources.json`,
      };
      deepEqual(result, expected);
    });
  });

  describe('#getProxyAddress', function () {
    it('gets the current Proxy deployment address', function () {
      const result = getProxyAddress(info);
      deepEqual(result, '0x0165878A594ca255338adfa4d48449f69242Eb8F');
    });
  });

  describe('#getRouterAddress', function () {
    it('gets the current Router deployment address', function () {
      const result = getRouterAddress(info);
      deepEqual(result, '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707');
    });
  });

  describe('#getDeployment', function () {
    it('gets the newest deployment data', function () {
      const result = getDeployment(info);
      const expected = JSON.parse(fs.readFileSync(files[files.length - 1], 'utf8'));
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
      deepEqual(result, files[files.length - 1]);
    });
  });

  describe('#getAllDeploymentFiles', function () {
    it('get the historical sorted deployment files', function () {
      const result = getAllDeploymentFiles(info);
      deepEqual(result, files);
    });
  });

  describe('#getDeploymentFolder', function () {
    it('correctly calculates deployments instance folder', function () {
      const result = getDeploymentFolder(info);
      deepEqual(result, folder);
    });
  });
});
