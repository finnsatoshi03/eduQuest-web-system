import { motion, Variants } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router-dom";

const buttonFadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.3,
      duration: 0.5,
      ease: "easeInOut",
    },
  }),
};

const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    transition: {
      staggerChildren: 0.3,
    },
  },
};

const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: "smooth" });
  }
};

interface CallToActionButtonsProps {
  align?: "center" | "left" | "right";
  firstButtonNavLink?: string;
  firstButtonTo?: string;
  firstButtonText?: string;
  secondButtonTo?: string;
  secondButtonText?: string;
}

export default function CallToActionButtons({
  align = "left",
  firstButtonNavLink = "button",
  firstButtonTo = "/login",
  firstButtonText = "Start Playing",
  secondButtonTo = "/faq",
  secondButtonText = "Learn More",
}: CallToActionButtonsProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={`flex flex-col gap-2 md:flex-row ${
        align === "center"
          ? "items-center justify-center"
          : align === "right"
            ? "items-end justify-end"
            : "items-start justify-start"
      }`}
    >
      {firstButtonNavLink === "button" ? (
        <div onClick={() => scrollToSection("explore")}>
          <motion.div custom={0} variants={buttonFadeIn}>
            <Button className="relative flex h-fit w-60 items-center gap-1 rounded-md px-6 py-3 text-lg font-normal shadow-[0px_4px_0px_#4f46e5] transition-all duration-300 hover:translate-y-1 hover:shadow-none dark:shadow-[0px_4px_0px_#a5b4fc] dark:hover:shadow-none md:w-full">
              {firstButtonText} <ChevronRight />
              {/* <motion.img
                custom={2}
                variants={buttonFadeIn}
                src="/arrow-to-sign.png"
                className="absolute -left-12 -top-24 z-10 hidden w-24 md:block"
                animate={{ rotate: 90 }}
              /> */}
            </Button>
          </motion.div>
        </div>
      ) : (
        <NavLink to={firstButtonTo}>
          <motion.div custom={0} variants={buttonFadeIn}>
            <Button className="relative flex h-fit w-60 items-center gap-1 rounded-md px-6 py-3 text-lg font-normal shadow-[0px_4px_0px_#4f46e5] transition-all duration-300 hover:translate-y-1 hover:shadow-none dark:shadow-[0px_4px_0px_#a5b4fc] dark:hover:shadow-none md:w-full">
              {firstButtonText} <ChevronRight />
              {/* {!hideArrow && (
                <motion.img
                  custom={2}
                  variants={buttonFadeIn}
                  src="/arrow-to-sign.png"
                  className="absolute -left-12 -top-24 z-10 hidden w-24 md:block"
                  animate={{ rotate: 90 }}
                />
              )} */}
            </Button>
          </motion.div>
        </NavLink>
      )}
      <NavLink to={secondButtonTo}>
        <motion.div custom={1} variants={buttonFadeIn}>
          <Button
            variant="secondary"
            className="flex h-fit w-60 items-center gap-1 rounded-md px-6 py-3 text-lg font-normal shadow-[0px_4px_0px_#a5b4fc] transition-all duration-300 hover:translate-y-1 hover:shadow-none dark:shadow-[0px_4px_0px_#4f46e5] dark:hover:shadow-none md:w-full"
          >
            {secondButtonText} <ChevronRight />
          </Button>
        </motion.div>
      </NavLink>
    </motion.div>
  );
}
