import {
  get,
  response,
} from '@loopback/rest';
import path from 'path';
import {authenticate} from '@loopback/authentication';
import {CustomHttpError} from '../tools/customError/customHttpError';

const folderPath = path.resolve(__dirname, '../../database');

export class ErrorMessageController {
  constructor(
  ) { }

  @authenticate('jwt')
  @get('/errorMessage')
  @response(200, {
    description: 'Error message multi-langueage',
    content: {
      'application/json': {
        schema: {
          type: 'object',
        },
      },
    },
  })
  getErrorMessage () {
    let file;
    try {
      const filePath = path.resolve(folderPath, 'errorTranslations.json');
      file = require(filePath);
    }
    catch (err) {
      throw new CustomHttpError(404, 'FILE_NOT_FOUND');
    }

    return file;
  }



}
