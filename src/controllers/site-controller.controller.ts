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
import {RegexpService} from '../tools/regexp/regexp';
import {CustomHttpError} from '../tools/customError/customHttpError';
import {MarsConnectorService} from '../services/mars-connector/mars-connector';
const { encrypt, decrypt } = require('../tools/crypto/crypto');

export class SiteControllerController {
  constructor(
    @repository(SiteRepository) protected siteRepository: SiteRepository,
    @repository(ControllerRepository) protected controllerRepository: ControllerRepository,
    @inject('marsConnectorService')
    private marsConnectorService: MarsConnectorService,
    @inject('regexpService')
    private regexpService: RegexpService
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
        throw new CustomHttpError(404, 'SITE_NOT_FOUND');
      }
    })
    return siteId;
  }

  async checkControllerExists(siteId: string, controllerName: string): Promise<void> {
    const _filter: Filter<Controller> = {
      "where": {"controllerName": controllerName}
    }
    const response = await this.siteRepository.controllers(siteId).find(_filter);
    if (response.length === 0) {
      throw new CustomHttpError(404, 'CONTROLLER_NOT_FOUND');
    }
  }

  async checkIpAddressExists(ipAddress: string): Promise<void> {
    const _filter: Filter<Controller> = {
      "where": {"ipAddress": ipAddress}
    }
    await this.controllerRepository.find(_filter)
    .then( (res) => {
      if (res.length > 0) {
        throw new CustomHttpError(409, 'IP_ADDRESS_ALREADY_EXISTS');
      }
    })
  }

  @authenticate('admin-jwt')
  @post('/sites/{siteName}/controllers')
  @response(200, {
    description: 'Controller in Site model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Controller, {
          exclude: ['siteId', 'loginPassword', 'loginStatus', 'cpuIdle', 'ramUsage', 'deviceCounts', 'availableDeviceCounts']
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
            exclude: ['siteId', 'siteName', 'loginStatus', 'cpuIdle', 'ramUsage', 'deviceCounts', 'availableDeviceCounts'],
            optional: ['description']
          }),
        },
      },
    }) controller: Controller,
  ): Promise<Controller> {
    // Exception: Controller name format
    const ctrlNameValidationPattern = this.regexpService.get('name_en_15');
    if (!ctrlNameValidationPattern.test(controller.controllerName)) {
      throw new CustomHttpError(422, 'CONTROLLERNAME_RESTRICTIONS');
    }

    // Exception: IP format
    const ipValidationPattern = this.regexpService.get('ipv4');
    if (!ipValidationPattern.test(controller.ipAddress)) {
      throw new CustomHttpError(422, 'INVALID_IP_ADDRESS');
    }

    // Get ID of selected site
    const siteId = await this.getSiteId(siteName);

    // Check if controller already exists but not return 'not found' error
    const _filter: Filter<Controller> = {
      "where": {"controllerName": controller.controllerName}
    };
    const ctrl = await this.controllerRepository.find(_filter);
    if (ctrl.length > 0) {
      throw new CustomHttpError(409, 'CONTROLLER_ALREADY_EXISTS');
    }

    // Check if IP address already exists
    await this.checkIpAddressExists(controller.ipAddress);

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
    const siteId = await this.getSiteId(siteName);
    // set value of loginStatus, cpuIdle, ramUsage, deviceCounts, availableDeviceCounts
    const _filter: Filter<Controller> = {
      "where": {"controllerName": controllerName}
    }
    const response = await this.siteRepository.controllers(siteId).find(_filter);
    if (response.length === 0) {
      throw new CustomHttpError(404, 'CONTROLLER_NOT_FOUND');
    }
    response[0].siteName = siteName; 
    response[0] = await this.marsConnectorService.getCpuRamDevicesData(response[0]);

    return response[0];
  }

  @authenticate('admin-jwt')
  @put('/sites/{siteName}/controllers/{controllerName}', {
    responses: {
      '204': {
        description: 'Site.Controller PUT success',
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
            exclude: ['controllerName', 'siteId', 'siteName', 'loginStatus', 'cpuIdle', 'ramUsage', 'deviceCounts', 'availableDeviceCounts']
          })
        }
      },
    })
    controller: Partial<Controller>,
  ): Promise<void> {

    // Exception: IP format
    const ipValidationPattern = this.regexpService.get('ipv4');
    if (controller.ipAddress && !ipValidationPattern.test(controller.ipAddress)) {
      throw new CustomHttpError(422, 'INVALID_IP_ADDRESS');
    }

    // Get ID of selected site
    const siteId = await this.getSiteId(siteName);

    // Check if controller exists
    await this.checkControllerExists(siteId, controllerName);

    // Check if IP address already exists
    if (controller.ipAddress) {
      await this.checkIpAddressExists(controller.ipAddress);
    }

    // encode password
    if (controller.loginPassword) {
      controller.loginPassword = encrypt(controller.loginPassword);
    }

    const _filter: Filter<Controller> = {
      "where": {"controllerName": controllerName}
    };
    // In loopback4, Update: apply to partial fields(PATCH), Replace: apply to all fields(PUT)
    await this.siteRepository.controllers(siteId).patch(controller, _filter.where);
  }

  @authenticate('admin-jwt')
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
    const siteId = await this.getSiteId(siteName);
    // Check if controller exists
    await this.checkControllerExists(siteId, controllerName);
    
    const _filter: Filter<Controller> = {
      "where": {"controllerName": controllerName}
    };
    await this.siteRepository.controllers(siteId).delete(_filter.where);
  }
}
