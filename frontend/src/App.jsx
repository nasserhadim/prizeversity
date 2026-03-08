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
import Challenge5Site from './pages/Challenge5Site';
import Challenge6Site from './pages/Challenge6Site';
import Challenge7Site from './pages/Challenge7Site';
import Support from './pages/Support';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import AdminModeration from './pages/AdminModeration';
import ReviewsPage from './pages/ReviewsPage';
import NotFound from './pages/NotFound';
import Badges from './pages/Badges';
import ClassroomLayout from './components/ClassroomLayout';
import IntegrationSettings from './pages/IntegrationSettings';
import IntegrationDocs from './pages/IntegrationDocs';

const App = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const showStaticNavbar = ['/', '/support', '/privacy', '/terms', '/feedback', '/reviews'].includes(location.pathname);

  // When the user is set, join their notification room
  useEffect(() => {
    if (user && user._id) {
      joinUserRoom(user._id);
    }
  }, [user]);

  return (
    <CartProvider>
      <div style={{ paddingTop: user ? '5rem' : '4rem' }}>
        {user ? <Navbar /> : showStaticNavbar && <Navbar />}
        <Routes>
          {/* Challenge pages */}
          <Route path="/challenge-site/:uniqueId" element={<ChallengeSite />} />
          <Route path="/challenge-2-site/:uniqueId" element={<Challenge2Site />} />
          <Route path="/challenge-3-site/:uniqueId" element={<Challenge3Site />} />
          <Route path="/challenge-4-site/:uniqueId" element={<Challenge4Site />} />
          <Route path="/challenge-5-site/:uniqueId" element={<Challenge5Site />} />
          <Route path="/challenge-6-site/:uniqueId" element={<Challenge6Site />} />
          <Route path="/challenge-7-site/:uniqueId" element={<Challenge7Site />} />

          {/* Main app */}
          <Route path="/" element={<Home />} />
          <Route path="/admin/moderation" element={<AdminModeration />} />
          <Route path="/classrooms" element={<ClassroomPage />} />
          <Route path="/classrooms/archived" element={<ArchivedClassrooms />} />

          {/* All classroom routes wrapped in layout for session activity tracking */}
          <Route path="/classroom" element={<ClassroomLayout />}>
            <Route path=":id" element={<Classroom />} />
            <Route path=":classroomId/bazaar" element={<Bazaar />} />
            <Route path=":id/news" element={<StudentNewsfeed />} />
            <Route path=":id/teacher-news" element={<TeacherNewsfeed />} />
            <Route path=":id/settings" element={<ClassroomSettings />} />
            <Route path=":id/wallet" element={<Wallet />} />
            <Route path=":id/groups" element={<Groups />} />
            <Route path=":id/people" element={<People />} />
            <Route path=":classId/leaderboard" element={<Leaderboard />} />
            <Route path=":classroomId/challenge" element={<Challenge />} />
            <Route path=":classroomId/badges" element={<Badges />} />
            <Route path=":classroomId/profile/:id" element={<Profile />} />
            <Route path=":classroomId/checkout" element={<Checkout />} />
            <Route path=":classroomId/student/:id/stats" element={<StudentStats />} />
            <Route path=":classroomId/feedback" element={<ClassroomFeedbackPage />} />
          </Route>

          {/* General (non-classroom) routes */}
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/support" element={<Support />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/integrations" element={<IntegrationSettings />} />
          <Route path="/integrations/docs" element={<IntegrationDocs />} />
          {/* Wildcard / catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </CartProvider>
  );
};

export default App;
