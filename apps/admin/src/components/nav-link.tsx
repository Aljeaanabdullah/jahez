"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Link that marks itself as the current page. `exact` for "/" so it isn't active everywhere. */
export function NavLink({
  href,
  exact = false,
  className,
  activeClassName,
  children,
}: {
  href: string;
  exact?: boolean;
  className: string;
  activeClassName: string;
  children: ReactNode;
}) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={active ? activeClassName : className}>
      {children}
    </Link>
  );
}
