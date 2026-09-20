import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class ContainsLetterConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (typeof value !== 'string') return false;

    return /(?:.*[a-zA-Z]){3,}/.test(value);
  }

  defaultMessage(): string {
    return 'Username must contain at least 3 letters';
  }
}

export function ContainsLetter(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: ContainsLetterConstraint,
    });
  };
}
