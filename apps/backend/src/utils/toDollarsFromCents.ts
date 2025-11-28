import { BigNumber } from 'bignumber.js';

export function toDollarsFromCents(cents: string | number): string {
  const amountNum = new BigNumber(cents);
  if (amountNum.isNaN()) {
    throw new Error('Invalid amount');
  }
  return amountNum.dividedBy(100).toString();
}
