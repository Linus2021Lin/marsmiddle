import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
  HttpErrors
} from '@loopback/rest';
import {Marsmodel} from '../models';
import {MarsmodelRepository} from '../repositories';
const { encrypt, decrypt } = require('./crypto');
const isIp = require('is-ip');
const http = require('http');
var querystring = require('querystring');

class CustomHttpError extends Error {
  statusCode: number

  constructor(status: number, message: string) {
    super(message)
    this.statusCode = status
  }
}

export class SiteController {
  constructor(
    @repository(MarsmodelRepository)
    public marsmodelRepository : MarsmodelRepository,
  ) {}

  @post('/marsmiddle')
  @response(200, {
    description: 'Marsmodel model instance',
    content: {'application/json': {schema: getModelSchemaRef(Marsmodel)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Marsmodel, {
            title: 'New Mars Controller',
            
          }),
        },
      },
    })
    marsmodel: Marsmodel,
  ): Promise<Marsmodel> {

    if (!isIp.v4(marsmodel.ip) && !isIp.v6(marsmodel.ip)) {
       throw new CustomHttpError(400, 'Invalid IP address.');
    }

    marsmodel.status = false;
    //https://210.63.204.29/mars/useraccount/v1/login
    var request = http.request({'host': marsmodel.ip,
              'port': 80,
              'path':'/mars/useraccount/v1/login',
              'method': 'POST',
              'headers': {'Content-Type': 'application/json', 'Accept': 'application/json'}
              },
              function(res:any) {
                  res.setEncoding('utf8');
                  res.on('data', function (chunk:any) {
                      if (res.statusCode >= 200 ||res.statusCode <= 299) {
                          marsmodel.status = true;
                          //console.log('success');
                      } else {
                          marsmodel.status = false;
                          //console.log('Response: ' + chunk);
                      }
                  });
              });

    let post_data = JSON.stringify({user_name: marsmodel.loginacc, password: marsmodel.loginpwd});
    await request.write(post_data);
    request.end();

    marsmodel.loginpwd = encrypt(marsmodel.loginpwd);
    return this.marsmodelRepository.create(marsmodel);
  }

  @get('/marsmiddle/count')
  @response(200, {
    description: 'Marsmodel model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Marsmodel) where?: Where<Marsmodel>,
  ): Promise<Count> {
    return this.marsmodelRepository.count(where);
  }

  @get('/marsmiddle')
  @response(200, {
    description: 'Array of Marsmodel model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Marsmodel, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Marsmodel) filter?: Filter<Marsmodel>,
  ): Promise<Marsmodel[]> {
    return this.marsmodelRepository.find(filter);
  }

  @patch('/marsmiddle')
  @response(200, {
    description: 'Marsmodel PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Marsmodel, {partial: true}),
        },
      },
    })
    marsmodel: Marsmodel,
    @param.where(Marsmodel) where?: Where<Marsmodel>,
  ): Promise<Count> {

    if (!isIp.v4(marsmodel.ip) && !isIp.v6(marsmodel.ip)) {
       throw new CustomHttpError(400, 'Invalid IP address.');
    }

    marsmodel.status = false;

    return this.marsmodelRepository.updateAll(marsmodel, where);
  }

  @get('/marsmiddle/{id}')
  @response(200, {
    description: 'Marsmodel model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Marsmodel, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Marsmodel, {exclude: 'where'}) filter?: FilterExcludingWhere<Marsmodel>
  ): Promise<Marsmodel> {
    return this.marsmodelRepository.findById(id, filter);
  }

  @patch('/marsmiddle/{id}')
  @response(204, {
    description: 'Marsmodel PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Marsmodel, {partial: true}),
        },
      },
    })
    marsmodel: Marsmodel,
  ): Promise<void> {
    if (!isIp.v4(marsmodel.ip) && !isIp.v6(marsmodel.ip)) {
       throw new CustomHttpError(400, 'Invalid IP address.');
    }

    marsmodel.status = false;
    await this.marsmodelRepository.updateById(id, marsmodel);
  }

  @put('/marsmiddle/{id}')
  @response(204, {
    description: 'Marsmodel PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() marsmodel: Marsmodel,
  ): Promise<void> {

    if (!isIp.v4(marsmodel.ip) && !isIp.v6(marsmodel.ip)) {
       throw new CustomHttpError(400, 'Invalid IP address.');
    }

    marsmodel.status = false;
    await this.marsmodelRepository.replaceById(id, marsmodel);
  }

  @del('/marsmiddle/{id}')
  @response(204, {
    description: 'Marsmodel DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.marsmodelRepository.deleteById(id);
  }
}
