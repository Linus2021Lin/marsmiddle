import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MemDataSource} from '../datasources';
import {Marsmodel, MarsmodelRelations} from '../models';

export class MarsmodelRepository extends DefaultCrudRepository<
  Marsmodel,
  typeof Marsmodel.prototype.name,
  MarsmodelRelations
> {
  constructor(
    @inject('datasources.mem') dataSource: MemDataSource,
  ) {
    super(Marsmodel, dataSource);
  }
}
