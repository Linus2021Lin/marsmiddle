export enum CMDtype {
  cpu = 'cpu',
  memory = 'memory',
  disk = 'disk'
}

export class MarsApiPathService {

	constructor() {
  }

  getCpuRamDiskStatusPath(type: CMDtype, startTime: string, endTime: string, interval: string = '30'): string {
    return `/mars/analyzer/v1/timerangebar_all/ctrl/${type}/${startTime}/${endTime}/${interval}`;
  }

  getDevicesStatusPath(): string {
    return `/mars/v1/devices`;
  }

  getControllerClusterNodes(): string {
    return `/mars/v1/cluster`;
  }

}
