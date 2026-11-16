import PropagatingBlock from "./PropagatingBlock.astro";

// Astro flags a block that renders a content entry `in-tree` from its import
// graph. The test container has no import graph, so it's flagged here.
Reflect.set(PropagatingBlock, "propagation", "in-tree");

export { PropagatingBlock };
