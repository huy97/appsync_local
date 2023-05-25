import path from "path";
import { createApolloServer, createYogaServer } from "../src";

const lambdaFolder = path.resolve(__dirname, "lambdas");
const graphqlFolder = path.resolve(__dirname, "graphql");

// createYogaServer({
//   port: 4000,
//   graphqlDir: graphqlFolder,
//   lambdaDir: lambdaFolder,
// });

createApolloServer({
  port: 4000,
  graphqlDir: graphqlFolder,
  lambdaDir: lambdaFolder,
});
