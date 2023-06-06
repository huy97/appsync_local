import path from "path";
import { createApolloServer } from "../src";

const lambdaFolder = path.resolve(__dirname, "lambdas");
const graphqlFolder = path.resolve(__dirname, "graphql");

createApolloServer({
  port: 4000,
  graphqlDir: graphqlFolder,
  lambdaDir: lambdaFolder,
});
