import { Card, Carousel } from "@/components/Shared/carousel";
import { BLOGS } from "@/lib/constants";

export function BlogCarousel() {
  const cards = BLOGS.map((card, index) => (
    <Card key={card.src} card={card} index={index} />
  ));

  return (
    <div className="-mx-6 w-screen px-6 py-10 md:-mx-12 md:px-12 lg:-mx-16 lg:px-16">
      <div className="pl-4">
        <h2 className="mb-2 font-sans text-lg font-bold text-black dark:text-white md:mb-4 md:text-4xl">
          <span className="relative">
            Level Up{" "}
            <svg
              className="absolute -bottom-3 left-1/2 w-[70px] -translate-x-1/2 transform text-indigo-600 md:w-[140px]"
              height="20"
              viewBox="0 0 140 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0 10C10 0 30 20 50 10C70 0 90 20 110 10C130 0 150 20 170 10"
                stroke="currentColor"
                className="stroke-[3] md:stroke-[6]"
                strokeLinecap="round"
              />
            </svg>
          </span>{" "}
          Your{" "}
          <span className="rounded-xl bg-amber-500 px-2 text-white">Game</span>{" "}
          📚
        </h2>
        <p className="max-w-lg text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 md:text-base">
          Pro tips, power moves, and insider secrets to master EduQuest. Learn
          how to create quizzes that students can't stop playing!
        </p>
      </div>
      <Carousel items={cards} />
    </div>
  );
}
