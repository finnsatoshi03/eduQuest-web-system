import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import {
  Mail,
  CheckCircle2,
  Clock,
  HelpCircle,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  Rocket,
} from "lucide-react";
import toast from "react-hot-toast";
import supabase from "@/services/supabase";

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

const envelopeVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 10,
    },
  },
  hover: {
    scale: 1.05,
    rotate: [0, -5, 5, -5, 0],
    transition: { duration: 0.5 },
  },
};

const EmailVerification: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || "your email address";

  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResendEmail = async () => {
    if (cooldown > 0) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
      });

      if (error) throw error;

      toast.success("📧 Verification email resent! Check your inbox.");
      setCooldown(30);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(`❌ ${error.message}`);
      } else {
        toast.error("❌ Failed to resend email. Please try again.");
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && user.email_confirmed_at) {
        setIsVerified(true);
        toast.success("🎉 Email verified! Redirecting to role assignment...");
        setTimeout(() => {
          navigate("/role-assignment");
        }, 2000);
      } else {
        toast.error("❌ Email not verified yet. Please check your inbox.");
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(`❌ ${error.message}`);
      } else {
        toast.error("❌ Failed to check status. Please try again.");
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="relative mt-8 grid items-center gap-8 md:grid-cols-[auto_1fr] md:gap-12"
    >
      {/* Left Section - Form/Content */}
      <motion.div variants={itemVariants} className="order-2 md:order-1">
        <AnimatePresence mode="wait">
          {isVerified ? (
            // Success State
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mx-auto max-w-md space-y-6 rounded-3xl border-2 border-green-200 bg-white p-8 text-center dark:border-green-800 dark:bg-zinc-900 md:p-10"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="flex justify-center"
              >
                <div className="rounded-full bg-green-100 p-6 dark:bg-green-900/30">
                  <CheckCircle2 className="size-16 text-green-600 dark:text-green-400" />
                </div>
              </motion.div>

              <div className="space-y-2">
                <h1 className="text-3xl font-bold md:text-4xl">
                  You're All Set! 🎉
                </h1>
                <p className="text-base opacity-80">
                  Your email has been verified successfully!
                </p>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl bg-green-50 p-4 dark:bg-green-900/20"
              >
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  Redirecting you to complete your profile...
                </p>
              </motion.div>
            </motion.div>
          ) : (
            // Verification Pending State
            <motion.div
              key="pending"
              className="mx-auto max-w-md space-y-6 rounded-3xl border-2 border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 md:p-10"
            >
              {/* Animated Envelope Icon */}
              <motion.div
                variants={envelopeVariants}
                initial="initial"
                animate="animate"
                whileHover="hover"
                className="flex justify-center"
              >
                <div className="relative">
                  {/* Outer glow */}
                  <div className="absolute inset-0 animate-pulse rounded-full bg-indigo-400/30 blur-2xl"></div>

                  {/* Main envelope container */}
                  <div className="relative rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 p-6 dark:from-indigo-900/40 dark:to-violet-900/40">
                    <Mail className="size-12 text-indigo-600 dark:text-indigo-400" />

                    {/* Sparkle effects */}
                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute -right-1 -top-1"
                    >
                      <Sparkles className="size-5 text-amber-500" />
                    </motion.div>

                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1,
                      }}
                      className="absolute -bottom-1 -left-1"
                    >
                      <Sparkles className="size-4 text-violet-500" />
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              {/* Title & Message */}
              <div className="space-y-2">
                <h1 className="text-3xl font-bold md:text-4xl">
                  Almost there! 🚀
                </h1>
                <p className="text-sm opacity-80">
                  We've sent a verification link to your email
                </p>
                <div className="flex items-center gap-1 text-sm">
                  <span className="opacity-60">Wrong email?</span>
                  <NavLink to="/signup">
                    <Button
                      variant="link"
                      className="h-fit p-0 font-semibold text-indigo-600 dark:text-indigo-400"
                    >
                      Sign up again
                    </Button>
                  </NavLink>
                </div>
              </div>

              {/* Email Display */}
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 dark:from-indigo-900/20 dark:to-violet-900/20">
                <p className="text-center text-xs opacity-70">
                  Verification email sent to:
                </p>
                <p className="mt-1 text-center text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {email}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-base font-semibold shadow-[0px_4px_0px_#4338ca] transition-all duration-300 hover:translate-y-1 hover:bg-indigo-700 hover:shadow-none disabled:translate-y-0 disabled:opacity-50"
                >
                  {isCheckingStatus ? (
                    <>
                      <RefreshCw className="size-5 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-5" />
                      I've Verified My Email
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleResendEmail}
                  disabled={cooldown > 0 || isResending}
                  variant="outline"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 text-base font-semibold transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {isResending ? (
                    <>
                      <RefreshCw className="size-5 animate-spin" />
                      Sending...
                    </>
                  ) : cooldown > 0 ? (
                    <>
                      <Clock className="size-5" />
                      Resend in {cooldown}s
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-5" />
                      Resend Verification
                    </>
                  )}
                </Button>
              </div>

              {/* Help Section */}
              <div className="space-y-2 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <HelpCircle className="mt-0.5 size-4 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold">
                      Didn't receive the email?
                    </p>
                    <ul className="space-y-1 text-xs opacity-80">
                      <li>• Check your spam or junk folder</li>
                      <li>• Verify the email address is correct</li>
                      <li>• Wait a few minutes and try resending</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Back to Login */}
              <div className="pt-2 text-center">
                <NavLink to="/login">
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    <ArrowLeft className="size-4" />
                    Back to Login
                  </Button>
                </NavLink>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
            One Step Away from{" "}
            <span className="text-indigo-600 dark:text-indigo-400">
              Epic Learning
            </span>
            ! 📬
          </h2>
          <p className="text-base leading-relaxed opacity-80">
            Just verify your email and you'll unlock access to AI-powered
            quizzes, competitive leaderboards, and a whole new way to learn!
          </p>
        </div>

        <div className="space-y-4 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 p-6 dark:from-indigo-900/30 dark:to-violet-900/30">
          <div className="flex items-center gap-2">
            <Rocket className="size-6 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold">What Happens Next?</h3>
          </div>
          <div className="space-y-3">
            {[
              { emoji: "📧", text: "Check your email inbox" },
              { emoji: "🔗", text: "Click the verification link" },
              { emoji: "🎯", text: "Choose your role (Student/Teacher)" },
              { emoji: "🚀", text: "Start your quiz adventure!" },
            ].map((step, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="flex items-center gap-3"
              >
                <span className="text-2xl">{step.emoji}</span>
                <span className="text-sm font-medium">{step.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border-2 border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-800 dark:bg-indigo-900/20">
          <p className="text-center text-sm font-semibold italic">
            "The verification was quick and easy. Within minutes, I was creating
            my first quiz!" ⚡
          </p>
          <p className="mt-2 text-center text-xs opacity-70">
            — Sarah, Educator
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EmailVerification;
