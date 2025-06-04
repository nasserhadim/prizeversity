import React, { useEffect, useContext } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Classroom from './pages/Classroom';
import Bazaar from './pages/Bazaar';
import Wallet from './pages/Wallet';
import Groups from './pages/Groups';
import People from './pages/People';
import NotificationBell from './components/NotificationBell';
import Navbar from './components/Navbar';
import { AuthContext } from './context/AuthContext';
import { joinUserRoom } from './utils/socket';

import ClassroomPage from './pages/ClassroomPage';

const App = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  // When the user is set, join their notification room
  useEffect(() => {
    if (user && user._id) {
      joinUserRoom(user._id);
    }
  }, [user]);

  return (
    // Added the navigation bar and notification bell in App.jsx 
    // This way we removed redundancy to call it in each page.
    // This method will prevent for navigation and the bell to show in the login page (meaning without a user being logged in)
    <div>
      {user && <Navbar />}
      {user && <NotificationBell />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/classrooms" element={<ClassroomPage />} />
        <Route path="/classroom/:id" element={<Classroom />} />
        <Route path="/classroom/:id/bazaar" element={<Bazaar />} />
        <Route path="/classroom/:id/wallet" element={<Wallet />} />
        <Route path="/classroom/:id/groups" element={<Groups />} />
        <Route path="/classroom/:id/people" element={<People />} />
      </Routes>
    </div>
  );
};

export default App;