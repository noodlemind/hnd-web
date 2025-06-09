import path from "path";
import {
  storeMessage as store,
  getMessages as get,
  addClient as add,
  removeClient as remove,
  updateMessageStatus,
  updateAndSendNotes,
} from "./utils.js";

export const handleWebhook = (req, res) => {
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

  if (message?.type === "text") {
    store(message);
  }

  res.sendStatus(200);
};

export const handleEvents = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res,
  };
  add(newClient);

  req.on("close", () => {
    remove(clientId);
  });
};

export const handleGetMessages = (req, res) => {
  res.json(get());
};

export const handleAcceptMessage = (req, res) => {
  const { id } = req.params;
  const success = updateMessageStatus(id, "read");
  if (success) {
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
};

export const handleArchiveMessage = (req, res) => {
  const { id } = req.params;
  const success = updateMessageStatus(id, "archived");
  if (success) {
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
};

export const handleSendNotes = async (req, res) => {
  const { id } = req.params;
  const { notes, business_phone_number_id } = req.body;
  if (!notes || !business_phone_number_id) {
    return res.status(400).send("Missing notes or business phone number ID.");
  }
  const success = await updateAndSendNotes(id, notes, business_phone_number_id);
  if (success) {
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
}; 