import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role?: "USER" | "OWNER" | "ADMIN" | "GYM_ADMIN" | "SUPER_ADMIN";
      emailVerified?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "USER" | "OWNER" | "ADMIN" | "GYM_ADMIN" | "SUPER_ADMIN";
    emailVerified?: boolean;
  }
}
