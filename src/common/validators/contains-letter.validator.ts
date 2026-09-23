import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export interface ContainLetterOptions extends ValidationOptions {
  label?: string;
}

@ValidatorConstraint({ async: false })
export class ContainsLetterConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;

    const [minLetters = 3] = args.constraints ?? [];

    const regex = new RegExp(`(?:.*[a-zA-Z]){${minLetters},}`);
    return regex.test(value);
  }

  defaultMessage(args: ValidationArguments): string {
    const [minLetters = 3, label] = args.constraints ?? [];
    const targetName = label ?? args.property;

    return `${targetName} must contain at least ${minLetters} letters`;
  }
}

export function ContainsLetter(minLetters = 3, options?: ContainLetterOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [minLetters, options?.label],
      validator: ContainsLetterConstraint,
    });
  };
}
