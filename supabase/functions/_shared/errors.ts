export const ERRORS = {
  BAD_REQUEST: {
    code: "BAD_REQUEST",
    message: "The request is malformed or missing required parameters.",
    status: 400,
  },
  MISSING_AUTH: {
    code: "MISSING_AUTHORIZATION",
    message: "Authorization header is required. Use: Authorization: Bearer <your-api-key>",
    status: 401,
  },
  INVALID_FORMAT: {
    code: "INVALID_TOKEN_FORMAT",
    message: "Authorization header must be in the format: Bearer <token>",
    status: 401,
  },
  INVALID_KEY: {
    code: "INVALID_API_KEY",
    message: "The supplied API key is invalid or has been revoked.",
    status: 401,
  },
  FORBIDDEN: {
    code: "FORBIDDEN",
    message: "This API key does not have permission to access this resource.",
    status: 403,
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    message: "The requested resource was not found.",
    status: 404,
  },
  METHOD_NOT_ALLOWED: {
    code: "METHOD_NOT_ALLOWED",
    message: "Only GET requests are supported by this API.",
    status: 405,
  },
  CONFLICT: {
    code: "CONFLICT",
    message: "The request could not be completed due to a conflict with the current state of the resource.",
    status: 409,
  },
  UNPROCESSABLE_ENTITY: {
    code: "UNPROCESSABLE_ENTITY",
    message: "The request was well-formed but contains semantic errors.",
    status: 422,
  },
  RATE_LIMITED: {
    code: "RATE_LIMIT_EXCEEDED",
    message: "You have exceeded your hourly request limit. Please slow down.",
    status: 429,
  },
  SERVER_ERROR: {
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred. Please try again later.",
    status: 500,
  },
} as const;
