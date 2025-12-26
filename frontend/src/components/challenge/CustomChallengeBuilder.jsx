import { useState, useEffect, useContext, useRef } from 'react';
import { 
  Plus, Trash2, GripVertical, ExternalLink, Paperclip, X, Eye, EyeOff, 
  ChevronDown, ChevronUp, Shield, AlertTriangle,
  Target, Lightbulb, Clover, Percent, Clock
} from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';
import {
  createCustomChallenge,
  updateCustomChallenge,
  deleteCustomChallenge,
  uploadCustomChallengeAttachment,
  deleteCustomChallengeAttachment,
  getCustomChallengeAttachmentUrl,
  reorderCustomChallenges 
} from '../../API/apiChallenge';
import TemplateSelector from './TemplateSelector';
import toast from 'react-hot-toast';
import ConfirmModal from '../ConfirmModal';

const utcToLocalDateTime = (utcISOString) => {
  if (!utcISOString) return '';
  const date = new Date(utcISOString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const localDateTimeToUTC = (localDateTimeString) => {
  if (!localDateTimeString) return '';
  const [datePart, timePart] = localDateTimeString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  const localDate = new Date(year, month - 1, day, hours, minutes);
  return localDate.toISOString();
};

const CustomChallengeBuilder = ({
  classroomId,
  customChallenges = [],
  onUpdate,
  isActive = false,
  allowAddBeforeActive = false,
  onFileSelectionChange,  
  draftMode = false,  
  onDraftUpdate  
}) => {
  const canAdd = isActive || allowAddBeforeActive;
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const [challenges, setChallenges] = useState(customChallenges);
  const [draggingId, setDraggingId] = useState(null); 

  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSolution, setShowSolution] = useState({});
  const [expandedCards, setExpandedCards] = useState({});

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmOptions, setConfirmOptions] = useState({
    title: 'Confirm',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmButtonClass: 'btn-primary',
    onConfirm: null
  });

  const openConfirm = ({
    title = 'Confirm',
    message = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmButtonClass = 'btn-primary',
    onConfirm = null
  }) => {
    setConfirmOptions({ title, message, confirmText, cancelText, confirmButtonClass, onConfirm });
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    const fn = confirmOptions?.onConfirm;
    if (typeof fn === 'function') {
      try {
        await fn();
      } catch (err) {
        console.error('Confirm callback error', err);
      }
    }
  };

  const [form, setForm] = useState({
    title: '',
    description: '',
    externalUrl: '',
    solution: '',
    maxAttempts: '',
    hintsEnabled: false,
    hints: ['', ''],
    hintPenaltyPercent: '',
    bits: 50,
    multiplier: 1.0,
    luck: 1.0,
    discount: 0,
    shield: false,
    visible: true,
    templateType: 'passcode',
    templateConfig: {},
    dueDateEnabled: false,
    dueDate: ''
  });
  
  const [pendingAttachments, setPendingAttachments] = useState([]);
  
  const fileInputRef = useRef(null);
  const isSelectingFileRef = useRef(false);

  useEffect(() => {
    setChallenges(customChallenges);
  }, [customChallenges]);
  
  useEffect(() => {
    if (!isSelectingFileRef.current) return;
    
    const handleWindowBlur = () => {
      if (onFileSelectionChange) {
        onFileSelectionChange(true);
      }
    };
    
    const handleWindowFocus = () => {
      setTimeout(() => {
        if (fileInputRef.current && !fileInputRef.current.files?.length) {
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
      hintPenaltyPercent: '',
      bits: 50,
      multiplier: 1.0,
      luck: 1.0,
      discount: 0,
      shield: false,
      visible: true,
      templateType: 'passcode',
      templateConfig: {},
      dueDateEnabled: false,
      dueDate: ''
    });
    setPendingAttachments([]);
    setEditingId(null);
    setShowForm(false);
  };
  
  const handleAddPendingAttachment = (e) => {
    const file = e.target.files?.[0];
    isSelectingFileRef.current = false;
    
    if (onFileSelectionChange) {
      setTimeout(() => {
        onFileSelectionChange(false);
      }, 500);
    }
    
    if (!file) {
      if (onFileSelectionChange) {
        onFileSelectionChange(false);
      }
      return;
    }
    
    const maxSize = 10 * 1024 * 1024; 
    if (file.size > maxSize) {
      toast.error('File size must be under 10MB');
      return;
    }
    
    if (pendingAttachments.length >= 5) {
      toast.error('Maximum 5 attachments allowed');
      return;
    }
    
    setPendingAttachments(prev => [...prev, file]);
    e.target.value = ''; 
  };
  
  
  const handleFileInputClick = (e) => {
    e.stopPropagation();
    isSelectingFileRef.current = true;
    if (onFileSelectionChange) {
      onFileSelectionChange(true);
    }
  };
  
  
  const handleFileInputFocus = () => {
    isSelectingFileRef.current = true;
    if (onFileSelectionChange) {
      onFileSelectionChange(true);
    }
  };
  
  const handleFileInputBlur = () => {
    setTimeout(() => {
      if (!fileInputRef.current?.files?.length) {
        isSelectingFileRef.current = false;
        if (onFileSelectionChange) {
          onFileSelectionChange(false);
        }
      }
    }, 1000);
  };
  
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
      hintPenaltyPercent: challenge.hintPenaltyPercent ?? '',
      bits: challenge.bits || 50,
      multiplier: challenge.multiplier || 1.0,
      luck: challenge.luck || 1.0,
      discount: challenge.discount || 0,
      shield: challenge.shield || false,
      visible: challenge.visible !== false,
      templateType: challenge.templateType || 'passcode',
      templateConfig: challenge.templateConfig || {},
      dueDateEnabled: challenge.dueDateEnabled || false,
      dueDate: challenge.dueDate ? utcToLocalDateTime(challenge.dueDate) : ''
    });
    setEditingId(challenge._id || challenge._draftId);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    const isTemplateChallenge = form.templateType && form.templateType !== 'passcode';

    if (!isTemplateChallenge && !editingId && !form.solution.trim()) {
      toast.error('Solution passcode is required for passcode challenges');
      return;
    }

    if (form.hintsEnabled && form.hints.filter(h => h.trim()).length === 0) {
      toast.error('Please add at least one hint or disable hints');
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
        hintPenaltyPercent: form.hintPenaltyPercent !== '' ? parseInt(form.hintPenaltyPercent) : null,
        bits: parseInt(form.bits) || 0,
        multiplier: parseFloat(form.multiplier) || 1.0,
        luck: parseFloat(form.luck) || 1.0,
        discount: parseInt(form.discount) || 0,
        shield: form.shield,
        visible: form.visible,
        templateType: form.templateType,
        templateConfig: isTemplateChallenge ? form.templateConfig : {},
        dueDateEnabled: form.dueDateEnabled,
        dueDate: form.dueDateEnabled && form.dueDate ? localDateTimeToUTC(form.dueDate) : null
      };

      if (!isTemplateChallenge && form.solution.trim()) {
        payload.solution = form.solution.trim();
      }

      if (draftMode) {
        const draftChallenge = {
          ...payload,
          pendingAttachments: [...pendingAttachments]
        };
        
        if (editingId) {
          const updated = challenges.map(c => 
            c._id === editingId || c._draftId === editingId 
              ? { ...c, ...draftChallenge }
              : c
          );
          setChallenges(updated);
          if (onDraftUpdate) onDraftUpdate(updated);
        } else {
          
          const newDraft = {
            ...draftChallenge,
            _draftId: `draft-${Date.now()}-${Math.random()}`, 
            order: challenges.length
          };
          const updated = [...challenges, newDraft];
          setChallenges(updated);
          if (onDraftUpdate) onDraftUpdate(updated);
        }
        
        resetForm();
        toast.success(editingId ? 'Challenge updated' : 'Challenge added');
        return;
      }

      if (editingId) {
        await updateCustomChallenge(classroomId, editingId, payload);
        toast.success('Challenge updated');
      } else {
        
        const result = await createCustomChallenge(classroomId, payload);
        const newChallengeId = result.challenge?._id;
        
        
        if (newChallengeId && pendingAttachments.length > 0) {
          let uploadedCount = 0;
          for (const file of pendingAttachments) {
            try {
              await uploadCustomChallengeAttachment(classroomId, newChallengeId, file);
              uploadedCount++;
            } catch {
              
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
    const challenge = challenges.find(c => c._id?.toString() === challengeId?.toString());
    const label = challenge?.title ? `"${challenge.title}"` : 'this challenge';

    if (draftMode) {
      
      const updated = challenges.filter(c => 
        c._id !== challengeId && c._draftId !== challengeId
      );
      setChallenges(updated);
      if (onDraftUpdate) onDraftUpdate(updated);
      toast.success('Challenge removed');
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

  
  
  
  const ATTACHMENT_MAX_SIZE_TEXT = 'Max 10MB per file.';
  const ATTACHMENT_TYPES_TEXT = 'PDFs, images, documents, ZIPs, TXT/CSV/JSON allowed.';
  const ATTACHMENT_ACCEPT =
    '.pdf,.zip,.txt,.csv,.json,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp';

  const moveItem = (arr, fromIndex, toIndex) => {
    const next = [...arr];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
  };

  const persistOrder = async (nextChallenges) => {
    const order = nextChallenges.map(c => c._id);
    await reorderCustomChallenges(classroomId, order);
    if (onUpdate) onUpdate();
  };

  const handleDragStart = (e, challengeId) => {
    setDraggingId(challengeId);
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(challengeId));
    } catch {
      
    }
  };

  const handleDragOver = (e) => {
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetChallengeId) => {
    e.preventDefault();

    const sourceId = draggingId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetChallengeId) {
      setDraggingId(null);
      return;
    }

    const prev = challenges;
    const fromIndex = prev.findIndex(c => String(c._id) === String(sourceId));
    const toIndex = prev.findIndex(c => String(c._id) === String(targetChallengeId));
    if (fromIndex === -1 || toIndex === -1) {
      setDraggingId(null);
      return;
    }

    const next = moveItem(prev, fromIndex, toIndex);

    
    setChallenges(next);

    try {
      await persistOrder(next);
      toast.success('Reordered custom challenges');
    } catch (err) {
      
      setChallenges(prev);
      toast.error(err?.message || 'Failed to reorder challenges');
    } finally {
      setDraggingId(null);
    }
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

          {}
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
                placeholder="https://example.com"
              />
            </div>

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

            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={form.dueDateEnabled}
                  onChange={(e) => setForm(prev => ({ ...prev, dueDateEnabled: e.target.checked }))}
                />
                <span className="label-text">Set Due Date</span>
              </label>
            </div>

            {form.dueDateEnabled && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Due Date and Time</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered"
                  value={form.dueDate}
                  onChange={(e) => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <div className="text-xs text-gray-500 mt-1">Students must complete this challenge by this date and time</div>
              </div>
            )}
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
            <div className="space-y-4">
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
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Hint Penalty % (optional)</span>
                  <span className="label-text-alt">Leave blank to use series default</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered w-32"
                  value={form.hintPenaltyPercent}
                  onChange={(e) => setForm(prev => ({ ...prev, hintPenaltyPercent: e.target.value }))}
                  placeholder="25"
                  min={0}
                  max={100}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Reduces bit reward by this % for each hint used
                </div>
              </div>
            </div>
          )}

          {}
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
                    
                    isSelectingFileRef.current = true;
                    if (onFileSelectionChange) {
                      onFileSelectionChange(true);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                editingId ? 'Update Custom Challenge' : 'Create Custom Challenge'
              )}
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
              onDragOver={handleDragOver}                 
              onDrop={(e) => handleDrop(e, challenge._id)} 
            >
              <div className="flex items-center gap-3">
                {}
                <div
                  className={`flex items-center gap-2 text-gray-400 select-none ${
                    String(draggingId) === String(challenge._id) ? 'opacity-60' : ''
                  }`}
                  draggable 
                  onDragStart={(e) => handleDragStart(e, challenge._id)} 
                  onDragEnd={() => setDraggingId(null)} 
                  title="Drag to reorder"
                  aria-label="Drag to reorder"
                  style={{ cursor: 'grab' }}
                >
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
                    {!challenge.visible && (
                      <span className="flex items-center gap-1 text-warning">
                        <EyeOff className="w-3 h-3" />
                        hidden
                      </span>
                    )}

                    <span>{challenge.bits} bits</span>

                    {Number(challenge.multiplier || 1) > 1 && (
                      <span>+{(Number(challenge.multiplier) - 1).toFixed(1)}x mult</span>
                    )}

                    {Number(challenge.luck || 1) > 1 && (
                      <span className="flex items-center gap-1">
                        <Clover className="w-3 h-3" />
                        ×{Number(challenge.luck).toFixed(1)} luck
                      </span>
                    )}

                    {Number(challenge.discount || 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        {challenge.discount}% disc
                      </span>
                    )}

                    {challenge.shield && (
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        shield
                      </span>
                    )}

                    {challenge.maxAttempts ? (
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {challenge.maxAttempts} attempt{Number(challenge.maxAttempts) === 1 ? '' : 's'}
                      </span>
                    ) : null}

                    {challenge.hintsEnabled ? (
                      <span className="flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        {(challenge.hints || []).filter(h => (h || '').trim()).length} hint(s)
                      </span>
                    ) : null}

                    {challenge.dueDateEnabled && challenge.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due: {new Date(challenge.dueDate).toLocaleString()}
                      </span>
                    )}

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
                    <p
                      className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap wrap-any"
                    >
                      {challenge.description}
                    </p>
                  )}

                  {challenge.externalUrl && (
                    <a
                      href={challenge.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary text-sm flex items-center gap-1 min-w-0 max-w-full flex-wrap"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="min-w-0 break-all">{challenge.externalUrl}</span>
                    </a>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Attachments</span>

                      <div className="flex items-center gap-2">
                        <label className="btn btn-ghost btn-xs gap-1">
                          <Plus className="w-3 h-3" />
                          Upload
                          <input
                            type="file"
                            className="hidden"
                            accept={ATTACHMENT_ACCEPT}
                            onChange={(e) => handleFileUpload(challenge._id, e.target.files?.[0])}
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {ATTACHMENT_MAX_SIZE_TEXT} {ATTACHMENT_TYPES_TEXT}
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

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title={confirmOptions.title}
        message={confirmOptions.message}
        confirmText={confirmOptions.confirmText}
        cancelText={confirmOptions.cancelText}
        confirmButtonClass={confirmOptions.confirmButtonClass}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default CustomChallengeBuilder;

