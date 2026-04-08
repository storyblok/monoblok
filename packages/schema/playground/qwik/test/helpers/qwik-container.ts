import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GenericContainer, Wait } from 'testcontainers';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Build context is the monorepo root so workspace packages are resolvable
const MONOREPO_ROOT = resolve(__dirname, '../../../../../../');
const DOCKERFILE_PATH = 'packages/schema/playground/qwik/Dockerfile';

let builtImage: GenericContainer | undefined;

async function getOrBuildImage(): Promise<GenericContainer> {
  if (!builtImage) {
    builtImage = await GenericContainer
      .fromDockerfile(MONOREPO_ROOT, DOCKERFILE_PATH)
      .withCache(true)
      .build('qwik-e2e', { deleteOnExit: false });
  }
  return builtImage;
}

export async function startQwikContainer(previewToken: string) {
  const image = await getOrBuildImage();

  const container = await image
    .withEnvironment({ STORYBLOK_PREVIEW_TOKEN: previewToken, PORT: '3000' })
    .withExposedPorts(3000)
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  return container;
}
