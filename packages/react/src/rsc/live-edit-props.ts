/** Props of `StoryblokStory` that can be sent to the client and back to the live edit action. */
export type LiveEditRenderProps = Record<string, string | number | boolean | null>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isRenderPropValue = (value: unknown): value is LiveEditRenderProps[string] =>
  value === null
  || typeof value === 'string'
  || typeof value === 'number'
  || typeof value === 'boolean';

/** React reserves these: spreading them into JSX doesn't pass them as props, and a `ref` throws on the server. */
const RESERVED_PROPS = new Set(['key', 'ref']);

/** Keeps only primitive props, so nothing else can be passed to the rendered component. */
export const toLiveEditRenderProps = (props: unknown): LiveEditRenderProps => {
  const safe: LiveEditRenderProps = {};
  if (isRecord(props)) {
    for (const [key, value] of Object.entries(props)) {
      if (!RESERVED_PROPS.has(key) && isRenderPropValue(value)) {
        safe[key] = value;
      }
    }
  }
  return safe;
};

/** Names of the props `toLiveEditRenderProps` leaves out, apart from `key` and `ref`. */
export const getOmittedRenderPropNames = (props: Record<string, unknown>): string[] =>
  Object.entries(props)
    .filter(([key, value]) => !RESERVED_PROPS.has(key) && !isRenderPropValue(value))
    .map(([key]) => key);
