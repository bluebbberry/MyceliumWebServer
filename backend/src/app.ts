import express from "express";
import { integrateFederation } from "@fedify/express";
import { serve } from '@hono/node-server';
import { behindProxy } from 'x-forwarded-fetch';
import {
    Accept,
    createFederation,
    Endpoints,
    Follow,
    generateCryptoKeyPair,
    MemoryKvStore,
    Person,
    Undo,
    type Recipient, type Context
} from "@fedify/fedify";
import { configure, getConsoleSink } from "@logtape/logtape";

// ENV VARIABLES
const PORT = process.env.PORT || 3000;
const PEER_PORT = process.env.PEER_PORT || 3004;
const SERVER_NAME = process.env.FEDIFY_SERVER_NAME || 'server1';
const DOMAIN = `http://${SERVER_NAME}:${PORT}`;
const PEER_SERVER = process.env.PEER_SERVER || null;
const PEER_SERVER_NAME = process.env.PEER_SERVER_NAME || null;

const keyPairsStore = new Map<string, Array<CryptoKeyPair>>();
const relationStore = new Map<string, string>();

// Logging settings for diagnostics:
await configure({
  sinks: { console: getConsoleSink() },
  filters: {},
  loggers: [
    {
      category: "fedify",
      lowestLevel: "debug",
      sinks: ["console"],
      filters: [],
    },
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: ["console"],
      filters: [],
    },
  ],
});

const federation = createFederation<void>({
  kv: new MemoryKvStore(),
});

federation
  .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    if (identifier != SERVER_NAME) {
      return null;
    }
    const keyPairs = await ctx.getActorKeyPairs(identifier);
    return new Person({
      id: ctx.getActorUri(identifier),
      name: SERVER_NAME,
      summary: "This is a Fungus account",
      preferredUsername: identifier,
      url: new URL("/", ctx.url),
      inbox: ctx.getInboxUri(identifier),
      endpoints: new Endpoints({
        sharedInbox: ctx.getInboxUri(),
      }),
      publicKey: keyPairs[0].cryptographicKey,
      assertionMethods: keyPairs.map((keyPair) => keyPair.multikey),
    });
  })
  .setKeyPairsDispatcher(async (_, identifier) => {
    if (identifier != SERVER_NAME) {
      return [];
    }
    const keyPairs = keyPairsStore.get(identifier);
    if (keyPairs) {
      return keyPairs;
    }
    const { privateKey, publicKey } = await generateCryptoKeyPair();
    keyPairsStore.set(identifier, [{ privateKey, publicKey }]);
    return [{ privateKey, publicKey }];
  });

federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Follow, async (context, follow) => {
    if (
      follow.id == null ||
      follow.actorId == null ||
      follow.objectId == null
    ) {
      return;
    }
    const result = context.parseUri(follow.objectId);
    if (result?.type !== "actor" || result.identifier !== SERVER_NAME) {
      return;
    }
    const follower = await follow.getActor(context);
    if (follower?.id == null) {
      throw new Error("follower is null");
    }
    await context.sendActivity(
      { identifier: result.identifier },
      follower,
      new Accept({
        id: new URL(
          `#accepts/${follower.id.href}`,
          context.getActorUri(SERVER_NAME),
        ),
        actor: follow.objectId,
        object: follow,
      }),
    );
    relationStore.set(follower.id.href, follow.objectId.href);
  })
  .on(Undo, async (context, undo) => {
    const activity = await undo.getObject(context);
    if (activity instanceof Follow) {
      if (activity.id == null) {
        return;
      }
      if (undo.actorId == null) {
        return;
      }
      relationStore.delete(undo.actorId.href);
    } else {
      console.debug(undo);
    }
  });

async function sendFollow(ctx: Context<void>, senderId: string) {
    if (!PEER_SERVER) {
        console.error("No peer server specified");
        return;
    }

    try {
        const recipientUrl = new URL(`${PEER_SERVER}/users/${PEER_SERVER_NAME}`);
        const recipientInboxUrl = new URL(`${PEER_SERVER}/users/${PEER_SERVER_NAME}/inbox`);
        const recipient: Recipient = { id: recipientUrl, inboxId: recipientInboxUrl } as Recipient;

        console.log(`[${SERVER_NAME}] Sending follow request to ${recipientUrl.href}`);

        const sender = { identifier: senderId };

        await ctx.sendActivity(
            sender,
            recipient,
            new Follow({
                id: new URL(`${PEER_SERVER}/${senderId}/follows/${PEER_SERVER_NAME}`),
                actor: ctx.getActorUri(senderId),
                object: new URL(recipientUrl.href),
            })
        );

        console.log(`[${SERVER_NAME}] Follow request sent successfully.`);
    } catch (error) {
        console.error(`[${SERVER_NAME}] Error sending follow request:`, error);
    }
}

// Since the blog does not follow anyone, the following dispatcher is
// implemented to return just an empty list:
federation.setFollowingDispatcher(
    "/users/{identifier}/following",
    async (_ctx, identifier, _cursor) => {
        console.log(`[${SERVER_NAME}] Fetching followers for ${identifier}`);
        return { items: [] };
    },
);

// Start server
serve({
    fetch: behindProxy(request => federation.fetch(request, { contextData: undefined })),
    port: PORT,
});

setTimeout(async function() {
    try {
        const ctx = federation.createContext(new Request(DOMAIN), undefined);
        await sendFollow(ctx, SERVER_NAME);
        console.log("Send follow request to other server");
    } catch (error) {
        console.error(`[${SERVER_NAME}] Error sending initial follow request:`, error);
    }
}, 5000);
