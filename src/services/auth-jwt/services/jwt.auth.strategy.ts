// Copyright IBM Corp. and LoopBack contributors 2020. All Rights Reserved.
// Node module: @loopback/authentication-jwt
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {AuthenticationStrategy, TokenService} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {HttpErrors, Request} from '@loopback/rest';
import {UserProfile} from '@loopback/security';
import {TokenServiceBindings, UserServiceBindings} from '../keys';
import {MyUserService} from './user.service';
import {UserRoleType} from '../models';

export class JWTAuthenticationStrategy implements AuthenticationStrategy {
  name = 'jwt';

  constructor(
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public tokenService: TokenService,
    @inject(UserServiceBindings.USER_SERVICE)
    public userService: MyUserService,
  ) {}

  async authenticate(request: Request): Promise<UserProfile | undefined> {
    const token: string = this.extractCredentials(request);
    const userProfile: UserProfile = await this.tokenService.verifyToken(token);
    const user = await this.userService.findUserById(userProfile.id);
    if (!user.tokens.includes(token)) {
      throw new HttpErrors.Unauthorized(`INVALID_OR_EXPIRED_TOKEN`,);
    }
    return userProfile;
  }

  extractCredentials(request: Request): string {
    if (!request.headers.authorization) {
      throw new HttpErrors.Unauthorized(`AUTH_HEADER_NOT_FOUND`);
    }

    // for example : Bearer xxx.yyy.zzz
    const authHeaderValue = request.headers.authorization;

    if (!authHeaderValue.startsWith('Bearer')) {
      throw new HttpErrors.Unauthorized(`AUTH_HEADER_NOT_BEARER`,);
    }

    //split the string into 2 parts : 'Bearer ' and the `xxx.yyy.zzz`
    const parts = authHeaderValue.split(' ');
    if (parts.length !== 2)
      throw new HttpErrors.Unauthorized(`AUTH_HEADER_INVALID_PATTERN`,);
    const token = parts[1];

    return token;
  }
}

export class AdminJWTAuthenticationStrategy extends JWTAuthenticationStrategy {
  name = 'admin-jwt';
  
  async authenticate(request: Request): Promise<UserProfile | undefined> {
    const token: string = this.extractCredentials(request);
    const userProfile: UserProfile = await this.tokenService.verifyToken(token);

    const user = await this.userService.findUserById(userProfile.id);
    if (user.role != UserRoleType.administrator) {
      throw new HttpErrors.Unauthorized(`INVALID_ROLE`,);
    }
    if (!user.tokens.includes(token)) {
      throw new HttpErrors.Unauthorized(`INVALID_OR_EXPIRED_TOKEN`,);
    }

    return userProfile;
  }

}
