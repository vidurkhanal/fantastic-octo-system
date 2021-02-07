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
  async RegisterUser(
    @Arg("options") options: EmailPasswordInput,
    @Ctx() { em, req }: MyContext
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
    const newUser = em.create(User, {
      username: options.username.toLowerCase(),
      password: hashedPassword,
    });

    try {
      await em.persistAndFlush(newUser);
      req.session.userId = newUser.id;
      return {
        user: newUser,
      };
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
}
