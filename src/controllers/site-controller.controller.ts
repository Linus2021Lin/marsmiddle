import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  put,
  post,
  requestBody,
  response
} from '@loopback/rest';
import {
  Site,
  Controller,
} from '../models';
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {SiteRepository, ControllerRepository} from '../repositories';
import {CustomHttpError} from '../tools/customError/customHttpError';
import {MarsConnectorService} from '../services/marsConnector/marsConnector';
const { encrypt, decrypt } = require('../tools/crypto/crypto');

export class SiteControllerController {
  constructor(
    @repository(SiteRepository) protected siteRepository: SiteRepository,
    @repository(ControllerRepository) protected controllerRepository: ControllerRepository,
    @inject('marsConnectorService')
    private marsConnectorService: MarsConnectorService,
  ) { }

  async getSiteId(siteName: string): Promise<string> {
    let siteId: string = '';
    const filter: Filter<Site> = {
      "where": {"siteName":siteName}
    }
    await this.siteRepository.findOne(filter)
    .then( (res) => {
      if (res) {
        siteId = res.siteId;
      } else {
        throw new CustomHttpError(404, 'NOT_FOUND_SITENAME');
      }
    })
    return siteId;
  }

  @authenticate('jwt')
  @post('/sites/{siteName}/controllers')
  @response(200, {
    description: 'Controller in Site model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Controller, {
          exclude: ['siteId', 'loginPassword', 'loginStatus', 'cpuIdle', 'ramUsage']
        })
      }
    },
  })
  async create(
    @param.path.string('siteName') siteName: typeof Site.prototype.siteName,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Controller, {
            title: 'NewControllerInSite',
            exclude: ['siteId', 'siteName', 'loginStatus', 'cpuIdle', 'ramUsage'],
            optional: ['description']
          }),
        },
      },
    }) controller: Omit<Controller, 'controllerName'>,
  ): Promise<Controller> {
    // Get ID of selected site
    let siteId = '';
    await this.getSiteId(siteName).then(
      (res) => { siteId = res; }
    )
    // encode password
    controller.loginPassword = encrypt(controller.loginPassword);

    // controllerName is ID in DB, so it is unique and not be overwrite
    const response = this.siteRepository.controllers(siteId).create(controller)
                      .then((_controller) => {
                            _controller.siteName = siteName; 
                            return _controller;
                      })
    return response;
  }

  @authenticate('jwt')
  @get('/sites/{siteName}/controllers/{controllerName}', {
    responses: {
      '200': {
        description: 'Controller of the Site',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Controller, {
              exclude: ['siteId', 'loginPassword']
            })
          },
        },
      },
    },
  })
  async find(
    @param.path.string('siteName') siteName: string,
    @param.path.string('controllerName') controllerName: string,
    // @param.query.object('filter') filter?: Filter<Controller>,
  ): Promise<Controller> {
    // Get ID of selected site
    let siteId = '';
    await this.getSiteId(siteName).then(
      (res) => { siteId = res; }
    )
    // set value of loginStatus, cpuIdle, ramUsage
    const _filter: Filter<Controller> = {
      "where": {"controllerName": controllerName}
    }
    const response = await this.siteRepository.controllers(siteId).find(_filter);
    if (response.length === 0) {
      throw new CustomHttpError(404, 'NOT_FOUND_CONTROLLERNAME');
    }
    response[0].siteName = siteName; 
    response[0] = await this.marsConnectorService.getCpuRamData(response[0]);

    return response[0];
  }

  @authenticate('jwt')
  @put('/sites/{siteName}/controllers/{controllerName}', {
    responses: {
      '204': {
        description: 'Site.Controller PATCH success',
      },
    },
  })
  async updateByControllerName(
    @param.path.string('siteName') siteName: string,
    @param.path.string('controllerName') controllerName: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Controller, {
            partial: true,
            exclude: ['controllerName', 'siteId', 'siteName', 'loginStatus', 'cpuIdle', 'ramUsage']
          })
        }
      },
    })
    controller: Partial<Controller>,
  ): Promise<void> {
    // Get ID of selected site
    let siteId = '';
    await this.getSiteId(siteName).then(
      (res) => { siteId = res; }
    )
    const _filter: Filter<Controller> = {
      "where": {"controllerName": controllerName}
    }
    // encode password
    if (controller.loginPassword) {
      controller.loginPassword = encrypt(controller.loginPassword);
    }

    // In loopback4, Update: apply to partial fields(PATCH), Replace: apply to all fields(PUT)
    await this.siteRepository.controllers(siteId).patch(controller, _filter.where);
  }

  @authenticate('jwt')
  @del('/sites/{siteName}/controllers/{controllerName}', {
    responses: {
      '204': {
        description: 'Site.Controller DELETE success',
      },
    },
  })
  async delete(
    @param.path.string('siteName') siteName: string,
    @param.path.string('controllerName') controllerName: string,
  ): Promise<void> {
    // Get ID of selected site
    let siteId = '';
    await this.getSiteId(siteName).then(
      (res) => { siteId = res; }
    )
    
    const _filter: Filter<Controller> = {
      "where": {"controllerName": controllerName}
    }
    await this.siteRepository.controllers(siteId).find(_filter)
    .then((res) => {
      if (res.length === 0) {
        throw new CustomHttpError(404, 'NOT_FOUND_CONTROLLERNAME');
      }
    })
    await this.siteRepository.controllers(siteId).delete(_filter.where);
  }
}
