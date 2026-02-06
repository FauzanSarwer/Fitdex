import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const passwordPepper = process.env.PASSWORD_PEPPER ?? "";

export async function POST(req: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }
    const body = await req.json();
    const { email, password, name, role } = body as {
      email: string;
      password: string;
      name?: string;
      role?: string;
    };
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }
    const validRole = ["USER", "OWNER"].includes(role ?? "USER") ? (role ?? "USER") : "USER";
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }
    const hashed = await bcrypt.hash(`${password}${passwordPepper}`, 12);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashed,
        name: name?.trim() || null,
        role: validRole,
      },
    });
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (e) {
    console.error(e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 409 }
        );
      }
    }
    if (e instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        { error: "Database unavailable. Check DATABASE_URL or run migrations." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
