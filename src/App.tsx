import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { App as CapacitorApp } from '@capacitor/app'; // Add this import
import { router } from "./routes"; 
import "./index.css";

function App() {
  useEffect(() => {
    CapacitorApp.addListener('appUrlOpen', (event) => {
      console.log('Raw URL received:', event.url); // ADD THIS TO DEBUG
      
      try {
        const url = new URL(event.url);
        let path = url.pathname + url.search;
        
        // Handle custom scheme: myapp://yourdomain.com/board/123
        // In this case pathname starts with the domain
        if (path.startsWith('/yourdomain.com') || !path.startsWith('/board/')) {
          // Extract just the path portion after the domain
          const match = event.url.match(/\/board\/[^?#]+/);
          if (match) {
            path = match[0] + url.search;
          }
        }

        console.log('Navigating to path:', path); // ADD THIS TO DEBUG

        if (path && path.includes('/board/')) {
          // Use replace:true to force component remount
          router.navigate(path, { replace: true });
        }
      } catch (e) {
        console.error('Failed to parse deep link URL:', e);
      }
    });

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, []);

  return <RouterProvider router={router} />;
}

export default App;