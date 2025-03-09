import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json()); // Parse incoming JSON requests

let receivedPosts: any[] = []; // Store received posts

const fetchFungiInfo = async () => {
    const response = await fetch('http://' + process.env.FUNGI_SERVER_NAME + ':' + process.env.FUNGI_SERVER_PORT + '/info', { method: "GET" });
    const data: any = await response.json();

    const peerServerPort = data["info"]["PEER_SERVER_PORT"];
    const peerServerName = data["info"]["PEER_SERVER_NAME"];

    console.log("Received server information: http://" + peerServerName + ":" + peerServerPort);

    return [ peerServerPort, peerServerName ];
}

const PORT = process.env.PORT || 3000;
const SERVER_NAME = process.env.FEDIFY_SERVER_NAME || 'server1';
const DOMAIN = `http://${SERVER_NAME}:${PORT}`;
let [ peerServerPort, peerServerName ] = await fetchFungiInfo();
const PEER_SERVER = "http://" + peerServerName + ":" + peerServerPort || null;
const PEER_SERVER_NAME = peerServerName || null;
const followers = new Set(); // Store the followers

// Helper function to generate an 'Accept' activity
const createAcceptActivity = (actorUri, followActivity) => {
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
app.post(`/users/${SERVER_NAME}/inbox`, async (req, res) => {

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
        if (followedUser === `${DOMAIN}/users/${SERVER_NAME}`) {
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
app.get(`/users/${SERVER_NAME}`, (req, res) => {
    res.json({
        id: `${DOMAIN}/users/${SERVER_NAME}`,
        type: "Person",
        name: `${SERVER_NAME} User`,
        summary: `A demo federated user for ${SERVER_NAME}.`,
    });
});

app.listen(PORT, () => {
    console.log(`Server running on ${DOMAIN}`);
});

// Send a post (Create activity) to the peer server
const sendPostToPeerServer = async (content: string) => {
    const postActivity = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Create",
        actor: `${DOMAIN}/users/${SERVER_NAME}`,
        object: {
            type: "Note",
            content: content,
        },
    };

    if (PEER_SERVER) {
        try {
            const response = await fetch(`${PEER_SERVER}/users/${PEER_SERVER_NAME}/inbox`, {
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
};

const sendFollowRequest = async () => {
    const SERVER_NAME = process.env.FEDIFY_SERVER_NAME || 'server1';
    const DOMAIN = `http://${SERVER_NAME}:${process.env.PORT || 3000}`;

    if (!PEER_SERVER || !PEER_SERVER_NAME) {
        console.error("Peer server or peer server name not set. Cannot send follow request.");
        return;
    }

    const targetServerUrl = PEER_SERVER; // The server you are following
    const targetUser = PEER_SERVER_NAME; // The user you're trying to follow
    const actor = `${DOMAIN}/users/${SERVER_NAME}`; // Your server as the actor (following)

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
};

// Trigger the follow request
setTimeout(
    function() {
        sendFollowRequest();
        sendPostToPeerServer("Hello, this is a post from " + SERVER_NAME);
    }, randomIntFromInterval(1000, 5000));

function randomIntFromInterval(min: number, max: number) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}
