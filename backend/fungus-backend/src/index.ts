import { behindProxy } from "@hongminhee/x-forwarded-fetch";
import { createFederation, MemoryKvStore, Person, Activity } from '@fedify/fedify';
import { serve } from '@hono/node-server';

const PORT = process.env.PORT || 3000;
const SERVER_NAME = process.env.FEDIFY_SERVER_NAME || 'server1';
const DOMAIN = `http://${SERVER_NAME}:${PORT}`;
const PEER_SERVER = process.env.PEER_SERVER || null;

const federation = createFederation({ kv: new MemoryKvStore() });

const userId = `${DOMAIN}/users/${SERVER_NAME}`;
console.log(`[${SERVER_NAME}] Creating Person with ID: ${userId}`);

// Define users
const user = new Person({
    id: new URL(userId),
    name: SERVER_NAME,
    preferredUsername: SERVER_NAME,
    inbox: new URL(`${DOMAIN}/users/${SERVER_NAME}/inbox`),
    outbox: new URL(`${DOMAIN}/users/${SERVER_NAME}/outbox`),
});

// Actor Dispatcher
federation.setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    console.log("received fetch request");
  if (identifier !== SERVER_NAME) return null;  // Other than "me" is not found.
  return new Person({
    id: ctx.getActorUri(identifier),
    name: SERVER_NAME,  // Display name
    summary: "This is me!",  // Bio
    preferredUsername: identifier,  // Bare handle
    url: new URL("/", ctx.url),
  });
});

// Start server
serve({
    fetch: (request) => { behindProxy(request => federation.fetch(request, { contextData : undefined })) },
    port: PORT,
});
