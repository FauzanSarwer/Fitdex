import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-white/10 py-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <Image
              src="/fitdex-logo.png"
              alt="Fitdex"
              width={20}
              height={20}
              className="h-5 w-5"
              priority
            />
          </div>
          <span className="font-bold">Fitdex</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        {children}
      </main>
    </div>
  );
}
