import { json } from "@remix-run/server-runtime";

/**
 * https://kevincox.ca/2024/08/24/cors/
 *
 * The function is specifically needed to handle “simple” CORS requests,
 * which are more prone to bypassing the stricter CORS preflight checks.
 * By clearing cookies from these cross-origin requests,
 * it reduces the risk of CSRF attacks and other vulnerabilities associated with simple CORS requests.
 *
 * Warning: There is no combination of Access-Control-Allow-* headers that you can set that solves simple requests,
 * they are made before any policy is checked. You need to handle them in another way.
 * Do not try to fix this by setting a CORS policy
 **/
export const preventCrossOriginCookie = (
  request: Request,
  throwError: boolean = true
) => {
  if (request.headers.get("sec-fetch-site") === "same-origin") {
    // Same origin, OK
    return;
  }

  const isCallback =
    request.url.includes("/auth/github/callback") ||
    request.url.includes("/auth/google/callback");

  if (isCallback) {
    // OAuth callbacks can come from complex cross-origin redirects
    // which may not perfectly match `sec-fetch-mode` in all browsers/environments.
    // OAuth provides its own built-in CSRF protection via the `state` parameter anyway.
    return;
  }

  if (
    request.headers.get("sec-fetch-mode") === "navigate" &&
    request.method === "GET"
  ) {
    //  GET requests shouldn't mutate state so this is safe.
    return;
  }

  request.headers.delete("cookie");

  if (
    request.headers.has("Authorization") ||
    request.headers.has("x-auth-token")
  ) {
    // Do not throw an error if the request has an Authorization or x-auth-token header.
    // In that case, it is not a simple CORS request and will be prevented by a preflight check.
    return;
  }

  if (throwError) {
    console.error(`Cross-origin request to ${request.url} blocked`, [
      ...request.headers.entries(),
    ]);

    // allow service calls
    throw json(
      {
        message: `Cross-origin request to ${request.url}`,
      },
      {
        status: 403,
        statusText: "Forbidden",
      }
    );
  }
};
