import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { App as CapacitorApp } from '@capacitor/app'; // Add this import
import { router } from "./routes"; 
import "./index.css";

function App() {
  useEffect(() => {
    CapacitorApp.addListener('appUrlOpen', (event) => {
      console.log("📱 Raw URL:", event.url);
      
      try {
        // Extract board ID from URL
        const match = event.url.match(/\/board\/([a-zA-Z0-9\-]+)/);
        if (match) {
          const boardId = match[1];
          console.log("📱 Board ID from deep link:", boardId);
          
          // Store it BEFORE navigating so BoardPage reads it correctly
          sessionStorage.setItem("edxly-deeplink-board", boardId);
          
          router.navigate(`/board/${boardId}`, { replace: true });
        }
      } catch (e) {
        console.error("Deep link error:", e);
      }
    });

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, []);

  return <RouterProvider router={router} />;
}

export default App;