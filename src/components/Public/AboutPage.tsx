import React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Zap,
  Trophy,
  Users,
  Brain,
  Rocket,
  Heart,
  Target,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, when: "beforeChildren" },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 60, damping: 12 },
  },
};

const features = [
  {
    icon: Zap,
    title: "Lightning-Fast Quiz Creation",
    description:
      "Upload any PDF and watch our AI work its magic. Quizzes ready in seconds!",
    color: "text-amber-500",
    bgColor: "bg-amber-100 dark:bg-amber-900/20",
  },
  {
    icon: Brain,
    title: "Smart AI Technology",
    description:
      "Our NLP engine understands your content and creates questions that actually make sense.",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/20",
  },
  {
    icon: Trophy,
    title: "Gamified Learning",
    description:
      "Turn boring tests into epic battles! Leaderboards, points, and glory await.",
    color: "text-violet-600",
    bgColor: "bg-violet-100 dark:bg-violet-900/20",
  },
  {
    icon: Users,
    title: "Built for Everyone",
    description:
      "Whether you're teaching kindergarten or college, Quiz Royale adapts to your needs.",
    color: "text-teal-600",
    bgColor: "bg-teal-100 dark:bg-teal-900/20",
  },
];

const AboutPage: React.FC = () => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="mt-8 space-y-16 pb-16"
    >
      {/* Hero Section */}
      <motion.section variants={itemVariants} className="text-center">
        <motion.div className="mb-4 flex items-center justify-center gap-2">
          <Sparkles className="size-6 text-amber-500" />
          <span className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            About Quiz Royale
          </span>
          <Sparkles className="size-6 text-amber-500" />
        </motion.div>
        <h1 className="mb-6 text-5xl font-bold leading-tight md:text-7xl">
          Where{" "}
          <span className="relative inline-block">
            <span className="relative z-10">Learning</span>
            <svg
              className="absolute -bottom-2 left-0 w-full text-amber-400"
              height="12"
              viewBox="0 0 200 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0 6C20 0 40 12 60 6C80 0 100 12 120 6C140 0 160 12 180 6C190 3 195 0 200 6"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <br />
          Becomes an{" "}
          <span className="text-indigo-600 dark:text-indigo-400">
            Adventure
          </span>
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed opacity-80 md:text-lg">
          We're on a mission to transform education into an epic quest. No more
          boring tests, no more late-night question writing—just pure learning
          magic powered by AI! 🎮✨
        </p>
      </motion.section>

      {/* Mission & Vision */}
      <motion.section
        variants={containerVariants}
        className="grid gap-8 md:grid-cols-2"
      >
        <motion.div
          variants={itemVariants}
          className="space-y-4 rounded-3xl bg-gradient-to-br from-indigo-100 to-indigo-200 p-8 dark:from-indigo-900/30 dark:to-indigo-800/20"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-indigo-600 p-3 text-white">
              <Target className="size-6" />
            </div>
            <h2 className="text-2xl font-bold md:text-3xl">Our Mission</h2>
          </div>
          <p className="text-sm leading-relaxed md:text-base">
            To make learning so fun and engaging that students forget they're
            actually studying. We believe education should feel like playing
            your favorite game—challenging, rewarding, and absolutely addictive!
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="space-y-4 rounded-3xl bg-gradient-to-br from-amber-100 to-amber-200 p-8 dark:from-amber-900/30 dark:to-amber-800/20"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500 p-3 text-white">
              <Rocket className="size-6" />
            </div>
            <h2 className="text-2xl font-bold md:text-3xl">Our Vision</h2>
          </div>
          <p className="text-sm leading-relaxed md:text-base">
            To become the world's most loved learning platform. We're building a
            future where every classroom is a gaming arena, every lesson is a
            quest, and every student is a champion! 🏆
          </p>
        </motion.div>
      </motion.section>

      {/* How It Works */}
      <motion.section variants={containerVariants} className="space-y-8">
        <motion.div variants={itemVariants} className="text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">
            How It{" "}
            <span className="rounded-xl bg-indigo-600 px-3 text-white">
              Works
            </span>
          </h2>
          <p className="mx-auto max-w-xl text-sm opacity-80 md:text-base">
            Three simple steps to quiz greatness. No PhD in technology required!
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          className="grid gap-6 md:grid-cols-3"
        >
          {[
            {
              step: "01",
              title: "Upload Your Content",
              description:
                "Drop any PDF, doc, or text. Our AI reads faster than a caffeinated college student during finals week!",
              emoji: "📄",
            },
            {
              step: "02",
              title: "AI Works Its Magic",
              description:
                "Our smart algorithms analyze, extract, and create perfect questions. You? Just grab some coffee! ☕",
              emoji: "✨",
            },
            {
              step: "03",
              title: "Let the Games Begin",
              description:
                "Launch your quiz, watch students compete, and enjoy being the coolest educator in the building! 🎮",
              emoji: "🚀",
            },
          ].map((item, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group relative overflow-hidden rounded-3xl border-2 border-indigo-200 bg-white p-6 transition-all hover:scale-105 hover:shadow-xl dark:border-indigo-800 dark:bg-zinc-900"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-6xl font-black text-indigo-200 dark:text-indigo-900">
                  {item.step}
                </span>
                <span className="text-4xl">{item.emoji}</span>
              </div>
              <h3 className="mb-2 text-xl font-bold">{item.title}</h3>
              <p className="text-sm leading-relaxed opacity-80">
                {item.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* Features Grid */}
      <motion.section variants={containerVariants} className="space-y-8">
        <motion.div variants={itemVariants} className="text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">
            Why Educators{" "}
            <span className="inline-flex items-center gap-2">
              <Heart className="inline size-10 fill-red-500 text-red-500" /> Us
            </span>
          </h2>
          <p className="mx-auto max-w-xl text-sm opacity-80 md:text-base">
            Features that make your teaching life easier and your students'
            learning experience unforgettable.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          className="grid gap-6 md:grid-cols-2"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group rounded-3xl border-2 border-zinc-200 bg-white p-6 transition-all hover:scale-105 hover:border-indigo-300 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
            >
              <div className="mb-4 flex items-center gap-4">
                <div
                  className={`rounded-2xl ${feature.bgColor} p-4 transition-transform group-hover:scale-110`}
                >
                  <feature.icon className={`size-8 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold">{feature.title}</h3>
              </div>
              <p className="text-sm leading-relaxed opacity-80">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* Join Section */}
      <motion.section
        variants={containerVariants}
        className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-8 text-white md:p-12"
      >
        <motion.div variants={itemVariants} className="text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-5xl">
            Join the Quest! 🎮
          </h2>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed opacity-90 md:text-lg">
            Whether you're teaching elementary school or college, Quiz Royale is
            built to make your life easier and your students more engaged. Start
            creating quizzes that students actually want to take!
          </p>
        </motion.div>
      </motion.section>

      {/* CTA Section */}
      <motion.section variants={itemVariants} className="text-center">
        <div className="mx-auto max-w-2xl space-y-6 rounded-3xl bg-gradient-to-br from-amber-100 to-amber-200 p-8 dark:from-amber-900/30 dark:to-amber-800/20 md:p-12">
          <h2 className="text-3xl font-bold md:text-5xl">
            Ready to Transform Your Classroom? 🎯
          </h2>
          <p className="text-sm leading-relaxed opacity-80 md:text-base">
            Join thousands of educators who've already discovered the magic of
            gamified learning. Your students will thank you (and maybe even pay
            attention in class)!
          </p>
          <div className="flex flex-col items-center justify-center gap-4 pt-4 md:flex-row">
            <a
              href="/signup"
              className="flex h-fit w-64 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-[0px_4px_0px_#4338ca] transition-all duration-300 hover:translate-y-1 hover:shadow-none"
            >
              Start Free <Rocket className="size-5" />
            </a>
            <a
              href="/contact"
              className="flex h-fit w-64 items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-semibold text-indigo-600 shadow-[0px_4px_0px_#e0e7ff] transition-all duration-300 hover:translate-y-1 hover:shadow-none dark:bg-zinc-900 dark:text-indigo-400"
            >
              Get in Touch <Heart className="size-5" />
            </a>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
};

export default AboutPage;
