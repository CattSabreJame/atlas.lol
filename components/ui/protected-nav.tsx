"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { BarChart3, ExternalLink, LayoutPanelLeft, Settings2, ShieldCheck, UserCircle2 } from "lucide-react";

import { ensureHandlePrefix } from "@/lib/handles";
import { toPublicProfileUrl } from "@/lib/utils";

interface ProtectedNavProps {
  handle?: string;
  isAdmin?: boolean;
}

const BASE_ROUTES = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/editor", label: "Editor", icon: LayoutPanelLeft },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navMotion(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {};
  }

  return {
    initial: { opacity: 0, x: -8 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.22, ease: "easeOut" as const },
  };
}

export function ProtectedNav({ handle, isAdmin = false }: ProtectedNavProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const routes = isAdmin
    ? [...BASE_ROUTES, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : BASE_ROUTES;

  return (
    <>
      <header className="safe-top-inset fixed inset-x-0 top-0 z-40 border-b border-white/6 bg-[#070b10]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight text-white">
            Atlas
          </Link>

          {handle ? (
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[#d2ddd8]"
              href={toPublicProfileUrl(handle)}
              target="_blank"
              rel="noreferrer"
            >
              {ensureHandlePrefix(handle)}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>

        <nav className="mt-3 flex items-center gap-2 overflow-x-auto safe-bottom-inset">
          {routes.map((route) => {
            const Icon = route.icon;
            const active = isActiveRoute(pathname, route.href);

            return (
              <Link
                key={route.href}
                href={route.href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${
                  active ? "bg-white/10 text-white" : "text-[#b8afa1] hover:bg-white/6 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {route.label}
              </Link>
            );
          })}
          <Link
            href="/settings"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${
              isActiveRoute(pathname, "/settings") ? "bg-white/10 text-white" : "text-[#b8afa1] hover:bg-white/6 hover:text-white"
            }`}
          >
            <UserCircle2 className="h-3.5 w-3.5" />
            Account
          </Link>
        </nav>
      </header>

      <motion.aside className="sticky top-6 hidden h-[calc(100vh-48px)] w-[272px] shrink-0 lg:flex" {...navMotion(reduceMotion)}>
        <div className="panel flex h-full w-full flex-col p-5">
          <div>
            <Link href="/dashboard" className="block">
              <p className="text-[1.1rem] font-semibold tracking-tight text-white">Atlas</p>
              <p className="mt-1 text-xs text-[#8e9a94]">Creator Console</p>
            </Link>
          </div>

          <nav className="mt-7 space-y-1.5">
            {routes.map((route) => {
              const Icon = route.icon;
              const active = isActiveRoute(pathname, route.href);

              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`group relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "border border-white/12 bg-white/[0.08] text-white"
                      : "border border-transparent text-[#97a29d] hover:border-white/10 hover:bg-white/[0.04] hover:text-[#dce4e0]"
                  }`}
                >
                  <span
                    className={`absolute bottom-2 left-1.5 top-2 w-[2px] rounded-full transition ${
                      active ? "bg-[var(--accent-strong)]" : "bg-transparent group-hover:bg-white/15"
                    }`}
                  />
                  <Icon className="h-4 w-4" />
                  {route.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-white/8 pt-4">
            <Link
              href="/settings"
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition ${
                isActiveRoute(pathname, "/settings")
                  ? "border border-white/12 bg-white/[0.08] text-white"
                  : "border border-transparent text-[#97a29d] hover:border-white/10 hover:bg-white/[0.04] hover:text-[#dce4e0]"
              }`}
            >
              <UserCircle2 className="h-4 w-4" />
              Account
            </Link>
          </div>

          {handle ? (
            <div className="mt-auto rounded-2xl border border-white/8 bg-black/22 p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8e9a94]">Public profile</p>
              <Link
                href={toPublicProfileUrl(handle)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-[var(--accent-strong)] transition hover:text-white"
              >
                {ensureHandlePrefix(handle)}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}
        </div>
      </motion.aside>
    </>
  );
}
