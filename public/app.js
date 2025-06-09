// A global variable to store the business phone number ID from the latest message
let business_phone_number_id = null;

// Global state for the application
const state = {
  allMessages: {},
  selectedSender: null,
  currentView: "inbox", // 'inbox' or 'archived'
};

document.addEventListener("DOMContentLoaded", () => {
  // Add event listeners for the tabs
  document.getElementById("nav-inbox-tab").addEventListener("click", () => setView("inbox"));
  document.getElementById("nav-archived-tab").addEventListener("click", () => setView("archived"));

  // Initial data fetch
  fetchMessages();

  // Set up Server-Sent Events for real-time updates
  const eventSource = new EventSource("/api/events");
  eventSource.onmessage = (event) => {
    const messages = JSON.parse(event.data);
    state.allMessages = messages;
    renderUI();
  };
});

const setView = (view) => {
  state.currentView = view;
  state.selectedSender = null; // Deselect sender when switching views
  renderUI();
};

const selectSender = (sender) => {
  state.selectedSender = sender;
  renderConversation();
  highlightSenderInList();
};

const renderUI = () => {
  renderConversationList();
  renderConversation();
  highlightSenderInList();
};

const renderConversationList = () => {
  const inboxList = document.getElementById("inbox-conversation-list");
  const archivedList = document.getElementById("archived-conversation-list");
  inboxList.innerHTML = "";
  archivedList.innerHTML = "";

  const senders = Object.keys(state.allMessages);
  senders.forEach((sender) => {
    const messages = state.allMessages[sender];
    const hasActive = messages.some((m) => m.status !== "archived");
    const hasArchived = messages.some((m) => m.status === "archived");
    const unreadCount = messages.filter((m) => m.status === "unread").length;
    const latestMessage = messages[messages.length - 1];

    const listItemHTML = `
      <a href="#" class="list-group-item list-group-item-action" onclick="selectSender('${sender}')">
        <div class="d-flex w-100 justify-content-between">
          <h6 class="mb-1">${sender}</h6>
          <small>${new Date(parseInt(latestMessage.timestamp) * 1000).toLocaleDateString()}</small>
        </div>
        <p class="mb-1 text-truncate">${latestMessage.text.body}</p>
        ${ unreadCount > 0 ? `<span class="badge bg-primary rounded-pill">${unreadCount}</span>` : "" }
      </a>
    `;

    if (hasActive) inboxList.innerHTML += listItemHTML;
    if (hasArchived) archivedList.innerHTML += listItemHTML;
  });
};

const renderConversation = () => {
  const detailsView = document.getElementById("message-details-content");
  if (!state.selectedSender) {
    detailsView.innerHTML = `
      <div class="message-details-placeholder">
        <div>
          <h5>Select a conversation</h5>
          <p>Messages from your contacts will appear here.</p>
        </div>
      </div>
    `;
    return;
  }

  const messages = state.allMessages[state.selectedSender] || [];
  const filteredMessages = messages.filter(
    (msg) =>
      state.currentView === "inbox" ? msg.status !== "archived" : msg.status === "archived"
  );

  detailsView.innerHTML = `
    <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
      <h5 class="m-0">Conversation with ${state.selectedSender}</h5>
    </div>
    <div class="message-list">
      <ul class="list-group list-group-flush">
        ${filteredMessages.map((msg) => getMessageHTML(msg)).join("")}
      </ul>
    </div>
  `;
};

const getMessageHTML = (msg) => {
  const isUnread = msg.status === "unread";
  const isRead = msg.status === "read";

  let actionContent = '';
  if (isRead) {
    actionContent = `
      <div class="mt-2">
        <textarea class="form-control" id="notes-${msg.id}" placeholder="Add notes...">${msg.notes || ''}</textarea>
        <button class="btn btn-success btn-sm mt-2" onclick="saveAndSend('${msg.id}')">Save & Send Notes</button>
        <button class="btn btn-secondary btn-sm mt-2" onclick="archiveMessage('${msg.id}')">Archive</button>
      </div>
    `;
  } else if (isUnread) {
    actionContent = `<button class="btn btn-primary btn-sm mt-2" onclick="acceptMessage('${msg.id}')">Accept</button>`;
  }

  return `
    <li class="list-group-item mb-3 border rounded shadow-sm ${isUnread ? 'list-group-item-light' : ''}">
      <p class="mb-1">${msg.text.body}</p>
      <small class="text-muted">Received: ${new Date(parseInt(msg.timestamp) * 1000).toLocaleString()}</small>
      ${actionContent}
    </li>
  `;
};

const highlightSenderInList = () => {
    // Remove active class from all items
    document.querySelectorAll('.conversation-list a').forEach(el => el.classList.remove('active'));
    // Add active class to the selected sender
    if (state.selectedSender) {
        const el = document.querySelector(`.conversation-list a[onclick="selectSender('${state.selectedSender}')"]`);
        if (el) el.classList.add('active');
    }
}

const fetchMessages = async () => {
  try {
    const response = await fetch("/api/messages");
    state.allMessages = await response.json();
    // Find the latest business phone number id to use for sending replies
    for (const sender in state.allMessages) {
        state.allMessages[sender].forEach(msg => {
            const bpid = msg.business_phone_number_id || msg.metadata?.phone_number_id;
            if (bpid) {
                business_phone_number_id = bpid;
            }
        });
    }
    renderUI();
  } catch (error) {
    console.error("Error fetching messages:", error);
  }
};

async function acceptMessage(messageId) {
  await fetch(`/api/messages/${messageId}/accept`, { method: "POST" });
  // The SSE event will trigger the UI update
}

async function archiveMessage(messageId) {
  await fetch(`/api/messages/${messageId}/archive`, { method: "POST" });
  // The SSE event will trigger the UI update, and the message will disappear from the inbox view
  state.selectedSender = null; // Deselect to avoid viewing an archived item in the inbox
}

async function saveAndSend(messageId) {
  const notes = document.getElementById(`notes-${messageId}`).value;
  if (!notes) {
    alert("Please enter notes to send.");
    return;
  }
  if (!business_phone_number_id) {
    const latestMessage = state.allMessages[state.selectedSender].slice(-1)[0]
    const bpid = latestMessage.business_phone_number_id || latestMessage.metadata?.phone_number_id;
    if(bpid) business_phone_number_id = bpid;
    else {
      alert("Cannot determine business phone number to send from. Please wait for a new message.");
      return;
    }
  }

  await fetch(`/api/messages/${messageId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes, business_phone_number_id }),
  });
}

// Need to include bootstrap js for accordion to work
const bootstrapScript = document.createElement("script");
bootstrapScript.src =
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js";
document.body.appendChild(bootstrapScript); 