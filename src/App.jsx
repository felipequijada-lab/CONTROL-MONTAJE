import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://uxgkiuhcqcvcwkvtjqvo.supabase.co";
const SUPABASE_KEY = "sb_publishable_CSpI4hVvQmUWai7oQcPmuQ_mZe3EYqA";
const ADMIN_PIN = "18670610";

const fmt2 = n => isNaN(n) ? "0.00" : (Math.round(n * 100) / 100).toFixed(2);
const fmtPct = n => (Math.round(n * 10) / 10).toFixed(1) + "%";
const TODAY = new Date().toISOString().slice(0, 10);
const TIPOS_MD = ["MD", "MDT"];

function getArea(el) { return el.area || 0; }

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

function getWeekNumber(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  return `${week}.${d.getFullYear()}`;
}

const PERSONAL_CARGOS = [
  { key: "coordinadores", label: "Coordinadores", max: 2, productivo: false },
  { key: "calidad", label: "Calidad", max: 4, productivo: false },
  { key: "lideres", label: "Líderes", max: 4, productivo: true },
  { key: "montajistas", label: "Montajistas", max: 15, productivo: true },
  { key: "ayudantes", label: "Ayudantes", max: 15, productivo: true },
];

const defaultPersonal = () => ({ coordinadores: 1, calidad: 1, lideres: 1, montajistas: 2, ayudantes: 2 });

// ── PDF ───────────────────────────────────────────────────────────────────────
function generatePDF(weekData, elements, dailyStats, weekLabel, obraName) {
  const mdTotal = fmt2(weekData.areaMD);
  const pTotal  = fmt2(weekData.areaP);
  const total   = fmt2(weekData.areaTotal);
  const fecha   = new Date().toLocaleDateString('es-CL');
  const weekElements = weekData.montados.map(pos => {
    const el = elements.find(e => e.pos === pos);
    const d  = dailyStats.find(d => d.montados.includes(pos));
    return el ? { ...el, fecha: d?.date || "" } : null;
  }).filter(Boolean);
  const incidencias = dailyStats.filter(d => getWeekNumber(d.date) === weekLabel);

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Courier New',monospace;background:#e2e8f0;color:#1e293b;padding:20px;}
.header{background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}
.title{color:#d97706;font-size:18px;font-weight:bold;}
.subtitle{color:#94a3b8;font-size:10px;letter-spacing:2px;margin-top:4px;}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px;}
.kpi{background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:10px;text-align:center;}
.kpi-label{color:#94a3b8;font-size:8px;letter-spacing:1px;margin-bottom:4px;}
.kpi-value{font-size:18px;font-weight:bold;}
.section{background:#fff;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:12px;}
.section-title{color:#d97706;font-size:9px;letter-spacing:3px;padding:10px 14px;border-bottom:1px solid #cbd5e1;}
table{width:100%;border-collapse:collapse;}
th{background:#f1f5f9;color:#64748b;font-size:8px;letter-spacing:2px;padding:6px 10px;text-align:left;}
td{padding:6px 10px;font-size:10px;color:#475569;border-bottom:1px solid #f1f5f9;}
.amber{color:#d97706;}.green{color:#16a34a;}.blue{color:#2563eb;}.red{color:#dc2626;}
.footer{text-align:center;color:#94a3b8;font-size:8px;margin-top:16px;border-top:1px solid #cbd5e1;padding-top:8px;}
@media print{body{background:#fff!important;}}
</style></head><body>
<div class="header">
  <div><div class="title">◈ CONTROL DE MONTAJE</div><div class="subtitle">BAUMAX SPA · ${obraName} · SEMANA ${weekLabel}</div></div>
  <div style="text-align:right"><div style="color:#94a3b8;font-size:9px">FECHA</div><div style="font-size:12px;font-weight:bold">${fecha}</div></div>
</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">m² RECIBIDOS</div><div class="kpi-value blue">${fmt2(weekData.areaRecibida)}</div></div>
  <div class="kpi"><div class="kpi-label">m² MONTADOS</div><div class="kpi-value green">${total}</div></div>
  <div class="kpi"><div class="kpi-label">MD/MDT</div><div class="kpi-value green">${mdTotal}</div></div>
  <div class="kpi"><div class="kpi-label">PRELOSAS</div><div class="kpi-value blue">${pTotal}</div></div>
  <div class="kpi"><div class="kpi-label">DÍAS EFECTIVOS</div><div class="kpi-value amber">${weekData.diasEfectivos}</div></div>
</div>
<div class="section"><div class="section-title">RENDIMIENTOS</div>
<table><tr><th>CARGO</th><th>PERSONAS</th><th>m²/PERSONA/DÍA</th><th>m²/PERSONA/SEMANA</th></tr>
<tr><td class="amber">Líder</td><td>${weekData.personal.lideres}</td><td>${fmt2(weekData.rendLider)}</td><td>${fmt2(weekData.rendLider*weekData.diasEfectivos)}</td></tr>
<tr><td class="amber">Montajista</td><td>${weekData.personal.montajistas}</td><td>${fmt2(weekData.rendMontajista)}</td><td>${fmt2(weekData.rendMontajista*weekData.diasEfectivos)}</td></tr>
<tr><td class="amber">Ayudante</td><td>${weekData.personal.ayudantes}</td><td>${fmt2(weekData.rendAyudante)}</td><td>${fmt2(weekData.rendAyudante*weekData.diasEfectivos)}</td></tr>
<tr><td>Equipo</td><td>${weekData.equipoCompleto}</td><td>${fmt2(weekData.rendEquipo)}</td><td>${fmt2(weekData.rendEquipo*weekData.diasEfectivos)}</td></tr>
</table></div>
<div class="section"><div class="section-title">ELEMENTOS MONTADOS</div>
<table><tr><th>LOTE</th><th>TORRE</th><th>PISO</th><th>TIPO</th><th>POSICIÓN</th><th>ÁREA m²</th><th>FECHA</th></tr>
${weekElements.map(el=>`<tr><td>${el.lote||""}</td><td>${el.torre||""}</td><td>${el.piso||""}</td><td class="${TIPOS_MD.includes(el.tipo)?"green":"blue"}">${el.tipo}</td><td>${el.pos}</td><td>${fmt2(el.area)}</td><td>${el.fecha}</td></tr>`).join('')}
<tr style="background:#f1f5f9"><td colspan="5"><b>TOTAL</b></td><td class="amber"><b>${total}</b></td><td></td></tr>
</table></div>
<div class="section"><div class="section-title">INCIDENCIAS</div>
<table><tr><th>FECHA</th><th>OBSERVACIÓN</th></tr>
${incidencias.map(d=>`<tr><td class="amber">${d.date}</td><td>${d.note||"Sin incidencias"}</td></tr>`).join('')}
${incidencias.length===0?'<tr><td colspan="2" style="text-align:center;color:#94a3b8">Sin incidencias</td></tr>':''}
</table></div>
<div class="footer">Informe generado automáticamente · Control de Montaje · Baumax SPA · Semana ${weekLabel}</div>
</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(()=>document.body.removeChild(iframe),1000); }, 500);
}

// ── Excel Export ──────────────────────────────────────────────────────────────
function generateExcel(weekData, elements, dailyStats, weekLabel) {
  const wb = XLSX.utils.book_new();
  const resumen = [
    [`INFORME SEMANAL - SEMANA ${weekLabel}`],[],
    ["RESUMEN"],
    ["m² Recibidos", parseFloat(fmt2(weekData.areaRecibida))],
    ["m² Montados", parseFloat(fmt2(weekData.areaTotal))],
    ["m² MD/MDT", parseFloat(fmt2(weekData.areaMD))],
    ["m² P", parseFloat(fmt2(weekData.areaP))],
    ["Días efectivos", weekData.diasEfectivos],
    ["Rendimiento efectivo (m²/día)", parseFloat(fmt2(weekData.rendEfectivo))],[],
    ["RENDIMIENTOS"],
    ["Cargo","Personas","m²/persona/día","m²/persona/semana"],
    ["Líder",weekData.personal.lideres,parseFloat(fmt2(weekData.rendLider)),parseFloat(fmt2(weekData.rendLider*weekData.diasEfectivos))],
    ["Montajista",weekData.personal.montajistas,parseFloat(fmt2(weekData.rendMontajista)),parseFloat(fmt2(weekData.rendMontajista*weekData.diasEfectivos))],
    ["Ayudante",weekData.personal.ayudantes,parseFloat(fmt2(weekData.rendAyudante)),parseFloat(fmt2(weekData.rendAyudante*weekData.diasEfectivos))],
    ["Equipo Completo",weekData.equipoCompleto,parseFloat(fmt2(weekData.rendEquipo)),parseFloat(fmt2(weekData.rendEquipo*weekData.diasEfectivos))],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");
  const elemRows = [["Lote","Torre","Piso","Tipo","Posición","Área m²","Fecha Montaje"]];
  weekData.montados.forEach(pos => {
    const el = elements.find(e=>e.pos===pos);
    const d  = dailyStats.find(d=>d.montados.includes(pos));
    if(el) elemRows.push([el.lote||"",el.torre||"",el.piso||"",el.tipo,el.pos,el.area,d?.date||""]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(elemRows), "Montados");
  const recRows = [["Lote","Torre","Piso","Tipo","Posición","Área m²","Fecha Recepción"]];
  weekData.recibidos.forEach(pos => {
    const el = elements.find(e=>e.pos===pos);
    const d  = dailyStats.find(d=>d.recibidos.includes(pos));
    if(el) recRows.push([el.lote||"",el.torre||"",el.piso||"",el.tipo,el.pos,el.area,d?.date||""]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recRows), "Recibidos");
  const incRows = [["Fecha","Observación"]];
  dailyStats.filter(d=>getWeekNumber(d.date)===weekLabel).forEach(d=>incRows.push([d.date,d.note||"Sin incidencias"]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incRows), "Incidencias");
  XLSX.writeFile(wb, `informe_semana_${weekLabel}.xlsx`);
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("select");
  const [obras, setObras] = useState([]);
  const [selectedObra, setSelectedObra] = useState(null);
  const [adminPin, setAdminPin] = useState("");
  const [adminError, setAdminError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { loadObras(); }, []);

  async function loadObras() {
    setLoading(true);
    try { const data = await sbFetch("obras?select=*&order=created_at.desc"); setObras(data); }
    catch(e) { setError("Error cargando obras: " + e.message); }
    setLoading(false);
  }

  function handleAdminLogin() {
    if (adminPin === ADMIN_PIN) { setScreen("admin"); setAdminError(false); }
    else setAdminError(true);
  }

  if (loading) return <LoadingScreen/>;

  return (
    <div style={{ minHeight:"100vh", background:"#e2e8f0", fontFamily:"'DM Mono','Courier New',monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Archivo+Black&display=swap" rel="stylesheet"/>
      {error && <ErrorBar msg={error} onClose={()=>setError(null)}/>}
      {screen==="select"     && <SelectScreen obras={obras} onSelectObra={o=>{setSelectedObra(o);setScreen("obra");}} onAdminClick={()=>setScreen("adminLogin")} onRefresh={loadObras}/>}
      {screen==="adminLogin" && <AdminLogin pin={adminPin} setPin={setAdminPin} error={adminError} onLogin={handleAdminLogin} onBack={()=>{setScreen("select");setAdminPin("");setAdminError(false);}}/>}
      {screen==="admin"      && <AdminPanel obras={obras} onBack={()=>setScreen("select")} onObraCreated={loadObras} setError={setError}/>}
      {screen==="obra"       && selectedObra && <ObraView obra={selectedObra} onBack={()=>setScreen("select")} setError={setError}/>}
    </div>
  );
}

// ── Select Screen ─────────────────────────────────────────────────────────────
function SelectScreen({ obras, onSelectObra, onAdminClick, onRefresh }) {
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:24, color:"#d97706", marginBottom:4 }}>◈ CONTROL DE MONTAJE</div>
      <div style={{ fontSize:10, color:"#94a3b8", letterSpacing:3, marginBottom:32 }}>BAUMAX SPA</div>
      <div style={{ background:"#f8fafc", border:"1px solid #cbd5e1", borderRadius:12, padding:24, width:"100%", maxWidth:480 }}>
        <div style={{ fontSize:10, color:"#64748b", letterSpacing:2, marginBottom:16 }}>SELECCIONAR OBRA</div>
        {obras.length===0 ? (
          <div style={{ color:"#94a3b8", fontSize:12, textAlign:"center", padding:20 }}>No hay obras activas. Ingresá como admin para crear una.</div>
        ) : obras.map(o=>(
          <div key={o.id} onClick={()=>onSelectObra(o)} style={{ padding:"14px 16px", background:"#f1f5f9", border:"1px solid #cbd5e1", borderRadius:8, cursor:"pointer", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}
            onMouseEnter={e=>e.currentTarget.style.background="#e2e8f0"} onMouseLeave={e=>e.currentTarget.style.background="#f1f5f9"}>
            <div>
              <div style={{ color:"#1e293b", fontWeight:"bold", fontSize:13 }}>{o.nombre}</div>
              <div style={{ color:"#94a3b8", fontSize:10, marginTop:2 }}>{o.ubicacion} · Inicio: {o.fecha_inicio}</div>
            </div>
            <div style={{ color:"#d97706", fontSize:18 }}>→</div>
          </div>
        ))}
        <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #cbd5e1", display:"flex", justifyContent:"space-between" }}>
          <button onClick={onRefresh} style={btnSecondary}>↺ Actualizar</button>
          <button onClick={onAdminClick} style={btnPrimary}>⚙ Admin</button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Login ───────────────────────────────────────────────────────────────
function AdminLogin({ pin, setPin, error, onLogin, onBack }) {
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#f8fafc", border:"1px solid #cbd5e1", borderRadius:12, padding:32, width:320 }}>
        <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:16, color:"#d97706", marginBottom:4 }}>⚙ PANEL ADMIN</div>
        <div style={{ fontSize:10, color:"#94a3b8", letterSpacing:2, marginBottom:20 }}>INGRESA TU PIN</div>
        <input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onLogin()}
          placeholder="PIN numérico" style={{ ...inp, marginBottom:8, fontSize:18, letterSpacing:4, textAlign:"center" }}/>
        {error && <div style={{ color:"#dc2626", fontSize:11, marginBottom:8, textAlign:"center" }}>PIN incorrecto</div>}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onBack} style={{ ...btnSecondary, flex:1 }}>← Volver</button>
          <button onClick={onLogin} style={{ ...btnPrimary, flex:1 }}>Entrar</button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel({ obras, onBack, onObraCreated, setError }) {
  const [tab, setTab] = useState("obras");
  const [newObra, setNewObra] = useState({ nombre:"", ubicacion:"", fecha_inicio:TODAY });
  const [creando, setCreando] = useState(false);
  const [obraId, setObraId] = useState(obras[0]?.id||"");
  const [uploadStatus, setUploadStatus] = useState("");
  const [programa, setPrograma] = useState({ obra_id:obras[0]?.id||"", semana:"", meta:"" });
  const [programaRows, setProgramaRows] = useState([]);
  const fileRef = useRef();

  async function crearObra() {
    if (!newObra.nombre) return;
    setCreando(true);
    try {
      await sbFetch("obras", { method:"POST", body:JSON.stringify({ nombre:newObra.nombre, ubicacion:newObra.ubicacion, fecha_inicio:newObra.fecha_inicio, estado:"activa" }) });
      setNewObra({ nombre:"", ubicacion:"", fecha_inicio:TODAY });
      onObraCreated();
    } catch(e) { setError("Error: "+e.message); }
    setCreando(false);
  }

  async function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file || !obraId) return;
    setUploadStatus("Procesando...");
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const elementos = [];
      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });
        rows.slice(1).forEach(row => {
          if (!row[4] && !row[3]) return; // need at least pos or tipo
          const tipo = String(row[3]||"").toUpperCase().trim();
          const pos  = String(row[4]||"").trim();
          if (!pos) return;
          // Handle area: may use comma as decimal separator
          let areaRaw = row[5];
          let area = 0;
          if (typeof areaRaw === "number") area = areaRaw;
          else if (typeof areaRaw === "string") area = parseFloat(areaRaw.replace(",",".")) || 0;
          elementos.push({
            obra_id: obraId,
            lote: String(row[0]||"").trim(),
            torre: String(row[1]||"").trim(),
            piso: String(row[2]||"").trim(),
            tipo,
            pos,
            area,
            estado: "pendiente",
          });
        });
      });
      for (let i=0; i<elementos.length; i+=50) {
        await sbFetch("elementos", { method:"POST", body:JSON.stringify(elementos.slice(i,i+50)), headers:{"Prefer":"return=minimal"} });
      }
      setUploadStatus(`✓ ${elementos.length} elementos cargados`);
    } catch(e) { setUploadStatus("Error: "+e.message); }
    e.target.value = "";
  }

  async function agregarPrograma() {
    if (!programa.obra_id||!programa.semana||!programa.meta) return;
    try {
      await sbFetch("programa", { method:"POST", body:JSON.stringify({ obra_id:programa.obra_id, semana:programa.semana, meta:parseFloat(programa.meta) }) });
      setProgramaRows(prev=>[...prev,{...programa}]);
      setPrograma(p=>({...p,semana:"",meta:""}));
    } catch(e) { setError("Error: "+e.message); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#e2e8f0" }}>
      <div style={{ background:"#f8fafc", borderBottom:"1px solid #cbd5e1", padding:"14px 28px", display:"flex", alignItems:"center", gap:16 }}>
        <button onClick={onBack} style={btnSecondary}>← Volver</button>
        <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:18, color:"#d97706" }}>⚙ PANEL ADMINISTRADOR</div>
      </div>
      <div style={{ display:"flex", background:"#f8fafc", borderBottom:"1px solid #cbd5e1", padding:"0 28px" }}>
        {[["obras","Obras"],["elementos","Cargar Elementos"],["programa","Programa Semanal"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ background:"none",border:"none",cursor:"pointer",padding:"12px 18px",color:tab===k?"#d97706":"#64748b",borderBottom:tab===k?"2px solid #d97706":"2px solid transparent",fontFamily:"'DM Mono',monospace",fontSize:11 }}>{l}</button>
        ))}
      </div>
      <div style={{ padding:"24px 28px", maxWidth:800, margin:"0 auto" }}>
        {tab==="obras" && (
          <div>
            <Panel title="CREAR NUEVA OBRA">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><Label>Nombre obra</Label><input value={newObra.nombre} onChange={e=>setNewObra(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Torre A - Santiago" style={inp}/></div>
                <div><Label>Ubicación</Label><input value={newObra.ubicacion} onChange={e=>setNewObra(p=>({...p,ubicacion:e.target.value}))} placeholder="Ej: Las Condes" style={inp}/></div>
                <div><Label>Fecha inicio</Label><input type="date" value={newObra.fecha_inicio} onChange={e=>setNewObra(p=>({...p,fecha_inicio:e.target.value}))} style={inp}/></div>
              </div>
              <button onClick={crearObra} disabled={creando||!newObra.nombre} style={{ ...btnPrimary, marginTop:12 }}>{creando?"Creando...":"+ Crear Obra"}</button>
            </Panel>
            <Panel title="OBRAS ACTIVAS">
              {obras.length===0&&<div style={{ color:"#94a3b8",fontSize:12 }}>No hay obras.</div>}
              {obras.map(o=>(
                <div key={o.id} style={{ padding:"12px 0",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between" }}>
                  <div><div style={{ color:"#1e293b",fontWeight:"bold" }}>{o.nombre}</div><div style={{ color:"#94a3b8",fontSize:10 }}>{o.ubicacion} · {o.fecha_inicio}</div></div>
                  <div style={{ fontSize:10,color:"#16a34a",border:"1px solid #16a34a33",padding:"2px 8px",borderRadius:10,alignSelf:"center" }}>{o.estado}</div>
                </div>
              ))}
            </Panel>
          </div>
        )}
        {tab==="elementos" && (
          <Panel title="CARGAR ELEMENTOS DESDE EXCEL">
            <div style={{ background:"#fef9c3",border:"1px solid #fde68a",borderRadius:6,padding:10,marginBottom:12,fontSize:11,color:"#92400e" }}>
              <b>Formato esperado:</b> Columna 1=Lote, 2=Torre, 3=Piso, 4=Tipo (MD/MDT/P), 5=Posición, 6=Área m²<br/>
              Fila 1 = encabezados (se omite). Lote puede estar vacío.
            </div>
            <Label>Obra destino</Label>
            <select value={obraId} onChange={e=>setObraId(e.target.value)} style={inp}>
              {obras.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <div style={{ background:"#f1f5f9",border:"2px dashed #cbd5e1",borderRadius:8,padding:24,textAlign:"center",marginTop:12 }}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} style={{ display:"none" }}/>
              <button onClick={()=>fileRef.current.click()} style={btnPrimary}>↑ Seleccionar Excel</button>
              {uploadStatus&&<div style={{ marginTop:12,color:uploadStatus.startsWith("✓")?"#16a34a":"#dc2626",fontSize:12 }}>{uploadStatus}</div>}
            </div>
          </Panel>
        )}
        {tab==="programa" && (
          <Panel title="PROGRAMA SEMANAL">
            <Label>Obra</Label>
            <select value={programa.obra_id} onChange={e=>setPrograma(p=>({...p,obra_id:e.target.value}))} style={inp}>
              {obras.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,marginTop:12,alignItems:"flex-end" }}>
              <div><Label>Semana (ej: 22.2026)</Label><input value={programa.semana} onChange={e=>setPrograma(p=>({...p,semana:e.target.value}))} placeholder="22.2026" style={inp}/></div>
              <div><Label>m² programados</Label><input type="number" value={programa.meta} onChange={e=>setPrograma(p=>({...p,meta:e.target.value}))} placeholder="600" style={inp}/></div>
              <button onClick={agregarPrograma} style={{ ...btnPrimary,marginBottom:1 }}>+</button>
            </div>
            {programaRows.length>0&&(
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,marginTop:16 }}>
                <thead><tr><Th>SEMANA</Th><Th>m² PROG.</Th></tr></thead>
                <tbody>{programaRows.map((r,i)=><tr key={i} style={{ borderBottom:"1px solid #f1f5f9" }}><Td accent="#d97706">{r.semana}</Td><Td>{r.meta}</Td></tr>)}</tbody>
              </table>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

// ── Obra View ─────────────────────────────────────────────────────────────────
function ObraView({ obra, onBack, setError }) {
  const [elements, setElements] = useState([]);
  const [logs, setLogs] = useState([]);
  const [programa, setPrograma] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [personal, setPersonal] = useState(defaultPersonal());
  const [selectedMontados, setSelectedMontados] = useState([]);
  const [selectedRecibidos, setSelectedRecibidos] = useState([]);
  const [registroMode, setRegistroMode] = useState("montar"); // montar | recibir
  const [note, setNote] = useState("");
  const [activeTab, setActiveTab] = useState("registro");
  const [filters, setFilters] = useState({ search:"", tipo:"TODOS", torre:"TODAS", piso:"TODOS", lote:"TODOS", estado:"TODOS" });
  const [sortCol, setSortCol] = useState("pos");
  const [sortDir, setSortDir] = useState("asc");
  const setF = (key, val) => setFilters(prev => ({...prev, [key]: val}));
  const [selectedWeek, setSelectedWeek] = useState(getWeekNumber(TODAY));

  useEffect(() => { loadData(); }, [obra.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [elemData, regData, progData] = await Promise.all([
        sbFetch(`elementos?obra_id=eq.${obra.id}&select=*`),
        sbFetch(`registros?obra_id=eq.${obra.id}&select=*&order=fecha.asc`),
        sbFetch(`programa?obra_id=eq.${obra.id}&select=*&order=semana.asc`),
      ]);
      setElements(elemData.map(e=>({ pos:e.pos, lote:e.lote||"", torre:e.torre||"", piso:e.piso||"", tipo:e.tipo, area:e.area||0, estado:e.estado||"pendiente", id:e.id })));
      const expanded = [];
      regData.forEach(row => {
        const montados = row.elementos_montados ? row.elementos_montados.split(",").map(p=>p.trim()).filter(Boolean) : [];
        const recibidos = row.elementos_recibidos ? row.elementos_recibidos.split(",").map(p=>p.trim()).filter(Boolean) : [];
        expanded.push({
          date: row.fecha, montados, recibidos,
          personal: { coordinadores:row.coordinadores||0, calidad:row.calidad||0, lideres:row.lideres||0, montajistas:row.montajistas||0, ayudantes:row.ayudantes||0 },
          note: row.incidencias||""
        });
      });
      setLogs(expanded);
      setPrograma(progData);
    } catch(e) { setError("Error: "+e.message); }
    setLoading(false);
  }

  // Derived state from logs
  const montadosPos = useMemo(() => new Set(logs.flatMap(l=>l.montados)), [logs]);
  const recibidosPos = useMemo(() => new Set(logs.flatMap(l=>l.recibidos)), [logs]);

  function getEstado(pos) {
    if (montadosPos.has(pos)) return "montado";
    if (recibidosPos.has(pos)) return "recibido";
    return "pendiente";
  }

  const stats = useMemo(() => {
    const all = elements;
    const mounted = all.filter(e=>montadosPos.has(e.pos));
    const received = all.filter(e=>recibidosPos.has(e.pos)&&!montadosPos.has(e.pos));
    const pending = all.filter(e=>!recibidosPos.has(e.pos)&&!montadosPos.has(e.pos));
    const md = all.filter(e=>TIPOS_MD.includes(e.tipo));
    const p  = all.filter(e=>e.tipo==="P");
    const mdM = md.filter(e=>montadosPos.has(e.pos));
    const pM  = p.filter(e=>montadosPos.has(e.pos));
    return {
      total: all.length, mounted: mounted.length, received: received.length, pending: pending.length,
      areaTotal: all.reduce((s,e)=>s+e.area,0),
      areaMounted: mounted.reduce((s,e)=>s+e.area,0),
      areaReceived: [...mounted,...received].reduce((s,e)=>s+e.area,0),
      md: { total:md.length, mounted:mdM.length, areaTotal:md.reduce((s,e)=>s+e.area,0), areaMounted:mdM.reduce((s,e)=>s+e.area,0) },
      p:  { total:p.length,  mounted:pM.length,  areaTotal:p.reduce((s,e)=>s+e.area,0),  areaMounted:pM.reduce((s,e)=>s+e.area,0) },
    };
  }, [elements, montadosPos, recibidosPos]);

  const pctMD  = stats.md.areaTotal>0?(stats.md.areaMounted/stats.md.areaTotal)*100:0;
  const pctP   = stats.p.areaTotal>0?(stats.p.areaMounted/stats.p.areaTotal)*100:0;
  const pctAll = stats.areaTotal>0?(stats.areaMounted/stats.areaTotal)*100:0;
  const pctRec = stats.areaTotal>0?(stats.areaReceived/stats.areaTotal)*100:0;

  const dailyStats = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      if (!map[l.date]) map[l.date] = { date:l.date, montados:[], recibidos:[], personal:l.personal, note:l.note };
      map[l.date].montados.push(...l.montados);
      map[l.date].recibidos.push(...l.recibidos);
      map[l.date].note = l.note || map[l.date].note;
    });
    return Object.values(map).map(d => {
      const elems = elements.filter(e=>d.montados.includes(e.pos));
      const mdEl = elems.filter(e=>TIPOS_MD.includes(e.tipo));
      const pEl  = elems.filter(e=>e.tipo==="P");
      const areaMD = mdEl.reduce((s,e)=>s+e.area,0);
      const areaP  = pEl.reduce((s,e)=>s+e.area,0);
      const areaTotal = areaMD+areaP;
      const areaRecibida = elements.filter(e=>d.recibidos.includes(e.pos)).reduce((s,e)=>s+e.area,0);
      const p = d.personal;
      const eq = (p.coordinadores||0)+(p.calidad||0)+(p.lideres||0)+(p.montajistas||0)+(p.ayudantes||0);
      return {
        ...d, areaMD, areaP, areaTotal, areaRecibida,
        rendLider:      p.lideres>0?areaTotal/p.lideres:0,
        rendMontajista: p.montajistas>0?areaTotal/p.montajistas:0,
        rendAyudante:   p.ayudantes>0?areaTotal/p.ayudantes:0,
        rendEquipo:     eq>0?areaTotal/eq:0,
        equipoCompleto: eq,
      };
    }).sort((a,b)=>b.date.localeCompare(a.date));
  }, [logs, elements]);

  const weeklyStats = useMemo(() => {
    const map = {};
    dailyStats.forEach(d => {
      const week = getWeekNumber(d.date);
      if (!map[week]) map[week] = { week, days:[], montados:[], recibidos:[] };
      map[week].days.push(d);
      map[week].montados.push(...d.montados);
      map[week].recibidos.push(...d.recibidos);
    });
    return Object.values(map).map(w => {
      const diasEfectivos = w.days.filter(d=>d.areaTotal>0).length;
      const areaTotal = w.days.reduce((s,d)=>s+d.areaTotal,0);
      const areaMD = w.days.reduce((s,d)=>s+d.areaMD,0);
      const areaP  = w.days.reduce((s,d)=>s+d.areaP,0);
      const areaRecibida = w.days.reduce((s,d)=>s+d.areaRecibida,0);
      const avgP = {
        coordinadores: Math.round(w.days.reduce((s,d)=>s+d.personal.coordinadores,0)/w.days.length),
        calidad:       Math.round(w.days.reduce((s,d)=>s+d.personal.calidad,0)/w.days.length),
        lideres:       Math.round(w.days.reduce((s,d)=>s+d.personal.lideres,0)/w.days.length),
        montajistas:   Math.round(w.days.reduce((s,d)=>s+d.personal.montajistas,0)/w.days.length),
        ayudantes:     Math.round(w.days.reduce((s,d)=>s+d.personal.ayudantes,0)/w.days.length),
      };
      const eq = Object.values(avgP).reduce((a,b)=>a+b,0);
      return {
        week:w.week, diasEfectivos, areaTotal, areaMD, areaP, areaRecibida,
        montados:w.montados, recibidos:w.recibidos,
        personal:avgP, equipoCompleto:eq,
        rendLider:      avgP.lideres>0?areaTotal/avgP.lideres:0,
        rendMontajista: avgP.montajistas>0?areaTotal/avgP.montajistas:0,
        rendAyudante:   avgP.ayudantes>0?areaTotal/avgP.ayudantes:0,
        rendEquipo:     eq>0?areaTotal/eq:0,
        rendEfectivo:   diasEfectivos>0?areaTotal/diasEfectivos:0,
      };
    }).sort((a,b)=>b.week.localeCompare(a.week));
  }, [dailyStats]);

  const programaAcum = useMemo(() => {
    let acum = 0;
    return programa.map(p => {
      acum += p.meta;
      const realAcum = weeklyStats.filter(w=>w.week<=p.semana).reduce((s,w)=>s+w.areaTotal,0);
      return { semana:p.semana, acum, real:weeklyStats.find(w=>w.week===p.semana)?realAcum:null };
    });
  }, [programa, weeklyStats]);

  const lotes  = useMemo(()=>["TODOS",...new Set(elements.map(e=>e.lote).filter(Boolean).sort())],[elements]);
  const torres = useMemo(()=>["TODAS",...new Set(elements.map(e=>e.torre).filter(Boolean).sort())],[elements]);
  const pisos  = useMemo(()=>["TODOS",...new Set(elements.map(e=>e.piso).filter(Boolean).sort())]  ,[elements]);

  // Direct filter computation — no useMemo to avoid stale closure issues
  function applyFilters(arr) {
    return arr.filter(e => {
      const s = filters.search.toLowerCase();
      const ms = e.pos.toLowerCase().includes(s) || e.torre.toLowerCase().includes(s) || e.piso.toLowerCase().includes(s);
      const mt  = filters.tipo   === "TODOS" || e.tipo  === filters.tipo;
      const mtr = filters.torre  === "TODAS" || e.torre === filters.torre;
      const mp  = filters.piso   === "TODOS" || e.piso  === filters.piso;
      const ml  = filters.lote   === "TODOS" || e.lote  === filters.lote;
      const est = getEstado(e.pos);
      const me  = filters.estado === "TODOS" || est === filters.estado.toLowerCase();
      return ms && mt && mtr && mp && ml && me;
    }).sort((a,b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
    });
  }
  const filteredElements = applyFilters(elements);

  function handleSort(col) {
    if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function toggleSelection(pos, mode) {
    if (mode==="montar") {
      // Can only mount received or pending (allow same-day receive+mount)
      setSelectedMontados(prev=>prev.includes(pos)?prev.filter(p=>p!==pos):[...prev,pos]);
    } else {
      setSelectedRecibidos(prev=>prev.includes(pos)?prev.filter(p=>p!==pos):[...prev,pos]);
    }
  }

  async function registrar() {
    if (selectedMontados.length===0&&selectedRecibidos.length===0) return;
    setSaving(true);
    try {
      const toMount = selectedMontados.filter(p=>!montadosPos.has(p));
      const toReceive = selectedRecibidos.filter(p=>!recibidosPos.has(p)&&!montadosPos.has(p));
      const mdEls = elements.filter(e=>toMount.includes(e.pos)&&TIPOS_MD.includes(e.tipo));
      const pEls  = elements.filter(e=>toMount.includes(e.pos)&&e.tipo==="P");
      await sbFetch("registros", {
        method:"POST",
        body:JSON.stringify({
          fecha:selectedDate, obra_id:obra.id,
          coordinadores:personal.coordinadores, calidad:personal.calidad,
          lideres:personal.lideres, montajistas:personal.montajistas, ayudantes:personal.ayudantes,
          m2_md:mdEls.reduce((s,e)=>s+e.area,0), m2_p:pEls.reduce((s,e)=>s+e.area,0),
          elementos_montados:toMount.join(","),
          elementos_recibidos:toReceive.join(","),
          incidencias:note, registrado_por:"encargado",
        }),
      });
      setLogs(prev=>[...prev,{ date:selectedDate, montados:toMount, recibidos:toReceive, personal:{...personal}, note }]);
      setSelectedMontados([]); setSelectedRecibidos([]); setNote("");
    } catch(e) { setError("Error: "+e.message); }
    setSaving(false);
  }

  const currentWeekData = weeklyStats.find(w=>w.week===selectedWeek);
  const selCount = registroMode==="montar"?selectedMontados.length:selectedRecibidos.length;
  const selArea  = registroMode==="montar"
    ? elements.filter(e=>selectedMontados.includes(e.pos)).reduce((s,e)=>s+e.area,0)
    : elements.filter(e=>selectedRecibidos.includes(e.pos)).reduce((s,e)=>s+e.area,0);

  if(loading) return <LoadingScreen/>;

  return (
    <div style={{ minHeight:"100vh", background:"#e2e8f0" }}>
      {/* Header */}
      <div style={{ background:"#f8fafc", borderBottom:"1px solid #cbd5e1", padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <button onClick={onBack} style={btnSecondary}>← Obras</button>
          <div>
            <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:18, color:"#d97706" }}>◈ {obra.nombre}</div>
            <div style={{ fontSize:9, color:"#94a3b8", letterSpacing:2 }}>{obra.ubicacion} · SEMANA {getWeekNumber(TODAY)}</div>
          </div>
        </div>
        {/* KPIs */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <KPIBox label="RECIBIDOS" value={fmtPct(pctRec)} sub={fmt2(stats.areaReceived)+" m²"} color="#2563eb"/>
          <KPIBox label="MONTADOS MD/MDT" value={fmtPct(pctMD)} sub={fmt2(stats.md.areaMounted)+"/"+fmt2(stats.md.areaTotal)+" m²"} color="#16a34a"/>
          <KPIBox label="MONTADOS P" value={fmtPct(pctP)} sub={fmt2(stats.p.areaMounted)+"/"+fmt2(stats.p.areaTotal)+" m²"} color="#2563eb"/>
          <KPIBox label="AVANCE TOTAL" value={fmtPct(pctAll)} sub={fmt2(stats.areaMounted)+"/"+fmt2(stats.areaTotal)+" m²"} color="#d97706" large/>
        </div>
      </div>

      {/* Progress bars */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", height:5 }}>
        <div style={{ background:"#dbeafe" }}><div style={{ height:5,width:pctRec+"%",background:"#2563eb",transition:"width 0.6s" }}/></div>
        <div style={{ background:"#dcfce7" }}><div style={{ height:5,width:pctMD+"%",background:"#16a34a",transition:"width 0.6s" }}/></div>
        <div style={{ background:"#dbeafe" }}><div style={{ height:5,width:pctP+"%",background:"#3b82f6",transition:"width 0.6s" }}/></div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", background:"#f8fafc", borderBottom:"1px solid #cbd5e1", padding:"0 28px" }}>
        {[["registro","▷ REGISTRO"],["elementos","◈ ELEMENTOS"],["historial","◫ HISTORIAL"],["semanal","◷ SEMANAL"],["curvaS","↗ CURVA S"]].map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k)} style={{ background:"none",border:"none",cursor:"pointer",padding:"12px 16px",color:activeTab===k?"#d97706":"#64748b",borderBottom:activeTab===k?"2px solid #d97706":"2px solid transparent",fontFamily:"'DM Mono',monospace",fontSize:11 }}>{l}</button>
        ))}
      </div>

      <div style={{ padding:"20px 28px", maxWidth:1400, margin:"0 auto" }}>

        {/* ── REGISTRO ── */}
        {activeTab==="registro" && (
          <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:20 }}>
            <div>
              <Panel title="PARÁMETROS DEL DÍA">
                <Label>Fecha</Label>
                <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={inp}/>
                <div style={{ fontSize:9,color:"#94a3b8",letterSpacing:2,marginTop:4 }}>SEMANA {getWeekNumber(selectedDate)}</div>
                <Label>PERSONAL EN OBRA</Label>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:4 }}>
                  {PERSONAL_CARGOS.map(cargo=>(
                    <div key={cargo.key}>
                      <div style={{ fontSize:9,color:cargo.productivo?"#d97706":"#94a3b8",letterSpacing:1,marginBottom:2 }}>{cargo.label.toUpperCase()} {cargo.productivo?"★":""}</div>
                      <input type="number" min={0} max={cargo.max} value={personal[cargo.key]} onChange={e=>setPersonal(prev=>({...prev,[cargo.key]:Number(e.target.value)}))} style={{ ...inp,margin:0 }}/>
                    </div>
                  ))}
                </div>
                <Label>Incidencias / Nota</Label>
                <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="Observaciones…" style={{ ...inp,resize:"vertical",fontFamily:"'DM Mono',monospace",fontSize:11 }}/>
                {(selectedMontados.length>0||selectedRecibidos.length>0)&&(
                  <div style={{ background:"#f1f5f9",borderRadius:6,padding:10,marginTop:8,border:"1px solid #cbd5e1",fontSize:11 }}>
                    <div style={{ color:"#94a3b8",fontSize:9,letterSpacing:2,marginBottom:6 }}>SELECCIÓN</div>
                    {selectedRecibidos.length>0&&<div style={{ color:"#2563eb" }}>Recibir: {selectedRecibidos.length} elem · {fmt2(elements.filter(e=>selectedRecibidos.includes(e.pos)).reduce((s,e)=>s+e.area,0))} m²</div>}
                    {selectedMontados.length>0&&<div style={{ color:"#16a34a",marginTop:3 }}>Montar: {selectedMontados.length} elem · {fmt2(elements.filter(e=>selectedMontados.includes(e.pos)).reduce((s,e)=>s+e.area,0))} m²</div>}
                  </div>
                )}
                <button onClick={registrar} disabled={(selectedMontados.length===0&&selectedRecibidos.length===0)||saving} style={{
                  width:"100%",padding:"11px",marginTop:10,
                  background:(selectedMontados.length>0||selectedRecibidos.length>0)&&!saving?"#d97706":"#e2e8f0",
                  color:(selectedMontados.length>0||selectedRecibidos.length>0)&&!saving?"#fff":"#94a3b8",
                  border:"none",borderRadius:6,cursor:(selectedMontados.length>0||selectedRecibidos.length>0)&&!saving?"pointer":"default",
                  fontFamily:"'Archivo Black',sans-serif",fontSize:13,letterSpacing:1,
                }}>{saving?"GUARDANDO…":"▷ REGISTRAR"}</button>
              </Panel>

              {/* Resumen hoy */}
              {dailyStats.filter(d=>d.date===selectedDate).map(d=>(
                <Panel key={d.date} title="RESUMEN HOY">
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10 }}>
                    <MiniStat label="m² Recibidos" value={fmt2(d.areaRecibida)} color="#2563eb" small/>
                    <MiniStat label="m² Montados" value={fmt2(d.areaTotal)} color="#16a34a" small/>
                    <MiniStat label="MD/MDT" value={fmt2(d.areaMD)} color="#16a34a" small/>
                    <MiniStat label="Prelosas" value={fmt2(d.areaP)} color="#2563eb" small/>
                  </div>
                  <div style={{ borderTop:"1px solid #cbd5e1",paddingTop:8 }}>
                    <div style={{ fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:6 }}>RENDIMIENTOS m²/persona</div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                      <MiniStat label="Líder" value={fmt2(d.rendLider)} color="#d97706" small/>
                      <MiniStat label="Montajista" value={fmt2(d.rendMontajista)} color="#d97706" small/>
                      <MiniStat label="Ayudante" value={fmt2(d.rendAyudante)} color="#d97706" small/>
                      <MiniStat label="Equipo" value={fmt2(d.rendEquipo)} color="#d97706" small/>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>

            {/* Tabla elementos */}
            <Panel title="ELEMENTOS">
              {/* Modo selector */}
              <div style={{ display:"flex",gap:8,marginBottom:12,alignItems:"center" }}>
                <div style={{ fontSize:10,color:"#64748b",marginRight:4 }}>MODO:</div>
                <button onClick={()=>setRegistroMode("recibir")} style={{ padding:"6px 14px",borderRadius:5,border:"1px solid",borderColor:registroMode==="recibir"?"#2563eb":"#cbd5e1",background:registroMode==="recibir"?"#dbeafe":"#f8fafc",color:registroMode==="recibir"?"#2563eb":"#64748b",fontFamily:"'DM Mono',monospace",fontSize:11,cursor:"pointer" }}>↓ RECIBIR</button>
                <button onClick={()=>setRegistroMode("montar")} style={{ padding:"6px 14px",borderRadius:5,border:"1px solid",borderColor:registroMode==="montar"?"#16a34a":"#cbd5e1",background:registroMode==="montar"?"#dcfce7":"#f8fafc",color:registroMode==="montar"?"#16a34a":"#64748b",fontFamily:"'DM Mono',monospace",fontSize:11,cursor:"pointer" }}>▲ MONTAR</button>
                <div style={{ fontSize:10,color:"#94a3b8",marginLeft:8 }}>
                  {registroMode==="recibir"?"Seleccioná elementos que llegaron hoy a obra":"Seleccioná elementos que fueron montados hoy"}
                </div>
              </div>

              {/* Filtros */}
              <div style={{ display:"flex",gap:6,marginBottom:10,flexWrap:"wrap" }}>
                <input placeholder="Buscar posición…" value={filters.search} onChange={e=>setF("search", e.target.value)} style={{ ...inp,flex:1,margin:0,minWidth:120 }}/>
                <select value={filters.lote} onChange={e=>setF("lote", e.target.value)} style={{ ...inp,margin:0,width:"auto" }}>
                  {lotes.map(t=><option key={t} value={t}>{t==="TODOS"?"Lote: Todos":t}</option>)}
                </select>
                <select value={filters.torre} onChange={e=>setF("torre", e.target.value)} style={{ ...inp,margin:0,width:"auto" }}>
                  {torres.map(t=><option key={t} value={t}>{t==="TODAS"?"Torre: Todas":t}</option>)}
                </select>
                <select value={filters.piso} onChange={e=>setF("piso", e.target.value)} style={{ ...inp,margin:0,width:"auto" }}>
                  {pisos.map(t=><option key={t} value={t}>{t==="TODOS"?"Piso: Todos":t}</option>)}
                </select>
                {["TODOS","MD","MDT","P"].map(t=>(
                  <button key={t} onClick={()=>setF("tipo", t)} style={{ padding:"5px 10px",borderRadius:5,border:"1px solid",borderColor:filters.tipo===t?"#d97706":"#cbd5e1",background:filters.tipo===t?"#fef3c7":"#f8fafc",color:filters.tipo===t?"#d97706":"#64748b",fontFamily:"'DM Mono',monospace",fontSize:10,cursor:"pointer" }}>{t}</button>
                ))}
                {["TODOS","pendiente","recibido","montado"].map(t=>(
                  <button key={t} onClick={()=>setF("estado", t)} style={{ padding:"5px 10px",borderRadius:5,border:"1px solid",borderColor:filters.estado===t?"#475569":"#cbd5e1",background:filters.estado===t?"#f1f5f9":"#f8fafc",color:filters.estado===t?"#1e293b":"#94a3b8",fontFamily:"'DM Mono',monospace",fontSize:9,cursor:"pointer",textTransform:"uppercase" }}>{t==="TODOS"?"Estado":t}</button>
                ))}
              </div>

              <div style={{ maxHeight:520,overflowY:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                  <thead>
                    <tr style={{ background:"#f1f5f9",position:"sticky",top:0 }}>
                      <Th>SEL</Th>
                      {[["lote","LOTE"],["torre","TORRE"],["piso","PISO"],["tipo","TIPO"],["pos","POSICIÓN"],["area","ÁREA m²"],["estado","ESTADO"]].map(([col,label])=>(
                        <th key={col} onClick={()=>handleSort(col)} style={{ padding:"7px 8px",textAlign:"left",color:"#64748b",fontSize:9,letterSpacing:1,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",borderBottom:"1px solid #cbd5e1",background:"#f1f5f9" }}>
                          {label} {sortCol===col?(sortDir==="asc"?"↑":"↓"):""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredElements.map(el => {
                      const estado = getEstado(el.pos);
                      const isMounted = estado==="montado";
                      const isReceived = estado==="recibido";
                      const isSelM = selectedMontados.includes(el.pos);
                      const isSelR = selectedRecibidos.includes(el.pos);
                      const isSel = registroMode==="montar"?isSelM:isSelR;
                      const canSelect = registroMode==="montar"?!isMounted:(!(isReceived||isMounted));
                      const tc = TIPOS_MD.includes(el.tipo)?"#16a34a":"#2563eb";

                      let rowBg = "#ffffff";
                      if (isMounted) rowBg = "#f0fdf4";
                      else if (isReceived) rowBg = "#eff6ff";
                      if (isSel) rowBg = registroMode==="montar"?"#dcfce7":"#dbeafe";

                      const estadoConfig = {
                        montado:  { bg:"#dcfce7",color:"#16a34a",label:"MONTADO" },
                        recibido: { bg:"#dbeafe",color:"#2563eb",label:"RECIBIDO" },
                        pendiente:{ bg:"#f1f5f9",color:"#94a3b8",label:"PENDIENTE" },
                      }[estado];

                      return (
                        <tr key={el.pos} onClick={()=>canSelect&&toggleSelection(el.pos,registroMode)} style={{ background:rowBg,borderBottom:"1px solid #f1f5f9",cursor:canSelect?"pointer":"default",opacity:!canSelect&&!isSel?0.5:1 }}>
                          <Td>
                            <div style={{ width:14,height:14,borderRadius:3,border:`2px solid ${isSel?(registroMode==="montar"?"#16a34a":"#2563eb"):"#cbd5e1"}`,background:isSel?(registroMode==="montar"?"#16a34a":"#2563eb"):"transparent",display:"flex",alignItems:"center",justifyContent:"center" }}>
                              {isSel&&<span style={{ fontSize:9,color:"#fff",fontWeight:"bold" }}>✓</span>}
                            </div>
                          </Td>
                          <Td>{el.lote}</Td>
                          <Td>{el.torre}</Td>
                          <Td>{el.piso}</Td>
                          <Td><span style={{ color:tc,fontSize:9,border:`1px solid ${tc}33`,padding:"1px 5px",borderRadius:8 }}>{el.tipo}</span></Td>
                          <Td accent="#1e293b">{el.pos}</Td>
                          <Td accent={TIPOS_MD.includes(el.tipo)?"#16a34a":"#2563eb"}>{fmt2(el.area)}</Td>
                          <Td><span style={{ padding:"1px 7px",borderRadius:10,fontSize:9,background:estadoConfig.bg,color:estadoConfig.color,border:`1px solid ${estadoConfig.color}33` }}>{estadoConfig.label}</span></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:"#f1f5f9",borderTop:"1px solid #cbd5e1" }}>
                      <td colSpan={6} style={{ padding:"8px 10px",color:"#64748b",textAlign:"right",fontSize:10 }}>TOTAL FILTRADO</td>
                      <td style={{ padding:"8px 10px",color:"#d97706",fontWeight:"bold",fontSize:11 }}>{fmt2(filteredElements.reduce((s,e)=>s+e.area,0))} m²</td>
                      <td/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* ── ELEMENTOS ── */}
        {activeTab==="elementos" && (
          <Panel title="INVENTARIO DE ELEMENTOS">
            {/* Stats inventario */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16 }}>
              <StatCard label="PENDIENTES" value={stats.pending} sub={fmt2(elements.filter(e=>getEstado(e.pos)==="pendiente").reduce((s,e)=>s+e.area,0))+" m²"} color="#94a3b8"/>
              <StatCard label="RECIBIDOS EN OBRA" value={stats.received} sub={fmt2(elements.filter(e=>getEstado(e.pos)==="recibido").reduce((s,e)=>s+e.area,0))+" m²"} color="#2563eb"/>
              <StatCard label="MONTADOS" value={stats.mounted} sub={fmt2(stats.areaMounted)+" m²"} color="#16a34a"/>
              <StatCard label="% RECEPCIÓN" value={fmtPct(pctRec)} sub={fmt2(stats.areaReceived)+" / "+fmt2(stats.areaTotal)+" m²"} color="#d97706"/>
            </div>
            {/* Filtros */}
            <div style={{ display:"flex",gap:6,marginBottom:14,flexWrap:"wrap" }}>
              <input placeholder="Buscar…" value={filters.search} onChange={e=>setF("search", e.target.value)} style={{ ...inp,width:160,margin:0 }}/>
              <select value={filters.lote} onChange={e=>setF("lote", e.target.value)} style={{ ...inp,margin:0,width:"auto" }}>{lotes.map(t=><option key={t} value={t}>{t==="TODOS"?"Lote: Todos":t}</option>)}</select>
              <select value={filters.torre} onChange={e=>setF("torre", e.target.value)} style={{ ...inp,margin:0,width:"auto" }}>{torres.map(t=><option key={t} value={t}>{t==="TODAS"?"Torre: Todas":t}</option>)}</select>
              <select value={filters.piso} onChange={e=>setF("piso", e.target.value)} style={{ ...inp,margin:0,width:"auto" }}>{pisos.map(t=><option key={t} value={t}>{t==="TODOS"?"Piso: Todos":t}</option>)}</select>
              {["TODOS","MD","MDT","P"].map(t=><button key={t} onClick={()=>setF("tipo", t)} style={{ padding:"5px 10px",borderRadius:5,border:"1px solid",borderColor:filters.tipo===t?"#d97706":"#cbd5e1",background:filters.tipo===t?"#fef3c7":"#f8fafc",color:filters.tipo===t?"#d97706":"#64748b",fontFamily:"'DM Mono',monospace",fontSize:10,cursor:"pointer" }}>{t}</button>)}
              {["TODOS","pendiente","recibido","montado"].map(t=><button key={t} onClick={()=>setF("estado", t)} style={{ padding:"5px 10px",borderRadius:5,border:"1px solid",borderColor:filters.estado===t?"#475569":"#cbd5e1",background:filters.estado===t?"#f1f5f9":"#f8fafc",color:filters.estado===t?"#1e293b":"#94a3b8",fontFamily:"'DM Mono',monospace",fontSize:9,cursor:"pointer",textTransform:"uppercase" }}>{t==="TODOS"?"Estado":t}</button>)}
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                <thead>
                  <tr style={{ background:"#f1f5f9" }}>
                    {[["lote","LOTE"],["torre","TORRE"],["piso","PISO"],["tipo","TIPO"],["pos","POSICIÓN"],["area","ÁREA m²"]].map(([col,label])=>(
                      <th key={col} onClick={()=>handleSort(col)} style={{ padding:"7px 8px",textAlign:"left",color:"#64748b",fontSize:9,letterSpacing:1,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",borderBottom:"1px solid #cbd5e1",background:"#f1f5f9" }}>
                        {label} {sortCol===col?(sortDir==="asc"?"↑":"↓"):""}
                      </th>
                    ))}
                    <Th>ESTADO</Th><Th>F. RECEPCIÓN</Th><Th>F. MONTAJE</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredElements.map(el=>{
                    const estado = getEstado(el.pos);
                    const logR = logs.find(l=>l.recibidos.includes(el.pos));
                    const logM = logs.find(l=>l.montados.includes(el.pos));
                    const tc = TIPOS_MD.includes(el.tipo)?"#16a34a":"#2563eb";
                    const estadoConfig = { montado:{bg:"#dcfce7",color:"#16a34a",label:"MONTADO"}, recibido:{bg:"#dbeafe",color:"#2563eb",label:"RECIBIDO"}, pendiente:{bg:"#f1f5f9",color:"#94a3b8",label:"PENDIENTE"} }[estado];
                    return (
                      <tr key={el.pos} style={{ borderBottom:"1px solid #f1f5f9",background:"#ffffff" }}>
                        <Td>{el.lote}</Td><Td>{el.torre}</Td><Td>{el.piso}</Td>
                        <Td><span style={{ color:tc,fontSize:9,border:`1px solid ${tc}33`,padding:"1px 5px",borderRadius:8 }}>{el.tipo}</span></Td>
                        <Td accent="#1e293b">{el.pos}</Td>
                        <Td accent={TIPOS_MD.includes(el.tipo)?"#16a34a":"#2563eb"}>{fmt2(el.area)}</Td>
                        <Td><span style={{ padding:"1px 7px",borderRadius:10,fontSize:9,background:estadoConfig.bg,color:estadoConfig.color,border:`1px solid ${estadoConfig.color}33` }}>{estadoConfig.label}</span></Td>
                        <Td>{logR?.date||""}</Td>
                        <Td>{logM?.date||""}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {/* ── HISTORIAL ── */}
        {activeTab==="historial" && (
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20 }}>
            <Panel title="REGISTRO POR DÍA">
              {dailyStats.length===0&&<div style={{ color:"#94a3b8",fontSize:12 }}>Sin registros.</div>}
              {dailyStats.map(d=>(
                <div key={d.date} style={{ padding:"12px 0",borderBottom:"1px solid #f1f5f9" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                    <span style={{ color:"#d97706",fontSize:12,fontWeight:"bold" }}>{d.date}</span>
                    <span style={{ color:"#94a3b8",fontSize:10 }}>Sem. {getWeekNumber(d.date)}</span>
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8 }}>
                    <MiniStat label="m² Recibidos" value={fmt2(d.areaRecibida)} color="#2563eb" small/>
                    <MiniStat label="m² MD/MDT" value={fmt2(d.areaMD)} color="#16a34a" small/>
                    <MiniStat label="m² P" value={fmt2(d.areaP)} color="#2563eb" small/>
                  </div>
                  <div style={{ background:"#f1f5f9",borderRadius:6,padding:8 }}>
                    <div style={{ fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:6 }}>RENDIMIENTOS m²/persona</div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6 }}>
                      <MiniStat label={`Líder(${d.personal.lideres})`} value={fmt2(d.rendLider)} color="#d97706" small/>
                      <MiniStat label={`Mont.(${d.personal.montajistas})`} value={fmt2(d.rendMontajista)} color="#d97706" small/>
                      <MiniStat label={`Ayud.(${d.personal.ayudantes})`} value={fmt2(d.rendAyudante)} color="#d97706" small/>
                      <MiniStat label={`Equipo(${d.equipoCompleto})`} value={fmt2(d.rendEquipo)} color="#d97706" small/>
                    </div>
                  </div>
                  {d.note&&<div style={{ fontSize:10,color:"#64748b",marginTop:6,fontStyle:"italic" }}>"{d.note}"</div>}
                </div>
              ))}
            </Panel>
            <Panel title="AVANCE POR PLANO">
              {[...new Set(elements.map(e=>e.plano).filter(Boolean))].sort().map(pl=>{
                const elems = elements.filter(e=>e.plano===pl);
                const tipo = elems[0]?.tipo;
                const mounted = elems.filter(e=>montadosPos.has(e.pos));
                const areaTotal = elems.reduce((s,e)=>s+e.area,0);
                const areaMounted = mounted.reduce((s,e)=>s+e.area,0);
                const p = areaTotal>0?(areaMounted/areaTotal)*100:0;
                const color = TIPOS_MD.includes(tipo)?"#16a34a":"#2563eb";
                return (
                  <div key={pl} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4 }}>
                      <span style={{ color:"#1e293b" }}>{pl} <span style={{ color,fontSize:9 }}>{tipo}</span></span>
                      <span style={{ color,fontSize:10 }}>{mounted.length}/{elems.length} · {fmt2(areaMounted)}/{fmt2(areaTotal)} m² · {fmtPct(p)}</span>
                    </div>
                    <div style={{ background:"#f1f5f9",borderRadius:4,height:7 }}>
                      <div style={{ height:7,borderRadius:4,width:p+"%",background:color,transition:"width 0.5s" }}/>
                    </div>
                  </div>
                );
              })}
            </Panel>
          </div>
        )}

        {/* ── SEMANAL ── */}
        {activeTab==="semanal" && (
          <div>
            <div style={{ display:"flex",gap:12,alignItems:"flex-end",marginBottom:16,flexWrap:"wrap" }}>
              <div>
                <Label>Semana a exportar</Label>
                <select value={selectedWeek} onChange={e=>setSelectedWeek(e.target.value)} style={{ ...inp,width:"auto",margin:0 }}>
                  {weeklyStats.map(w=><option key={w.week} value={w.week}>{w.week}</option>)}
                  {weeklyStats.length===0&&<option value={getWeekNumber(TODAY)}>{getWeekNumber(TODAY)}</option>}
                </select>
              </div>
              <button onClick={()=>{ if(!currentWeekData){alert("Sin datos");return;} generatePDF(currentWeekData,elements,dailyStats,selectedWeek,obra.nombre); }} style={{ ...btnPrimary,background:"#d97706" }}>↓ PDF SEMANAL</button>
              <button onClick={()=>{ if(!currentWeekData){alert("Sin datos");return;} generateExcel(currentWeekData,elements,dailyStats,selectedWeek); }} style={{ ...btnPrimary,background:"#16a34a" }}>↓ EXCEL SEMANAL</button>
            </div>
            <Panel title="RESUMEN SEMANAL">
              {weeklyStats.length===0&&<div style={{ color:"#94a3b8",fontSize:12 }}>Sin registros.</div>}
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                <thead><tr style={{ background:"#f1f5f9" }}><Th>SEMANA</Th><Th>m² RECIBIDOS</Th><Th>m² MD/MDT</Th><Th>m² P</Th><Th>m² MONTADOS</Th><Th>DÍAS EFEC.</Th><Th>REND. EFEC.</Th><Th>REND. EQUIPO</Th></tr></thead>
                <tbody>
                  {weeklyStats.map(w=>(
                    <tr key={w.week} onClick={()=>setSelectedWeek(w.week)} style={{ borderBottom:"1px solid #f1f5f9",background:w.week===selectedWeek?"#fef9c3":"#ffffff",cursor:"pointer" }}>
                      <Td accent="#d97706">{w.week}</Td>
                      <Td accent="#2563eb">{fmt2(w.areaRecibida)}</Td>
                      <Td accent="#16a34a">{fmt2(w.areaMD)}</Td>
                      <Td accent="#2563eb">{fmt2(w.areaP)}</Td>
                      <Td accent="#d97706">{fmt2(w.areaTotal)}</Td>
                      <Td>{w.diasEfectivos}</Td>
                      <Td accent="#d97706">{fmt2(w.rendEfectivo)}</Td>
                      <Td accent="#d97706">{fmt2(w.rendEquipo)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        )}

        {/* ── CURVA S ── */}
        {activeTab==="curvaS" && (
          <Panel title="CURVA S — AVANCE PROGRAMADO vs REAL">
            {programaAcum.length===0?(
              <div style={{ color:"#94a3b8",fontSize:12,textAlign:"center",padding:40 }}>
                No hay programa cargado.<br/><span style={{ fontSize:10 }}>El admin puede ingresarlo desde Panel Admin → Programa Semanal.</span>
              </div>
            ):<CurvaS data={programaAcum}/>}
          </Panel>
        )}
      </div>
    </div>
  );
}

// ── Curva S ───────────────────────────────────────────────────────────────────
function CurvaS({ data }) {
  const canvasRef = useRef();
  useEffect(() => {
    const canvas = canvasRef.current; if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const W=canvas.width,H=canvas.height,padL=60,padR=30,padT=30,padB=50;
    const cW=W-padL-padR,cH=H-padT-padB;
    const maxVal=Math.max(...data.map(d=>d.acum),100);
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,W,H);
    for(let i=0;i<=4;i++){
      const y=padT+(cH/4)*i;
      ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+cW,y); ctx.stroke();
      ctx.fillStyle='#64748b'; ctx.font='11px monospace'; ctx.textAlign='right';
      ctx.fillText(Math.round(maxVal*(1-i/4)),padL-8,y+4);
    }
    data.forEach((d,i)=>{
      const x=padL+(i/(data.length-1||1))*cW;
      ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,padT+cH); ctx.stroke();
      ctx.fillStyle='#64748b'; ctx.font='10px monospace'; ctx.textAlign='center';
      ctx.fillText("S"+d.semana.split('.')[0],x,padT+cH+20);
      ctx.fillStyle='#94a3b8'; ctx.font='9px monospace';
      ctx.fillText(d.semana.split('.')[1],x,padT+cH+32);
    });
    ctx.beginPath();
    data.forEach((d,i)=>{
      const x=padL+(i/(data.length-1||1))*cW,y=padT+cH*(1-d.acum/maxVal);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.lineTo(padL+cW,padT+cH); ctx.lineTo(padL,padT+cH); ctx.closePath();
    ctx.fillStyle='rgba(37,99,235,0.08)'; ctx.fill();
    ctx.strokeStyle='#2563eb'; ctx.lineWidth=2.5; ctx.setLineDash([6,3]);
    ctx.beginPath();
    data.forEach((d,i)=>{
      const x=padL+(i/(data.length-1||1))*cW,y=padT+cH*(1-d.acum/maxVal);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.stroke(); ctx.setLineDash([]);
    const realPoints=data.filter(d=>d.real!==null);
    if(realPoints.length>0){
      ctx.strokeStyle='#16a34a'; ctx.lineWidth=3;
      ctx.beginPath();
      realPoints.forEach((d,i)=>{
        const idx=data.indexOf(d),x=padL+(idx/(data.length-1||1))*cW,y=padT+cH*(1-d.real/maxVal);
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      });
      ctx.stroke();
      realPoints.forEach(d=>{
        const idx=data.indexOf(d),x=padL+(idx/(data.length-1||1))*cW,y=padT+cH*(1-d.real/maxVal);
        ctx.fillStyle='#16a34a'; ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
        const dev=d.real-d.acum;
        ctx.fillStyle=dev>=0?'#16a34a':'#dc2626'; ctx.font='bold 10px monospace'; ctx.textAlign='center';
        ctx.fillText((dev>=0?"+":"")+Math.round(dev)+" m²",x,y-12);
      });
    }
    ctx.setLineDash([6,3]); ctx.strokeStyle='#2563eb'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(padL,16); ctx.lineTo(padL+30,16); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='#2563eb'; ctx.font='11px monospace'; ctx.textAlign='left'; ctx.fillText('Programado',padL+35,20);
    ctx.strokeStyle='#16a34a'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(padL+130,16); ctx.lineTo(padL+160,16); ctx.stroke();
    ctx.fillStyle='#16a34a'; ctx.fillText('Real',padL+165,20);
    ctx.fillStyle='#94a3b8'; ctx.font='10px monospace'; ctx.textAlign='center';
    ctx.fillText('Semana',padL+cW/2,H-5);
    ctx.save(); ctx.translate(14,padT+cH/2); ctx.rotate(-Math.PI/2);
    ctx.fillText('m² acumulados',0,0); ctx.restore();
  },[data]);
  return <canvas ref={canvasRef} width={780} height={320} style={{ width:"100%",maxWidth:780,display:"block",margin:"0 auto" }}/>;
}

// ── Shared ────────────────────────────────────────────────────────────────────
function LoadingScreen() { return <div style={{ minHeight:"100vh",background:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center" }}><div style={{ color:"#d97706",fontFamily:"'DM Mono',monospace",fontSize:14,letterSpacing:3 }}>CARGANDO…</div></div>; }
function ErrorBar({ msg,onClose }) { return <div style={{ background:"#fee2e2",color:"#dc2626",padding:"10px 28px",fontSize:11,borderBottom:"1px solid #fecaca" }}>⚠ {msg} <button onClick={onClose} style={{ marginLeft:12,background:"none",border:"none",color:"#dc2626",cursor:"pointer" }}>×</button></div>; }
function Panel({ title,children }) { return <div style={{ background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:10,padding:18,marginBottom:16 }}><div style={{ fontSize:9,letterSpacing:3,color:"#94a3b8",marginBottom:12,borderBottom:"1px solid #e2e8f0",paddingBottom:8 }}>{title}</div>{children}</div>; }
function KPIBox({ label,value,sub,color,large }) { return <div style={{ textAlign:"right",minWidth:130,background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:"8px 12px" }}><div style={{ fontSize:8,color:"#94a3b8",letterSpacing:1,marginBottom:2 }}>{label}</div><div style={{ fontSize:large?20:15,fontFamily:"'Archivo Black',sans-serif",color }}>{value}</div><div style={{ fontSize:9,color:"#94a3b8" }}>{sub}</div></div>; }
function StatCard({ label,value,sub,color }) { return <div style={{ background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:"12px 16px",textAlign:"center" }}><div style={{ fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:4 }}>{label}</div><div style={{ fontSize:22,fontFamily:"'Archivo Black',sans-serif",color }}>{value}</div><div style={{ fontSize:10,color:"#64748b",marginTop:2 }}>{sub}</div></div>; }
function Label({ children }) { return <div style={{ fontSize:9,color:"#64748b",letterSpacing:2,marginBottom:3,marginTop:10 }}>{children}</div>; }
function Th({ children }) { return <th style={{ padding:"6px 8px",textAlign:"left",color:"#64748b",fontSize:9,letterSpacing:1,borderBottom:"1px solid #cbd5e1",whiteSpace:"nowrap",background:"#f1f5f9" }}>{children}</th>; }
function Td({ children,accent }) { return <td style={{ padding:"7px 8px",color:accent||"#475569",fontSize:11,whiteSpace:"nowrap" }}>{children}</td>; }
function MiniStat({ label,value,color,small }) { return <div style={{ marginBottom:small?0:4 }}><div style={{ fontSize:8,color:"#94a3b8",letterSpacing:2 }}>{label}</div><div style={{ fontSize:small?11:13,fontFamily:"'Archivo Black',sans-serif",color:color||"#1e293b" }}>{value}</div></div>; }
const btnPrimary   = { background:"#d97706",color:"#fff",border:"none",borderRadius:6,padding:"8px 16px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:1 };
const btnSecondary = { background:"#f1f5f9",color:"#475569",border:"1px solid #cbd5e1",borderRadius:6,padding:"8px 14px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11 };
const inp = { width:"100%",padding:"7px 9px",background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:5,color:"#1e293b",fontFamily:"'DM Mono',monospace",fontSize:11,boxSizing:"border-box" };
