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
} from '@loopback/rest';
import {Marsmodel} from '../models';
import {MarsmodelRepository} from '../repositories';
const { encrypt, decrypt } = require('./crypto');

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
