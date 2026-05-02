'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { 
  Upload, CheckCircle, AlertCircle, Send, FileSpreadsheet, 
  List, ArrowRight, LayoutDashboard, PlusCircle, History, 
  Users, MessageSquare, ExternalLink, Tag
} from 'lucide-react';

export default function WhatsAppSender() {
  const [view, setView] = useState<'dashboard' | 'create' | 'history' | 'contacts'>('dashboard');
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  // Real Data States
  const [stats, setStats] = useState({ totalSent: 0, campaigns: 0, deliveryRate: 0 });
  const [campaignHistory, setCampaignHistory] = useState<any[]>([]);
  const [contactList, setContactList] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const [excelData, setExcelData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState({ total: 0, current: 0, success: 0, fail: 0 });
  const [isSending, setIsSending] = useState(false);

  // Recipient Source Selection
  const [recipientSource, setRecipientSource] = useState<'excel' | 'existing'>('excel');
  const [selectedTagForCampaign, setSelectedTagForCampaign] = useState('All Tags');
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await axios.get('/api/templates');
        setTemplates(response.data);
      } catch (err) {
        console.error('Failed to fetch templates');
      }
    };

    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const [statsRes, historyRes, contactsRes, logsRes] = await Promise.all([
          axios.get('/api/stats'),
          axios.get('/api/campaigns'),
          axios.get('/api/contacts'),
          axios.get('/api/logs/recent')
        ]);
        setStats(statsRes.data);
        setCampaignHistory(historyRes.data);
        setContactList(contactsRes.data);
        setRecentLogs(logsRes.data);
      } catch (err) {
        console.error('Failed to fetch real-time data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
    fetchAllData();
  }, [view]); // Refetch whenever view changes

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
    const variables: { id: string, component: string }[] = [];
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
    });
    return variables;
  };

  const handleBulkSend = async () => {
    if (!selectedTemplate || !mapping['phone']) return;
    setIsSending(true);
    setStep(4);
    setProgress({ total: excelData.length, current: 0, success: 0, fail: 0 });

    try {
      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        const phoneNumber = String(row[mapping['phone']]).replace(/\D/g, '');
        const contactName = mapping['contact_name'] ? String(row[mapping['contact_name']] || '') : null;
        const contactAge = mapping['age'] ? Number(row[mapping['age']]) || null : null;
        
        if (!phoneNumber) {
          setProgress(prev => ({ ...prev, current: i + 1, fail: prev.fail + 1 }));
          continue;
        }

        const templateVars = getTemplateVariables(selectedTemplate);
        const bodyParams = templateVars.filter(v => v.component === 'BODY').map(v => {
          const param: any = { type: 'text', text: String(row[mapping[v.id]] || '') };
          if (isNaN(Number(v.id))) param.parameter_name = v.id;
          return param;
        });
        const headerParams = templateVars.filter(v => v.component === 'HEADER').map(v => {
          const param: any = { type: 'text', text: String(row[mapping[v.id]] || '') };
          if (isNaN(Number(v.id))) param.parameter_name = v.id;
          return param;
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
            <h1>Dashboard Overview<span className="subtitle">Monitor your messaging activity and campaign performance</span></h1>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginTop: '1.5rem' }}>
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
            </div>
            
            <div className="glass-card" style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem' }}>Recent Activity</h3>
                <button className="btn-outline" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }} onClick={() => setView('history')}>View All</button>
              </div>
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
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="fade-in">
            <h1>New Campaign<span className="subtitle">Set up and launch a targeted WhatsApp message blast</span></h1>
            <div className="step-indicator">
              <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Select Template</div>
              <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Upload Excel</div>
              <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Map Variables</div>
              <div className={`step ${step >= 4 ? 'active' : ''}`}>4. Track Status</div>
            </div>

            <div className="glass-card">
              {step === 1 && (
                <div className="fade-in">
                  <div style={{ marginBottom: '2rem', background: 'var(--bg-elevated)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--card-border)' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <LayoutDashboard size={20} color="var(--primary)" /> 1. Name your Campaign
                    </h2>
                    <div className="mapping-row" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                      <label style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block', fontWeight: 700 }}>
                        Campaign Name <span style={{ color: 'var(--error)' }}>*</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="Enter a name to enable the next step..." 
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        style={{ background: 'white', border: !campaignName ? '1.5px solid #cbd5e1' : '1.5px solid var(--primary)' }}
                      />
                      {!campaignName && <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.5rem' }}>Please enter a name to continue</p>}
                    </div>
                  </div>

                  <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <MessageSquare size={20} color="var(--primary)" /> 2. Select Template
                    </h2>
                    <p style={{ color: 'var(--text-muted)' }}>Select the WhatsApp template you want to use for this campaign.</p>
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {templates.map((t) => (
                      <div 
                        key={t.name} 
                        className={`glass-card template-card ${selectedTemplate?.name === t.name ? 'active-border' : ''}`}
                        style={{ cursor: 'pointer', padding: '1.5rem', border: selectedTemplate?.name === t.name ? '2px solid var(--primary)' : '1px solid var(--card-border)' }}
                        onClick={() => setSelectedTemplate(t)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                          <span className="badge badge-success">{t.category}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.language}</span>
                        </div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>{t.name.replace(/_/g, ' ')}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {t.components.find((c: any) => c.type === 'BODY')?.text}
                        </p>
                      </div>
                    ))}
                    {templates.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '1.5rem', border: '1px dashed var(--card-border)' }}>
                        <p style={{ color: 'var(--text-muted)' }}>No templates found. Check your WhatsApp Business account.</p>
                      </div>
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
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                        <select 
                          style={{ flex: 1 }} 
                          value={selectedTagForCampaign}
                          onChange={(e) => setSelectedTagForCampaign(e.target.value)}
                        >
                          <option>All Tags</option>
                          {Array.from(new Set(contactList.flatMap(c => c.tags))).map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
                          ))}
                        </select>
                        <button className="btn-outline" onClick={() => {
                          const filtered = contactList.filter(c => selectedTagForCampaign === 'All Tags' || c.tags.includes(selectedTagForCampaign));
                          setSelectedContactIds(filtered.map(c => c.id));
                        }}>Select All Filtered</button>
                      </div>

                      <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <tbody style={{ background: 'white' }}>
                            {contactList
                              .filter(c => selectedTagForCampaign === 'All Tags' || c.tags.includes(selectedTagForCampaign))
                              .map(contact => (
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
                        <div key={v.id} className="mapping-row">
                          <label>&#123;&#123;{v.id}&#125;&#125; <span style={{ fontWeight: 400, opacity: 0.6, fontSize: '0.8rem' }}>({v.component})</span></label>
                          <select value={mapping[v.id] || ''} onChange={(e) => setMapping(prev => ({ ...prev, [v.id]: e.target.value }))}>
                            <option value="">Select Column</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
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
                              {comp.type === 'HEADER' && <div className="header-text">{comp.text}</div>}
                              {comp.type === 'BODY' && (
                                <div className="body-text">
                                  {comp.text?.split(/({{[^}]+}})/).map((part: string, idx: number) => {
                                    const match = part.match(/{{([^}]+)}}/);
                                    if (match) {
                                      const vId = match[1];
                                      return <span key={idx} className={`variable ${mapping[vId] ? 'mapped' : 'unmapped'}`}>{mapping[vId] ? excelData[0][mapping[vId]] : part}</span>;
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
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaign Name</th>
                    <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Template</th>
                    <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stats</th>
                    <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                    <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((camp) => (
                    <tr 
                      key={camp.id} 
                      style={{ borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }}
                      onClick={() => fetchCampaignLogs(camp)}
                    >
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{camp.name}</td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>{camp.template}</td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{camp.success_count}</span>
                          <span style={{ color: '#94a3b8' }}>/</span>
                          <span style={{ color: 'var(--error)', fontWeight: 700 }}>{camp.fail_count}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <span className="badge badge-success">Completed</span>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)' }}>
                        {new Date(camp.date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-elevated)', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Showing {Math.min((historyPage - 1) * itemsPerPage + 1, campaignHistory.length)} to {Math.min(historyPage * itemsPerPage, campaignHistory.length)} of {campaignHistory.length}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)}>Previous</button>
                  <button className="btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={historyPage * itemsPerPage >= campaignHistory.length} onClick={() => setHistoryPage(p => p + 1)}>Next</button>
                </div>
              </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
              <div>
                <h1>Contact List<span className="subtitle">Manage and tag your recipients for targeted campaigns</span></h1>
              </div>
              <button className="btn-primary" style={{ padding: '0.75rem 1.5rem' }} onClick={() => setImportModalOpen(true)}>
                <PlusCircle size={20} /> Import Contacts
              </button>
            </div>
            
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--card-border)', display: 'flex', gap: '0.75rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input 
                    type="text" 
                    placeholder="Search by name or number..." 
                    style={{ paddingLeft: '3rem' }} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <List size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                </div>
                <select 
                  style={{ width: '200px' }} 
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                >
                  <option>All Tags</option>
                  {Array.from(new Set(contactList.flatMap(c => c.tags))).map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Contact</th>
                    <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Age</th>
                    <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Phone</th>
                    <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Tags</th>
                    <th style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Joined</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
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
