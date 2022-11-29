// See https://github.com/loopbackio/strong-error-handler
// only can modify specified properties, such as 'statusCode', 'details'(for 4xx error staus code), 'errorCode', 'name', 'code'.

export class CustomHttpError extends Error {
  statusCode: number;
  details?: string[];
  constructor(status: number, message: string, ...details: string[]) {
    super(message);
    this.statusCode = status;
    if (details.length != 0) { this.details = [...details]; }
  }
}