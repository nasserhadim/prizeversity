import React, { useEffect, useContext } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Classroom from './pages/Classroom';
import Bazaar from './pages/Bazaar';
import Wallet from './pages/Wallet';
import Groups from './pages/Groups';
import People from './pages/People';
import Navbar from './components/Navbar';
import Profile from './pages/Profile';
import FeedbackPage from './pages/FeedbackPage';
import ClassroomFeedbackPage from './pages/ClassroomFeedbackPage';
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
import ClassroomSettings from './pages/ClassroomSettings';
import StudentStats from './pages/StudentStats';
import ArchivedClassrooms from './pages/ArchivedClassrooms';
import Challenge from './pages/Challenge';
import ChallengeSite from './pages/ChallengeSite';
import Challenge2Site from './pages/Challenge2Site';
import Challenge3Site from './pages/Challenge3Site';
import Challenge4Site from './pages/Challenge4Site';
import Support from './pages/Support';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';

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
    <Routes>
      <Route path="/challenge-site/:uniqueId" element={<ChallengeSite />} />
      <Route path="/challenge-2-site/:uniqueId" element={<Challenge2Site />} />
      <Route path="/challenge-3-site/:uniqueId" element={<Challenge3Site />} />
      <Route path="/challenge-4-site/:uniqueId" element={<Challenge4Site />} />
      <Route path="/*" element={
        <CartProvider>
          <div style={{ paddingTop: '5rem' }}>
            {user && <Navbar />}
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/classrooms" element={<ClassroomPage />} />
              <Route path="/classrooms/archived" element={<ArchivedClassrooms />} />
              <Route path="/classroom/:id" element={<Classroom />} />
              <Route path="/classroom/:classroomId/bazaar" element={<Bazaar />} />
              <Route path="/classroom/:id/news" element={<StudentNewsfeed />} />
              <Route path="/classroom/:id/teacher-news" element={<TeacherNewsfeed />} />
              <Route path="/classroom/:id/settings" element={<ClassroomSettings />} />
              <Route path="/classroom/:id/wallet" element={<Wallet />} />
              <Route path="/classroom/:id/groups" element={<Groups />} />
              <Route path="/classroom/:id/people" element={<People />} />
              <Route path="/classroom/:classId/leaderboard" element={<Leaderboard />} />
              <Route path="/classroom/:classroomId/challenge" element={<Challenge />} />
              <Route path="/profile/:id" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/classroom/:classroomId/checkout" element={<Checkout />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<OrderHistory />} />
              <Route path="/classroom/:classroomId/student/:id/stats" element={<StudentStats />} />
              <Route path="/classroom/:classroomId/feedback" element={<ClassroomFeedbackPage />} />
              <Route path="/feedback" element={<FeedbackPage />} />
              <Route path="/support" element={<Support />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
            </Routes>
          </div>
        </CartProvider>
      } />
    </Routes>
  );
};

export default App;