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
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {Site, Controller} from '../models';
import {SiteRepository} from '../repositories';
import {CustomHttpError} from '../tools/customError/customHttpError';
import {MarsConnectorService} from '../services/marsConnector/marsConnector';
import { promises } from 'fs';

export class SitesController {
  constructor(
    @repository(SiteRepository)
    public siteRepository : SiteRepository,
    @inject('marsConnectorService')
    private marsConnectorService: MarsConnectorService,
  ) {}

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
  @post('/sites')
  @response(200, {
    description: 'Site model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Site, {
          exclude: ['siteId']
        })
      }
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Site, {
            title: 'NewSite',
            exclude: ['siteId'],
            optional: ['siteDescription']
          }),
        },
      },
    })
    site: Site,
  ): Promise<Site> {
    // Check if site name has been used before, it should be unique
    const filter: Filter<Site> = {
      "where": {"siteName":site.siteName}
    }
    await this.siteRepository.find(filter)
    .then( (res) => {
      if (res.length > 0) {
        throw new CustomHttpError(409, 'SITENAME_CONFLICT');
      }
    })
    return this.siteRepository.create(site);
  }

  @authenticate('jwt')
  @get('/sites')
  @response(200, {
    description: 'Array of Site model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Site, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    // @param.filter(Site) filter?: Filter<Site>,
  ): Promise<Site[]> {
    const filter = {
      "include": ['controllers']
    };
    const sites = this.siteRepository.find(filter)
                      .then(async (siteArr) => {
                              siteArr.forEach( (site) => {
                                if (!site.controllers) { site['controllers'] = []; }
                              })
                              let siteLevelPromiseArr = [];
                              for (let siteIndex = 0; siteIndex < siteArr.length; siteIndex++) {
                                // set value of loginStatus, cpuIdle, ramUsage for each controllers of sites
                                let  crtlLevelPromiseArr = [];
                                for (let ctrlIndex = 0; ctrlIndex < siteArr[siteIndex].controllers.length; ctrlIndex++) {
                                  crtlLevelPromiseArr.push(
                                    this.marsConnectorService.getCpuRamData(siteArr[siteIndex].controllers[ctrlIndex])
                                  );
                                }
                                let ctrlPromiseAll = Promise.all(crtlLevelPromiseArr).then((ctrlResArr) => {
                                  for (let i = 0; i < siteArr[siteIndex].controllers.length; i++) {
                                    siteArr[siteIndex].controllers[i] = ctrlResArr[i];
                                  }
                                })
                                siteLevelPromiseArr.push(ctrlPromiseAll);
                              }
                              await Promise.all(siteLevelPromiseArr)
                              return siteArr;
                      })
    return sites;
  }

  @authenticate('jwt')
  @get('/sites/{siteName}')
  @response(200, {
    description: 'Site model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Site, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('siteName') siteName: string,
    // @param.filter(Site, {exclude: 'where'}) filter?: FilterExcludingWhere<Site>
  ): Promise<Site> {
    // Get ID of selected site
    let siteId = '';
    await this.getSiteId(siteName).then(
      (res) => { siteId = res; }
    )
    const filter = {
      "include": ['controllers']
    };
    const response = this.siteRepository.findById(siteId, filter)
                      .then(async (res) => {
                        if (!res.controllers) { res['controllers'] = []; }
                        // set value of loginStatus, cpuIdle, ramUsage
                        let  promiseArr = [];
                        for (let i = 0; i < res.controllers.length; i++) {
                          promiseArr.push(this.marsConnectorService.getCpuRamData(res.controllers[i]));
                          // res.controllers[i] = await this.marsConnectorService.getCpuRamData(res.controllers[i]);
                        }
                        await Promise.all(promiseArr).then((resArr) => {
                          for (let i = 0; i < res.controllers.length; i++) {
                            res.controllers[i] = resArr[i];
                          }
                        })
                        return res;
                      })
    return response;
  }

  @authenticate('jwt')
  @put('/sites/{siteName}', {
    responses: {
      '204': { description: 'Site PUT success' }
    },
  })
  async updateById(
    @param.path.string('siteName') siteName: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Site, {
            partial: true,
            exclude: ["siteId"]
          }),
        },
      },
    })
    site: Site,
  ): Promise<void> {
    // Get ID of selected site
    let siteId = '';
    await this.getSiteId(siteName).then(
      (res) => { siteId = res; }
    )
    // Check if site name has been used before, it should be unique
    if (site.siteName) {
      const _filter: Filter<Site> = {
        "where": {"siteName":site.siteName}
      }
      await this.siteRepository.find(_filter)
      .then( (res) => {
        if (res.length > 0) {
          throw new CustomHttpError(409, 'SITENAME_CONFLICT');
        }
      })
    }
    // In loopback4, Update: apply to partial fields(PATCH), Replace: apply to all fields(PUT)
    await this.siteRepository.updateById(siteId, site);
  }

  @authenticate('jwt')
  @del('/sites/{siteName}', {
    responses: {
      '204': { description: 'Site DELETE success' }
    },
  })
  async deleteById(@param.path.string('siteName') siteName: string): Promise<void> {
    // Get ID of selected site
    let siteId = '';
    await this.getSiteId(siteName).then(
      (res) => { siteId = res; }
    )
    // Delete all controllers of the Site
    const _filter: Filter<Controller> = {
      "where": {"siteId": siteId}
    }
    await this.siteRepository.controllers(siteId).delete(_filter.where);
    // Delete the Site
    await this.siteRepository.deleteById(siteId);
  }

  @authenticate('jwt')
  @get('/sites/count')
  @response(200, {
    description: 'Site model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    // @param.where(Site) where?: Where<Site>,
  ): Promise<Count> {
    // return this.siteRepository.count(where);
    return this.siteRepository.count();
  }

}
