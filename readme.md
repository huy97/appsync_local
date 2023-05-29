# AWS AppSync GraphQL API Locally Mocking

## Introduction

- This project using GraphQL Yoga or Apollo Server to running AWS AppSync GraphQL API locally\
- Your project lambdas resolver must be following format `{typeName}/{fieldName}/index.(t|j)s`
- Lambda folder structure must be following:

```bash
├── lambdas
│   ├── Query
│   │   └── test
│   │       └── index.ts
└── server.ts
```

## Installation

```bash
npm install --save-dev appsync-dev-server
```

or

```bash
yarn add --dev appsync-dev-server
```

## Usage

```javascript
// Apollo Server
import path from "path";
import { createApolloServer } from "appsync-dev-server";

const lambdaFolder = path.resolve(__dirname, "lambdas");
const graphqlFolder = path.resolve(__dirname, "graphql");

createApolloServer({
  port: 4000,
  graphqlDir: graphqlFolder,
  lambdaDir: lambdaFolder,
});
```

or

```javascript
// GraphQL Yoga Server
import path from "path";
import { createYogaServer } from "appsync-dev-server";

const lambdaFolder = path.resolve(__dirname, "lambdas");
const graphqlFolder = path.resolve(__dirname, "graphql");

createYogaServer({
  port: 4000,
  graphqlDir: graphqlFolder,
  lambdaDir: lambdaFolder,
});
```

**Option props**

```javascript
interface ICreateServerProps {
  port?: number; // default 4000
  path?: string; // default /graphql
  graphqlDir: string; // graphql schema file folder, required if you don't use typeDefs
  lambdaDir: string; // lambda resolver file folder, required if you don't use resolvers
  resolvers?: any; // custom resolvers
  typeDefs?: any; // custom typeDefs
}
```

**Run with watch mode**

```bash
tsc-watch --onSuccess \"ts-node --project ./dist/tsconfig.json -r tsconfig-paths/register ./dist/server.js\"
```

### Path alias

If you want to use path alias, you can use `tsconfig-paths` to resolve it

```bash
npm install tsconfig-paths
```

then run server with `ts-node` and `tsconfig-paths/register`

```bash
ts-node --project examples/tsconfig.json -r tsconfig-paths/register examples/server.ts
```

### Directives supported

- @aws_api_key
- @aws_cognito_user_pools
- @aws_subscribe

### Environment variables

You can use environment variables in your lambda resolver by .env file

```javascript
USER_POOL_ID=
USER_POOL_CLIENT_ID=
...
```

## Example

- See example at [examples](./examples) folder

## Issues

- Project can't compatible with more than project structure, you can clone this project and modify it to fit your project structure
- If you have any issues, please create new issue and describe your problem

# Thank for using
