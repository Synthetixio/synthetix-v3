import { bold, dim, underline } from 'chalk';
import Table from 'cli-table3';
import { task } from 'hardhat/config';
import { dumpStorage } from '../internal/dump';
import { TASK_STORAGE_LAYOUT } from '../task-names';

const defaultTable = {
  chars: {
    top: '',
    'top-mid': '',
    'top-left': '',
    'top-right': '',
    bottom: '',
    'bottom-mid': '',
    'bottom-left': '',
    'bottom-right': '',
    left: '',
    'left-mid': '',
    mid: '',
    'mid-mid': '',
    right: '',
    'right-mid': '',
    middle: ' ',
  },
  style: {
    // 'padding-left': 0,
    // 'padding-right': 0,
    head: [],
    border: [],
  },
};
task(TASK_STORAGE_LAYOUT, 'Pretty print the storage layout of all the contracts').setAction(
  async (_, hre) => {
    const { contracts, getArtifact } = await hre.runGetArtifacts();
    const dump = await dumpStorage({ contracts, getArtifact });

    if (!dump) return;

    console.log();

    for (const fqName of Object.keys(dump)) {
      const storageDump = dump[fqName]!;
      const kind = storageDump!.kind;

      console.log(`${bold(underline(`${kind} ${fqName}`))}`);

      for (const structName of Object.keys(storageDump.structs)) {
        const slots = storageDump.structs[structName]!;
        console.log(`  struct ${structName}`);

        const table = new Table({
          ...defaultTable,
          head: ['slot', 'offset', 'size', 'type', 'name'].map((t) => (t ? dim(t) : t)),
          colWidths: [null, null, null, null, null],
        });

        for (const slot of slots) {
          table.push([slot.slot, slot.offset, slot.size, slot.type, slot.name]);
        }

        console.log(table.toString().replace(/^/gm, '    '));
        console.log('');
      }

      console.log('');
    }
  }
);
