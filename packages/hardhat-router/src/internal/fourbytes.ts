/* istanbul ignore file */

import axios from 'axios';
import { JsonFragment } from '@ethersproject/abi';

const action = (actionName: string) => `https://www.4byte.directory/api/v1/${actionName}/`;

export async function importAbi(abi: JsonFragment[]) {
  const { data } = await axios({
    method: 'post',
    url: action('import-abi'),
    headers: { 'Content-Type': 'application/json' },
    data: {
      contract_abi: JSON.stringify(abi),
    },
  });

  return data;
}
