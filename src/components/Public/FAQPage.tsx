import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  GraduationCap,
  BookOpen,
  Shield,
  Gamepad2,
  HelpCircle,
} from "lucide-react";

// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 70 } },
};

const categories = [
  {
    id: "students",
    title: "For Students",
    icon: GraduationCap,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/20",
  },
  {
    id: "teachers",
    title: "For Teachers",
    icon: BookOpen,
    color: "text-amber-500",
    bgColor: "bg-amber-100 dark:bg-amber-900/20",
  },
  {
    id: "gameplay",
    title: "Gameplay",
    icon: Gamepad2,
    color: "text-violet-600",
    bgColor: "bg-violet-100 dark:bg-violet-900/20",
  },
  {
    id: "account",
    title: "Account & Privacy",
    icon: Shield,
    color: "text-teal-600",
    bgColor: "bg-teal-100 dark:bg-teal-900/20",
  },
];

export default function FAQPage() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="mt-8 space-y-12 pb-16"
    >
      {/* Header Section */}
      <motion.div variants={itemVariants} className="text-center">
        <motion.div className="mb-8 flex items-center justify-center gap-2">
          <HelpCircle className="size-6 text-indigo-600" />
          <span className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Help Center
          </span>
        </motion.div>
        <h1 className="mb-6 text-5xl font-bold md:text-7xl">
          Got{" "}
          <span className="rounded-xl bg-indigo-600 px-3 text-white">
            Questions?
          </span>
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed opacity-80 md:text-base">
          We've got answers! Here's everything you need to know about EduQuest.
          Can't find what you're looking for? Hit us up—we're always happy to
          help! 💬
        </p>
      </motion.div>

      {/* FAQ Categories */}
      <motion.div variants={containerVariants} className="space-y-8">
        {categories.map((category) => {
          const CategoryIcon = category.icon;
          const categoryFAQs = faqData.filter(
            (faq) => faq.category === category.id,
          );

          return (
            <motion.section
              key={category.id}
              variants={itemVariants}
              className="space-y-4"
            >
              {/* Category Header */}
              <div className="flex items-center gap-4">
                <div
                  className={`rounded-2xl ${category.bgColor} p-3 transition-transform hover:scale-110`}
                >
                  <CategoryIcon className={`size-6 ${category.color}`} />
                </div>
                <h2 className="text-2xl font-bold md:text-3xl">
                  {category.title}
                </h2>
              </div>

              {/* Accordion */}
              <Accordion type="single" collapsible className="w-full space-y-3">
                {categoryFAQs.map((faq) => (
                  <AccordionItem
                    key={faq.value}
                    value={faq.value}
                    className="rounded-2xl border-2 border-zinc-200 bg-white px-6 transition-all hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
                  >
                    <AccordionTrigger className="text-left text-base font-semibold hover:no-underline md:text-lg">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed opacity-80 md:text-base">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.section>
          );
        })}
      </motion.div>

      {/* Still Have Questions CTA */}
      <motion.div
        variants={itemVariants}
        className="mx-auto max-w-2xl space-y-6 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-8 text-center text-white md:p-12"
      >
        <h2 className="text-3xl font-bold md:text-4xl">
          Still Have Questions? 🤔
        </h2>
        <p className="text-sm opacity-90 md:text-base">
          No worries! Our team is here to help. Shoot us a message and we'll get
          back to you faster than you can say "EduQuest"!
        </p>
        <a
          href="/contact"
          className="mx-auto flex h-fit w-64 items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-semibold text-indigo-600 shadow-[0px_4px_0px_#c7d2fe] transition-all duration-300 hover:translate-y-1 hover:shadow-none"
        >
          Contact Us 💬
        </a>
      </motion.div>
    </motion.div>
  );
}

// FAQ Data organized by category
const faqData = [
  // For Students
  {
    category: "students",
    value: "student-1",
    question: "How do I join a quiz game?",
    answer:
      "Easy peasy! Your teacher will give you a game code. Just head to EduQuest, enter the code, pick your nickname (make it epic!), and you're in! Ready, set, quiz! 🎮",
  },
  {
    category: "students",
    value: "student-2",
    question: "Do I need to create an account?",
    answer:
      "Nope! For playing quizzes, you just need a game code from your teacher. But if you want to track your progress and climb those leaderboards, signing up is the way to go! 🏆",
  },
  {
    category: "students",
    value: "student-3",
    question: "How do leaderboards work?",
    answer:
      "The faster you answer correctly, the more points you score! Race to the top of the leaderboard and show everyone who's boss. Speed + accuracy = victory! ⚡",
  },
  {
    category: "students",
    value: "student-4",
    question: "Can I play on my phone?",
    answer:
      "Absolutely! EduQuest works on phones, tablets, laptops—pretty much anything with a screen. Learn anywhere, anytime. No excuses! 📱",
  },

  // For Teachers
  {
    category: "teachers",
    value: "teacher-1",
    question: "How do I create a quiz with EduQuest?",
    answer:
      "Super simple! Upload your PDF or doc, let our AI work its magic, review the auto-generated questions (and tweak if needed), then launch! The whole process takes less time than making coffee. ☕",
  },
  {
    category: "teachers",
    value: "teacher-2",
    question: "Can I edit AI-generated questions?",
    answer:
      "Of course! Our AI is smart, but you're the expert. Review, edit, add, or remove any questions before going live. You're always in control! ✏️",
  },
  {
    category: "teachers",
    value: "teacher-3",
    question: "What file formats are supported?",
    answer:
      "We support PDFs, Word docs (.docx), and plain text files. As long as it's got words, we can work with it! Planning to add more formats soon. 📄",
  },
  {
    category: "teachers",
    value: "teacher-4",
    question: "How do I track student performance?",
    answer:
      "Your dashboard shows everything—individual scores, class averages, question analytics, and more. See who's crushing it and who needs extra help. Data-driven teaching FTW! 📊",
  },
  {
    category: "teachers",
    value: "teacher-5",
    question: "Is there a limit to how many quizzes I can create?",
    answer:
      "Free accounts get 5 quizzes per month. Need more? Our Pro plan gives you unlimited quiz creation plus extra features. Check out our pricing page! 🚀",
  },

  // Gameplay
  {
    category: "gameplay",
    value: "gameplay-1",
    question: "What types of questions can I create?",
    answer:
      "Multiple choice, true/false, matching, and fill-in-the-blank. Mix and match to keep things interesting! More question types coming soon. 🎯",
  },
  {
    category: "gameplay",
    value: "gameplay-2",
    question: "Can students play quizzes multiple times?",
    answer:
      "Teachers decide! You can allow retakes for practice or make it one-shot for high-stakes assessment. Flexibility is key! 🔄",
  },
  {
    category: "gameplay",
    value: "gameplay-3",
    question: "How does the timer work?",
    answer:
      "Teachers set the time limit for each question (5-120 seconds). The clock starts when the question appears. Answer fast to max out your points! ⏱️",
  },
  {
    category: "gameplay",
    value: "gameplay-4",
    question: "What happens if I lose connection during a game?",
    answer:
      "Don't panic! You'll have 60 seconds to reconnect. If you make it back, you'll jump right back in where you left off. We've got your back! 🌐",
  },

  // Account & Privacy
  {
    category: "account",
    value: "account-1",
    question: "Is my data safe on EduQuest?",
    answer:
      "100%! We use bank-level encryption to protect your data. We never sell your info, and everything follows strict privacy standards. Your trust is our top priority. 🔒",
  },
  {
    category: "account",
    value: "account-2",
    question: "How do I reset my password?",
    answer:
      "Click 'Forgot Password' on the login page, enter your email, and we'll send you a reset link. Easy! Don't forget to check your spam folder. 📧",
  },
  {
    category: "account",
    value: "account-3",
    question: "Can I delete my account?",
    answer:
      "Yes, but we'll miss you! 😢 Go to Settings > Account > Delete Account. All your data will be permanently removed within 30 days. This can't be undone, so think carefully!",
  },
  {
    category: "account",
    value: "account-4",
    question: "Do you comply with GDPR and COPPA?",
    answer:
      "Absolutely! We're fully compliant with GDPR, COPPA, and other major privacy regulations. Education + privacy = non-negotiable. ✅",
  },
];
