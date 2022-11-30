import { HelperOptions, Utils } from 'handlebars';
import { DocItemWithContext } from 'solidity-docgen/dist/site';
import { findAll } from 'solidity-ast/utils';

/**
 * Returns a Markdown heading marker. An optional number increases the heading level.
 *
 *    Input                  Output
 *    {{h}} {{name}}         # Name
 *    {{h 2}} {{name}}       ## Name
 */
export function h(opts: HelperOptions): string;
export function h(hsublevel: number, opts: HelperOptions): string;
export function h(hsublevel: number | HelperOptions, opts?: HelperOptions) {
  const { hlevel } = getHLevel(hsublevel, opts);
  return new Array(hlevel).fill('#').join('') + ' ';
}

/**
 * Delineates a section where headings should be increased by 1 or a custom number.
 *
 *    {{#hsection}}
 *    {{>partial-with-headings}}
 *    {{/hsection}}
 */
export function hsection(opts: HelperOptions): string;
export function hsection(hsublevel: number, opts: HelperOptions): string;
export function hsection(this: unknown, hsublevel: number | HelperOptions, opts?: HelperOptions) {
  let hlevel;
  ({ hlevel, opts } = getHLevel(hsublevel, opts));
  opts.data = Utils.createFrame(opts.data);
  opts.data.hlevel = hlevel;
  return opts.fn(this as unknown, opts);
}

/**
 * Helper for dealing with the optional hsublevel argument.
 */
function getHLevel(hsublevel: number | HelperOptions, opts?: HelperOptions) {
  if (typeof hsublevel === 'number') {
    if (!opts) {
      throw new Error('Helper options not defined');
    }

    hsublevel = Math.max(1, hsublevel);
  } else {
    opts = hsublevel;
    hsublevel = 1;
  }
  const contextHLevel: number = opts.data?.hlevel ?? 0;
  return { opts, hlevel: contextHLevel + hsublevel };
}

export function trim(text: string) {
  if (typeof text === 'string') {
    return text.trim();
  }
}

export function joinLines(text?: string) {
  if (typeof text === 'string') {
    return text.replace(/\n+/g, ' ');
  }
}

export function formatTitle(text?: string) {
  if (
    typeof text === 'string' &&
    text.startsWith('I') &&
    (text.endsWith('Module') || text.endsWith('ModuleStorage'))
  ) {
    text = text
      .substring(1)
      .replace(/([A-Z][a-z])/g, ' $1')
      .trim();
  }
  return text;
}

// Inspired by https://github.com/OpenZeppelin/solidity-docgen/issues/385
export function inheritedFunctions(this: DocItemWithContext) {
  if (this.nodeType === 'ContractDefinition') {
    const { deref } = this.__item_context.build;
    const parents = this.linearizedBaseContracts.map(deref('ContractDefinition'));
    return parents.flatMap((p) => [...findAll('FunctionDefinition', p)]);
  }
}

export function inheritedEvents(this: DocItemWithContext) {
  if (this.nodeType === 'ContractDefinition') {
    const { deref } = this.__item_context.build;
    const parents = this.linearizedBaseContracts.map(deref('ContractDefinition'));
    return parents.flatMap((p) => [...findAll('EventDefinition', p)]);
  }
}
