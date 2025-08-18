export const getChallengeColors = (challengeIndex, isDark) => {
  const colorSchemes = [
    // Challenge 1 - Red theme
    {
      cardBg: isDark ? 'bg-red-900/20 border-red-700/50' : 'bg-red-50 border-red-200',
      completedBg: isDark ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200',
      textColor: isDark ? 'text-red-200' : 'text-red-800',
      completedText: isDark ? 'text-green-200' : 'text-green-800',
      sectionBg: isDark ? 'bg-red-800/20 border-red-600/30' : 'bg-white border-red-300'
    },
    // Challenge 2 - Blue theme
    {
      cardBg: isDark ? 'bg-blue-900/20 border-blue-700/50' : 'bg-blue-50 border-blue-200',
      completedBg: isDark ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200',
      textColor: isDark ? 'text-blue-200' : 'text-blue-800',
      completedText: isDark ? 'text-green-200' : 'text-green-800',
      sectionBg: isDark ? 'bg-blue-800/20 border-blue-600/30' : 'bg-white border-blue-300'
    },
    // Challenge 3 - Purple theme
    {
      cardBg: isDark ? 'bg-purple-900/20 border-purple-700/50' : 'bg-purple-50 border-purple-200',
      completedBg: isDark ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200',
      textColor: isDark ? 'text-purple-200' : 'text-purple-800',
      completedText: isDark ? 'text-green-200' : 'text-green-800',
      sectionBg: isDark ? 'bg-purple-800/20 border-purple-600/30' : 'bg-white border-purple-300'
    },
    // Challenge 4 - Orange theme
    {
      cardBg: isDark ? 'bg-orange-900/20 border-orange-700/50' : 'bg-orange-50 border-orange-200',
      completedBg: isDark ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200',
      textColor: isDark ? 'text-orange-200' : 'text-orange-800',
      completedText: isDark ? 'text-green-200' : 'text-green-800',
      sectionBg: isDark ? 'bg-orange-800/20 border-orange-600/30' : 'bg-white border-orange-300'
    },
    // Challenge 5 - Cyan theme
    {
      cardBg: isDark ? 'bg-cyan-900/20 border-cyan-700/50' : 'bg-cyan-50 border-cyan-200',
      completedBg: isDark ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200',
      textColor: isDark ? 'text-cyan-200' : 'text-cyan-800',
      completedText: isDark ? 'text-green-200' : 'text-green-800',
      sectionBg: isDark ? 'bg-cyan-800/20 border-cyan-600/30' : 'bg-white border-cyan-300'
    }
  ];
  
  return colorSchemes[challengeIndex] || colorSchemes[0];
};

export const getThemeClasses = (isDark) => ({
  cardBase: `card ${isDark ? 'bg-base-200' : 'bg-base-100'} border ${isDark ? 'border-base-700' : 'border-base-200'} shadow-md rounded-2xl p-6`,
  mutedText: isDark ? 'text-base-content/70' : 'text-gray-600',
  sectionBg: isDark ? 'bg-base-300 border border-base-700' : 'bg-white border border-base-200',
  codeRed: isDark ? 'bg-red-900/30 text-red-200' : 'bg-red-100 text-red-700',
  codeBlue: isDark ? 'bg-blue-900/25 text-blue-200' : 'bg-blue-100 text-blue-800',
  infoAlert: isDark ? 'alert alert-info bg-blue-900/18 text-blue-200' : 'alert alert-info',
  warningAlert: isDark ? 'alert bg-orange-900/20 border border-orange-700/50 text-orange-200' : 'alert alert-warning'
});
