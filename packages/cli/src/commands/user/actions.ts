import chalk from "chalk";
import { handleAPIError, maskToken } from "../../utils";
import { createMapiClient } from "../../api";
import type { RegionCode } from "../../constants";

export type { User } from "../../types";

export const getUser = async (token: string, region: RegionCode) => {
  try {
    const client = createMapiClient({
      personalAccessToken: token,
      region,
    });

    const { data } = await client.users.me({
      throwOnError: true,
    });

    return data?.user;
  } catch (error) {
    const status = (error as any)?.response?.status;
    const customMessage =
      status === 401
        ? `The token provided ${chalk.bold(maskToken(token))} is invalid.
        Please make sure you are using the correct token and try again.`
        : undefined;
    handleAPIError("get_user", error, customMessage);
  }
};
