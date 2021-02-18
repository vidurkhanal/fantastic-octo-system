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
import { EntityManager } from "@mikro-orm/postgresql";
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from "../constants";
import { sendEmail } from "../sendEmail";
import { v4 } from "uuid";

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
  async me(@Ctx() { em, req }: MyContext) {
    if (!req.session.userId) {
      return null;
    }
    const user = await em.findOne(User, { id: req.session.userId });
    return user;
  }

  @Mutation(() => AuthResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { em, redis }: MyContext
  ): Promise<AuthResponse> {
    if (newPassword.length < 5) {
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

    const userId = await redis.get(FORGOT_PASSWORD_PREFIX + token);
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

    const user = await em.findOne(User, { id: Number(userId) });
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

    user.password = await argon2.hash(newPassword);

    await em.persistAndFlush(user);

    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPwd(
    @Arg("email") email: string,
    @Ctx() { em, redis }: MyContext
  ) {
    const user = await em.findOne(User, { username: email });
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
    @Arg("options") options: EmailPasswordInput,
    @Ctx() { em }: MyContext
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
      const result = await (em as EntityManager)
        .createQueryBuilder(User)
        .getKnexQuery()
        .insert({
          username: options.username,
          password: hashedPassword,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning("*");
      user = result[0];
    } catch (err) {
      if (
        err.message.includes(
          `returning "id" - duplicate key value violates unique constraint "user_username_unique"`
        )
      ) {
        return {
          error: [
            {
              field: "username",
              message:
                "Provided email is already assosciated with another account.",
            },
          ],
        };
      }
    }
    return {
      user,
    };
  }

  @Query(() => [User])
  async AllUsers(@Ctx() { em }: MyContext) {
    const users = await em.find(User, {});
    return users;
  }

  @Mutation(() => AuthResponse)
  async login(
    @Arg("options") options: EmailPasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<AuthResponse> {
    const user = await em.findOne(User, {
      username: options.username.toLowerCase(),
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
