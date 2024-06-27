import { StorageSlot } from '../types';

const SLOT_SIZE = 32;

const _parseBasicTypeSize = (type: string, max = 256) => {
  const match = type.match(/^[a-z]+([1-9]+[0-9]*)?$/);
  if (!match) throw new Error(`Invalid type "${type}"`);
  if (!match[1]) return max;
  const bits = Number.parseInt(match[1]);
  if (bits === 0 || bits > max) throw new Error(`Invalid type "${type}"`);
  return bits;
};

/**
 * Get the size on the storage layout for the given variable types.
 * Keep in mind that this function gets the static size for the slot, and not
 * the total dynamic size that could change durin execution, like from "bytes" or "string" vars.
 * More info: https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html
 */
export function getStorageSlotSize(slot: StorageSlot): number {
  if (slot.type === 'bool') return 1;

  if (slot.type === 'address') return 20;

  if (slot.type === 'enum') {
    const { length } = slot.members;
    if (length < 1) throw new Error('Invalid enum size');
    const bitsSize = Math.ceil(Math.log2(length)) || 1;
    return Math.ceil(bitsSize / 8);
  }

  if (slot.type.startsWith('uint') || slot.type.startsWith('int')) {
    const bits = _parseBasicTypeSize(slot.type, 256);
    if (bits % 8 !== 0 || bits < 8) {
      throw new Error(`Invalid bit size for type "${slot.type}"`);
    }
    return bits / 8;
  }

  if (['bytes', 'string', 'mapping'].includes(slot.type)) {
    return SLOT_SIZE;
  }

  if (slot.type === 'array') {
    if (!Number.isSafeInteger(slot.length)) return SLOT_SIZE;
    const valueSize = getStorageSlotSize(slot.value);
    return sumStorageSlotSizes(new Array(slot.length).fill(valueSize), true);
  }

  if (slot.type.startsWith('bytes')) {
    const bytes = _parseBasicTypeSize(slot.type, SLOT_SIZE);
    return bytes;
  }

  if (slot.type.startsWith('ufixed') || slot.type.startsWith('fixed')) {
    // These are not fully implemented yet: https://docs.soliditylang.org/en/latest/types.html#fixed-point-numbers
    throw new Error(`Type "${slot.type}" for storage size calculation not implemented`);
  }

  if (slot.type === 'struct') {
    const sizes = slot.members.map(getStorageSlotSize).flat();
    return sumStorageSlotSizes(sizes, true);
  }

  const err = new Error(`Storage slot size calculation not implemented for "${slot.type}"`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (err as any).slot = slot;
  throw err;
}

export function sumStorageSlotSizes(slotsSizes: number[], fillLastSlot = false): number {
  let size = 0;

  // First add up all slot sizes. If the current one does not get into the
  // remaining space from the previous slot, it should start from a new one.
  for (const slotSize of slotsSizes) {
    const currentSlotSize = size % SLOT_SIZE;
    if (currentSlotSize + slotSize <= SLOT_SIZE) {
      size += slotSize;
    } else {
      size += SLOT_SIZE - currentSlotSize + slotSize;
    }
  }

  // Some size calculation should fill up the last slot, this is the case for
  // structs and arrays because the next slot from these should be a new one.
  return fillLastSlot ? SLOT_SIZE * Math.ceil(size / SLOT_SIZE) : size;
}

/**
 * Adds the "size", "slot" and "offset" properties to the given set of slots
 * Taking into account how should they share slots when necessary.
 */
export function hidrateSlotsLayout(slots: StorageSlot[]) {
  for (let i = 0; i < slots.length; i++) {
    const prev: StorageSlot | undefined = slots[i - 1];
    const slot = slots[i];

    slot.size = getStorageSlotSize(slot);
    slot.slot = '0';
    slot.offset = 0;

    // Calculate slot number
    if (prev) {
      const remaining = SLOT_SIZE - (prev.offset! + prev.size!);

      // Check if we can pack it with the previous slot
      if (remaining >= slot.size) {
        slot.slot = prev.slot;
        slot.offset = SLOT_SIZE - remaining;
      } else {
        slot.slot = (Number.parseInt(prev.slot!) + 1).toString();
      }
    }
  }
}
