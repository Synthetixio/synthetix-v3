import { SourceUnit } from 'solidity-ast/types';
import { validateSlotNamespaceCollisions } from './validate-namespace';
import { validateMutableStateVariables } from './validate-variables';

export interface ValidateParams {
  sourceUnits: SourceUnit[];
  prevSourceUnits: SourceUnit[];
}

export function validate(params: ValidateParams) {
  return [...validateMutableStateVariables(params), ...validateSlotNamespaceCollisions(params)];
}
