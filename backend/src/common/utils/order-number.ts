import { customAlphabet } from 'nanoid';

const generate = customAlphabet('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 8);

export function generateOrderNumber(): string {
  return `ORD-${generate()}`;
}
