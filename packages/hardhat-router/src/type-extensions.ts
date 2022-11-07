import { DeploymentAbis, DeploymentData, DeploymentSources } from './types';

declare module 'hardhat/types/config' {
  export interface HardhatConfig {
    router: {
      proxyContract: string;
      routerFunctionFilter: (fnName: string) => boolean;
      paths: {
        deployments: string;
        modules: string;
      };
    };
  }

  export interface HardhatUserConfig {
    router?: {
      proxyContract?: string;
      routerFunctionFilter?: (fnName: string) => boolean;
      paths?: {
        deployments?: string;
        modules?: string;
      };
    };
  }
}

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
