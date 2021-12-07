const prompts = require('prompts');

module.exports = {
  // _prompt: prompts.prompt.bind(prompts),
  noConfirm: false,

  /**
   * Ask the user for confirmation
   * @param {string} message
   * @returns {boolean}
   */
  async ask(message) {
    if (this.noConfirm) {
      return true;
    }

    const { confirmation } = await prompts([
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
      console.log('User cancelled');
      process.exit(0);
    }
  },
};
