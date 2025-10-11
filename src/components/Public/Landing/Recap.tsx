import CallToActionButtons from "./CallToActionButtons";

export default function Recap() {
  return (
    <div className="-mx-6 w-screen px-6 py-24 md:-mx-12 md:px-12 lg:-mx-16 lg:px-16">
      <div className="mx-auto space-y-6 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 py-12 text-white shadow-2xl md:py-16">
        <div className="flex items-center justify-center gap-3 md:gap-4">
          <div className="rounded-full border-2 border-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white md:px-4">
            Play
          </div>
          <div className="rounded-xl border-2 border-white bg-white px-4 py-1 font-black tracking-tight text-indigo-600 shadow-[0px_4px_0px_#c7d2fe] md:px-6">
            Quiz Royale
          </div>
          <div className="rounded-full border-2 border-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white md:px-4">
            Win
          </div>
        </div>
        <h1 className="text-center text-4xl font-bold leading-tight md:text-7xl">
          <span className="flex items-center justify-center gap-2 text-white">
            <img src="/flower.png" className="w-8 md:w-10" />
            Ready to Transform
            <img src="/flower.png" className="w-8 md:w-10" />
          </span>
          <span className="relative z-20 bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
            Your Classroom?
          </span>
        </h1>
        <p className="mx-auto max-w-xl px-4 text-center text-sm leading-relaxed text-indigo-100 md:text-base">
          Join thousands of educators making learning legendary. Start creating
          epic quizzes today!
        </p>
        <CallToActionButtons
          align="center"
          firstButtonNavLink="NavLink"
          firstButtonText="Sign up"
          firstButtonTo="/signup"
          secondButtonText="Login"
          secondButtonTo="/login"
        />
      </div>
    </div>
  );
}
