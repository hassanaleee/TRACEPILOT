"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Key,
  Layers,
  Database,
  Terminal,
  Shield,
  CheckCircle2,
  AlertCircle,
  Copy,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkles,
  Search,
  Filter,
  BarChart3,
  Cpu,
  RefreshCw,
  LogOut,
  User as UserIcon,
} from "lucide-react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: string;
}

interface Project {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description?: string;
}

interface APIKeyItem {
  id: string;
  project_id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
}

export default function TracePilotDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "traces" | "apikeys" | "rag" | "sdk">("overview");
  const [backendStatus, setBackendStatus] = useState<"online" | "offline" | "checking">("checking");

  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loginEmail, setLoginEmail] = useState("admin@tracepilot.dev");
  const [loginPassword, setLoginPassword] = useState("AdminSecurePassword123!");
  const [authError, setAuthError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Tenant / Projects State
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // API Keys State
  const [apiKeys, setApiKeys] = useState<APIKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDays, setNewKeyDays] = useState(90);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [isKeyLoading, setIsKeyLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Trace Explorer & RAG state
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>("tr_8a4b6c2d1e0f");
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>("sp_retrieval_01");

  // Check Backend Health
  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        setBackendStatus("online");
      } else {
        setBackendStatus("offline");
      }
    } catch {
      setBackendStatus("offline");
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // Quick Auto-login with existing demo account on mount
  useEffect(() => {
    const autoLogin = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        });
        if (res.ok) {
          const data = await res.json();
          setToken(data.access_token);
          setUser(data.user);
        }
      } catch (e) {
        console.error("Auto login error", e);
      }
    };
    autoLogin();
  }, []);

  // Fetch Organizations when token exists
  useEffect(() => {
    if (!token) return;
    const fetchOrgs = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/organizations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setOrganizations(data);
          if (data.length > 0) setSelectedOrg(data[0]);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchOrgs();
  }, [token]);

  // Fetch Projects when selectedOrg changes
  useEffect(() => {
    if (!token || !selectedOrg) return;
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/organizations/${selectedOrg.id}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
          if (data.length > 0) setSelectedProject(data[0]);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchProjects();
  }, [token, selectedOrg]);

  // Fetch API Keys when selectedProject changes
  const refreshApiKeys = async () => {
    if (!token || !selectedProject) return;
    setIsKeyLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${selectedProject.id}/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsKeyLoading(false);
    }
  };

  useEffect(() => {
    refreshApiKeys();
  }, [token, selectedProject]);

  // Handle Login Form
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        setUser(data.user);
        setShowAuthModal(false);
      } else {
        const err = await res.json();
        setAuthError(err.detail || "Authentication failed");
      }
    } catch {
      setAuthError("Failed to reach server");
    }
  };

  // Create API Key
  const handleCreateAPIKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedProject || !newKeyName) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${selectedProject.id}/api-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newKeyName, expires_in_days: newKeyDays }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedRawKey(data.raw_key);
        setNewKeyName("");
        refreshApiKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Revoke API Key
  const handleRevokeKey = async (keyId: string) => {
    if (!token || !selectedProject) return;
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${selectedProject.id}/api-keys/${keyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        refreshApiKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-[#F8FAFC] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-[#1F2937] bg-[#0E1526]/80 backdrop-blur-md px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-lg text-white">TracePilot</span>
              <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 font-mono">
                v0.1.0
              </span>
            </div>
          </div>

          {/* Org & Project Selector */}
          {selectedOrg && (
            <div className="hidden md:flex items-center space-x-2 bg-[#111827] border border-[#1F2937] rounded-md px-2.5 py-1 text-xs text-[#94A3B8]">
              <span className="text-gray-400 font-medium">{selectedOrg.name}</span>
              <span>/</span>
              <span className="text-white font-medium">{selectedProject?.name || "Default Project"}</span>
            </div>
          )}
        </div>

        {/* Server Status & Auth */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs px-2.5 py-1 rounded-full bg-[#111827] border border-[#1F2937]">
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus === "online" ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="text-gray-300 font-mono">
              API: {backendStatus === "online" ? API_BASE.replace(/^https?:\/\//, "") : "Offline"}
            </span>
          </div>

          {user ? (
            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5 text-gray-300">
                <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>{user.email}</span>
              </div>
              <button
                onClick={() => {
                  setToken(null);
                  setUser(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-60 border-r border-[#1F2937] bg-[#0B101E] flex flex-col justify-between p-4">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "overview"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-[#94A3B8] hover:bg-[#111827] hover:text-white"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics & Spends</span>
            </button>

            <button
              onClick={() => setActiveTab("traces")}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "traces"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-[#94A3B8] hover:bg-[#111827] hover:text-white"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Trace Explorer</span>
            </button>

            <button
              onClick={() => setActiveTab("rag")}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "rag"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-[#94A3B8] hover:bg-[#111827] hover:text-white"
              }`}
            >
              <Database className="w-4 h-4" />
              <span>RAG Inspector</span>
            </button>

            <button
              onClick={() => setActiveTab("apikeys")}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "apikeys"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-[#94A3B8] hover:bg-[#111827] hover:text-white"
              }`}
            >
              <Key className="w-4 h-4" />
              <span>API Keys & Secrets</span>
            </button>

            <button
              onClick={() => setActiveTab("sdk")}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "sdk"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-[#94A3B8] hover:bg-[#111827] hover:text-white"
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>SDK Quickstart</span>
            </button>
          </nav>

          {/* Tenant Isolation Badge */}
          <div className="bg-[#111827] border border-[#1F2937] p-3 rounded-lg text-xs space-y-2">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
              <Shield className="w-3.5 h-3.5" />
              <span>Tenant Isolated</span>
            </div>
            <p className="text-[#94A3B8] text-[11px] leading-relaxed">
              Every query and trace batch is cryptographically partitioned by project ID.
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8">
          {/* TAB 1: OVERVIEW & ANALYTICS */}
          {activeTab === "overview" && (
            <div className="space-y-8 max-w-6xl">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Observability Overview</h1>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Real-time telemetry, model spend attribution, and latency across your AI workloads.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-[#94A3B8] font-medium uppercase tracking-wider">Total Traces</div>
                  <div className="text-2xl font-bold text-white mt-2 font-mono">1,428</div>
                  <div className="text-[11px] text-emerald-400 flex items-center mt-2">
                    <span>↑ 18.4% from last period</span>
                  </div>
                </div>

                <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-[#94A3B8] font-medium uppercase tracking-wider">Total Token Consumption</div>
                  <div className="text-2xl font-bold text-white mt-2 font-mono">2.84M</div>
                  <div className="text-[11px] text-gray-400 mt-2 font-mono">
                    Prompt: 2.1M | Compl: 740K
                  </div>
                </div>

                <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-[#94A3B8] font-medium uppercase tracking-wider">Attributed Cost</div>
                  <div className="text-2xl font-bold text-white mt-2 font-mono">$14.28</div>
                  <div className="text-[11px] text-[#94A3B8] mt-2">Calculated via dynamic model matrix</div>
                </div>

                <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-[#94A3B8] font-medium uppercase tracking-wider">p95 Latency</div>
                  <div className="text-2xl font-bold text-white mt-2 font-mono">1.82s</div>
                  <div className="text-[11px] text-emerald-400 mt-2">Avg RAG retrieval: 210ms</div>
                </div>
              </div>

              {/* Model Pricing & Usage Breakdown Table */}
              <div className="bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#1F2937] flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <h2 className="text-sm font-semibold text-white">Model Spend & Token Attribution Matrix</h2>
                  </div>
                  <span className="text-xs text-[#94A3B8] font-mono">Updated continuously</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B101E] text-[#94A3B8] border-b border-[#1F2937]">
                      <tr>
                        <th className="py-3 px-6 font-medium">Model</th>
                        <th className="py-3 px-6 font-medium">Provider</th>
                        <th className="py-3 px-6 font-medium">Input / 1M</th>
                        <th className="py-3 px-6 font-medium">Output / 1M</th>
                        <th className="py-3 px-6 font-medium">Total Tokens</th>
                        <th className="py-3 px-6 font-medium">Estimated Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F2937] text-gray-300 font-mono">
                      <tr className="hover:bg-[#1E293B]/50 transition-colors">
                        <td className="py-3.5 px-6 font-semibold text-white">gpt-4o</td>
                        <td className="py-3.5 px-6 text-gray-400">OpenAI</td>
                        <td className="py-3.5 px-6">$5.00</td>
                        <td className="py-3.5 px-6">$15.00</td>
                        <td className="py-3.5 px-6">1,820,410</td>
                        <td className="py-3.5 px-6 text-emerald-400 font-semibold">$10.92</td>
                      </tr>
                      <tr className="hover:bg-[#1E293B]/50 transition-colors">
                        <td className="py-3.5 px-6 font-semibold text-white">claude-3-5-sonnet</td>
                        <td className="py-3.5 px-6 text-gray-400">Anthropic</td>
                        <td className="py-3.5 px-6">$3.00</td>
                        <td className="py-3.5 px-6">$15.00</td>
                        <td className="py-3.5 px-6">620,150</td>
                        <td className="py-3.5 px-6 text-emerald-400 font-semibold">$2.48</td>
                      </tr>
                      <tr className="hover:bg-[#1E293B]/50 transition-colors">
                        <td className="py-3.5 px-6 font-semibold text-white">text-embedding-3-small</td>
                        <td className="py-3.5 px-6 text-gray-400">OpenAI</td>
                        <td className="py-3.5 px-6">$0.02</td>
                        <td className="py-3.5 px-6">—</td>
                        <td className="py-3.5 px-6">4,120,000</td>
                        <td className="py-3.5 px-6 text-emerald-400 font-semibold">$0.08</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRACE EXPLORER */}
          {activeTab === "traces" && (
            <div className="space-y-6 max-w-6xl">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Trace Explorer</h1>
                  <p className="text-sm text-[#94A3B8] mt-1">
                    Inspect hierarchical execution trees, nested spans, and duration bottlenecks.
                  </p>
                </div>
              </div>

              {/* Sample Trace List + Waterfall */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Traces List */}
                <div className="lg:col-span-5 bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden">
                  <div className="p-3 border-b border-[#1F2937] bg-[#0B101E] flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-300">Traces (3 Active)</span>
                    <span className="text-[11px] text-gray-500 font-mono">Live</span>
                  </div>
                  <div className="divide-y divide-[#1F2937]">
                    {[
                      {
                        id: "tr_8a4b6c2d1e0f",
                        name: "financial-rag-agent",
                        duration: "2,410ms",
                        tokens: "1,604",
                        status: "SUCCESS",
                        time: "2 mins ago",
                      },
                      {
                        id: "tr_991823abce12",
                        name: "customer-support-qa",
                        duration: "840ms",
                        tokens: "450",
                        status: "SUCCESS",
                        time: "14 mins ago",
                      },
                      {
                        id: "tr_334211bcde99",
                        name: "sql-coder-agent",
                        duration: "1,120ms",
                        tokens: "910",
                        status: "ERROR",
                        time: "28 mins ago",
                      },
                    ].map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTraceId(t.id)}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedTraceId === t.id ? "bg-blue-950/40 border-l-2 border-blue-500" : "hover:bg-[#1E293B]/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">{t.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              t.status === "SUCCESS"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : "bg-rose-950 text-rose-400 border border-rose-800"
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 mt-2 text-xs text-[#94A3B8] font-mono">
                          <span>{t.duration}</span>
                          <span>•</span>
                          <span>{t.tokens} tokens</span>
                          <span>•</span>
                          <span>{t.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Waterfall & Span Tree Inspector */}
                <div className="lg:col-span-7 bg-[#111827] border border-[#1F2937] rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-[#1F2937]">
                      <div>
                        <div className="text-xs text-[#94A3B8] font-mono">Trace ID: {selectedTraceId}</div>
                        <h3 className="text-base font-bold text-white mt-1">Execution Waterfall Timeline</h3>
                      </div>
                      <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono font-medium">
                        Duration: 2,410ms
                      </span>
                    </div>

                    {/* Hierarchical Spans */}
                    <div className="mt-5 space-y-3">
                      {/* Span 1: Root */}
                      <div className="p-3 bg-[#0B101E] border border-[#1F2937] rounded-lg">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono font-semibold text-[10px]">
                              ROOT
                            </span>
                            <span className="font-semibold text-white">financial-rag-agent</span>
                          </div>
                          <span className="font-mono text-gray-400">2,410ms</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div className="bg-blue-500 h-full w-full rounded-full" />
                        </div>
                      </div>

                      {/* Span 2: Retrieval */}
                      <div
                        onClick={() => setSelectedSpanId("sp_retrieval_01")}
                        className={`p-3 ml-4 bg-[#0B101E] border border-[#1F2937] rounded-lg cursor-pointer transition-all ${
                          selectedSpanId === "sp_retrieval_01" ? "border-cyan-500 shadow-sm" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-bold text-[10px]">
                              RETRIEVAL
                            </span>
                            <span className="font-semibold text-white">retrieve-sec-10k-filings</span>
                          </div>
                          <span className="font-mono text-cyan-400">420ms</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden flex">
                          <div className="bg-transparent h-full w-[5%]" />
                          <div className="bg-cyan-500 h-full w-[20%] rounded-full" />
                        </div>
                      </div>

                      {/* Span 3: Reranker */}
                      <div className="p-3 ml-8 bg-[#0B101E] border border-[#1F2937] rounded-lg">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-bold text-[10px]">
                              RERANK
                            </span>
                            <span className="font-semibold text-white">cohere-rerank-v3</span>
                          </div>
                          <span className="font-mono text-emerald-400">110ms</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden flex">
                          <div className="bg-transparent h-full w-[25%]" />
                          <div className="bg-emerald-500 h-full w-[8%] rounded-full" />
                        </div>
                      </div>

                      {/* Span 4: LLM Generation */}
                      <div className="p-3 ml-4 bg-[#0B101E] border border-[#1F2937] rounded-lg">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800 font-mono font-bold text-[10px]">
                              LLM
                            </span>
                            <span className="font-semibold text-white">gpt-4o-synthesize-answer</span>
                          </div>
                          <span className="font-mono text-purple-400">1,880ms</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden flex">
                          <div className="bg-transparent h-full w-[33%]" />
                          <div className="bg-purple-500 h-full w-[67%] rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#1F2937] flex items-center justify-between text-xs text-[#94A3B8]">
                    <span>Click any span to view raw payload, attributes, and errors.</span>
                    <button
                      onClick={() => setActiveTab("rag")}
                      className="text-cyan-400 hover:underline flex items-center space-x-1"
                    >
                      <span>Open in RAG Inspector</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RAG INSPECTOR */}
          {activeTab === "rag" && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">RAG Observability & Chunk Inspector</h1>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Inspect retrieved document chunks, vector similarity thresholds, and context window assembly.
                </p>
              </div>

              {/* RAG Inspection Card */}
              <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 space-y-6">
                <div>
                  <div className="text-xs font-semibold uppercase text-cyan-400 tracking-wider font-mono">User Query</div>
                  <div className="mt-2 text-base font-medium text-white bg-[#0B101E] p-3 rounded-lg border border-[#1F2937]">
                    &quot;What were Acme Corp&apos;s Q3 2026 operating margins and key revenue drivers?&quot;
                  </div>
                </div>

                {/* Chunks Grid */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase text-[#94A3B8] tracking-wider font-mono">
                    Retrieved Documents (Top 2 of 24 Chunks)
                  </div>

                  <div className="p-4 bg-[#0B101E] border border-cyan-900/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">Chunk #1 — sec_10q_filing_p14.pdf</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] text-gray-400 font-mono">Cosine Score:</span>
                        <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 font-mono font-bold">
                          0.912
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed font-mono bg-[#070B14] p-3 rounded border border-gray-800">
                      &quot;Operating margins expanded by 180 bps year-over-year to 24.2%, primarily driven by efficiency gains
                      in cloud infrastructure and enterprise subscription software adoption...&quot;
                    </p>
                  </div>

                  <div className="p-4 bg-[#0B101E] border border-[#1F2937] rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">Chunk #2 — sec_10q_filing_p16.pdf</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] text-gray-400 font-mono">Cosine Score:</span>
                        <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 font-mono font-bold">
                          0.841
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed font-mono bg-[#070B14] p-3 rounded border border-gray-800">
                      &quot;Gross margin was 68.4% compared to 67.2% in the prior-year period. Revenue from AI-native product lines
                      surpassed $142M in Q3 2026...&quot;
                    </p>
                  </div>
                </div>

                {/* Synthesized Response */}
                <div>
                  <div className="text-xs font-semibold uppercase text-purple-400 tracking-wider font-mono">
                    Generated LLM Response (GPT-4o)
                  </div>
                  <div className="mt-2 text-xs text-gray-200 bg-[#0B101E] p-4 rounded-lg border border-purple-900/40 font-mono leading-relaxed">
                    In Q3 2026, Acme Corp achieved operating margins of 24.2%, marking an expansion of 180 basis points
                    year-over-year. Key revenue drivers included enterprise cloud infrastructure adoption and AI-native products,
                    which generated over $142M during the quarter.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: API KEYS MANAGER */}
          {activeTab === "apikeys" && (
            <div className="space-y-6 max-w-5xl">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">API Keys & Access Control</h1>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Issue cryptographically hashed keys to authenticate your Python SDK ingestion pipeline.
                </p>
              </div>

              {/* Created Key Alert Modal */}
              {createdRawKey && (
                <div className="bg-emerald-950/60 border border-emerald-600/50 p-5 rounded-xl space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>API Key Generated Successfully</span>
                  </div>
                  <p className="text-xs text-emerald-200">
                    Copy this key immediately. For security, it is hashed with SHA-256 and will <strong>never</strong> be
                    displayed again.
                  </p>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={createdRawKey}
                      className="bg-black/60 border border-emerald-700 text-emerald-400 font-mono text-xs px-3 py-2 rounded-lg flex-1 select-all"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdRawKey);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedKey ? "Copied!" : "Copy"}</span>
                    </button>
                    <button
                      onClick={() => setCreatedRawKey(null)}
                      className="text-xs text-gray-400 hover:text-white px-2 py-1"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Create API Key Form */}
              <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-xl shadow-sm">
                <h2 className="text-sm font-semibold text-white mb-3">Generate New API Key</h2>
                <form onSubmit={handleCreateAPIKey} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Key description (e.g. Production Agent Cluster)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    required
                    className="bg-[#0B101E] border border-[#1F2937] text-white text-xs px-3 py-2.5 rounded-lg flex-1 focus:outline-none focus:border-blue-500"
                  />
                  <select
                    value={newKeyDays}
                    onChange={(e) => setNewKeyDays(Number(e.target.value))}
                    className="bg-[#0B101E] border border-[#1F2937] text-gray-300 text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value={30}>Expires in 30 days</option>
                    <option value={90}>Expires in 90 days</option>
                    <option value={365}>Expires in 1 year</option>
                  </select>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Key</span>
                  </button>
                </form>
              </div>

              {/* API Keys Table */}
              <div className="bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#1F2937] flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">Active Project Keys</h2>
                  <button
                    onClick={refreshApiKeys}
                    className="text-xs text-gray-400 hover:text-white flex items-center space-x-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isKeyLoading ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B101E] text-[#94A3B8] border-b border-[#1F2937]">
                      <tr>
                        <th className="py-3 px-6 font-medium">Name</th>
                        <th className="py-3 px-6 font-medium">Prefix</th>
                        <th className="py-3 px-6 font-medium">Created</th>
                        <th className="py-3 px-6 font-medium">Status</th>
                        <th className="py-3 px-6 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F2937] text-gray-300 font-mono">
                      {apiKeys.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-gray-500">
                            No API keys issued yet. Generate your first key above.
                          </td>
                        </tr>
                      ) : (
                        apiKeys.map((key) => (
                          <tr key={key.id} className="hover:bg-[#1E293B]/40 transition-colors">
                            <td className="py-3.5 px-6 font-semibold text-white">{key.name}</td>
                            <td className="py-3.5 px-6 text-blue-400">{key.key_prefix}••••••••</td>
                            <td className="py-3.5 px-6 text-gray-400">
                              {new Date(key.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-6">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  key.is_active
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                    : "bg-rose-950 text-rose-400 border border-rose-800"
                                }`}
                              >
                                {key.is_active ? "ACTIVE" : "REVOKED"}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              {key.is_active && (
                                <button
                                  onClick={() => handleRevokeKey(key.id)}
                                  className="text-rose-400 hover:text-rose-300 transition-colors inline-flex items-center space-x-1"
                                  title="Revoke key"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Revoke</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SDK QUICKSTART */}
          {activeTab === "sdk" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Python SDK Integration</h1>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Instrument your AI agent and RAG pipelines in less than 3 lines of code.
                </p>
              </div>

              <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-xl space-y-4">
                <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-mono">
                  1. Install Package
                </div>
                <div className="bg-black/60 border border-gray-800 p-3 rounded-lg text-xs font-mono text-emerald-400 flex items-center justify-between">
                  <span>pip install tracepilot</span>
                  <button
                    onClick={() => navigator.clipboard.writeText("pip install tracepilot")}
                    className="text-gray-400 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-mono pt-3">
                  2. Instrument RAG Pipeline
                </div>
                <pre className="bg-black/60 border border-gray-800 p-4 rounded-lg text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed">
{`from tracepilot import TracePilot

client = TracePilot(
    api_key="tp_live_YOUR_PROJECT_API_KEY",
    endpoint="${API_BASE}"
)

def run_agent(query: str):
    with client.trace(name="customer-support-agent") as trace:
        # Step 1: Document Retrieval
        with client.span(name="retrieve-documents", span_type="RETRIEVAL") as span:
            span.set_input({"query": query})
            docs = vector_db.similarity_search(query, k=3)
            span.set_output({"documents": docs})

        # Step 2: LLM Completion
        with client.span(name="generate-answer", span_type="LLM") as span:
            prompt = f"Context: {docs}\\nQuestion: {query}"
            span.set_input({"prompt": prompt})
            answer = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}]
            )
            span.set_output({"completion": answer})

        return answer`}
                </pre>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1F2937] p-6 rounded-xl w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Sign In to TracePilot</h3>
              <button onClick={() => setShowAuthModal(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            {authError && (
              <div className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 p-2.5 rounded-lg">
                {authError}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-xs text-[#94A3B8]">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full bg-[#0B101E] border border-[#1F2937] text-white text-xs px-3 py-2 rounded-lg mt-1 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-[#94A3B8]">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full bg-[#0B101E] border border-[#1F2937] text-white text-xs px-3 py-2 rounded-lg mt-1 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors mt-2"
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
