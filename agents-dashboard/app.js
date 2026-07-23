// Agents Dashboard — front end
// Talks to the local server.py (same origin, no CORS issues). Submits
// instance + password, renders the returned agent list as a table, and
// offers a client-side CSV download of whatever's currently on screen.

const COLUMNS = [
    ["id", "ID"],
    ["ccLogin", "CC Login"],
    ["firstName", "First Name"],
    ["lastName", "Last Name"],
    ["username", "Username"],
    ["status", "Status"],
    ["plan", "Plan"],
    ["type", "Type"],
    ["queues", "Queues"],
    ["skills", "Skills"],
    ["lastLoginAt", "Last Login"],
];

let allAgents = [];
let instanceName = "";

const form = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");
const statusEl = document.getElementById("status");
const resultsBar = document.getElementById("resultsBar");
const searchBox = document.getElementById("searchBox");
const countLabel = document.getElementById("countLabel");
const tableWrap = document.getElementById("tableWrap");
const downloadBtn = document.getElementById("downloadBtn");

function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = `status ${kind || ""}`;
}

function fmtDate(v) {
    if (!v) return "Never";
    const d = new Date(v);
    return isNaN(d) ? v : d.toLocaleString();
}

function statusBadgeClass(status) {
    if (!status) return "inactive";
    return status.toLowerCase() === "active" ? "active" : "blocked";
}

function renderTable(agents) {
    if (agents.length === 0) {
        tableWrap.innerHTML = `<p style="color:var(--text-dim)">No matching agents.</p>`;
        return;
    }
    const head = COLUMNS.map(([, label]) => `<th>${label}</th>`).join("");
    const rows = agents.map(a => {
        const cells = COLUMNS.map(([key]) => {
            if (key === "status") {
                return `<td><span class="badge ${statusBadgeClass(a.status)}">${a.status || "-"}</span></td>`;
            }
            if (key === "lastLoginAt") {
                return `<td>${fmtDate(a.lastLoginAt)}</td>`;
            }
            const val = a[key];
            return `<td>${val === "" || val === null || val === undefined ? "-" : val}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
    }).join("");

    tableWrap.innerHTML = `
        <table class="agents-table">
            <thead><tr>${head}</tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function applyFilter() {
    const q = searchBox.value.trim().toLowerCase();
    if (!q) {
        renderTable(allAgents);
        countLabel.textContent = `${allAgents.length} agent(s)`;
        return;
    }
    const filtered = allAgents.filter(a =>
        Object.values(a).some(v => String(v ?? "").toLowerCase().includes(q))
    );
    renderTable(filtered);
    countLabel.textContent = `${filtered.length} of ${allAgents.length} agent(s)`;
}

function toCSV(agents) {
    const headers = COLUMNS.map(([, label]) => label);
    const keys = COLUMNS.map(([key]) => key);
    const lines = [headers.join(",")];
    for (const a of agents) {
        const row = keys.map(k => {
            const val = String(a[k] ?? "");
            const escaped = val.replace(/"/g, '""');
            return escaped.includes(",") || escaped.includes('"') ? `"${escaped}"` : escaped;
        });
        lines.push(row.join(","));
    }
    return lines.join("\n");
}

function downloadCSV() {
    const q = searchBox.value.trim().toLowerCase();
    const agentsToExport = q
        ? allAgents.filter(a => Object.values(a).some(v => String(v ?? "").toLowerCase().includes(q)))
        : allAgents;

    const csv = toCSV(agentsToExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${instanceName || "agents"}_agents.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const instance = document.getElementById("instance").value.trim();
    const password = document.getElementById("password").value;

    instanceName = instance;
    submitBtn.disabled = true;
    submitBtn.textContent = "Fetching…";
    resultsBar.style.display = "none";
    setStatus("Authenticating and fetching agents — this can take a few seconds for large instances…", "loading");

    try {
        const res = await fetch("/api/agents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instance, password }),
        });
        const data = await res.json();

        if (!data.ok) {
            setStatus(`✗ ${data.error}`, "error");
            tableWrap.innerHTML = "";
            return;
        }

        allAgents = data.agents;
        setStatus(`✓ Loaded ${data.count} agent(s) from "${instance}".`, "success");
        resultsBar.style.display = "flex";
        searchBox.value = "";
        countLabel.textContent = `${allAgents.length} agent(s)`;
        renderTable(allAgents);
    } catch (err) {
        setStatus(`✗ Could not reach the local server: ${err.message}`, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Get Agents";
    }
});

searchBox?.addEventListener("input", applyFilter);
downloadBtn?.addEventListener("click", downloadCSV);
