import { AppwriteException } from "appwrite";

export function isAppwriteNotFound(error: unknown) {
  return error instanceof AppwriteException && error.code === 404;
}

export function getAppwriteErrorMessage(error: unknown) {
  if (error instanceof AppwriteException) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
