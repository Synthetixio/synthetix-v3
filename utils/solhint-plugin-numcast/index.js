const BaseChecker = require('solhint/lib/rules/base-checker');
const { findPropertyInParents } = require('solhint/lib/common/tree-traversing');

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
    if (node.name.includes('int')) {
      const args = findPropertyInParents(node, 'arguments');

      if (args && args.length > 0) {
        this.warn(node, 'Avoid low level numeric casts.');
      }
    }
  }
}

module.exports = [NumericCastChecker];
