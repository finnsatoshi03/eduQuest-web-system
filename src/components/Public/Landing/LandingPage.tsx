import { motion, Variants } from "framer-motion";

import Header from "./Header";
import CallToActionButtons from "./CallToActionButtons";
import ExploreFeatures from "./ExploreFeatures";
import Recap from "./Recap";
import { BlogCarousel } from "./BlogsCarousel";

const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    transition: {
      staggerChildren: 0.5,
      delayChildren: 2,
    },
  },
};

export default function LandingPage() {
  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="relative my-8 flex h-[calc(100%-12rem)] w-full flex-col items-center justify-center space-y-8"
      >
        <Header />
        <CallToActionButtons firstButtonNavLink="NavLink" />
      </motion.div>
      <ExploreFeatures />
      <BlogCarousel />
      <Recap />
    </>
  );
}
