const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "it_cmd_gen_v2";

const CONFIG = {
  github: "https://github.com/J8Roque"
};

const DATA = {
  windows: {
    label: "Windows",
    shells: {
      powershell: { label: "PowerShell" },
      cmd: { label: "Command Prompt" }
    },
    categories: [
      {
        id: "network",
        name: "Networking",
        tasks: [
          {
            id: "dns_check",
            name: "DNS check",
            description: "Check DNS servers, test name resolution, and confirm where failures occur.",
            steps: [
              {
                label: "Check IP and DNS",
                admin: false,
                cmd: { powershell: `Get-NetIPConfiguration | Format-List`, cmd: `ipconfig /all` },
                meaning: [
                  "Look for DNS Servers and Default Gateway.",
                  "If DNS Servers are blank or wrong, name lookups will fail."
                ]
              },
              {
                label: "Test name resolution",
                admin: false,
                cmd: { powershell: `Resolve-DnsName google.com`, cmd: `nslookup google.com` },
                meaning: [
                  "If this fails but pinging an IP works, it is usually DNS.",
                  "If it succeeds but browsing fails, it may be proxy, firewall, or TLS inspection."
                ]
              },
              {
                label: "Flush DNS cache",
                admin: true,
                cmd: { powershell: `Clear-DnsClientCache`, cmd: `ipconfig /flushdns` },
                meaning: ["Useful after changing DNS settings or when cached bad entries exist."]
              }
            ],
            resultMeaning: [
              "Resolution succeeds: DNS is working for that domain.",
              "Resolution times out: try different DNS server or check network path.",
              "Wrong IP returned: could be internal split DNS or a cached record."
            ]
          },
          {
            id: "network_trace",
            name: "Network trace to a host",
            description: "Check latency, routing hops, and where packets drop.",
            steps: [
              {
                label: "Basic reachability",
                admin: false,
                cmd: { powershell: `ping -n 4 8.8.8.8`, cmd: `ping -n 4 8.8.8.8` },
                meaning: ["If ping fails to a public IP, it may be gateway, ISP, firewall rules, or no route."]
              },
              {
                label: "Trace route",
                admin: false,
                cmd: { powershell: `tracert 8.8.8.8`, cmd: `tracert 8.8.8.8` },
                meaning: ["Find the hop where timeouts start.", "Some hops block ICMP and still forward traffic."]
              },
              {
                label: "TCP test to a port",
                admin: false,
                cmd: {
                  powershell: `Test-NetConnection google.com -Port 443`,
                  cmd: `powershell -Command "Test-NetConnection google.com -Port 443"`
                },
                meaning: ["If ICMP works but TCP 443 fails, it can be firewall or proxy issues."]
              }
            ],
            resultMeaning: [
              "High latency early hops: local network or ISP congestion.",
              "Drop at first hop: default gateway or local firewall.",
              "Drop later: ISP routing, remote host issues, or filtered ICMP."
            ]
          }
        ]
      },
      {
        id: "disk",
        name: "Disk and Storage",
        tasks: [
          {
            id: "disk_space",
            name: "Disk space check",
            description: "Check free space and find large folders.",
            steps: [
              {
                label: "Show free space",
                admin: false,
                cmd: { powershell: `Get-PSDrive -PSProvider FileSystem`, cmd: `wmic logicaldisk get caption,freespace,size` },
                meaning: ["Low free space can cause slow performance, failed updates, and app errors."]
              },
              {
                label: "Find large folders (quick)",
                admin: false,
                cmd: {
                  powershell: `Get-ChildItem C:\\ -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object { "{0}  {1:N2} GB" -f $_.FullName, ((Get-ChildItem $_.FullName -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1GB) }`,
                  cmd: `dir C:\\ /s`
                },
                meaning: ["PowerShell version gives per folder sizes but can take time."]
              }
            ],
            resultMeaning: [
              "Under 10 percent free space: expect performance and update problems.",
              "Under 5 GB free: prioritize cleanup before troubleshooting other issues."
            ]
          }
        ]
      },
      {
        id: "services",
        name: "Services",
        tasks: [
          {
            id: "service_status",
            name: "Check a service status",
            description: "Confirm a service is running and restart if needed.",
            steps: [
              {
                label: "List service state",
                admin: false,
                cmd: { powershell: `Get-Service -Name "<ServiceName>"`, cmd: `sc query "<ServiceName>"` },
                meaning: ["Replace <ServiceName> with the actual service name."]
              },
              {
                label: "Restart service",
                admin: true,
                cmd: { powershell: `Restart-Service -Name "<ServiceName>" -Force`, cmd: `net stop "<ServiceName>" && net start "<ServiceName>"` },
                meaning: ["Use only if you understand the impact."]
              }
            ],
            resultMeaning: [
              "If restart fails: check Event Viewer and service logon account permissions.",
              "If it keeps stopping: look for dependency failures and recent changes."
            ]
          }
        ]
      }
    ]
  },

  linux: {
    label: "Linux",
    categories: [
      {
        id: "network",
        name: "Networking",
        tasks: [
          {
            id: "dns_check",
            name: "DNS check",
            description: "Check resolver settings and test name resolution.",
            steps: [
              {
                label: "View DNS resolver settings",
                admin: false,
                cmd: { linux: `resolvectl status || cat /etc/resolv.conf` },
                meaning: ["Look for DNS Servers and search domains."]
              },
              {
                label: "Test name resolution",
                admin: false,
                cmd: { linux: `dig +short google.com || nslookup google.com` },
                meaning: ["If name lookup fails but pinging an IP works, it is likely DNS."]
              }
            ],
            resultMeaning: [
              "No DNS servers: configure NetworkManager or systemd resolved.",
              "Timeouts: try a different DNS server or check route and firewall."
            ]
          }
        ]
      },
      {
        id: "disk",
        name: "Disk and Storage",
        tasks: [
          {
            id: "disk_space",
            name: "Disk space check",
            description: "Check free space and find large directories.",
            steps: [
              { label: "Show free space", admin: false, cmd: { linux: `df -h` }, meaning: ["Look for filesystems near 100 percent use."] },
              { label: "Find top large folders", admin: false, cmd: { linux: `du -h --max-depth=1 | sort -hr | head -n 15` }, meaning: ["Run in /var, /home, or the app directory."] },
              { label: "List block devices", admin: false, cmd: { linux: `lsblk` }, meaning: ["Shows disks, partitions, and mount points."] }
            ],
            resultMeaning: [
              "Under 10 percent free space can cause crashes and update failures.",
              "If /var is full, logs or package cache are common causes."
            ]
          }
        ]
      },
      {
        id: "services",
        name: "Services",
        tasks: [
          {
            id: "service_status",
            name: "Check a service status",
            description: "Confirm a service is running and review logs.",
            steps: [
              { label: "Check status", admin: false, cmd: { linux: `systemctl status <service> --no-pager` }, meaning: ["Replace <service> with the service name."] },
              { label: "Restart service", admin: true, cmd: { linux: `sudo systemctl restart <service>` }, meaning: ["Use with care in production environments."] },
              { label: "View recent logs", admin: false, cmd: { linux: `journalctl -u <service> -n 60 --no-pager` }, meaning: ["Shows recent log lines for that unit."] }
            ],
            resultMeaning: [
              "Restart loops often mean config errors or missing dependencies.",
              "Permission errors can come from files, ports, or SELinux profiles."
            ]
          }
        ]
      }
    ]
  }
};

function showToast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => el.classList.remove("show"), 1200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    showToast("Copied");
  }
}

function getState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function setState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function defaultState() {
  return {
    theme: null,
    os: "windows",
    shell: "powershell",
    category: "network",
    task: "dns_check",
    search: "",
    admin: false,
    redact: true
  };
}

function categoriesFor(os) { return DATA[os].categories; }
function tasksFor(os, categoryId) {
  const cat = categoriesFor(os).find((c) => c.id === categoryId);
  return cat ? cat.tasks : [];
}
function findTask(os, categoryId, taskId) {
  return tasksFor(os, categoryId).find((t) => t.id === taskId) || null;
}

function filteredTaskOptions(os, searchText) {
  const q = (searchText || "").trim().toLowerCase();
  const result = [];
  for (const c of categoriesFor(os)) {
    for (const t of c.tasks) {
      const blob = `${c.name} ${t.name} ${t.description}`.toLowerCase();
      if (!q || blob.includes(q)) result.push({ categoryId: c.id, task: t });
    }
  }
  return result;
}

function renderCategoryOptions(os, selectedCategory) {
  const el = $("categorySelect");
  el.innerHTML = "";
  for (const c of categoriesFor(os)) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === selectedCategory) opt.selected = true;
    el.appendChild(opt);
  }
}

function renderTaskOptions(os, selectedCategory, selectedTask, searchText) {
  const el = $("taskSelect");
  el.innerHTML = "";

  const searching = (searchText || "").trim().length > 0;

  if (searching) {
    const options = filteredTaskOptions(os, searchText);
    for (const item of options) {
      const opt = document.createElement("option");
      opt.value = `${item.categoryId}:${item.task.id}`;
      const catName = categoriesFor(os).find((c) => c.id === item.categoryId)?.name || "";
      opt.textContent = `${catName} • ${item.task.name}`;
      if (`${item.categoryId}:${item.task.id}` === `${selectedCategory}:${selectedTask}`) opt.selected = true;
      el.appendChild(opt);
    }
    return;
  }

  for (const t of tasksFor(os, selectedCategory)) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    if (t.id === selectedTask) opt.selected = true;
    el.appendChild(opt);
  }
}

function shellCmd(step, state) {
  if (state.os === "linux") return step.cmd.linux;
  return step.cmd[state.shell] || "";
}

function makeTicketNote(task, state) {
  const lines = [];
  const osLabel = state.os === "windows" ? "Windows" : "Linux";
  const shellLabel = state.os === "windows" ? (state.shell === "powershell" ? "PowerShell" : "CMD") : "Shell";

  lines.push(`Task: ${task.name}`);
  lines.push(`OS: ${osLabel}`);
  lines.push(`Shell: ${shellLabel}`);
  lines.push("");
  lines.push("Run order and outputs:");

  for (const [i, step] of task.steps.entries()) {
    if (!state.admin && step.admin) continue;
    lines.push(`${i + 1}. ${step.label}`);
    lines.push(shellCmd(step, state));
    lines.push("");
  }

  lines.push("Notes:");
  for (const m of task.resultMeaning) lines.push(`- ${m}`);

  if (state.redact) {
    lines.push("");
    lines.push("Redact before sharing: usernames, hostnames, IPs, serial numbers, file paths, and emails.");
  }

  return lines.join("\n");
}

function renderTask(task, state) {
  $("taskTitle").textContent = task.name;
  $("taskMeta").textContent =
    state.os === "windows"
      ? `Windows • ${state.shell === "powershell" ? "PowerShell" : "Command Prompt"}`
      : "Linux";

  $("taskDescription").textContent = task.description;

  const stepsList = $("stepsList");
  stepsList.innerHTML = "";
  for (const step of task.steps) {
    if (!state.admin && step.admin) continue;
    const li = document.createElement("li");
    li.textContent = step.label + (step.admin ? " (admin)" : "");
    stepsList.appendChild(li);
  }

  const meaningBox = $("meaningBox");
  meaningBox.innerHTML = "";
  const ul = document.createElement("ul");
  for (const line of task.resultMeaning) {
    const li = document.createElement("li");
    li.textContent = line;
    ul.appendChild(li);
  }
  meaningBox.appendChild(ul);

  if (state.redact) {
    const p = document.createElement("p");
    p.style.margin = "10px 0 0 0";
    p.style.color = "var(--muted)";
    p.textContent = "Redact before sharing: usernames, hostnames, IPs, serial numbers, file paths, and emails.";
    meaningBox.appendChild(p);
  }

  const cmdList = $("commandList");
  cmdList.innerHTML = "";

  const cmds = [];
  for (const step of task.steps) {
    if (!state.admin && step.admin) continue;
    const cmdText = shellCmd(step, state);
    cmds.push(cmdText);

    const wrap = document.createElement("div");
    wrap.className = "cmd";

    const top = document.createElement("div");
    top.className = "cmd-top";

    const left = document.createElement("div");
    left.innerHTML = `<div class="cmd-label">${step.label}</div><div class="cmd-note">${step.admin ? "Admin recommended" : "Standard"}</div>`;

    const right = document.createElement("button");
    right.className = "copy-mini";
    right.type = "button";
    right.textContent = "Copy";
    right.addEventListener("click", () => copyText(cmdText));

    top.appendChild(left);
    top.appendChild(right);
    wrap.appendChild(top);

    const pre = document.createElement("pre");
    pre.textContent = cmdText;
    wrap.appendChild(pre);

    if (step.meaning?.length) {
      const note = document.createElement("div");
      note.style.marginTop = "10px";
      note.style.color = "var(--muted)";
      note.style.fontSize = "13px";
      note.innerHTML = `<strong style="color: var(--text)">What to look for:</strong><ul style="margin:8px 0 0 0; padding-left:18px;"></ul>`;
      const inner = note.querySelector("ul");
      for (const line of step.meaning) {
        const li = document.createElement("li");
        li.textContent = line;
        inner.appendChild(li);
      }
      wrap.appendChild(note);
    }

    cmdList.appendChild(wrap);
  }

  $("hintText").textContent =
    state.os === "windows"
      ? "Tip: Replace placeholders like <ServiceName> or <PID> before running."
      : "Tip: Replace placeholders like <service> before running.";

  $("copyAllBtn").onclick = () => copyText(cmds.filter(Boolean).join("\n\n"));
  $("copyTicketBtn").onclick = () => copyText(makeTicketNote(task, state));
}

function applyTheme(theme) {
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

function init() {
  $("githubLink").href = CONFIG.github;

  const saved = getState();
  const state = { ...defaultState(), ...(saved || {}) };

  if (!state.theme) {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    state.theme = prefersDark ? "dark" : "light";
  }
  applyTheme(state.theme);

  $("osSelect").value = state.os;
  $("shellSelect").value = state.shell;
  $("adminToggle").checked = state.admin;
  $("redactToggle").checked = state.redact;
  $("searchInput").value = state.search || "";

  function syncShellVisibility() {
    $("shellField").style.display = state.os === "windows" ? "block" : "none";
  }

  function syncOptions() {
    renderCategoryOptions(state.os, state.category);

    const cats = categoriesFor(state.os);
    if (!cats.find((c) => c.id === state.category)) state.category = cats[0].id;

    const tasks = tasksFor(state.os, state.category);
    if (!tasks.find((t) => t.id === state.task)) state.task = tasks[0].id;

    renderTaskOptions(state.os, state.category, state.task, state.search);
  }

  function readSelectedTaskId() {
    const searching = (state.search || "").trim().length > 0;
    const raw = $("taskSelect").value;

    if (searching) {
      const [catId, taskId] = raw.split(":");
      if (catId && taskId) {
        state.category = catId;
        state.task = taskId;
      }
    } else {
      state.task = raw;
    }
  }

  function update() {
    syncShellVisibility();
    syncOptions();

    const task = findTask(state.os, state.category, state.task);
    if (task) renderTask(task, state);

    setState(state);
  }

  $("osSelect").addEventListener("change", (e) => {
    state.os = e.target.value;
    state.search = "";
    $("searchInput").value = "";
    state.category = categoriesFor(state.os)[0].id;
    state.task = tasksFor(state.os, state.category)[0].id;
    update();
  });

  $("shellSelect").addEventListener("change", (e) => {
    state.shell = e.target.value;
    update();
  });

  $("categorySelect").addEventListener("change", (e) => {
    state.category = e.target.value;
    state.task = tasksFor(state.os, state.category)[0].id;
    update();
  });

  $("taskSelect").addEventListener("change", () => {
    readSelectedTaskId();
    update();
  });

  $("searchInput").addEventListener("input", (e) => {
    state.search = e.target.value;
    const options = filteredTaskOptions(state.os, state.search);
    if (options.length) {
      state.category = options[0].categoryId;
      state.task = options[0].task.id;
    }
    update();
  });

  $("adminToggle").addEventListener("change", (e) => {
    state.admin = e.target.checked;
    update();
  });

  $("redactToggle").addEventListener("change", (e) => {
    state.redact = e.target.checked;
    update();
  });

  $("themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme(state.theme);
    setState(state);
  });

  update();
}

init();
