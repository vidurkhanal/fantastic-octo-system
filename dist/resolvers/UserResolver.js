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
const constants_1 = require("../constants");
const sendEmail_1 = require("../sendEmail");
const uuid_1 = require("uuid");
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
    changePassword(token, newPassword, { em, redis }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (newPassword.length < 5) {
                return {
                    error: [
                        {
                            field: "Password",
                            message: "Provided Password Is Too Short. Please Type A New Password",
                        },
                    ],
                };
            }
            const userId = yield redis.get(constants_1.FORGOT_PASSWORD_PREFIX + token);
            if (!userId) {
                return {
                    error: [
                        {
                            field: "token",
                            message: "Token has been expired.",
                        },
                    ],
                };
            }
            const user = yield em.findOne(Users_1.User, { id: Number(userId) });
            if (!user) {
                return {
                    error: [
                        {
                            field: "token",
                            message: "Provided User doesn't exist.",
                        },
                    ],
                };
            }
            user.password = yield argon2_1.default.hash(newPassword);
            yield em.persistAndFlush(user);
            return { user };
        });
    }
    forgotPwd(email, { em, redis }) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield em.findOne(Users_1.User, { username: email });
            if (!user) {
                return true;
            }
            const token = uuid_1.v4();
            yield redis.set(constants_1.FORGOT_PASSWORD_PREFIX + token, user.id, "ex", 1000 * 60 * 60 * 24 * 3);
            yield sendEmail_1.sendEmail(email, `<a href="http://localhost:3000/change-password/${token}" target="_blank"> Reset your Password</a>`);
            return true;
        });
    }
    RegisterUser(options, { em }) {
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
            let user;
            try {
                const result = yield em
                    .createQueryBuilder(Users_1.User)
                    .getKnexQuery()
                    .insert({
                    username: options.username,
                    password: hashedPassword,
                    created_at: new Date(),
                    updated_at: new Date(),
                })
                    .returning("*");
                user = result[0];
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
            return {
                user,
            };
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
    logout({ req, res }) {
        return new Promise((resolve) => {
            req.session.destroy((err) => {
                res.clearCookie(constants_1.COOKIE_NAME);
                if (err) {
                    console.log(err.message);
                    resolve(false);
                    return;
                }
                resolve(true);
            });
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
    __param(0, type_graphql_1.Arg("token")),
    __param(1, type_graphql_1.Arg("newPassword")),
    __param(2, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "changePassword", null);
__decorate([
    type_graphql_1.Mutation(() => Boolean),
    __param(0, type_graphql_1.Arg("email")),
    __param(1, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "forgotPwd", null);
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
__decorate([
    type_graphql_1.Mutation(() => Boolean),
    __param(0, type_graphql_1.Ctx()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UserResolver.prototype, "logout", null);
UserResolver = __decorate([
    type_graphql_1.Resolver()
], UserResolver);
exports.UserResolver = UserResolver;
//# sourceMappingURL=UserResolver.js.map