import React, { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import ReCAPTCHA from "react-google-recaptcha";
import { Sparkles, Rocket, Mail, Lock, Loader2 } from "lucide-react";

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
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
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

const Signup: React.FC = () => {
  const { signUp, googleSignUp } = useAuth();
  const navigate = useNavigate();
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);

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

  const verifyEmail = async (email: string) => {
    const url = `https://mailcheck.p.rapidapi.com/?domain=${email}`;
    const options = {
      method: "GET",
      headers: {
        "x-rapidapi-key": "24f12200c7msh7d0d5cd9a7fd31fp16b86djsn50244593c1af",
        "x-rapidapi-host": "mailcheck.p.rapidapi.com",
      },
    };

    try {
      const response = await fetch(url, options);
      const result = await response.json();
      return result.valid === true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!recaptchaToken) {
      toast.error("🤖 Please complete the reCAPTCHA verification!");
      return;
    }

    setIsSigningUp(true);

    try {
      const response = await verifyEmail(data.email);

      if (!response) {
        toast.error("⚠️ Oops! That email looks fake or disposable.");
        setIsSigningUp(false);
        return;
      }

      await signUp(data.email, data.password);
      toast.success(
        "🎉 Welcome aboard! Check your email to verify your account.",
      );
      navigate("/email-verification", { state: { email: data.email } });

      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(`❌ ${err.message}`);
      } else {
        toast.error("❌ Something went wrong. Please try again!");
      }
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!recaptchaToken) {
      toast.error("🤖 Please complete the reCAPTCHA verification!");
      return;
    }

    try {
      await googleSignUp();
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
      className="relative mt-8 grid gap-8 md:grid-cols-[1fr_auto] md:gap-12"
    >
      {/* Left Section - Branding */}
      <motion.div
        variants={itemVariants}
        className="hidden space-y-8 md:block md:pr-8"
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
            Your Next{" "}
            <span className="text-indigo-600 dark:text-indigo-400">
              Adventure
            </span>
            <br />
            Starts Here! 🚀
          </h2>
          <p className="text-base leading-relaxed opacity-80">
            Join thousands of learners and educators making education epic.
            Create quizzes, compete with friends, and level up your knowledge!
          </p>
        </div>

        <div className="grid gap-4">
          {[
            { emoji: "⚡", text: "AI-powered quiz generation" },
            { emoji: "🎮", text: "Gamified learning experience" },
            { emoji: "🏆", text: "Compete on leaderboards" },
            { emoji: "📚", text: "Track your progress" },
          ].map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="flex items-center gap-3 rounded-2xl bg-indigo-50 p-3 dark:bg-indigo-900/20"
            >
              <span className="text-2xl">{feature.emoji}</span>
              <span className="text-sm font-medium">{feature.text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Right Section - Form */}
      <motion.div variants={itemVariants}>
        <div className="mx-auto max-w-md space-y-6 rounded-3xl border-2 border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 md:p-10">
          {/* Mobile Logo */}

          <div className="space-y-2">
            <h1 className="text-3xl font-bold md:text-4xl">
              Let's Get Started! 🎯
            </h1>
            <p className="text-sm opacity-80">
              Create your account and join the quest
            </p>
            <div className="flex items-center gap-1 text-sm">
              <span className="opacity-60">Already have an account?</span>
              <NavLink to="/login">
                <Button
                  variant="link"
                  className="h-fit p-0 font-semibold text-indigo-600 dark:text-indigo-400"
                >
                  Login here!
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
                    <p className="text-xs opacity-60">
                      At least 8 characters with uppercase and number
                    </p>
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
                disabled={isSigningUp}
              >
                {isSigningUp ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Creating your account...
                  </>
                ) : (
                  <>
                    <Rocket className="size-5" />
                    Create Account
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
                disabled={isSigningUp}
              >
                <img
                  width="20"
                  height="20"
                  src="https://cdn-icons-png.flaticon.com/512/300/300221.png"
                  alt="Google logo"
                />
                Sign up with Google
              </Button>
            </form>
          </Form>

          {/* <p className="text-center text-xs opacity-60">
            By signing up, you agree to our{" "}
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
    </motion.div>
  );
};

export default Signup;
