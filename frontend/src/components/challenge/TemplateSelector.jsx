import { useState, useEffect, useContext } from 'react';
import { Lock, Key, Hash, EyeOff, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';

const TEMPLATE_METADATA = {
  'passcode': {
    name: 'Static Passcode',
    description: 'Students enter a teacher-defined passcode.',
    icon: Key,
    options: {}
  },
  'cipher': {
    name: 'Cipher Decoder',
    description: 'Decrypt an encrypted message.',
    icon: Lock,
    options: {
      cipherType: {
        label: 'Cipher Type',
        type: 'select',
        options: [
          { value: 'caesar', label: 'Caesar Cipher' },
          { value: 'base64', label: 'Base64 Encoding' },
          { value: 'rot13', label: 'ROT13' },
          { value: 'atbash', label: 'Atbash' },
          { value: 'vigenere', label: 'Vigenère Cipher' }
        ],
        default: 'caesar'
      },
      difficulty: {
        label: 'Difficulty',
        type: 'select',
        options: [
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' }
        ],
        default: 'medium'
      }
    }
  },
  'hash': {
    name: 'Hash Cracker',
    description: 'Crack a hash to find the original code.',
    icon: Hash,
    options: {
      hashAlgorithm: {
        label: 'Hash Algorithm',
        type: 'select',
        options: [
          { value: 'md5', label: 'MD5' },
          { value: 'sha256', label: 'SHA-256' }
        ],
        default: 'md5'
      },
      difficulty: {
        label: 'Difficulty',
        type: 'select',
        options: [
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' }
        ],
        default: 'medium'
      }
    }
  },
  'hidden-message': {
    name: 'Hidden Message',
    description: 'Find hidden data in file metadata.',
    icon: EyeOff,
    options: {
      embedMethod: {
        label: 'Hiding Method',
        type: 'select',
        options: [
          { value: 'exif', label: 'Image EXIF Metadata' },
          { value: 'filename', label: 'Encoded Filename' }
        ],
        default: 'exif'
      }
    }
  },
  'pattern-find': {
    name: 'Pattern Finder',
    description: 'Find a hidden pattern in generated text.',
    icon: Search,
    options: {
      patternLength: {
        label: 'Pattern Length',
        type: 'number',
        min: 4,
        max: 12,
        default: 6
      },
      noiseLevel: {
        label: 'Noise Level',
        type: 'select',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' }
        ],
        default: 'medium'
      }
    }
  }
};

const TemplateSelector = ({ 
  selectedType = 'passcode', 
  templateConfig = {}, 
  onChange,
  disabled = false 
}) => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState(templateConfig);

  useEffect(() => {
    setConfig(templateConfig);
  }, [templateConfig]);

  const handleTypeChange = (type) => {
    const template = TEMPLATE_METADATA[type];
    const defaultConfig = {};
    
    if (template?.options) {
      Object.entries(template.options).forEach(([key, opt]) => {
        if (opt.default !== undefined) {
          defaultConfig[key] = opt.default;
        }
      });
    }
    
    setConfig(defaultConfig);
    onChange(type, defaultConfig);
  };

  const handleConfigChange = (key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onChange(selectedType, newConfig);
  };

  const selectedTemplate = TEMPLATE_METADATA[selectedType] || TEMPLATE_METADATA.passcode;
  const Icon = selectedTemplate.icon;

  const renderConfigOption = (key, optionConfig) => {
    if (optionConfig.showWhen) {
      const [conditionKey, conditionValue] = Object.entries(optionConfig.showWhen)[0];
      if (config[conditionKey] !== conditionValue) {
        return null;
      }
    }

    const value = config[key] !== undefined ? config[key] : optionConfig.default;

    switch (optionConfig.type) {
      case 'select':
        return (
          <div key={key} className="form-control">
            <label className="label">
              <span className="label-text">{optionConfig.label}</span>
            </label>
            <select
              className="select select-bordered select-sm"
              value={value}
              onChange={(e) => handleConfigChange(key, e.target.value)}
              disabled={disabled}
            >
              {optionConfig.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );

      case 'number':
        return (
          <div key={key} className="form-control">
            <label className="label">
              <span className="label-text">{optionConfig.label}</span>
            </label>
            <input
              type="number"
              className="input input-bordered input-sm"
              value={value}
              onChange={(e) => handleConfigChange(key, parseInt(e.target.value))}
              min={optionConfig.min}
              max={optionConfig.max}
              disabled={disabled}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={key} className="form-control">
            <label className="label">
              <span className="label-text">{optionConfig.label}</span>
            </label>
            <textarea
              className="textarea textarea-bordered textarea-sm h-24"
              value={Array.isArray(value) ? value.join('\n') : (value || '')}
              onChange={(e) => handleConfigChange(key, e.target.value.split('\n').filter(w => w.trim()))}
              placeholder={optionConfig.placeholder}
              disabled={disabled}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="label">
          <span className="label-text font-medium">Challenge Type</span>
        </label>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="btn btn-ghost btn-xs gap-1"
        >
          {expanded ? 'Collapse' : 'Expand Options'}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      <div className={`grid gap-2 ${expanded ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {Object.entries(TEMPLATE_METADATA).map(([type, meta]) => {
          const TypeIcon = meta.icon;
          const isSelected = selectedType === type;
          
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              disabled={disabled}
              className={`
                flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left
                ${isSelected 
                  ? 'border-primary bg-primary/10' 
                  : isDark 
                    ? 'border-base-content/20 hover:border-base-content/40' 
                    : 'border-gray-200 hover:border-gray-400'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className={`p-1.5 rounded ${isSelected ? 'bg-primary/20' : isDark ? 'bg-base-content/10' : 'bg-gray-100'}`}>
                <TypeIcon className={`w-4 h-4 ${isSelected ? 'text-primary' : ''}`} />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : ''}`}>
                  {meta.name}
                </span>
                {expanded && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{meta.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedTemplate && Object.keys(selectedTemplate.options).length > 0 && (
        <div className={`p-3 rounded-lg space-y-3 ${isDark ? 'bg-base-300' : 'bg-gray-50'}`}>
          <div className="text-sm font-medium">{selectedTemplate.name} Options</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(selectedTemplate.options).map(([key, optConfig]) => 
              renderConfigOption(key, optConfig)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;
