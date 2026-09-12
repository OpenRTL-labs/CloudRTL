import { useEffect, useState } from 'react'

export default function ProjectsView({ onOpenProject }) {
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
                            onClick={() => onOpenProject(project)}
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