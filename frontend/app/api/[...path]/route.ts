import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ACCESS_COOKIE = "learnmate_access_token";
const REFRESH_COOKIE = "learnmate_refresh_token";
const ACCESS_MAX_AGE_SECONDS = 30 * 60;
const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
};

function backendBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    "http://localhost:8080"
  ).replace(/\/+$/, "");
}

function backendAudience() {
  return process.env.BACKEND_ID_TOKEN_AUDIENCE || backendBaseUrl();
}

function isCookieSecure() {
  return process.env.NODE_ENV === "production";
}

function setAuthCookies(response: NextResponse, tokens: TokenPayload) {
  if (tokens.access_token) {
    response.cookies.set(ACCESS_COOKIE, tokens.access_token, {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_MAX_AGE_SECONDS,
    });
  }

  if (tokens.refresh_token) {
    response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_MAX_AGE_SECONDS,
    });
  }
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function stripTokens(payload: unknown) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("data" in payload) ||
    !payload.data ||
    typeof payload.data !== "object"
  ) {
    return payload;
  }

  const safeData = { ...(payload.data as Record<string, unknown>) };

  delete safeData.access_token;
  delete safeData.refresh_token;
  delete safeData.token_type;

  return {
    ...payload,
    data: safeData,
  };
}

async function getCloudRunIdentityToken() {
  if (process.env.BACKEND_ID_TOKEN_DISABLED === "true") {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  const metadataUrl =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity" +
    `?audience=${encodeURIComponent(backendAudience())}`;

  try {
    const response = await fetch(metadataUrl, {
      headers: {
        "Metadata-Flavor": "Google",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function backendUrl(path: string[], request: NextRequest) {
  const encodedPath = path.map(encodeURIComponent).join("/");
  const url = new URL(`${backendBaseUrl()}/api/${encodedPath}`);
  url.search = new URL(request.url).search;
  return url;
}

async function readRequestBody(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  return request.arrayBuffer();
}

async function callBackend(
  request: NextRequest,
  path: string[],
  options: {
    accessToken?: string;
    body?: BodyInit | null;
    jsonBody?: unknown;
    method?: string;
  } = {}
) {
  const headers = new Headers();
  const method = options.method || request.method;
  const idToken = await getCloudRunIdentityToken();
  let body = options.body;

  headers.set("accept", request.headers.get("accept") || "application/json");

  if (options.jsonBody !== undefined) {
    body = JSON.stringify(options.jsonBody);
    headers.set("content-type", "application/json");
  } else {
    const contentType = request.headers.get("content-type");

    if (contentType && body !== undefined) {
      headers.set("content-type", contentType);
    }
  }

  if (options.accessToken) {
    headers.set("authorization", `Bearer ${options.accessToken}`);
  }

  if (idToken) {
    headers.set("x-serverless-authorization", `Bearer ${idToken}`);
  }

  return fetch(backendUrl(path, request), {
    method,
    headers,
    body,
    cache: "no-store",
  });
}

async function clientResponse(
  backendResponse: Response,
  options: {
    storeTokens?: boolean;
    clearTokens?: boolean;
    extraTokens?: TokenPayload;
    stripTokenPayload?: boolean;
  } = {}
) {
  const contentType = backendResponse.headers.get("content-type") || "";
  let response: NextResponse;
  let tokens: TokenPayload = options.extraTokens || {};

  if (contentType.includes("application/json")) {
    const payload = await backendResponse.json();

    if (options.storeTokens && payload?.data) {
      tokens = {
        access_token: payload.data.access_token,
        refresh_token: payload.data.refresh_token,
      };
    }

    response = NextResponse.json(
      options.stripTokenPayload ? stripTokens(payload) : payload,
      { status: backendResponse.status }
    );
  } else {
    response = new NextResponse(await backendResponse.arrayBuffer(), {
      status: backendResponse.status,
      headers: {
        "content-type": contentType,
      },
    });
  }

  if (options.clearTokens) {
    clearAuthCookies(response);
  }

  setAuthCookies(response, tokens);
  return response;
}

async function refreshSession(request: NextRequest, refreshToken: string) {
  const backendResponse = await callBackend(request, ["auth", "refresh"], {
    method: "POST",
    jsonBody: {
      refresh_token: refreshToken,
    },
  });

  if (!backendResponse.ok) {
    return null;
  }

  const payload = await backendResponse.json();

  if (!payload?.data?.access_token || !payload?.data?.refresh_token) {
    return null;
  }

  return {
    access_token: payload.data.access_token as string,
    refresh_token: payload.data.refresh_token as string,
  };
}

async function handler(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = params.path || [];
  const pathKey = path.join("/");
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const body = await readRequestBody(request);

  if (pathKey === "auth/login" || pathKey === "auth/register") {
    const backendResponse = await callBackend(request, path, { body });
    return clientResponse(backendResponse, {
      storeTokens: true,
      stripTokenPayload: true,
    });
  }

  if (pathKey === "auth/refresh") {
    if (!refreshToken) {
      return NextResponse.json(
        { success: false, message: "Not authenticated", data: null },
        { status: 401 }
      );
    }

    const backendResponse = await callBackend(request, path, {
      method: "POST",
      jsonBody: {
        refresh_token: refreshToken,
      },
    });

    return clientResponse(backendResponse, {
      storeTokens: true,
      stripTokenPayload: true,
    });
  }

  if (pathKey === "auth/logout") {
    const backendResponse = await callBackend(request, path, {
      method: "POST",
      jsonBody: {
        refresh_token: refreshToken || null,
      },
    });

    return clientResponse(backendResponse, {
      clearTokens: true,
      stripTokenPayload: true,
    });
  }

  let currentAccessToken = accessToken;
  let refreshedTokens: TokenPayload | undefined;
  let shouldClearTokens = false;

  if (!currentAccessToken && refreshToken) {
    refreshedTokens = await refreshSession(request, refreshToken) || undefined;
    currentAccessToken = refreshedTokens?.access_token;
  }

  if (!currentAccessToken) {
    const response = NextResponse.json(
      { success: false, message: "Not authenticated", data: null },
      { status: 401 }
    );

    if (refreshToken) {
      clearAuthCookies(response);
    }

    return response;
  }

  let backendResponse = await callBackend(request, path, {
    accessToken: currentAccessToken,
    body,
  });

  if (backendResponse.status === 401 && refreshToken) {
    refreshedTokens = await refreshSession(request, refreshToken) || undefined;

    if (refreshedTokens?.access_token) {
      backendResponse = await callBackend(request, path, {
        accessToken: refreshedTokens.access_token,
        body,
      });
    } else {
      shouldClearTokens = true;
    }
  }

  return clientResponse(backendResponse, {
    extraTokens: refreshedTokens,
    clearTokens: shouldClearTokens,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handler(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handler(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handler(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handler(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handler(request, context);
}
