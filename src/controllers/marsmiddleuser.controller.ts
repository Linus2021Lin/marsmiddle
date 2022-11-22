// Uncomment these imports to begin using these cool features!
import {authenticate, TokenService, AuthenticationBindings} from '@loopback/authentication';
import {
  Credentials,
  MyUserService,
  TokenServiceBindings,
  User,
  UserRoleType,
  UserRepository,
  UserServiceBindings,
  TokenServiceConstants,
  UserCredentials,
  UserCredentialsRepository
} from '../services/auth-jwt';
import {inject} from '@loopback/core';
import {model, property, repository, Entity, Filter} from '@loopback/repository';
import {
  get,
  put,
  del,
  param,
  getModelSchemaRef,
  post,
  requestBody,
  SchemaObject,
  RequestContext,
  HttpErrors
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {genSalt, hash} from 'bcryptjs';
import _ from 'lodash';
import {RegexpService} from '../tools/regexp/regexp';
import {CustomHttpError} from '../tools/customError/customHttpError';

// For SignUp
@model()
export class SignUpUserRequest extends Entity {
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

  @property({
    type: 'string',
    required: true
  })
  role: UserRoleType;
}

const SignUpCredentialsSchema: SchemaObject = {
  type: 'object',
  required: ['username', 'password', 'role'],
  properties: {
    username: {
      type: 'string',
      minLength: 5,
      maxLength: 15
    },
    password: {
      type: 'string',
      minLength: 5
    },
    role: {
      type: 'string'
    },
  },
};

export const SignUpCredentialsRequestBody = {
  description: 'The input of signUp function',
  required: true,
  content: {
    'application/json': {schema: SignUpCredentialsSchema},
  },
};

// For LogIn
@model()
export class LoginUserRequest extends Entity {
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

const LoginCredentialsSchema: SchemaObject = {
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: {
      type: 'string',
      minLength: 5,
      maxLength: 15
    },
    password: {
      type: 'string',
      minLength: 5
    },
  },
};

export const LoginCredentialsRequestBody = {
  description: 'The input of login function',
  required: true,
  content: {
    'application/json': {schema: LoginCredentialsSchema},
  },
};

// For Update User
@model()
export class UpdateUserRequest extends Entity {
  @property({
    type: 'string'
  })
  password: string;

  @property({
    type: 'string'
  })
  role: UserRoleType;
}

export const UpdateUserRequestBody = {
  description: 'The input of update user function',
  required: true,
  content: {
    'application/json': {
      schema: getModelSchemaRef(UpdateUserRequest, {
        partial: true,
      }),
    },
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
    @repository(UserCredentialsRepository) protected userCredentialsRepository: UserRepository,
    @inject('regexpService')
    private regexpService: RegexpService,
    @inject.context() 
    public requestContext: RequestContext,
  ) {}

  private readonly DEFAULT_TOKENS: string[] = ['defaultBlank'];

  @authenticate('admin-jwt')
  @post('/users/signup', {
    responses: {
      '200': { description: 'Signup success' },
    },
  })
  async signUp(
    @requestBody(SignUpCredentialsRequestBody) newUserRequest: SignUpUserRequest,
  ): Promise<void> {

    // Exception: Username
    const validationPattern = this.regexpService.get('name_en_15');
    if (newUserRequest.username && !validationPattern.test(newUserRequest.username)) {
      throw new CustomHttpError(422, 'INVALID_USERNAME');
    }
    // Exception: Role
    if (!Object.values(UserRoleType).includes(newUserRequest.role)) {
      throw new CustomHttpError(422, 'INVALID_ROLE');
    }

    // Set password
    const password = await hash(newUserRequest.password, await genSalt());

    // To fit @Loopback/authentication-jwt Interface
    const userRequest = {
                          username: newUserRequest.username,
                          password: newUserRequest.password,
                          id: newUserRequest.username,
                          tokens: this.DEFAULT_TOKENS,
                          role: newUserRequest.role
                        };
    await this.userRepository.create( _.omit(userRequest, 'password'),)
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
                username: {
                  type: 'string',
                },
                role: {
                  type: 'string',
                },
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
    @requestBody(LoginCredentialsRequestBody) userCredentials: LoginUserRequest,
  ): Promise<{username: string, role: UserRoleType, token: string}> {

    const validationPattern = this.regexpService.get('name_en_15');
    if (userCredentials.username && !validationPattern.test(userCredentials.username)) {
      throw new CustomHttpError(422, 'INVALID_USERNAME');
    }

    // ensure the user exists, and the password is correct
    let token: string = '';
    let role: UserRoleType = UserRoleType.guest;
    await this.userService.verifyCredentials(userCredentials)
    .then( async (res) => {
      const user: User = res;
      role = res.role;
      // convert a User object into a UserProfile object (reduced set of properties)
      const userProfile = this.userService.convertToUserProfile(user);
      // create a JSON Web Token based on the user profile
      token = await this.jwtService.generateToken(userProfile);
      // Add token Info into User Info in database
      const _tokens: string[] = user.tokens.concat(token);
      await this.userRepository.updateById(user.id, {tokens: _tokens});
    })
    return {'username': userCredentials.username, 'role': role, 'token': token};
  }

  @authenticate('jwt')
  @post('/users/logout', {
    responses: {
      '200': { description: 'Logout success' },
    },
  })
  async logout(
    @inject(SecurityBindings.USER)
    currentUser: UserProfile,
  ): Promise<void> {

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

    if (!isTokenRevoked) {
      throw new CustomHttpError(409, 'LOGOUT_FAILED');
    }
  }

  @authenticate('jwt')
  @get('/users', {
    responses: {
      '200': {
        description: 'Array of User instances',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                username: {
                  type: 'string',
                },
                role: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  })
  async findUsers(
  ): Promise<{username: string, role: UserRoleType}[]> {
    const users = await this.userRepository.find();
    const response: {username: string, role: UserRoleType}[] = [];
    users.forEach( (user) => {
      const _user = {
                      'username': user.username,
                      'role': user.role
                    };
      response.push(_user);
    })

    return response;
  }

  @authenticate('jwt')
  @put('/users/{userName}', {
    responses: {
      '204': {
        description: 'User account PUT success',
      },
    },
  })
  async updateByUserName(
    @param.path.string('userName') userName: string,
    @requestBody(UpdateUserRequestBody) updateUserRequest: UpdateUserRequest,
    @inject(SecurityBindings.USER)
    currentUserProfile: UserProfile,
  ): Promise<void> {
    // check if the user exists
    const selectedUser = await this.userRepository.findById(userName);
    if (!selectedUser) {
      throw new HttpErrors.Unauthorized(`INVALID_USERNAME`,);
    }
    // If user is NOT administrator, he/ she can only update his/ her own user password.
    const currentUserId = currentUserProfile[securityId];
    const currentUser = await this.userRepository.findById(currentUserId);
    if (currentUser.role != UserRoleType.administrator && currentUserId != userName) {
      throw new HttpErrors.Unauthorized(`INVALID_ROLE`,);
    }
    if (currentUser.role != UserRoleType.administrator && updateUserRequest.role) { // guests can't update role setting
      throw new HttpErrors.Unauthorized(`INVALID_ROLE`,);
    }
    // Exception: Role format
    if (updateUserRequest.role && !Object.values(UserRoleType).includes(updateUserRequest.role)){
      throw new CustomHttpError(422, 'INVALID_ROLE');
    }
    // At least one administrator is required
    if (selectedUser.role == UserRoleType.administrator && updateUserRequest.role != UserRoleType.administrator) {
      await this.checkMoreThanOneAdministratorExists();
    }

    if (updateUserRequest.password) {
      // Set password
      const password = await hash(updateUserRequest.password, await genSalt());
      // To fit @Loopback/authentication-jwt Interface
      const userRequest = {
                            username: userName,
                            password: updateUserRequest.password,
                            id: userName,
                            tokens: this.DEFAULT_TOKENS,
                            role: updateUserRequest.role || selectedUser.role
                          };
      // In loopback4, Update: apply to partial fields(PATCH), Replace: apply to all fields(PUT)
      await this.userRepository.updateById(userName, _.omit(userRequest, 'password'))
        .then( async (res) => {
          await this.userRepository.userCredentials(userName).patch({password});
        })
    } else if (updateUserRequest.role){
      const userRequest = {
        role: updateUserRequest.role
      };
      await this.userRepository.updateById(userName, userRequest);
    }
  }

  @authenticate('admin-jwt')
  @del('/users/{userName}', {
    responses: {
      '204': {
        description: 'User account DELETE success',
      },
    },
  })
  async deleteByUserName(@param.path.string('userName') userName: string): Promise<void> {
    // At least one administrator is required
    await this.checkMoreThanOneAdministratorExists();
    // Delete selected User
    const _filter: Filter<UserCredentials> = {
      "where": {"userId": userName}
    }
    await this.userCredentialsRepository.deleteAll(_filter.where);
    await this.userRepository.deleteById(userName);
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
    return currentUserProfile[securityId];
  }

  async checkMoreThanOneAdministratorExists() {
    // Check the number of administrator. At least one administrator is required.
    const isAdminFilter: Filter<User> = {
      "where": {"role": "administrator"}
    }
    const adminArray = await this.userRepository.find(isAdminFilter);
    if (adminArray.length < 2) {
      throw new CustomHttpError(403, 'At least one administrator is required.');
    }
  }

}
