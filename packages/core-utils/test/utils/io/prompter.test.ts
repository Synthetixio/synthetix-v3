import { equal } from 'assert/strict';

import prompter from '../../../src/utils/io/prompter';

describe('utils/io/prompter.ts', function () {
  describe('when noConfirm is enabled', function () {
    before('enable noCofirm', function () {
      prompter.noConfirm = true;
    });

    describe('#ask', function () {
      it('returns always true', async function () {
        const result = await prompter.ask('something?');
        equal(result, true);
      });
    });

    describe('#confirmAction', function () {
      it('does not halt execution', async function () {
        await prompter.confirmAction('something?');
      });
    });
  });

  describe('when noConfirm is disabled', function () {
    before('disable noCofirm', function () {
      prompter.noConfirm = false;
    });

    describe('#ask', function () {
      it('returns always the users response', async function () {
        prompter._prompt = async () => ({ confirmation: true });
        equal(await prompter.ask('something?'), true);

        prompter._prompt = async () => ({ confirmation: false });
        equal(await prompter.ask('another something?'), false);
      });
    });

    describe('#confirmAction', function () {
      it('does not halt execution when responding positively', async function () {
        prompter._prompt = async () => ({ confirmation: true });
        await prompter.confirmAction('something?');
      });

      it('halts execution when responding negatively', async function () {
        prompter._prompt = async () => ({ confirmation: false });

        let exited = false;
        const exitCache = process.exit;
        process.exit = (() => {
          exited = true;
        }) as () => never;

        try {
          await prompter.confirmAction('something?');
          equal(exited, true);
        } finally {
          process.exit = exitCache;
        }
      });
    });
  });
});
