import assert from 'assert/strict';
import child_process from 'child_process';

import { getBranch, getCommit } from '../../../src/utils/misc/git';

const execSync = (cmd: string) => child_process.execSync(cmd).toString().trim();

describe('utils/misc/git.ts', function () {
  it('can retrieve the current commit', function () {
    assert.equal(getCommit(), execSync('git rev-parse HEAD'));
  });

  it('can retrieve the current branch', function () {
    assert.equal(getBranch(), execSync('git rev-parse --abbrev-ref HEAD'));
  });
});
