import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
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
import EditItemModal from '../components/EditItemModal';
import { X } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const TemplateHelpCollapse = ({ hasBazaar }) => {
  const title = 'How templating works';
  const line1 = hasBazaar
    ? 'Importing a template will add any missing items to your existing bazaar (it will not delete current items).'
    : 'Applying a template will create a bazaar for this classroom and add the template items.';
  return (
    <div className="collapse collapse-arrow bg-base-200 rounded">
      <input type="checkbox" />
      <div className="collapse-title text-sm font-semibold">{title}</div>
      <div className="collapse-content text-sm space-y-1">
        <p>• {line1}</p>
        <p>• Items with the same name are skipped to avoid duplicates.</p>
        <p>• Mystery Box pools are matched by item name; missing/invalid pool entries are skipped and summarized.</p>
        {hasBazaar && <p>• If a bazaar already exists, templates are applied in “merge/import” mode (no replace).</p>}
      </div>
    </div>
  );
};

const Bazaar = () => {
  const { classroomId } = useParams();
  const { user } = useAuth();
  const [bazaar, setBazaar] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  // REPLACE: showInventory -> bazaarTab
  // const [showInventory, setShowInventory] = useState(false);
  const [bazaarTab, setBazaarTab] = useState('shop'); // 'shop' | 'inventory'
  const [templates, setTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateSort, setTemplateSort] = useState('createdDesc'); // 'createdDesc' | 'createdAsc' | 'nameAsc' | 'nameDesc' | 'itemsDesc' | 'itemsAsc'
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  // NEW: tab state for the "no bazaar" screen
  const [noBazaarTab, setNoBazaarTab] = useState('create'); // 'create' | 'apply'
  const [itemSearch, setItemSearch] = useState('');
  const [itemCategory, setItemCategory] = useState('all');
  const [itemSort, setItemSort] = useState('nameAsc');
  const [editItem, setEditItem] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  // NEW: delete modal state
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // NEW: bulk delete state
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showEditBazaar, setShowEditBazaar] = useState(false);
  const [editBazaarForm, setEditBazaarForm] = useState({ name: '', description: '', imageSource: 'file', imageFile: null, imageUrl: '' });
  const [deletingBazaar, setDeletingBazaar] = useState(false);
  const [confirmDeleteBazaar, setConfirmDeleteBazaar] = useState(false);

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

  // NEW: bulk delete handler
  const handleBulkDeleteItems = async () => {
    setBulkDeleting(true);
    try {
      const itemsToDelete = sortedFilteredItems;
      
      await Promise.all(
        itemsToDelete.map(item =>
          apiBazaar.delete(`/classroom/${classroomId}/bazaar/${bazaar._id}/items/${item._id}`)
        )
      );

      toast.success(`Deleted ${itemsToDelete.length} item(s)`);
      
      setBazaar(prev => ({
        ...prev,
        items: prev.items.filter(i => !itemsToDelete.find(d => d._id === i._id))
      }));
      
      setConfirmBulkDelete(false);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Delete template
  const [deleteTemplateModal, setDeleteTemplateModal] = useState(null);

  const handleDeleteTemplate = async (templateId, name) => {
    setDeleteTemplateModal({ id: templateId, name });
  };

  const confirmDeleteTemplate = async () => {
    try {
      await deleteBazaarTemplate(deleteTemplateModal.id);
      toast.success('Template deleted');
      fetchTemplates();
      setDeleteTemplateModal(null);
    } catch (error) {
      toast.error(error.message || 'Failed to delete template');
    }
  };

  const formatTemplateApplyMessage = (res, hasBazaar) => {
    const s = res?.summary;
    if (!s) return res?.message || (hasBazaar ? 'Items imported.' : 'Template applied.');

    const parts = [];
    parts.push(
      hasBazaar
        ? `Imported ${s.createdTotal} item(s) (${s.createdRegular} regular, ${s.createdMystery} MysteryBox).`
        : `Created ${s.createdTotal} item(s) (${s.createdRegular} regular, ${s.createdMystery} MysteryBox).`
    );

    if (s.skippedTotal > 0) {
      const reasons = s.skippedByReason || {};
      const reasonText = Object.entries(reasons)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      parts.push(`Skipped ${s.skippedTotal}${reasonText ? ` (${reasonText})` : ''}.`);
      if (Array.isArray(s.topSkippedNames) && s.topSkippedNames.length) {
        parts.push(`Examples: ${s.topSkippedNames.join(', ')}${s.skippedTotal > s.topSkippedNames.length ? ', …' : ''}`);
      }
    }

    return parts.join(' ');
  };

  // Apply template to current classroom
  const handleApplyTemplate = async (templateId, opts = {}) => {
    try {
      const mode = bazaar ? 'merge' : 'replace';
      const res = await applyBazaarTemplate(templateId, classroomId, { mode, ...opts });

      toast.success(formatTemplateApplyMessage(res, !!bazaar));

      setBazaar(res.bazaar);
      setShowApplyModal(false);
    } catch (error) {
      toast.error(error.message || 'Failed to apply template');
    }
  };

  // Deep match similar to InventorySection
  const deepMatches = (item, term) => {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    const parts = [
      item.name || '',
      item.description || '',
      item.category || '',
      item.primaryEffect || '',
      String(item.primaryEffectValue || ''),
      (item.secondaryEffects || []).map(se => `${se.effectType} ${se.value}`).join(' ')
    ];
    return parts.some(p => p.toLowerCase().includes(q));
  };

  const sortedFilteredItems = useMemo(() => {
    let list = [...(bazaar?.items || [])];
    if (itemCategory !== 'all') {
      list = list.filter(i => i.category === itemCategory);
    }
    if (itemSearch.trim()) {
      list = list.filter(i => deepMatches(i, itemSearch));
    }
    list.sort((a, b) => {
      switch (itemSort) {
        case 'nameAsc': return a.name.localeCompare(b.name);
        case 'nameDesc': return b.name.localeCompare(a.name);
        case 'priceAsc': return (a.price || 0) - (b.price || 0);
        case 'priceDesc': return (b.price || 0) - (a.price || 0);
        case 'category': return a.category.localeCompare(b.category);
        case 'addedDesc': return new Date(b.createdAt) - new Date(a.createdAt);
        case 'addedAsc': return new Date(a.createdAt) - new Date(b.createdAt);
        default: return 0;
      }
    });
    return list;
  }, [bazaar?.items, itemSearch, itemCategory, itemSort]);

  // Deep search + sort for templates
  const filteredSortedTemplates = useMemo(() => {
    const q = (templateSearch || '').trim().toLowerCase();
    const deepMatch = (t) => {
      if (!q) return true;
      const parts = [
        t.name || '',
        t.bazaarData?.name || '',
        t.bazaarData?.description || '',
        t.sourceClassroom?.name || '',
        t.sourceClassroom?.code || '',
        String((t.items || []).length || 0),
        new Date(t.createdAt).toLocaleString()
      ].join(' ').toLowerCase();
      return parts.includes(q);
    };
    const list = (templates || []).filter(deepMatch);
    list.sort((a, b) => {
      const ai = (a.items?.length || 0);
      const bi = (b.items?.length || 0);
      switch (templateSort) {
        case 'createdDesc': return new Date(b.createdAt) - new Date(a.createdAt);
        case 'createdAsc': return new Date(a.createdAt) - new Date(b.createdAt);
        case 'nameAsc': return (a.name || '').localeCompare(b.name || '');
        case 'nameDesc': return (b.name || '').localeCompare(a.name || '');
        case 'itemsDesc': return bi - ai;
        case 'itemsAsc': return ai - bi;
        default: return 0;
      }
    });
    return list;
  }, [templates, templateSearch, templateSort]);

  // Prefill edit form when bazaar loads
  useEffect(() => {
    if (bazaar) {
      setEditBazaarForm(prev => ({
        ...prev,
        name: bazaar.name || '',
        description: bazaar.description || '',
        imageSource: 'file',
        imageFile: null,
        imageUrl: bazaar.image || ''
      }));
    }
  }, [bazaar]);

  const handleUpdateBazaar = async () => {
    try {
      let res;
      const url = `/classroom/${classroomId}/bazaar/${bazaar._id}`;
      if (editBazaarForm.imageSource === 'file' && editBazaarForm.imageFile) {
        const fd = new FormData();
        fd.append('name', editBazaarForm.name.trim());
        fd.append('description', editBazaarForm.description);
        fd.append('image', editBazaarForm.imageFile);
        res = await apiBazaar.put(url, fd);
      } else {
        res = await apiBazaar.put(url, {
          name: editBazaarForm.name.trim(),
          description: editBazaarForm.description,
          image: editBazaarForm.imageUrl
        });
      }
      setBazaar(res.data.bazaar);
      toast.success('Bazaar updated');
      setShowEditBazaar(false);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update bazaar');
    }
  };

  const handleDeleteBazaar = () => {
    setConfirmDeleteBazaar(true);
  };

  const confirmDeleteBazaarAction = async () => {
    setDeletingBazaar(true);
    try {
      await apiBazaar.delete(`/classroom/${classroomId}/bazaar/${bazaar._id}`);
      toast.success('Bazaar deleted');
      setBazaar(null);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete bazaar');
    } finally {
      setDeletingBazaar(false);
      setConfirmDeleteBazaar(false);
    }
  };

  // helper label (optional but keeps it consistent)
  const getTemplateApplyLabel = (hasBazaar) => (hasBazaar ? 'Import Items' : 'Apply (Create Bazaar)');

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-base-200">
                        <span className="loading loading-ring loading-lg"></span>
                      </div>

  // Case: Bazaar not yet created - show template options
  if (!bazaar) {
    return user.role === 'teacher' ? (
      <div className="flex flex-col min-h-screen bg-base-200">
        <div className="flex-grow p-6 space-y-6">
          {/* Tabs to switch between Apply Template / Create Bazaar */}
          <div role="tablist" className="tabs tabs-boxed mb-6">
            <button
              role="tab"
              className={`tab ${noBazaarTab === 'create' ? 'tab-active' : ''}`}
              onClick={() => setNoBazaarTab('create')}
            >
              Create Bazaar
            </button>
            <button
              role="tab"
              className={`tab ${noBazaarTab === 'apply' ? 'tab-active' : ''}`}
              onClick={() => setNoBazaarTab('apply')}
            >
              Apply Template
            </button>
          </div>

          {/* Pane: Create Bazaar */}
          {noBazaarTab === 'create' && (
            <div className="w-full max-w-3xl mx-auto">
              <CreateBazaar classroomId={classroomId} onCreate={setBazaar} />
            </div>
          )}

          {/* Pane: Apply Template */}
          {noBazaarTab === 'apply' && (
            <div className="card bg-base-100 shadow-md rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4">
                Apply Template {templates?.length ? `(${templates.length})` : ''}
              </h2>

              <TemplateHelpCollapse hasBazaar={false} />

             <div className="flex flex-wrap gap-2 mb-3">
               <input
                 type="search"
                 className="input input-bordered flex-1 min-w-[200px]"
                 placeholder="Search templates..."
                 value={templateSearch}
                 onChange={(e) => setTemplateSearch(e.target.value)}
               />
               <select
                 className="select select-bordered w-40"
                 value={templateSort}
                 onChange={(e) => setTemplateSort(e.target.value)}
               >
                 <option value="createdDesc">Newest</option>
                 <option value="createdAsc">Oldest</option>
                 <option value="nameAsc">Name ↑</option>
                 <option value="nameDesc">Name ↓</option>
                 <option value="itemsDesc">Items ↓</option>
                 <option value="itemsAsc">Items ↑</option>
               </select>
             </div>
              {templates.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                 {filteredSortedTemplates.map((template) => (
                    <div key={template._id} className="card bg-base-200 shadow">
                      <div className="card-body p-4">
                        <h3 className="font-semibold template-name">
                          {template.name}
                        </h3>
                        <p className="text-sm text-base-content/60">
                          {template.bazaarData.name}
                        </p>
                        {template.sourceClassroom && (
                          <p className="text-xs text-base-content/50 italic">
                            From: {template.sourceClassroom.name}
                            {template.sourceClassroom.code && ` (${template.sourceClassroom.code})`}
                          </p>
                        )}
                        <p className="text-xs text-base-content/50">
                          {template.items?.length || 0} items
                        </p>
                        <div className="text-xs text-base-content/40">
                          Created: {new Date(template.createdAt).toLocaleString()
                        }</div>
                        <div className="card-actions justify-end mt-2">
                          <button className="btn btn-sm btn-primary" onClick={() => handleApplyTemplate(template._id)}>Apply</button>
                          <button className="btn btn-sm btn-ghost text-error" onClick={() => handleDeleteTemplate(template._id, template.name)}>
                            <Trash2 className="w-4 h-4" />
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
            </div>
          )}
        </div>
        <Footer />
        {/* delete-template modal kept as before */}
        {deleteTemplateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card bg-base-100 w-full max-w-md shadow-xl border border-base-300">
              <div className="card-body space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Delete Template</h3>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setDeleteTemplateModal(null)}
                  >
                    <X size={16}/>
                  </button>
                </div>
                <p className="text-sm">
                  Delete template "<strong>{deleteTemplateModal.name}</strong>"? This cannot be undone.
                </p>
                <div className="card-actions justify-end gap-2">
                  <button
                    className="btn btn-sm"
                    onClick={() => setDeleteTemplateModal(null)}
                  >Cancel</button>
                  <button
                    className="btn btn-sm btn-error"
                    onClick={confirmDeleteTemplate}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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

      {/* Bazaar banner + description */}
      <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* Image Section */}
        <div className="w-full md:w-1/3">
          {(() => {
            const imgSrc = resolveBannerSrc(bazaar?.image);
            return (
              <img
                src={resolveBannerSrc(bazaar?.image)}
                alt="Bazaar Banner"
                className="w-full max-h-48 object-contain rounded-xl shadow-sm"
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
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button className="btn btn-sm btn-outline btn-success gap-2" onClick={() => setShowTemplateModal(true)}>
                <Save className="w-4 h-4" />
                Save as Template
              </button>
              {templates.length > 0 && (
                <button
                  className="btn btn-sm btn-outline btn-info gap-2 whitespace-nowrap"
                  onClick={() => setShowApplyModal(true)}
                >
                  <Package className="w-4 h-4" />
                  View Templates ({templates.length})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditBazaar(true)}>
                Edit Bazaar
              </button>
              <button className="btn btn-sm btn-error" onClick={handleDeleteBazaar} disabled={deletingBazaar}>
                {deletingBazaar ? <span className="loading loading-spinner loading-xs" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div role="tablist" className="tabs tabs-boxed w-full sticky top-0 z-10">
        <button
          role="tab"
          className={`tab text-sm whitespace-nowrap ${bazaarTab === 'shop' ? 'tab-active' : ''}`}
          onClick={() => setBazaarTab('shop')}
        >
          🛍️ Shop
        </button>
        <button
          role="tab"
          className={`tab text-sm whitespace-nowrap ${bazaarTab === 'inventory' ? 'tab-active' : ''}`}
          onClick={() => setBazaarTab('inventory')}
        >
          🎒 Inventory
        </button>
        {user.role === 'teacher' && (
          <button
            role="tab"
            className={`tab text-sm whitespace-nowrap ${bazaarTab === 'create' ? 'tab-active' : ''}`}
            onClick={() => setBazaarTab('create')}
          >
            ➕ Add Item
          </button>
        )}
      </div>

      {/* TAB: SHOP */}
      {bazaarTab === 'shop' && (
        <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-bold text-success flex items-center gap-2">
                <HandCoins />
                Items for Sale
              </h3>
              <span className="badge badge-outline text-sm">
                {sortedFilteredItems.length}/{bazaar.items?.length || 0}
              </span>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                placeholder="Deep search items..."
                className="input input-bordered w-full sm:w-56"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
              />
              <select
                className="select select-bordered w-36"
                value={itemCategory}
                onChange={e => setItemCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="Attack">Attack</option>
                <option value="Defend">Defend</option>
                <option value="Utility">Utility</option>
                <option value="Passive">Passive</option>
                <option value="MysteryBox">MysteryBox</option>
              </select>
              <select
                className="select select-bordered w-40"
                value={itemSort}
                onChange={e => setItemSort(e.target.value)}
              >
                <option value="nameAsc">Name ↑</option>
                <option value="nameDesc">Name ↓</option>
                <option value="priceAsc">Price ↑</option>
                <option value="priceDesc">Price ↓</option>
                <option value="category">Category</option>
                <option value="addedDesc">Newest</option>
                <option value="addedAsc">Oldest</option>
              </select>
              
              {/* ADD: Bulk delete button for teachers */}
              {user.role === 'teacher' && sortedFilteredItems.length > 0 && (
                <button
                  className="btn btn-outline btn-error btn-sm gap-2"
                  onClick={() => setConfirmBulkDelete(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete {sortedFilteredItems.length === bazaar.items?.length ? 'All' : 'Filtered'}
                </button>
              )}
            </div>
          </div>

          <div className="divider my-2" />

            {sortedFilteredItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {sortedFilteredItems.map(item => (
                  <ItemCard
                    key={item._id}
                    item={item}
                    role={user.role}
                    classroomId={classroomId}
                    onEdit={(it) => {
                      setEditItem(it);
                      setShowEditModal(true);
                    }}
                    onDelete={(it) => setDeleteItem(it)} // OPEN MODAL
                  />
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-gray-500">
                <p className="italic">No matching items.</p>
              </div>
            )}
        </div>
      )}

      {/* TAB: INVENTORY */}
      {bazaarTab === 'inventory' && (
        <div className="card bg-base-100 border border-base-300 shadow-md rounded-2xl p-6">
          <InventorySection userId={user._id} classroomId={classroomId} />
        </div>
      )}

      {/* TAB: CREATE ITEM - TEACHER ONLY */}
      {bazaarTab === 'create' && user.role === 'teacher' && (
        <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6 space-y-4">
          <CreateItem
            bazaarId={bazaar._id}
            classroomId={classroomId}
            onAdd={(newItem) =>
              setBazaar(prev => ({ ...prev, items: [...(prev.items || []), newItem] }))
            }
          />
        </div>
      )}

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
              <h2 className="text-xl font-bold mb-4">
                Saved Templates {templates?.length ? `(${templates.length})` : ''}
              </h2>

              <TemplateHelpCollapse hasBazaar={true} />

             <div className="flex flex-wrap gap-2 mb-3">
               <input
                 type="search"
                 className="input input-bordered flex-1 min-w-[200px]"
                 placeholder="Search templates..."
                 value={templateSearch}
                 onChange={(e) => setTemplateSearch(e.target.value)}
               />
               <select
                 className="select select-bordered w-40"
                 value={templateSort}
                 onChange={(e) => setTemplateSort(e.target.value)}
               >
                 <option value="createdDesc">Newest</option>
                 <option value="createdAsc">Oldest</option>
                 <option value="nameAsc">Name ↑</option>
                 <option value="nameDesc">Name ↓</option>
                 <option value="itemsDesc">Items ↓</option>
                 <option value="itemsAsc">Items ↑</option>
               </select>
             </div>
              {templates.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                 {filteredSortedTemplates.map((template) => (
                    <div 
                      key={template._id} 
                      className="card bg-base-200 shadow"
                    >
                      <div className="card-body p-4">
                        <h3 className="font-semibold template-name">
                          {template.name}
                        </h3>
                        <p className="text-sm text-base-content/60">
                          {template.bazaarData.name}
                        </p>
                        {template.sourceClassroom && (
                          <p className="text-xs text-base-content/50 italic">
                            From: {template.sourceClassroom.name}
                            {template.sourceClassroom.code && ` (${template.sourceClassroom.code})`}
                          </p>
                        )}
                        <p className="text-xs text-base-content/50">
                          {template.items?.length || 0} items
                        </p>
                        <div className="text-xs text-base-content/40">
                          Created: {new Date(template.createdAt).toLocaleString()}
                        </div>
                        <div className="card-actions justify-end mt-2">
                          <button
                            className="btn btn-xs btn-ghost text-error"
                            onClick={() => handleDeleteTemplate(template._id, template.name)}
                          >
                            Delete
                          </button>
                          <button
                            className="btn btn-xs btn-primary"
                            onClick={() => handleApplyTemplate(template._id)}
                          >
                            {getTemplateApplyLabel(!!bazaar)}
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

      {/* Delete Item Modal */}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card bg-base-100 w-full max-w-md shadow-xl border border-base-300">
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Delete Item</h3>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => !deleting && setDeleteItem(null)}
                >
                  <X size={16}/>
                </button>
              </div>
              <p className="text-sm">
                Delete "<strong>{deleteItem.name}</strong>" from this Bazaar? This cannot be undone.
              </p>
              <div className="card-actions justify-end gap-2">
                <button
                  className="btn btn-sm"
                  disabled={deleting}
                  onClick={() => setDeleteItem(null)}
                >Cancel</button>
                <button
                  className="btn btn-sm btn-error"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await apiBazaar.delete(`/classroom/${classroomId}/bazaar/${bazaar._id}/items/${deleteItem._id}`);
                      toast.success('Item deleted');
                      setBazaar(prev => ({
                        ...prev,
                        items: prev.items.filter(i => i._id !== deleteItem._id)
                      }));
                      setDeleteItem(null);
                    } catch (e) {
                      toast.error(e.response?.data?.error || 'Delete failed');
                    } finally {
                      setDeleting(false);
                    }
                  }}
                >
                  {deleting ? <span className="loading loading-spinner loading-xs" /> : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && (
        <EditItemModal
          open={showEditModal}
          onClose={() => { setShowEditModal(false); setEditItem(null); }}
          item={editItem}
          classroomId={classroomId}
          bazaarId={bazaar._id}
          onUpdated={(updated) => {
            setBazaar(prev => ({
              ...prev,
              items: prev.items.map(i => i._id === updated._id ? updated : i)
            }));
          }}
        />
      )}

      {/* ADD: Bulk delete confirmation modal */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card bg-base-100 w-full max-w-md shadow-xl border border-base-300">
            <div className="card-body space-y-4">
              <h3 className="text-lg font-bold text-error">Confirm Bulk Delete</h3>
              <p className="text-sm">
                Delete <strong>{sortedFilteredItems.length}</strong> item(s)?
                {sortedFilteredItems.length < bazaar.items?.length && (
                  <span className="block mt-2 text-warning">
                    This will delete only the currently filtered items, not all bazaar items.
                  </span>
                )}
              </p>
              <div className="card-actions justify-end gap-2">
                <button
                  className="btn btn-sm"
                  disabled={bulkDeleting}
                  onClick={() => setConfirmBulkDelete(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-error"
                  disabled={bulkDeleting}
                  onClick={handleBulkDeleteItems}
                >
                  {bulkDeleting ? <span className="loading loading-spinner loading-xs" /> : 'Delete All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE TEMPLATE MODAL */}
      {deleteTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card bg-base-100 w-full max-w-md shadow-xl border border-base-300">
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Delete Template</h3>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDeleteTemplateModal(null)}
                >
                  <X size={16}/>
                </button>
              </div>
              <p className="text-sm">
                Delete template "<strong>{deleteTemplateModal.name}</strong>"? This cannot be undone.
              </p>
              <div className="card-actions justify-end gap-2">
                <button
                  className="btn btn-sm"
                  onClick={() => setDeleteTemplateModal(null)}
                >Cancel</button>
                <button
                  className="btn btn-sm btn-error"
                  onClick={confirmDeleteTemplate}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bazaar Modal */}
      {showEditBazaar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card bg-base-100 w-full max-w-md shadow-xl border border-base-300">
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Edit Bazaar</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowEditBazaar(false)}>Close</button>
              </div>
              <label className="form-control">
                <span className="label-text">Name</span>
                <input className="input input-bordered" value={editBazaarForm.name}
                       onChange={e => setEditBazaarForm(f => ({ ...f, name: e.target.value }))} />
              </label>
              <label className="form-control">
                <span className="label-text">Description</span>
                <textarea className="textarea textarea-bordered" value={editBazaarForm.description}
                          onChange={e => setEditBazaarForm(f => ({ ...f, description: e.target.value }))} />
              </label>
              <div className="form-control">
                <label className="label"><span className="label-text">Image</span><span className="label-text-alt">Optional</span></label>
                <div className="inline-flex rounded-full bg-gray-200 p-1 mb-2">
                  <button type="button" onClick={() => setEditBazaarForm(f => ({ ...f, imageSource: 'file' }))} className={`px-3 py-1 rounded-full ${editBazaarForm.imageSource === 'file' ? 'bg-white shadow' : 'text-gray-600'}`}>Upload</button>
                  <button type="button" onClick={() => setEditBazaarForm(f => ({ ...f, imageSource: 'url' }))} className={`ml-1 px-3 py-1 rounded-full ${editBazaarForm.imageSource === 'url' ? 'bg-white shadow' : 'text-gray-600'}`}>URL</button>
                </div>
                {editBazaarForm.imageSource === 'file' ? (
                  <>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                           className="file-input file-input-bordered w-full"
                           onChange={e => setEditBazaarForm(f => ({ ...f, imageFile: e.target.files[0] }))} />
                    <p className="text-xs text-gray-500 mt-1">Allowed: jpg, png, webp, gif. Max: 5 MB.</p>
                  </>
                ) : (
                  <>
                    <input type="url" className="input input-bordered w-full"
                           placeholder="https://example.com/image.jpg"
                           value={editBazaarForm.imageUrl}
                           onChange={e => setEditBazaarForm(f => ({ ...f, imageUrl: e.target.value }))} />
                    <p className="text-xs text-gray-500 mt-1">Use a direct image URL (jpg, png, webp, gif).</p>
                  </>
                )}
              </div>
              <div className="card-actions justify-end">
                <button className="btn btn-ghost" onClick={() => setShowEditBazaar(false)}>Cancel</button>
                <button className="btn btn-success" onClick={handleUpdateBazaar}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete bazaar modal */}
      <ConfirmModal
        isOpen={confirmDeleteBazaar}
        onClose={() => setConfirmDeleteBazaar(false)}
        onConfirm={confirmDeleteBazaarAction}
        title="Delete Bazaar?"
        message="Delete this Bazaar and all its items? This cannot be undone."
        confirmText={deletingBazaar ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        confirmButtonClass="btn-error"
      />

      <Footer />
    </div>
  );
};

export default Bazaar;
