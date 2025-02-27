import { createFederation, exportJwk, generateCryptoKeyPair, importJwk, Follow, Person, MemoryKvStore, Activity } from '@fedify/fedify';
import { behindProxy } from 'x-forwarded-fetch';
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
    inbox: ctx.getInboxUri(identifier),  // Inbox URI
    publicKeys: (await ctx.getActorKeyPairs(identifier))
        .map(keyPair => keyPair.cryptographicKey),
  });
})
.setKeyPairsDispatcher(async (ctx, identifier) => {
  if (identifier != SERVER_NAME) return [];  // Other than "me" is not found.
  const entry = await kv.get<{
    privateKey: JsonWebKey;
    publicKey: JsonWebKey;
  }>(["key"]);
  if (entry == null || entry.value == null) {
    // Generate a new key pair at the first time:
    const { privateKey, publicKey } =
      await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
    // Store the generated key pair to the Deno KV database in JWK format:
    await kv.set(
      ["key"],
      {
        privateKey: await exportJwk(privateKey),
        publicKey: await exportJwk(publicKey),
      }
    );
    return [{ privateKey, publicKey }];
  }
  // Load the key pair from the Deno KV database:
  const privateKey = await importJwk(entry.value.privateKey, "private");
  const publicKey =  await importJwk(entry.value.publicKey, "public");
  return [{ privateKey, publicKey }];
});

// Listen for follow
federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.id == null || follow.actorId == null || follow.objectId == null) {
      return;
    }
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor" || parsed.identifier !== SERVER_NAME) return;
    const follower = await follow.getActor(ctx);
    console.debug(follower);
  });

// Start server
serve({
    fetch: (request) => { behindProxy(request => federation.fetch(request, { contextData : undefined })) },
    port: PORT,
});
