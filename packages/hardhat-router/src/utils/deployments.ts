import fs from 'fs';
import path from 'path';
import glob from 'glob';
import naturalCompare from 'string-natural-compare';
import { configDefaults } from '../internal/config-defaults';
import { DeploymentAbis, DeploymentData, DeploymentSources } from '../types';

export interface DeploymentInfo {
  network: string;
  instance: string;
  folder: string;
}

const defaultDeploymentInfo: DeploymentInfo = {
  network: 'local',
  instance: 'official',
  folder: configDefaults.paths.deployments,
};

// Regex for deployment file formats, e.g.: 2021-08-31-00-sirius.json
const DEPLOYMENT_FILE_FORMAT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2,}(?:-[a-z0-9]+)?\.json$/;

/**
 * Get the paths to the extended files for a given deployment file
 */
export function getDeploymentExtendedFiles(file: string) {
  const folder = path.dirname(file);
  const name = path.basename(file, '.json');

  return {
    sources: path.resolve(folder, 'extended', `${name}.sources.json`),
    abis: path.resolve(folder, 'extended', `${name}.abis.json`),
  };
}

/**
 * Retrieves the address of the target instance's deployed proxy
 * @returns The address of the proxy
 */
export function getProxyAddress(info: Partial<DeploymentInfo>) {
  info = _populateDefaults(info);

  const deployment = getDeployment(info);

  if (!deployment) {
    throw new Error('Deployment not found');
  }

  const proxyData = Object.values(deployment.contracts).find((c) => c.isProxy);

  if (!proxyData) {
    throw new Error('Proxy not found');
  }

  return proxyData.deployedAddress;
}

/**
 * Retrieves the address of the target instance's deployed router
 * @returns The address of the router
 */
export function getRouterAddress(info: Partial<DeploymentInfo>) {
  info = _populateDefaults(info);

  const deployment = getDeployment(info);

  if (!deployment) {
    throw new Error('Deployment not found');
  }

  const routerData = Object.values(deployment.contracts).find((c) => c.isRouter);

  if (!routerData) {
    throw new Error('Router not found');
  }

  return routerData.deployedAddress;
}

/**
 * Retrieves an object with the latest deployment sources json data for an instance
 * @returns An object with deployment sources
 */
export function getDeploymentSources(info: Partial<DeploymentInfo>) {
  const file = getDeploymentFile(info);
  if (!file) return null;
  const extended = getDeploymentExtendedFiles(file);
  return JSON.parse(fs.readFileSync(extended.sources, 'utf8')) as DeploymentSources;
}

/**
 * Retrieves an object with the latest deployment ABIs json data for an instance
 * @returns An object with deployment ABIs
 */
export function getDeploymentAbis(info: Partial<DeploymentInfo>) {
  const file = getDeploymentFile(info);
  if (!file) return null;
  const extended = getDeploymentExtendedFiles(file);
  return JSON.parse(fs.readFileSync(extended.abis, 'utf8')) as DeploymentAbis;
}

/**
 * Retrieves an object with the latest deployment json data for an instance
 * @returns An object with deployment schema
 */
export function getDeployment(info: Partial<DeploymentInfo>) {
  const file = getDeploymentFile(info);
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as DeploymentData;
}

/**
 * Retrieves the file with the latest deployment data for an instance
 * @returns The path of the file
 */
export function getDeploymentFile(info: Partial<DeploymentInfo>) {
  const deployments = getAllDeploymentFiles(info);
  return deployments.length > 0 ? deployments[deployments.length - 1] : null;
}

/**
 * Retrieves all deployment files for an instance, including past deployments
 * @returns Paths for the files
 */
export function getAllDeploymentFiles(info: Partial<DeploymentInfo>) {
  const instanceFolder = getDeploymentFolder(info);

  return glob
    .sync(`${instanceFolder}/*.json`)
    .filter((file) => DEPLOYMENT_FILE_FORMAT.test(path.basename(file)))
    .sort(naturalCompare);
}

/**
 * Retrieves the deployemnt folder path for an instance
 */
export function getDeploymentFolder(info: Partial<DeploymentInfo>) {
  const { folder, network, instance } = _populateDefaults(info);
  return path.resolve(folder, network, instance);
}

function _populateDefaults(info: Partial<DeploymentInfo> = {}): DeploymentInfo {
  return {
    network: info.network || defaultDeploymentInfo.network,
    instance: info.instance || defaultDeploymentInfo.instance,
    folder: info.folder || defaultDeploymentInfo.folder,
  };
}
