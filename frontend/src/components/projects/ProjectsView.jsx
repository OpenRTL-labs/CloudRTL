import { useEffect, useState } from 'react'
import { createProject } from '../../services/projectApi'

export default function ProjectsView({ onOpenProject }) {
    const [projects, setProjects] = useState([])
    const [projectsStatus, setProjectsStatus] = useState('loading')

    const [isCreating, setIsCreating] = useState(false)
    const [projectName, setProjectName] = useState('')
    const [topModule, setTopModule] = useState('')
    const [technology, setTechnology] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formError, setFormError] = useState('')
    const [formSuccess, setFormSuccess] = useState('')

    const loadProjects = () => {
        return fetch('/projects')
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
    }

    useEffect(() => {
        loadProjects()
    }, [])

    const handleCreateProject = async (e) => {
        e.preventDefault()
        setFormError('')
        setFormSuccess('')

        const trimmedName = projectName.trim()
        const trimmedTop = topModule.trim()
        const trimmedTech = technology.trim()

        if (!trimmedName) {
            setFormError('Project name cannot be empty.')
            return
        }
        if (!trimmedTop) {
            setFormError('Top module cannot be empty.')
            return
        }
        if (!trimmedTech) {
            setFormError('Technology cannot be empty.')
            return
        }
        if (trimmedName.includes('/') || trimmedName.includes('\\')) {
            setFormError("Project name cannot contain path separators ('/' or '\\').")
            return
        }

        setIsSubmitting(true)
        try {
            await createProject({
                name: trimmedName,
                top_module: trimmedTop,
                technology: trimmedTech,
            })
            setFormSuccess(`Project "${trimmedName}" created successfully.`)
            setProjectName('')
            setTopModule('')
            setTechnology('')
            setIsCreating(false)
            await loadProjects()
        } catch (err) {
            setFormError(err.message || 'Failed to create project.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        setIsCreating(false)
        setProjectName('')
        setTopModule('')
        setTechnology('')
        setFormError('')
    }

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

            {formSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
                    {formSuccess}
                </div>
            )}

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

                {!isCreating ? (
                    <button
                        type="button"
                        onClick={() => {
                            setIsCreating(true)
                            setFormError('')
                            setFormSuccess('')
                        }}
                        className="mt-5 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                    >
                        Create Project
                    </button>
                ) : (
                    <form onSubmit={handleCreateProject} className="mt-5 space-y-4">
                        {formError && (
                            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                                {formError}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-slate-300">
                                Project Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="e.g. alu"
                                disabled={isSubmitting}
                                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-medium text-slate-300">
                                    Top Module <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={topModule}
                                    onChange={(e) => setTopModule(e.target.value)}
                                    placeholder="e.g. alu"
                                    disabled={isSubmitting}
                                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300">
                                    Technology <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={technology}
                                    onChange={(e) => setTechnology(e.target.value)}
                                    placeholder="e.g. Nangate45"
                                    disabled={isSubmitting}
                                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting ? 'Creating...' : 'Create Project'}
                            </button>

                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={isSubmitting}
                                className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}