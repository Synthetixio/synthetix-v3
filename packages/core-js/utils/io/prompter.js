const prompts = require('prompts');

class PromptCancelled extends Error {}

module.exports = {
  PromptCancelled,

  // Auto-responds all prompts as 'yes'
  // when enabled.
  noConfirm: false,

  // Used for testing.
  _prompt: prompts.bind(prompts),

  /**
   * Ask the user for confirmation
   * @param {string} message
   * @returns {boolean}
   */
  async ask(message) {
    if (this.noConfirm) {
      return true;
    }

    const { confirmation } = await this._prompt([
      {
        type: 'confirm',
        name: 'confirmation',
        message,
        initial: true,
      },
    ]);

    return confirmation;
  },

  /**
   * Require the user for confirmation to continue with process execution.
   * @param {string} message
   */
  async confirmAction(message) {
    if (this.noConfirm) {
      return;
    }

    const confirmed = await this.ask(message);

    if (!confirmed) {
      throw new PromptCancelled();
    }
  },
};
