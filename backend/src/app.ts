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

// Setting up actor and key pairs dispatchers
federation
    .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
        if (identifier !== SERVER_NAME) {
            return null;
        }
        try {
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
        } catch (error) {
            console.error(`[${SERVER_NAME}] Error fetching actor: ${identifier}`, error);
            throw new Error(`Error fetching actor: ${identifier}`);
        }
    })
    .setKeyPairsDispatcher(async (_, identifier) => {
        if (identifier !== SERVER_NAME) {
            return [];
        }
        try {
            let keyPairs = keyPairsStore.get(identifier);
            if (!keyPairs) {
                const { privateKey, publicKey } = await generateCryptoKeyPair();
                keyPairs = [{ privateKey, publicKey }];
                keyPairsStore.set(identifier, keyPairs);
            }
            return keyPairs;
        } catch (error) {
            console.error(`[${SERVER_NAME}] Error fetching key pairs for ${identifier}`, error);
            throw new Error(`Error fetching key pairs for ${identifier}`);
        }
    });

// Set up the federation inbox listeners
federation
    .setInboxListeners("/users/{identifier}/inbox", "/inbox")
    .on(Follow, async (context, follow) => {
        if (!follow.id || !follow.actorId || !follow.objectId) {
            console.warn(`[${SERVER_NAME}] Invalid Follow object received`, follow);
            return;
        }
        const result = context.parseUri(follow.objectId);
        if (result?.type !== "actor" || result.identifier !== SERVER_NAME) {
            return;
        }
        try {
            const follower = await follow.getActor(context);
            if (!follower?.id) {
                throw new Error("Follower is null");
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
            console.info(`[${SERVER_NAME}] Accepted follow request from ${follower.id.href}`);
        } catch (error) {
            console.error(`[${SERVER_NAME}] Error processing follow activity: ${follow.id}`, error);
        }
    })
    .on(Undo, async (context, undo) => {
        try {
            const activity = await undo.getObject(context);
            if (activity instanceof Follow && activity.id) {
                relationStore.delete(undo.actorId.href);
                console.info(`[${SERVER_NAME}] Follow request undone for ${undo.actorId.href}`);
            } else {
                console.debug(`[${SERVER_NAME}] Undo activity:`, undo);
            }
        } catch (error) {
            console.error(`[${SERVER_NAME}] Error processing undo activity: ${undo.id}`, error);
        }
    });

// Function to send a follow request to the peer server
async function sendFollow(ctx: Context<void>, senderId: string) {
    if (!PEER_SERVER) {
        console.error(`[${SERVER_NAME}] No peer server specified`);
        return;
    }

    try {
        const recipientUrl = new URL(`${PEER_SERVER}/users/${PEER_SERVER_NAME}`);
        const recipientInboxUrl = new URL(`${PEER_SERVER}/users/${PEER_SERVER_NAME}/inbox`);
        const recipient: Recipient = { id: recipientUrl, inboxId: recipientInboxUrl } as Recipient;

        console.info(`[${SERVER_NAME}] Sending follow request to ${recipientUrl.href}`);

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

        console.info(`[${SERVER_NAME}] Follow request sent successfully.`);
    } catch (error) {
        console.error(`[${SERVER_NAME}] Error sending follow request to ${PEER_SERVER}`, error);
    }
}

// Dispatcher for following requests
federation.setFollowingDispatcher(
    "/users/{identifier}/following",
    async (_ctx, identifier, _cursor) => {
        try {
            console.info(`[${SERVER_NAME}] Fetching following for ${identifier}`);
            return { items: [] };
        } catch (error) {
            console.error(`[${SERVER_NAME}] Error fetching following for ${identifier}`, error);
            return { items: [] }; // Return empty array in case of error
        }
    },
);

// Start the server
serve({
    fetch: behindProxy(request => federation.fetch(request, { contextData: undefined })),
    port: PORT,
});

setTimeout(async function () {
    try {
        const ctx = federation.createContext(new Request(DOMAIN), undefined);
        await sendFollow(ctx, SERVER_NAME);
        console.info("Send follow request to the other server");
    } catch (error) {
        console.error(`[${SERVER_NAME}] Error sending initial follow request:`, error);
    }
}, 5000);
