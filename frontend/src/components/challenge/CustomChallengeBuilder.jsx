import { useState, useEffect, useContext, useRef } from 'react';
import { Plus, Trash2, GripVertical, ExternalLink, Paperclip, X, Eye, EyeOff, ChevronDown, ChevronUp, Shield, AlertTriangle } from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';
import { 
  createCustomChallenge, 
  updateCustomChallenge, 
  deleteCustomChallenge,
  uploadCustomChallengeAttachment,
  deleteCustomChallengeAttachment,
  getCustomChallengeAttachmentUrl
} from '../../API/apiChallenge';
import TemplateSelector from './TemplateSelector';
import toast from 'react-hot-toast';

const CustomChallengeBuilder = ({ 
  classroomId, 
  customChallenges = [], 
  onUpdate,
  isActive = false,
  allowAddBeforeActive = false,  // New prop to allow adding during config
  onFileSelectionChange  // Callback to notify parent when file selection starts/ends
}) => {
  const canAdd = isActive || allowAddBeforeActive;
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  
  const [challenges, setChallenges] = useState(customChallenges);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSolution, setShowSolution] = useState({});
  const [expandedCards, setExpandedCards] = useState({});
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    externalUrl: '',
    solution: '',
    maxAttempts: '',
    hintsEnabled: false,
    hints: ['', ''],
    bits: 50,
    multiplier: 1.0,
    luck: 1.0,
    discount: 0,
    shield: false,
    visible: true,
    templateType: 'passcode',
    templateConfig: {}
  });
  
  // Pending attachments for new challenges (not yet created)
  const [pendingAttachments, setPendingAttachments] = useState([]);
  
  // Track file selection to prevent modal closing
  const fileInputRef = useRef(null);
  const isSelectingFileRef = useRef(false);

  useEffect(() => {
    setChallenges(customChallenges);
  }, [customChallenges]);
  
  // Track window blur/focus to detect file dialog open/close
  useEffect(() => {
    if (!isSelectingFileRef.current) return;
    
    const handleWindowBlur = () => {
      // Window lost focus - file dialog likely opened
      // Keep file selection active
      if (onFileSelectionChange) {
        onFileSelectionChange(true);
      }
    };
    
    const handleWindowFocus = () => {
      // Window regained focus - file dialog likely closed
      // Wait longer to see if file was selected
      setTimeout(() => {
        if (fileInputRef.current && !fileInputRef.current.files?.length) {
          // No file selected, clear flag
          isSelectingFileRef.current = false;
          if (onFileSelectionChange) {
            onFileSelectionChange(false);
          }
        }
      }, 500);
    };
    
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [onFileSelectionChange]);

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      externalUrl: '',
      solution: '',
      maxAttempts: '',
      hintsEnabled: false,
      hints: ['', ''],
      bits: 50,
      multiplier: 1.0,
      luck: 1.0,
      discount: 0,
      shield: false,
      visible: true,
      templateType: 'passcode',
      templateConfig: {}
    });
    setPendingAttachments([]);
    setEditingId(null);
    setShowForm(false);
  };
  
  // Handle adding pending attachment during creation
  const handleAddPendingAttachment = (e) => {
    const file = e.target.files?.[0];
    isSelectingFileRef.current = false; // Clear flag when file selected
    
    // Notify parent that file selection is complete
    if (onFileSelectionChange) {
      // Delay to ensure file dialog has fully closed and window has regained focus
      setTimeout(() => {
        onFileSelectionChange(false);
      }, 500);
    }
    
    if (!file) {
      // No file selected - clear immediately
      if (onFileSelectionChange) {
        onFileSelectionChange(false);
      }
      return;
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File size must be under 10MB');
      return;
    }
    
    if (pendingAttachments.length >= 5) {
      toast.error('Maximum 5 attachments allowed');
      return;
    }
    
    setPendingAttachments(prev => [...prev, file]);
    e.target.value = ''; // Reset input
  };
  
  // Handle file input click - prevent modal from closing
  const handleFileInputClick = (e) => {
    e.stopPropagation();
    isSelectingFileRef.current = true;
    if (onFileSelectionChange) {
      onFileSelectionChange(true);
    }
  };
  
  // Handle file input focus/blur
  const handleFileInputFocus = () => {
    isSelectingFileRef.current = true;
    if (onFileSelectionChange) {
      onFileSelectionChange(true);
    }
  };
  
  const handleFileInputBlur = () => {
    // Don't clear immediately - file dialog causes blur
    // Clear after a longer delay to allow file dialog to open and close
    setTimeout(() => {
      // Only clear if file wasn't selected (input still empty)
      if (!fileInputRef.current?.files?.length) {
        isSelectingFileRef.current = false;
        if (onFileSelectionChange) {
          onFileSelectionChange(false);
        }
      }
    }, 1000); // Increased delay to account for file dialog
  };
  
  // Remove pending attachment
  const handleRemovePendingAttachment = (index) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleEdit = (challenge) => {
    setForm({
      title: challenge.title || '',
      description: challenge.description || '',
      externalUrl: challenge.externalUrl || '',
      solution: '',
      maxAttempts: challenge.maxAttempts || '',
      hintsEnabled: challenge.hintsEnabled || false,
      hints: challenge.hints?.length ? [...challenge.hints] : ['', ''],
      bits: challenge.bits || 50,
      multiplier: challenge.multiplier || 1.0,
      luck: challenge.luck || 1.0,
      discount: challenge.discount || 0,
      shield: challenge.shield || false,
      visible: challenge.visible !== false,
      templateType: challenge.templateType || 'passcode',
      templateConfig: challenge.templateConfig || {}
    });
    setEditingId(challenge._id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    const isTemplateChallenge = form.templateType && form.templateType !== 'passcode';

    // Only require solution for passcode-type challenges (and only on create)
    if (!isTemplateChallenge && !editingId && !form.solution.trim()) {
      toast.error('Solution passcode is required for passcode challenges');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        externalUrl: form.externalUrl.trim(),
        maxAttempts: form.maxAttempts ? parseInt(form.maxAttempts) : null,
        hintsEnabled: form.hintsEnabled,
        hints: form.hints.filter(h => h.trim()),
        bits: parseInt(form.bits) || 0,
        multiplier: parseFloat(form.multiplier) || 1.0,
        luck: parseFloat(form.luck) || 1.0,
        discount: parseInt(form.discount) || 0,
        shield: form.shield,
        visible: form.visible,
        templateType: form.templateType,
        templateConfig: isTemplateChallenge ? form.templateConfig : {}
      };

      // Only include solution for passcode challenges
      if (!isTemplateChallenge && form.solution.trim()) {
        payload.solution = form.solution.trim();
      }

      if (editingId) {
        await updateCustomChallenge(classroomId, editingId, payload);
        toast.success('Challenge updated');
      } else {
        // Create the challenge first
        const result = await createCustomChallenge(classroomId, payload);
        const newChallengeId = result.challenge?._id;
        
        // Upload any pending attachments
        if (newChallengeId && pendingAttachments.length > 0) {
          let uploadedCount = 0;
          for (const file of pendingAttachments) {
            try {
              await uploadCustomChallengeAttachment(classroomId, newChallengeId, file);
              uploadedCount++;
            } catch {
              // Continue with remaining uploads
            }
          }
          if (uploadedCount > 0) {
            toast.success(`Challenge created with ${uploadedCount} attachment(s)`);
          } else {
            toast.success('Challenge created (some attachments failed)');
          }
        } else {
          toast.success('Challenge created');
        }
      }

      resetForm();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.message || 'Failed to save challenge');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (challengeId) => {
    if (!window.confirm('Are you sure you want to delete this challenge? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteCustomChallenge(classroomId, challengeId);
      toast.success('Challenge deleted');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.message || 'Failed to delete challenge');
    }
  };

  const handleFileUpload = async (challengeId, file) => {
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      await uploadCustomChallengeAttachment(classroomId, challengeId, file);
      toast.success('Attachment uploaded');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (challengeId, attachmentId) => {
    try {
      await deleteCustomChallengeAttachment(classroomId, challengeId, attachmentId);
      toast.success('Attachment deleted');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.message || 'Failed to delete attachment');
    }
  };

  const addHintField = () => {
    if (form.hints.length < 5) {
      setForm(prev => ({ ...prev, hints: [...prev.hints, ''] }));
    }
  };

  const removeHintField = (index) => {
    setForm(prev => ({
      ...prev,
      hints: prev.hints.filter((_, i) => i !== index)
    }));
  };

  const updateHint = (index, value) => {
    setForm(prev => ({
      ...prev,
      hints: prev.hints.map((h, i) => i === index ? value : h)
    }));
  };

  const toggleCardExpanded = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Custom Challenges</h3>
        {!showForm && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowForm(true); }}
            className="btn btn-primary btn-sm gap-2"
            disabled={!canAdd}
          >
            <Plus className="w-4 h-4" />
            Add Challenge
          </button>
        )}
      </div>

      {!canAdd && (
        <div className={`alert ${isDark ? 'bg-warning/20 border-warning/50' : 'bg-warning/10 border-warning/30'}`}>
          <span className="text-sm">Activate the challenge series first to add custom challenges.</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className={`card ${isDark ? 'bg-base-300' : 'bg-base-200'} p-4 space-y-4`}>
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{editingId ? 'Edit Challenge' : 'New Challenge'}</h4>
            <button type="button" onClick={resetForm} className="btn btn-ghost btn-sm btn-circle">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Template Selection - First thing in the form */}
          <div className="md:col-span-2">
            <TemplateSelector
              selectedType={form.templateType}
              templateConfig={form.templateConfig}
              onChange={(type, config) => setForm(prev => ({ 
                ...prev, 
                templateType: type, 
                templateConfig: config 
              }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control md:col-span-2">
              <label className="label"><span className="label-text">Title *</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Challenge title"
                maxLength={200}
                required
              />
            </div>

            <div className="form-control md:col-span-2">
              <label className="label"><span className="label-text">Description</span></label>
              <textarea
                className="textarea textarea-bordered h-24"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder={form.templateType === 'passcode' 
                  ? "Instructions for students (supports markdown)" 
                  : "Additional instructions (the template will auto-generate challenge content)"}
                maxLength={5000}
              />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text">External URL (optional)</span></label>
              <input
                type="url"
                className="input input-bordered"
                value={form.externalUrl}
                onChange={(e) => setForm(prev => ({ ...prev, externalUrl: e.target.value }))}
                placeholder="https://example.com/challenge"
              />
            </div>

            {/* Only show solution field for passcode-type challenges */}
            {form.templateType === 'passcode' && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Solution Passcode {editingId ? '(leave blank to keep)' : '*'}</span>
                </label>
                <div className="relative">
                  <input
                    type={showSolution['form'] ? 'text' : 'password'}
                    className="input input-bordered w-full pr-10"
                    value={form.solution}
                    onChange={(e) => setForm(prev => ({ ...prev, solution: e.target.value }))}
                    placeholder={editingId ? 'Enter new passcode or leave blank' : 'Enter solution passcode'}
                    required={!editingId}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs"
                    onClick={() => setShowSolution(prev => ({ ...prev, form: !prev.form }))}
                  >
                    {showSolution['form'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            

            <div className="form-control">
              <label className="label"><span className="label-text">Max Attempts (blank = unlimited)</span></label>
              <input
                type="number"
                className="input input-bordered"
                value={form.maxAttempts}
                onChange={(e) => setForm(prev => ({ ...prev, maxAttempts: e.target.value }))}
                placeholder="Unlimited"
                min={1}
              />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text">Bits Reward</span></label>
              <input
                type="number"
                className="input input-bordered"
                value={form.bits}
                onChange={(e) => setForm(prev => ({ ...prev, bits: e.target.value }))}
                min={0}
              />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text">Multiplier Bonus</span></label>
              <input
                type="number"
                className="input input-bordered"
                value={form.multiplier}
                onChange={(e) => setForm(prev => ({ ...prev, multiplier: e.target.value }))}
                min={1}
                step={0.1}
              />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text">Luck Multiplier</span></label>
              <input
                type="number"
                className="input input-bordered"
                value={form.luck}
                onChange={(e) => setForm(prev => ({ ...prev, luck: e.target.value }))}
                min={1}
                step={0.1}
              />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text">Discount %</span></label>
              <input
                type="number"
                className="input input-bordered"
                value={form.discount}
                onChange={(e) => setForm(prev => ({ ...prev, discount: e.target.value }))}
                min={0}
                max={100}
              />
            </div>

            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={form.shield}
                  onChange={(e) => setForm(prev => ({ ...prev, shield: e.target.checked }))}
                />
                <span className="label-text">Award Shield</span>
              </label>
            </div>

            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={form.visible}
                  onChange={(e) => setForm(prev => ({ ...prev, visible: e.target.checked }))}
                />
                <span className="label-text">Visible to Students</span>
              </label>
            </div>
          </div>

          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox"
                checked={form.hintsEnabled}
                onChange={(e) => setForm(prev => ({ ...prev, hintsEnabled: e.target.checked }))}
              />
              <span className="label-text">Enable Hints</span>
            </label>
          </div>

          {form.hintsEnabled && (
            <div className="space-y-2">
              <label className="label"><span className="label-text">Hints</span></label>
              {form.hints.map((hint, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    value={hint}
                    onChange={(e) => updateHint(index, e.target.value)}
                    placeholder={`Hint ${index + 1}`}
                    maxLength={500}
                  />
                  {form.hints.length > 1 && (
                    <button type="button" onClick={() => removeHintField(index)} className="btn btn-ghost btn-sm">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {form.hints.length < 5 && (
                <button type="button" onClick={addHintField} className="btn btn-ghost btn-sm gap-2">
                  <Plus className="w-4 h-4" /> Add Hint
                </button>
              )}
            </div>
          )}

          {/* Attachments during creation */}
          {!editingId && (
            <div className="form-control">
              <label className="label">
                <span className="label-text">Attachments (optional)</span>
                <span className="label-text-alt">{pendingAttachments.length}/5 files</span>
              </label>
              
              {pendingAttachments.length > 0 && (
                <div className="space-y-2 mb-2">
                  {pendingAttachments.map((file, index) => (
                    <div key={index} className={`flex items-center justify-between p-2 rounded ${isDark ? 'bg-base-100' : 'bg-white'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePendingAttachment(index)}
                        className="btn btn-ghost btn-xs"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {pendingAttachments.length < 5 && (
                <label 
                  className={`btn btn-ghost btn-sm gap-2 ${isDark ? 'border-base-content/20' : 'border-base-300'} border`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // Set flag IMMEDIATELY on mousedown (before click, before blur)
                    isSelectingFileRef.current = true;
                    if (onFileSelectionChange) {
                      onFileSelectionChange(true);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Ensure flag is still set
                    isSelectingFileRef.current = true;
                    if (onFileSelectionChange) {
                      onFileSelectionChange(true);
                    }
                  }}
                >
                  <Paperclip className="w-4 h-4" />
                  Add File
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleAddPendingAttachment}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileInputClick(e);
                    }}
                    onFocus={handleFileInputFocus}
                    onBlur={handleFileInputBlur}
                    accept=".pdf,.zip,.txt,.csv,.json,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                  />
                </label>
              )}
              <div className="text-xs text-gray-500 mt-1">Max 10MB per file. PDFs, images, documents, ZIPs allowed.</div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-sm"></span> : (editingId ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      )}

      {challenges.length > 0 && (
        <div className="space-y-2">
          {challenges.map((challenge, index) => (
            <div
              key={challenge._id}
              className={`card ${isDark ? 'bg-base-300' : 'bg-base-200'} p-3`}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-gray-400">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-sm font-mono">{index + 1}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{challenge.title}</span>
                    {!challenge.visible && (
                      <span className="badge badge-sm badge-warning">Hidden</span>
                    )}
                    {challenge.templateType && challenge.templateType !== 'passcode' ? (
                      <span className="badge badge-sm badge-success gap-1">
                        <Shield className="w-2.5 h-2.5" />
                        {challenge.templateName || challenge.templateType}
                      </span>
                    ) : (
                      <span className="badge badge-sm badge-ghost gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Passcode
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                    <span>{challenge.bits} bits</span>
                    {challenge.multiplier > 1 && <span>+{(challenge.multiplier - 1).toFixed(1)}x mult</span>}
                    {challenge.externalUrl && <ExternalLink className="w-3 h-3" />}
                    {(challenge.attachments?.length || 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />
                        {challenge.attachments.length}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleCardExpanded(challenge._id)}
                    className="btn btn-ghost btn-sm btn-circle"
                  >
                    {expandedCards[challenge._id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(challenge)}
                    className="btn btn-ghost btn-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(challenge._id)}
                    className="btn btn-ghost btn-sm text-error"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedCards[challenge._id] && (
                <div className="mt-3 pt-3 border-t border-base-content/10 space-y-3">
                  {challenge.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {challenge.description}
                    </p>
                  )}

                  {challenge.externalUrl && (
                    <a
                      href={challenge.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary text-sm flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {challenge.externalUrl}
                    </a>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Attachments</span>
                      <label className="btn btn-ghost btn-xs gap-1">
                        <Plus className="w-3 h-3" />
                        Upload
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleFileUpload(challenge._id, e.target.files?.[0])}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                    
                    {(challenge.attachments?.length || 0) > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {challenge.attachments.map(att => (
                          <div key={att._id} className="badge badge-lg gap-2">
                            <a
                              href={getCustomChallengeAttachmentUrl(classroomId, challenge._id, att._id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {att.originalName}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(challenge._id, att._id)}
                              className="hover:text-error"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">No attachments</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {challenges.length === 0 && !showForm && canAdd && (
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <p>No custom challenges yet.</p>
          <p className="text-sm">Click "Add Challenge" to create your first one.</p>
        </div>
      )}
    </div>
  );
};

export default CustomChallengeBuilder;

