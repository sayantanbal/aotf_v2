"use client";

import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Home,
  GraduationCap,
  BriefcaseBusiness,
  LayoutDashboard,
  MailQuestionMark,
} from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isSignedIn } = useUser();
  const username = user?.username?.trim();
  const dashboardPath = username ? `/u/${username}/dashboard` : "/";

  // ❌ Hide navbar on /admin
  if (pathname.startsWith("/admin")) return null;

  const items = [
    { icon: Home, label: "Home", path: "/" },
    { icon: GraduationCap, label: "Tuitions", path: "/posts" },
    { icon: BriefcaseBusiness, label: "Jobs", path: "/jobs" },
    isSignedIn
      ? { icon: LayoutDashboard, label: "Dashboard", path: dashboardPath }
      : { icon: MailQuestionMark, label: "Enquiry", path: "/enquiry" },
  ];

  const activeIndex = Math.max(
    0,
    items.findIndex((item) =>
      item.path === "/" ? pathname === "/" : pathname.startsWith(item.path),
    ),
  );

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[70%] max-w-sm z-50">
      <div className="bg-white/80 backdrop-blur-lg border border-gray-200 shadow-xl rounded-2xl overflow-hidden">
        <ul className="flex relative">
          <span
            className="absolute top-0 h-full w-[25%] transition-all duration-300"
            style={{
              left: `${(100 / items.length) * activeIndex}%`,
            }}
          >
            <span className="absolute top-0 w-full border-b-[6px] border-pink-500 rounded-b-2xl" />
            <span className="absolute bottom-0 w-full border-t-[6px] border-pink-500 rounded-t-2xl" />
          </span>

          {items.map((item, index) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/"
                ? pathname === "/"
                : pathname.startsWith(item.path);

            return (
              <li key={index} className="flex-1 relative z-10">
                <button
                  type="button"
                  onClick={() => router.push(item.path)}
                  className={`flex w-full flex-col items-center justify-center py-2 transition-all ${
                    isActive ? "text-pink-500 scale-95" : "text-gray-400"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={22} />
                  <span className="text-xs mt-1">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
