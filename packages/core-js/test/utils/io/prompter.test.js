const { equal, rejects } = require('assert/strict');
const prompter = require('../../../utils/io/prompter');

describe('utils/io/prompter.js', function () {
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

        await rejects(async () => {
          await prompter.confirmAction('something?');
        }, prompter.PromptCancelled);
      });
    });
  });
});
