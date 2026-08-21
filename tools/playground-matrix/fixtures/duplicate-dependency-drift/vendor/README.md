# stale-sdk

Stands in for a dependency whose lockfile entry was written at an earlier point in time and never
moved. It pins `@storyblok/preview-bridge` at an exact 2.1.6 while the app asks for `^2.2.0`, so no
install can collapse the two.

It is depended on as a tarball rather than as a directory on purpose. A `file:` dependency pointing
at a directory is symlinked, and a package manager treats a link's own dependency tree differently
from a normal one: root `overrides` do not reach into it, which would make the override experiment
meaningless.

Regenerate after editing the source:

```sh
cd stale-sdk && npm pack --pack-destination ..
```
