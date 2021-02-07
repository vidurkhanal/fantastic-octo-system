import { MikroORM } from "@mikro-orm/core";
import mikroOrmConfig from "./mikro-orm.config";
import express from "express";
import { PORT, __prod__ } from "./constants";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/HelloResolver";
import { PostResolver } from "./resolvers/PostResolver";
import { UserResolver } from "./resolvers/UserResolver";
import redis from "redis";
import session from "express-session";
import connectRedis from "connect-redis";
import { MyContext } from "./types";
import cors from "cors";

const main = async () => {
  const orm = await MikroORM.init(mikroOrmConfig);
  await orm.getMigrator().up();

  const app = express();
  let RedisStore = connectRedis(session);
  let redisClient = redis.createClient();

  app.use(cors({ origin: "http://localhost:3000", credentials: true }));
  app.use(
    session({
      name: "braketid",
      store: new RedisStore({
        client: redisClient,
        disableTouch: true,
        disableTTL: true,
      }),
      saveUninitialized: true,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        sameSite: "lax",
        httpOnly: true, //CAN't BE ACCESSED BY FRONTEND
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
    context: ({ req, res }): MyContext => ({ em: orm.em, req, res }),
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
