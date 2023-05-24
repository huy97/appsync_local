# AWS AppSync GraphQL API Local Mocking

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
npm install appsync-local
```

or

```bash
yarn add appsync-local
```

## Usage

```javascript
// Apollo Server
import { createApolloServer } from "appsync-local";

const lambdaFolder = path.resolve(__dirname, "lambdas");
const graphqlFolder = path.resolve(__dirname, "graphql");

createApolloServer(4000, graphqlFolder, lambdaFolder);
```

or

```javascript
// Apollo Server
import { createYogaServer } from "appsync-local";

const lambdaFolder = path.resolve(__dirname, "lambdas");
const graphqlFolder = path.resolve(__dirname, "graphql");

createYogaServer(4000, graphqlFolder, lambdaFolder);
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

### Environment variables

You can use environment variables in your lambda resolver by .env file

```javascript
USER_POOL_ID=
USER_POOL_CLIENT_ID=
```

## Example

- See example at [examples](./examples) folder

## Issues

- Project can't compatible with more than project structure, you can clone this project and modify it to fit your project structure
- If you have any issues, please create new issue and describe your problem

# Thank for using
