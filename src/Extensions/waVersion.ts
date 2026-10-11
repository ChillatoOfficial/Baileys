import type { WAVersion } from "../Types";

interface WAVersionResponse {
  version: [number, number, number];
  isLatest: boolean;
}

export async function getWAVersion(): Promise<WAVersionResponse> {
  const headers: Record<string, string> = {
    "sec-fetch-site": "none",
    "user-agent":
      "Mozilla/5.0 (X11; Linux x86_64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/131.0.0.0 Safari/537.36",
  };

  const response: Response = await fetch(
    "https://web.whatsapp.com/sw.js",
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch sw.js: ${response.status} ${response.statusText}`
    );
  }

  const data: string = await response.text();

  const regex: RegExp = /\\?"client_revision\\?":\s*(\d+)/;
  const match: RegExpMatchArray | null = data.match(regex);

  if (!match?.[1]) {
    throw new Error("Could not find client revision");
  }

  const clientRevision: number = Number(match[1]);

  return {
    version: [2, 3000, clientRevision] as WAVersion,
    isLatest: true,
  };
}