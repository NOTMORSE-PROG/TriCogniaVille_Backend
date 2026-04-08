import { SignJWT, jwtVerify, JWTPayload } from "jose";

const JWT_SECRET_KEY = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
};

export interface TokenPayload extends JWTPayload {
  sub: string;
  role: "student" | "teacher";
  email: string;
}

export async function signToken(payload: {
  sub: string;
  role: "student" | "teacher";
  email: string;
}): Promise<string> {
  // Students get a 30-day token: there is no refresh-token endpoint, and the
  // client has no offline fallback after the SQLite removal, so a mid-session
  // expiry would be a hard re-login. 30d gives us a comfortable session window.
  const expiresIn = payload.role === "student" ? "30d" : "24h";

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer("tricognia-ville")
    .sign(JWT_SECRET_KEY());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY(), {
      issuer: "tricognia-ville",
    });
    return payload as TokenPayload;
  } catch {
    throw new Error("Invalid or expired token");
  }
}
