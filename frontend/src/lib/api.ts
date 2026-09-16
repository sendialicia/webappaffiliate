const API_URL = process.env.NEXT_PUBLIC_API_URL

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set")
  }

  const res = await fetch(`${API_URL}${path}`, init)

  if (!res.ok) {
    throw new ApiError(res.status, `Request to ${path} failed with status ${res.status}`)
  }

  return res.json() as Promise<T>
}
