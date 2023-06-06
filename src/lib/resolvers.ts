/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppSyncIdentity, AppSyncResolverEvent } from "aws-lambda";
import chalk from "chalk";
import glob from "glob";
import { GraphQLError } from "graphql";
import { fieldsList } from "graphql-fields-list";
import path from "path";

import { ResolverTypeName, ServerType } from "./constants";
import { logger } from "./logger";

/**
 * A function that merges resolvers from multiple files into a single resolver object.
 *
 * @async
 * @param {any} typeDefs - The type definitions for the resolvers.
 * @param {string} lambdaDir - The directory containing the resolver files.
 * @param {any} pubSub - The PubSub instance to use for subscriptions.
 * @param {ServerType} serverType - The type of server being used.
 * @param {string} [globPattern] - An optional glob pattern to filter the resolver files.
 * @returns {Promise<object>} - A promise that resolves with the merged resolver object.
 */
export const mergeResolvers = async (
  typeDefs: any,
  lambdaDir: string,
  pubSub: any,
  serverType: ServerType,
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

  const subscriptionFields =
    typeDefs.definitions.find(
      (d) => d.name.value === ResolverTypeName.Subscription
    )?.fields || [];

  subscriptionFields.forEach((field) => {
    const typeName = field.name.value;

    let subscribe;
    if (serverType === ServerType.Apollo) {
      subscribe = () => pubSub.asyncIterator(typeName);
    } else {
      subscribe = () => pubSub.subscribe(typeName);
    }

    subscriptionsResolvers[typeName] = {
      subscribe,
      resolve: (payload) => payload,
    };
  });

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
          subscriptionsResolvers[definition] = {
            ...subscriptionsResolvers[definition],
            resolve: execHandler,
          };
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

/**
A function that prepares a handler function for use in a specific context.
@param {any} handler - The handler function to be prepared.
@param {string} type - The type of the handler function.
@param {string} definition - The definition of the handler function.
@returns {Promise<function>}
*/
const preHandlerFunction = (
  handler: any,
  type: string,
  definition: string
): any => {
  return async (..._args: any) => {
    const [parent, args, context, info] = _args;
    try {
      const { req, identity, params, pubSub, subscribeList = [] } = context;

      const event: AppSyncResolverEvent<typeof args, typeof parent> = {
        arguments: args,
        source: parent,
        request: req,
        info: {
          selectionSetList: fieldsList(info),
          selectionSetGraphQL: params?.query || "",
          fieldName: params?.fieldName || info?.fieldName || definition,
          parentTypeName:
            params?.parentTypeName || info?.parentType?.name || type,
          variables: info?.variableValues || {},
        },
        identity: identity as AppSyncIdentity,
        prev: null,
        stash: {},
      };

      if (
        type === ResolverTypeName.Mutation &&
        subscribeList.includes(definition) &&
        pubSub
      ) {
        const result = await handler(event, context, () => true);
        pubSub.publish(definition, result);
        return result;
      }

      return handler(event, context, () => true);
    } catch (e: any) {
      throw new GraphQLError(e.message);
    }
  };
};
