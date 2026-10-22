# Schema snapshots

One frozen schema per shape a migration reads or writes that `src/schema/schema.ts` does not have.

A migration is typed `defineMigration<After, Before>`. The schema the project actually has is
usually one of the two ends; the other end is a snapshot from here. A rename reads its source name
from `Before` and its target name from `After`, so a rename _into_ a field the current schema has
needs a `Before` snapshot, and a rename _out of_ one needs an `After` snapshot.

Each snapshot is scoped to the blocks its migration touches, not to the whole space, and is frozen
once the migration ships: moving it would make the migration read paths that did not exist when it
was written. A migration whose two ends genuinely agree needs no snapshot and uses the single-schema
shorthand `defineMigration<Schema>` instead.
