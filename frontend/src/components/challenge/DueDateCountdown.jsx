import { useEffect, useState } from 'react';

const DueDateCountdown = ({ dueDate }) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const due = new Date(dueDate);
      const diff = due - now;
      
      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m remaining`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeRemaining(`${minutes}m remaining`);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); 
    
    return () => clearInterval(interval);
  }, [dueDate]);
  
  return (
    <p className="text-sm mt-1 font-medium">
      {timeRemaining}
    </p>
  );
};

export default DueDateCountdown;
