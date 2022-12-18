const BaseChecker = require('solhint/lib/rules/base-checker');

const ruleId = 'safe-cast';

const meta = {
  type: 'security',

  docs: {
    description: 'Avoid low level numeric casts.',
    category: 'Security Rules',
  },

  isDefault: false,
  recommended: true,
  defaultSetup: 'warn',

  schema: null,
};

class NumericCastChecker extends BaseChecker {
  constructor(reporter, config, inputSrc) {
    super(reporter, ruleId, meta);

    this.config = config;
    this.inputSrc = inputSrc;
  }

  ElementaryTypeName(node) {
    if (node.name.includes('int') && node.parent.type === 'FunctionCall') {
      const src = this.inputSrc.split('\n')[node.loc.start.line - 1].trim();
      this.warn(node, `Avoid low level numeric casts: ${src}`);
    }
  }
}

module.exports = [NumericCastChecker];
