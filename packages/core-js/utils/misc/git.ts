const execSync = (cmd: string) => require('child_process').execSync(cmd).toString().trim();

export function getCommit() {
  return execSync('git rev-parse HEAD')
}

export function getBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD')
}