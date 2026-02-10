import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center" role="alert" aria-live="polite">
      <h1 className="text-3xl md:text-4xl font-semibold">Page not found</h1>
      <p className="mt-3 text-muted-foreground max-w-md">
        The page you’re looking for doesn’t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        aria-label="Back to home page"
      >
        Back to home
      </Link>
    </div>
  );
}
