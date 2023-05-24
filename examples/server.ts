import path from "path";
import { createApolloServer } from "../src";

const lambdaFolder = path.resolve(__dirname, "lambdas");
const graphqlFolder = path.resolve(__dirname, "graphql");

createApolloServer(4000, graphqlFolder, lambdaFolder);
