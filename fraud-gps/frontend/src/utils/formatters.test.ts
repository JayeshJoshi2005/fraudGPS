import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatTime, maskAccount } from './formatters';

describe('Indian display formatting', () => {
  it.each([
    ['50000.00', '₹50,000'],
    ['100000', '₹1,00,000'],
    ['12345678.90', '₹1,23,45,678.90'],
    ['9999999999999999.99', '₹9,99,99,99,99,99,99,999.99'],
    ['0', '₹0'],
    ['1.5', '₹1.50'],
    ['-10.25', '-₹10.25'],
    ['NaN', '—'],
  ])('formats %s without floating-point loss', (input, expected) =>
    expect(formatCurrency(input)).toBe(expected),
  );
  it('uses India time across UTC date boundaries', () => {
    expect(formatDate('2026-01-01T22:00:00Z')).toBe('02-Jan-2026');
    expect(formatTime('2026-01-01T22:00:00Z')).toBe('03:30 AM');
    expect(formatDate('2026-01-01')).toBe('01-Jan-2026');
  });
  it('does not manufacture masked labels from internal IDs', () => {
    expect(maskAccount('ACC-000123')).toBe('Unavailable');
    expect(maskAccount('XXXX4123')).toBe('XXXX4123');
    expect(maskAccount(undefined)).toBe('Unavailable');
  });
});
