import path from 'node:path';

export function ensureTrailingSlash(basePath: string) {
  basePath = path.normalize(basePath);
  return basePath.endsWith(path.sep) ? basePath : `${basePath}${path.sep}`;
}

export function removeBasePath(basePath: string, fullPath: string) {
  basePath = path.normalize(basePath);
  fullPath = path.normalize(fullPath);

  if (!basePath.endsWith(path.sep)) basePath += path.sep;

  if (!fullPath.startsWith(basePath)) {
    throw new Error(`The path "${fullPath}" is not inside "${fullPath}"`);
  }

  return fullPath.substring(basePath.length);
}

export function isExplicitRelativePath(sourceName: string) {
  return sourceName.startsWith('./') || sourceName.startsWith('../');
}
