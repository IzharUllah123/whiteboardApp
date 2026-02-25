import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Copy, Link2, Users, Check, X } from "lucide-react"; // Added X icon

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareLink: string;
  userName?: string;
  onNameChange?: (newName: string) => void;
}

export const ShareModal = ({ 
  isOpen, 
  onClose, 
  shareLink, 
  userName = "",
  onNameChange 
}: ShareModalProps) => {
  const [hostName, setHostName] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && userName) {
      setHostName(userName);
    }
  }, [isOpen, userName]);

  const copyCurrentBoardLink = async () => {
    if (!hostName.trim()) {
      alert("Please enter your name as Host");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      if (onNameChange && hostName.trim() !== userName) {
        onNameChange(hostName.trim());
      }
      
      localStorage.setItem('edxly-host-name', hostName.trim());
    } catch (error) {
      console.error("Failed to copy link:", error);
      alert("Failed to copy link. Please try again.");
    }
  };

  const handleClose = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      {/* <DialogContent className="sm:max-w-lg bg-white rounded-2xl border-0 shadow-2xl p-4 relative"> */}
   <DialogContent className="sm:max-w-lg bg-white rounded-2xl border-0 shadow-2xl p-6 relative fixed left-[50%] top-[55%] translate-x-[-50%] translate-y-[-50%]">
        <DialogHeader className="text-center space-y-4">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-blue-600 mb-2">EDXLY</h3>
            <p className="text-sm text-gray-600">Collaborative Drawing Board</p>
          </div>

          <div className="flex items-center justify-center gap-3 mb-4">
            <Link2 className="h-8 w-8 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-800">Share This Board</h2>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Host Name (Editable)</label>
            <Input
              placeholder="Enter your name as Host"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="h-12 text-base border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500"
              maxLength={50}
              autoFocus
            />
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-medium text-blue-900">Current Board Link</h4>
            </div>
            <div className="flex gap-2">
              <Input
                value={shareLink}
                readOnly
                className="h-10 text-sm border-blue-300 rounded bg-white font-mono text-gray-700"
              />
            </div>
          </div>

          {/* Copy Button */}
          <Button
            onClick={copyCurrentBoardLink}
            disabled={!hostName.trim()}
            className={`w-full h-12 font-medium text-base rounded-lg transition-all ${
              copied ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
            } text-white disabled:opacity-50`}
          >
            {copied ? (
              <><Check className="h-4 w-4 mr-2" />Copied!</>
            ) : (
              <><Copy className="h-4 w-4 mr-2" />Copy Board Link</>
            )}
          </Button>


          {/* Info Section */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg mt-6">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 leading-relaxed">
                <p className="font-medium mb-1">How sharing works:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>You are the Host and control this board</li>
                  <li>Guests can join via the shared link</li>
                  <li>Real-time collaboration with live sync</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}