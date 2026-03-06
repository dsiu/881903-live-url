import { LIVE_URLS } from "./stream-utils.js";

export const renderHomePage = () => {
  const channels = Object.keys(LIVE_URLS).join(", ");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>881903 Live URLs</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: "SF Pro Text", system-ui, -apple-system, sans-serif;
      }
      body {
        margin: 0;
        padding: 32px;
        background: #0b0b0f;
        color: #f7f7f7;
      }
      main {
        max-width: 860px;
        margin: 0 auto;
      }
      h1 {
        margin-bottom: 8px;
        font-size: 28px;
      }
      p {
        margin-top: 0;
        color: #c4c8d4;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      .card {
        background: #15151c;
        border-radius: 12px;
        padding: 16px;
        border: 1px solid #262635;
      }
      .card h2 {
        margin: 0 0 8px 0;
        font-size: 20px;
      }
      .meta {
        font-size: 12px;
        color: #9aa0b0;
        margin-bottom: 8px;
      }
      input {
        width: 100%;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid #2f3242;
        background: #0f0f16;
        color: #f7f7f7;
        font-size: 12px;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      button {
        flex: 1;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #363a4c;
        background: #202434;
        color: #f7f7f7;
        cursor: pointer;
        font-size: 12px;
      }
      button:hover {
        background: #2b3146;
      }
      .status {
        margin-top: 12px;
        font-size: 12px;
        color: #9aa0b0;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>881903 Live URLs</h1>
      <p>Fetching live stream URLs for channels ${channels}.</p>
      <div class="grid" id="grid"></div>
    </main>
    <script>
      const channels = ["903", "881"];
      const grid = document.getElementById("grid");

      const formatTime = (timestamp) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
      };

      const buildCard = (channel) => {
        const escapeHtml = (value) =>
          String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
        const safeChannel = escapeHtml(channel);
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML =
          '<h2>Channel ' + safeChannel + '</h2>' +
          '<div class="meta">/live/' + safeChannel + '</div>' +
          '<input readonly placeholder="Loading..." />' +
          '<div class="actions">' +
          '<button data-action="copy">Copy</button>' +
          '<button data-action="refresh">Refresh</button>' +
          '</div>' +
          '<div class="status">Fetching...</div>';

        const input = card.querySelector("input");
        const status = card.querySelector(".status");
        const copyBtn = card.querySelector("button[data-action='copy']");
        const refreshBtn = card.querySelector("button[data-action='refresh']");

        const update = async () => {
          status.textContent = "Fetching...";
          input.value = "";

          try {
            const response = await fetch("/live/" + channel + "?format=json", { cache: "no-store" });
            if (!response.ok) {
              throw new Error("HTTP " + response.status);
            }
            const payload = await response.json();
            input.value = payload.url || "";
            const cachedText = payload.cached ? "cached" : "fresh";
            const fetchedAt = formatTime(payload.fetchedAtMs);
            const expiresAt = formatTime(payload.expiresAtMs);
            status.textContent =
              cachedText + " • fetched " + fetchedAt + " • expires " + expiresAt;
          } catch (error) {
            status.textContent = "Failed to fetch URL";
          }
        };

        copyBtn.addEventListener("click", async () => {
          if (!input.value) {
            return;
          }
          try {
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(input.value);
            } else {
              input.focus();
              input.select();
              document.execCommand("copy");
              input.setSelectionRange(0, 0);
            }
            status.textContent = "Copied!";
          } catch {
            try {
              input.focus();
              input.select();
              document.execCommand("copy");
              input.setSelectionRange(0, 0);
              status.textContent = "Copied!";
            } catch {
              status.textContent = "Copy failed";
            }
          }
        });

        refreshBtn.addEventListener("click", update);

        update();
        return card;
      };

      channels.forEach((channel) => grid.appendChild(buildCard(channel)));
    </script>
  </body>
</html>`;
};
