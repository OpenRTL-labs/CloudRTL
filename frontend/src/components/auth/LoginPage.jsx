import { useState } from 'react'
import { login } from '../../services/projectApi'

export default function LoginPage({ onLogin }) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()

        setError('')

        if (!username.trim() || !password) {
            setError('Username and password are required.')
            return
        }

        setIsSubmitting(true)

        try {
            await login(username.trim(), password)
            onLogin()
        } catch (err) {
            setError(err.message || 'Unable to login.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
            <div className="w-full max-w-md">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 shadow-sm">
                    <div className="mb-8">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500 text-slate-950">
                                <span className="text-lg font-bold">
                                    ▣
                                </span>
                            </div>

                            <div>
                                <h1 className="text-xl font-bold text-white">
                                    CloudRTL
                                </h1>

                                <p className="text-xs text-cyan-400">
                                    EDA Platform
                                </p>
                            </div>
                        </div>

                        <h2 className="mt-8 text-2xl font-bold text-white">
                            Sign in
                        </h2>

                        <p className="mt-2 text-sm text-slate-400">
                            Sign in to access your RTL and EDA projects.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">
                                Username
                            </label>

                            <input
                                type="text"
                                value={username}
                                onChange={(event) =>
                                    setUsername(event.target.value)
                                }
                                disabled={isSubmitting}
                                autoComplete="username"
                                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300">
                                Password
                            </label>

                            <input
                                type="password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                disabled={isSubmitting}
                                autoComplete="current-password"
                                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSubmitting ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}