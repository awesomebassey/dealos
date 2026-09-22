const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function cookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

function errorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(". ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

export async function clientApi<T>(
  path: string,
  init: RequestInit = {},
  options?: { csrf?: boolean },
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (options?.csrf !== false && init.method && !["GET", "HEAD", "OPTIONS"].includes(init.method.toUpperCase())) {
    const csrf = cookie("dealos_csrf");
    if (csrf) headers.set("x-csrf-token", decodeURIComponent(csrf));
  }

  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(errorMessage(payload, `Request failed with status ${response.status}`));
  }

  return payload as T;
}
