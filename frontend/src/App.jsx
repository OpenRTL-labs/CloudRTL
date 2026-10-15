import { useEffect, useState } from 'react'
import { createProjectSession } from './hooks/useProjectSession'
import ProjectWorkspace from './components/projects/ProjectWorkspace'
import ProjectsView from './components/projects/ProjectsView'
import LoginPage from './components/auth/LoginPage'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import DashboardView from './components/dashboard/DashboardView'
import SimulationPage from './components/simulation/SimulationPage'
import SynthesisPage from './components/synthesis/SynthesisPage'
import PhysicalDesignPage from './components/physical/PhysicalDesignPage'
import { getAuthToken, getCurrentUser, logout } from './services/projectApi'

const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'projects', label: 'Projects' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'synthesis', label: 'Synthesis' },
  { id: 'physical-design', label: 'Physical Design' },
]


export default function App() {
  const [authStatus, setAuthStatus] = useState(
    getAuthToken() ? 'checking' : 'logged-out'
  )
  const [currentUser, setCurrentUser] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [backendStatus, setBackendStatus] = useState('checking')
  const [activeProject, setActiveProject] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [projectSessions, setProjectSessions] = useState(() => ({
    counter: createProjectSession(),
  }))
  const [, setOpenCreateProject] = useState(false)

  const handleOpenProject = (project) => {
    setActiveProject(project)
    setSelectedProject(project)

    setProjectSessions((previous) => {
      if (previous[project.name]) {
        return previous
      }

      return {
        ...previous,
        [project.name]: createProjectSession(),
      }
    })
  }

  const handleLogin = () => {
    getCurrentUser()
      .then((user) => {
        setCurrentUser(user)
        setAuthStatus('authenticated')
      })
      .catch(() => {
        logout()
        setCurrentUser(null)
        setAuthStatus('logged-out')
      })
  }

  const handleLogout = () => {
    logout()
    setCurrentUser(null)
    setActiveProject(null)
    setSelectedProject(null)
    setAuthStatus('logged-out')
  }

  useEffect(() => {
    if (!getAuthToken()) {
      return
    }

    getCurrentUser()
      .then((user) => {
        setCurrentUser(user)
        setAuthStatus('authenticated')
      })
      .catch(() => {
        logout()
        setCurrentUser(null)
        setAuthStatus('logged-out')
      })
  }, [])

  useEffect(() => {
    const handleAuthExpired = () => {
      logout()
      setCurrentUser(null)
      setAuthStatus('logged-out')
      setActiveProject(null)
      setSelectedProject(null)
    }

    window.addEventListener(
      'cloudrtl-auth-expired',
      handleAuthExpired
    )

    return () => {
      window.removeEventListener(
        'cloudrtl-auth-expired',
        handleAuthExpired
      )
    }
  }, [])

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

  if (authStatus === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Checking authentication...
      </div>
    )
  }

  if (authStatus === 'logged-out') {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 antialiased font-sans select-none">
      <div className="relative">
        <Header />

        <div className="absolute right-4 top-3 z-10 flex items-center gap-3">
          {currentUser && (
            <span className="text-xs text-slate-400">
              {currentUser.username}
            </span>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          navItems={navItems}
          activeTab={activeTab}
          onNavigate={(tabId) => {
            setActiveTab(tabId)
            setActiveProject(null)
            if (tabId !== 'projects') {
              setOpenCreateProject(false)
            }
          }}
          backendStatus={backendStatus}
        />

        {/* Main Workspace Area */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            {activeProject ? (
              <ProjectWorkspace
                key={activeProject.name}
                project={activeProject}
                session={projectSessions[activeProject.name]}
                setSession={(updater) => {
                  setProjectSessions((previous) => ({
                    ...previous,
                    [activeProject.name]:
                      typeof updater === 'function'
                        ? updater(previous[activeProject.name])
                        : updater,
                  }))
                }}
                onBack={() => setActiveProject(null)}
              />
            ) : activeTab === 'projects' ? (
              <ProjectsView
                onOpenProject={handleOpenProject}
                openCreateProject={false}
              />
            ) : activeTab === 'simulation' ? (
              <SimulationPage
                project={selectedProject}
                session={
                  projectSessions[selectedProject?.name] ||
                  projectSessions['counter']
                }
                setSession={(updater) => {
                  const targetProjectName = selectedProject?.name || 'counter'

                  setProjectSessions((previous) => ({
                    ...previous,
                    [targetProjectName]:
                      typeof updater === 'function'
                        ? updater(previous[targetProjectName])
                        : updater,
                  }))
                }}
                projectSessions={projectSessions}
                setProjectSessions={setProjectSessions}
                onAddNewDesign={() => {
                  setActiveTab('projects')
                  setActiveProject(null)
                }}
              />
            ) : activeTab === 'synthesis' ? (
              <SynthesisPage
                projectSessions={projectSessions}
                setProjectSessions={setProjectSessions}
                onAddNewDesign={() => {
                  setActiveProject(null)
                  setSelectedProject(null)
                  setOpenCreateProject(true)
                  setActiveTab('projects')
                }}
              />
            ) : activeTab === 'physical-design' ? (
              <PhysicalDesignPage
                project={selectedProject}
                session={
                  projectSessions[selectedProject?.name] ||
                  projectSessions['counter']
                }
                setSession={(updater) => {
                  const targetProjectName = selectedProject?.name || 'counter'

                  setProjectSessions((previous) => ({
                    ...previous,
                    [targetProjectName]:
                      typeof updater === 'function'
                        ? updater(previous[targetProjectName])
                        : updater,
                  }))
                }}
                projectSessions={projectSessions}
                setProjectSessions={setProjectSessions}
                onAddNewDesign={() => {
                  setActiveTab('projects')
                  setActiveProject(null)
                }}
              />
            ) : (
              <DashboardView
                activeTab={activeTab}
                navItems={navItems}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
