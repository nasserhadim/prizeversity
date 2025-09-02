import { useState } from 'react';
import { DEFAULT_CHALLENGE_CONFIG } from '../constants/challengeConstants';

export const useChallengeConfig = () => {
  const [challengeConfig, setChallengeConfig] = useState(DEFAULT_CHALLENGE_CONFIG);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configuring, setConfiguring] = useState(false);

  const updateChallengeConfig = (updates) => {
    setChallengeConfig(prev => ({ ...prev, ...updates }));
  };

  const resetChallengeConfig = () => {
    setChallengeConfig(DEFAULT_CHALLENGE_CONFIG);
  };

  return {
    challengeConfig,
    setChallengeConfig,
    updateChallengeConfig,
    resetChallengeConfig,
    showConfigModal,
    setShowConfigModal,
    configuring,
    setConfiguring
  };
};
