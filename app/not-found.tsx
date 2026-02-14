import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-10 sm:px-6">
      <section className="panel w-full p-8 text-center">
        <p className="section-kicker">Not found</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Profile not found</h1>
        <p className="mt-3 text-sm text-[#afa698]">The page may be private or the handle may not exist.</p>
        <Link className="btn btn-secondary mt-6" href="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
