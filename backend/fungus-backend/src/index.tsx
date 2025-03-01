import { createFederation, exportJwk, generateCryptoKeyPair, importJwk, Follow, Person, Accept, MemoryKvStore, Activity } from '@fedify/fedify';
import { behindProxy } from 'x-forwarded-fetch';
import { serve } from '@hono/node-server';
import { type Context, type Recipient } from "@fedify/fedify";

const PORT = process.env.PORT || 3000;
const PEER_PORT = process.env.PEER_PORT || 3004;
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
    console.log("Received fetch request for actor:", identifier);
    try {
        const actor = new Person({
            id: ctx.getActorUri(identifier),
            name: SERVER_NAME,
            summary: "This is me!",
            preferredUsername: identifier,
            url: new URL("/", ctx.url),
            inbox: ctx.getInboxUri(identifier),
            publicKeys: (await ctx.getActorKeyPairs(identifier))
                .map(keyPair => keyPair.cryptographicKey),
        });
        return actor;
    } catch (error) {
        console.error(`[${SERVER_NAME}] Error retrieving actor data for ${identifier}:`, error);
        throw error;
    }
})
    .setKeyPairsDispatcher(async (ctx, identifier) => {
        try {
            const entry = await kv.get<{
                privateKey: JsonWebKey;
                publicKey: JsonWebKey;
            }>(["key"]);

            if (entry == null || entry.value == null) {
                console.log(`[${SERVER_NAME}] Generating new key pair...`);
                const { privateKey, publicKey } = await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
                await kv.set(["key"], {
                    privateKey: await exportJwk(privateKey),
                    publicKey: await exportJwk(publicKey),
                });
                return [{ privateKey, publicKey }];
            }

            const privateKey = await importJwk(entry.value.privateKey, "private");
            const publicKey = await importJwk(entry.value.publicKey, "public");
            return [{ privateKey, publicKey }];
        } catch (error) {
            console.error(`[${SERVER_NAME}] Error handling key pairs for ${identifier}:`, error);
            throw error;
        }
    });

// Listen for follow
federation.setInboxListeners("/users/{identifier}/inbox", "/inbox")
    .on(Follow, async (ctx, follow) => {
        console.log(`[${SERVER_NAME}] Received follow request:`, follow);
        try {
            if (!follow.id || !follow.actorId || !follow.objectId) {
                console.error(`[${SERVER_NAME}] Invalid follow request, missing necessary fields.`);
                return;
            }

            const parsed = ctx.parseUri(follow.objectId);
            if (!parsed || parsed.type !== "actor" || parsed.identifier !== SERVER_NAME) {
                console.error(`[${SERVER_NAME}] Invalid follow request, not for the current actor.`);
                return;
            }

            const follower = await follow.getActor(ctx);
            if (!follower) {
                console.error(`[${SERVER_NAME}] Failed to retrieve follower information.`);
                return;
            }

            console.log(`[${SERVER_NAME}] Accepted follow request from ${follower.id}`);

            await ctx.sendActivity(
                { identifier: parsed.identifier },
                follower,
                new Accept({ actor: follow.objectId, object: follow })
            );
        } catch (error) {
            console.error(`[${SERVER_NAME}] Error handling follow request:`, error);
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

federation.setFollowersDispatcher("/users/{identifier}/followers", async (ctx, identifier) => {
    console.log(`[${SERVER_NAME}] Fetching followers for ${identifier}`);

    try {
        if (identifier !== SERVER_NAME) {
            return null;
        }

        const followers = (await ctx.kv.get<string[]>(["followers"]))?.value || [];
        console.log(`[${SERVER_NAME}] Followers list:`, followers);

        return followers.map(followerId => new URL(followerId));
    } catch (error) {
        console.error(`[${SERVER_NAME}] Error fetching followers for ${identifier}:`, error);
        throw error;
    }
}).setFirstCursor(async (ctx, identifier) => {
    return "";  // Assumes beginning of the collection.
});

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
