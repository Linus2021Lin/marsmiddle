import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MemDataSource} from '../datasources';
import {Controller, ControllerRelations} from '../models';

export class ControllerRepository extends DefaultCrudRepository<
  Controller,
  typeof Controller.prototype.controllerName,
  ControllerRelations
> {
  constructor(
    @inject('datasources.mem') dataSource: MemDataSource,
  ) {
    super(Controller, dataSource);
  }
}
