import { MyContext } from "../types";
import {
  Resolver,
  Mutation,
  Ctx,
  Field,
  InputType,
  Arg,
  Query,
  ObjectType,
} from "type-graphql";
import { User } from "../entities/Users";
import argon2 from "argon2";
import EmailValidator from "email-validator";
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from "../constants";
import { sendEmail } from "../sendEmail";
import { v4 } from "uuid";
import { getConnection } from "typeorm";

@InputType()
class EmailPasswordInput {
  @Field()
  username: string;
  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class AuthResponse {
  @Field(() => [FieldError], { nullable: true })
  error?: [FieldError];
  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    if (!req.session.userId) {
      return null;
    }
    return User.findOne({ id: req.session.userId });
  }

  @Mutation(() => AuthResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis }: MyContext
  ): Promise<AuthResponse> {
    if (newPassword.length <= 5) {
      return {
        error: [
          {
            field: "newPassword",
            message:
              "Provided Password Is Too Short. Please Type A New Password",
          },
        ],
      };
    }

    const key = FORGOT_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);
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

    const ProvideId = parseInt(userId);
    const user = await User.findOne({ id: ProvideId });
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

    User.update(
      { id: ProvideId },
      { password: await argon2.hash(newPassword) }
    );
    await redis.del(key);

    return { user, error: undefined };
  }

  @Mutation(() => Boolean)
  async forgotPwd(@Arg("email") email: string, @Ctx() { redis }: MyContext) {
    const user = await User.findOne({ where: { username: email } });
    if (!user) {
      return true;
    }

    const token = v4();
    await redis.set(
      FORGOT_PASSWORD_PREFIX + token,
      user.id,
      "ex",
      1000 * 60 * 60 * 24 * 3
    );

    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}" target="_blank"> Reset your Password</a>`
    );

    return true;
  }

  @Mutation(() => AuthResponse)
  async RegisterUser(
    @Arg("options") options: EmailPasswordInput
  ): Promise<AuthResponse> {
    if (!EmailValidator.validate(options.username)) {
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
            message:
              "Provided Password Is Too Short. Please Type A New Password",
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(options.password);
    let user;

    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username: options.username,
          password: hashedPassword,
        })
        .returning("*")
        .execute();

      user = result.raw[0];
    } catch (err) {
      if (err.code === "23505") {
        return {
          error: [
            {
              field: "username",
              message: "username already taken",
            },
          ],
        };
      }
    }
    return {
      user,
      error: undefined,
    };
  }

  @Query(() => [User])
  async AllUsers() {
    return User.find();
  }

  @Mutation(() => AuthResponse)
  async login(
    @Arg("options") options: EmailPasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<AuthResponse> {
    const user = await User.findOne({
      where: {
        username: options.username.toLowerCase(),
      },
    });
    if (!user) {
      return {
        error: [
          {
            field: "Username",
            message:
              "Provided Username/Email couldn't be located in our Database.",
          },
        ],
      };
    }
    const isCorrectPassword = await argon2.verify(
      user.password,
      options.password
    );
    if (!isCorrectPassword) {
      return {
        error: [
          {
            field: "Password",
            message:
              "The Provided Password isn't assosicated with the input email. Please Try Again.",
          },
        ],
      };
    }

    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) => {
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          console.log(err.message);
          resolve(false);
          return;
        }

        resolve(true);
      });
    });
  }
}
