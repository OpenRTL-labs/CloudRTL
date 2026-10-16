# Local backend setup (Windows)

The backend requires `CLOUDRTL_JWT_SECRET`. Set it once in PowerShell; this
creates a random secret only when no user-level value is already configured.
The value is stored in your Windows user environment and is not printed:

```powershell
if (-not [Environment]::GetEnvironmentVariable("CLOUDRTL_JWT_SECRET", "User")) {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
        [Environment]::SetEnvironmentVariable(
            "CLOUDRTL_JWT_SECRET",
            [Convert]::ToBase64String($bytes),
            "User"
        )
    }
    finally {
        $rng.Dispose()
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
}
```

Open a new PowerShell window so it inherits the user environment, then start
the backend from the `backend` directory:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The current Docker Compose setup runs PostgreSQL and OpenROAD, not the backend.
The backend runs on the host, so the JWT secret is not passed to those unrelated
containers. Do not generate a new secret for each backend start; keeping the
same value preserves existing token validity until expiration.