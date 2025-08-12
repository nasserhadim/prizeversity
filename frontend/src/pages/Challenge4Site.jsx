import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Search, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../config/api';

const Challenge4Site = () => {
  const { uniqueId } = useParams();
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Auto-generate evidence when component loads
  useEffect(() => {
    const generateEvidence = async () => {
      try {
        await fetch(`${API_BASE}/api/challenges/challenge4/${uniqueId}/generate`, {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Failed to prepare challenge:', error);
      }
    };
    
    generateEvidence();
  }, [uniqueId]);

  const submitAnswer = async () => {
    if (!answer.trim()) {
      toast.error('Please enter the artist name from the image metadata');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE}/api/challenges/challenge4/${uniqueId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answer.trim() })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowSuccess(true);
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
      
    } catch (error) {
      toast.error('Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <Shield size={64} className="mx-auto text-green-600 animate-pulse" />
          <h1 className="text-4xl font-bold text-slate-900">FORENSICS INVESTIGATION COMPLETE</h1>
          <div className="bg-white border border-green-200 shadow-lg p-8 rounded-lg">
            <h2 className="text-2xl font-bold mb-4 text-green-700">CHALLENGE 4 COMPLETE</h2>
            <p className="mb-4 text-slate-700">Digital forensics and metadata analysis successful.</p>
            <div className="bg-green-50 border border-green-200 p-4 rounded mb-4">
              <p className="text-green-800 text-lg font-medium">
                🕵️ EXIF metadata successfully extracted and analyzed
              </p>
            </div>
            <p className="text-green-700 font-medium">All cyber challenge series completed!</p>
            <div className="mt-4 text-sm text-slate-500 bg-slate-50 p-3 rounded">
              <p>Evidence analyzed: Image metadata</p>
              <p>Investigation ID: {uniqueId.substring(0, 8)}</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.setItem('challengeCompleted', JSON.stringify({
                challengeIndex: 3,
                challengeName: "Digital Forensics Lab",
                timestamp: Date.now()
              }));
              window.close();
            }}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            RETURN TO BASE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="text-blue-600" size={24} />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Challenge 4: Digital Forensics Lab</h1>
              <p className="text-slate-600 text-sm">Image Metadata Analysis & OSINT Investigation</p>
            </div>
          </div>
          <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Evidence ID: {uniqueId.substring(0, 8)}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Mission Brief */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-slate-900">
            <Search className="text-blue-600" size={24} />
            Intelligence Briefing
          </h2>
          <div className="space-y-4">
            <p className="text-slate-700 leading-relaxed">
              Our sources have identified suspicious activity in a public repository related to WSU transit systems. 
              Intelligence suggests that evidence has been hidden in plain sight using steganographic techniques.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-2">🎯 Mission Objectives:</h3>
              <ul className="space-y-1 text-sm text-slate-700">
                <li>• Investigate the target repository</li>
                <li>• Locate suspicious digital artifacts</li>
                <li>• Perform forensic analysis on discovered evidence</li>
                <li>• Extract the hidden intelligence</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Repository Intelligence */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900">
            <ExternalLink className="text-purple-600" size={20} />
            Target Repository
          </h3>
          <div className="space-y-4">
            <p className="text-slate-700 leading-relaxed">
              Begin your investigation at the following location. Look for anything that seems out of place or recently added.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/cinnamonstic/wsu-transit-delay"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <ExternalLink size={16} />
                Investigate Repository
              </a>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                💡 <strong>OSINT Tip:</strong> Pay close attention to file modification dates and unexpected additions to the repository structure.
              </p>
            </div>
          </div>
        </div>

        {/* Answer Submission */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900">
            <Search className="text-green-600" size={20} />
            Submit Intelligence
          </h3>
          <div className="space-y-4">
            <p className="text-slate-700 leading-relaxed">
              Once you've located and analyzed the evidence, submit the extracted intelligence below.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Intelligence Report:
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    placeholder="Enter extracted intelligence..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={submitting}
                  />
                  <button
                    onClick={submitAnswer}
                    disabled={submitting || !answer.trim()}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Submitting...
                      </span>
                    ) : (
                      'Submit Report'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Investigation Guidelines */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold mb-4 text-slate-900">🔍 Investigation Guidelines</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3 text-slate-800">OSINT Methodology:</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">•</span>
                  Systematic repository enumeration
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">•</span>
                  File modification timeline analysis
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">•</span>
                  Digital artifact identification
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">•</span>
                  Metadata extraction techniques
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">•</span>
                  Evidence correlation and analysis
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-slate-800">Digital Forensics Tools:</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span>
                  Online metadata analyzers
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span>
                  Command-line forensics utilities
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span>
                  Browser developer tools
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span>
                  File system analysis
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span>
                  Hexadecimal editors
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Challenge4Site;
