import {inject} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {Site, Controller} from '../../models';
import {MarsApiPathService, CMDtype} from '../mars-API/mars-api-paths';
import {RegexpService} from '../../tools/regexp/regexp';
import {SiteRepository, ControllerRepository} from '../../repositories';
import {SiteControllerController} from '../../controllers';

const { encrypt, decrypt } = require('../../tools/crypto/crypto');
const http = require('http');

export class MarsConnectorService {

	constructor(
    @inject('marsApiPathService')
    private marsApiPathService: MarsApiPathService,
    @inject('regexpService')
    private regexpService: RegexpService,
    @repository(SiteRepository) protected siteRepository: SiteRepository,
    @repository(ControllerRepository) protected controllerRepository: ControllerRepository
  ) { }

  checkIpConnectivity(
    controllerModel: Controller,
    password?: string,
    timeout: number = 3000,
    pendingTime: number = 15000
  ): Promise<any> {
    return new Promise ((resolve, reject) => {
      //decode apssword
      const loginPwd = decrypt(controllerModel.loginPassword);
      const pwd = typeof password != 'undefined' ? password : loginPwd;
      let req = http.request({
                              'host': controllerModel.ipAddress,
                              'port': 80,
                              'path':'/mars/useraccount/v1/login',
                              'method': 'POST',
                              'timeout': timeout,
                              'headers': {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                              }
                            });

      req.on('response', (res: any) => {
          resolve(res);
      });
      req.on('error', (err: any) => {
          reject(err);
      });
      req.on('timeout', () => {
          req.destroy();
      });
      req.write(JSON.stringify({user_name: controllerModel.loginAccount, password: pwd}));
      req.end();

      // Set the response within n* seconds ( = 'pendingTime') to avoid too long waiting time due to Pending Status
      setTimeout(() => { req.abort(); }, pendingTime);

    });
  }

  async updateControllerClusterNodes(controllerModel: Controller): Promise<void> {
    try {
      const loginRes = await this.checkIpConnectivity(controllerModel, undefined, undefined, 20000) //Class: http.IncomingMessage
      if (loginRes.statusCode == 200) {
        // check Cluster Nodes of Controller
        const clusterApiPath = this.marsApiPathService.getControllerClusterNodes();
        const clusterRes = await this.getResponseByPath(controllerModel.ipAddress, loginRes.headers["mars_g_session_id"], clusterApiPath);
        const clusterNodesData = JSON.parse(clusterRes.toString()).nodes;
        for (let index = 0; index < clusterNodesData.length; index++) {

          const node = clusterNodesData[index];
          const nodeIp = node.ip;

          const ipValidationPattern = this.regexpService.get('ipv4');

          const _filter: Filter<Controller> = {"where": {"ipAddress": nodeIp}};
          const controllersWithTheIP = await this.controllerRepository.find(_filter);

          if (ipValidationPattern.test(nodeIp) && (controllersWithTheIP.length == 0)) {
            const clusterController = {
              "controllerName": nodeIp,
              "ipAddress": nodeIp,
              "loginAccount": controllerModel.loginAccount,
              "loginPassword": controllerModel.loginPassword,
              "description": `Cluster Node of ${controllerModel.controllerName}`
            }
            await this.siteRepository.controllers(controllerModel.siteId).create(clusterController);
          }
        }

      }
    } catch (err) {
      console.log(
        `> Login Controller: ${controllerModel.controllerName} >> ERROR\n` +
        `> IP: ${controllerModel.ipAddress}, LoginAcc: ${controllerModel.loginAccount}, LoginPwd: ${decrypt(controllerModel.loginPassword)}\n` +
        `> ${err}\n`
      );
    }
  }

  async getCpuRamDevicesData(controllerModel: Controller): Promise<Controller> {
    try {
      controllerModel.loginStatus = false;
      controllerModel.cpuIdle = -1;
      controllerModel.ramUsage = -1;
      controllerModel.deviceCounts = -1;
      controllerModel.availableDeviceCounts = -1;

      const loginRes = await this.checkIpConnectivity(controllerModel, undefined, undefined, 20000) //Class: http.IncomingMessage
      
      if (loginRes.statusCode == 200) {

        // Status
        controllerModel.loginStatus = true;

        // CPU Data
        const cpuApiPath = this.marsApiPathService.getCpuRamDiskStatusPath(CMDtype.cpu, this.getCurrentUTCTimestamp(-60), this.getCurrentUTCTimestamp(-0));
        const cpuRes = await this.getResponseByPath(
          controllerModel.ipAddress, loginRes.headers["mars_g_session_id"], cpuApiPath
        );
        const cpuData = JSON.parse(cpuRes.toString());
        if (cpuData.cpu.length > 0 && cpuData.cpu[0].resources.length > 0) {
              //console.log("result: " + cpu.cpu[0].resources[0].idle_percent);
              controllerModel.cpuIdle = cpuData.cpu[0].resources[0].idle_percent;
        }

        // RAM Data
        const ramApiPath = this.marsApiPathService.getCpuRamDiskStatusPath(CMDtype.memory, this.getCurrentUTCTimestamp(-60), this.getCurrentUTCTimestamp(-0));
        const ramRes = await this.getResponseByPath(
          controllerModel.ipAddress, loginRes.headers["mars_g_session_id"], ramApiPath
        );
        const ramData = JSON.parse(ramRes.toString());
        if (ramData.memory.length > 0 && ramData.memory[0].resources.length > 0) {
              //console.log("result: " + mem.memory[0].resources[0].used_percent);
              controllerModel.ramUsage = ramData.memory[0].resources[0].used_percent;
        }

        // Device Data
        const devicesApiPath = this.marsApiPathService.getDevicesStatusPath();
        const devicesRes = await this.getResponseByPath(
          controllerModel.ipAddress, loginRes.headers["mars_g_session_id"], devicesApiPath
        );
        const devicesData = JSON.parse(devicesRes.toString()).devices;
        if (devicesData.length >= 0) {
          controllerModel.deviceCounts = devicesData.length;
          controllerModel.availableDeviceCounts = devicesData.filter((device: any) => {device.avalible == true}).length;
        }
      } else {
        console.log(
          `> Login Controller: ${controllerModel.controllerName} >> NOT 200 Response\n` +
          `> IP: ${controllerModel.ipAddress}, LoginAcc: ${controllerModel.loginAccount}, LoginPwd: ${decrypt(controllerModel.loginPassword)}\n` +
          `> Response Code: ${loginRes.statusCode}\n`
        );
      }
    } catch (err) {
      console.log(
        `> Login Controller: ${controllerModel.controllerName} >> ERROR\n` +
        `> IP: ${controllerModel.ipAddress}, LoginAcc: ${controllerModel.loginAccount}, LoginPwd: ${decrypt(controllerModel.loginPassword)}\n` +
        `> ${err}\n`
      );
    }
    return controllerModel;
  }

  getResponseByPath(ip: string, token: string, path: string, timeout: number = 3000
  ): Promise<any> {
    return new Promise ((resolve, reject) => {
      let req = http.request({
        'host': ip,
        'port': 8181,
        'path': path,
        'method': 'GET',
        'timeout': timeout,
        'headers': {'Cookie': 'marsGSessionId=' + token }
        }, (res: any) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              res.on('data', (data: any) => {
                  //console.log(JSON.parse(data));
                try {
                  resolve(data);
                } catch(err) {
                  reject(err);
                }
            });
          }
      });

      req.on('error', (err:any) => {
          reject(err);
      });
      req.on('timeout', () => {
          req.destroy();
      });
      req.end();
    });
  }

  getCurrentUTCTimestamp(plusSeconds: number): string {
    const ts = Date.now() + plusSeconds*1000; //plus convert to seconds
    const date_ob = new Date(ts);
    const date = this.getIntTwoChars(date_ob.getUTCDate());
    const month = this.getIntTwoChars(date_ob.getUTCMonth() + 1);
    const year = date_ob.getUTCFullYear();
    const hours = this.getIntTwoChars(date_ob.getUTCHours());
    const minutes = this.getIntTwoChars(date_ob.getUTCMinutes());
    const seconds = this.getIntTwoChars(date_ob.getUTCSeconds());
    // prints date & time in 2022-07-25T08:19:00Z
    const dateDisply = year + "-" +
                      month + "-" +
                      date + "T" +
                      hours + ":" +
                      minutes + ":" +
                      seconds + "Z";
    return dateDisply;
  }

  getIntTwoChars(number: number): string {
    return (`0${number}`).slice(-2);
  }

}
