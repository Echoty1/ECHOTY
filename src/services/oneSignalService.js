// src/App.js
import React, { useEffect } from 'react';
import { useAuth } from './hooks/useAuth'; // Adjust path if needed
import { initOneSignal } from './services/oneSignalService';

function App() {
  const { user } = useAuth(); // Assuming you have a user object from your auth context

  useEffect(() => {
    if (user?.uid) {
      // Call the init function we created in Step 2
      initOneSignal(user.uid);
    }
  }, [user?.uid]);

  return (
    // ... your existing app routes/components ...
    <div>Your App Code</div>
  );
}

export default App;
