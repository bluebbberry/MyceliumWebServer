import { Hono } from "hono";
import { federation } from "@fedify/fedify/x/hono";
import { getLogger } from "@logtape/logtape";
import fedi from "./federation.ts";

const logger = getLogger("fungus-backend");

const app = new Hono();
app.use(federation(fedi, () => undefined))

app.get("/", (c) => c.text("Hello, Fedify!"));

export default app;
