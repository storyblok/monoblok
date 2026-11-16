import { useState } from "react";

/**
 * The only observable proof that hydration happened: before hydration, the
 * buttons are inert HTML and clicking them does nothing. Once React attaches,
 * clicking "+" increments the counter. QA/e2e assert on the rendered count,
 * not on an internal flag, so the check exercises exactly what a user sees.
 */
export default function Counter({ block, testId }) {
  const [count, setCount] = useState(0);

  return (
    <div data-test={testId}>
      <button type="button" onClick={() => setCount((c) => c - 1)}>
        -
      </button>
      <pre data-test={`${testId}-count`}>{count}</pre>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        +
      </button>
      <div>{block.headline}</div>
    </div>
  );
}
