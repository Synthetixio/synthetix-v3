const inquirer = require('inquirer');

module.exports = {
  noConfirm: false,

  /**
   * Ask the user for confirmation
   * @param {string} message
   * @returns {boolean}
   */
  async ask(message) {
    const { confirmation } = await inquirer.prompt([
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
