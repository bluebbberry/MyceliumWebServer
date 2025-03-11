import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

// ==============================================================
// ========================= TYPES ==============================
// ==============================================================

// The structure of an ActivityPub message
type Activity = {
    "@context": string;
    type: string;
    actor: string;
    object?: any;
};

// ==================================================================
// ========================= CONSTANTS ==============================
// ==================================================================

// Received posts and followers
let receivedPosts: { text: string; actor: string }[] = [];
let receivedSporeActions: { text: string; actor: string }[] = [];
const followers = new Set<string>();

// Environment variables with defaults
const FUNGUS_ID = parseInt(process.env.FUNGUS_ID || "0", 10);
const NUM_OF_FUNGI = parseInt(process.env.NUM_OF_FUNGI || "1", 10);
const AP_BACKEND_PORT_START = parseInt(process.env.AP_BACKEND_PORT || "3000", 10);
const AP_BACKEND_NAME_START = process.env.AP_BACKEND_NAME || "server1";
const AP_BACKEND_PORT = AP_BACKEND_PORT_START + FUNGUS_ID;
const AP_BACKEND_NAME = AP_BACKEND_NAME_START + FUNGUS_ID;
const AP_BACKEND_DOMAIN = `http://${AP_BACKEND_NAME}:${AP_BACKEND_PORT}`;

// Peer server names and domains
let allApPeerServerNames: string[] = [];
let allApPeerServers: string[] = [];
for (let i = 0; i < NUM_OF_FUNGI; i++) {
    if (i !== FUNGUS_ID) {
        const name = AP_BACKEND_NAME_START + i;
        allApPeerServerNames.push(name);
        const backendPort = +AP_BACKEND_PORT_START + +i;
        console.log(`Peer server at: http://${name}:${backendPort}`);
        allApPeerServers.push(`http://${name}:${backendPort}`);
    }
}

// =======================================================
// =============== MAIN FUNCTIONALITY ====================
// =======================================================

const app = express();
app.use(bodyParser.json()); // Parse incoming JSON requests

// Endpoint to receive follow requests
app.post(`/users/${AP_BACKEND_NAME}/inbox`, async (req, res) => {

    const activity: Activity = req.body;

    console.log("Received activity:", JSON.stringify(activity, null, 2));  // Log the received activity

    if (activity.type === "Create" && activity.object) {
        console.log(`Received post: ${JSON.stringify(activity.object)}`);
        receivedPosts.push({text: activity.object.content, actor: activity.actor }); // Store received post
        if (activity.object.content.includes("#spore")) {
            console.log("Its a spore!");
            receivedSporeActions.push({text: activity.object.content, actor: activity.actor });
        }
        res.status(200).json({ message: "Post received" });
    } else if (activity.type === "Follow" && activity.object && activity.actor) {
        // Basic validation of the Follow activity
        const actor = activity.actor; // The user who is following
        const followedUser = activity.object; // The user being followed

        // Check if the user being followed matches the current server
        if (followedUser === `${AP_BACKEND_DOMAIN}/users/${AP_BACKEND_NAME}`) {
            followers.add(actor); // Add to followers set

            console.log(`${actor} is following ${followedUser}`);

            // Send an Accept activity
            const acceptActivity = createAcceptActivity(followedUser, activity);
            res.status(200).json(acceptActivity);
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } else {
        console.error("Invalid post activity:", JSON.stringify(activity, null, 2));
        res.status(400).json({ error: "Invalid post activity" });
    }
});

// Endpoint to view the list of followers (for testing)
app.get("/followers", (req, res) => {
    res.json(Array.from(followers));
});

// Endpoint to post a message
app.post("/statuses", async (req, res) => {
    const reqBody = req.body;
    await sendPostToPeerServer(reqBody["status"]);
    receivedPosts.push({ text: reqBody["status"], actor: reqBody["actor"] });
    res.status(200).json({ message: "Posted to activity pub server.", id: 0 });
});

// Endpoint to post a spore message
app.post("/spore-actions", async (req, res) => {
    const reqBody = req.body;
    await sendSporeActionToPeerServer(reqBody["status"]);
    res.status(200).json({ message: "Posted spore to activity pub server.", id: 0 });
});

// Endpoint to view received messages
app.get("/statuses", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'DELETE, PUT');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.json({ statuses: receivedPosts });
    receivedPosts = [];
});

// Endpoint to post a spore message
app.get("/spore-actions", async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'DELETE, PUT');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.json({ "spore-actions": receivedSporeActions });
    receivedSporeActions = [];
});

// Endpoint to view the current server user profile
app.get(`/users/${AP_BACKEND_NAME}`, (req, res) => {
    res.json({
        id: `${AP_BACKEND_DOMAIN}/users/${AP_BACKEND_NAME}`,
        type: "Person",
        name: `${AP_BACKEND_NAME} User`,
        summary: `A demo federated user for ${AP_BACKEND_NAME}.`,
    });
});

// Start the server
let server = app.listen(AP_BACKEND_PORT, () => {
    console.log(`Server running on ${AP_BACKEND_DOMAIN}`);
});

// Send a post (Create activity) to the peer server
const sendPostToPeerServer = async (content: string) => {
    const postActivity = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Create",
        actor: `${AP_BACKEND_DOMAIN}/users/${AP_BACKEND_NAME}`,
        object: {
            type: "Note",
            content: content,
        },
    };

    if (allApPeerServers) {
        for (let i = 0; i < allApPeerServers.length; i++) {
            const apPeerServer = allApPeerServers[i];
            const apPeerServerName = allApPeerServerNames[i];
            try {
                const response = await fetch(`${apPeerServer}/users/${apPeerServerName}/inbox`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(postActivity),
                });

                if (response.ok) {
                    console.log("Post sent to peer server successfully!");
                } else {
                    console.error("Error sending post:", response.statusText, " to ", `${apPeerServer}/users/${apPeerServerName}/inbox`);
                }
            } catch (error) {
                console.error("Failed to send post:", error, "to", `${apPeerServer}/users/${apPeerServerName}/inbox`);
            }
        }
    }
};

const sendSporeActionToPeerServer = async (content: string) => {
    sendPostToPeerServer(content + " #spore");
}

// Helper function to generate an 'Accept' activity
const createAcceptActivity = (actorUri: any, followActivity: any) => {
    return {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Accept",
        actor: actorUri,
        object: followActivity,
    };
};

const sendFollowRequestToAllPeerServers = async () => {
    if (!allApPeerServers || !allApPeerServerNames) {
        console.error("Peer server or peer server name not set. Cannot send follow request.");
        return false;
    }

    let succeeded = true;

    if (allApPeerServers) {
        for (let i = 0; i < allApPeerServers.length; i++) {
            const targetServerUrl = allApPeerServers[i]; // The server you are following
            const targetUser = allApPeerServerNames[i]; // The user you're trying to follow
            const actor = `${AP_BACKEND_DOMAIN}/users/${AP_BACKEND_NAME}`; // Your server as the actor (following)

            // Follow activity payload
            const followActivity = {
                "@context": "https://www.w3.org/ns/activitystreams",
                type: "Follow",
                actor: actor,
                object: `${targetServerUrl}/users/${targetUser}`,
            };

            try {
                const response = await fetch(`${targetServerUrl}/users/${targetUser}/inbox`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(followActivity),
                });

                if (response.ok) {
                    console.log("Follow request sent successfully!");
                    const responseData = await response.json();
                    console.log("Server's response:", responseData);
                    succeeded = succeeded && true;
                } else {
                    console.error("Error sending follow request:", response.statusText, "to", targetServerUrl);
                    succeeded = false;
                }
            } catch (error) {
                console.error("Failed to send follow request:", error, "to", targetServerUrl);
                succeeded = false;
            }
        }
    }

    return succeeded;
};

async function attemptFollowRequest() {
    try {
        const didSucceed = await sendFollowRequestToAllPeerServers();
        if (!didSucceed) {
            console.log("Follow request failed. Retrying in 20 seconds...");
            setTimeout(attemptFollowRequest, 20000);
        } else {
            console.log("Follow requests to peer servers succeeded.");
        }
    } catch (error) {
        console.error("Error during follow request:", error);
        console.log("Retrying in 20 seconds...");
        setTimeout(attemptFollowRequest, 20000);
    }
}

// Trigger the follow request
setTimeout(() => {
        attemptFollowRequest();
        sendPostToPeerServer("Hello, this is a post from " + AP_BACKEND_NAME);
    }, randomIntFromInterval(2000, 10000)
);

function randomIntFromInterval(min: number, max: number) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}
