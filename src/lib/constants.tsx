import Blog1 from "@/components/Public/Landing/Blogs/blog-1";
import Blog2 from "@/components/Public/Landing/Blogs/blog-2";
import Blog3 from "@/components/Public/Landing/Blogs/blog-3";

type GameColors = {
  light: string[];
  dark: string[];
};

export const GAME_COLORS: GameColors = {
  light: ["#6366f1", "#14b8a6", "#f59e0b", "#8b5cf6", "#06b6d4"],
  dark: ["#818cf8", "#5eead4", "#fbbf24", "#a78bfa", "#22d3ee"],
};

export const BLOGS = [
  {
    category: "Artificial Intelligence",
    title:
      "Revolutionizing Education with AI: How NLP Powers Seamless Question Generation",
    src: "/images/blog-1.3.png",
    content: <Blog1 />,
  },
  {
    category: "EdTech",
    title: "From Classroom to Game Room: Making Quizzes Fun with 8-Bit Style",
    src: "/images/blog-2.3.png",
    content: <Blog2 />,
  },
  {
    category: "Teaching Strategies",
    title:
      "Customizing Quizzes: How Professors Can Tailor Assessments to Fit Any Curriculum",
    src: "/images/blog-3.7.png",
    content: <Blog3 />,
  },
];
