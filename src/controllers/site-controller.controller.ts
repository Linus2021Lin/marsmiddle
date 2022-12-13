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

  async getControllerId(siteId: string, controllerName: string): Promise<string> {
    let controllerId: string = '';
    const filter: Filter<Controller> = {
      "where": {"controllerName": controllerName}
    }
    await this.siteRepository.controllers(siteId).find(filter)
    .then( (res) => {
      if (res) {
        controllerId = res[0].controllerId;
      } else {
        throw new CustomHttpError(404, 'CONTROLLER_NOT_FOUND');
      }
    })
    return controllerId;
  }

  async checkControllerNameExists(controllerName: string): Promise<void> {
    const _filter: Filter<Controller> = {
      "where": {"controllerName": controllerName}
    };
    const controllersWithTheName = await this.controllerRepository.find(_filter);
    if (controllersWithTheName.length > 0) {
      throw new CustomHttpError(409, 'CONTROLLER_ALREADY_EXISTS');
    }
  }

  async checkIpAddressExists(ipAddress: string): Promise<void> {
    const _filter: Filter<Controller> = {
      "where": {"ipAddress": ipAddress}
    }
    const controllersWithTheIP = await this.controllerRepository.find(_filter);
    if (controllersWithTheIP.length > 0) {
        throw new CustomHttpError(409, 'IP_ADDRESS_ALREADY_EXISTS');
    }
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

    // Check if input new controller name already exists
    await this.checkControllerNameExists(controller.controllerName);

    // Check if input new IP address already exists
    await this.checkIpAddressExists(controller.ipAddress);

    // encode password
    controller.loginPassword = encrypt(controller.loginPassword);

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

    // Get ID of selected controller
    const ctrlId = await this.getControllerId(siteId, controllerName);

    // Get controller DATA
    const _filter: Filter<Controller> = {
      "where": {"controllerId": ctrlId}
    }
    const response = await this.siteRepository.controllers(siteId).find(_filter);

    // set value of loginStatus, cpuIdle, ramUsage, deviceCounts, availableDeviceCounts
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
            exclude: ['siteId', 'siteName', 'loginStatus', 'cpuIdle', 'ramUsage', 'deviceCounts', 'availableDeviceCounts']
          })
        }
      },
    })
    controller: Partial<Controller>,
  ): Promise<void> {

    // Exception: Controller name format
    const ctrlNameValidationPattern = this.regexpService.get('name_en_15');
    if (controller.controllerName && !ctrlNameValidationPattern.test(controller.controllerName)) {
      throw new CustomHttpError(422, 'CONTROLLERNAME_RESTRICTIONS');
    }

    // Exception: IP format
    const ipValidationPattern = this.regexpService.get('ipv4');
    if (controller.ipAddress && !ipValidationPattern.test(controller.ipAddress)) {
      throw new CustomHttpError(422, 'INVALID_IP_ADDRESS');
    }

    // Get ID of selected site
    const siteId = await this.getSiteId(siteName);

    // Get ID of selected controller
    const ctrlId = await this.getControllerId(siteId, controllerName);

    // Check if input new controller name already exists
    if (controller.controllerName) {
      await this.checkControllerNameExists(controller.controllerName);
    }

    // Check if input new IP address already exists
    if (controller.ipAddress) {
      await this.checkIpAddressExists(controller.ipAddress);
    }

    // encode password
    if (controller.loginPassword) {
      controller.loginPassword = encrypt(controller.loginPassword);
    }

    const _filter: Filter<Controller> = {
      "where": {"controllerId": ctrlId}
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
    // Get ID of selected controller
    const ctrlId = await this.getControllerId(siteId, controllerName);
    
    const _filter: Filter<Controller> = {
      "where": {"controllerId": ctrlId}
    };
    await this.siteRepository.controllers(siteId).delete(_filter.where);
  }
}
