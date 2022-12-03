/* istanbul ignore file */

import axios from 'axios';
import { JsonFragment } from '@ethersproject/abi';

interface FourbytesResponse {
  num_processed: number;
  num_imported: number;
  num_duplicates: number;
  num_ignored: number;
}

type ImportAbi = (abi: JsonFragment[]) => FourbytesResponse;

const action = (actionName: string) => `https://www.4byte.directory/api/v1/${actionName}/`;

export async function importAbi(abi: JsonFragment[]) {
  if (_mock) return _mock(abi);

  const { data } = await axios({
    method: 'post',
    url: action('import-abi'),
    headers: { 'Content-Type': 'application/json' },
    data: {
      contract_abi: JSON.stringify(abi),
    },
  });

  return data as FourbytesResponse;
}

let _mock: ImportAbi | null;
export function _mockImportAbi(fn: ImportAbi | null) {
  _mock = fn;
}
