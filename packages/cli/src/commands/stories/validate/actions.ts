import { getMapiClient } from "../../../api";
import type { Component } from "../../../types";

export async function fetchRemoteComponents(spaceId: string): Promise<Component[]> {
  const { data } = await getMapiClient().components.list({
    path: { space_id: Number(spaceId) },
    throwOnError: true,
  });
  return data?.components ?? [];
}
