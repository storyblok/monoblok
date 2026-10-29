We define our content schema in code and change it regularly. Every time we rename a field, tighten
a field's allowed options or drop a component, we have no idea which of the stories already in our
space break until an editor stumbles over one, or a page fails in production. As a developer on a
team with a few thousand stories, I want to run a check from the command line that tells me which
stories no longer match the schema in my repository, before I ship the schema change. It should be
usable in CI and should be able to look at just one part of the content tree, since a full run on a
big space is slow.
