import { AppSyncResolverHandler } from "aws-lambda";

export const handler: AppSyncResolverHandler<
  string,
  string | undefined | null
> = async (event, _context) => {
  console.log("Event trace: ", event);
  try {
    return "Hello world!";
  } catch (error) {
    console.error(error);
    throw error;
  }
};
