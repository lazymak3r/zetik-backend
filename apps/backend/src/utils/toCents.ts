import { BigNumber } from 'bignumber.js';

export function toCents(amount: string | number): string {
  const amountNum = new BigNumber(amount);
  if (amountNum.isNaN()) {
    throw new Error('Invalid amount');
  }
  return amountNum.multipliedBy(100).toString();
}
