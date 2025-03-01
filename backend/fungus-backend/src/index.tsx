import { createFederation, exportJwk, generateCryptoKeyPair, importJwk, Follow, Person, Accept, MemoryKvStore, Activity } from '@fedify/fedify';
import { behindProxy } from 'x-forwarded-fetch';
import { serve } from '@hono/node-server';
import { type Context, type Recipient } from "@fedify/fedify";

const PORT = process.env.PORT || 3000;
const SERVER_NAME = process.env.FEDIFY_SERVER_NAME || 'server1';
const DOMAIN = `http://${SERVER_NAME}:${PORT}`;
const PEER_SERVER = process.env.PEER_SERVER || null;
const PEER_SERVER_NAME = process.env.PEER_SERVER_NAME || null;
const kv = new MemoryKvStore();
const federation = createFederation({ kv });

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
  // if (identifier != SERVER_NAME) return [];  // Other than "me" is not found.
  const entry = await kv.get<{
    privateKey: JsonWebKey;
    publicKey: JsonWebKey;
  }>(["key"]);
  if (entry == null || entry.value == null) {
    console.log(`[${SERVER_NAME}] Generating new key pair...`);
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
    console.log(`[${SERVER_NAME}] Received follow request:`, follow);
    if (!follow.id || !follow.actorId || !follow.objectId) return;

    const parsed = ctx.parseUri(follow.objectId);
    if (!parsed || parsed.type !== "actor" || parsed.identifier !== SERVER_NAME) return;

    const follower = await follow.getActor(ctx);
    if (!follower) return;

    console.log(`[${SERVER_NAME}] Accepted follow request from ${follower.id}`);

    await ctx.sendActivity(
        { identifier: parsed.identifier },
        follower,
        new Accept({ actor: follow.objectId, object: follow })
    );
});

async function sendFollow(
    ctx: Context<void>,
    senderId: string
) {
    if (!PEER_SERVER) {
        console.error("No peer server specified");
        return;
    }

    const recipientUrl = new URL(`${PEER_SERVER}/users/${PEER_SERVER_NAME}`);
    const recipientInboxUrl = new URL(`${recipientUrl}/inbox`);
    const recipient: Recipient = { id: recipientUrl, inboxId: recipientInboxUrl } as Recipient;

    console.log(`[${SERVER_NAME}] Sending follow request to ${recipientUrl.href}`);

    const sender = { identifier: senderId };

    await ctx.sendActivity(
        sender, // that's actually the sender
        recipient,
        new Follow({
            id: new URL(`${DOMAIN}/${senderId}/follows/${SERVER_NAME}`),
            actor: ctx.getActorUri(senderId),
            object: new URL(recipientUrl.href),
        })
    );
}

federation.setFollowersDispatcher("/users/{identifier}/followers", async (ctx, identifier) => {
    console.log(`[${SERVER_NAME}] Fetching followers for ${identifier}`);

    if (identifier !== SERVER_NAME) {
        return null;  // Only handle requests for the current server
    }

    // Retrieve followers from an in-memory store (or replace with a database)
    const followers = (await ctx.kv.get<string[]>(["followers"]))?.value || [];

    console.log(`[${SERVER_NAME}] Followers list:`, followers);

    return followers.map(followerId => new URL(followerId));
}).setFirstCursor(async (ctx, identifier) => {
    // Let's assume that an empty string represents the beginning of the
    // collection:
    return "";  // Note that it's not `null`.
});

// Start server
serve({
    fetch: behindProxy(request => federation.fetch(request, { contextData: undefined })),
    port: PORT,
});

setTimeout(async function() {
    const ctx = federation.createContext(new Request(DOMAIN), undefined);
    await sendFollow(ctx, SERVER_NAME);
    console.log("Send follow request to other server");
}, 5000);

