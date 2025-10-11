import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthProvider";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import ReCAPTCHA from "react-google-recaptcha";
import toast from "react-hot-toast";
import { Sparkles, LogIn, Mail, Lock, Loader2, Trophy } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 70, damping: 12 },
  },
};

const Login: React.FC = () => {
  const { login, googleLogin } = useAuth();
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onRecaptchaChange = (token: string | null) => {
    setRecaptchaToken(token);
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!recaptchaToken) {
      toast.error("🤖 Please complete the reCAPTCHA verification!");
      return;
    }

    setIsLoggingIn(true);
    try {
      await login(data.email, data.password);
      toast.success("🎉 Welcome back! Let's crush some quizzes!");

      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(`❌ ${err.message}`);
      } else {
        toast.error("❌ Something went wrong. Please try again!");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!recaptchaToken) {
      toast.error("🤖 Please complete the reCAPTCHA verification!");
      return;
    }

    try {
      await googleLogin();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(`❌ ${err.message}`);
      }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="relative mt-8 grid items-center gap-8 md:grid-cols-[auto_1fr] md:gap-12"
    >
      {/* Left Section - Form */}
      <motion.div variants={itemVariants} className="order-2 md:order-1">
        <div className="mx-auto max-w-md space-y-6 rounded-3xl border-2 border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 md:p-10">
          {/* Mobile Logo */}

          <div className="space-y-2">
            <h1 className="text-3xl font-bold md:text-4xl">Welcome Back! 🎮</h1>
            <p className="text-sm opacity-80">
              Ready for another challenge? Let's go!
            </p>
            <div className="flex items-center gap-1 text-sm">
              <span className="opacity-60">New to Quiz Royale?</span>
              <NavLink to="/signup">
                <Button
                  variant="link"
                  className="h-fit p-0 font-semibold text-indigo-600 dark:text-indigo-400"
                >
                  Create an account!
                </Button>
              </NavLink>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400" />
                        <Input
                          placeholder="your.email@example.com"
                          {...field}
                          className="h-12 rounded-xl border-2 border-zinc-200 bg-zinc-50 pl-11 transition-all focus:border-indigo-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-indigo-500"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          className="h-12 rounded-xl border-2 border-zinc-200 bg-zinc-50 pl-11 transition-all focus:border-indigo-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-indigo-500"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-center pt-2">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY}
                  onChange={onRecaptchaChange}
                />
              </div>

              <Button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-base font-semibold shadow-[0px_4px_0px_#4338ca] transition-all duration-300 hover:translate-y-1 hover:bg-indigo-700 hover:shadow-none disabled:translate-y-0 disabled:opacity-50"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Logging you in...
                  </>
                ) : (
                  <>
                    <LogIn className="size-5" />
                    Login to Play
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200 dark:border-zinc-700"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleGoogleSignIn}
                variant="outline"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 text-base font-semibold transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800"
                disabled={isLoggingIn}
              >
                <img
                  width="20"
                  height="20"
                  src="https://cdn-icons-png.flaticon.com/512/300/300221.png"
                  alt="Google logo"
                />
                Sign in with Google
              </Button>
            </form>
          </Form>

          {/* <p className="text-center text-xs opacity-60">
            By logging in, you agree to our{" "}
            <NavLink
              to="/terms"
              className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Terms
            </NavLink>{" "}
            and{" "}
            <NavLink
              to="/privacy"
              className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Privacy Policy
            </NavLink>
          </p> */}
        </div>
      </motion.div>

      {/* Right Section - Branding */}
      <motion.div
        variants={itemVariants}
        className="order-1 hidden space-y-8 md:order-2 md:block md:pl-8"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
            <Sparkles className="size-5" />
            <span>Play. Learn. Compete.</span>
            <Sparkles className="size-5" />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-4xl font-bold leading-tight md:text-5xl">
            Ready to <span className="text-amber-500">Level Up</span>
            <br />
            Your Learning? 🏆
          </h2>
          <p className="text-base leading-relaxed opacity-80">
            Pick up where you left off. Continue your quest, compete with
            friends, and show everyone who's the ultimate quiz champion!
          </p>
        </div>

        <div className="space-y-4 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 p-6 dark:from-indigo-900/30 dark:to-violet-900/30">
          <div className="flex items-center gap-2">
            <Trophy className="size-6 text-amber-500" />
            <h3 className="text-lg font-bold">What's Waiting for You</h3>
          </div>
          <div className="space-y-3">
            {[
              { emoji: "📊", text: "Track your progress and stats" },
              { emoji: "🎯", text: "Complete daily challenges" },
              { emoji: "⚔️", text: "Battle friends in quiz duels" },
              { emoji: "🌟", text: "Unlock achievements and badges" },
            ].map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="flex items-center gap-3"
              >
                <span className="text-2xl">{feature.emoji}</span>
                <span className="text-sm font-medium">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-center text-sm font-semibold italic">
            "Quiz Royale turned studying into my favorite game. I've never
            learned so much while having this much fun!" 🎮
          </p>
          <p className="mt-2 text-center text-xs opacity-70">— Alex, Student</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Login;
