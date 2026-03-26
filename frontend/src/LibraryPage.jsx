// frontend/src/LibraryPage.jsx
// Public landing page for each library — accessible at /lib/:slug
import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "https://libra-backend-gjgo.onrender.com";
const slug = window.location.pathname.split('/lib/')[1]?.split('/')[0] || '';

const fmt = (n) => `₹${Number(n||0).toLocaleString('en-IN')}`;
const fmtTime = (t) => { if(!t) return ''; const [h,m] = t.split(':'); const hr = parseInt(h); return `${hr>12?hr-12:hr||12}:${m} ${hr>=12?'PM':'AM'}`; };

const Spinner = () => (
  <div style={{display:'flex',justifyContent:'center',padding:40}}>
    <div style={{width:32,height:32,border:'3px solid #e8a83820',borderTopColor:'#e8a838',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
  </div>
);

export default function LibraryPage() {
  const [lib, setLib]         = useState(null);
  const [shifts, setShifts]   = useState([]);
  const [plans, setPlans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [step, setStep]       = useState('home'); // home | book | confirm | student
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [form, setForm]       = useState({ name:'', phone:'', email:'' });
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);
  const [studentPhone, setStudentPhone] = useState('');
  const [studentData, setStudentData]   = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/library/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setLib(d.library);
        setShifts(d.shifts || []);
        setPlans(d.plans || []);
      })
      .catch(() => setError('Failed to load library details'))
      .finally(() => setLoading(false));
  }, []);

  const handleBook = async () => {
    if (!form.name || !form.phone) return;
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API_BASE}/api/public/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          librarySlug: slug,
          studentName: form.name,
          phone: form.phone,
          email: form.email,
          planId: selectedPlan.id,
          shiftId: selectedShift?.id || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error); return; }
      setBooking(d);
      setStep('confirm');
    } catch(e) { setError('Something went wrong. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const handleStudentLogin = async () => {
    if (!studentPhone || studentPhone.length < 10) return;
    setStudentLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/public/student/${studentPhone}/${slug}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error); return; }
      setStudentData(d);
      setStep('student');
    } catch(e) { setError('Failed to load your details.'); }
    finally { setStudentLoading(false); }
  };

  const amenitiesList = lib?.amenities ? lib.amenities.split(',').map(a => a.trim()).filter(Boolean) : [];
  const amenityIcons = { wifi:'📶', ac:'❄️', parking:'🅿️', cctv:'📹', water:'💧', locker:'🔒', library:'📚', cafeteria:'☕', printer:'🖨️' };

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Plus Jakarta Sans',sans-serif;background:#0a0c10;color:#e8eaf0;min-height:100vh;}
    .fade-up{animation:fadeUp 0.5s ease both;}
    input,textarea,select{font-family:inherit;}
    a{color:inherit;}
  `;

  if (loading) return <><style>{styles}</style><Spinner/></>;
  if (error && !lib) return (
    <><style>{styles}</style>
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
      <div style={{fontSize:48}}>😕</div>
      <div style={{fontWeight:700,fontSize:18}}>Library not found</div>
      <div style={{color:'#8892a4',fontSize:14}}>{error}</div>
    </div></>
  );

  return (
    <>
      <style>{styles}</style>
      <div style={{minHeight:'100vh',background:'#0a0c10'}}>

        {/* ── HERO ── */}
        <div style={{background:'linear-gradient(135deg,#111420 0%,#0d1020 100%)',borderBottom:'1px solid #1f2535',padding:'0 0 0'}}>
          {/* Top bar */}
          <div style={{padding:'16px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',maxWidth:960,margin:'0 auto'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#e8a838,#f5c842)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📚</div>
              <div>
                <div style={{fontWeight:800,fontSize:14,color:'#e8a838'}}>LibraryDesk</div>
                <div style={{fontSize:10,color:'#4a5568',letterSpacing:1}}>POWERED BY LIBRARYDESK.IN</div>
              </div>
            </div>
            <button onClick={()=>setStep(step==='student-login'?'home':'student-login')}
              style={{background:'transparent',border:'1px solid #2a3348',borderRadius:8,color:'#8892a4',padding:'6px 14px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
              My Bookings
            </button>
          </div>

          {/* Hero content */}
          <div style={{maxWidth:960,margin:'0 auto',padding:'32px 24px 48px'}} className="fade-up">
            <div style={{display:'flex',alignItems:'flex-start',gap:20,flexWrap:'wrap'}}>
              <div style={{width:72,height:72,borderRadius:18,background:'linear-gradient(135deg,#e8a838,#f5c842)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,flexShrink:0,boxShadow:'0 8px 32px rgba(232,168,56,0.3)'}}>📚</div>
              <div style={{flex:1,minWidth:200}}>
                <h1 style={{fontSize:28,fontWeight:800,lineHeight:1.2,marginBottom:8}}>{lib?.library_name}</h1>
                {lib?.tagline && <p style={{color:'#8892a4',fontSize:15,marginBottom:8}}>{lib.tagline}</p>}
                <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:13,color:'#8892a4'}}>
                  {lib?.city && <span>📍 {lib.city}</span>}
                  {lib?.open_time && lib?.close_time && <span>🕐 {fmtTime(lib.open_time)} – {fmtTime(lib.close_time)}</span>}
                  {lib?.contact_phone && <span>📞 {lib.contact_phone}</span>}
                </div>
                {lib?.address && <div style={{marginTop:6,fontSize:12,color:'#4a5568'}}>{lib.address}</div>}
              </div>
              <button onClick={()=>setStep('book')}
                style={{background:'linear-gradient(135deg,#e8a838,#f5c842)',border:'none',borderRadius:12,padding:'14px 28px',fontSize:15,fontWeight:700,color:'#000',cursor:'pointer',fontFamily:'inherit',boxShadow:'0 4px 20px rgba(232,168,56,0.4)',whiteSpace:'nowrap'}}>
                Book a Seat →
              </button>
            </div>

            {/* Amenities */}
            {amenitiesList.length > 0 && (
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:20}}>
                {amenitiesList.map(a => (
                  <span key={a} style={{background:'#1a1f2e',border:'1px solid #2a3348',borderRadius:20,padding:'4px 12px',fontSize:12,color:'#8892a4'}}>
                    {amenityIcons[a.toLowerCase()]||'✓'} {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{maxWidth:960,margin:'0 auto',padding:'32px 24px'}}>

          {/* My Bookings login */}
          {step === 'student-login' && (
            <div className="fade-up" style={{background:'#11141a',border:'1px solid #1f2535',borderRadius:16,padding:24,maxWidth:420,marginBottom:24}}>
              <h3 style={{fontWeight:700,marginBottom:4}}>View My Bookings</h3>
              <p style={{color:'#8892a4',fontSize:13,marginBottom:16}}>Enter your registered phone number</p>
              {error && <div style={{background:'#2a0f0f',border:'1px solid #ef4444',borderRadius:8,padding:'8px 12px',fontSize:13,color:'#ef4444',marginBottom:12}}>{error}</div>}
              <input style={{width:'100%',background:'#0d1020',border:'1px solid #2a3348',borderRadius:10,padding:'12px 14px',color:'#e8eaf0',fontSize:15,marginBottom:12,outline:'none'}}
                type="tel" placeholder="Enter your 10-digit mobile number"
                value={studentPhone} onChange={e=>setStudentPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
                onKeyDown={e=>e.key==='Enter'&&handleStudentLogin()}/>
              <button onClick={handleStudentLogin} disabled={studentLoading||studentPhone.length<10}
                style={{width:'100%',background:'#e8a838',border:'none',borderRadius:10,padding:'12px',fontSize:15,fontWeight:700,color:'#000',cursor:'pointer',fontFamily:'inherit',opacity:studentPhone.length<10?0.5:1}}>
                {studentLoading ? 'Loading...' : 'View My Details →'}
              </button>
            </div>
          )}

          {/* Student portal */}
          {step === 'student' && studentData && (
            <div className="fade-up" style={{marginBottom:24}}>
              <button onClick={()=>{setStep('home');setStudentData(null);setError('');}} style={{background:'transparent',border:'none',color:'#8892a4',fontSize:13,cursor:'pointer',marginBottom:16,fontFamily:'inherit'}}>← Back</button>
              <h2 style={{fontWeight:800,fontSize:20,marginBottom:16}}>👋 Hello, {studentData.student?.name || studentData.bookings?.[0]?.student_name}!</h2>

              {studentData.student && (
                <div style={{background:'#11141a',border:'1px solid #22c55e40',borderRadius:16,padding:20,marginBottom:16}}>
                  <div style={{color:'#22c55e',fontWeight:700,fontSize:14,marginBottom:12}}>✅ Active Subscription</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    {[['Plan',studentData.student.plan_name||'N/A'],['Shift',studentData.student.shift_name||'N/A'],['Seat',studentData.student.seat_number||'N/A'],['Valid Until',studentData.student.end_date?new Date(studentData.student.end_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'N/A'],['Amount',fmt(studentData.student.amount)],['Status',studentData.student.sub_status||'active']].map(([l,v])=>(
                      <div key={l} style={{background:'#0d1020',borderRadius:8,padding:'10px 12px'}}>
                        <div style={{fontSize:10,color:'#4a5568',textTransform:'uppercase',letterSpacing:1,marginBottom:2}}>{l}</div>
                        <div style={{fontWeight:600,fontSize:13,textTransform:'capitalize'}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {studentData.bookings?.length > 0 && (
                <div>
                  <div style={{fontWeight:700,marginBottom:12,fontSize:14}}>Recent Booking Requests</div>
                  {studentData.bookings.map(b => (
                    <div key={b.id} style={{background:'#11141a',border:'1px solid #1f2535',borderRadius:12,padding:16,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                      <div>
                        <div style={{fontWeight:600,fontSize:14}}>{b.plan_name} {b.shift_name && `· ${b.shift_name}`}</div>
                        <div style={{fontSize:12,color:'#4a5568',marginTop:2}}>{new Date(b.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:13,fontWeight:600,color:fmt(b.amount)}}>{fmt(b.amount)}</span>
                        <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                          background:b.status==='approved'?'#0f2a1a':b.status==='declined'?'#2a0f0f':'#2a1f08',
                          color:b.status==='approved'?'#22c55e':b.status==='declined'?'#ef4444':'#f59e0b',
                          border:`1px solid ${b.status==='approved'?'#22c55e':b.status==='declined'?'#ef4444':'#f59e0b'}`
                        }}>{b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Shifts + Plans overview */}
          {(step === 'home' || step === 'student-login') && (<>
            {/* Available Shifts */}
            {shifts.length > 0 && (
              <div className="fade-up" style={{marginBottom:32}}>
                <h2 style={{fontWeight:800,fontSize:18,marginBottom:16}}>📅 Available Shifts</h2>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
                  {shifts.map(sh => (
                    <div key={sh.id} style={{background:'#11141a',border:`1px solid ${sh.available>0?'#1f2535':'#2a0f0f'}`,borderRadius:14,padding:18}}>
                      <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{sh.name}</div>
                      <div style={{color:'#8892a4',fontSize:13,marginBottom:12}}>{fmtTime(sh.start_time)} – {fmtTime(sh.end_time)}</div>
                      <div style={{display:'flex',gap:8}}>
                        <div style={{flex:1,background:'#0a0c10',borderRadius:8,padding:'8px',textAlign:'center'}}>
                          <div style={{fontSize:18,fontWeight:800,color:'#22c55e'}}>{Math.max(0,sh.available)}</div>
                          <div style={{fontSize:10,color:'#4a5568',marginTop:2}}>Available</div>
                        </div>
                        <div style={{flex:1,background:'#0a0c10',borderRadius:8,padding:'8px',textAlign:'center'}}>
                          <div style={{fontSize:18,fontWeight:800,color:'#f59e0b'}}>{sh.occupied}</div>
                          <div style={{fontSize:10,color:'#4a5568',marginTop:2}}>Occupied</div>
                        </div>
                      </div>
                      {sh.available <= 0 && <div style={{marginTop:8,fontSize:11,color:'#ef4444',fontWeight:600,textAlign:'center'}}>❌ Seats Full</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Plans */}
            {plans.length > 0 && (
              <div className="fade-up">
                <h2 style={{fontWeight:800,fontSize:18,marginBottom:16}}>💳 Plans & Pricing</h2>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
                  {plans.map((p,i) => (
                    <div key={p.id} style={{background:'#11141a',border:`1px solid ${i===1?'#e8a83840':'#1f2535'}`,borderRadius:14,padding:20,position:'relative'}}>
                      {i===1 && <div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:'#e8a838',color:'#000',fontSize:10,fontWeight:800,padding:'2px 12px',borderRadius:20}}>POPULAR</div>}
                      <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>{p.name}</div>
                      <div style={{fontSize:28,fontWeight:800,color:'#e8a838',marginBottom:4}}>{fmt(p.price)}</div>
                      <div style={{color:'#8892a4',fontSize:13,marginBottom:12}}>{p.duration} days</div>
                      {p.description && <div style={{fontSize:12,color:'#4a5568',marginBottom:12}}>{p.description}</div>}
                      <button onClick={()=>{setSelectedPlan(p);setStep('book');}}
                        style={{width:'100%',background:i===1?'#e8a838':'transparent',border:`1px solid ${i===1?'#e8a838':'#2a3348'}`,borderRadius:8,padding:'10px',fontSize:13,fontWeight:700,color:i===1?'#000':'#e8eaf0',cursor:'pointer',fontFamily:'inherit'}}>
                        Book This Plan
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>)}

          {/* Booking Form */}
          {step === 'book' && (
            <div className="fade-up" style={{maxWidth:520}}>
              <button onClick={()=>{setStep('home');setError('');}} style={{background:'transparent',border:'none',color:'#8892a4',fontSize:13,cursor:'pointer',marginBottom:16,fontFamily:'inherit'}}>← Back</button>
              <h2 style={{fontWeight:800,fontSize:20,marginBottom:4}}>Book Your Seat</h2>
              <p style={{color:'#8892a4',fontSize:13,marginBottom:24}}>Fill in your details to request a seat. The library will confirm after payment.</p>

              {error && <div style={{background:'#2a0f0f',border:'1px solid #ef4444',borderRadius:8,padding:'8px 12px',fontSize:13,color:'#ef4444',marginBottom:16}}>{error}</div>}

              {/* Plan selector */}
              <div style={{marginBottom:16}}>
                <label style={{fontSize:12,color:'#8892a4',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>Select Plan *</label>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
                  {plans.map(p => (
                    <div key={p.id} onClick={()=>setSelectedPlan(p)}
                      style={{background:'#0d1020',border:`1.5px solid ${selectedPlan?.id===p.id?'#e8a838':'#1f2535'}`,borderRadius:10,padding:'10px 12px',cursor:'pointer',transition:'border .15s'}}>
                      <div style={{fontWeight:600,fontSize:13}}>{p.name}</div>
                      <div style={{color:'#e8a838',fontWeight:700,fontSize:15}}>{fmt(p.price)}</div>
                      <div style={{color:'#4a5568',fontSize:11}}>{p.duration} days</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shift selector */}
              {shifts.filter(s=>s.available>0).length > 0 && (
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:12,color:'#8892a4',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>Select Shift *</label>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
                    {shifts.filter(s=>s.available>0).map(sh => (
                      <div key={sh.id} onClick={()=>setSelectedShift(sh)}
                        style={{background:'#0d1020',border:`1.5px solid ${selectedShift?.id===sh.id?'#22c55e':'#1f2535'}`,borderRadius:10,padding:'10px 12px',cursor:'pointer'}}>
                        <div style={{fontWeight:600,fontSize:13}}>{sh.name}</div>
                        <div style={{color:'#8892a4',fontSize:12}}>{fmtTime(sh.start_time)} – {fmtTime(sh.end_time)}</div>
                        <div style={{color:'#22c55e',fontSize:11,marginTop:4}}>{sh.available} seats left</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Student details */}
              {[['Full Name *','text','Your full name','name'],['Phone Number *','tel','10-digit mobile number','phone'],['Email (optional)','email','your@email.com','email']].map(([label,type,placeholder,field])=>(
                <div key={field} style={{marginBottom:14}}>
                  <label style={{fontSize:12,color:'#8892a4',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>{label}</label>
                  <input style={{width:'100%',background:'#0d1020',border:'1px solid #2a3348',borderRadius:10,padding:'12px 14px',color:'#e8eaf0',fontSize:15,outline:'none',fontFamily:'inherit'}}
                    type={type} placeholder={placeholder}
                    value={form[field]} onChange={e=>setForm(f=>({...f,[field]:field==='phone'?e.target.value.replace(/\D/g,'').slice(0,10):e.target.value}))}/>
                </div>
              ))}

              {/* Summary */}
              {selectedPlan && (
                <div style={{background:'#0d1020',border:'1px solid #2a3348',borderRadius:12,padding:16,marginBottom:16,fontSize:13}}>
                  <div style={{fontWeight:700,marginBottom:8,color:'#8892a4',textTransform:'uppercase',letterSpacing:1,fontSize:11}}>Booking Summary</div>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{color:'#8892a4'}}>Plan</span><span style={{fontWeight:600}}>{selectedPlan.name}</span></div>
                  {selectedShift && <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{color:'#8892a4'}}>Shift</span><span style={{fontWeight:600}}>{selectedShift.name}</span></div>}
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{color:'#8892a4'}}>Duration</span><span style={{fontWeight:600}}>{selectedPlan.duration} days</span></div>
                  <div style={{borderTop:'1px solid #1f2535',marginTop:8,paddingTop:8,display:'flex',justifyContent:'space-between'}}><span style={{color:'#8892a4'}}>Amount</span><span style={{fontWeight:800,fontSize:16,color:'#e8a838'}}>{fmt(selectedPlan.price)}</span></div>
                </div>
              )}

              <div style={{background:'#1a1505',border:'1px solid #f59e0b40',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12.5,color:'#f59e0b',lineHeight:1.6}}>
                📞 <strong>How it works:</strong> After submitting, please call <strong>{lib?.contact_phone || 'the library'}</strong> to make payment. Your seat will be confirmed once payment is received.
              </div>

              <button onClick={handleBook}
                disabled={submitting||!selectedPlan||!selectedShift||!form.name||form.phone.length<10}
                style={{width:'100%',background:'linear-gradient(135deg,#e8a838,#f5c842)',border:'none',borderRadius:12,padding:'14px',fontSize:16,fontWeight:800,color:'#000',cursor:'pointer',fontFamily:'inherit',opacity:(!selectedPlan||!selectedShift||!form.name||form.phone.length<10)?0.5:1}}>
                {submitting ? 'Submitting...' : 'Submit Booking Request →'}
              </button>
            </div>
          )}

          {/* Confirmation */}
          {step === 'confirm' && booking && (
            <div className="fade-up" style={{maxWidth:480,textAlign:'center',padding:'40px 24px'}}>
              <div style={{fontSize:64,marginBottom:16}}>🎉</div>
              <h2 style={{fontWeight:800,fontSize:24,marginBottom:8}}>Booking Submitted!</h2>
              <p style={{color:'#8892a4',fontSize:14,marginBottom:24,lineHeight:1.6}}>{booking.message}</p>
              <div style={{background:'#11141a',border:'1px solid #1f2535',borderRadius:14,padding:20,textAlign:'left',marginBottom:24}}>
                {[['Plan',booking.booking?.planName],['Shift',booking.booking?.shiftName||'N/A'],['Status','Pending Confirmation']].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #1f2535',fontSize:14}}>
                    <span style={{color:'#8892a4'}}>{l}</span>
                    <span style={{fontWeight:600,textTransform:'capitalize'}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{background:'#1a1505',border:'1px solid #f59e0b40',borderRadius:12,padding:16,fontSize:13,color:'#f59e0b',lineHeight:1.7,marginBottom:24}}>
                📞 <strong>Next step:</strong> Call <strong>{lib?.contact_phone || 'the library'}</strong> to make payment. Once confirmed, you'll receive a WhatsApp message!
              </div>
              <button onClick={()=>{setStep('home');setSelectedPlan(null);setSelectedShift(null);setForm({name:'',phone:'',email:'',});setBooking(null);setError('');}}
                style={{background:'transparent',border:'1px solid #2a3348',borderRadius:10,padding:'10px 24px',color:'#8892a4',cursor:'pointer',fontFamily:'inherit',fontSize:13}}>
                Back to Library Page
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{textAlign:'center',padding:'24px',borderTop:'1px solid #1f2535',fontSize:12,color:'#4a5568',marginTop:32}}>
          Powered by <a href="https://librarydesk.in" style={{color:'#e8a838',textDecoration:'none'}}>LibraryDesk</a> · Library Management System
        </div>
      </div>
    </>
  );
}
