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
    // Discard non numeric elementary types like address, bytes32, etc.
    if (!node.name.includes('int')) {
      return;
    }

    // Discard variable declarations with the type, i.e. not int56 x, yes int56(x).
    if (node.parent.type !== 'FunctionCall') {
      return;
    }

    // Get the src for further analysis and reporting.
    const src = this.inputSrc.split('\n')[node.loc.start.line - 1].trim();

    // Look for the actual parenthesis, to discatd things like type(uint128).max,
    // which is actually a function call.
    if (!src.match(/int.*\(/g)) {
      return;
    }

    this.warn(node, `Avoid low level numeric casts: ${src}`);
  }
}

module.exports = [NumericCastChecker];
