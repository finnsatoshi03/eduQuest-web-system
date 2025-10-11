import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Loader2, Menu, Plus, X } from "lucide-react";
import { ModeToggle } from "./theme-toggle";
import { useAuth } from "@/contexts/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { createQuiz } from "@/services/api/apiQuiz";
import toast from "react-hot-toast";

const PUBLIC_NAV_ITEMS = [
  { path: "/", label: "Home" },
  { path: "/about", label: "About" },
  { path: "/faq", label: "FAQ" },
  { path: "/contact", label: "Contact" },
];

const getAuthNavItems = (role: "professor" | "student" | null) => [
  {
    path: role === "professor" ? "/professor/dashboard" : "/student/dashboard",
    label: "Home",
  },
];

const AUTH_NAV_ITEMS2 = (role: "professor" | "student" | null) => [
  {
    path: role === "professor" ? "/professor/profile" : "/student/profile",
    label: "Profile",
  },
];

const AUTH_ITEMS: {
  path: string;
  label: string;
  variant:
    | "secondary"
    | "link"
    | "default"
    | "destructive"
    | "outline"
    | "ghost";
}[] = [
  { path: "/login", label: "Log in", variant: "secondary" },
  { path: "/signup", label: "Sign up", variant: "default" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const navItems = user ? getAuthNavItems(user.role) : PUBLIC_NAV_ITEMS;

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const index = navItems.findIndex((item) => item.path === location.pathname);
    setActiveIndex(index);
  }, [location, navItems]);

  const { mutate: createNewQuiz, isPending: isCreatingQuiz } = useMutation({
    mutationFn: () => {
      if (user) {
        return createQuiz(user.id);
      }
      throw new Error("User is not authenticated");
    },
    onSuccess: (data) => {
      if (data) {
        navigate(`/professor/quiz/${data.quiz_id}/generate-quiz`);
      }
    },
    onError: (error) => {
      toast.error(`Failed to create quiz: ${error.message}`);
    },
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success("Logged out successfully!");
      navigate("/login");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to log out: ${errorMessage}`);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  const NavItem = ({
    to,
    label,
    index,
  }: {
    to: string;
    label: string;
    index?: number;
  }) => (
    <NavLink
      to={to}
      onClick={closeMenu} // Close menu when clicked
      className={({ isActive }) =>
        `relative font-bold md:px-4 md:py-2 ${isActive ? "md:text-indigo-600" : "md:text-gray-600"}`
      }
    >
      {label}
      {index === activeIndex && <PixelatedArrow />}
    </NavLink>
  );

  const isProfessor = user?.role === "professor";

  return (
    <>
      <nav className="relative z-50 flex w-full items-center justify-between bg-zinc-50 px-2 py-4 dark:bg-zinc-900 md:px-0">
        {/* Logo Section */}
        <div className="flex items-center">
          <NavLink
            to="/"
            onClick={closeMenu}
            className="flex items-center gap-2"
          >
            <img
              src="/quiz-royale-logo.png"
              alt="Quiz Royale Logo"
              className="w-12 md:w-14"
            />
          </NavLink>
        </div>

        {/* Center Navigation - Desktop */}
        <ul className="absolute left-1/2 hidden flex-1 -translate-x-1/2 items-center justify-center gap-6 md:flex">
          {navItems.map(({ path, label }, index) => (
            <NavItem key={path} to={path} label={label} index={index} />
          ))}
        </ul>

        {/* Right Section - Actions */}
        <ul className="flex items-center gap-2 md:gap-3">
          <ModeToggle />
          <li className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                {isProfessor && (
                  <Button
                    onClick={() => createNewQuiz()}
                    className="gap-1 px-4"
                    disabled={isCreatingQuiz}
                  >
                    {isCreatingQuiz ? (
                      "Creating..."
                    ) : (
                      <>
                        <Plus size={16} /> Create
                      </>
                    )}
                  </Button>
                )}
                <DropdownMenu
                  open={isDropdownOpen}
                  onOpenChange={setIsDropdownOpen}
                  modal={false}
                >
                  <DropdownMenuTrigger asChild>
                    <div
                      className={`flex size-9 cursor-pointer items-center justify-center rounded-full bg-indigo-100 p-1 transition-transform duration-300 ease-in-out hover:bg-indigo-200 dark:bg-indigo-700 dark:hover:bg-indigo-600 ${
                        isDropdownOpen ? "rotate-180" : "rotate-0"
                      }`}
                    >
                      {isDropdownOpen ? <X size={20} /> : <Menu size={20} />}
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={10}>
                    <DropdownMenuLabel className="flex flex-col">
                      <p className="flex gap-1 font-default">{user.name}</p>
                      <p className="font-default text-xs font-normal">
                        {user.email}
                      </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <NavLink
                      to={
                        user.role === "professor"
                          ? "/professor/profile"
                          : "/student/profile"
                      }
                    >
                      <DropdownMenuItem>Profile</DropdownMenuItem>
                    </NavLink>
                    <DropdownMenuItem onClick={handleLogout}>
                      {isLoggingOut ? "Logging out.." : "Log out"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              AUTH_ITEMS.map(({ path, label, variant }) => (
                <NavLink key={path} to={path} onClick={closeMenu}>
                  <Button variant={variant} className="px-5">
                    {label}
                  </Button>
                </NavLink>
              ))
            )}
          </li>
          {/* Mobile Menu Toggle */}
          <div
            className={`flex cursor-pointer items-center justify-center rounded-full bg-zinc-200 p-2 transition-transform duration-300 ease-in-out hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 md:hidden ${
              isMenuOpen ? "rotate-180" : "rotate-0"
            }`}
            onClick={toggleMenu}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </div>
        </ul>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`absolute left-0 top-[5rem] z-40 w-full bg-zinc-50 text-zinc-900 transition-transform duration-500 ease-in-out dark:bg-zinc-900 dark:text-zinc-50 ${
          isMenuOpen ? "h-[100vh] translate-y-0" : "-translate-y-full"
        }`}
      >
        <div
          className={`mx-8 mt-2 border-t-2 pt-8 md:mx-12 lg:mx-16 ${
            !user ? "space-y-8" : "space-y-4"
          }`}
        >
          <ul className="flex flex-col gap-4">
            {navItems.map(({ path, label }) => (
              <NavItem key={path} to={path} label={label} />
            ))}
          </ul>
          <ul
            className={`flex flex-col gap-4 ${!user && "w-full items-center"}`}
          >
            {user ? (
              <>
                {AUTH_NAV_ITEMS2(user?.role).map(({ path, label }) => (
                  <NavLink key={path} to={path} onClick={closeMenu}>
                    {label}
                  </NavLink>
                ))}
                <button
                  className="flex w-fit items-center gap-1"
                  onClick={() => {
                    closeMenu();
                    handleLogout();
                  }}
                >
                  {isLoggingOut ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging out..
                    </>
                  ) : (
                    "Log out"
                  )}
                </button>
              </>
            ) : (
              AUTH_ITEMS.map(({ path, label, variant }) => (
                <NavLink key={path} to={path} onClick={closeMenu}>
                  <Button variant={variant} className="h-fit w-64 py-3">
                    {label}
                  </Button>
                </NavLink>
              ))
            )}
          </ul>
        </div>
      </div>
    </>
  );
}

function PixelatedArrow() {
  return (
    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 rotate-180 transform">
      <div className="pixelated-arrow"></div>
    </div>
  );
}
