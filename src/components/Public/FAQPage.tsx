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
          We've got answers! Here's everything you need to know about Quiz
          Royale. Can't find what you're looking for? Hit us up—we're always
          happy to help! 💬
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
          back to you faster than you can say "Quiz Royale"!
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
    question: "How do I join a quiz?",
    answer:
      "Your teacher will give you a unique class code (36 characters). Enter the code on your student dashboard, choose a display name, and you're in! You can join both live quiz games and scheduled quizzes. 🎮",
  },
  {
    category: "students",
    value: "student-2",
    question: "Do I need to create an account?",
    answer:
      "Yes! You'll need to sign up with an email and verify your account. After signing up, choose your role as a student, and you'll have access to your dashboard where you can enter class codes to join quizzes. 📝",
  },
  {
    category: "students",
    value: "student-3",
    question: "What's the difference between live and scheduled quizzes?",
    answer:
      "Live quizzes happen in real-time—you join a lobby, wait for your teacher to start, and play together with your classmates. Scheduled quizzes have set opening and closing times, so you can take them anytime within that window. ⏰",
  },
  {
    category: "students",
    value: "student-4",
    question: "How do leaderboards work?",
    answer:
      "In live quizzes, points are based on speed and accuracy! Answer correctly and quickly to score higher. The leaderboard updates in real-time so you can see how you stack up against your classmates. 🏆",
  },
  {
    category: "students",
    value: "student-5",
    question: "Can I retake a scheduled quiz?",
    answer:
      "It depends! Your teacher can enable retakes when setting up the quiz. If retakes are allowed, you can take the quiz multiple times within the scheduled time window. 🔄",
  },
  {
    category: "students",
    value: "student-6",
    question: "Can I play on my phone?",
    answer:
      "Absolutely! Quiz Royale works on phones, tablets, and laptops. Just make sure you have a stable internet connection for the best experience. 📱",
  },

  // For Teachers
  {
    category: "teachers",
    value: "teacher-1",
    question: "How do I create a quiz?",
    answer:
      "Click 'Create Quiz' on your dashboard, upload a PDF file, choose your question type (Multiple Choice, True/False, or Identification), select how many questions to generate, and our AI does the rest! Then customize, preview, and you're ready to go. ✨",
  },
  {
    category: "teachers",
    value: "teacher-2",
    question: "Can I edit AI-generated questions?",
    answer:
      "Absolutely! After questions are generated, you can edit, add, or delete any question. Change the text, answers, time limits, point values, and even add images. You have full control! ✏️",
  },
  {
    category: "teachers",
    value: "teacher-3",
    question: "What file formats are supported?",
    answer:
      "Currently, we support PDF files for AI-based question generation. Upload your course materials, lecture notes, or study guides in PDF format, and our system will extract content to create relevant questions. 📄",
  },
  {
    category: "teachers",
    value: "teacher-4",
    question: "What's the difference between live and scheduled quizzes?",
    answer:
      "Live quizzes happen in real-time—students join a lobby and you control when each question appears. Scheduled quizzes open and close at specific times you set, allowing students to take them independently within that window. Both options are perfect for different teaching scenarios! 🎯",
  },
  {
    category: "teachers",
    value: "teacher-5",
    question: "How do I track student performance?",
    answer:
      "During live quizzes, see real-time leaderboards, accuracy charts, and question-by-question analytics. For scheduled quizzes, access detailed response data from your dashboard. View individual scores, class averages, and identify which questions were challenging. 📊",
  },
  {
    category: "teachers",
    value: "teacher-6",
    question: "Can I reuse quizzes?",
    answer:
      "Yes! All your quizzes are saved in your dashboard. You can launch the same quiz multiple times for different classes or semesters. Each session creates a new unique class code. ♻️",
  },

  // Gameplay
  {
    category: "gameplay",
    value: "gameplay-1",
    question: "What types of questions can I create?",
    answer:
      "Quiz Royale supports three question types: Multiple Choice (pick the correct answer from options), True/False (simple binary questions), and Identification (fill-in-the-blank style answers). Each type can include images and custom point values! 🎯",
  },
  {
    category: "gameplay",
    value: "gameplay-2",
    question: "How does the timer work?",
    answer:
      "Teachers set the time limit for each question individually (you can also disable timers for scheduled quizzes). In live quizzes, the countdown starts when the question appears. Answer quickly to score more points! ⏱️",
  },
  {
    category: "gameplay",
    value: "gameplay-3",
    question: "Can I shuffle questions?",
    answer:
      "Yes! When setting up your quiz, enable the 'Shuffle Questions' option. This randomizes the question order for each student, helping reduce cheating and making each experience unique. 🔀",
  },
  {
    category: "gameplay",
    value: "gameplay-4",
    question: "What happens if time runs out on a question?",
    answer:
      "In live quizzes, unanswered questions are marked as incorrect and the game moves to the next question automatically. In scheduled quizzes, you can enable 'No Time Limit' mode where students can take as long as they need. ⏰",
  },

  // Account & Privacy
  {
    category: "account",
    value: "account-1",
    question: "How do I sign up?",
    answer:
      "Click 'Sign Up', enter your email and password, then verify your email address. After verification, choose your role (student or teacher) and you're all set! You can also sign up with Google for faster access. 🚀",
  },
  {
    category: "account",
    value: "account-2",
    question: "Can I update my profile?",
    answer:
      "Yes! Go to your profile settings to update your display name, school, profile picture, and password. Your email address cannot be changed for security reasons. 👤",
  },
  {
    category: "account",
    value: "account-3",
    question: "Is my data safe?",
    answer:
      "Absolutely! We use Supabase for secure authentication and data storage. All passwords are encrypted, and we never share your personal information with third parties. Your uploaded course materials are used only to generate quiz questions. 🔒",
  },
];
