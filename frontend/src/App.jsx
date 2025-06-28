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
import Profile from './pages/Profile';
import { AuthContext } from './context/AuthContext';
import { joinUserRoom } from './utils/socket';
import Leaderboard from './pages/Leaderboard';
import Settings from './pages/Settings';
import { CartProvider } from './context/CartContext';
import Checkout from './pages/Checkout';
import OrderHistory from './pages/OrderHistory';
import ClassroomPage from './pages/ClassroomPage';
import TeacherNewsfeed from './pages/TeacherNewsfeed';
import StudentNewsfeed from './pages/StudentNewsfeed';

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
    <CartProvider>
      <div style={{ paddingTop: '5rem' }}>
        {user && <Navbar />}
        {user && <NotificationBell />}

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/classrooms" element={<ClassroomPage />} />
          <Route path="/classroom/:id" element={<Classroom />} />
          <Route path="/classroom/:classroomId/bazaar" element={<Bazaar />} />
          <Route path="/classroom/:id/news" element={<StudentNewsfeed />} />
          <Route path="/classroom/:id/teacher-news" element={<TeacherNewsfeed />} />
          <Route path="/classroom/:id/wallet" element={<Wallet />} />
          <Route path="/classroom/:id/groups" element={<Groups />} />
          <Route path="/classroom/:id/people" element={<People />} />
          <Route path="/classroom/:classId/leaderboard" element={<Leaderboard />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/classroom/:classroomId/checkout" element={<Checkout />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<OrderHistory />} />
        </Routes>
      </div>
    </CartProvider>
  );
};


export default App;