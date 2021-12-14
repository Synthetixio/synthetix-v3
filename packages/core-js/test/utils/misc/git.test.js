const assert = require('assert/strict');
const { getCommit, getBranch } = require('../../../utils/misc/git');
const execSync = (cmd) => require('child_process').execSync(cmd).toString().trim();

describe('utils/misc/git.js', function () {
  it('can retrieve the current commit', function () {
    assert.equal(getCommit(), execSync('git rev-parse HEAD'));
  });

  it('can retrieve the current branch', function () {
    assert.equal(getBranch(), execSync('git rev-parse --abbrev-ref HEAD'));
  });
});
