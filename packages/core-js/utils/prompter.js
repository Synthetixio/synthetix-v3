const inquirer = require('inquirer');

module.exports = {
  _prompt: inquirer.prompt.bind(inquirer),
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

    const { confirmation } = await this._prompt([
      {
        type: 'confirm',
        name: 'confirmation',
        message,
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
