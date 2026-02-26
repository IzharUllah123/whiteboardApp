
// src/pages/index.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PenLine, Users, ArrowRight, Link as LinkIcon } from "lucide-react";

const extractBoardId = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/board\/([a-zA-Z0-9\-]+)/);
    if (match) return match[1];
  } catch {
    if (trimmed.match(/^[a-zA-Z0-9\-]{8,}$/)) return trimmed;
  }
  return null;
};

export default function Index() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState(
    localStorage.getItem("edxly-host-name") || ""
  );
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState("");

  const handleNewBoard = () => {
    if (!userName.trim()) {
      alert("Please enter your name first.");
      return;
    }
    const boardId = crypto.randomUUID();
    localStorage.setItem("edxly-host-name", userName.trim());
    navigate(`/board/${boardId}`, {
      state: { isHost: true, userName: userName.trim() },
    });
  };

  const handleJoinBoard = () => {
    const boardId = extractBoardId(joinInput);
    if (!boardId) {
      setJoinError("Please paste a valid board link or ID.");
      return;
    }
    setJoinError("");
    navigate(`/board/${boardId}`, { state: { isHost: false } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <PenLine className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Edxly</h1>
        </div>
        <p className="text-slate-400 text-lg">Real-time collaborative whiteboard</p>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Create New Board */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <PenLine className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-white font-semibold text-lg">New Board</h2>
          </div>
          <div className="space-y-3">
            <Input
              placeholder="Your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNewBoard()}
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-blue-400 h-11"
              maxLength={50}
              autoFocus
            />
            <Button
              onClick={handleNewBoard}
              className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl"
            >
              Create Board <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-slate-500 text-sm">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Join Existing Board */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-white font-semibold text-lg">Join Board</h2>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Paste board link or ID"
                value={joinInput}
                onChange={(e) => { setJoinInput(e.target.value); setJoinError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinBoard()}
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-emerald-400 h-11 pl-10"
              />
            </div>
            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
            <Button
              onClick={handleJoinBoard}
              variant="outline"
              className="w-full h-11 border-white/20 text-white hover:bg-white/10 hover:text-white font-medium rounded-xl bg-transparent"
            >
              Join Board <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-12 text-slate-600 text-sm">
        Share the board link with anyone to collaborate instantly
      </p>
    </div>
  );
}