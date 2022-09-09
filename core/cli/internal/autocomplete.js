const prompts = require('prompts');
const Fuse = require('fuse.js');

/**
 * CLI autocomplete with fixed fuzzy search text
 * @param {Object} opts
 * @param {string} opts.message
 * @param {Object} opts.choices
 * @param {string} opts.choices[].title
 * @param {unknown} opts.choices[].data
 * @returns {unknown[]}
 */
module.exports = async function autocomplete({ message, choices }) {
  const fuse = new Fuse(choices, { keys: ['title'] });

  const { result } = await prompts([
    {
      type: 'autocomplete',
      name: 'result',
      message,
      choices,
      suggest: async (text) => {
        if (!text) return choices;
        return fuse.search(text).map((r) => r.item);
      },
    },
  ]);

  return result;
};
