// ZIWO Support Dashboard — front end
// One shared instance/password login, then each object type (Agents,
// DIDs & Extensions, Queues, Smart Routing) lives in its own expandable
// section with its own Load button, its own table + CSV download, and —
// for Smart Routing — its own delete panel. Sections are independent so
// each can grow its own set of actions later without touching the others.

const OBJECT_TYPES = {
    agents: {
        label: "Agents",
        columns: [
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
        ],
        statusKey: "status",
        dateKeys: ["lastLoginAt"],
    },
    numbers: {
        label: "DIDs & Extensions",
        columns: [
            ["id", "ID"],
            ["did", "DID / Extension"],
            ["linkType", "Link Type"],
            ["linkName", "Linked To"],
            ["workingHours", "Working Hours"],
            ["afterHoursType", "After-Hours Type"],
            ["afterHoursTarget", "After-Hours Target"],
            ["createdAt", "Created"],
            ["updatedAt", "Updated"],
        ],
        statusKey: null,
        dateKeys: ["createdAt", "updatedAt"],
    },
    queues: {
        label: "Queues",
        columns: [
            ["id", "ID"],
            ["name", "Name"],
            ["status", "Status"],
            ["strategyType", "Strategy"],
            ["extension", "Extension"],
            ["callerIDNumber", "Caller ID"],
            ["language", "Language"],
            ["maxWaitTime", "Max Wait"],
            ["maxQueueSize", "Max Size"],
            ["agents", "Agents"],
        ],
        statusKey: "status",
        dateKeys: [],
    },
    smart_routing: {
        label: "Smart Routing",
        columns: [
            ["id", "ID"],
            ["type", "Type"],
            ["pattern", "Pattern"],
            ["linkType", "Link Type"],
            ["linkedTo", "Linked To"],
            ["callerID", "Caller ID"],
            ["createdBy", "Created By"],
        ],
        statusKey: null,
        dateKeys: [],
    },
};

const instanceInput = document.getElementById("instance");
const passwordInput = document.getElementById("password");
const loginForm = document.getElementById("loginForm");

// ---------------------------------------------------------------------
// Shared helpers (column-config driven, reused by every section)
// ---------------------------------------------------------------------
function fmtValue(key, val, config) {
    if (val === "" || val === null || val === undefined) return "-";
    if (config.dateKeys.includes(key)) {
        const d = new Date(val);
        return isNaN(d) ? val : d.toLocaleString();
    }
    return val;
}

function statusBadgeClass(status) {
    if (!status) return "inactive";
    return status.toLowerCase() === "active" ? "active" : "blocked";
}

function renderTable(tableWrap, items, config) {
    if (items.length === 0) {
        tableWrap.innerHTML = `<p style="color:var(--text-dim)">No matching results.</p>`;
        return;
    }
    const head = config.columns.map(([, label]) => `<th>${label}</th>`).join("");
    const rows = items.map(item => {
        const cells = config.columns.map(([key]) => {
            if (key === config.statusKey) {
                return `<td><span class="badge ${statusBadgeClass(item[key])}">${item[key] || "-"}</span></td>`;
            }
            return `<td>${fmtValue(key, item[key], config)}</td>`;
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

function matchesQuery(item, q) {
    return Object.values(item).some(v => String(v ?? "").toLowerCase().includes(q));
}

function toCSV(items, config) {
    const headers = config.columns.map(([, label]) => label);
    const keys = config.columns.map(([key]) => key);
    const lines = [headers.join(",")];
    for (const item of items) {
        const row = keys.map(k => {
            const val = String(item[k] ?? "");
            const escaped = val.replace(/"/g, '""');
            return escaped.includes(",") || escaped.includes('"') ? `"${escaped}"` : escaped;
        });
        lines.push(row.join(","));
    }
    return lines.join("\n");
}

function downloadBlob(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------
// One controller per section — wires its Load button, search box,
// download button and table to that section's own state.
// ---------------------------------------------------------------------
function initSection(root) {
    const type = root.dataset.type;
    const config = OBJECT_TYPES[type];

    const loadBtn = root.querySelector(".load-btn");
    const statusEl = root.querySelector(".status");
    const resultsBar = root.querySelector(".results-bar");
    const searchBox = root.querySelector(".search-box");
    const countLabel = root.querySelector(".count-label");
    const downloadBtn = root.querySelector(".download-btn");
    const tableWrap = root.querySelector(".table-wrap");

    let items = [];
    let isLoading = false;

    function setStatus(text, kind) {
        statusEl.textContent = text;
        statusEl.className = `status ${kind || ""}`;
    }

    function applyFilter() {
        const q = searchBox.value.trim().toLowerCase();
        const filtered = q ? items.filter(i => matchesQuery(i, q)) : items;
        renderTable(tableWrap, filtered, config);
        countLabel.textContent = q ? `${filtered.length} of ${items.length}` : `${items.length} result(s)`;
    }

    async function load() {
        if (isLoading) return;
        const instance = instanceInput.value.trim();
        const password = passwordInput.value;
        if (!instance || !password) {
            setStatus("Enter the instance name and password above first.", "error");
            return;
        }

        isLoading = true;
        loadBtn.disabled = true;
        const originalLabel = loadBtn.textContent;
        loadBtn.textContent = "Loading…";
        resultsBar.style.display = "none";
        tableWrap.innerHTML = "";
        setStatus(`Authenticating and fetching ${config.label.toLowerCase()} — this can take a few seconds for large instances…`, "loading");

        try {
            const res = await fetch(`/api/${type}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instance, password }),
            });
            const data = await res.json();

            if (!data.ok) {
                setStatus(`✗ ${data.error}`, "error");
                return;
            }

            items = data.items;
            setStatus(`✓ Loaded ${data.count} ${config.label.toLowerCase()} from "${instance}".`, "success");
            resultsBar.style.display = "flex";
            searchBox.value = "";
            countLabel.textContent = `${items.length} result(s)`;
            renderTable(tableWrap, items, config);
        } catch (err) {
            setStatus(`✗ Could not reach the local server: ${err.message}`, "error");
        } finally {
            isLoading = false;
            loadBtn.disabled = false;
            loadBtn.textContent = originalLabel;
        }
    }

    loadBtn.addEventListener("click", load);
    searchBox.addEventListener("input", applyFilter);
    downloadBtn.addEventListener("click", () => {
        const q = searchBox.value.trim().toLowerCase();
        const toExport = q ? items.filter(i => matchesQuery(i, q)) : items;
        downloadBlob(
            `${instanceInput.value.trim() || "ziwo"}_${type}.csv`,
            toCSV(toExport, config),
            "text/csv;charset=utf-8;"
        );
    });

    // Subnav (currently only Smart Routing has one: Extract vs Delete).
    // Toggles which `.sr-panel` is visible; harmless no-op elsewhere.
    const subnavBtns = root.querySelectorAll(".subnav-btn");
    if (subnavBtns.length) {
        subnavBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                subnavBtns.forEach(b => b.classList.toggle("active", b === btn));
                root.querySelectorAll(".sr-panel").forEach(panel => {
                    panel.style.display = panel.classList.contains(`sr-${btn.dataset.mode}-panel`) ? "block" : "none";
                });
            });
        });
    }

    if (type === "smart_routing") {
        initSmartRoutingDelete(root);
    }
}

// Enter key inside the shared login fields triggers whichever section
// is currently open (defaults to the first one, Agents).
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const openSection = document.querySelector(".obj-section[open]");
    (openSection || document.querySelector(".obj-section"))?.querySelector(".load-btn")?.click();
});

document.querySelectorAll(".obj-section").forEach(root => {
    if (root.dataset.type === "bgw") {
        initBgwSection(root);
    } else {
        initSection(root);
    }
});

// ---------------------------------------------------------------------
// Smart Routing — delete panel (all / queue / ivr / hangup, with a
// mandatory preview and a typed "DELETE" confirmation before anything
// is actually removed). Scoped to the Smart Routing section's own root.
// ---------------------------------------------------------------------
function initSmartRoutingDelete(root) {
    const deleteModeSelect = root.querySelector(".delete-mode");
    const deleteTargetField = root.querySelector(".delete-target-field");
    const deleteTargetInput = root.querySelector(".delete-target");
    const previewDeleteBtn = root.querySelector(".preview-delete-btn");
    const deletePreview = root.querySelector(".delete-preview");
    const previewSummary = root.querySelector(".preview-summary");
    const confirmTextInput = root.querySelector(".confirm-text");
    const confirmDeleteBtn = root.querySelector(".confirm-delete-btn");
    const deleteResult = root.querySelector(".delete-result");
    const statusEl = root.querySelector(".status");

    const DELETE_TARGET_LABELS = {
        queue: "Queue name",
        ivr: "IVR name (optional — leave blank to match all IVR-linked records)",
    };

    let lastPreview = null; // { mode, target, items }

    function resetDeleteState() {
        lastPreview = null;
        deletePreview.style.display = "none";
        deleteResult.innerHTML = "";
        confirmTextInput.value = "";
        confirmDeleteBtn.disabled = true;
    }

    function updateDeleteTargetVisibility() {
        const mode = deleteModeSelect.value;
        if (mode === "all" || mode === "hangup") {
            deleteTargetField.style.display = "none";
        } else {
            deleteTargetField.style.display = "flex";
            deleteTargetField.querySelector("label").textContent = DELETE_TARGET_LABELS[mode] || "Target";
            deleteTargetInput.placeholder = mode === "queue" ? "e.g. 337_AR_Queue" : "e.g. Main IVR (optional)";
        }
        resetDeleteState();
    }

    deleteModeSelect.addEventListener("change", updateDeleteTargetVisibility);
    updateDeleteTargetVisibility();

    async function callSmartRoutingDelete(dryRun) {
        const instance = instanceInput.value.trim();
        const password = passwordInput.value;
        const mode = deleteModeSelect.value;
        const target = deleteTargetInput.value.trim();

        if (!instance || !password) {
            statusEl.textContent = "Enter the instance name and password above first.";
            statusEl.className = "status error";
            return null;
        }
        if (mode === "queue" && !target) {
            alert("Enter a queue name for queue mode.");
            return null;
        }

        const res = await fetch("/api/smart_routing/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instance, password, mode, target, dryRun }),
        });
        return res.json();
    }

    previewDeleteBtn.addEventListener("click", async () => {
        previewDeleteBtn.disabled = true;
        previewDeleteBtn.textContent = "Checking…";
        deleteResult.innerHTML = "";
        try {
            const data = await callSmartRoutingDelete(true);
            if (!data) return;
            if (!data.ok) {
                deleteResult.innerHTML = `<p class="status error">✗ ${data.error}</p>`;
                deletePreview.style.display = "none";
                return;
            }

            lastPreview = { mode: deleteModeSelect.value, target: deleteTargetInput.value.trim(), items: data.items };

            if (data.matchedCount === 0) {
                previewSummary.textContent = "No matching records found — nothing to delete.";
                deletePreview.style.display = "block";
                confirmDeleteBtn.disabled = true;
            } else {
                const sample = data.items.slice(0, 10)
                    .map(i => `#${i.id} (${i.pattern || i.linkType})`)
                    .join(", ");
                const more = data.matchedCount > 10 ? ` … and ${data.matchedCount - 10} more` : "";
                previewSummary.innerHTML = `<strong>${data.matchedCount} record(s)</strong> match and will be permanently deleted: ${sample}${more}`;
                deletePreview.style.display = "block";
                confirmTextInput.value = "";
                confirmDeleteBtn.disabled = true;
            }
        } catch (err) {
            deleteResult.innerHTML = `<p class="status error">✗ Could not reach the local server: ${err.message}</p>`;
        } finally {
            previewDeleteBtn.disabled = false;
            previewDeleteBtn.textContent = "Preview matches";
        }
    });

    confirmTextInput.addEventListener("input", () => {
        confirmDeleteBtn.disabled = confirmTextInput.value.trim() !== "DELETE" || !lastPreview || lastPreview.items.length === 0;
    });

    confirmDeleteBtn.addEventListener("click", async () => {
        if (!lastPreview) return;
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = "Deleting…";
        try {
            const data = await callSmartRoutingDelete(false);
            if (!data) return;
            if (!data.ok) {
                deleteResult.innerHTML = `<p class="status error">✗ ${data.error}</p>`;
                return;
            }

            const failedNote = data.failed.length
                ? `<br>⚠️ ${data.failed.length} failed to delete (see server log).`
                : "";
            const backupNote = data.backupFile
                ? `<br>Backup saved to <code>smart_routing_backups/${data.backupFile}</code> — use this to restore via ziwo_dynamic_routing_rollback.py if needed.`
                : "";

            deleteResult.innerHTML = `
                <p class="status success">✓ Deleted ${data.deletedCount} of ${data.matchedCount} record(s).${failedNote}${backupNote}</p>
                <button class="download-delete-backup-btn">Download backup copy (JSON)</button>
            `;

            deleteResult.querySelector(".download-delete-backup-btn")?.addEventListener("click", () => {
                const payload = {
                    timestamp: new Date().toISOString(),
                    client: instanceInput.value.trim(),
                    mode: lastPreview.mode,
                    target: lastPreview.target,
                    removed_entries: data.items,
                };
                downloadBlob(
                    data.backupFile || `${instanceInput.value.trim() || "ziwo"}_smart_routing_removed.json`,
                    JSON.stringify(payload, null, 2),
                    "application/json"
                );
            });

            deletePreview.style.display = "none";
            confirmTextInput.value = "";
        } catch (err) {
            deleteResult.innerHTML = `<p class="status error">✗ Could not reach the local server: ${err.message}</p>`;
        } finally {
            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = "Delete records";
        }
    });
}

// ---------------------------------------------------------------------
// BGW Onboarding — runs bgw_discover.sh via the local server and streams
// its stdout live, then renders whatever CSV it produced. Doesn't use
// the shared instance/password login (different credentials entirely —
// SSH password + NetBox token, not a ZIWO instance login), and doesn't
// use the generic OBJECT_TYPES table code since the CSV's columns are
// whatever the script's header row says, not a fixed schema.
// ---------------------------------------------------------------------
function initBgwSection(root) {
    const ipsInput = root.querySelector(".bgw-ips");
    const sshPassInput = root.querySelector(".bgw-ssh-pass");
    const netboxTokenInput = root.querySelector(".bgw-netbox-token");
    const runBtn = root.querySelector(".bgw-run-btn");
    const statusEl = root.querySelector(".bgw-status");
    const logWrap = root.querySelector(".bgw-log-wrap");
    const logEl = root.querySelector(".bgw-log");
    const resultsWrap = root.querySelector(".bgw-results");
    const countLabel = root.querySelector(".count-label");
    const downloadLink = root.querySelector(".bgw-download-link");
    const tableWrap = root.querySelector(".bgw-table-wrap");

    function setStatus(text, kind) {
        statusEl.textContent = text;
        statusEl.className = `status bgw-status ${kind || ""}`;
    }

    function appendLog(line) {
        const atBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 4;
        logEl.textContent += (logEl.textContent ? "\n" : "") + line;
        if (atBottom) logEl.scrollTop = logEl.scrollHeight;
    }

    // Rows are rendered incrementally as "row" events arrive (one per
    // IP, as soon as bgw_discover.sh finishes that IP) rather than all
    // at once at the end. `columns` is fixed once from the first row
    // (bgw_discover.sh always writes the same header); `rowCount`
    // tracks how many we've appended so far for the live count label.
    let liveColumns = null;
    let liveRowCount = 0;

    function resetLiveTable() {
        liveColumns = null;
        liveRowCount = 0;
        tableWrap.innerHTML = "";
        countLabel.textContent = "";
    }

    function appendCsvRow(row) {
        if (!liveColumns) {
            liveColumns = Object.keys(row);
            const head = liveColumns.map(c => `<th>${c}</th>`).join("");
            tableWrap.innerHTML = `<table class="agents-table"><thead><tr>${head}</tr></thead><tbody></tbody></table>`;
        }
        const tbody = tableWrap.querySelector("tbody");
        const cells = liveColumns.map(c => `<td>${row[c] ?? "-"}</td>`).join("");
        const tr = document.createElement("tr");
        tr.innerHTML = cells;
        tbody.appendChild(tr);
        liveRowCount += 1;
        countLabel.textContent = `${liveRowCount} result(s) so far…`;
    }

    let isRunning = false;

    runBtn.addEventListener("click", async () => {
        if (isRunning) return;
        const ips = ipsInput.value.trim();
        const sshPass = sshPassInput.value;
        const netboxToken = netboxTokenInput.value;

        if (!ips || !sshPass || !netboxToken) {
            setStatus("Enter at least one IP, the SSH password, and the NetBox token.", "error");
            return;
        }

        isRunning = true;
        runBtn.disabled = true;
        runBtn.textContent = "Running…";
        logEl.textContent = "";
        logWrap.style.display = "block";
        resetLiveTable();
        resultsWrap.style.display = "block";
        downloadLink.removeAttribute("href");
        setStatus("Starting discovery — results will appear below as each IP finishes…", "loading");

        try {
            const res = await fetch("/api/bgw/discover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ips, sshPass, netboxToken }),
            });

            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => null);
                setStatus(`✗ ${data?.error || "Request failed."}`, "error");
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let finalPayload = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let idx;
                while ((idx = buffer.indexOf("\n")) >= 0) {
                    const line = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 1);
                    if (!line.trim()) continue;
                    let evt;
                    try { evt = JSON.parse(line); } catch { continue; }
                    if (evt.type === "log") {
                        appendLog(evt.line);
                    } else if (evt.type === "row") {
                        appendCsvRow(evt.row);
                    } else if (evt.type === "error") {
                        setStatus(`✗ ${evt.error}`, "error");
                    } else if (evt.type === "done") {
                        finalPayload = evt;
                    }
                }
            }

            if (finalPayload) {
                const kind = finalPayload.exitCode === 0 ? "success" : "error";
                setStatus(`✓ Discovery finished (exit code ${finalPayload.exitCode}).`, kind);
                if (finalPayload.csv) {
                    downloadLink.href = `/api/bgw/csv/${finalPayload.csv.filename}`;
                    downloadLink.setAttribute("download", finalPayload.csv.filename);
                }
                if (liveRowCount === 0) {
                    tableWrap.innerHTML = `<p style="color:var(--text-dim)">No rows in the results CSV.</p>`;
                    countLabel.textContent = "0 result(s)";
                } else {
                    countLabel.textContent = `${liveRowCount} result(s)`;
                }
            } else {
                setStatus("Stream ended without a final result — check the log above.", "error");
            }
        } catch (err) {
            setStatus(`✗ Could not reach the local server: ${err.message}`, "error");
        } finally {
            isRunning = false;
            runBtn.disabled = false;
            runBtn.textContent = "Run Discovery";
        }
    });
}
