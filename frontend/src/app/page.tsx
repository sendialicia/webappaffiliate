import { apiFetch } from "@/lib/api"

interface HealthResponse {
  status: string
}

export default async function Home() {
  let health: HealthResponse | null = null
  let error: string | null = null

  try {
    health = await apiFetch<HealthResponse>("/health")
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error"
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16">
      <h1 className="text-2xl font-semibold">Backend connectivity check</h1>
      {health ? (
        <pre className="rounded bg-zinc-100 px-4 py-2 text-sm dark:bg-zinc-900">
          {JSON.stringify(health, null, 2)}
        </pre>
      ) : (
        <p className="text-red-600 dark:text-red-400">Failed to reach backend: {error}</p>
      )}
    </div>
  )
}
