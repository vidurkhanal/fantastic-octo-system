"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserResolver = void 0;
const type_graphql_1 = require("type-graphql");
const Users_1 = require("../entities/Users");
const argon2_1 = __importDefault(require("argon2"));
const email_validator_1 = __importDefault(require("email-validator"));
let EmailPasswordInput = class EmailPasswordInput {
};
__decorate([
    type_graphql_1.Field(),
    __metadata("design:type", String)
], EmailPasswordInput.prototype, "username", void 0);
__decorate([
    type_graphql_1.Field(),
    __metadata("design:type", String)
], EmailPasswordInput.prototype, "password", void 0);
EmailPasswordInput = __decorate([
    type_graphql_1.InputType()
], EmailPasswordInput);
let FieldError = class FieldError {
};
__decorate([
    type_graphql_1.Field(),
    __metadata("design:type", String)
], FieldError.prototype, "field", void 0);
__decorate([
    type_graphql_1.Field(),
    __metadata("design:type", String)
], FieldError.prototype, "message", void 0);
FieldError = __decorate([
    type_graphql_1.ObjectType()
], FieldError);
let AuthResponse = class AuthResponse {
};
__decorate([
    type_graphql_1.Field(() => [FieldError], { nullable: true }),
    __metadata("design:type", Array)
], AuthResponse.prototype, "error", void 0);
__decorate([
    type_graphql_1.Field(() => Users_1.User, { nullable: true }),
    __metadata("design:type", Users_1.User)
], AuthResponse.prototype, "user", void 0);
AuthResponse = __decorate([
    type_graphql_1.ObjectType()
], AuthResponse);
let UserResolver = class UserResolver {
    me({ em, req }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.session.userId) {
                return null;
            }
            const user = yield em.findOne(Users_1.User, { id: req.session.userId });
            return user;
        });
    }
    RegisterUser(options, { em, req }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!email_validator_1.default.validate(options.username)) {
                return {
                    error: [
                        {
                            field: "Username",
                            message: "Email has been badly formatted. ",
                        },
                    ],
                };
            }
            if (options.password.length < 5) {
                return {
                    error: [
                        {
                            field: "Password",
                            message: "Provided Password Is Too Short. Please Type A New Password",
                        },
                    ],
                };
            }
            const hashedPassword = yield argon2_1.default.hash(options.password);
            const newUser = em.create(Users_1.User, {
                username: options.username.toLowerCase(),
                password: hashedPassword,
            });
            try {
                yield em.persistAndFlush(newUser);
                req.session.userId = newUser.id;
                return {
                    user: newUser,
                };
            }
            catch (err) {
                if (err.message.includes(`returning "id" - duplicate key value violates unique constraint "user_username_unique"`)) {
                    return {
                        error: [
                            {
                                field: "username",
                                message: "Provided email is already assosciated with another account.",
                            },
                        ],
                    };
                }
            }
        });
    }
    AllUsers({ em }) {
        return __awaiter(this, void 0, void 0, function* () {
            const users = yield em.find(Users_1.User, {});
            return users;
        });
    }
    login(options, { em, req }) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield em.findOne(Users_1.User, {
                username: options.username.toLowerCase(),
            });
            if (!user) {
                return {
                    error: [
                        {
                            field: "Username",
                            message: "Provided Username/Email couldn't be located in our Database.",
                        },
                    ],
                };
            }
            const isCorrectPassword = yield argon2_1.default.verify(user.password, options.password);
            if (!isCorrectPassword) {
                return {
                    error: [
                        {
                            field: "Password",
                            message: "The Provided Password isn't assosicated with the input email. Please Try Again.",
                        },
                    ],
                };
            }
            req.session.userId = user.id;
            return { user };
        });
    }
};
__decorate([
    type_graphql_1.Query(() => Users_1.User, { nullable: true }),
    __param(0, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "me", null);
__decorate([
    type_graphql_1.Mutation(() => AuthResponse),
    __param(0, type_graphql_1.Arg("options")),
    __param(1, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [EmailPasswordInput, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "RegisterUser", null);
__decorate([
    type_graphql_1.Query(() => [Users_1.User]),
    __param(0, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "AllUsers", null);
__decorate([
    type_graphql_1.Mutation(() => AuthResponse),
    __param(0, type_graphql_1.Arg("options")),
    __param(1, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [EmailPasswordInput, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "login", null);
UserResolver = __decorate([
    type_graphql_1.Resolver()
], UserResolver);
exports.UserResolver = UserResolver;
//# sourceMappingURL=UserResolver.js.map