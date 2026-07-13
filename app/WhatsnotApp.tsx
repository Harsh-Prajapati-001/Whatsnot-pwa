"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { replaySafeActions } from "./pwa-queue";

type Route = "dashboard" | "workspaces" | "deployments" | "monitoring" | "logs" | "billing" | "team" | "api-keys" | "integrations" | "settings";
type IconName = "grid" | "box" | "rocket" | "pulse" | "terminal" | "card" | "users" | "key" | "plug" | "gear" | "search" | "bell" | "plus" | "chevron" | "check" | "close" | "more" | "arrow" | "download";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type StandaloneNavigator = Navigator & { standalone?: boolean };

const nav: { route: Route; label: string; icon: IconName }[] = [
  { route: "dashboard", label: "Overview", icon: "grid" },
  { route: "workspaces", label: "Workspaces", icon: "box" },
  { route: "deployments", label: "Deployments", icon: "rocket" },
  { route: "monitoring", label: "Monitoring", icon: "pulse" },
  { route: "logs", label: "Logs", icon: "terminal" },
  { route: "billing", label: "Billing", icon: "card" },
  { route: "team", label: "Team", icon: "users" },
  { route: "api-keys", label: "API Keys", icon: "key" },
  { route: "integrations", label: "Integrations", icon: "plug" },
  { route: "settings", label: "Settings", icon: "gear" },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></>,
    rocket: <><path d="M14.5 5.5c2.5-2.5 5.7-2.4 5.7-2.4s.1 3.2-2.4 5.7l-6.1 6.1-4.3.9.9-4.3 6.2-6Z"/><circle cx="16" cy="7" r="1.5"/><path d="M7.8 12.2 4 13l-2 3 5.3.7M13.4 17.2 12.7 22l-3 2-1.2-5.5"/></>,
    pulse: <><path d="M3 12h4l2.2-6 4.1 12 2.1-6H21"/><circle cx="12" cy="12" r="9"/></>,
    terminal: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3M13 15h4"/></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/></>,
    users: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
    key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M15 8l3 3M18 5l3 3"/></>,
    plug: <><path d="M12 22v-5M9 8V2M15 8V2M6 8h12v3a6 6 0 0 1-12 0V8Z"/></>,
    gear: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, chevron: <path d="m9 18 6-6-6-6"/>, check: <path d="m5 12 4 4L19 6"/>, close: <path d="M6 6l12 12M18 6 6 18"/>, more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>, arrow: <path d="m9 18 6-6-6-6"/>, download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const activity = [
  { icon: "rocket", tone: "indigo", title: "Deployment completed", body: "Production · v2.4.1", time: "2m ago" },
  { icon: "pulse", tone: "green", title: "Webhook health restored", body: "checkout-events", time: "18m ago" },
  { icon: "users", tone: "blue", title: "Maya joined the workspace", body: "Developer role", time: "1h ago" },
  { icon: "key", tone: "amber", title: "API key rotated", body: "Production API", time: "3h ago" },
] as const;

const workspaceRows = [
  { name: "Commerce production", tag: "Production", region: "Singapore", status: "Running", health: 99.99, messages: "1.84M", updated: "2m ago" },
  { name: "Support automation", tag: "Production", region: "Frankfurt", status: "Running", health: 99.97, messages: "642K", updated: "14m ago" },
  { name: "Marketing sandbox", tag: "Development", region: "Virginia", status: "Updating", health: 99.81, messages: "84K", updated: "1h ago" },
] as const;

function routeFromPath(): Route {
  if (typeof window === "undefined") return "dashboard";
  const part = window.location.pathname.split("/").filter(Boolean)[0];
  return nav.some((item) => item.route === part) ? part as Route : "dashboard";
}

function Status({ children, tone = "success" }: { children: React.ReactNode; tone?: "success" | "info" | "warning" | "neutral" }) {
  return <span className={`status status-${tone}`}><span />{children}</span>;
}

function Sparkline({ color = "#4f46e5", variant = 0 }: { color?: string; variant?: number }) {
  const points = variant === 1 ? "0,42 18,38 36,40 54,26 72,30 90,16 108,18 126,6" : variant === 2 ? "0,18 18,22 36,15 54,28 72,20 90,34 108,29 126,36" : "0,38 18,32 36,35 54,20 72,25 90,12 108,16 126,5";
  return <svg className="spark" viewBox="0 0 126 48" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={`fade${variant}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".2"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs><polygon points={`${points} 126,48 0,48`} fill={`url(#fade${variant})`}/><polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>;
}

function MetricCard({ label, value, change, icon, color, variant }: { label: string; value: string; change: string; icon: IconName; color: string; variant: number }) {
  return <article className="metric-card"><div className="metric-head"><span className="metric-icon" style={{ color, background: `${color}12` }}><Icon name={icon}/></span><span className="metric-change">↗ {change}</span></div><p>{label}</p><strong>{value}</strong><Sparkline color={color} variant={variant}/></article>;
}

function Overview({ onNavigate }: { onNavigate: (r: Route) => void }) {
  return <>
    <div className="page-heading"><div><div className="eyebrow">Workspace overview</div><h1>Good morning, Harsh</h1><p>Here’s what’s happening across Commerce production.</p></div><div className="heading-actions"><button className="button secondary"><Icon name="download"/> Export</button><button className="button primary" data-open-launch><Icon name="plus"/> Launch workspace</button></div></div>
    <section className="metrics" aria-label="Workspace metrics">
      <MetricCard label="Messages processed" value="1.84M" change="12.8%" icon="arrow" color="#4f46e5" variant={0}/>
      <MetricCard label="Webhook success" value="99.98%" change="0.4%" icon="check" color="#16a34a" variant={1}/>
      <MetricCard label="API latency" value="184ms" change="8.2% faster" icon="pulse" color="#0ea5e9" variant={2}/>
      <MetricCard label="Monthly cost" value="$284.60" change="4.1%" icon="card" color="#8b5cf6" variant={0}/>
    </section>
    <div className="overview-grid">
      <section className="panel chart-panel"><div className="panel-head"><div><h2>Message volume</h2><p>Processed messages over the last 7 days</p></div><div className="segmented"><button className="active">7D</button><button>30D</button><button>90D</button></div></div><div className="chart-wrap"><div className="y-labels"><span>400k</span><span>300k</span><span>200k</span><span>100k</span><span>0</span></div><div className="line-chart" role="img" aria-label="Message volume rises from 180 thousand to 340 thousand messages over seven days"><div className="grid-lines"><i/><i/><i/><i/><i/></div><svg viewBox="0 0 700 220" preserveAspectRatio="none"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#4f46e5" stopOpacity=".18"/><stop offset="1" stopColor="#4f46e5" stopOpacity="0"/></linearGradient></defs><path d="M0 166 C60 155 80 120 130 130 S220 154 270 102 S350 96 405 113 S500 80 550 89 S620 38 700 47 L700 220 L0 220Z" fill="url(#chartFill)"/><path d="M0 166 C60 155 80 120 130 130 S220 154 270 102 S350 96 405 113 S500 80 550 89 S620 38 700 47" fill="none" stroke="#4f46e5" strokeWidth="3" vectorEffect="non-scaling-stroke"/><circle cx="700" cy="47" r="5" fill="#fff" stroke="#4f46e5" strokeWidth="3"/></svg><div className="x-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></div></section>
      <section className="panel health-panel"><div className="panel-head"><div><h2>Deployment health</h2><p>Production · Singapore</p></div><Status>Healthy</Status></div><div className="health-score"><div className="score-ring"><strong>99.99</strong><span>uptime</span></div></div><div className="health-list"><div><span><i className="dot green"/>API service</span><b>Operational</b></div><div><span><i className="dot green"/>Message workers</span><b>8 / 8 healthy</b></div><div><span><i className="dot green"/>Redis queue</span><b>12ms latency</b></div><div><span><i className="dot green"/>Webhooks</span><b>99.98% success</b></div></div><button className="text-button" onClick={() => onNavigate("monitoring")}>View monitoring <Icon name="chevron" size={15}/></button></section>
    </div>
    <div className="bottom-grid">
      <section className="panel activity-panel"><div className="panel-head"><div><h2>Recent activity</h2><p>Latest changes across your workspace</p></div><button className="icon-button" aria-label="More activity options"><Icon name="more"/></button></div><div className="activity-list">{activity.map((item) => <div className="activity-row" key={item.title}><span className={`activity-icon ${item.tone}`}><Icon name={item.icon}/></span><div><strong>{item.title}</strong><p>{item.body}</p></div><time>{item.time}</time></div>)}</div><button className="text-button full">View all activity <Icon name="chevron" size={15}/></button></section>
      <section className="panel quick-panel"><div className="panel-head"><div><h2>Quick actions</h2><p>Common workspace tasks</p></div></div><div className="quick-list"><button data-open-launch><span className="quick-icon indigo"><Icon name="rocket"/></span><span><strong>Launch a workspace</strong><small>Connect Meta and deploy in minutes</small></span><Icon name="chevron"/></button><button onClick={() => onNavigate("deployments")}><span className="quick-icon blue"><Icon name="pulse"/></span><span><strong>View deployment</strong><small>Inspect status, logs, and health</small></span><Icon name="chevron"/></button><button onClick={() => onNavigate("api-keys")}><span className="quick-icon violet"><Icon name="key"/></span><span><strong>Create an API key</strong><small>Securely connect your services</small></span><Icon name="chevron"/></button></div></section>
    </div>
  </>;
}

function Workspaces() {
  return <><div className="page-heading"><div><div className="eyebrow">Infrastructure</div><h1>Workspaces</h1><p>Manage environments, deployments, and connected resources.</p></div><button className="button primary" data-open-launch><Icon name="plus"/> Launch workspace</button></div><section className="panel table-panel"><div className="table-tools"><label className="table-search"><Icon name="search"/><input aria-label="Search workspaces" placeholder="Search workspaces"/></label><button className="button secondary">All statuses <span>⌄</span></button><span className="table-count">3 workspaces</span></div><div className="data-table" role="table"><div className="table-row table-header" role="row"><span>Workspace</span><span>Region</span><span>Status</span><span>Health</span><span>Messages</span><span>Updated</span><span/></div>{workspaceRows.map((row) => <div className="table-row" role="row" key={row.name}><span className="workspace-cell"><i>{row.name.charAt(0)}</i><span><strong>{row.name}</strong><small>{row.tag}</small></span></span><span>{row.region}</span><span><Status tone={row.status === "Updating" ? "info" : "success"}>{row.status}</Status></span><span><strong>{row.health}%</strong></span><span>{row.messages}</span><span>{row.updated}</span><button className="icon-button" aria-label={`Actions for ${row.name}`}><Icon name="more"/></button></div>)}</div></section></>;
}

const bars = [42,55,48,72,66,83,74,88,76,92,81,95,78,88,72,84,68,76,90,82,94,86,78,89];
function Monitoring() {
  return <><div className="page-heading"><div><div className="eyebrow">Live operations</div><h1>Monitoring</h1><p>All systems operational · Auto-refreshing every 30 seconds.</p></div><div className="heading-actions"><Status>Live</Status><button className="button secondary">Last 24 hours ⌄</button></div></div><section className="resource-grid">{[{l:"CPU usage",v:"38%",s:"2.4 vCPU available",c:"#4f46e5"},{l:"Memory",v:"2.8 GB",s:"of 8 GB allocated",c:"#0ea5e9"},{l:"Queue depth",v:"124",s:"-18% from average",c:"#16a34a"},{l:"Worker health",v:"8 / 8",s:"All workers healthy",c:"#8b5cf6"}].map((m,i)=><article className="panel resource-card" key={m.l}><p>{m.l}</p><strong>{m.v}</strong><small>{m.s}</small><div className="mini-bars">{bars.slice(i*5,i*5+10).map((h,j)=><i key={j} style={{height:`${h}%`,background:m.c}}/>)}</div></article>)}</section><section className="panel monitor-panel"><div className="panel-head"><div><h2>API response time</h2><p>P50, P95, and P99 latency across all endpoints</p></div><div className="legend"><span><i className="indigo"/>P50 84ms</span><span><i className="blue"/>P95 184ms</span><span><i className="violet"/>P99 296ms</span></div></div><div className="latency-chart"><div className="grid-lines"><i/><i/><i/><i/><i/></div>{["296ms","225ms","150ms","75ms","0"].map(x=><span key={x}>{x}</span>)}<svg viewBox="0 0 900 260" preserveAspectRatio="none"><path d="M0 130 C90 105 125 145 205 115 S350 150 430 98 S570 130 650 72 S780 102 900 60" fill="none" stroke="#8b5cf6" strokeWidth="2"/><path d="M0 180 C80 164 150 190 230 156 S380 177 465 148 S600 170 690 130 S810 150 900 125" fill="none" stroke="#0ea5e9" strokeWidth="2"/><path d="M0 220 C110 205 160 225 260 204 S400 215 500 194 S660 210 760 184 S840 194 900 176" fill="none" stroke="#4f46e5" strokeWidth="2"/></svg></div></section></>;
}

function Deployments() {
  const stages = ["Preparing", "Building", "Launching", "Ready"];
  return <><div className="page-heading"><div><div className="eyebrow">Commerce production</div><h1>Deployment</h1><p>Version 2.4.1 · Railway · Singapore</p></div><div className="heading-actions"><button className="button secondary">Restart</button><button className="button primary">Scale workers</button></div></div><section className="panel deploy-summary"><div><Status>Running</Status><h2>Production is healthy</h2><p>Deployed 2 minutes ago by Harsh Kumar. All health checks passed.</p></div><dl><div><dt>Build</dt><dd>#bld_84f29</dd></div><div><dt>Workers</dt><dd>8 active</dd></div><div><dt>Region</dt><dd>ap-southeast</dd></div><div><dt>Runtime</dt><dd>Node.js 22</dd></div></dl></section><section className="panel timeline-panel"><div className="panel-head"><div><h2>Deployment timeline</h2><p>Completed in 3 minutes 42 seconds</p></div></div><div className="deploy-timeline">{stages.map((stage,i)=><div className="deploy-stage" key={stage}><span><Icon name="check"/></span><div><strong>{stage}</strong><small>{["Configuration validated","Image built successfully","Services started","Health checks passed"][i]}</small></div>{i<3&&<i/>}</div>)}</div></section><section className="panel env-panel"><div className="panel-head"><div><h2>Environment variables</h2><p>Secrets are encrypted and never displayed after creation.</p></div><button className="button secondary"><Icon name="plus"/> Add variable</button></div>{["META_ACCESS_TOKEN","PHONE_NUMBER_ID","WABA_ID","WEBHOOK_VERIFY_TOKEN","REDIS_URL"].map((k,i)=><div className="env-row" key={k}><code>{k}</code><span>{i === 1 ? "•••• 8472" : "••••••••••••••••"}</span><Status tone="neutral">Encrypted</Status><button className="icon-button"><Icon name="more"/></button></div>)}</section></>;
}

function Logs({ offline }: { offline: boolean }) {
  const lines = [
    ["12:42:18.492","INFO","webhook","Inbound webhook verified","req_7df218"],
    ["12:42:18.618","INFO","queue","Message job enqueued","job_29ac84"],
    ["12:42:18.942","INFO","worker-04","Job processed in 284ms","job_29ac84"],
    ["12:42:19.104","WARN","meta-api","Rate limit at 82% capacity","req_34ba11"],
    ["12:42:20.256","INFO","webhook","Delivery receipt processed","req_2cc910"],
    ["12:42:21.040","INFO","worker-02","Job processed in 192ms","job_7f481c"],
  ];
  if (offline) return <OfflineFallback title="Live logs are unavailable offline" body="Logs can contain sensitive, real-time data and are never stored on this device."/>;
  return <><div className="page-heading"><div><div className="eyebrow">Live stream</div><h1>Logs explorer</h1><p>Search application, deployment, and webhook events.</p></div><button className="button secondary"><Icon name="download"/> Export CSV</button></div><section className="log-shell"><div className="log-tools"><label><Icon name="search"/><input placeholder="Search logs, request IDs, or services"/></label><button>All levels ⌄</button><button>All services ⌄</button><span><i/> Live</span></div><div className="log-window" role="log" aria-label="Live application logs">{lines.map((l,i)=><div className="log-line" key={i}><time>{l[0]}</time><b className={l[1] === "WARN" ? "warn" : "info"}>{l[1]}</b><span>{l[2]}</span><p>{l[3]}</p><code>{l[4]}</code></div>)}</div><div className="log-footer"><span>Retention: 14 days</span><span>6 events · Auto-scroll on</span></div></section></>;
}

function Billing() {
  return <><div className="page-heading"><div><div className="eyebrow">Plan and usage</div><h1>Billing</h1><p>Manage your subscription, usage, and invoices.</p></div><button className="button primary">Manage plan</button></div><div className="billing-grid"><section className="panel plan-card"><div><span className="plan-label">PRO PLAN</span><h2>$99 <small>/ month</small></h2><p>Renews on August 12, 2026</p></div><Status>Active</Status><hr/><div className="quota"><div><span>Messages</span><b>1.84M / 3M</b></div><progress value="61" max="100"/><div><span>API requests</span><b>6.2M / 10M</b></div><progress value="62" max="100"/><div><span>Workspaces</span><b>3 / 5</b></div><progress value="60" max="100"/></div></section><section className="panel cost-card"><div className="panel-head"><div><h2>Estimated total</h2><p>Current billing period</p></div></div><strong>$284.60</strong><div className="cost-breakdown"><div><span>Base plan</span><b>$99.00</b></div><div><span>Message overage</span><b>$128.40</b></div><div><span>Worker compute</span><b>$57.20</b></div></div></section></div><section className="panel invoices"><div className="panel-head"><div><h2>Invoice history</h2><p>Download invoices and payment receipts.</p></div></div>{[["July 2026","$264.80","Paid"],["June 2026","$248.20","Paid"],["May 2026","$231.60","Paid"]].map(x=><div className="invoice-row" key={x[0]}><span className="invoice-icon"><Icon name="card"/></span><div><strong>{x[0]}</strong><small>PDF invoice · Visa ending 4242</small></div><b>{x[1]}</b><Status>{x[2]}</Status><button className="icon-button" aria-label={`Download ${x[0]} invoice`}><Icon name="download"/></button></div>)}</section></>;
}

function Team() {
  const people = [["HK","Harsh Kumar","harsh@whatsnot.io","Owner"],["MS","Maya Singh","maya@whatsnot.io","Developer"],["AR","Aarav Rao","aarav@whatsnot.io","Operator"],["SL","Sara Lee","sara@whatsnot.io","Viewer"]];
  return <><div className="page-heading"><div><div className="eyebrow">Organization</div><h1>Team</h1><p>Manage members, roles, and workspace access.</p></div><button className="button primary"><Icon name="plus"/> Invite member</button></div><section className="panel members"><div className="table-tools"><label className="table-search"><Icon name="search"/><input placeholder="Search members"/></label><span className="table-count">4 members · 1 pending</span></div>{people.map((p,i)=><div className="member-row" key={p[1]}><span className={`avatar av-${i}`}>{p[0]}</span><div><strong>{p[1]}{i===0&&<small className="you">You</small>}</strong><p>{p[2]}</p></div><select aria-label={`Role for ${p[1]}`} defaultValue={p[3]} disabled={i===0}><option>Owner</option><option>Admin</option><option>Developer</option><option>Operator</option><option>Viewer</option></select><Status>{i===0?"MFA enabled":"Active"}</Status><button className="icon-button"><Icon name="more"/></button></div>)}</section></>;
}

function ApiKeys({ offline }: { offline: boolean }) {
  return <><div className="page-heading"><div><div className="eyebrow">Developer access</div><h1>API keys</h1><p>Keys are revealed once and stored as secure hashes.</p></div><button className="button primary" disabled={offline} title={offline ? "Unavailable offline" : ""}><Icon name="plus"/> Create API key</button></div><div className="security-note"><span><Icon name="key"/></span><div><strong>Keep your API keys secure</strong><p>Never expose keys in client-side code. Rotate any key you suspect has been compromised.</p></div></div><section className="panel key-list">{[["Production API","wn_live_••••9K2F","All scopes","2 minutes ago"],["Analytics read-only","wn_live_••••4M8Q","metrics:read","3 days ago"],["CI deployment","wn_live_••••7A1P","deployments:write","12 days ago"]].map((k,i)=><div className="key-row" key={k[0]}><span className="key-icon"><Icon name="key"/></span><div><strong>{k[0]}</strong><code>{k[1]}</code></div><div><small>SCOPES</small><span>{k[2]}</span></div><div><small>LAST USED</small><span>{k[3]}</span></div><Status tone={i===2?"warning":"success"}>{i===2?"Expires in 8d":"Active"}</Status><button className="icon-button"><Icon name="more"/></button></div>)}</section></>;
}

function Integrations() {
  const integrations = [["M","Meta WhatsApp","Connected","WhatsApp Cloud API and embedded signup","indigo"],["R","Railway","Connected","Secure BYOC deployment infrastructure","violet"],["S","Slack","Available","Send operational alerts to your team","blue"],["Z","Zapier","Available","Connect Whatsnot to 6,000+ apps","amber"]];
  return <><div className="page-heading"><div><div className="eyebrow">Marketplace</div><h1>Integrations</h1><p>Connect the tools your team uses every day.</p></div></div><div className="integration-grid">{integrations.map((x,i)=><article className="panel integration-card" key={x[1]}><span className={`integration-logo ${x[4]}`}>{x[0]}</span><Status tone={i<2?"success":"neutral"}>{x[2]}</Status><h2>{x[1]}</h2><p>{x[3]}</p><button className={`button ${i<2?"secondary":"primary"}`}>{i<2?"Manage":"Connect"}</button></article>)}</div></>;
}

function Settings({ onInstall, onPush, installed, pushState }: { onInstall: () => void; onPush: () => void; installed: boolean; pushState: string }) {
  return <><div className="page-heading"><div><div className="eyebrow">Preferences</div><h1>Settings</h1><p>Manage workspace defaults, security, and notifications.</p></div></div><div className="settings-layout"><aside className="settings-nav"><button className="active">General</button><button>Security</button><button>Notifications</button><button>Appearance</button><button>Data and privacy</button><button className="danger-link">Danger zone</button></aside><section className="panel settings-panel"><div className="setting-section"><h2>Application</h2><p>Install Whatsnot for faster access and offline-ready dashboards.</p><div className="setting-row"><div><strong>Install Whatsnot</strong><span>Use Whatsnot in a focused standalone window.</span></div><button className="button secondary" onClick={onInstall} disabled={installed}>{installed ? "Installed" : "Install app"}</button></div><div className="setting-row"><div><strong>Push notifications</strong><span>Receive critical deployment, webhook, and security alerts.</span></div><button className="button secondary" onClick={onPush}>{pushState === "granted" ? "Enabled" : "Enable push"}</button></div></div><div className="setting-section"><h2>Workspace defaults</h2><div className="field-grid"><label>Default region<select defaultValue="Singapore"><option>Singapore</option><option>Frankfurt</option><option>Virginia</option></select></label><label>Timezone<select defaultValue="Asia/Kolkata"><option>Asia/Kolkata</option><option>UTC</option><option>America/New_York</option></select></label></div><label className="switch-row"><span><strong>Weekly operations digest</strong><small>Receive a weekly summary every Monday.</small></span><input type="checkbox" defaultChecked/><i/></label><label className="switch-row"><span><strong>Deployment completion alerts</strong><small>Notify me when deployments finish.</small></span><input type="checkbox" defaultChecked/><i/></label></div><div className="settings-actions"><span>Changes save automatically</span><Status>Saved</Status></div></section></div></>;
}

function OfflineFallback({ title, body }: { title: string; body: string }) {
  return <div className="offline-fallback"><span><Icon name="pulse" size={28}/></span><h1>{title}</h1><p>{body}</p><button className="button primary" onClick={() => window.location.reload()}>Try again</button></div>;
}

function GenericRoute({ route }: { route: Route }) {
  return <OfflineFallback title={`${nav.find(n=>n.route===route)?.label} is ready`} body="This module is connected to the shared Whatsnot application shell."/>;
}

export function WhatsnotApp() {
  const [route, setRoute] = useState<Route>("dashboard");
  const [online, setOnline] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchStep, setLaunchStep] = useState(1);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosGuide, setIosGuide] = useState(false);
  const [pushExplainer, setPushExplainer] = useState(false);
  const [pushState, setPushState] = useState("default");
  const [updateReady, setUpdateReady] = useState<ServiceWorker | null>(null);
  const [queued, setQueued] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const navigate = useCallback((next: Route) => {
    setRoute(next); setSidebarOpen(false); setCommandOpen(false);
    const path = next === "dashboard" ? "/dashboard" : `/${next}`;
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setRoute(routeFromPath());
      setOnline(navigator.onLine);
      setPushState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
      setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as StandaloneNavigator).standalone === true);
    });
    const onPop = () => setRoute(routeFromPath());
    const onOnline = () => { setOnline(true); replaySafeActions().then(() => setQueued(0)).catch(() => undefined); };
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setDeferredPrompt(event as BeforeInstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null); };
    window.addEventListener("popstate", onPop); window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline); window.addEventListener("beforeinstallprompt", onInstall); window.addEventListener("appinstalled", onInstalled);
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen(v => !v); } if (e.key === "Escape") { setCommandOpen(false); setNotificationsOpen(false); setIosGuide(false); setPushExplainer(false); setLaunchOpen(false); } };
    window.addEventListener("keydown", key);
    const openLaunch = (e: Event) => { if ((e.target as Element).closest("[data-open-launch]")) { setLaunchOpen(true); setLaunchStep(1); } };
    document.addEventListener("click", openLaunch);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(reg => {
      const watch = (worker?: ServiceWorker | null) => { if (!worker) return; worker.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(worker); }); };
      watch(reg.installing); reg.addEventListener("updatefound", () => watch(reg.installing));
      navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
      navigator.serviceWorker.addEventListener("message", (event) => { if (event.data?.type === "SYNC_SAFE_ACTIONS") replaySafeActions().then(() => setQueued(0)).catch(() => undefined); });
    }).catch(() => undefined);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener("beforeinstallprompt", onInstall); window.removeEventListener("appinstalled", onInstalled); window.removeEventListener("keydown", key); document.removeEventListener("click", openLaunch); };
  }, []);

  const install = async () => {
    if (deferredPrompt) { await deferredPrompt.prompt(); const result = await deferredPrompt.userChoice; if (result.outcome === "accepted") setInstalled(true); setDeferredPrompt(null); return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); if (ios) setIosGuide(true); else alert("Use your browser menu and choose ‘Install Whatsnot’ or ‘Install app’.");
  };
  const enablePush = async () => { if (pushState === "granted") return; setPushExplainer(true); };
  const requestPush = async () => { const result = await Notification.requestPermission(); setPushState(result); setPushExplainer(false); };
  const currentLabel = nav.find(item => item.route === route)?.label ?? "Overview";
  const content = (() => {
    if (route === "dashboard") return <Overview onNavigate={navigate}/>;
    if (route === "workspaces") return <Workspaces/>;
    if (route === "deployments") return <Deployments/>;
    if (route === "monitoring") return <Monitoring/>;
    if (route === "logs") return <Logs offline={!online}/>;
    if (route === "billing") return <Billing/>;
    if (route === "team") return <Team/>;
    if (route === "api-keys") return <ApiKeys offline={!online}/>;
    if (route === "integrations") return <Integrations/>;
    if (route === "settings") return <Settings onInstall={install} onPush={enablePush} installed={installed} pushState={pushState}/>;
    return <GenericRoute route={route}/>;
  })();

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Primary navigation"><div className="brand"><span className="brand-mark">W</span><span>Whatsnot</span><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><Icon name="close"/></button></div><div className="org-switcher"><span className="org-avatar">NO</span><span><strong>Northstar Ops</strong><small>Pro plan</small></span><span>⌄</span></div><nav><p>Workspace</p>{nav.slice(0,6).map(item => <button key={item.route} onClick={() => navigate(item.route)} className={route === item.route ? "active" : ""} aria-current={route === item.route ? "page" : undefined}><Icon name={item.icon}/><span>{item.label}</span>{item.route === "logs" && <i className="live-dot"/>}</button>)}<p>Manage</p>{nav.slice(6).map(item => <button key={item.route} onClick={() => navigate(item.route)} className={route === item.route ? "active" : ""} aria-current={route === item.route ? "page" : undefined}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav><div className="sidebar-footer"><div className="usage"><div><span>Message usage</span><strong>61%</strong></div><progress value="61" max="100"/><small>1.84M of 3M messages</small></div><button className="support"><span>?</span><span><strong>Help & support</strong><small>Docs and contact</small></span><Icon name="chevron"/></button></div></aside>
    {sidebarOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}/>} 
    <div className="app-main"><header className="topbar"><button className="menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><span/><span/><span/></button><div className="breadcrumb"><span>Commerce production</span><Icon name="chevron" size={14}/><strong>{currentLabel}</strong></div><button className="global-search" onClick={() => setCommandOpen(true)}><Icon name="search"/><span>Search anything…</span><kbd>⌘ K</kbd></button><div className="top-actions"><button className="icon-button install-button" onClick={install} aria-label="Install Whatsnot" title="Install Whatsnot"><Icon name="download"/></button><button className="icon-button notification-button" onClick={() => setNotificationsOpen(v=>!v)} aria-label="Notifications"><Icon name="bell"/><i/></button><span className="divider"/><button className="profile-button"><span className="avatar">HK</span><span><strong>Harsh Kumar</strong><small>Owner</small></span><span>⌄</span></button></div></header>
      {!online && <div className="offline-banner"><span>Offline</span><p>You’re viewing saved operational data. Live and destructive actions are unavailable.</p><small>Last updated 2 minutes ago</small></div>}
      {queued > 0 && <div className="queued-banner">{queued} change queued. It will sync when you’re back online.</div>}
      <main id="main-content">{content}</main>
    </div>
    {notificationsOpen && <div className="drawer notification-drawer"><div className="drawer-head"><div><h2>Notifications</h2><p>3 unread updates</p></div><button className="icon-button" onClick={() => setNotificationsOpen(false)}><Icon name="close"/></button></div>{[["Deployment completed","Commerce production is running v2.4.1","2m","success"],["Queue threshold recovered","Queue depth returned below 500","18m","info"],["Security recommendation","Enable MFA for two team members","1h","warning"]].map(n=><button className="notification-item" key={n[0]}><span className={`notification-state ${n[3]}`}/><span><strong>{n[0]}</strong><p>{n[1]}</p><time>{n[2]} ago</time></span></button>)}<button className="text-button full">Open notification center <Icon name="chevron" size={15}/></button></div>}
    {commandOpen && <div className="modal-layer" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setCommandOpen(false); }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette"><label><Icon name="search"/><input ref={searchRef} autoFocus placeholder="Search pages and actions…"/><kbd>ESC</kbd></label><p>Navigate</p>{nav.map((item,i)=><button key={item.route} onClick={() => navigate(item.route)}><span className="command-icon"><Icon name={item.icon}/></span><span>{item.label}</span>{i<4&&<kbd>G {i+1}</kbd>}<Icon name="chevron"/></button>)}</section></div>}
    {launchOpen && <div className="modal-layer"><section className="launch-modal" role="dialog" aria-modal="true" aria-labelledby="launch-title"><div className="modal-head"><div><span>Step {launchStep} of 4</span><h2 id="launch-title">{["Workspace details","Connect Meta","Deployment target","Ready to launch"][launchStep-1]}</h2></div>{launchStep<4&&<button className="icon-button" onClick={()=>setLaunchOpen(false)}><Icon name="close"/></button>}</div><div className="stepper">{[1,2,3,4].map(s=><span className={s<=launchStep?"active":""} key={s}>{s<launchStep?<Icon name="check" size={14}/>:s}</span>)}</div><div className="modal-body">{launchStep===1&&<><label>Workspace name<input autoFocus defaultValue="Commerce automation"/></label><label>Environment<select defaultValue="Production"><option>Production</option><option>Development</option></select></label><label>Region<select defaultValue="Singapore"><option>Singapore</option><option>Frankfurt</option><option>Virginia</option></select></label></>}{launchStep===2&&<div className="connect-box"><span className="integration-logo indigo">M</span><h3>Connect Meta WhatsApp</h3><p>Authorize access to your WhatsApp Business Account. We never store message content.</p><button className="button secondary"><Icon name="plug"/> Continue with Meta</button><Status>Demo account connected</Status></div>}{launchStep===3&&<><label>Deployment provider<select defaultValue="Railway"><option>Railway</option><option>Bring your own cloud</option></select></label><label>Worker size<select defaultValue="Standard · 2 vCPU · 4 GB"><option>Standard · 2 vCPU · 4 GB</option><option>Performance · 4 vCPU · 8 GB</option></select></label><div className="estimate"><span>Estimated monthly total</span><strong>$89–$124</strong></div></>}{launchStep===4&&<div className="launch-ready"><span><Icon name="rocket" size={32}/></span><h3>Everything looks good</h3><p>Your workspace will be prepared, built, launched, and health-checked automatically.</p><dl><div><dt>Workspace</dt><dd>Commerce automation</dd></div><div><dt>Region</dt><dd>Singapore</dd></div><div><dt>Provider</dt><dd>Railway</dd></div></dl></div>}</div><div className="modal-actions">{launchStep>1&&<button className="button secondary" onClick={()=>setLaunchStep(s=>s-1)}>Back</button>}<button className="button primary" onClick={()=>{if(launchStep<4)setLaunchStep(s=>s+1);else{setLaunchOpen(false);navigate("deployments");}}}>{launchStep===4?"Launch workspace":"Continue"}<Icon name="arrow"/></button></div></section></div>}
    {iosGuide && <div className="modal-layer"><section className="sheet"><button className="icon-button" onClick={()=>setIosGuide(false)}><Icon name="close"/></button><span className="sheet-icon"><Icon name="download" size={28}/></span><h2>Install Whatsnot on iOS</h2><ol><li>Tap the Share button in Safari.</li><li>Scroll and choose “Add to Home Screen”.</li><li>Tap “Add” to finish.</li></ol></section></div>}
    {pushExplainer && <div className="modal-layer"><section className="sheet"><button className="icon-button" onClick={()=>setPushExplainer(false)}><Icon name="close"/></button><span className="sheet-icon"><Icon name="bell" size={28}/></span><h2>Stay ahead of critical issues</h2><p>Whatsnot can send deployment failures, webhook incidents, and security alerts. Notifications never contain message content, tokens, or secrets.</p><div className="sheet-actions"><button className="button secondary" onClick={()=>setPushExplainer(false)}>Not now</button><button className="button primary" onClick={requestPush}>Allow notifications</button></div></section></div>}
    {updateReady && <div className="update-toast" role="status"><span><Icon name="download"/></span><div><strong>A new version of Whatsnot is available</strong><p>Refresh to apply the latest improvements.</p></div><button onClick={()=>updateReady.postMessage({type:"SKIP_WAITING"})}>Refresh</button></div>}
  </div>;
}
