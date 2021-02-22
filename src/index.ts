import "reflect-metadata";
import express from "express";
import { COOKIE_NAME, PORT, __prod__ } from "./constants";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/HelloResolver";
import { PostResolver } from "./resolvers/PostResolver";
import { UserResolver } from "./resolvers/UserResolver";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import { MyContext } from "./types";
import cors from "cors";
import { createConnection } from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/Users";

const main = async () => {
  const conn = await createConnection({
    type: "postgres",
    database: "lrddr2",
    username: "postgres",
    password: "postgres",
    logging: true,
    synchronize: true,
    entities: [Post, User],
  });

  const app = express();
  let RedisStore = connectRedis(session);
  let redis = new Redis();

  app.use(cors({ origin: "http://localhost:3000", credentials: true }));
  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        // @ts-ignore
        client: redis,
        disableTouch: true,
        disableTTL: true,
      }),
      saveUninitialized: true,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        sameSite: "lax",
        httpOnly: true, //CAN'T BE ACCESSED BY FRONTEND
        secure: __prod__, // NEEDS SECURED DOMAIN IN PROD
      },
      secret: "5dcf8b3fd3fff6d26ffee039f6890300",
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ req, res, redis }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  app.get("/", (_req, res) => {
    return res.send("HELLO WORLD");
  });

  app.listen(PORT, () => {
    console.log("Hello From Express Server");
  });
};

main().catch((err) => console.log(err.message));
