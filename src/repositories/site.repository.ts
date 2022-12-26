import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory} from '@loopback/repository';
import {MemDataSource} from '../datasources';
import {Site, SiteRelations, Controller} from '../models';
import {ControllerRepository} from './controller.repository';

export class SiteRepository extends DefaultCrudRepository<
  Site,
  typeof Site.prototype.siteId,
  SiteRelations
> {

  public readonly controllers: HasManyRepositoryFactory<Controller, typeof Site.prototype.siteId>;

  constructor(
    @inject('datasources.mem') dataSource: MemDataSource, @repository.getter('ControllerRepository') protected controllerRepositoryGetter: Getter<ControllerRepository>,
  ) {
    super(Site, dataSource);
    this.controllers = this.createHasManyRepositoryFactoryFor('controllers', controllerRepositoryGetter,);
    this.registerInclusionResolver('controllers', this.controllers.inclusionResolver);
  }
}
