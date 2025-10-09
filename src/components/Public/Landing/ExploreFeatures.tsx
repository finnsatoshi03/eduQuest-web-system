import { Timeline } from "@/components/Shared/timeline";

const data = [
  {
    title: "⚡ AI Quiz Generator",
    description:
      "Drop any PDF, and boom! Our AI creates custom quizzes in seconds. No more late-night question writing—just upload and go!",
    content: (
      <video
        autoPlay
        muted
        loop
        className="rounded-3xl border-8 border-indigo-600"
      >
        <source src="/videos/snippet-1.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    ),
  },
  {
    title: "🎯 Multiple Game Modes",
    description:
      "True/False, Multiple Choice, Matching—you name it! Mix and match question types to keep things fresh and exciting for every learning style.",
    content: (
      <video
        autoPlay
        muted
        loop
        className="rounded-3xl border-8 border-teal-600"
      >
        <source src="/videos/snippet-2.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    ),
  },
  {
    title: "🎮 Level-Up Learning",
    description:
      "Turn boring tests into epic challenges! Points, power-ups, and instant feedback make every answer feel like a win.",
    content: (
      <video
        autoPlay
        muted
        loop
        className="rounded-3xl border-8 border-amber-500"
      >
        <source src="/videos/snippet-3.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    ),
  },
  {
    title: "🏆 Live Leaderboards",
    description:
      "Watch the competition heat up! Real-time rankings fuel friendly rivalry and push students to level up their game.",
    content: (
      <video
        autoPlay
        muted
        loop
        className="rounded-3xl border-8 border-violet-600"
      >
        <source src="/videos/snippet-4.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    ),
  },
  {
    title: "✨ Pixel-Perfect Design",
    description:
      "Retro-cool meets modern UI. A gaming-inspired interface that's so fun to use, both teachers and students will love every click!",
    content: <p>Content Here</p>,
  },
];

export default function ExploreFeatures() {
  return (
    <div
      id="explore"
      className="-mx-6 w-screen px-6 py-24 md:-mx-12 md:px-12 lg:-mx-16 lg:px-16"
    >
      <Timeline data={data} />
    </div>
  );
}
