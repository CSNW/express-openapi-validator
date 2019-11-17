import ono from 'ono';
import * as Ajv from 'ajv';
import { Request } from 'express';
import { ValidationError } from '../framework/types';

export class ContentType {
  private withoutBoundary: string = null;
  public contentType = null;
  public mediaType: string = null;
  private constructor(contentType: string | null) {
    this.contentType = contentType;
    if (contentType) {
      this.withoutBoundary = contentType.replace(/;\s{0,}boundary.*/, '');
      this.mediaType = this.withoutBoundary.split(';')[0].trim();
    }
  }
  static from(req: Request): ContentType {
    return new ContentType(req.headers['content-type']);
  }

  equivalents(): string[] {
    if (!this.withoutBoundary) return [];
    if (this.mediaType === 'application/json') {
      return ['application/json', 'application/json; charset=utf-8'];
    }
    return [this.withoutBoundary];
  }
}

const _validationError = (
  status: number,
  path: string,
  message: string,
  errors?: any, // TODO rename - normalize...something else
): ValidationError => ({
  status,
  errors: [
    {
      path,
      message,
      ...({ errors } || {}),
    },
  ],
});

export function validationError(
  status: number,
  path: string,
  message: string,
): ValidationError {
  const err = _validationError(status, path, message);
  return ono(err, message);
}

/**
 * (side-effecting) modifies the errors object
 * TODO - do this some other way
 * @param errors
 */
export function augmentAjvErrors(
  errors: Ajv.ErrorObject[] = [],
): Ajv.ErrorObject[] {
  errors.forEach(e => {
    if (e.keyword === 'enum') {
      const params: any = e.params;
      const allowedEnumValues = params && params.allowedValues;
      e.message = !!allowedEnumValues
        ? `${e.message}: ${allowedEnumValues.join(', ')}`
        : e.message;
    }
  });
  return errors;
}
export function ajvErrorsToValidatorError(
  status: number,
  errors: Ajv.ErrorObject[],
): ValidationError {
  return {
    status,
    errors: errors.map(e => {
      const params: any = e.params;
      const required =
        params &&
        params.missingProperty &&
        e.dataPath + '.' + params.missingProperty;
      const additionalProperty =
        params &&
        params.additionalProperty &&
        e.dataPath + '.' + params.additionalProperty;
      const path = required || additionalProperty || e.dataPath || e.schemaPath;
      return {
        path,
        message: e.message,
        errorCode: `${e.keyword}.openapi.validation`,
      };
    }),
  };
}
