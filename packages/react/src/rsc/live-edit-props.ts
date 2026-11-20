/** Props of `StoryblokStory` that can be sent to the client and back to the live edit action. */
export type LiveEditRenderProps = Record<string, string | number | boolean | null>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isRenderPropValue = (value: unknown): value is LiveEditRenderProps[string] =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

/** Keeps only primitive props, so nothing else can be passed to the rendered component. */
export const toLiveEditRenderProps = (props: unknown): LiveEditRenderProps => {
  const safe: LiveEditRenderProps = {};
  if (isRecord(props)) {
    for (const [key, value] of Object.entries(props)) {
      if (isRenderPropValue(value)) {
        safe[key] = value;
      }
    }
  }
  return safe;
};
