import { createQuerySerializer } from "@storyblok/utils/serialization";
import {
  serializeArrayParam,
  serializePrimitiveParam,
} from "../generated/capi/core/pathSerializer.gen";

export const querySerializer = createQuerySerializer({
  serializeArrayParam,
  serializePrimitiveParam,
});
