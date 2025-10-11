import { Button } from "@/components/ui/button";

interface LobbyProps {
  onLeave: () => void;
}

export default function Lobby({ onLeave }: LobbyProps) {
  return (
    <div className="flex h-[calc(100%-5rem)] flex-col items-center justify-center">
      <h1 className="mb-5 text-7xl font-bold uppercase text-indigo-800 md:text-9xl">
        Game Lobby
      </h1>
      <div className="w-full max-w-md space-y-4">
        <div className="text-center text-gray-500">
          Waiting for the game to start...
        </div>
      </div>
      <Button className="mt-8" onClick={onLeave} variant="destructive">
        Leave Game
      </Button>
    </div>
  );
}
