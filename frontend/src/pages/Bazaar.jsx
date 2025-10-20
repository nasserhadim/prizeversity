import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, HandCoins  } from 'lucide-react';
import { Image as ImageIcon } from 'lucide-react';
// import axios from 'axios'
//import apiBazaar from '../API/apiBazaar.js'
import CreateBazaar from '../components/CreateBazaar';
import CreateItem from '../components/CreateItem';
import ItemCard from '../components/ItemCard';
import apiBazaar from '../API/apiBazaar';
import apiClassroom from '../API/apiClassroom';
import InventorySection from '../components/InventorySection';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';
import { resolveBannerSrc } from '../utils/image';
import { getBazaarTemplates, saveBazaarTemplate, deleteBazaarTemplate, applyBazaarTemplate } from '../API/apiBazaarTemplate';
import { Package, Save, Trash2 } from 'lucide-react';

const Bazaar = () => {
  const { classroomId } = useParams();
  const { user } = useAuth();
  const [bazaar, setBazaar] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInventory, setShowInventory] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Fetch classroom details
  const fetchClassroom = async () => {
    try {
      const response = await apiClassroom.get(`/${classroomId}`);
      setClassroom(response.data);
    } catch (err) {
      console.error('Failed to fetch classroom:', err);
    }
  };

  // Will fetch the bazaar from the classroom
  const fetchBazaar = async () => {
    try {
      const res = await apiBazaar.get(`classroom/${classroomId}/bazaar`);
      setBazaar(res.data.bazaar);
    } catch {
      setBazaar(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch templates
  const fetchTemplates = async () => {
    if (user.role !== 'teacher') return;
    try {
      const res = await getBazaarTemplates();
      setTemplates(res.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  useEffect(() => {
    fetchClassroom();
    fetchBazaar();
    fetchTemplates();
  }, [classroomId]);

  // Save current bazaar as template
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (!bazaar) {
      toast.error('No bazaar to save as template');
      return;
    }

    try {
      setSavingTemplate(true);
      await saveBazaarTemplate(templateName.trim(), bazaar._id);
      toast.success('Template saved successfully!');
      setShowTemplateModal(false);
      setTemplateName('');
      fetchTemplates();
    } catch (error) {
      toast.error(error.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (templateId, name) => {
    if (!confirm(`Delete template "${name}"?`)) return;

    try {
      await deleteBazaarTemplate(templateId);
      toast.success('Template deleted successfully!');
      fetchTemplates();
    } catch (error) {
      toast.error(error.message || 'Failed to delete template');
    }
  };

  // Apply template to current classroom
  const handleApplyTemplate = async (templateId) => {
    if (bazaar) {
      toast.error('Delete existing bazaar first before applying a template');
      return;
    }

    try {
      const res = await applyBazaarTemplate(templateId, classroomId);
      toast.success('Template applied successfully!');
      setBazaar(res.bazaar);
      setShowApplyModal(false);
    } catch (error) {
      toast.error(error.message || 'Failed to apply template');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-base-200">
                        <span className="loading loading-ring loading-lg"></span>
                      </div>

  // Case: Bazaar not yet created - show template options
  if (!bazaar) {
    return user.role === 'teacher' ? (
      <div className="flex flex-col min-h-screen bg-base-200">
        <div className="flex-grow p-6 space-y-6">
          {/* Show available templates */}
          {templates.length > 0 && (
            <div className="card bg-base-100 shadow-xl border border-base-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-6 h-6 text-purple-500" />
                <h2 className="text-2xl font-semibold">Apply Template</h2>
              </div>
              <p className="text-base-content/70 mb-4">
                Quickly set up your bazaar using a saved template:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div 
                    key={template._id} 
                    className="card bg-base-200 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <div className="card-body p-4">
                      <h3 className="font-semibold text-lg">{template.name}</h3>
                      <p className="text-sm text-base-content/60">
                        {template.bazaarData.name}
                      </p>
                      {/* NEW: Show classroom info */}
                      {template.sourceClassroom && (
                        <p className="text-xs text-base-content/50 italic">
                          From: {template.sourceClassroom.name}
                          {template.sourceClassroom.code && ` (${template.sourceClassroom.code})`}
                        </p>
                      )}
                      <p className="text-xs text-base-content/50">
                        {template.items?.length || 0} items • {new Date(template.createdAt).toLocaleDateString()}
                      </p>
                      <div className="card-actions justify-end mt-2">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleApplyTemplate(template._id)}
                        >
                          Apply
                        </button>
                        <button
                          className="btn btn-sm btn-ghost text-error"
                          onClick={() => handleDeleteTemplate(template._id, template.name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="divider">OR</div>
            </div>
          )}
          
          {/* Create new bazaar */}
          <CreateBazaar classroomId={classroomId} onCreate={setBazaar} />
        </div>
        <Footer />
      </div>
    ) : (
      <div className="flex flex-col min-h-screen bg-base-200">
        <div className="flex-grow p-6 text-center text-lg font-semibold text-base-content/70">
          The marketplace is not open yet.
        </div>
        <Footer />
      </div>
    );
  }

  // Case: Bazaar exists
  return (
    <div className="p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-success flex items-center justify-center gap-3">
          {/* <Store /> */}
          {classroom
            ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} Bazaar`
            : 'Classroom Bazaar'}
        </h1>
      </div>

      <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* Image Section */}
        <div className="w-full md:w-1/3">
          {(() => {
            const imgSrc = resolveBannerSrc(bazaar?.image);
            return (
              <img
                src={resolveBannerSrc(bazaar?.image)}
                alt="Bazaar Banner"
                className="w-full h-48 object-cover rounded-xl shadow-sm"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/images/bazaar-placeholder.svg';
                }}
              />
            );
          })()}
        </div>

        {/* Text Section */}
        <div className="flex-1 space-y-2 text-center md:text-left">
          <h2 className="text-3xl sm:text-4xl font-bold text-success leading-tight break-words flex items-center gap-2">
            <Store />
            {bazaar.name}
          </h2>

          <p className="text-base-content opacity-70 text-base sm:text-lg whitespace-pre-wrap">
            {bazaar.description}
          </p>
        </div>
      </div>

      {/* Teacher Create Item */}
      {user.role === 'teacher' && (
        <div className="card card-compact bg-base-100 shadow p-4 border border-base-200">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <button
              className="btn btn-sm btn-outline btn-success gap-2"
              onClick={() => setShowTemplateModal(true)}
            >
              <Save className="w-4 h-4" />
              Save as Template
            </button>
            {templates.length > 0 && (
              <button
                className="btn btn-sm btn-outline btn-info gap-2"
                onClick={() => setShowApplyModal(true)}
              >
                <Package className="w-4 h-4" />
                View Templates ({templates.length})
              </button>
            )}
          </div>
          
          <CreateItem
            bazaarId={bazaar._id}
            classroomId={classroomId}
            onAdd={(newItem) =>
              setBazaar((prev) => ({
                ...prev,
                items: [...(prev.items || []), newItem],
              }))
            }
          />
        </div>
      )}

      {/* Items for Sale Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-success flex items-center gap-2">
            <HandCoins />
            Items for Sale
          </h3>
          <span className="badge badge-outline text-sm hidden md:inline">
            {bazaar.items?.length || 0} item{bazaar.items?.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="divider my-0"></div>

        {bazaar.items?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {bazaar.items.map((item) => (
              <ItemCard
                key={item._id}
                item={item}
                role={user.role}
                classroomId={classroomId}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-12 h-12 mb-2 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V9a2 2 0 00-2-2h-1V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2H6a2 2 0 00-2 2v4M3 17h18M9 21h6"
              />
            </svg>
            <p className="italic">Nothing is for sale yet. Please check back later!</p>
          </div>
        )}
      </div>


      {/* Inventory Section with Button in Header */}
      <div className="card bg-base-200 shadow-inner border border-base-300">
        <div className="card-body p-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowInventory(!showInventory)}
              className={`btn btn-sm transition-all duration-200 ${
                showInventory ? 'btn-outline btn-error' : 'btn-success'
              }`}
            >
              {showInventory ? 'Hide' : 'Show'} Inventory
            </button>
          </div>
          
          {/* Inventory Section */}
          {showInventory && (
            <div className="mt-4">
              <InventorySection userId={user._id} classroomId={classroomId} />
            </div>
          )}
        </div>
      </div>

      {/* Save Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card bg-base-100 w-full max-w-md mx-4 shadow-xl">
            <div className="card-body">
              <h2 className="text-xl font-bold mb-4">Save Bazaar Template</h2>
              <p className="text-sm text-base-content/70 mb-4">
                Save this bazaar configuration to reuse in other classrooms
              </p>
              <input
                type="text"
                placeholder="Template name (e.g., 'Fall 2024 Shop')"
                className="input input-bordered w-full"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                autoFocus
              />
              <div className="text-xs text-base-content/60 mt-2">
                This will save: {bazaar.name} with {bazaar.items?.length || 0} items
              </div>
              <div className="card-actions justify-end mt-4">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowTemplateModal(false);
                    setTemplateName('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-success"
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                >
                  {savingTemplate ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Saving...
                    </>
                  ) : (
                    'Save Template'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View/Apply Templates Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="card bg-base-100 w-full max-w-3xl my-8 shadow-xl">
            <div className="card-body">
              <h2 className="text-xl font-bold mb-4">Saved Templates</h2>
              {templates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {templates.map((template) => (
                    <div 
                      key={template._id} 
                      className="card bg-base-200 shadow"
                    >
                      <div className="card-body p-4">
                        <h3 className="font-semibold">{template.name}</h3>
                        <p className="text-sm text-base-content/60">
                          {template.bazaarData.name}
                        </p>
                        {/* NEW: Show classroom info */}
                        {template.sourceClassroom && (
                          <p className="text-xs text-base-content/50 italic">
                            From: {template.sourceClassroom.name}
                            {template.sourceClassroom.code && ` (${template.sourceClassroom.code})`}
                          </p>
                        )}
                        <p className="text-xs text-base-content/50">
                          {template.items?.length || 0} items
                        </p>
                        <p className="text-xs text-base-content/40">
                          Created: {new Date(template.createdAt).toLocaleDateString()}
                        </p>
                        <div className="card-actions justify-end mt-2">
                          <button
                            className="btn btn-xs btn-ghost text-error"
                            onClick={() => handleDeleteTemplate(template._id, template.name)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-base-content/60 py-8">
                  No templates saved yet
                </p>
              )}
              <div className="card-actions justify-end mt-4">
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowApplyModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Bazaar;
