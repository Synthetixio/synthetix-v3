const BaseChecker = require('solhint/lib/rules/base-checker');

const ruleId = 'safe-cast';
const meta = {
  type: 'security',

  docs: {
    description: `Avoid low level numeric casts.`,
    category: 'Security Rules',
  },

  isDefault: false,
  recommended: true,
  defaultSetup: 'warn',

  schema: null,
};

class NumericCastChecker extends BaseChecker {
  constructor(reporter) {
    super(reporter, ruleId, meta);
  }

  ElementaryTypeName(node) {
    if (node.name.includes('int') && node.parent.type === 'FunctionCall') {
      this.warn(node, 'Avoid low level numeric casts.');
    }
  }
}

module.exports = [NumericCastChecker];
