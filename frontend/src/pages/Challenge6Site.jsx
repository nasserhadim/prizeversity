import { useState } from 'react';
import { useParams } from 'react-router-dom';

const Challenge6Site = () => {
  const { uniqueId } = useParams();
  const [input, setInput] = useState('');

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="text-center space-y-8 max-w-md w-full px-4">
        <h1 className="text-2xl font-mono text-gray-400 tracking-widest">
          SECTOR_{uniqueId?.substring(0, 8)?.toUpperCase()}
        </h1>
        
        <div className="space-y-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-transparent border border-gray-600 text-gray-300 px-4 py-3 font-mono text-center focus:outline-none focus:border-gray-500 transition-colors"
            placeholder="..."
          />
        </div>
      </div>
    </div>
  );
};

export default Challenge6Site;
