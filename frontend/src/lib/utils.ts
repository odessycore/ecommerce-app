import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatMoney(minorUnits: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(minorUnits / 100);
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function initials(firstName?: string | null, lastName?: string | null, email?: string): string {
  const a = firstName?.[0] ?? '';
  const b = lastName?.[0] ?? '';
  const combined = `${a}${b}`.trim();
  return (combined || email?.[0] || '?').toUpperCase();
}
