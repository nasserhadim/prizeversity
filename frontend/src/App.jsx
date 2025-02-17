import React, { useEffect, useContext } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Classroom from './pages/Classroom';
import Bazaar from './pages/Bazaar';
import Wallet from './pages/Wallet';
import Groups from './pages/Groups';
import NotificationBell from './components/NotificationBell';
import { useAuth, AuthContext } from './context/AuthContext';
import { joinUserRoom } from './utils/socket';

const App = () => {
  const { user } = useContext(AuthContext);

  // When the user is set, join the user's notification room.
  useEffect(() => {
    if (user && user._id) {
      joinUserRoom(user._id);
    }
  }, [user]);

  return (
    <div>
      {user && <NotificationBell />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/classroom/:id" element={<Classroom />} />
        <Route path="/bazaar" element={<Bazaar />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/groups" element={<Groups />} />
      </Routes>
    </div>
  );
};

export default App;