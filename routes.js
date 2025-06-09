import express from "express";
import {
  handleWebhook,
  handleEvents,
  handleGetMessages,
  handleAcceptMessage,
  handleArchiveMessage,
  handleSendNotes,
} from "./handlers.js";

const router = express.Router();

// Routes for the message dashboard API
router.post("/webhook-handler", handleWebhook);
router.get("/events", handleEvents);
router.get("/messages", handleGetMessages);
router.post("/messages/:id/accept", handleAcceptMessage);
router.post("/messages/:id/archive", handleArchiveMessage);
router.post("/messages/:id/notes", handleSendNotes);

export default router; 