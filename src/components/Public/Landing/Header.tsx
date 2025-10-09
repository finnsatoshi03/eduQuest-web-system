import {
  motion,
  Variants,
  useViewportScroll,
  useTransform,
} from "framer-motion";
import { Sparkles } from "lucide-react";

const textFadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: {
      delay: i * 0.05,
      duration: 0.4,
    },
  }),
};

const elementFadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.25,
      duration: 0.5,
    },
  }),
};

const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    transition: {
      staggerChildren: 0.25,
      delayChildren: 0.2,
    },
  },
};

const splitText = (text: string) => {
  return text.split("").map((char, index) => (
    <motion.span
      key={index}
      custom={index}
      variants={textFadeIn}
      className="inline-block"
    >
      {char === " " ? "\u00A0" : char}
    </motion.span>
  ));
};

export default function Header() {
  const { scrollY } = useViewportScroll();
  const rotate = useTransform(scrollY, [0, 300], [0, 360]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="flex w-full flex-col items-center justify-center space-y-6 text-center"
    >
      <motion.div>
        <motion.div className="relative flex w-full justify-between">
          <motion.img src="student-welcome.gif" className="w-20" />
          <motion.p
            custom={0}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 -translate-y-1/2 transform text-sm font-medium md:text-base"
          >
            {splitText("Level Up Your Learning!")}
          </motion.p>
          <motion.img
            src="wizard-welcome.gif"
            className="absolute -right-12 w-48"
          />
        </motion.div>

        <motion.h1
          custom={1}
          className="mt-2 text-5xl font-bold leading-tight md:text-7xl"
        >
          {splitText("Where ")}
          <span className="relative">
            {splitText("Learning")}
            <motion.div
              custom={2}
              variants={elementFadeIn}
              className="absolute -left-4 top-2 size-4 fill-amber-400 text-amber-400 md:-left-6 md:size-6"
              style={{ rotate }}
            >
              <Sparkles />
            </motion.div>
          </span>
          <br />
          {splitText("Meets ")}
          <motion.span
            custom={3}
            className="font-pixel relative font-semibold italic text-indigo-600 dark:text-indigo-400"
          >
            {splitText("Adventure")}
            <motion.img
              custom={4}
              variants={elementFadeIn}
              src="/hash.png"
              className="absolute -left-4 top-0 w-8 rotate-2 md:-left-7 md:-top-2 md:w-14"
            />
          </motion.span>
          <br />
          {splitText("in Every ")}
          <motion.span
            custom={5}
            className="font-pixel relative z-10 font-semibold italic text-amber-500"
          >
            {splitText("Quiz")}
          </motion.span>
        </motion.h1>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        className="relative w-full max-w-2xl text-sm leading-relaxed md:text-base"
      >
        <motion.p className="relative z-20 opacity-90">
          {splitText(
            "Transform any lesson into an epic quest! EduQuest uses AI magic to create interactive quizzes that make learning feel like play. Upload, generate, and watch your students compete for glory!",
          )}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
