import fs from "fs";
import path from "path";
import axios from "axios";

const { GRAPH_API_TOKEN } = process.env;
const messagesFilePath = path.join(process.cwd(), "messages.json");
let messages = {};
let clients = [];

const saveMessagesToFile = () => {
  try {
    fs.writeFileSync(messagesFilePath, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error("Error writing messages to file:", error);
  }
};

// Load messages from file on startup
export const loadMessages = () => {
  try {
    if (fs.existsSync(messagesFilePath)) {
      const data = fs.readFileSync(messagesFilePath, "utf8");
      messages = JSON.parse(data);
      console.log("Messages loaded from file.");
    }
  } catch (error) {
    console.error("Error loading messages from file:", error);
  }
};

// Function to send events to all connected clients
export const sendEventsToAll = (data) => {
  clients.forEach((client) =>
    client.res.write(`data: ${JSON.stringify(data)}\n\n`)
  );
};

// Store an incoming message
export const storeMessage = (message) => {
  const from = message.from;
  if (!messages[from]) {
    messages[from] = [];
  }

  const augmentedMessage = {
    ...message,
    status: "unread", // 'unread', 'read', 'archived'
    notes: "",
  };

  messages[from].push(augmentedMessage);
  saveMessagesToFile();
  sendEventsToAll(getMessages());
};

export const getMessages = () => {
  return messages;
};

export const addClient = (client) => {
  clients.push(client);
};

export const removeClient = (clientId) => {
  clients = clients.filter((client) => client.id !== clientId);
};

const findMessage = (messageId) => {
  for (const sender in messages) {
    const message = messages[sender].find((msg) => msg.id === messageId);
    if (message) {
      return message;
    }
  }
  return null;
};

export const updateMessageStatus = (messageId, status) => {
  const message = findMessage(messageId);
  if (message) {
    message.status = status;
    saveMessagesToFile();
    sendEventsToAll(getMessages());
    return true;
  }
  return false;
};

export const updateAndSendNotes = async (messageId, notes, businessPhoneNumberId) => {
  const message = findMessage(messageId);
  if (!message) {
    return false;
  }

  message.notes = notes;

  // Send the notes as a reply
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v18.0/${businessPhoneNumberId}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`,
    },
    data: {
      messaging_product: "whatsapp",
      to: message.from,
      text: { body: notes },
      context: {
        message_id: message.id,
      },
    },
  });

  saveMessagesToFile();
  sendEventsToAll(getMessages());
  return true;
}; 