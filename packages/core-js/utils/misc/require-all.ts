import path from 'path';
import fs from 'fs';

/**
 * Require all the .js and .json files from the given folder.
 * @param {string} pathname
 * @param {string[]} extensions
 * @returns {unknown[]}
 */
export function requireAll(pathname: string, extensions = ['.js', '.json']) {
  return fs
    .readdirSync(path.resolve(pathname))
    .filter((filename) => extensions.includes(path.extname(filename)))
    .map((filename) => require(path.resolve(pathname, filename)));
}
