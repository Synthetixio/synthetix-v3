import { clone } from '@synthetixio/core-utils/utils/misc/clone';
import { StorageSlot } from '../types';

const SLOT_SIZE = 32;

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

  // These types always occupy 32 bytes, which only include a pointer to the real
  // storage slot being used to save the data.
  if (['bytes', 'string', 'mapping'].includes(slot.type)) {
    return SLOT_SIZE;
  }

  if (slot.type === 'array') {
    // Dynamic arrays always occupy 32 bytes, because the data is saved on another slot.
    if (!Number.isSafeInteger(slot.length)) return SLOT_SIZE;
    // Static arrays save the data in place.
    const valueSize = getStorageSlotSize(slot.value);
    return sumStorageSlotSizes(new Array(slot.length).fill(valueSize), true);
  }

  // bytesX size work the same as static arrays
  if (slot.type.startsWith('bytes')) {
    const bytes = _parseBasicTypeSize(slot.type, SLOT_SIZE);
    return bytes;
  }

  // These are not fully implemented yet: https://docs.soliditylang.org/en/latest/types.html#fixed-point-numbers
  if (slot.type.startsWith('ufixed') || slot.type.startsWith('fixed')) {
    throw new Error(`Type "${slot.type}" for storage size calculation not implemented`);
  }

  // structs are saved in place, occupying the sum of all of its members
  if (slot.type === 'struct') {
    const sizes = slot.members.map(getStorageSlotSize).flat();
    return sumStorageSlotSizes(sizes, true);
  }

  const err = new Error(`Storage slot size calculation not implemented for "${slot.type}"`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (err as any).slot = slot;
  throw err;
}

/**
 * Calculate the sum of the given slot sizes using slot assignment logic. If the
 * current one does not get into the remaining space from the previous slot, it
 * should start from a new one.
 * @param slotsSizes an array of slot size values
 * @param fillLastSlot true if it should full the size for the last slot, to occupy it completely
 */
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
  const cloned = clone(slots);

  for (let i = 0; i < cloned.length; i++) {
    const prev: StorageSlot | undefined = cloned[i - 1];
    const slot = cloned[i];

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
        // In the case that the previous variable occupies more than a single
        // slot, namely structs.
        const prevAmount = Math.ceil((prev.offset! + prev.size!) / SLOT_SIZE);
        slot.slot = (Number.parseInt(prev.slot!) + prevAmount).toString();
      }
    }
  }

  return cloned;
}

function _parseBasicTypeSize(type: string, max = 256) {
  const match = type.match(/^[a-z]+([1-9]+[0-9]*)?$/);
  if (!match) throw new Error(`Invalid type "${type}"`);
  if (!match[1]) return max;
  const bits = Number.parseInt(match[1]);
  if (bits === 0 || bits > max) throw new Error(`Invalid type "${type}"`);
  return bits;
}
