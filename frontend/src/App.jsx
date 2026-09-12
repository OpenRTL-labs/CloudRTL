import { useEffect, useState } from 'react'
import { createProjectSession } from './hooks/useProjectSession'
import SimulationSection from './components/simulation/SimulationSection'
import SynthesisSection from './components/synthesis/SynthesisSection'
import PhysicalDesignSection from './components/physical/PhysicalDesignSection'
import ProjectWorkspace from './components/projects/ProjectWorkspace'
import ProjectsView from './components/projects/ProjectsView'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import DashboardView from './components/dashboard/DashboardView'


const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'projects', label: 'Projects' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'synthesis', label: 'Synthesis' },
  { id: 'physical-design', label: 'Physical Design' },
]


export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [backendStatus, setBackendStatus] = useState('checking')
  const [activeProject, setActiveProject] = useState(null)
  const [projectSessions, setProjectSessions] = useState({})

  const handleOpenProject = (project) => {
    setActiveProject(project)

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
      <Header />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          navItems={navItems}
          activeTab={activeTab}
          onNavigate={(tabId) => {
            setActiveTab(tabId)
            setActiveProject(null)
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
              <ProjectsView onOpenProject={handleOpenProject} />
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
