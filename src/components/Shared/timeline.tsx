import { useScroll, useTransform, motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

interface TimelineEntry {
  title: string;
  content: React.ReactNode;
  description?: string;
}

export const Timeline = ({ data }: { data: TimelineEntry[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  const updateHeight = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  };

  useEffect(() => {
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  }, [ref]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 50%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div className="h-full w-full font-sans" ref={containerRef}>
      <div className="mx-auto px-4 md:px-8 lg:px-10">
        <h2 className="mb-2 max-w-xl text-lg font-bold text-black dark:text-white md:mb-4 md:text-4xl">
          Epic{" "}
          <span className="rounded-xl bg-indigo-600 px-2 text-white">
            Powers
          </span>{" "}
          for{" "}
          <span className="rounded-xl bg-amber-500 px-2 text-white">Epic</span>{" "}
          Educators{" "}
          <span className="relative">
            🎯
            <svg
              className="absolute -bottom-3 left-1/2 w-[90px] -translate-x-1/2 transform text-indigo-600 md:w-[180px]"
              height="20"
              viewBox="0 0 180 20"
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
          </span>
        </h2>
        <p className="max-w-lg text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 md:text-base">
          Everything you need to create magical learning moments. From AI
          automation to real-time competition, we've got your back!
        </p>
      </div>

      <div ref={ref} className="relative mx-auto">
        {data.map((item, index) => (
          <div
            key={index}
            className={`flex justify-start md:gap-10 ${index !== 0 ? "pt-10 md:pt-40" : "pt-5 md:pt-10"}`}
          >
            <div className="sticky top-40 z-40 flex max-w-xs flex-col items-center self-start md:w-full md:flex-row lg:max-w-xl">
              <div className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-black md:left-3">
                <div className="h-4 w-4 rounded-full border border-neutral-300 bg-neutral-200 p-2 dark:border-neutral-700 dark:bg-neutral-800" />
              </div>
              <div className="hidden flex-col md:flex">
                <h3 className="text-xl font-bold text-neutral-500 dark:text-neutral-500 md:pl-20 md:text-5xl">
                  {item.title}
                </h3>
                <p className="text-xs text-neutral-400 dark:text-neutral-400 md:pl-20 md:text-sm">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="relative w-full pl-20 pr-4 md:pl-4">
              <div className="mb-4 block md:hidden">
                <h3 className="text-left text-2xl font-bold text-neutral-500 dark:text-neutral-500">
                  {item.title}
                </h3>
                <p className="text-xs text-neutral-400 dark:text-neutral-400 md:pl-20 md:text-sm">
                  {item.description}
                </p>
              </div>
              {item.content}{" "}
            </div>
          </div>
        ))}
        <div
          style={{
            height: height + "px",
          }}
          className="absolute left-8 top-0 w-[2px] overflow-hidden bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent from-[0%] via-neutral-200 to-transparent to-[99%] [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)] dark:via-neutral-700 md:left-8"
        >
          <motion.div
            style={{
              height: heightTransform,
              opacity: opacityTransform,
            }}
            className="absolute inset-x-0 top-0 w-[2px] rounded-full bg-gradient-to-t from-amber-500 from-[0%] via-indigo-500 via-[30%] to-transparent"
          />
        </div>
      </div>
    </div>
  );
};
