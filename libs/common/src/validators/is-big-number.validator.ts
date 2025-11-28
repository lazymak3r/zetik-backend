import { BigNumber } from 'bignumber.js';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isBigNumber', async: false })
export class IsBigNumberConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (value === undefined || value === null) {
      return false;
    }

    try {
      // Check if the value is an instance of BigNumber
      if (value instanceof BigNumber) {
        return true;
      }

      // Try to create a BigNumber from the value
      const bn = new BigNumber(value);
      return !bn.isNaN();
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be valid BigNumber`;
  }
}

export function IsBigNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBigNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsBigNumberConstraint,
    });
  };
}
