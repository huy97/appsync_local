import { GraphQLSchema, defaultFieldResolver, GraphQLError } from "graphql";
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";
import { CognitoJwtVerifier } from "aws-jwt-verify";

export function awsApiKeyDirective(
  directiveName: string
): (schema: GraphQLSchema) => GraphQLSchema {
  return (schema) =>
    mapSchema(schema, {
      [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
        const awsApiKeyDirective = getDirective(
          schema,
          fieldConfig,
          directiveName
        )?.[0];
        if (awsApiKeyDirective) {
          const { resolve = defaultFieldResolver } = fieldConfig;
          return {
            ...fieldConfig,
            resolve: function (source, args, context, info) {
              const { req } = context;
              const xApiKey = req?.headers["x-api-key"];

              if (!xApiKey) {
                throw new GraphQLError("Unauthorized", {
                  extensions: {},
                });
              }

              return resolve(source, args, context, info);
            },
          };
        }
      },
    });
}

export function awsCognitoUserPoolDirective(
  directiveName: string
): (schema: GraphQLSchema) => GraphQLSchema {
  return (schema) =>
    mapSchema(schema, {
      [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
        const awsCognitoUserPoolDirective = getDirective(
          schema,
          fieldConfig,
          directiveName
        )?.[0];
        if (awsCognitoUserPoolDirective) {
          const { resolve = defaultFieldResolver } = fieldConfig;
          return {
            ...fieldConfig,
            resolve: async function (source, args, context, info) {
              const { req } = context;

              const token = req?.headers["authorization"];

              if (!token) {
                throw new GraphQLError("Unauthorized", {
                  extensions: {},
                });
              }

              const verifier = CognitoJwtVerifier.create({
                userPoolId: process.env.USER_POOL_ID || "",
                clientId: process.env.USER_POOL_CLIENT_ID || "",
                tokenUse: "access",
              });

              const groups = awsCognitoUserPoolDirective?.cognito_groups || [];

              try {
                const decoded = await verifier.verify(token);

                context.identity = {
                  sub: decoded.sub,
                  username: decoded.username,
                  groups: decoded["cognito:groups"] || [],
                  claims: decoded,
                };

                if (groups.length > 0) {
                  if (
                    !decoded["cognito:groups"] ||
                    !groups.some((g: string) =>
                      decoded["cognito:groups"].includes(g)
                    )
                  ) {
                    throw new GraphQLError("Unauthorized", {
                      extensions: {},
                    });
                  }
                }
              } catch (error) {
                throw new GraphQLError("Unauthorized", {
                  extensions: {},
                });
              }

              return resolve(source, args, context, info);
            },
          };
        }
      },
    });
}
