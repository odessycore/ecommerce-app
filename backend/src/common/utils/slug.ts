import slugify from 'slugify';
import { nanoid } from 'nanoid';

export function toSlug(value: string): string {
  return slugify(value, { lower: true, strict: true, trim: true });
}

// Slug with a short random suffix to guarantee uniqueness without a lookup round-trip.
export function toUniqueSlug(value: string): string {
  return `${toSlug(value)}-${nanoid(6).toLowerCase()}`;
}
