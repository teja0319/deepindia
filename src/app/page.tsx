'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { 
  Upload, CheckCircle, AlertCircle, Send, FileSpreadsheet, 
  List, ArrowRight, LayoutDashboard, PlusCircle, History, 
  Users, MessageSquare, ExternalLink, Tag, Edit, Trash2
} from 'lucide-react';

export default function WhatsAppSender() {
  const [view, setView] = useState<'dashboard' | 'create' | 'history' | 'contacts'>('dashboard');
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [staticMappings, setStaticMappings] = useState<Record<string, string>>({});
  
  // Real Data States
  const [stats, setStats] = useState({ 
    totalSent: 0, 
    totalFailed: 0, 
    campaigns: 0, 
    totalContacts: 0, 
    deliveryRate: 0, 
    topTemplates: [] as any[],
    recentCampaigns: [] as any[] 
  });
  const [campaignHistory, setCampaignHistory] = useState<any[]>([]);
  const [contactList, setContactList] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Import Contacts State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importTags, setImportTags] = useState('');

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All Tags');

  // Pagination State
  const [historyPage, setHistoryPage] = useState(1);
  const [contactsPage, setContactsPage] = useState(1);
  const itemsPerPage = 10;

  const paginatedHistory = campaignHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);
  const filteredContacts = contactList.filter(c => {
    const matchesSearch = (c.name?.toLowerCase().includes(searchQuery.toLowerCase())) || c.phone.includes(searchQuery);
    const matchesTag = selectedTag === 'All Tags' || c.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });
  const paginatedContacts = filteredContacts.slice((contactsPage - 1) * itemsPerPage, contactsPage * itemsPerPage);

  // Modal State for Logs
  const [selectedCampaignLogs, setSelectedCampaignLogs] = useState<any[]>([]);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [viewingCampaign, setViewingCampaign] = useState<any>(null);

  // Edit Contact State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);

  // Add Contact State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', age: '', tags: '' });

  const fetchCampaignLogs = async (campaign: any) => {
    try {
      setViewingCampaign(campaign);
      const response = await axios.get(`/api/campaigns/${campaign.id}/logs`);
      setSelectedCampaignLogs(response.data);
      setLogModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch logs');
    }
  };

  const handleImportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use filename as default tag
    const fileNameTag = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, ' ');
    setImportTags(fileNameTag);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length > 0) {
        const h = Object.keys(data[0] as any);
        setImportData(data);
        setImportHeaders(h);
        
        // Auto map
        const m: Record<string, string> = {};
        const nameMatch = h.find(x => x.toLowerCase().includes('name'));
        const ageMatch = h.find(x => x.toLowerCase().includes('age'));
        const phoneMatch = h.find(x => ['phone', 'mobile', 'number', 'contact'].some(k => x.toLowerCase().includes(k)));
        if (nameMatch) m['name'] = nameMatch;
        if (ageMatch) m['age'] = ageMatch;
        if (phoneMatch) m['phone'] = phoneMatch;
        setImportMapping(m);
      }
    };
    reader.readAsBinaryString(file);
  };

  const submitImport = async () => {
    if (!importMapping['phone']) return alert('Please map the phone number column');
    
    setIsLoading(true);
    try {
      const contacts = importData.map(row => ({
        name: row[importMapping['name']] || '',
        age: row[importMapping['age']] || null,
        phone: String(row[importMapping['phone']]).replace(/\D/g, '')
      }));
      
      const tags = importTags.split(',').map(t => t.trim()).filter(t => t);
      
      await axios.post('/api/contacts/import', { contacts, tags });
      setImportModalOpen(false);
      setImportData([]);
      setImportTags('');
      setToast({ message: `${contacts.length} Contacts imported successfully!`, type: 'success' });
      setView('contacts');
    } catch (err) {
      console.error('Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteContact = async (id: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      await axios.delete(`/api/contacts/${id}`);
      setContactList(prev => prev.filter(c => c.id !== id));
      setToast({ message: 'Contact deleted successfully', type: 'success' });
    } catch (err) {
      console.error('Delete failed');
      setToast({ message: 'Failed to delete contact', type: 'error' });
    }
  };

  const handleUpdateContact = async () => {
    if (!editingContact) return;
    
    setIsLoading(true);
    try {
      const tags = typeof editingContact.tags === 'string' 
        ? editingContact.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t)
        : editingContact.tags;

      await axios.patch(`/api/contacts/${editingContact.id}`, {
        name: editingContact.name,
        age: editingContact.age,
        phone: editingContact.phone,
        tags: tags
      });
      
      // Update local state
      setContactList(prev => prev.map(c => 
        c.id === editingContact.id ? { ...editingContact, tags: tags } : c
      ));
      
      setEditModalOpen(false);
      setToast({ message: 'Contact updated successfully', type: 'success' });
    } catch (err) {
      console.error('Update failed');
      setToast({ message: 'Failed to update contact', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!newContact.phone) return alert('Phone number is required');
    
    setIsLoading(true);
    try {
      const tags = newContact.tags
        ? newContact.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t)
        : [];

      const payload = {
        name: newContact.name,
        phone: newContact.phone.replace(/\D/g, ''),
        age: newContact.age ? Number(newContact.age) : null,
        tags: tags
      };

      const response = await axios.post('/api/contacts', payload);
      
      if (response.data.success) {
        const newlyAdded = {
          id: response.data.contactId,
          name: payload.name,
          phone: payload.phone,
          age: payload.age,
          tags: tags,
          joined: new Date().toISOString()
        };

        setContactList(prev => [newlyAdded, ...prev]);
        setAddModalOpen(false);
        setToast({ message: 'Contact added successfully!', type: 'success' });
      }
    } catch (err: any) {
      console.error('Add contact failed:', err);
      const msg = err.response?.data?.error || 'Failed to add contact';
      setToast({ message: msg, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const [excelData, setExcelData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState({ total: 0, current: 0, success: 0, fail: 0 });
  const [isSending, setIsSending] = useState(false);

  // Recipient Source Selection
  const [recipientSource, setRecipientSource] = useState<'excel' | 'existing'>('excel');
  const [selectedTagForCampaign, setSelectedTagForCampaign] = useState('All Tags');
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [campaignContactSearch, setCampaignContactSearch] = useState('');

  const filteredCampaignContacts = contactList.filter(c => {
    const matchesTag = selectedTagForCampaign === 'All Tags' || c.tags.includes(selectedTagForCampaign);
    const matchesSearch = !campaignContactSearch || 
      (c.name?.toLowerCase().includes(campaignContactSearch.toLowerCase())) || 
      c.phone.includes(campaignContactSearch);
    return matchesTag && matchesSearch;
  });

  useEffect(() => {
    const initFetch = async () => {
      setIsDataLoading(true);
      try {
        const [statsRes, historyRes, contactsRes, logsRes, templatesRes] = await Promise.all([
          axios.get('/api/stats'),
          axios.get('/api/campaigns'),
          axios.get('/api/contacts'),
          axios.get('/api/logs/recent'),
          axios.get('/api/templates')
        ]);
        setStats(statsRes.data);
        setCampaignHistory(historyRes.data);
        setContactList(contactsRes.data);
        setRecentLogs(logsRes.data);
        setTemplates(templatesRes.data);
      } catch (err) {
        console.error('Failed to fetch data');
      } finally {
        setIsDataLoading(false);
      }
    };
    initFetch();
  }, [view]);

  const Skeleton = ({ type }: { type: 'card' | 'title' | 'text' | 'table' | 'chart' }) => {
    if (type === 'card') return <div className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-xl)' }}></div>;
    if (type === 'title') return <div className="skeleton" style={{ height: '1.75rem', width: '200px', marginBottom: '1rem' }}></div>;
    if (type === 'text') return <div className="skeleton" style={{ height: '1rem', width: '100%', marginBottom: '0.5rem' }}></div>;
    if (type === 'chart') return <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--radius-xl)' }}></div>;
    if (type === 'table') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: '3rem', width: '100%' }}></div>)}
      </div>
    );
    return null;
  };

  const [uploadFileName, setUploadFileName] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name.split('.')[0]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length > 0) {
        const detectedHeaders = Object.keys(data[0] as any);
        setExcelData(data);
        setHeaders(detectedHeaders);
        
        const newMapping: Record<string, string> = { ...mapping };
        const phoneKeywords = ['phone', 'mobile', 'number', 'contact', 'recipient', 'to', 'cell'];
        const phoneHeader = detectedHeaders.find(h => phoneKeywords.some(k => h.toLowerCase().includes(k)));
        if (phoneHeader) newMapping['phone'] = phoneHeader;

        const nameKeywords = ['name', 'full name', 'contact', 'customer', 'patient', 'beneficiary'];
        const nameHeader = detectedHeaders.find(h => nameKeywords.some(k => h.toLowerCase().includes(k)));
        if (nameHeader) newMapping['contact_name'] = nameHeader;

        if (selectedTemplate) {
          const vars = getTemplateVariables(selectedTemplate);
          vars.forEach(v => {
            const match = detectedHeaders.find(h => 
              h.toLowerCase() === v.id.toLowerCase() || 
              h.toLowerCase().replace(/[^a-z0-9]/g, '') === v.id.toLowerCase().replace(/[^a-z0-9]/g, '')
            );
            if (match) newMapping[v.id] = match;
          });
        }
        setMapping(newMapping);
        setStep(3);
      }
    };
    reader.readAsBinaryString(file);
  };

  const getTemplateVariables = (template: any) => {
    const variables: { id: string, component: string, type?: string }[] = [];
    template.components.forEach((comp: any) => {
      if (comp.text) {
        const matches = comp.text.match(/{{([^}]+)}}/g);
        if (matches) {
          matches.forEach((m: string) => {
            const id = m.replace(/{{|}}/g, '');
            if (!variables.find(v => v.id === id)) {
              variables.push({ id, component: comp.type });
            }
          });
        }
      }
      if (comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
        variables.push({ id: 'HEADER_MEDIA', component: 'HEADER', type: comp.format });
      }
    });
    return variables;
  };

  const handleBulkSend = async () => {
    if (!selectedTemplate || !mapping['phone']) return;
    setIsSending(true);
    setStep(4);
    setProgress({ total: excelData.length, current: 0, success: 0, fail: 0 });

    const getParamValue = (vId: string, row: any, type?: string) => {
      let val = '';
      if (mapping[vId] === '__STATIC__') {
        val = staticMappings[vId] || '';
      } else if (mapping[vId]) {
        val = String(row[mapping[vId]] || '');
      }

      // Fallback for media header if empty
      if (!val && vId === 'HEADER_MEDIA' && type) {
        const headerComp = selectedTemplate.components.find((c: any) => c.type === 'HEADER');
        if (headerComp && headerComp.format === type) {
          if (type === 'IMAGE') {
            val = headerComp.example?.header_handle?.[0] || '';
          } else if (type === 'DOCUMENT') {
            val = headerComp.example?.document_handle?.[0] || '';
          } else if (type === 'VIDEO') {
            val = headerComp.example?.video_handle?.[0] || '';
          }
        }
      }
      return val;
    };

    try {
      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        const phoneNumber = String(row[mapping['phone']]).replace(/\D/g, '');
        const contactName = mapping['contact_name'] && mapping['contact_name'] !== '__STATIC__' ? String(row[mapping['contact_name']] || '') : null;
        const contactAge = mapping['age'] && mapping['age'] !== '__STATIC__' ? Number(row[mapping['age']]) || null : null;
        
        if (!phoneNumber) {
          setProgress(prev => ({ ...prev, current: i + 1, fail: prev.fail + 1 }));
          continue;
        }

        const templateVars = getTemplateVariables(selectedTemplate);
        const bodyParams = templateVars.filter(v => v.component === 'BODY').map(v => {
          const val = getParamValue(v.id, row);
          const param: any = { type: 'text', text: val };
          if (isNaN(Number(v.id))) param.parameter_name = v.id;
          return param;
        });
        const headerParams = templateVars.filter(v => v.component === 'HEADER').map(v => {
          const val = getParamValue(v.id, row, v.type);
          if (v.id === 'HEADER_MEDIA' && v.type) {
            const mediaType = v.type.toLowerCase();
            const param: any = {
              type: mediaType,
              [mediaType]: {
                link: val
              }
            };
            if (mediaType === 'document') {
              let filename = 'document.pdf';
              try {
                const url = new URL(val);
                const pathname = url.pathname;
                const base = pathname.substring(pathname.lastIndexOf('/') + 1);
                if (base && base.includes('.')) {
                  filename = base;
                }
              } catch (e) {}
              param.document.filename = filename;
            }
            return param;
          } else {
            const param: any = { type: 'text', text: val };
            if (isNaN(Number(v.id))) param.parameter_name = v.id;
            return param;
          }
        });

        const apiComponents = [];
        if (headerParams.length > 0) apiComponents.push({ type: 'header', parameters: headerParams });
        if (bodyParams.length > 0) apiComponents.push({ type: 'body', parameters: bodyParams });

        try {
          await axios.post('/api/send', {
            to: phoneNumber,
            templateName: selectedTemplate.name,
            languageCode: selectedTemplate.language,
            components: apiComponents,
            campaignName: campaignName,
            contactName: contactName,
            age: contactAge,
            tags: uploadFileName ? [uploadFileName] : []
          });
          setProgress(prev => ({ ...prev, current: i + 1, success: prev.success + 1 }));
        } catch (err: any) {
          setProgress(prev => ({ ...prev, current: i + 1, fail: prev.fail + 1 }));
        }
      }
    } catch (err) {
      console.error('Bulk send error', err);
    } finally {
      setIsSending(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="logo">
          <MessageSquare size={24} color="var(--primary)" /> Deep
        </div>
        <nav>
          <a 
            href="#" 
            className={`nav-item ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            <LayoutDashboard size={18} /> Dashboard
          </a>
          <a 
            href="#" 
            className={`nav-item ${view === 'create' ? 'active' : ''}`}
            onClick={() => { setView('create'); setStep(1); }}
          >
            <PlusCircle size={18} /> Create Campaign
          </a>
          <a 
            href="#" 
            className={`nav-item ${view === 'history' ? 'active' : ''}`}
            onClick={() => setView('history')}
          >
            <History size={18} /> Campaign History
          </a>
          <a 
            href="#" 
            className={`nav-item ${view === 'contacts' ? 'active' : ''}`}
            onClick={() => setView('contacts')}
          >
            <Users size={18} /> All Contacts
          </a>
        </nav>

        {/* <div className="sidebar-status">
          <div className="status-label">Connected To</div>
          <div className="status-value">
            <span className="status-dot"></span>
            Azure MySQL
          </div>
        </div> */}
      </div>

      <main className="main-content">
        {view === 'dashboard' && (
          <div className="fade-in">
            {isDataLoading ? <Skeleton type="title" /> : (
              <h1>Dashboard Overview<span className="subtitle">Monitor your messaging activity and campaign performance</span></h1>
            )}
            <div className="grid" style={{ gridTemplateColumns: isDataLoading ? 'repeat(4, 1fr)' : 'repeat(4, 1fr)', gap: '1.25rem', marginTop: '1.5rem' }}>
              {isDataLoading ? (
                <>
                  <Skeleton type="card" />
                  <Skeleton type="card" />
                  <Skeleton type="card" />
                  <Skeleton type="card" />
                </>
              ) : (
                <>
                  <div className="glass-card stat-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sent</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>{stats.totalSent}</div>
                      </div>
                      <div style={{ background: 'var(--primary-dim)', padding: '0.65rem', borderRadius: 'var(--radius-md)', color: 'var(--primary)' }}>
                        <Send size={22} />
                      </div>
                    </div>
                  </div>
                  <div className="glass-card stat-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--info)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaigns</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>{stats.campaigns}</div>
                      </div>
                      <div style={{ background: 'var(--info-bg)', padding: '0.65rem', borderRadius: 'var(--radius-md)', color: 'var(--info)' }}>
                        <History size={22} />
                      </div>
                    </div>
                  </div>
                  <div className="glass-card stat-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--warning)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Rate</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>{stats.deliveryRate}%</div>
                      </div>
                      <div style={{ background: 'var(--warning-bg)', padding: '0.65rem', borderRadius: 'var(--radius-md)', color: 'var(--warning)' }}>
                        <CheckCircle size={22} />
                      </div>
                    </div>
                  </div>
                  <div className="glass-card stat-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--purple)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Contacts</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>{stats.totalContacts}</div>
                      </div>
                      <div style={{ background: 'var(--purple-bg)', padding: '0.65rem', borderRadius: 'var(--radius-md)', color: 'var(--purple)' }}>
                        <Users size={22} />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="grid" style={{ gridTemplateColumns: isDataLoading ? '1fr' : '1.5fr 1fr', gap: '2rem', marginTop: '2rem' }}>
              {isDataLoading ? (
                <>
                  <Skeleton type="chart" />
                  <Skeleton type="chart" />
                </>
              ) : (
                <>
                  <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Top Templates Performance</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {stats.topTemplates.map((t, i) => (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 600 }}>{t.name.replace(/_/g, ' ')}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{t.usage_count} uses</span>
                          </div>
                          <div className="progress-bar-track" style={{ height: '8px' }}>
                            <div 
                              className="progress-bar-fill" 
                              style={{ 
                                width: `${(Number(t.success) / (Number(t.success) + Number(t.fail) || 1)) * 100}%`,
                                background: 'var(--primary)'
                              }}
                            ></div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span>Success: {t.success}</span>
                            <span>Failed: {t.fail}</span>
                          </div>
                        </div>
                      ))}
                      {stats.topTemplates.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No template data yet</p>}
                    </div>
                  </div>

                  <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Recent Campaigns Performance</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {stats.recentCampaigns.map((c, i) => (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{c.total} total</span>
                          </div>
                          <div className="progress-bar-track" style={{ height: '6px', background: '#fee2e2' }}>
                            <div 
                              className="progress-bar-fill" 
                              style={{ 
                                width: `${(Number(c.success) / (Number(c.total) || 1)) * 100}%`,
                                background: 'var(--primary)'
                              }}
                            ></div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            <span>{Math.round((c.success / (c.total || 1)) * 100)}% Success</span>
                            <span>{c.fail} failed</span>
                          </div>
                        </div>
                      ))}
                      {stats.recentCampaigns.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No campaign data yet</p>}
                    </div>
                  </div>

                  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', gap: '4rem', alignItems: 'center' }}>
                      <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                        <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                          <circle 
                            cx="18" cy="18" r="16" fill="none" stroke="var(--primary)" 
                            strokeWidth="3" strokeDasharray={`${stats.deliveryRate}, 100`} 
                          />
                        </svg>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.25rem', fontWeight: 800 }}>
                          {stats.deliveryRate}%
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'left' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Overall Success Rate</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '300px', marginBottom: '1.5rem' }}>
                          Aggregated performance across all templates and manual sends.
                        </p>
                        <div style={{ display: 'flex', gap: '2rem' }}>
                          <div>
                            <div style={{ color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 800 }}>{stats.totalSent}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Delivered</div>
                          </div>
                          <div style={{ width: '1px', background: '#e2e8f0' }}></div>
                          <div>
                            <div style={{ color: 'var(--error)', fontSize: '1.5rem', fontWeight: 800 }}>{stats.totalFailed}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Failed</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="glass-card" style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem' }}>Recent Activity</h3>
                <button className="btn-outline" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }} onClick={() => setView('history')}>View All</button>
              </div>
              {isDataLoading ? <Skeleton type="table" /> : (
                <div style={{ overflow: 'hidden', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--bg-surface)' }}>
                        <th style={{ padding: '0.85rem 1.25rem' }}>Phone Number</th>
                        <th style={{ padding: '0.85rem 1.25rem' }}>Campaign</th>
                        <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
                        <th style={{ padding: '0.85rem 1.25rem' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.map((log, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                          <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>{log.phone_number}</td>
                          <td style={{ padding: '0.85rem 1.25rem' }}>{log.campaign_name || 'Individual'}</td>
                          <td style={{ padding: '0.85rem 1.25rem' }}>
                            <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-error'}`}>
                              {log.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {new Date(log.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                      {recentLogs.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                            <div style={{ background: 'var(--bg-elevated)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                              <List size={28} opacity={0.3} />
                            </div>
                            <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No activity logs yet</p>
                            <p style={{ fontSize: '0.85rem' }}>Your campaign logs will appear here once you start sending messages.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="fade-in">
            <h1 style={{ fontSize: '2rem', fontWeight: 800, textAlign: 'center', marginBottom: '0.25rem' }}>
              Create New Campaign
              <span className="subtitle" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem', fontWeight: 400 }}>
                Launch a targeted WhatsApp template broadcast in a few simple steps
              </span>
            </h1>

            {/* Premium Stepper */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
              maxWidth: '820px',
              margin: '2.5rem auto 3.5rem auto',
              padding: '0 1.5rem'
            }}>
              {/* Stepper progress track background */}
              <div style={{
                position: 'absolute',
                top: '20px',
                left: '3rem',
                right: '3rem',
                height: '4px',
                background: '#e2e8f0',
                borderRadius: '2px',
                zIndex: 1
              }}></div>
              
              {/* Stepper active progress line */}
              <div style={{
                position: 'absolute',
                top: '20px',
                left: '3rem',
                width: `${((step - 1) / 3) * 88}%`,
                height: '4px',
                background: 'linear-gradient(90deg, var(--primary), #34d399)',
                borderRadius: '2px',
                zIndex: 1,
                transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)'
              }}></div>

              {/* Step Bubbles */}
              {[
                { number: 1, label: 'Select Template' },
                { number: 2, label: 'Upload Excel' },
                { number: 3, label: 'Map Variables' },
                { number: 4, label: 'Track Status' }
              ].map((s) => {
                const isActive = step === s.number;
                const isCompleted = step > s.number;
                return (
                  <div key={s.number} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: 2,
                    position: 'relative'
                  }}>
                    {/* Bubble */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: isCompleted ? 'linear-gradient(135deg, var(--primary), #10b981)' : isActive ? 'white' : '#f8fafc',
                      border: isCompleted ? 'none' : isActive ? '3.5px solid var(--primary)' : '2.5px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isCompleted ? 'white' : isActive ? 'var(--primary)' : '#94a3b8',
                      fontWeight: '700',
                      fontSize: '0.95rem',
                      boxShadow: isActive ? '0 0 0 5px rgba(37, 211, 102, 0.15), 0 4px 12px rgba(15, 23, 42, 0.08)' : isCompleted ? '0 2px 6px rgba(37, 211, 102, 0.2)' : 'none',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                      {isCompleted ? '✓' : s.number}
                    </div>
                    {/* Label */}
                    <span style={{
                      marginTop: '0.75rem',
                      fontSize: '0.78rem',
                      fontWeight: isActive || isCompleted ? '700' : '500',
                      color: isActive ? 'var(--text-main)' : isCompleted ? 'var(--primary-hover)' : 'var(--text-faint)',
                      textAlign: 'center',
                      transition: 'color 0.3s ease',
                      whiteSpace: 'nowrap'
                    }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="glass-card">
              {step === 1 && (
                <div className="fade-in">
                  <div style={{ 
                    marginBottom: '2.5rem', 
                    background: 'linear-gradient(145deg, #ffffff, #f8fafc)', 
                    padding: '2rem', 
                    borderRadius: 'var(--radius-xl)', 
                    border: '1px solid rgba(0, 0, 0, 0.05)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
                  }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--text-main)' }}>
                      <LayoutDashboard size={20} color="var(--primary)" /> Name your Campaign
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                        Campaign Display Name <span style={{ color: 'var(--error)' }}>*</span>
                      </label>
                      <div className="input-with-icon-wrapper" style={{ position: 'relative' }}>
                        <input 
                          type="text" 
                          placeholder="e.g. Vaccination Announcement June 2026" 
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value)}
                          style={{ 
                            background: 'white', 
                            border: !campaignName ? '1.5px solid #cbd5e1' : '1.5px solid var(--primary)',
                            paddingLeft: '2.75rem',
                            height: '52px',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            borderRadius: 'var(--radius-md)'
                          }}
                        />
                        <Tag size={18} style={{ 
                          color: !campaignName ? '#94a3b8' : 'var(--primary)',
                          transition: 'color 0.2s ease'
                        }} />
                      </div>
                      {!campaignName && <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem', fontWeight: 500 }}>Campaign name is required to continue</p>}
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--text-main)' }}>
                      <MessageSquare size={22} color="var(--primary)" /> Select Message Template
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Choose an approved template below. This template will define the layout and header format of your campaign.</p>
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {isDataLoading ? (
                      <>
                        <Skeleton type="card" />
                        <Skeleton type="card" />
                        <Skeleton type="card" />
                      </>
                    ) : (
                      <>
                        {templates.map((t) => {
                          const headerComp = t.components.find((c: any) => c.type === 'HEADER');
                          const imageUrl = headerComp && headerComp.format === 'IMAGE' ? headerComp.example?.header_handle?.[0] : null;
                          const isSelected = selectedTemplate?.name === t.name;
                          return (
                            <div 
                              key={t.name} 
                              className={`glass-card template-card ${isSelected ? 'active-border' : ''}`}
                              style={{ 
                                cursor: 'pointer', 
                                padding: '1.5rem', 
                                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--card-border)',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                transition: 'var(--transition)'
                              }}
                              onClick={() => setSelectedTemplate(t)}
                            >
                              {isSelected && (
                                <div style={{
                                  position: 'absolute',
                                  top: '1rem',
                                  right: '1rem',
                                  background: 'var(--primary)',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '22px',
                                  height: '22px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 2px 8px rgba(37, 211, 102, 0.4)',
                                  zIndex: 10
                                }}>
                                  <CheckCircle size={14} strokeWidth={3} />
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingRight: isSelected ? '1.5rem' : '0' }}>
                                <span className={`badge ${
                                  t.category === 'MARKETING' ? 'badge-marketing' :
                                  t.category === 'UTILITY' ? 'badge-utility' :
                                  t.category === 'AUTHENTICATION' ? 'badge-authentication' : 'badge-success'
                                }`}>{t.category}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.language}</span>
                              </div>
                              {imageUrl && (
                                <div style={{ 
                                  width: '100%', 
                                  height: '140px', 
                                  borderRadius: 'var(--radius-md)', 
                                  overflow: 'hidden', 
                                  marginBottom: '1rem',
                                  background: '#f1f5f9',
                                  position: 'relative'
                                }}>
                                  <img 
                                    src={imageUrl} 
                                    alt={t.name} 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                              {headerComp && headerComp.format === 'IMAGE' && !imageUrl && (
                                <div style={{ 
                                  width: '100%', 
                                  height: '140px', 
                                  borderRadius: 'var(--radius-md)', 
                                  overflow: 'hidden', 
                                  marginBottom: '1rem',
                                  background: 'var(--bg-elevated)',
                                  border: '1px dashed var(--card-border)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--text-muted)'
                                }}>
                                  <Upload size={24} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                                  <span style={{ fontSize: '0.75rem' }}>Image Header Template</span>
                                </div>
                              )}
                              {headerComp && headerComp.format === 'VIDEO' && (
                                <div style={{ 
                                  width: '100%', 
                                  height: '140px', 
                                  borderRadius: 'var(--radius-md)', 
                                  overflow: 'hidden', 
                                  marginBottom: '1rem',
                                  background: 'var(--bg-elevated)',
                                  border: '1px dashed var(--card-border)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--text-muted)'
                                }}>
                                  <ExternalLink size={24} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                                  <span style={{ fontSize: '0.75rem' }}>Video Header Template</span>
                                </div>
                              )}
                              {headerComp && headerComp.format === 'DOCUMENT' && (
                                <div style={{ 
                                  width: '100%', 
                                  height: '140px', 
                                  borderRadius: 'var(--radius-md)', 
                                  overflow: 'hidden', 
                                  marginBottom: '1rem',
                                  background: 'var(--bg-elevated)',
                                  border: '1px dashed var(--card-border)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--text-muted)'
                                }}>
                                  <FileSpreadsheet size={24} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                                  <span style={{ fontSize: '0.75rem' }}>Document Header Template</span>
                                </div>
                              )}
                              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>{t.name.replace(/_/g, ' ')}</h3>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {t.components.find((c: any) => c.type === 'BODY')?.text}
                              </p>
                            </div>
                          );
                        })}
                        {templates.length === 0 && (
                          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '1.5rem', border: '1px dashed var(--card-border)' }}>
                            <p style={{ color: 'var(--text-muted)' }}>No templates found. Check your WhatsApp Business account.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {selectedTemplate && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem' }}>
                      <button 
                        className="btn-primary" 
                        style={{ padding: '1rem 3rem' }} 
                        disabled={!campaignName}
                        onClick={() => setStep(2)}
                      >
                        Next Step <ArrowRight size={20} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="fade-in">
                  <div style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Select Recipients</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Choose how you want to add people to this campaign.</p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: 'var(--bg-elevated)', padding: '0.35rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--card-border)' }}>
                    <button 
                      className={`btn-outline ${recipientSource === 'excel' ? 'active-border' : ''}`} 
                      style={{ flex: 1, border: 'none', background: recipientSource === 'excel' ? 'white' : 'transparent' }}
                      onClick={() => setRecipientSource('excel')}
                    >
                      <FileSpreadsheet size={18} /> Upload Excel
                    </button>
                    <button 
                      className={`btn-outline ${recipientSource === 'existing' ? 'active-border' : ''}`} 
                      style={{ flex: 1, border: 'none', background: recipientSource === 'existing' ? 'white' : 'transparent' }}
                      onClick={() => setRecipientSource('existing')}
                    >
                      <Users size={18} /> Choose Contacts
                    </button>
                  </div>

                  {recipientSource === 'excel' ? (
                    <label className="upload-area" style={{ padding: '6rem 2rem' }}>
                      <input type="file" hidden onChange={handleFileUpload} accept=".xlsx, .xls, .csv" />
                      <div style={{ background: 'rgba(37, 211, 102, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <FileSpreadsheet size={40} style={{ color: 'var(--primary)' }} />
                      </div>
                      <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Drop your Excel here</p>
                      <p style={{ color: 'var(--text-muted)' }}>or click to browse your files</p>
                    </label>
                  ) : (
                    <div className="fade-in">
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 2, minWidth: '200px' }}>
                          <input 
                            type="text" 
                            placeholder="Search by name or number..." 
                            value={campaignContactSearch}
                            onChange={(e) => setCampaignContactSearch(e.target.value)}
                            style={{ paddingLeft: '2.5rem' }}
                          />
                          <Users size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        </div>
                        <select 
                          style={{ flex: 1, minWidth: '150px' }} 
                          value={selectedTagForCampaign}
                          onChange={(e) => setSelectedTagForCampaign(e.target.value)}
                        >
                          <option>All Tags</option>
                          {Array.from(new Set(contactList.flatMap(c => c.tags))).map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
                          ))}
                        </select>
                        <button className="btn-outline" onClick={() => {
                          setSelectedContactIds(filteredCampaignContacts.map(c => c.id));
                        }}>Select All Filtered</button>
                      </div>

                      <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '1rem' }}>
                        {isDataLoading ? <Skeleton type="table" /> : (
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody style={{ background: 'white' }}>
                              {filteredCampaignContacts.map(contact => (
                                <tr key={contact.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '1rem' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={selectedContactIds.includes(contact.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) setSelectedContactIds(prev => [...prev, contact.id]);
                                        else setSelectedContactIds(prev => prev.filter(id => id !== contact.id));
                                      }}
                                    />
                                  </td>
                                  <td style={{ padding: '1rem', fontWeight: 600 }}>{contact.name || 'Anonymous'}</td>
                                  <td style={{ padding: '1rem' }}>{contact.phone}</td>
                                  <td style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                      {contact.tags.slice(0, 2).map((t: string) => <span key={t} className="badge" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>{t}</span>)}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                      
                      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn-primary" 
                          disabled={selectedContactIds.length === 0}
                          onClick={() => {
                            // Convert selected contacts to excelData format for Step 3 logic
                            const contactsToUse = contactList.filter(c => selectedContactIds.includes(c.id));
                            const formattedData = contactsToUse.map(c => ({
                              phone: c.phone,
                              name: c.name,
                              age: c.age,
                              // Add any other fields that might be mapped
                            }));
                            setExcelData(formattedData);
                            setHeaders(['phone', 'name', 'age']);
                            setMapping({ phone: 'phone', contact_name: 'name' });
                            setStep(3);
                          }}
                        >
                          Next: Map Variables ({selectedContactIds.length}) <ArrowRight size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '2rem' }}>
                    <button className="btn-outline" onClick={() => setStep(1)}>Back</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="fade-in">
                  <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Map Variables</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Link your Excel columns to the dynamic fields in your template.</p>
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: '2.5rem' }}>
                    <div className="mapping-container">
                      <div className="mapping-row" style={{ borderLeft: '4px solid var(--primary)', background: 'rgba(37, 211, 102, 0.02)' }}>
                        <label style={{ color: 'var(--primary)' }}>Phone Number Column</label>
                        <select value={mapping['phone'] || ''} onChange={(e) => setMapping(prev => ({ ...prev, phone: e.target.value }))}>
                          <option value="">Select Column</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div className="mapping-row" style={{ borderLeft: '4px solid #3b82f6', background: 'rgba(59, 130, 246, 0.02)', marginTop: '0.5rem' }}>
                        <label style={{ color: '#3b82f6' }}>Contact Name Column (Optional)</label>
                        <select value={mapping['contact_name'] || ''} onChange={(e) => setMapping(prev => ({ ...prev, contact_name: e.target.value }))}>
                          <option value="">Select Column</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div className="mapping-row" style={{ borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.02)', marginTop: '0.5rem' }}>
                        <label style={{ color: '#f59e0b' }}>Age Column (Optional)</label>
                        <select value={mapping['age'] || ''} onChange={(e) => setMapping(prev => ({ ...prev, age: e.target.value }))}>
                          <option value="">Select Column</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div style={{ margin: '2rem 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Template Variables</div>
                      {getTemplateVariables(selectedTemplate).map((v) => (
                        <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
                          <div className="mapping-row" style={{ marginBottom: 0 }}>
                            <label>
                              {v.id === 'HEADER_MEDIA' ? `Header ${v.type ? v.type.charAt(0) + v.type.slice(1).toLowerCase() : 'Media'}` : `{{${v.id}}}`}
                              <span style={{ fontWeight: 400, opacity: 0.6, fontSize: '0.8rem', marginLeft: '0.5rem' }}>({v.component})</span>
                            </label>
                            <select 
                              value={mapping[v.id] || ''} 
                              onChange={(e) => {
                                const val = e.target.value;
                                setMapping(prev => ({ ...prev, [v.id]: val }));
                              }}
                            >
                              <option value="">Select Column</option>
                              <option value="__STATIC__">Use Static Value / URL</option>
                              {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                          {mapping[v.id] === '__STATIC__' && (
                            <div style={{ paddingLeft: '0.5rem', borderLeft: '2px solid var(--primary)', marginLeft: '0.5rem' }}>
                              <input
                                type="text"
                                placeholder={v.id === 'HEADER_MEDIA' ? `Enter static ${v.type ? v.type.toLowerCase() : 'media'} URL (e.g., https://...)` : `Enter static text value`}
                                value={staticMappings[v.id] || ''}
                                onChange={(e) => setStaticMappings(prev => ({ ...prev, [v.id]: e.target.value }))}
                                style={{ 
                                  padding: '0.5rem 0.75rem', 
                                  fontSize: '0.85rem', 
                                  width: '100%', 
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid #cbd5e1'
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ marginBottom: '1rem', fontWeight: 600, color: '#64748b', fontSize: '0.875rem' }}>LIVE PREVIEW</div>
                      <div className="whatsapp-preview">
                        <div className="preview-header">
                          <div className="avatar">P</div>
                          <div className="info">
                            <div className="name">WhatsApp Preview</div>
                            <div className="status">Online</div>
                          </div>
                        </div>
                        <div className="message-container">
                          {selectedTemplate.components.map((comp: any, i: number) => (
                            <div key={i}>
                              {comp.type === 'HEADER' && (
                                <div>
                                  {comp.text && <div className="header-text">{comp.text}</div>}
                                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format) && (
                                    <div className="header-media-preview" style={{ 
                                      background: '#f8fafc', 
                                      border: '1px dashed #cbd5e1', 
                                      borderRadius: 'var(--radius-md)', 
                                      overflow: 'hidden', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center', 
                                      minHeight: '140px', 
                                      marginBottom: '0.75rem',
                                      position: 'relative'
                                    }}>
                                      {(() => {
                                        const mappedValue = mapping['HEADER_MEDIA'] === '__STATIC__' 
                                          ? staticMappings['HEADER_MEDIA'] 
                                          : (excelData[0] && mapping['HEADER_MEDIA'] ? String(excelData[0][mapping['HEADER_MEDIA']] || '') : '');

                                        if (!mappedValue) {
                                          return (
                                            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '1rem' }}>
                                              <Upload size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.6 }} />
                                              <span>No {comp.format.toLowerCase()} URL provided yet</span>
                                            </div>
                                          );
                                        }

                                        if (comp.format === 'IMAGE') {
                                          return (
                                            <img 
                                              src={mappedValue} 
                                              alt="Header Preview" 
                                              style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: '180px' }}
                                              onError={(e) => {
                                                (e.target as HTMLElement).style.display = 'none';
                                                const parent = (e.target as HTMLElement).parentElement;
                                                if (parent && !parent.querySelector('.error-msg')) {
                                                  const fallback = document.createElement('div');
                                                  fallback.className = 'error-msg';
                                                  fallback.style.padding = '1rem';
                                                  fallback.style.fontSize = '0.8rem';
                                                  fallback.style.color = '#ef4444';
                                                  fallback.innerText = 'Invalid Image URL';
                                                  parent.appendChild(fallback);
                                                }
                                              }}
                                            />
                                          );
                                        } else if (comp.format === 'VIDEO') {
                                          return (
                                            <video 
                                              src={mappedValue} 
                                              controls 
                                              style={{ width: '100%', maxHeight: '180px' }} 
                                            />
                                          );
                                        } else if (comp.format === 'DOCUMENT') {
                                          return (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', color: '#334155' }}>
                                              <FileSpreadsheet size={24} color="var(--primary)" />
                                              <span style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                                {mappedValue.substring(mappedValue.lastIndexOf('/') + 1) || 'document.pdf'}
                                              </span>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  )}
                                </div>
                              )}
                              {comp.type === 'BODY' && (
                                <div className="body-text">
                                  {comp.text?.split(/({{[^}]+}})/).map((part: string, idx: number) => {
                                    const match = part.match(/{{([^}]+)}}/);
                                    if (match) {
                                      const vId = match[1];
                                      const isMapped = mapping[vId] && mapping[vId] !== '';
                                      const value = mapping[vId] === '__STATIC__' 
                                        ? staticMappings[vId] 
                                        : (excelData[0] && mapping[vId] ? excelData[0][mapping[vId]] : part);
                                      return <span key={idx} className={`variable ${isMapped ? 'mapped' : 'unmapped'}`}>{isMapped ? value : part}</span>;
                                    }
                                    return part;
                                  })}
                                </div>
                              )}
                              {comp.type === 'FOOTER' && <div className="footer-text">{comp.text}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
                    <button className="btn-outline" onClick={() => setStep(2)}>Back</button>
                    <button className="btn-primary" style={{ flex: 1 }} onClick={handleBulkSend}>
                      <Send size={20} /> Start Bulk Campaign
                    </button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="fade-in" style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ background: 'rgba(37, 211, 102, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                    <CheckCircle size={40} style={{ color: 'var(--primary)' }} />
                  </div>
                  <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Campaign in Progress</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '3rem' }}>We are processing your list. Do not close this tab.</p>
                  
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', maxWidth: '500px', margin: '0 auto 3rem' }}>
                    <div className="glass-card" style={{ padding: '2rem' }}>
                      <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--primary)' }}>{progress.success}</div>
                      <div style={{ fontWeight: 600, color: '#64748b' }}>Success</div>
                    </div>
                    <div className="glass-card" style={{ padding: '2rem' }}>
                      <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--error)' }}>{progress.fail}</div>
                      <div style={{ fontWeight: 600, color: '#64748b' }}>Failed</div>
                    </div>
                  </div>

                  <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
                      <span>Sending Progress ({progress.current}/{progress.total})</span>
                      <span>{Math.round((progress.current / (progress.total || 1)) * 100)}%</span>
                    </div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}></div>
                    </div>
                  </div>

                  {!isSending && (
                    <button className="btn-primary" style={{ marginTop: '4rem', marginInline: 'auto' }} onClick={() => setView('dashboard')}>
                      Return to Dashboard
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="fade-in">
            <h1>Campaign History<span className="subtitle">Track and review all your past campaigns</span></h1>
            <div className="glass-card">
              {isDataLoading ? <Skeleton type="table" /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--card-border)' }}>
                        <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Campaign Name</th>
                        <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Template</th>
                        <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Stats</th>
                        <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Date</th>
                        <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Logs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignHistory.map((camp, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                          <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{camp.name}</td>
                          <td style={{ padding: '1.25rem 1.5rem' }}>
                            <span className="badge">{camp.template}</span>
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                              <div style={{ color: 'var(--success)', fontSize: '0.85rem' }}><b>{camp.success_count}</b> ✓</div>
                              <div style={{ color: 'var(--error)', fontSize: '0.85rem' }}><b>{camp.fail_count}</b> ✕</div>
                            </div>
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)' }}>
                            {new Date(camp.date).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem' }}>
                            <button 
                              className="btn-outline" 
                              style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}
                              onClick={() => fetchCampaignLogs(camp)}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                      {campaignHistory.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-faint)' }}>
                            No campaigns found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL FOR LOGS */}
        {logModalOpen && (
          <div 
            onClick={() => setLogModalOpen(false)}
            style={{ 
              position: 'fixed', 
              top: 0, left: 0, right: 0, bottom: 0, 
              background: 'rgba(15, 23, 42, 0.6)', 
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              zIndex: 9999, 
              padding: '2rem',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{ 
                width: '100%', 
                maxWidth: '820px', 
                maxHeight: '85vh', 
                display: 'flex', 
                flexDirection: 'column',
                background: 'white',
                borderRadius: 'var(--radius-xl)',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.15), 0 10px 20px rgba(0, 0, 0, 0.08)',
                border: '1px solid var(--card-border)',
                overflow: 'hidden',
                animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <div style={{ 
                padding: '1.25rem 1.75rem', 
                borderBottom: '1px solid var(--card-border)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                background: 'var(--bg-elevated)'
              }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', marginBottom: '0.15rem' }}>Logs for: {viewingCampaign?.name}</h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Showing all message attempts for this campaign</p>
                </div>
                <button 
                  onClick={() => setLogModalOpen(false)}
                  style={{ 
                    width: '36px', height: '36px', 
                    borderRadius: '50%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'white', 
                    border: '1px solid var(--card-border)',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    color: 'var(--text-muted)',
                    padding: 0
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--card-border)', background: 'var(--bg-elevated)' }}>
                      <th style={{ padding: '0.85rem 1.5rem' }}>Phone</th>
                      <th style={{ padding: '0.85rem 1.5rem' }}>Status</th>
                      <th style={{ padding: '0.85rem 1.5rem' }}>Error</th>
                      <th style={{ padding: '0.85rem 1.5rem' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCampaignLogs.map((log, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <td style={{ padding: '0.85rem 1.5rem', fontWeight: 600, color: 'var(--text-main)' }}>{log.phone_number}</td>
                        <td style={{ padding: '0.85rem 1.5rem' }}>
                          <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-error'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', color: 'var(--error)' }}>{log.error_message || '—'}</td>
                        <td style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(log.sent_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                    {selectedCampaignLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No logs found</p>
                          <p style={{ fontSize: '0.8rem' }}>This campaign has no recorded message attempts.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ 
                padding: '1rem 1.75rem', 
                borderTop: '1px solid var(--card-border)', 
                background: 'var(--bg-elevated)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedCampaignLogs.length} total records</span>
                <button className="btn-outline" style={{ padding: '0.45rem 1.25rem', fontSize: '0.8rem' }} onClick={() => setLogModalOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {view === 'contacts' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
              <h1>Contact Management</h1>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ position: 'relative', width: '300px' }}>
                  <input 
                    type="text" 
                    placeholder="Search contacts or tags..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                  <Users size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                </div>
                <button className="btn-outline" onClick={() => {
                  setNewContact({ name: '', phone: '', age: '', tags: '' });
                  setAddModalOpen(true);
                }}>
                  <PlusCircle size={18} /> Add Contact
                </button>
                <button className="btn-primary" onClick={() => setImportModalOpen(true)}>
                  <Upload size={18} /> Import Contacts
                </button>
              </div>
            </div>
            
            <div className="glass-card">
              {isDataLoading ? <Skeleton type="table" /> : (
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--card-border)', background: 'var(--bg-elevated)' }}>
                      <th style={{ padding: '1.25rem 1.5rem' }}>Name</th>
                      <th style={{ padding: '1.25rem 1.5rem' }}>Age</th>
                      <th style={{ padding: '1.25rem 1.5rem' }}>Phone</th>
                      <th style={{ padding: '1.25rem 1.5rem' }}>Tags</th>
                      <th style={{ padding: '1.25rem 1.5rem' }}>Joined</th>
                      <th style={{ padding: '1.25rem 1.5rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContacts.map((contact) => (
                      <tr key={contact.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{contact.name || 'Anonymous'}</td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>{contact.age || '-'}</td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>{contact.phone}</td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {contact.tags.map((tag: string) => (
                              <span key={tag} className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem' }}>{tag}</span>
                            ))}
                            {contact.tags.length === 0 && <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>No tags</span>}
                          </div>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)' }}>
                          {new Date(contact.joined).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn-outline" 
                              style={{ padding: '0.35rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}
                              onClick={() => {
                                setEditingContact({ ...contact, tags: contact.tags.join(', ') });
                                setEditModalOpen(true);
                              }}
                            >
                              <Edit size={14} color="#64748b" />
                            </button>
                            <button 
                              className="btn-outline" 
                              style={{ padding: '0.35rem', borderRadius: '0.5rem', border: '1px solid #fee2e2' }}
                              onClick={() => handleDeleteContact(contact.id)}
                            >
                              <Trash2 size={14} color="#ef4444" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-elevated)', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Showing {Math.min((contactsPage - 1) * itemsPerPage + 1, filteredContacts.length)} to {Math.min(contactsPage * itemsPerPage, filteredContacts.length)} of {filteredContacts.length}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={contactsPage === 1} onClick={() => setContactsPage(p => p - 1)}>Previous</button>
                  <button className="btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={contactsPage * itemsPerPage >= filteredContacts.length} onClick={() => setContactsPage(p => p + 1)}>Next</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* IMPORT CONTACTS MODAL */}
        {importModalOpen && (
          <div className="modal-overlay">
            <div className="glass-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Import Contacts</h2>
              
              {!importData.length ? (
                <label className="upload-area" style={{ padding: '3rem 1rem' }}>
                  <input type="file" hidden onChange={handleImportFileUpload} accept=".xlsx, .xls, .csv" />
                  <FileSpreadsheet size={32} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                  <p style={{ fontSize: '0.9rem' }}>Choose Excel File</p>
                </label>
              ) : (
                <div className="fade-in">
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Mapping Columns</label>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {['name', 'age', 'phone'].map(field => (
                        <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ width: '80px', fontSize: '0.8rem', textTransform: 'capitalize' }}>{field}:</span>
                          <select 
                            style={{ flex: 1, padding: '0.5rem' }}
                            value={importMapping[field] || ''}
                            onChange={(e) => setImportMapping(prev => ({ ...prev, [field]: e.target.value }))}
                          >
                            <option value="">Skip Field</option>
                            {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '2rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Add Tags (comma separated)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Patient, SMFG, New"
                      value={importTags}
                      onChange={(e) => setImportTags(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn-outline" style={{ flex: 1 }} onClick={() => setImportData([])}>Reset</button>
                    <button className="btn-primary" style={{ flex: 2 }} onClick={submitImport}>Import {importData.length} Contacts</button>
                  </div>
                </div>
              )}
              
              <button 
                className="btn-outline" 
                style={{ width: '100%', marginTop: '1rem', border: 'none', color: 'var(--error)' }} 
                onClick={() => setImportModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}


        {/* EDIT CONTACT MODAL */}
        {editModalOpen && editingContact && (
          <div className="modal-overlay">
            <div className="glass-card" style={{ width: '100%', maxWidth: '480px', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem' }}>Edit Contact</h2>
                <button onClick={() => setEditModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>
              
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#64748b' }}>Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      value={editingContact.name || ''} 
                      onChange={(e) => setEditingContact({...editingContact, name: e.target.value})}
                      placeholder="Contact Name"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                    <Users size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#64748b' }}>Phone Number</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        value={editingContact.phone || ''} 
                        onChange={(e) => setEditingContact({...editingContact, phone: e.target.value})}
                        placeholder="Phone"
                        style={{ paddingLeft: '2.5rem' }}
                      />
                      <MessageSquare size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#64748b' }}>Age</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="number" 
                        value={editingContact.age || ''} 
                        onChange={(e) => setEditingContact({...editingContact, age: e.target.value})}
                        placeholder="Age"
                        style={{ paddingLeft: '2.5rem' }}
                      />
                      <Tag size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#64748b' }}>Tags (comma separated)</label>
                  <input 
                    type="text" 
                    value={editingContact.tags || ''} 
                    onChange={(e) => setEditingContact({...editingContact, tags: e.target.value})}
                    placeholder="e.g. Patient, VIP, 2024"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button className="btn-outline" style={{ flex: 1 }} onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 2 }} onClick={handleUpdateContact} disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {addModalOpen && (
          <div className="modal-overlay">
            <div className="glass-card" style={{ width: '100%', maxWidth: '480px', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem' }}>Add New Contact</h2>
                <button onClick={() => setAddModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>
              
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#64748b' }}>Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      value={newContact.name} 
                      onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                      placeholder="Contact Name"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                    <Users size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#64748b' }}>Phone Number <span style={{ color: 'var(--error)' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        value={newContact.phone} 
                        onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                        placeholder="Phone Number"
                        style={{ paddingLeft: '2.5rem' }}
                      />
                      <MessageSquare size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#64748b' }}>Age</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="number" 
                        value={newContact.age} 
                        onChange={(e) => setNewContact({...newContact, age: e.target.value})}
                        placeholder="Age"
                        style={{ paddingLeft: '2.5rem' }}
                      />
                      <Tag size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#64748b' }}>Tags (comma separated)</label>
                  <input 
                    type="text" 
                    value={newContact.tags} 
                    onChange={(e) => setNewContact({...newContact, tags: e.target.value})}
                    placeholder="e.g. Patient, VIP, 2026"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button className="btn-outline" style={{ flex: 1 }} onClick={() => setAddModalOpen(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 2 }} onClick={handleAddContact} disabled={isLoading}>
                  {isLoading ? 'Adding...' : 'Add Contact'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {toast && (
          <div className="toast">
            {toast.type === 'success' ? <CheckCircle size={20} color="var(--success)" /> : <AlertCircle size={20} color="var(--error)" />}
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{toast.message}</span>
          </div>
        )}
      </main>
    </div>
  );
}
