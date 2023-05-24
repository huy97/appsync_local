import { AppSyncIdentity, AppSyncResolverEvent } from "aws-lambda";
import chalk from "chalk";
import glob from "glob";
import { GraphQLError } from "graphql";
import path from "path";

import { ResolverTypeName } from "./constants";
import { logger } from "./logger";

export const mergeResolvers = async (
  lambdaDir: string,
  globPattern?: string
): Promise<any> => {
  const files = glob.sync(
    globPattern || "+(Query|Mutation|Subscription|Type)/**/index.+(t|j)s",
    {
      cwd: lambdaDir,
    }
  );

  const queriesResolvers: any = {};
  const mutationsResolvers: any = {};
  const subscriptionsResolvers: any = {};
  const typeResolvers: any = {};

  await Promise.all(
    files.map(async (file) => {
      const fileName = path.join(lambdaDir, file);
      const [type, definition, customTypeName] = file.split("/");

      const { handler } = await import(fileName);

      logger.log(chalk.green(`Initialized api ${type} ${definition}`));

      const execHandler = preHandlerFunction(handler, type, definition);

      switch (type) {
        case ResolverTypeName.Query:
          queriesResolvers[definition] = execHandler;
          break;
        case ResolverTypeName.Mutation:
          mutationsResolvers[definition] = execHandler;
          break;
        case ResolverTypeName.Subscription:
          subscriptionsResolvers[definition] = execHandler;
          break;
        case ResolverTypeName.Type:
          typeResolvers[definition] = {
            ...typeResolvers[definition],
            [customTypeName]: execHandler,
          };
          break;
        default:
          break;
      }
    })
  );

  let resolvers: any = {};

  if (Object.keys(queriesResolvers).length) {
    resolvers[ResolverTypeName.Query] = queriesResolvers;
  }

  if (Object.keys(mutationsResolvers).length) {
    resolvers[ResolverTypeName.Mutation] = mutationsResolvers;
  }

  if (Object.keys(subscriptionsResolvers).length) {
    resolvers[ResolverTypeName.Subscription] = subscriptionsResolvers;
  }

  if (Object.keys(typeResolvers).length) {
    resolvers = {
      ...resolvers,
      ...typeResolvers,
    };
  }

  return resolvers;
};

const preHandlerFunction = (
  handler: any,
  type: string,
  definition: string
): any => {
  return async (..._args: any) => {
    const [parent, args, context] = _args;
    try {
      const { req, identity, params } = context;

      const event: AppSyncResolverEvent<typeof args, typeof parent> = {
        arguments: args,
        source: parent,
        request: req,
        info: {
          ...params,
          selectionSetList: [],
          selectionSetGraphQL: "",
          fieldName: params?.fieldName || definition,
          parentTypeName: params?.parentTypeName || type,
        },
        identity: identity as AppSyncIdentity,
        prev: null,
        stash: {},
      };

      return handler(event, context, () => true);
    } catch (e: any) {
      throw new GraphQLError(e.message);
    }
  };
};
