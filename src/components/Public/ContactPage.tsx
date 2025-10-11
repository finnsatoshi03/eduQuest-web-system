import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, MessageCircle, Send, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { z } from "zod";
import { useState } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";

// Validation Schema using Zod
const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 70 } },
};

// Confetti animation component
const Confetti = () => (
  <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
    {Array.from({ length: 50 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute size-3 rounded-full"
        style={{
          backgroundColor: ["#6366f1", "#f59e0b", "#a78bfa", "#86efac"][i % 4],
          left: `${Math.random() * 100}%`,
          top: "50%",
        }}
        initial={{ y: 0, opacity: 1, scale: 0 }}
        animate={{
          y: [0, -300, -600],
          x: [(Math.random() - 0.5) * 200, (Math.random() - 0.5) * 400],
          opacity: [1, 1, 0],
          scale: [0, 1, 0.5],
          rotate: [0, Math.random() * 360],
        }}
        transition={{ duration: 2, ease: "easeOut" }}
      />
    ))}
  </div>
);

export default function ContactPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data);
    setIsSubmitted(true);
    setShowConfetti(true);
    form.reset();

    // Hide confetti after animation
    setTimeout(() => setShowConfetti(false), 2000);

    // Reset success message after 5 seconds
    setTimeout(() => setIsSubmitted(false), 5000);
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="mt-8 space-y-12 pb-16"
    >
      {showConfetti && <Confetti />}

      {/* Header Section */}
      <motion.div variants={itemVariants} className="text-center">
        <motion.div className="mb-8 flex items-center justify-center gap-2">
          <MessageCircle className="size-6 text-indigo-600" />
          <span className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Get in Touch
          </span>
          <MessageCircle className="size-6 text-indigo-600" />
        </motion.div>
        <h1 className="mb-6 text-5xl font-bold leading-tight md:text-7xl">
          We'd{" "}
          <span className="rounded-xl bg-amber-500 px-3 text-white">Love</span>{" "}
          to
          <br />
          Hear from You! 💬
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed opacity-80 md:text-base">
          Got questions? Feedback? Just want to say hi? Drop us a message and
          we'll get back to you faster than you can complete a quiz! ⚡
        </p>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        {/* Left Section - Info Cards */}
        <motion.div variants={containerVariants} className="space-y-6">
          <motion.div
            variants={itemVariants}
            className="space-y-4 rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 dark:border-indigo-800 dark:from-indigo-900/20 dark:to-indigo-800/20 md:p-8"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-600 p-3 text-white">
                <Mail className="size-6" />
              </div>
              <h3 className="text-xl font-bold md:text-2xl">Email Us</h3>
            </div>
            <p className="text-sm opacity-80">
              For general inquiries, support, or partnerships:
            </p>
            <div className="space-y-2">
              <a
                href="mailto:hello@quiz-royale.com"
                className="block text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 md:text-base"
              >
                hello@quiz-royale.com
              </a>
              <a
                href="mailto:support@quiz-royale.com"
                className="block text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 md:text-base"
              >
                support@quiz-royale.com
              </a>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="space-y-4 rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 p-6 dark:border-amber-800 dark:from-amber-900/20 dark:to-amber-800/20 md:p-8"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500 p-3 text-white">
                <Sparkles className="size-6" />
              </div>
              <h3 className="text-xl font-bold md:text-2xl">Office Hours</h3>
            </div>
            <p className="text-sm opacity-80">
              We're here to help during these hours:
            </p>
            <div className="space-y-1 text-sm md:text-base">
              <p className="font-semibold">Monday - Friday</p>
              <p className="opacity-80">9:00 AM - 6:00 PM (GMT+8)</p>
              <p className="mt-2 text-xs opacity-70">
                💡 Pro tip: Email us anytime! We'll respond during office hours.
              </p>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="rounded-3xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100 p-6 dark:border-violet-800 dark:from-violet-900/20 dark:to-violet-800/20 md:p-8"
          >
            <h3 className="mb-3 text-lg font-bold md:text-xl">
              Quick Response Time ⚡
            </h3>
            <p className="text-sm leading-relaxed opacity-80">
              We typically respond within 24 hours on business days. For urgent
              matters, please mention "URGENT" in your subject line!
            </p>
          </motion.div>
        </motion.div>

        {/* Right Section - Contact Form */}
        <motion.div variants={itemVariants}>
          <div className="sticky top-8 rounded-3xl border-2 border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold md:text-3xl">
                Send Us a Message 📨
              </h2>
              <p className="text-sm opacity-80">
                Fill out the form below and we'll get back to you ASAP!
              </p>
            </div>

            {isSubmitted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 rounded-2xl bg-gradient-to-r from-green-100 to-teal-100 p-4 text-center dark:from-green-900/30 dark:to-teal-900/30"
              >
                <p className="text-sm font-semibold text-green-700 dark:text-green-400 md:text-base">
                  🎉 Message sent successfully! We'll be in touch soon!
                </p>
              </motion.div>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Your Name"
                          {...field}
                          className="h-12 rounded-xl border-2 border-zinc-200 bg-zinc-50 transition-all focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Your Email"
                          {...field}
                          className="h-12 rounded-xl border-2 border-zinc-200 bg-zinc-50 transition-all focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Subject"
                          {...field}
                          className="h-12 rounded-xl border-2 border-zinc-200 bg-zinc-50 transition-all focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us what's on your mind..."
                          {...field}
                          className="min-h-[150px] rounded-xl border-2 border-zinc-200 bg-zinc-50 transition-all focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-base font-semibold text-white shadow-[0px_4px_0px_#4338ca] transition-all duration-300 hover:translate-y-1 hover:bg-indigo-700 hover:shadow-none"
                >
                  <Send className="size-5" />
                  Send Message
                </Button>
              </form>
            </Form>
          </div>
        </motion.div>
      </div>

      {/* Bottom CTA */}
      <motion.div
        variants={itemVariants}
        className="mx-auto max-w-3xl space-y-6 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-8 text-center text-white md:p-12"
      >
        <h2 className="text-3xl font-bold md:text-4xl">
          Prefer Social Media? 🌟
        </h2>
        <p className="text-sm opacity-90 md:text-base">
          Follow us on social media for updates, tips, and behind-the-scenes
          content. We're pretty active there too!
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          {[
            { name: "Twitter", icon: "🐦", url: "#" },
            { name: "Facebook", icon: "📘", url: "#" },
            { name: "Instagram", icon: "📸", url: "#" },
            { name: "LinkedIn", icon: "💼", url: "#" },
          ].map((social) => (
            <a
              key={social.name}
              href={social.url}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-indigo-600 transition-all hover:scale-105 hover:shadow-lg"
            >
              <span className="text-xl">{social.icon}</span>
              {social.name}
            </a>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
