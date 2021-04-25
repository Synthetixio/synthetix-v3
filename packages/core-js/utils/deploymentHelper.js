'use strict';

const fs = require('fs');
const path = require('path');

function getTarget({ deploymentData, contract }) {
  if (contract) return deploymentData.targets[contract];
  else return deploymentData.targets;
}

function getSource({ deploymentData, contract }) {
  if (contract) return deploymentData.sources[contract];
  else return deploymentData.sources;
}

function getDeploymentFilePath({ artifactsPath, network, instance, jsonName }) {
  return path.join(artifactsPath, network, instance, jsonName);
}
function getDeploymentData({ deploymentFilePath }) {
  return JSON.parse(fs.readFileSync(deploymentFilePath));
}
module.exports = {
  getDeploymentFilePath,
  getDeploymentData,
  getTarget,
  getSource,
};
