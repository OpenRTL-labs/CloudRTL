import { useState } from 'react'
import { login, register } from '../../services/projectApi'

export default function LoginPage({ onLogin }) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isRegistering, setIsRegistering] = useState(false)

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

    const handleRegister = async (event) => {
        event.preventDefault()

        setError('')
        setSuccess('')

        const normalizedUsername = username.trim()
        const normalizedEmail = email.trim()

        if (!normalizedUsername || !password) {
            setError('Username and password are required.')
            return
        }
        if (normalizedUsername.length < 3 || normalizedUsername.length > 100) {
            setError('Username must be between 3 and 100 characters long.')
            return
        }
        if (password.length < 6 || password.length > 255) {
            setError('Password must be between 6 and 255 characters long.')
            return
        }
        if (
            normalizedEmail &&
            (normalizedEmail.length > 255 ||
                !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail))
        ) {
            setError('Enter a valid email address of no more than 255 characters.')
            return
        }

        setIsSubmitting(true)

        try {
            await register(normalizedUsername, password, normalizedEmail)
            setPassword('')
            setIsRegistering(false)
            setSuccess('Account created. You can now sign in.')
        } catch (err) {
            setError(err.message || 'Unable to create account.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const changeForm = (registering) => {
        setIsRegistering(registering)
        setError('')
        setSuccess('')
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
                            {isRegistering ? 'Create account' : 'Sign in'}
                        </h2>

                        <p className="mt-2 text-sm text-slate-400">
                            {isRegistering
                                ? 'Create an account to access your RTL and EDA projects.'
                                : 'Sign in to access your RTL and EDA projects.'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
                            {success}
                        </div>
                    )}

                    <form
                        onSubmit={isRegistering ? handleRegister : handleSubmit}
                        className="space-y-5"
                    >
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

                        {isRegistering && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300">
                                    Email <span className="text-slate-500">(optional)</span>
                                </label>

                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    disabled={isSubmitting}
                                    autoComplete="email"
                                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500"
                                />
                            </div>
                        )}

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
                                autoComplete={
                                    isRegistering ? 'new-password' : 'current-password'
                                }
                                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSubmitting
                                ? isRegistering
                                    ? 'Creating account...'
                                    : 'Signing in...'
                                : isRegistering
                                    ? 'Create account'
                                    : 'Sign In'}
                        </button>
                    </form>

                    <p className="mt-5 text-center text-sm text-slate-400">
                        {isRegistering ? 'Already have an account?' : 'New to CloudRTL?'}{' '}
                        <button
                            type="button"
                            onClick={() => changeForm(!isRegistering)}
                            disabled={isSubmitting}
                            className="font-medium text-cyan-400 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isRegistering ? 'Sign in' : 'Create account'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    )
}