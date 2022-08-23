import fs from 'fs';
import path from 'path';

export function readPackageJson() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkgStr = fs.readFileSync(pkgPath, 'utf8');

  return JSON.parse(pkgStr);
}
