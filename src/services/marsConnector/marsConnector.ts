import {inject} from '@loopback/core';
import {Site, Controller} from '../../models';
import {MarsApiPathService, CMDtype} from '../marsAPIs/marsApiPath';

const { encrypt, decrypt } = require('../../tools/crypto/crypto');
const http = require('http');

export class MarsConnectorService {

	constructor(
    @inject('marsApiPathService')
    private marsApiPathService: MarsApiPathService,
  ) { }

  checkIpConnectivity(
    controllerModel: Controller,
    password?: string,
    timeout: number = 3000
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
    });
  }

  async getCpuRamData(controllerModel: Controller): Promise<Controller> {
    try {
      controllerModel.loginStatus = false;
      controllerModel.cpuIdle = -1;
      controllerModel.ramUsage = -1;

      const loginRes = await this.checkIpConnectivity(controllerModel); //Class: http.IncomingMessage
      if (loginRes.statusCode == 200) {

        // Status
        controllerModel.loginStatus = true;

        // CPU Data
        const cpuApiPath = this.marsApiPathService.getCpuRamDiskStatusPath(CMDtype.cpu, this.getCurrentTimestamp(-60), this.getCurrentTimestamp(-0));
        const cpuRes = await this.getResponseByPath(
          controllerModel.ipAddress, loginRes.headers["mars_g_session_id"], cpuApiPath
        );
        const cpuData = JSON.parse(cpuRes.toString());
        if (cpuData.cpu.length != 0 && cpuData.cpu[0].resources.length != 0) {
              //console.log("result: " + cpu.cpu[0].resources[0].idle_percent);
              controllerModel.cpuIdle = cpuData.cpu[0].resources[0].idle_percent;
        }

        // RAM Data
        const ramApiPath = this.marsApiPathService.getCpuRamDiskStatusPath(CMDtype.memory, this.getCurrentTimestamp(-60), this.getCurrentTimestamp(-0));
        const ramRes = await this.getResponseByPath(
          controllerModel.ipAddress, loginRes.headers["mars_g_session_id"], ramApiPath
        );
        const ramData = JSON.parse(ramRes.toString());
        if (ramData.memory.length != 0 && ramData.memory[0].resources.length != 0) {
              //console.log("result: " + mem.memory[0].resources[0].used_percent);
              controllerModel.ramUsage = ramData.memory[0].resources[0].used_percent;
        }
      }
    } catch (err) {
      console.log(
        "getCpuRamData error" +
        "Controller Name:" + controllerModel.controllerName +
        ", IP:" + controllerModel.ipAddress +
        ", Login Acc: " + controllerModel.loginAccount +
        ", Login Pwd: " + controllerModel.loginPassword +
        ", Error Msg:" + err
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

  getCurrentTimestamp(plusSeconds: number): string {
    const ts = Date.now() + plusSeconds*1000; //plus convert to seconds
    const date_ob = new Date(ts);
    const date = this.getIntTwoChars(date_ob.getDate());
    const month = this.getIntTwoChars(date_ob.getMonth() + 1);
    const year = date_ob.getFullYear();
    const hours = this.getIntTwoChars(date_ob.getHours());
    const minutes = this.getIntTwoChars(date_ob.getMinutes());
    const seconds = this.getIntTwoChars(date_ob.getSeconds());
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
