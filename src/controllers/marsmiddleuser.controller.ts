// Uncomment these imports to begin using these cool features!
import {authenticate, TokenService, AuthenticationBindings} from '@loopback/authentication';
import {
  Credentials,
  MyUserService,
  TokenServiceBindings,
  User,
  UserRepository,
  UserServiceBindings,
  TokenServiceConstants
} from '../services/auth-jwt';
import {inject} from '@loopback/core';
import {model, property, repository, Entity} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  post,
  requestBody,
  SchemaObject,
  RequestContext
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {genSalt, hash} from 'bcryptjs';
import _ from 'lodash';
import {RegexpService} from '../tools/regexp/regexp';
import {CustomHttpError} from '../tools/customError/customHttpError';

// For SignUp & LogIn
@model()
export class UserRequest extends Entity {
  @property({
    type: 'string',
    id: true,
    required: true
  })
  username: string;

  @property({
    type: 'string',
    required: true
  })
  password: string;
}

// For SignUp & LogIn
const CredentialsSchema: SchemaObject = {
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: {
      type: 'string',
      minLength: 8,
      maxLength: 15
    },
    password: {
      type: 'string',
      minLength: 8,
    },
  },
};

// For SignUp
export const SignUpCredentialsRequestBody = {
  description: 'The input of signUp function',
  required: true,
  content: {
    'application/json': {schema: CredentialsSchema},
  },
};

// For LogIn
export const LoginCredentialsRequestBody = {
  description: 'The input of login function',
  required: true,
  content: {
    'application/json': {schema: CredentialsSchema},
  },
};

export class MarsMiddleUserController {
  constructor(
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: TokenService,
    @inject(UserServiceBindings.USER_SERVICE)
    public userService: MyUserService,
    @inject(SecurityBindings.USER, {optional: true})
    public user: UserProfile,
    @repository(UserRepository) protected userRepository: UserRepository,
    @inject('regexpService')
    private regexpService: RegexpService,
    @inject.context() 
    public requestContext: RequestContext,
  ) {}

  private readonly DEFAULT_TOKENS: string[] = ['defaultBlank'];

  @post('/users/signup', {
    responses: {
      '200': {
        description: 'User',
        content: {
          'application/json': {
            schema: {
              'x-ts-type': UserRequest,
            },
          },
        },
      },
    },
  })
  async signUp(
    @requestBody(SignUpCredentialsRequestBody) newUserRequest: UserRequest,
  ): Promise<void> {

    const validationPattern = this.regexpService.get('name_en_15');
    if (newUserRequest.username && !validationPattern.test(newUserRequest.username)) {
      throw new CustomHttpError(422, 'INVALID_USERNAME');
    }

    const password = await hash(newUserRequest.password, await genSalt());

    // To fit @Loopback/authentication-jwt Interface
    const userRequest = {
                          username: newUserRequest.username,
                          password: newUserRequest.password,
                          id: newUserRequest.username,
                          tokens: this.DEFAULT_TOKENS
                        };
    await this.userRepository.create(
                                      _.omit(userRequest, 'password'),
                                    )
    .then( async (res) => {
      const savedUser = res;
      await this.userRepository.userCredentials(savedUser.id).create({password});
    })
    .catch((err) => {
      if (err.message.includes('User.id') && err.status == 409) {
        throw new CustomHttpError(409, 'USERNAME_CONFLICT');
      } else {
        throw err;
      }
    });
  }

  @post('/users/login', {
    responses: {
      '200': {
        description: 'Token',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  })
  async login(
    @requestBody(LoginCredentialsRequestBody) userCredentials: UserRequest,
  ): Promise<{token: string}> {

    const validationPattern = this.regexpService.get('name_en_15');
    if (userCredentials.username && !validationPattern.test(userCredentials.username)) {
      throw new CustomHttpError(422, 'INVALID_USERNAME');
    }

    // ensure the user exists, and the password is correct
    let token: string = '';
    await this.userService.verifyCredentials(userCredentials)
    .then( async (res) => {
      const user: User = res;
      // convert a User object into a UserProfile object (reduced set of properties)
      const userProfile = this.userService.convertToUserProfile(user);
      // create a JSON Web Token based on the user profile
      token = await this.jwtService.generateToken(userProfile);
      // Add token Info into User Info in database
      const _tokens: string[] = user.tokens.concat(token);
      await this.userRepository.updateById(user.id, {tokens: _tokens});
    })
    return {token};
  }

  @authenticate('jwt')
  @post('/users/logout', {
    responses: {
      '200': {
        description: 'LogoutMsg',
        content: {
          'application/json': {
            schema: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async logout(
    @inject(SecurityBindings.USER)
    currentUser: UserProfile,
  ): Promise<string> {

    let isTokenRevoked: boolean = false;

    // const authHeader = this.requestContext.request.headers?.authorization || '';
    // const userToken = authHeader.split(" ")[1];
    // const currentUser: UserProfile = await this.jwtService.verifyToken(userToken);
    
    // console.log('userProfile:', currentUser);

    await this.userRepository.updateById(
                                          currentUser.id,
                                          { tokens: this.DEFAULT_TOKENS }
                                        )
            .then((res) => { isTokenRevoked = true; })

    if (isTokenRevoked) {
      return 'Have Been Logout';
    } else {
      return 'Logout failed';
    }
  }

  @authenticate('jwt')
  @get('/users/userInfo', {
    responses: {
      '200': {
        description: 'Return current user',
        content: {
          'application/json': {
            schema: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async userInfo(
    @inject(SecurityBindings.USER)
    currentUserProfile: UserProfile,
  ): Promise<string> {
    this.userRepository.updateById
    return currentUserProfile[securityId];
  }

}
