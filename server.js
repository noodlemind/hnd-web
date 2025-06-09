import "dotenv/config";
import express from "express";
import axios from "axios";
import path from "path";
import apiRoutes from "./routes.js";
import { loadMessages } from "./utils.js";

const app = express();
const { WEBHOOK_VERIFY_TOKEN, GRAPH_API_TOKEN, PORT } = process.env;

// --- Middlewares & Setup ---
app.use(express.json());
app.use(express.static("public"));
loadMessages();

// --- Routes ---
// Mount the dashboard API routes under the /api prefix
app.use("/api", apiRoutes);
// Add a new route to serve the dashboard UI
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// --- Original WhatsApp Webhook & Verification ---
app.post("/webhook", async (req, res) => {
  console.log("Incoming webhook message:", JSON.stringify(req.body, null, 2));
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

  if (message?.type === "text") {
    const business_phone_number_id =
      req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
      headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` },
      data: {
        messaging_product: "whatsapp",
        to: message.from,
        text: { body: "Echo: " + message.text.body },
        context: { message_id: message.id },
      },
    });
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
      headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` },
      data: {
        messaging_product: "whatsapp",
        status: "read",
        message_id: message.id,
      },
    });
  }
  res.sendStatus(200);
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    console.log("Webhook verified successfully!");
  } else {
    res.sendStatus(403);
  }
});

// Original root route
app.get("/", (req, res) => {
  res.send(`<pre>Nothing to see here.
Checkout README.md to start.</pre>`);
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});
