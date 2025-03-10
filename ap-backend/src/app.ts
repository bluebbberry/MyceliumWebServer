import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json()); // Parse incoming JSON requests

let receivedPosts: any[] = []; // Store received posts

let FUNGUS_ID: any = process.env.FUNGUS_ID
if (!FUNGUS_ID) {
    console.error("No FUNGI ID env var defined");
    FUNGUS_ID = 0;
}
const NUM_OF_FUNGI: any = process.env.NUM_OF_FUNGI;
const AP_BACKEND_PORT_START: number = parseInt((process.env.AP_BACKEND_PORT) || "3000");
const AP_BACKEND_NAME_START: string = process.env.AP_BACKEND_NAME || 'server1';
const AP_BACKEND_PORT: number = AP_BACKEND_PORT_START + parseInt(FUNGUS_ID);
const AP_BACKEND_NAME = AP_BACKEND_NAME_START + "" + FUNGUS_ID;
const AP_BACKEND_DOMAIN = `http://${AP_BACKEND_NAME}:${AP_BACKEND_PORT}`;

function toApBackendPeerNames(apBackendNameStart: string, fungiId: number, numOfFungi: number) {
    const result = [];
    for (let fungiNameSuffix = 0; fungiNameSuffix < numOfFungi; fungiNameSuffix++) {
        if (fungiNameSuffix != fungiId) {
            result.push(apBackendNameStart + "" + fungiNameSuffix);
        }
    }
    return result;
}

function toApBackendDomains(apBackendNameStart: string, apBackendPortStart: number, fungiId: number, numOfFungi: number) {
    const result = [];
    for (let i: number = 0; i < numOfFungi; i++) {
        if (i != fungiId) {
            const name: string = apBackendNameStart + "" + i;
            const backendPort: number = apBackendPortStart + i;
            result.push("http://" + name + ":" + backendPort);
        }
    }
    return result;
}

const apPeerServerNames = toApBackendPeerNames(AP_BACKEND_NAME_START, FUNGUS_ID, NUM_OF_FUNGI) || null;
const apPeerServers = toApBackendDomains(AP_BACKEND_NAME_START, AP_BACKEND_PORT_START, FUNGUS_ID, NUM_OF_FUNGI) || null;

const followers = new Set(); // Store the followers

// Helper function to generate an 'Accept' activity
const createAcceptActivity = (actorUri: any, followActivity: any) => {
    return {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Accept",
        actor: actorUri,
        object: followActivity,
    };
};

app.post("/statuses", async (req, res) => {
    const reqBody = req.body;
    await sendPostToPeerServer(reqBody["status"]);
    receivedPosts.push({ text: reqBody["status"], actor: reqBody["actor"] });
    res.status(200).json({ message: "Posted to activity pub server.", id: 0 });
});

// Endpoint to receive follow requests
app.post(`/users/${AP_BACKEND_NAME}/inbox`, async (req, res) => {

    const activity = req.body;

    console.log("Received activity:", JSON.stringify(activity, null, 2));  // Log the received activity

    if (activity.type === "Create" && activity.object) {
        console.log(`Received post: ${JSON.stringify(activity.object)}`);
        receivedPosts.push({text: activity.object.content, actor: activity.actor }); // Store received post
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

app.get("/statuses", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'DELETE, PUT');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.json({ statuses: receivedPosts });
    receivedPosts = [];
    res.sendStatus(200);
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

app.listen(AP_BACKEND_PORT, () => {
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

    if (apPeerServers) {
        for (let i = 0; i < apPeerServers.length; i++) {
            const apPeerServer = apPeerServers[i];
            const apPeerServerName = apPeerServerNames[i];
            try {
                const response = await fetch(`${apPeerServer}/users/${apPeerServerNames}/inbox`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(postActivity),
                });

                if (response.ok) {
                    console.log("Post sent to peer server successfully!");
                } else {
                    console.error("Error sending post:", response.statusText);
                }
            } catch (error) {
                console.error("Failed to send post:", error);
            }
        }
    }
};

const sendFollowRequest = async () => {
    if (!apPeerServers || !apPeerServerNames) {
        console.error("Peer server or peer server name not set. Cannot send follow request.");
        return;
    }

    if (apPeerServers) {
        for (let i = 0; i < apPeerServers.length; i++) {
            const targetServerUrl = apPeerServers[i]; // The server you are following
            const targetUser = apPeerServerNames[i]; // The user you're trying to follow
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
                } else {
                    console.error("Error sending follow request:", response.statusText);
                }
            } catch (error) {
                console.error("Failed to send follow request:", error);
            }
        }
    }
};

// Trigger the follow request
setTimeout(
    function() {
        sendFollowRequest();
        sendPostToPeerServer("Hello, this is a post from " + AP_BACKEND_NAME);
    }, randomIntFromInterval(1000, 5000));

function randomIntFromInterval(min: number, max: number) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}
