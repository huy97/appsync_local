import "dotenv/config";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { loadFilesSync } from "@graphql-tools/load-files";
import { mergeTypeDefs } from "@graphql-tools/merge";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { json } from "body-parser";
import cors from "cors";
import express from "express";
import { PubSub } from "graphql-subscriptions";
import { useServer } from "graphql-ws/lib/use/ws";
import { createPubSub, createYoga } from "graphql-yoga";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

import { ServerType } from "./constants";
import {
  awsApiKeyDirective,
  awsCognitoUserPoolDirective,
  awsSubscribeDirective,
} from "./directives";
import { mergeResolvers } from "./resolvers";

export interface ICreateServerProps {
  port?: number;
  path?: string;
  graphqlDir?: string;
  lambdaDir?: string;
  resolvers?: any;
  typeDefs?: any;
}

const directiveTypeDefs = `
scalar AWSDate
scalar AWSTime
scalar AWSDateTime
scalar AWSTimestamp
scalar AWSEmail
scalar AWSJSON
scalar AWSURL
scalar AWSPhone
scalar AWSIPAddress

directive @aws_subscribe(mutations: [String!]!) on FIELD_DEFINITION

directive @deprecated(
  reason: String!
) on INPUT_FIELD_DEFINITION | FIELD_DEFINITION | ENUM

directive @aws_auth(cognito_groups: [String!]!) on FIELD_DEFINITION
directive @aws_api_key on FIELD_DEFINITION | OBJECT
directive @aws_iam on FIELD_DEFINITION | OBJECT
directive @aws_oidc on FIELD_DEFINITION | OBJECT
directive @aws_cognito_user_pools(
  cognito_groups: [String!]
) on FIELD_DEFINITION | OBJECT
`;

const subscribeList = [];

const wsServer = (httpServer, path?: string) =>
  new WebSocketServer({
    server: httpServer,
    path,
  });

const appliedDirectives = (schema) => {
  schema = awsApiKeyDirective("aws_api_key")(schema);
  schema = awsCognitoUserPoolDirective("aws_cognito_user_pools")(schema);
  schema = awsSubscribeDirective("aws_subscribe", subscribeList)(schema);
  return schema;
};

/**
 * Create an Yoga Server
 * @param props ICreateServerProps
 * @param callback
 */
export const createYogaServer = async (
  {
    port = 4000,
    path = "/graphql",
    graphqlDir,
    lambdaDir,
    resolvers,
    typeDefs,
  }: ICreateServerProps,
  callback?: () => void
): Promise<any> => {
  const typesArray = loadFilesSync(graphqlDir, {
    extensions: ["graphql"],
    recursive: true,
  });

  const pubSub = createPubSub();
  const _typeDefs =
    typeDefs || mergeTypeDefs([...typesArray, directiveTypeDefs]);
  const _resolvers =
    resolvers ||
    (await mergeResolvers(_typeDefs, lambdaDir, pubSub, ServerType.Yoga));

  let schema = makeExecutableSchema({
    typeDefs: _typeDefs,
    resolvers: _resolvers,
  });

  schema = appliedDirectives(schema);

  const yoga = createYoga({
    schema,
    graphiql: {
      subscriptionsProtocol: "WS",
    },
    context: async ({ request, params }) => ({
      req: request,
      params,
      pubSub,
      subscribeList,
    }),
    graphqlEndpoint: path,
  });

  const server = createServer(yoga);

  useServer(
    {
      execute: (args: any) => args.rootValue.execute(args),
      subscribe: (args: any) => args.rootValue.subscribe(args),
      onSubscribe: async (ctx, msg) => {
        const { schema, execute, subscribe, contextFactory, parse, validate } =
          yoga.getEnveloped({
            ...ctx,
            req: ctx.extra.request,
            socket: ctx.extra.socket,
            params: msg.payload,
          });

        const args = {
          schema,
          operationName: msg.payload.operationName,
          document: parse(msg.payload.query),
          variableValues: msg.payload.variables,
          contextValue: await contextFactory(),
          rootValue: {
            execute,
            subscribe,
          },
        };

        const errors = validate(args.schema, args.document);
        if (errors.length) return errors;
        return args;
      },
    },
    wsServer(server, yoga.graphqlEndpoint)
  );

  server.listen(
    port,
    callback
      ? callback
      : () => {
          console.info(`Server is running on http://localhost:${port}${path}`);
        }
  );
};

export const createApolloServer = async (
  {
    port = 4000,
    path = "/graphql",
    graphqlDir,
    lambdaDir,
    typeDefs,
    resolvers,
  }: ICreateServerProps,
  callback?: (url: string) => void
): Promise<any> => {
  const typesArray = loadFilesSync(graphqlDir, {
    extensions: ["graphql"],
    recursive: true,
  });

  const pubSub = new PubSub();
  const _typeDefs =
    typeDefs || mergeTypeDefs([...typesArray, directiveTypeDefs]);
  const _resolvers =
    resolvers ||
    (await mergeResolvers(_typeDefs, lambdaDir, pubSub, ServerType.Apollo));

  let schema = makeExecutableSchema({
    typeDefs: _typeDefs,
    resolvers: _resolvers,
  });

  schema = appliedDirectives(schema);

  const app = express();
  const httpServer = createServer(app);
  const serverCleanup = useServer({ schema }, wsServer(httpServer, path));

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();
  app.use(
    path,
    cors<cors.CorsRequest>(),
    json(),
    expressMiddleware(server, {
      context: async ({ req, res }) => ({
        req,
        res,
        pubSub,
        subscribeList,
      }),
    })
  );

  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));
  callback
    ? callback(`http://localhost:${port}${path}`)
    : console.log(`🚀 Server ready at http://localhost:${port}${path}`);
};
