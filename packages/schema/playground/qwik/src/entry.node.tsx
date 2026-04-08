/**
 * Standalone Fastify server for Docker deployments.
 *
 * Wraps Qwik City's Connect-style middleware in a Fastify server via @fastify/middie.
 * Accepts PORT and STORYBLOK_PREVIEW_TOKEN as runtime env vars.
 */
import Fastify from 'fastify';
import middie from '@fastify/middie';
import { createQwikCity } from '@builder.io/qwik-city/middleware/node';
import qwikCityPlan from '@qwik-city-plan';
import render from './entry.ssr';

const { router, notFound, staticFile } = createQwikCity({ render, qwikCityPlan });

const app = Fastify({ logger: true });
await app.register(middie);
app.use(staticFile);
app.use(router);
app.use(notFound);

await app.listen({ port: Number.parseInt(process.env.PORT || '3000'), host: '0.0.0.0' });
