import path from 'node:path';
import { extendEnvironment } from 'hardhat/config';
import { DeploymentAbis, DeploymentData, DeploymentSources } from '../types';

declare module 'hardhat/types/runtime' {
  export interface HardhatRuntimeEnvironment {
    router: {
      paths: {
        routerTemplate: string;
        deployment: string | null;
        sources: string | null;
        abis: string | null;
      };
      deployment: {
        general: DeploymentData;
        sources: DeploymentSources;
        abis: DeploymentAbis;
      } | null;
      previousDeployment: {
        general: DeploymentData;
        sources: DeploymentSources;
      } | null;
    };
  }
}

extendEnvironment((hre) => {
  if (hre.router) {
    throw new Error('Deployer plugin already loaded.');
  }

  hre.router = {
    paths: {
      routerTemplate: path.resolve(__dirname, '../../templates/Router.sol.mustache'),
      deployment: null,
      sources: null,
      abis: null,
    },
    deployment: null,
    previousDeployment: null,
  };

  // Prevent any properties being added to hre.router
  // other than those defined above.
  Object.preventExtensions(hre.router);
  Object.preventExtensions(hre.router.paths);
});
