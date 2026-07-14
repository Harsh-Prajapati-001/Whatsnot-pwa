"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type PublicRoute = "home" | "learn" | "login" | "signup" | "checkout";
type AppRoute = "dashboard" | "systems" | "setup" | "automations" | "activity" | "costs" | "settings";
type Route = PublicRoute | AppRoute;
type ScenarioKey = "orders" | "appointments" | "payments" | "support";
type Toast = { id: number; title: string; body: string };
type SystemState = "Live" | "Setting up" | "Paused";
type SystemItem = { id: number; name: string; scenario: string; status: SystemState; progress: number; lastEvent: string; destination: string };

const legacyRoutes: Record<string, Route> = {
  workspaces: "systems",
  deployments: "setup",
  monitoring: "dashboard",
  logs: "activity",
  billing: "costs",
  team: "settings",
  "api-keys": "settings",
  integrations: "automations",
};

const appRoutes: AppRoute[] = ["dashboard", "systems", "setup", "automations", "activity", "costs", "settings"];

const scenarios: Record<ScenarioKey, { label: string; icon: string; headline: string; summary: string; trigger: string; message: string; steps: string[] }> = {
  orders: {
    label: "Orders & delivery",
    icon: "🛍️",
    headline: "Turn every order update into a helpful WhatsApp message.",
    summary: "Send confirmations, dispatch updates and delivery alerts without asking staff to copy and paste messages.",
    trigger: "A customer places an order",
    message: "Hi Aanya! Order #1842 is confirmed. We’ll message you again when it leaves our store.",
    steps: ["Your store reports the order", "Whatsnot chooses the approved template", "WhatsApp sends the update", "Delivery status returns to your dashboard"],
  },
  appointments: {
    label: "Appointments",
    icon: "📅",
    headline: "Reduce no-shows with automatic reminders.",
    summary: "Confirm bookings, remind customers before their visit and let them request a reschedule.",
    trigger: "A booking is created or approaching",
    message: "Reminder: your appointment with Bright Dental is tomorrow at 10:30 AM. Reply 1 to confirm.",
    steps: ["Your calendar shares the booking", "Whatsnot schedules the reminder", "The customer confirms on WhatsApp", "Your calendar records their answer"],
  },
  payments: {
    label: "Payments",
    icon: "💳",
    headline: "Send polite payment updates at exactly the right time.",
    summary: "Share receipts, due-date reminders and failed-payment recovery links using approved templates.",
    trigger: "An invoice changes status",
    message: "Payment received — thank you! Your receipt for ₹2,499 is ready: whatsnot.link/r/1842",
    steps: ["Your billing tool reports a change", "Whatsnot checks consent and template rules", "The receipt or reminder is sent", "The outcome appears in your activity feed"],
  },
  support: {
    label: "Customer support",
    icon: "🎧",
    headline: "Keep customers informed while your team solves the issue.",
    summary: "Acknowledge new tickets, share progress and notify the customer when a case is resolved.",
    trigger: "A support ticket changes",
    message: "We’ve received case #602. Riya from our support team is reviewing it now.",
    steps: ["Your help desk reports the ticket", "Whatsnot checks the customer’s preference", "An update is sent", "Replies are routed back to the right team"],
  },
};

const setupSteps = [
  { label: "Choose a goal", help: "Tell us what should trigger a message." },
  { label: "Connect WhatsApp", help: "Link your Meta business and phone number." },
  { label: "Choose hosting", help: "Select where your private automation runs." },
  { label: "Review cost", help: "Approve resources and the one-time setup fee." },
  { label: "Go live", help: "We test the complete message journey." },
];

const defaultSystems: SystemItem[] = [
  { id: 1, name: "Order updates", scenario: "Orders & delivery", status: "Live", progress: 100, lastEvent: "Message delivered 2 min ago", destination: "WhatsApp +91 •••• 2841" },
  { id: 2, name: "Appointment reminders", scenario: "Appointments", status: "Setting up", progress: 60, lastEvent: "Waiting for template approval", destination: "WhatsApp +91 •••• 9106" },
];

const navItems: { route: AppRoute; label: string; icon: string; hint: string }[] = [
  { route: "dashboard", label: "Home", icon: "⌂", hint: "Progress and next actions" },
  { route: "systems", label: "Notification systems", icon: "◫", hint: "Everything you have created" },
  { route: "setup", label: "Set up a system", icon: "+", hint: "Create a new WhatsApp flow" },
  { route: "automations", label: "Message journeys", icon: "↗", hint: "Rules and scenarios" },
  { route: "activity", label: "Message activity", icon: "≡", hint: "What happened and when" },
  { route: "costs", label: "Costs & resources", icon: "₹", hint: "Transparent allocation details" },
  { route: "settings", label: "Account & help", icon: "⚙", hint: "Preferences and explanations" },
];

function pathToRoute(): Route {
  if (typeof window === "undefined") return "home";
  const path = window.location.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!path) return "home";
  if (path === "tutorials") return "learn";
  if (legacyRoutes[path]) return legacyRoutes[path];
  const known: Route[] = ["home", "learn", "login", "signup", "checkout", ...appRoutes];
  return known.includes(path as Route) ? path as Route : "home";
}

function routePath(route: Route) {
  return route === "home" ? "/" : route === "learn" ? "/tutorials" : `/${route}`;
}

function Brand({ inverted = false }: { inverted?: boolean }) {
  return <span className={`brand ${inverted ? "brand-inverted" : ""}`}><span className="brand-mark">W</span><span>Whatsnot</span></span>;
}

function PublicHeader({ navigate }: { navigate: (route: Route) => void }) {
  return <header className="public-header">
    <button className="brand-button" onClick={() => navigate("home")} aria-label="Whatsnot home"><Brand /></button>
    <nav aria-label="Public navigation">
      <button onClick={() => navigate("learn")}>How it works</button>
      <a href="#use-cases">Examples</a>
      <a href="#pricing">One-time pricing</a>
    </nav>
    <div className="public-actions"><button className="text-link" onClick={() => navigate("login")}>Sign in</button><button className="button primary small" onClick={() => navigate("signup")}>Start guided setup <span>→</span></button></div>
  </header>;
}

function FlowLine({ steps, active = steps.length }: { steps: string[]; active?: number }) {
  return <div className="flow-line" aria-label="Process flow">
    {steps.map((step, index) => <div className={`flow-node ${index < active ? "done" : index === active ? "current" : ""}`} key={step}>
      <span>{index < active ? "✓" : index + 1}</span><p>{step}</p>{index < steps.length - 1 && <i />}
    </div>)}
  </div>;
}

function HomePage({ navigate }: { navigate: (route: Route) => void }) {
  const [scenario, setScenario] = useState<ScenarioKey>("orders");
  const selected = scenarios[scenario];
  return <div className="public-page">
    <PublicHeader navigate={navigate} />
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="pill"><span /> WhatsApp automation without confusing infrastructure</div>
          <h1>Your business updates.<br /><em>Delivered automatically.</em></h1>
          <p>Whatsnot helps you build reliable WhatsApp notification systems for orders, appointments, payments and support—then runs them inside cloud resources allocated for you.</p>
          <div className="hero-actions"><button className="button primary large" onClick={() => navigate("learn")}>See a 3-minute walkthrough <span>→</span></button><button className="button ghost large" onClick={() => document.getElementById("use-cases")?.scrollIntoView({ behavior: "smooth" })}>Explore examples</button></div>
          <div className="trust-row"><span>✓ One-time setup fee</span><span>✓ You approve every resource</span><span>✓ No markup on messages</span></div>
        </div>
        <div className="hero-demo" aria-label="WhatsApp notification demonstration">
          <div className="demo-glow" />
          <div className="demo-browser"><div className="demo-browser-bar"><i/><i/><i/><span>Live notification journey</span></div>
            <div className="demo-canvas">
              <div className="mini-trigger"><span>1</span><div><small>WHEN THIS HAPPENS</small><strong>New Shopify order</strong></div><b>Connected</b></div>
              <div className="mini-connector"><i/><span>Checked, formatted and secured by Whatsnot</span><i/></div>
              <div className="phone-card"><div className="phone-head"><span>←</span><i>WA</i><div><strong>Northstar Store</strong><small>business account</small></div></div><div className="chat-bg"><div className="message-bubble"><strong>Order confirmed 🎉</strong><p>Hi Aanya! Order #1842 is confirmed. We’ll notify you when it ships.</p><time>10:42 ✓✓</time></div></div></div>
              <div className="delivery-chip"><span>✓</span><div><small>DELIVERY RECEIPT</small><strong>Delivered in 1.2 seconds</strong></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="logo-strip"><p>Connect the tools you already use</p><div><span>Shopify</span><span>WooCommerce</span><span>Razorpay</span><span>Calendly</span><span>HubSpot</span><span>Custom API</span></div></section>

      <section className="public-section use-cases" id="use-cases">
        <div className="section-heading"><span className="kicker">START WITH A REAL BUSINESS MOMENT</span><h2>What should your customers know?</h2><p>Choose an example. We’ll show the complete journey in plain language before asking you to create an account.</p></div>
        <div className="scenario-tabs" role="tablist">{(Object.keys(scenarios) as ScenarioKey[]).map(key => <button role="tab" aria-selected={scenario === key} className={scenario === key ? "active" : ""} key={key} onClick={() => setScenario(key)}><span>{scenarios[key].icon}</span>{scenarios[key].label}</button>)}</div>
        <div className="scenario-showcase">
          <div><span className="number-label">EXAMPLE JOURNEY</span><h3>{selected.headline}</h3><p>{selected.summary}</p><div className="plain-note"><span>i</span><p><strong>No technical knowledge required.</strong> We explain every connection, permission and cost before anything is activated.</p></div><button className="button dark" onClick={() => navigate("learn")}>Walk through this example <span>→</span></button></div>
          <div className="journey-card"><div className="journey-trigger"><span>⚡</span><div><small>Trigger</small><strong>{selected.trigger}</strong></div></div><div className="vertical-path"><i/><i/><i/></div><div className="journey-message"><span>WhatsApp message</span><p>{selected.message}</p><small>Delivered ✓✓</small></div></div>
        </div>
      </section>

      <section className="public-section guide-section">
        <div className="section-heading"><span className="kicker">A CLEAR PATH, NOT A BLACK BOX</span><h2>From idea to working notifications in five visible steps.</h2></div>
        <FlowLine steps={setupSteps.map(step => step.label)} active={2} />
        <div className="explain-grid">{setupSteps.map((step, index) => <article key={step.label}><span>{String(index + 1).padStart(2, "0")}</span><h3>{step.label}</h3><p>{step.help}</p></article>)}</div>
      </section>

      <section className="public-section pricing-section" id="pricing">
        <div className="price-copy"><span className="kicker">TRANSPARENT BY DESIGN</span><h2>Pay once to set it up.<br />Your infrastructure remains visible.</h2><p>We don’t charge per notification and we don’t hide infrastructure behind vague plans. You approve a one-time amount that combines the resources needed for setup and our implementation fee.</p><ul><li><span>✓</span>Itemised resource estimate before payment</li><li><span>✓</span>No WhatsApp message markup from Whatsnot</li><li><span>✓</span>Deactivate allocated resources from one screen</li></ul></div>
        <div className="price-card"><span>Typical starter setup</span><div className="price-total"><strong>₹7,999</strong><small>one time</small></div><div className="price-row"><span>Estimated setup resources</span><b>₹2,150</b></div><div className="price-row"><span>Whatsnot implementation & testing</span><b>₹5,849</b></div><div className="price-row muted"><span>Message markup</span><b>₹0</b></div><p>Exact resources depend on your message volume, integrations and chosen hosting provider.</p><button className="button primary large full" onClick={() => navigate("signup")}>Build my estimate <span>→</span></button></div>
      </section>

      <section className="final-cta"><div><Brand inverted /><h2>Understand it first.<br />Activate it when you’re ready.</h2><p>Explore the guided tutorial without creating an account.</p></div><div><button className="button light large" onClick={() => navigate("learn")}>Start interactive tutorial</button><button className="button outline-light large" onClick={() => navigate("signup")}>Create an account</button></div></section>
    </main>
    <footer className="public-footer"><Brand /><p>Clear WhatsApp automation for growing businesses.</p><span>© 2026 Whatsnot · Privacy · Terms · Meta requirements</span></footer>
  </div>;
}

function LearnPage({ navigate }: { navigate: (route: Route) => void }) {
  const [scenario, setScenario] = useState<ScenarioKey>("orders");
  const [step, setStep] = useState(0);
  const selected = scenarios[scenario];
  const cards = [
    { title: "The business event", eyebrow: "1 · TRIGGER", body: selected.trigger, extra: "Whatsnot listens only for the event you approve." },
    { title: "The safety check", eyebrow: "2 · VERIFY", body: "Consent, template and contact details are checked.", extra: "Invalid or duplicate events are safely stopped." },
    { title: "The message", eyebrow: "3 · SEND", body: selected.message, extra: "Meta delivers the approved WhatsApp template." },
    { title: "The result", eyebrow: "4 · CONFIRM", body: "Delivered, read or failed status returns to you.", extra: "Your team can see what happened and act quickly." },
  ];
  return <div className="tutorial-page">
    <PublicHeader navigate={navigate} />
    <main className="tutorial-main">
      <aside className="tutorial-sidebar"><span className="kicker">INTERACTIVE TUTORIAL</span><h1>See every moving part.</h1><p>No signup. No jargon. Choose your business goal and follow a notification from trigger to delivery.</p><label>Show me an example for<select value={scenario} onChange={event => { setScenario(event.target.value as ScenarioKey); setStep(0); }}>{(Object.keys(scenarios) as ScenarioKey[]).map(key => <option value={key} key={key}>{scenarios[key].label}</option>)}</select></label><div className="tutorial-list">{cards.map((card, index) => <button className={step === index ? "active" : step > index ? "done" : ""} onClick={() => setStep(index)} key={card.title}><span>{step > index ? "✓" : index + 1}</span><div><strong>{card.title}</strong><small>{card.eyebrow.split(" · ")[1].toLowerCase()}</small></div></button>)}</div></aside>
      <section className="tutorial-stage"><div className="stage-progress"><span style={{ width: `${(step + 1) * 25}%` }} /></div><div className="stage-card" key={`${scenario}-${step}`}><span className="stage-eyebrow">{cards[step].eyebrow}</span><div className="stage-icon">{["⚡", "🛡", "💬", "✓"][step]}</div><h2>{cards[step].title}</h2><p className="stage-body">{cards[step].body}</p><div className="stage-explain"><span>Why it matters</span><p>{cards[step].extra}</p></div><div className="stage-actions"><button className="button ghost" disabled={step === 0} onClick={() => setStep(value => value - 1)}>← Previous</button>{step < 3 ? <button className="button primary" onClick={() => setStep(value => value + 1)}>Next: {cards[step + 1].title} →</button> : <button className="button primary" onClick={() => navigate("signup")}>Build this for my business →</button>}</div></div><div className="tutorial-caption"><span>Plain-language promise</span><p>Technical terms are shown only when needed, with an explanation beside them.</p></div></section>
    </main>
  </div>;
}

function AuthPage({ mode, navigate, onAuth }: { mode: "login" | "signup"; navigate: (route: Route) => void; onAuth: (name: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if ((mode === "signup" && name.trim().length < 2) || !email.includes("@") || password.length < 8) {
      setError("Please enter a valid email and a password with at least 8 characters.");
      return;
    }
    onAuth(name.trim() || email.split("@")[0]);
    navigate(mode === "signup" ? "checkout" : "dashboard");
  };
  return <div className="auth-page"><div className="auth-aside"><button className="brand-button" onClick={() => navigate("home")}><Brand inverted /></button><div><span className="kicker light">YOU’LL ALWAYS KNOW WHAT COMES NEXT</span><h1>{mode === "signup" ? "Turn your first notification idea into a tested system." : "Welcome back to your notification control centre."}</h1><FlowLine steps={["Account", "Cost approval", "WhatsApp", "Hosting", "Live test"]} active={mode === "signup" ? 0 : 5} /></div><p>We never ask for passwords to your cloud account. Connections use scoped permissions that you can revoke.</p></div><main className="auth-main"><div className="auth-card"><div className="mobile-auth-brand"><Brand /></div><span className="kicker">{mode === "signup" ? "CREATE YOUR ACCOUNT" : "SIGN IN"}</span><h2>{mode === "signup" ? "Let’s start with the basics." : "Continue your setup."}</h2><p>{mode === "signup" ? "You’ll review the complete price before anything is activated." : "Use the email connected to your Whatsnot account."}</p><form onSubmit={submit}>{mode === "signup" && <label>Your name<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder="Harsh Prajapati" /></label>}<label>Work email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="you@business.com" /></label><label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? "Hide" : "Show"}</button></div></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button primary large full" type="submit">{mode === "signup" ? "Continue to transparent pricing" : "Sign in"} <span>→</span></button></form><div className="auth-divider"><span>or continue with</span></div><div className="social-auth"><button onClick={() => { onAuth("Google user"); navigate(mode === "signup" ? "checkout" : "dashboard"); }}>G&nbsp; Google</button><button onClick={() => { onAuth("GitHub user"); navigate(mode === "signup" ? "checkout" : "dashboard"); }}>●&nbsp; GitHub</button></div><p className="auth-switch">{mode === "signup" ? "Already have an account?" : "New to Whatsnot?"} <button onClick={() => navigate(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "Sign in" : "Create an account"}</button></p></div></main></div>;
}

function CheckoutPage({ navigate, onComplete }: { navigate: (route: Route) => void; onComplete: () => void }) {
  const [volume, setVolume] = useState("starter");
  const [provider, setProvider] = useState("cloudflare");
  const [accepted, setAccepted] = useState(false);
  const costs = volume === "starter" ? [2150, 5849] : volume === "growing" ? [3950, 7049] : [6900, 9099];
  const total = costs[0] + costs[1];
  return <div className="checkout-page"><header><button className="brand-button" onClick={() => navigate("home")}><Brand /></button><span><b>Secure review</b><small>Nothing is deployed until you approve</small></span></header><main><section className="checkout-form"><span className="kicker">STEP 2 OF 5 · COST APPROVAL</span><h1>Choose a sensible starting size.</h1><p>These choices create an estimate, not a recurring Whatsnot subscription. You can scale or deactivate resources later.</p><div className="choice-section"><h2>Expected monthly notifications</h2><div className="choice-grid">{[{id:"starter",title:"Up to 10,000",body:"Small shop or clinic"},{id:"growing",title:"10,000–100,000",body:"Growing online business"},{id:"scale",title:"100,000+",body:"High-volume operations"}].map(option => <button className={volume === option.id ? "selected" : ""} onClick={() => setVolume(option.id)} key={option.id}><span>{volume === option.id ? "✓" : ""}</span><strong>{option.title}</strong><small>{option.body}</small></button>)}</div></div><div className="choice-section"><h2>Preferred resource provider</h2><div className="provider-grid">{[{id:"cloudflare",logo:"CF",title:"Cloudflare",body:"Simple, global and beginner-friendly"},{id:"railway",logo:"RW",title:"Railway",body:"Managed application hosting"}].map(option => <button className={provider === option.id ? "selected" : ""} onClick={() => setProvider(option.id)} key={option.id}><i>{option.logo}</i><span><strong>{option.title}</strong><small>{option.body}</small></span><b>{provider === option.id ? "✓" : ""}</b></button>)}</div></div><div className="info-banner"><span>i</span><p><strong>What “resources” means:</strong> the secure computing, storage and traffic allowance used to receive events and send notifications. You will see each item before activation.</p></div></section><aside className="order-summary"><span className="kicker">YOUR ONE-TIME ESTIMATE</span><h2>Starter activation</h2><div className="summary-row"><span>Allocated setup resources<small>{provider === "cloudflare" ? "Cloudflare Worker, storage and event capacity" : "Railway service, database and event capacity"}</small></span><b>₹{costs[0].toLocaleString("en-IN")}</b></div><div className="summary-row"><span>Implementation & testing<small>Connection guidance, templates and live verification</small></span><b>₹{costs[1].toLocaleString("en-IN")}</b></div><div className="summary-row free"><span>WhatsApp message markup</span><b>₹0</b></div><div className="summary-total"><span>Total one-time amount<small>Taxes shown before real payment</small></span><strong>₹{total.toLocaleString("en-IN")}</strong></div><label className="consent"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>I understand this demonstration does not process a real payment. A payment provider must be connected securely before launch.</span></label><button disabled={!accepted} className="button primary large full" onClick={() => { onComplete(); navigate("dashboard"); }}>Approve demo estimate <span>→</span></button><button className="text-button centered" onClick={() => navigate("learn")}>Review the tutorial again</button><p className="secure-note">🔒 No card details are collected in this frontend prototype.</p></aside></main></div>;
}

function AppShell({ route, navigate, userName, children, unread, openNotifications, openCommand, mobileOpen, setMobileOpen }: { route: AppRoute; navigate: (route: Route) => void; userName: string; children: React.ReactNode; unread: number; openNotifications: () => void; openCommand: () => void; mobileOpen: boolean; setMobileOpen: (value: boolean) => void }) {
  const current = navItems.find(item => item.route === route)!;
  return <div className="app-shell"><a className="skip-link" href="#app-content">Skip to content</a><aside className={`app-sidebar ${mobileOpen ? "open" : ""}`}><div className="sidebar-brand"><Brand inverted /><button onClick={() => setMobileOpen(false)} aria-label="Close navigation">×</button></div><div className="org-card"><span>HP</span><div><strong>Harsh’s business</strong><small>Starter setup</small></div><b>⌄</b></div><nav aria-label="Application navigation">{navItems.map(item => <button title={item.hint} className={route === item.route ? "active" : ""} onClick={() => { navigate(item.route); setMobileOpen(false); }} key={item.route}><span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.hint}</small></div>{item.route === "setup" && <i>NEW</i>}</button>)}</nav><div className="sidebar-help"><span>?</span><div><strong>Words feel confusing?</strong><p>Open the plain-language guide.</p></div><button onClick={() => navigate("settings")}>View guide</button></div><div className="sidebar-user"><span>{userName.slice(0, 2).toUpperCase()}</span><div><strong>{userName}</strong><small>Account owner</small></div><button aria-label="User options">•••</button></div></aside>{mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}<div className="app-area"><header className="app-topbar"><div><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button><span className="top-icon">{current.icon}</span><div><strong>{current.label}</strong><small>{current.hint}</small></div></div><div><button className="search-button" onClick={openCommand}><span>⌕</span> Find anything <kbd>Ctrl K</kbd></button><button className="top-button" onClick={openNotifications} aria-label={`${unread} unread notifications`}>♢{unread > 0 && <i>{unread}</i>}</button><button className="button primary small top-setup" onClick={() => navigate("setup")}>+ Set up notification</button></div></header><main id="app-content" className="app-content">{children}</main></div></div>;
}

function ProgressBoard({ navigate }: { navigate: (route: Route) => void }) {
  const steps = [{ title: "Goal chosen", detail: "Order updates", state: "done" }, { title: "WhatsApp connected", detail: "Demo number linked", state: "done" }, { title: "Template approval", detail: "Waiting for Meta", state: "current" }, { title: "Resources activated", detail: "Starts after approval", state: "next" }, { title: "Live message test", detail: "Final verification", state: "next" }];
  return <section className="panel progress-board"><div className="panel-heading"><div><span className="kicker">YOUR SETUP JOURNEY</span><h2>You’re 2 steps away from your first live notification.</h2><p>We’re waiting for Meta to approve your order-confirmation message. This normally takes a few minutes to 24 hours.</p></div><div className="progress-ring"><strong>60%</strong><span>complete</span></div></div><div className="status-flow">{steps.map((item, index) => <button className={item.state} onClick={() => navigate(index < 2 ? "systems" : "setup")} key={item.title}><span>{item.state === "done" ? "✓" : index + 1}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div>{index < steps.length - 1 && <i />}</button>)}</div><div className="next-action"><span>▶</span><div><strong>Next action: review the approved template</strong><p>We’ll notify you as soon as Meta responds. You can continue exploring meanwhile.</p></div><button className="button primary" onClick={() => navigate("setup")}>Continue setup →</button></div></section>;
}

function DashboardPage({ navigate }: { navigate: (route: Route) => void }) {
  return <><div className="app-page-heading"><div><span className="kicker">MONDAY, 13 JULY</span><h1>Good evening, Harsh 👋</h1><p>Here’s the clearest next step for getting your business notifications live.</p></div><button className="button primary" onClick={() => navigate("setup")}>+ Set up another notification</button></div><ProgressBoard navigate={navigate} /><section className="dashboard-grid"><div className="panel simple-metrics"><div><span className="metric-symbol green">✓</span><p>Messages delivered</p><strong>1,248</strong><small>98.7% successful this month</small></div><div><span className="metric-symbol blue">↗</span><p>Active notification journeys</p><strong>1</strong><small>1 more being prepared</small></div><div><span className="metric-symbol orange">!</span><p>Needs your attention</p><strong>1</strong><small>Template approval pending</small></div></div><div className="panel understand-card"><span>PLAIN-LANGUAGE GUIDE</span><h2>What is a “notification system”?</h2><p>It is one complete connection that notices a business event—like a new order—and safely sends the right WhatsApp message.</p><button onClick={() => navigate("learn")}>See the 3-minute explanation →</button></div></section><section className="dashboard-grid lower"><div className="panel recent-panel"><div className="panel-title"><div><h2>Latest message activity</h2><p>A readable history of what your systems did.</p></div><button onClick={() => navigate("activity")}>View all</button></div>{[{icon:"✓",title:"Order confirmation delivered",meta:"Customer ending 4482 · 2 min ago",tone:"green"},{icon:"✓",title:"Dispatch update delivered",meta:"Customer ending 9014 · 18 min ago",tone:"green"},{icon:"↻",title:"Appointment reminder queued",meta:"Scheduled for tomorrow · 1 hr ago",tone:"blue"},{icon:"!",title:"Payment reminder needs review",meta:"Missing customer consent · 3 hr ago",tone:"orange"}].map(item => <div className="activity-item" key={item.title}><span className={item.tone}>{item.icon}</span><div><strong>{item.title}</strong><small>{item.meta}</small></div><button aria-label={`Open ${item.title}`}>›</button></div>)}</div><div className="panel quick-start"><div className="panel-title"><div><h2>Choose another business goal</h2><p>Start from a tested example.</p></div></div>{(Object.keys(scenarios) as ScenarioKey[]).map(key => <button onClick={() => navigate("setup")} key={key}><span>{scenarios[key].icon}</span><div><strong>{scenarios[key].label}</strong><small>{scenarios[key].summary}</small></div><b>›</b></button>)}</div></section></>;
}

function SystemsPage({ systems, setSystems, navigate, toast }: { systems: SystemItem[]; setSystems: (systems: SystemItem[]) => void; navigate: (route: Route) => void; toast: (title: string, body: string) => void }) {
  const [filter, setFilter] = useState<"All" | SystemState>("All");
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<number | null>(null);
  const [remove, setRemove] = useState<SystemItem | null>(null);
  const visible = systems.filter(item => (filter === "All" || item.status === filter) && item.name.toLowerCase().includes(query.toLowerCase()));
  const pause = (item: SystemItem) => { const next: SystemState = item.status === "Paused" ? "Live" : "Paused"; setSystems(systems.map(system => system.id === item.id ? { ...system, status: next } : system)); setMenu(null); toast(next === "Paused" ? "Notification system paused" : "Notification system resumed", `${item.name} is now ${next.toLowerCase()}.`); };
  return <><div className="app-page-heading"><div><span className="kicker">YOUR BUSINESS NOTIFICATIONS</span><h1>Notification systems</h1><p>Each card is a complete event-to-message connection. Pause or remove it whenever you choose.</p></div><button className="button primary" onClick={() => navigate("setup")}>+ Set up a system</button></div><div className="plain-definition"><span>i</span><p><strong>In plain words:</strong> a notification system listens for one business event and sends one or more approved WhatsApp messages.</p></div><div className="system-tools"><label><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a notification system" /></label><div>{(["All", "Live", "Setting up", "Paused"] as const).map(value => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{value}</button>)}</div></div><section className="system-grid">{visible.map(item => <article className="system-card" key={item.id}><div className="system-card-head"><span className="system-logo">{item.scenario.includes("Order") ? "🛍️" : "📅"}</span><div><span className={`system-status ${item.status.toLowerCase().replace(" ", "-")}`}><i />{item.status}</span><h2>{item.name}</h2><p>{item.scenario}</p></div><div className="menu-wrap"><button className="more-button" onClick={() => setMenu(menu === item.id ? null : item.id)} aria-label={`Actions for ${item.name}`}>•••</button>{menu === item.id && <div className="action-menu"><button onClick={() => navigate("setup")}>View setup progress</button><button onClick={() => pause(item)}>{item.status === "Paused" ? "Resume messages" : "Pause messages"}</button><button className="danger" onClick={() => { setRemove(item); setMenu(null); }}>Deactivate resources</button></div>}</div></div><div className="system-path"><div><span>WHEN</span><strong>{item.scenario === "Appointments" ? "Booking approaches" : "Order status changes"}</strong></div><i>→</i><div><span>THEN</span><strong>Send WhatsApp update</strong></div></div>{item.status === "Setting up" ? <div className="setup-progress"><div><span>Setup progress</span><b>{item.progress}%</b></div><progress value={item.progress} max="100" /><small>{item.lastEvent}</small></div> : <div className="system-stats"><div><span>Today</span><strong>{item.status === "Paused" ? "0" : "184 messages"}</strong></div><div><span>Success</span><strong>{item.status === "Paused" ? "—" : "99.2%"}</strong></div></div>}<div className="system-footer"><span>{item.destination}</span><button onClick={() => navigate(item.status === "Setting up" ? "setup" : "activity")}>{item.status === "Setting up" ? "Continue setup" : "View activity"} →</button></div></article>)}<button className="new-system-card" onClick={() => navigate("setup")}><span>+</span><strong>Create another notification system</strong><p>Choose a goal and follow the guided steps.</p></button></section>{visible.length === 0 && <div className="empty-state"><span>⌕</span><h2>No matching systems</h2><p>Try another search or status filter.</p><button className="button ghost" onClick={() => { setQuery(""); setFilter("All"); }}>Clear filters</button></div>}{remove && <div className="modal-backdrop"><div className="confirm-modal"><span className="danger-icon">!</span><h2>Deactivate “{remove.name}”?</h2><p>New messages will stop and its allocated runtime will be released. Historical activity remains available.</p><div className="resource-release"><strong>Resources to release</strong><span>1 notification worker</span><span>1 event queue</span><span>1 secure configuration</span></div><div><button className="button ghost" onClick={() => setRemove(null)}>Keep system</button><button className="button danger-button" onClick={() => { setSystems(systems.filter(item => item.id !== remove.id)); toast("Resources deactivated", `${remove.name} has been removed and its allocated runtime released.`); setRemove(null); }}>Deactivate resources</button></div></div></div>}</>;
}

function SetupPage({ systems, setSystems, navigate, toast }: { systems: SystemItem[]; setSystems: (systems: SystemItem[]) => void; navigate: (route: Route) => void; toast: (title: string, body: string) => void }) {
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState<ScenarioKey>("orders");
  const [connected, setConnected] = useState(false);
  const [provider, setProvider] = useState("Cloudflare");
  const [name, setName] = useState("Order updates");
  const selected = scenarios[scenario];
  const next = () => setStep(value => Math.min(4, value + 1));
  const launch = () => { const newSystem: SystemItem = { id: Date.now(), name, scenario: selected.label, status: "Setting up", progress: 40, lastEvent: "Preparing approved message template", destination: "WhatsApp demo connection" }; setSystems([...systems, newSystem]); toast("Setup started", `${name} was added to your notification systems.`); navigate("systems"); };
  return <><div className="app-page-heading setup-heading"><div><span className="kicker">GUIDED SETUP</span><h1>Set up a WhatsApp notification system</h1><p>We explain each choice and show your progress. Nothing goes live without your approval.</p></div><button className="button ghost" onClick={() => navigate("systems")}>Save & exit</button></div><section className="setup-layout"><aside className="setup-nav"><div className="setup-percent"><div><strong>{step * 20}%</strong><span>complete</span></div><progress value={step} max="5" /></div>{setupSteps.map((item, index) => <button className={step === index ? "active" : step > index ? "done" : ""} onClick={() => index <= step && setStep(index)} key={item.label}><span>{step > index ? "✓" : index + 1}</span><div><strong>{item.label}</strong><small>{item.help}</small></div></button>)}<div className="setup-help"><span>?</span><p><strong>Need a person?</strong><br />Book guided assistance before activation.</p><button onClick={() => toast("Help request noted", "A support scheduling flow will be connected here.")}>Request help</button></div></aside><div className="setup-panel">{step === 0 && <div className="setup-step"><span className="step-label">STEP 1 OF 5</span><h2>What should trigger a WhatsApp message?</h2><p>Choose the closest business goal. You can adjust the exact wording later.</p><div className="goal-grid">{(Object.keys(scenarios) as ScenarioKey[]).map(key => <button className={scenario === key ? "selected" : ""} onClick={() => { setScenario(key); setName(`${scenarios[key].label} updates`); }} key={key}><span>{scenarios[key].icon}</span><div><strong>{scenarios[key].label}</strong><small>{scenarios[key].summary}</small></div><b>{scenario === key ? "✓" : ""}</b></button>)}</div><div className="selection-preview"><span>YOUR CHOSEN JOURNEY</span><FlowLine steps={selected.steps} /></div></div>}{step === 1 && <div className="setup-step"><span className="step-label">STEP 2 OF 5</span><h2>Connect your WhatsApp Business account.</h2><p>Meta provides the secure connection. Whatsnot never asks for your Facebook password.</p><div className={`connection-card ${connected ? "connected" : ""}`}><div className="meta-logo">∞</div><div><h3>{connected ? "Demo business connected" : "Meta Embedded Signup"}</h3><p>{connected ? "Phone number ending 2841 · Permission can be revoked" : "Choose your business account and WhatsApp phone number in Meta’s secure window."}</p></div><button className={`button ${connected ? "ghost" : "primary"}`} onClick={() => setConnected(value => !value)}>{connected ? "Disconnect demo" : "Connect demo account"}</button></div><div className="permission-list"><h3>What you will approve</h3><div><span>✓</span><p><strong>Send approved templates</strong><small>Only from the number you select.</small></p></div><div><span>✓</span><p><strong>Receive delivery updates</strong><small>So you can see delivered or failed messages.</small></p></div><div><span>✓</span><p><strong>Manage the connection</strong><small>You can disconnect from Whatsnot or Meta.</small></p></div></div><div className="warning-note">Real Meta Embedded Signup requires backend credentials. This button demonstrates the frontend state only.</div></div>}{step === 2 && <div className="setup-step"><span className="step-label">STEP 3 OF 5</span><h2>Where should the notification system run?</h2><p>We recommend the simplest option for your expected volume. “Hosting” means the computers and storage that keep the automation available.</p><div className="hosting-options">{[{name:"Cloudflare",badge:"Recommended",desc:"Fast global events with a generous starter allowance",cost:"Estimated ₹650 setup resources"},{name:"Railway",badge:"Managed",desc:"Simple application and database hosting in one place",cost:"Estimated ₹1,350 setup resources"},{name:"My own cloud",badge:"Advanced",desc:"Connect infrastructure already owned by your business",cost:"Calculated after connection"}].map(option => <button className={provider === option.name ? "selected" : ""} onClick={() => setProvider(option.name)} key={option.name}><span>{option.name.slice(0, 2).toUpperCase()}</span><div><b>{option.badge}</b><h3>{option.name}</h3><p>{option.desc}</p><small>{option.cost}</small></div><i>{provider === option.name ? "✓" : ""}</i></button>)}</div><div className="allocation-map"><h3>Resources this setup allocates</h3><div><span>⚡</span><p><strong>Event receiver</strong><small>Notices the business event</small></p><b>1</b></div><div><span>⇄</span><p><strong>Message queue</strong><small>Keeps bursts reliable</small></p><b>1</b></div><div><span>▣</span><p><strong>Secure settings store</strong><small>Protects connection references</small></p><b>1</b></div></div></div>}{step === 3 && <div className="setup-step"><span className="step-label">STEP 4 OF 5</span><h2>Review the name, journey and cost.</h2><p>This is your final review before a demo setup begins.</p><label className="setup-name">Notification system name<input value={name} onChange={event => setName(event.target.value)} /></label><div className="review-card"><div><span>Business goal</span><strong>{selected.label}</strong></div><div><span>WhatsApp connection</span><strong>{connected ? "Demo number ending 2841" : "Not connected yet"}</strong></div><div><span>Resource provider</span><strong>{provider}</strong></div><div><span>Expected setup time</span><strong>10–20 minutes after approvals</strong></div></div><div className="cost-review"><div><span>One-time resources and implementation</span><strong>{provider === "Cloudflare" ? "₹7,999" : provider === "Railway" ? "₹8,699" : "Calculated after connection"}</strong></div><p>Whatsnot message markup: <b>₹0</b>. Meta and provider usage, if any, remains visible separately.</p></div></div>}{step === 4 && <div className="setup-step go-live-step"><span className="step-label">STEP 5 OF 5</span><div className="launch-visual"><span>✓</span></div><h2>Ready to prepare “{name}”.</h2><p>The demo will add this system to your dashboard and show the remaining approval stages. It will not allocate real resources or send messages.</p><div className="launch-flow"><FlowLine steps={["Validate choices", "Prepare template", "Allocate resources", "Send test", "Confirm delivery"]} active={1} /></div><div className="launch-summary"><span>✓ You stay in control</span><span>✓ Every stage is visible</span><span>✓ Deactivate from one menu</span></div><button className="button primary large" onClick={launch}>Start demo setup →</button></div>}<div className="setup-footer"><button className="button ghost" disabled={step === 0} onClick={() => setStep(value => value - 1)}>← Back</button>{step < 4 && <button className="button primary" disabled={step === 1 && !connected} onClick={next}>Continue to {setupSteps[step + 1].label.toLowerCase()} →</button>}</div></div></section></>;
}

function AutomationsPage({ toast }: { toast: (title: string, body: string) => void }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ "Order confirmed": true, "Out for delivery": true, "Delivered": true, "Review request": false });
  const [builder, setBuilder] = useState(false);
  return <><div className="app-page-heading"><div><span className="kicker">MESSAGE JOURNEYS</span><h1>What gets sent, and when</h1><p>Each rule connects a business moment to an approved WhatsApp message.</p></div><button className="button primary" onClick={() => setBuilder(true)}>+ Add a message step</button></div><div className="journey-overview panel"><div className="journey-start"><span>🛍️</span><div><small>STARTS WHEN</small><strong>An order is created</strong></div></div><div className="journey-arrow">→</div><div className="journey-branch"><span>4 message rules</span><strong>Order update journey</strong><small>Stops when the order is delivered or cancelled</small></div><div className="journey-arrow">→</div><div className="journey-result"><span>✓</span><div><small>THIS MONTH</small><strong>1,248 delivered</strong></div></div></div><section className="rules-list">{[{name:"Order confirmed",when:"Immediately after payment",template:"Your order {{order_number}} is confirmed",state:"Approved"},{name:"Out for delivery",when:"When courier status changes",template:"Your order is out for delivery",state:"Approved"},{name:"Delivered",when:"When delivery is confirmed",template:"Your order has been delivered",state:"Approved"},{name:"Review request",when:"2 days after delivery",template:"How was your experience?",state:"Draft"}].map((rule, index) => <article className="rule-card panel" key={rule.name}><div className="rule-number">{index + 1}</div><div className="rule-content"><div><span className={`approval ${rule.state.toLowerCase()}`}>{rule.state}</span><h2>{rule.name}</h2><p><b>When:</b> {rule.when}</p></div><div className="template-preview"><small>MESSAGE PREVIEW</small><p>{rule.template}</p></div></div><label className="toggle"><input type="checkbox" checked={enabled[rule.name]} onChange={event => { setEnabled({ ...enabled, [rule.name]: event.target.checked }); toast(event.target.checked ? "Message step enabled" : "Message step paused", `${rule.name} is now ${event.target.checked ? "active" : "paused"}.`); }} /><span /></label><button className="more-button">•••</button></article>)}</section>{builder && <div className="modal-backdrop"><div className="builder-modal"><button className="modal-close" onClick={() => setBuilder(false)}>×</button><span className="kicker">NEW MESSAGE STEP</span><h2>Choose what should happen next.</h2><label>When this happens<select><option>Order status changes</option><option>A specific time passes</option><option>Customer replies</option></select></label><label>Send this approved message<select><option>Order update template</option><option>Delivery confirmation</option><option>Support follow-up</option></select></label><div className="builder-path"><span>Event</span><i>→</i><span>Safety check</span><i>→</i><span>WhatsApp</span></div><div><button className="button ghost" onClick={() => setBuilder(false)}>Cancel</button><button className="button primary" onClick={() => { setBuilder(false); toast("Message step added", "The new draft step has been added to this journey."); }}>Add draft step</button></div></div></div>}</>;
}

function ActivityPage({ toast }: { toast: (title: string, body: string) => void }) {
  const rows = useMemo(() => [{time:"18:42",customer:"Customer •••• 4482",event:"Order confirmation",status:"Delivered",system:"Order updates"},{time:"18:26",customer:"Customer •••• 9014",event:"Dispatch update",status:"Read",system:"Order updates"},{time:"17:58",customer:"Customer •••• 6302",event:"Appointment reminder",status:"Queued",system:"Appointment reminders"},{time:"16:31",customer:"Customer •••• 1108",event:"Payment reminder",status:"Needs review",system:"Payment recovery"},{time:"15:44",customer:"Customer •••• 7391",event:"Delivery confirmation",status:"Delivered",system:"Order updates"}], []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const visible = rows.filter(row => (status === "All" || row.status === status) && Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase()));
  const exportRows = () => { const csv = ["Time,Customer,Event,Status,System", ...visible.map(row => Object.values(row).map(value => `"${value}"`).join(","))].join("\n"); const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "whatsnot-message-activity.csv"; link.click(); URL.revokeObjectURL(url); toast("Activity exported", `${visible.length} rows were saved as CSV.`); };
  return <><div className="app-page-heading"><div><span className="kicker">READABLE AUDIT TRAIL</span><h1>Message activity</h1><p>See what happened without reading technical logs.</p></div><button className="button ghost" onClick={exportRows}>↓ Export CSV</button></div><section className="panel activity-table"><div className="activity-tools"><label><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search customer or message" /></label><select value={status} onChange={event => setStatus(event.target.value)}><option>All</option><option>Delivered</option><option>Read</option><option>Queued</option><option>Needs review</option></select><span>{visible.length} events</span></div><div className="table-head"><span>Time</span><span>Customer</span><span>What happened</span><span>System</span><span>Result</span><span /></div>{visible.map(row => <div className="activity-row-table" key={`${row.time}-${row.customer}`}><time>{row.time}</time><strong>{row.customer}</strong><span>{row.event}</span><span>{row.system}</span><span className={`result ${row.status.toLowerCase().replace(" ", "-")}`}><i />{row.status}</span><button aria-label="Open event details">›</button></div>)}</section></>;
}

function CostsPage({ toast }: { toast: (title: string, body: string) => void }) {
  const [volume, setVolume] = useState(25);
  const infra = 450 + volume * 18;
  return <><div className="app-page-heading"><div><span className="kicker">NO SURPRISES</span><h1>Costs & allocated resources</h1><p>See what was paid once, what your provider may charge, and what can be deactivated.</p></div><button className="button ghost" onClick={() => toast("Estimate downloaded", "A cost-estimate download will be generated here.")}>↓ Download estimate</button></div><section className="cost-grid"><div className="panel paid-card"><span className="paid-badge">✓ ONE-TIME SETUP APPROVED</span><h2>₹7,999</h2><p>Approved 12 July 2026 · Reference WN-1048</p><div><span>Allocated setup resources</span><b>₹2,150</b></div><div><span>Whatsnot implementation & testing</span><b>₹5,849</b></div><div><span>Whatsnot message markup</span><b>₹0</b></div><button onClick={() => toast("Receipt prepared", "The receipt download will be connected to the payment backend.")}>Download receipt →</button></div><div className="panel allocation-card"><div className="panel-title"><div><h2>Currently allocated</h2><p>Resources supporting your active systems.</p></div><span className="live-dot">● Active</span></div>{[{name:"Event receiver",purpose:"Notices order and appointment events",count:"1 active"},{name:"Reliable message queue",purpose:"Prevents events being lost during a rush",count:"1 active"},{name:"Secure settings store",purpose:"Keeps connection references protected",count:"1 active"}].map(item => <div className="allocation-row" key={item.name}><span>◈</span><div><strong>{item.name}</strong><small>{item.purpose}</small></div><b>{item.count}</b></div>)}</div></section><section className="panel calculator"><div><span className="kicker">PLANNING TOOL</span><h2>Estimate a larger message volume</h2><p>This educational estimate helps you understand provider costs. It is not an invoice.</p><label>Expected messages per month <strong>{volume},000</strong><input type="range" min="1" max="200" value={volume} onChange={event => setVolume(Number(event.target.value))} /></label><div className="range-labels"><span>1k</span><span>100k</span><span>200k</span></div></div><aside><span>ESTIMATED PROVIDER ALLOWANCE</span><strong>₹{infra.toLocaleString("en-IN")}</strong><small>one-time allocation estimate</small><hr /><p>Whatsnot message markup <b>₹0</b></p><p>Additional implementation <b>Not required</b></p></aside></section></>;
}

function SettingsPage({ toast }: { toast: (title: string, body: string) => void }) {
  const [tab, setTab] = useState("Plain-language guide");
  const [email, setEmail] = useState(true);
  const glossary = [{term:"Notification system",meaning:"One complete connection from a business event to a WhatsApp message."},{term:"Message journey",meaning:"The sequence of messages a customer receives as something changes."},{term:"Trigger",meaning:"The business event that starts an automatic action."},{term:"Resources",meaning:"The computing, storage and traffic allowance used to run your system."},{term:"Template",meaning:"Message wording reviewed by Meta before it can be sent proactively."},{term:"Webhook",meaning:"A secure online door where another tool reports that something happened."}];
  return <><div className="app-page-heading"><div><span className="kicker">ACCOUNT & HELP</span><h1>Settings that make sense</h1><p>Manage preferences, connections and the words used throughout Whatsnot.</p></div></div><section className="settings-layout-new"><aside>{["Plain-language guide", "Profile", "Notifications", "Connections", "Privacy & security"].map(item => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}<span>›</span></button>)}</aside><div className="panel settings-content">{tab === "Plain-language guide" && <><div className="settings-title"><span>?</span><div><h2>Plain-language guide</h2><p>Short explanations for every term you may see in Whatsnot.</p></div></div><label className="glossary-search"><span>⌕</span><input placeholder="Search a word or concept" /></label><div className="glossary">{glossary.map(item => <details key={item.term}><summary>{item.term}<span>+</span></summary><p>{item.meaning}</p></details>)}</div></>}{tab === "Profile" && <><div className="settings-title"><span>HP</span><div><h2>Your profile</h2><p>Details used for account communication.</p></div></div><div className="settings-form"><label>Display name<input defaultValue="Harsh Prajapati" /></label><label>Work email<input defaultValue="harsh@example.com" /></label><label>Business name<input defaultValue="Harsh’s business" /></label><button className="button primary" onClick={() => toast("Profile saved", "Your profile changes were saved on this device.")}>Save changes</button></div></>}{tab === "Notifications" && <><div className="settings-title"><span>♢</span><div><h2>Notification preferences</h2><p>Choose how Whatsnot keeps you informed.</p></div></div><label className="setting-toggle"><div><strong>Setup progress emails</strong><small>Approvals, failures and go-live confirmation.</small></div><input type="checkbox" checked={email} onChange={event => setEmail(event.target.checked)} /><span /></label><label className="setting-toggle"><div><strong>Weekly delivery summary</strong><small>A plain-language report every Monday.</small></div><input type="checkbox" defaultChecked /><span /></label></>}{tab === "Connections" && <><div className="settings-title"><span>↗</span><div><h2>Connected services</h2><p>Review and revoke access from one place.</p></div></div>{["Meta WhatsApp Business", "Cloudflare", "Shopify demo"].map((item, index) => <div className="connection-row" key={item}><span>{item.slice(0, 2)}</span><div><strong>{item}</strong><small>{index < 2 ? "Connected · permission review available" : "Demo connection"}</small></div><button onClick={() => toast("Connection action", `The secure ${item} connection flow will open here.`)}>Manage</button></div>)}</>}{tab === "Privacy & security" && <><div className="settings-title"><span>🛡</span><div><h2>Privacy & security</h2><p>Control sessions and understand data protection.</p></div></div><div className="security-block"><h3>Active session</h3><p>Windows · Codex desktop · Current session</p><button className="button ghost">Sign out other sessions</button></div><div className="security-block"><h3>Customer message data</h3><p>Whatsnot should store only the minimum delivery metadata required for support and auditing. Message content persistence requires an explicit retention policy.</p></div></>}</div></section></>;
}

function NotificationsDrawer({ close }: { close: () => void }) {
  return <div className="drawer-layer" onClick={close}><aside className="notifications-drawer" onClick={event => event.stopPropagation()}><div className="drawer-title"><div><span className="kicker">UPDATES</span><h2>Notifications</h2></div><button onClick={close}>×</button></div>{[{tone:"orange",title:"Template approval pending",body:"Meta is reviewing your order-confirmation wording.",time:"12 min ago"},{tone:"green",title:"1,248 messages delivered",body:"Your monthly delivery success is 98.7%.",time:"2 hr ago"},{tone:"blue",title:"Cost estimate approved",body:"Your one-time starter activation was recorded.",time:"Yesterday"}].map(item => <button className="drawer-item" key={item.title}><span className={item.tone} /><div><strong>{item.title}</strong><p>{item.body}</p><time>{item.time}</time></div></button>)}<button className="drawer-footer" onClick={close}>Mark all as read</button></aside></div>;
}

function CommandPalette({ navigate, close }: { navigate: (route: Route) => void; close: () => void }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const items = navItems.filter(item => `${item.label} ${item.hint}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="modal-backdrop command-layer" onClick={close}><div className="command" onClick={event => event.stopPropagation()}><label><span>⌕</span><input ref={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a page or action…" /><kbd>ESC</kbd></label><p>GO TO</p>{items.map(item => <button key={item.route} onClick={() => { navigate(item.route); close(); }}><span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.hint}</small></div><b>↵</b></button>)}</div></div>;
}

export function WhatsnotApp() {
  const [route, setRoute] = useState<Route>("home");
  const [userName, setUserName] = useState("Harsh");
  const [systems, setSystemsState] = useState<SystemItem[]>(defaultSystems);
  const [notifications, setNotifications] = useState(false);
  const [command, setCommand] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      const initialRoute = pathToRoute();
      const signedIn = localStorage.getItem("whatsnot-auth") === "true";
      if (appRoutes.includes(initialRoute as AppRoute) && !signedIn) {
        window.history.replaceState({}, "", "/login");
        setRoute("login");
      } else {
        setRoute(initialRoute);
      }
      const saved = localStorage.getItem("whatsnot-systems");
      const savedName = localStorage.getItem("whatsnot-name");
      if (saved) { try { setSystemsState(JSON.parse(saved) as SystemItem[]); } catch { /* ignore invalid local demo data */ } }
      if (savedName) setUserName(savedName);
    }, 0);
    const pop = () => setRoute(pathToRoute());
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommand(value => !value); }
      if (event.key === "Escape") { setCommand(false); setNotifications(false); }
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("keydown", key);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => { window.clearTimeout(hydrate); window.removeEventListener("popstate", pop); window.removeEventListener("keydown", key); };
  }, []);

  const navigate = (next: Route) => { window.history.pushState({}, "", routePath(next)); setRoute(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const setSystems = (next: SystemItem[]) => { setSystemsState(next); localStorage.setItem("whatsnot-systems", JSON.stringify(next)); };
  const onAuth = (name: string) => { setUserName(name); localStorage.setItem("whatsnot-name", name); localStorage.setItem("whatsnot-auth", "true"); };
  const toast = (title: string, body: string) => { const item = { id: Date.now(), title, body }; setToasts(items => [...items, item]); window.setTimeout(() => setToasts(items => items.filter(value => value.id !== item.id)), 4200); };

  if (route === "home") return <HomePage navigate={navigate} />;
  if (route === "learn") return <LearnPage navigate={navigate} />;
  if (route === "login" || route === "signup") return <AuthPage mode={route} navigate={navigate} onAuth={onAuth} />;
  if (route === "checkout") return <CheckoutPage navigate={navigate} onComplete={() => toast("Estimate approved", "Your guided setup is ready to continue.")} />;

  const appRoute = route as AppRoute;
  return <AppShell route={appRoute} navigate={navigate} userName={userName} unread={3} openNotifications={() => setNotifications(true)} openCommand={() => setCommand(true)} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}>
    {appRoute === "dashboard" && <DashboardPage navigate={navigate} />}
    {appRoute === "systems" && <SystemsPage systems={systems} setSystems={setSystems} navigate={navigate} toast={toast} />}
    {appRoute === "setup" && <SetupPage systems={systems} setSystems={setSystems} navigate={navigate} toast={toast} />}
    {appRoute === "automations" && <AutomationsPage toast={toast} />}
    {appRoute === "activity" && <ActivityPage toast={toast} />}
    {appRoute === "costs" && <CostsPage toast={toast} />}
    {appRoute === "settings" && <SettingsPage toast={toast} />}
    {notifications && <NotificationsDrawer close={() => setNotifications(false)} />}
    {command && <CommandPalette navigate={navigate} close={() => setCommand(false)} />}
    <div className="toast-stack" aria-live="polite">{toasts.map(item => <div className="toast" key={item.id}><span>✓</span><div><strong>{item.title}</strong><p>{item.body}</p></div><button onClick={() => setToasts(items => items.filter(value => value.id !== item.id))}>×</button></div>)}</div>
  </AppShell>;
}
