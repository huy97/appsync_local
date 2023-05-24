import "dotenv/config";

import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { loadFilesSync } from "@graphql-tools/load-files";
import { mergeTypeDefs } from "@graphql-tools/merge";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga } from "graphql-yoga";
import { createServer } from "node:http";
import nodePath from "path";

import { awsApiKeyDirective, awsCognitoUserPoolDirective } from "./directives";
import { mergeResolvers } from "./resolvers";

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

export const createYogaServer = async (
  port: number,
  graphqlDir: string,
  lambdaDir: string,
  callback?: () => void
): Promise<any> => {
  const directiveFolder = nodePath.resolve(__dirname, "./graphql");
  const typesArray = loadFilesSync([graphqlDir, directiveFolder], {
    extensions: ["graphql"],
    recursive: true,
  });

  const typeDefs = mergeTypeDefs([...typesArray, directiveTypeDefs]);
  const resolvers = await mergeResolvers(lambdaDir);

  let schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  schema = awsApiKeyDirective("aws_api_key")(schema);
  schema = awsCognitoUserPoolDirective("aws_cognito_user_pools")(schema);

  const yoga = createYoga({
    schema,
  });

  const server = createServer(yoga);

  server.listen(
    port,
    callback
      ? callback
      : () => {
          console.info(`Server is running on http://localhost:${port}/graphql`);
        }
  );
};

export const createApolloServer = async (
  port: number,
  graphqlDir: string,
  lambdaDir: string,
  callback?: (url: string) => void
): Promise<any> => {
  const typesArray = loadFilesSync(graphqlDir, {
    extensions: ["graphql"],
    recursive: true,
  });

  const typeDefs = mergeTypeDefs([...typesArray, directiveTypeDefs]);
  const resolvers = await mergeResolvers(lambdaDir);

  let schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  schema = awsApiKeyDirective("aws_api_key")(schema);
  schema = awsCognitoUserPoolDirective("aws_cognito_user_pools")(schema);

  const server = new ApolloServer({
    schema,
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port },
    context: async ({ req }) => ({
      req,
    }),
  });

  callback ? callback(url) : console.info(`Server is running on ${url}`);
};
