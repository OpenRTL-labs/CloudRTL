import { useEffect, useState } from 'react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'projects', label: 'Projects' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'synthesis', label: 'Synthesis' },
  { id: 'physical-design', label: 'Physical Design' },
]

function ProjectsView() {
  const [projects, setProjects] = useState([])
  const [projectsStatus, setProjectsStatus] = useState('loading')

  useEffect(() => {
    fetch('/projects')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch projects')
        }
        return response.json()
      })
      .then((data) => {
        setProjects(data.projects)
        setProjectsStatus('loaded')
      })
      .catch(() => {
        setProjectsStatus('error')
      })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Projects
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage your RTL and EDA workspaces.
        </p>
      </div>

      {projectsStatus === 'loading' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
          Loading projects...
        </div>
      )}

      {projectsStatus === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">
          Unable to load projects from backend.
        </div>
      )}

      {projectsStatus === 'loaded' &&
        projects.map((project) => (
          <div
            key={project.name}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  {project.type}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {project.name}
                </h2>
              </div>

              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                {project.status}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">Technology</p>
                <p className="mt-1 text-sm font-medium text-slate-200">
                  {project.technology}
                </p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">Top Module</p>
                <p className="mt-1 text-sm font-medium text-slate-200">
                  {project.top_module}
                </p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">Workspace</p>
                <p className="mt-1 text-sm font-medium text-slate-200">
                  RTL + EDA
                </p>
              </div>
            </div>

            <button
              type="button"
              className="mt-6 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
            >
              Open Project
            </button>
          </div>
        ))}

      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          New Workspace
        </p>

        <h2 className="mt-2 text-lg font-semibold text-slate-200">
          Create New Project
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Start a new RTL and EDA workspace.
        </p>

        <button
          type="button"
          className="mt-5 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
        >
          Create Project
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [backendStatus, setBackendStatus] = useState('checking')

  useEffect(() => {
    fetch('/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Backend unavailable')
        }
        return response.json()
      })
      .then((data) => {
        setBackendStatus(data.status === 'healthy' ? 'connected' : 'disconnected')
      })
      .catch(() => {
        setBackendStatus('disconnected')
      })
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 antialiased font-sans select-none">
      {/* Top Header */}
      <header className="flex h-14 w-full items-center justify-between border-b border-slate-800 bg-slate-900 px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-600 font-bold text-white shadow-sm">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 7h.01" />
              <path d="M17 7h.01" />
              <path d="M7 17h.01" />
              <path d="M17 17h.01" />
              <path d="M9 12h6" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-white">
              CloudRTL
            </span>
            <span className="rounded bg-cyan-950 px-2 py-0.5 text-xs font-medium text-cyan-400 border border-cyan-800/60">
              EDA Platform
            </span>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          Cloud-Based RTL Simulation Platform
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-60 flex-shrink-0 border-r border-slate-800 bg-slate-900/90 flex flex-col justify-between p-3">
          <div className="space-y-1">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Navigation
            </div>
            {navItems.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-slate-600'
                      }`}
                  />
                  {item.label}
                </button>
              )
            })}
          </div>

          <div className="rounded-md border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-400">
            <p className="font-medium text-slate-300">Environment</p>
            <p className="mt-1 text-slate-400">Workspace Ready</p>
            <p className="mt-2">
              Backend:{' '}
              <span
                className={
                  backendStatus === 'connected'
                    ? 'text-emerald-400'
                    : backendStatus === 'disconnected'
                      ? 'text-red-400'
                      : 'text-yellow-400'
                }
              >
                {backendStatus === 'connected'
                  ? 'Connected'
                  : backendStatus === 'disconnected'
                    ? 'Disconnected'
                    : 'Checking...'}
              </span>
            </p>
          </div>
        </aside>

        {/* Main Workspace Area */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            {activeTab === 'projects' ? (
              <ProjectsView />
            ) : (
              <>
                {/* Welcome Section */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 shadow-sm">
                  <div className="max-w-2xl space-y-3">
                    <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      Welcome to CloudRTL
                    </h1>
                    <p className="text-slate-400 leading-relaxed text-sm">
                      A cloud-native Electronic Design Automation (EDA) workspace for
                      RTL design, verification, logic synthesis, and physical layout.
                    </p>
                  </div>

                  {/* Workspace Placeholder Cards */}
                  <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                        Simulation
                      </div>
                      <h3 className="mt-2 font-medium text-slate-200">
                        RTL Simulation & Waveforms
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 leading-normal">
                        Run Verilog and SystemVerilog testbenches in the cloud.
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                        Synthesis
                      </div>
                      <h3 className="mt-2 font-medium text-slate-200">
                        Logic Synthesis
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 leading-normal">
                        Translate RTL to optimized gate-level netlists.
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                        Physical Design
                      </div>
                      <h3 className="mt-2 font-medium text-slate-200">
                        ASIC Implementation
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 leading-normal">
                        Place and route flow with standard cell technology.
                      </p>
                    </div>
                  </div>
                </div>
                {/* Active Section Placeholder */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 text-center text-sm text-slate-400">
                  Active view:{' '}
                  <span className="font-semibold text-slate-200">
                    {navItems.find((n) => n.id === activeTab)?.label}
                  </span>{' '}
                  — workspace modules will be mounted here.
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
