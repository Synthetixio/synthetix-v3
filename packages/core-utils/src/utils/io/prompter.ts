import prompts from 'prompts';

export default {
  // Auto-responds all prompts as 'yes'
  // when enabled.
  noConfirm: false,

  // Used for testing.
  _prompt: prompts.bind(prompts) as unknown as (
    args: Parameters<typeof prompts>[0]
  ) => Promise<{ confirmation: boolean }>,

  /**
   * Ask the user for confirmation
   * @param {string} message
   * @returns {boolean}
   */
  async ask(message: string) {
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
  async confirmAction(message: string) {
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
