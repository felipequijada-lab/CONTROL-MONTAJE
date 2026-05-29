import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://uxgkiuhcqcvcwkvtjqvo.supabase.co";
const SUPABASE_KEY = "sb_publishable_CSpI4hVvQmUWai7oQcPmuQ_mZe3EYqA";
const ADMIN_PIN = "18670610";

const fmt2 = n => isNaN(n) ? "0.00" : (Math.round(n * 100) / 100).toFixed(2);
const fmtPct = n => (Math.round(n * 10) / 10).toFixed(1) + "%";
const TODAY = new Date().toISOString().slice(0, 10);

const TIPOS_MD = ["MD", "MDT"];

function getArea(el) {
  return TIPOS_MD.includes(el.tipo) ? el.areaBruta : el.areaNeta;
}

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

  const weekElements = weekData.positions.map(pos => {
    const el = elements.find(e => e.pos === pos);
    const d  = dailyStats.find(d => d.positions.includes(pos));
    return el ? { ...el, fecha: d?.date || "", area: getArea(el) } : null;
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
.kpi-sub{color:#94a3b8;font-size:8px;margin-top:2px;}
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
  <div><div class="title">◈ CONTROL DE MONTAJE</div><div class="subtitle">BAUMAX SPA · ${obraName} · INFORME SEMANA ${weekLabel}</div></div>
  <div style="text-align:right"><div style="color:#94a3b8;font-size:9px">FECHA</div><div style="font-size:12px;font-weight:bold">${fecha}</div></div>
</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">m² MD/MDT</div><div class="kpi-value green">${mdTotal}</div><div class="kpi-sub">bruto</div></div>
  <div class="kpi"><div class="kpi-label">m² P</div><div class="kpi-value blue">${pTotal}</div><div class="kpi-sub">neto</div></div>
  <div class="kpi"><div class="kpi-label">m² TOTAL</div><div class="kpi-value amber">${total}</div><div class="kpi-sub">semana</div></div>
  <div class="kpi"><div class="kpi-label">DÍAS EFECTIVOS</div><div class="kpi-value amber">${weekData.diasEfectivos}</div><div class="kpi-sub">con montaje</div></div>
  <div class="kpi"><div class="kpi-label">REND. EFECTIVO</div><div class="kpi-value ${weekData.rendEfectivo >= 600 ? 'green' : 'red'}">${fmt2(weekData.rendEfectivo)}</div><div class="kpi-sub">m²/día efec.</div></div>
</div>
<div class="section"><div class="section-title">RENDIMIENTOS</div>
<table><tr><th>CARGO</th><th>PERSONAS</th><th>m²/PERSONA/DÍA</th><th>m²/PERSONA/SEMANA</th></tr>
<tr><td class="amber">Líder</td><td>${weekData.personal.lideres}</td><td>${fmt2(weekData.rendLider)}</td><td>${fmt2(weekData.rendLider * weekData.diasEfectivos)}</td></tr>
<tr><td class="amber">Montajista</td><td>${weekData.personal.montajistas}</td><td>${fmt2(weekData.rendMontajista)}</td><td>${fmt2(weekData.rendMontajista * weekData.diasEfectivos)}</td></tr>
<tr><td class="amber">Ayudante</td><td>${weekData.personal.ayudantes}</td><td>${fmt2(weekData.rendAyudante)}</td><td>${fmt2(weekData.rendAyudante * weekData.diasEfectivos)}</td></tr>
<tr><td>Equipo Completo</td><td>${weekData.equipoCompleto}</td><td>${fmt2(weekData.rendEquipo)}</td><td>${fmt2(weekData.rendEquipo * weekData.diasEfectivos)}</td></tr>
</table></div>
<div class="section"><div class="section-title">ELEMENTOS MONTADOS</div>
<table><tr><th>TORRE</th><th>POSICIÓN</th><th>PLANO</th><th>TIPO</th><th>ÁREA m²</th><th>FECHA</th></tr>
${weekElements.map(el => `<tr><td>${el.torre||""}</td><td>${el.pos}</td><td>${el.plano}</td><td class="${TIPOS_MD.includes(el.tipo)?"green":"blue"}">${el.tipo}</td><td>${fmt2(el.area)}</td><td>${el.fecha}</td></tr>`).join('')}
<tr style="background:#f1f5f9"><td colspan="4"><b>TOTAL</b></td><td class="amber"><b>${total}</b></td><td style="font-size:9px"><span class="green">MD:${mdTotal}</span> <span class="blue">P:${pTotal}</span></td></tr>
</table></div>
<div class="section"><div class="section-title">INCIDENCIAS</div>
<table><tr><th>FECHA</th><th>OBSERVACIÓN</th></tr>
${incidencias.map(d => `<tr><td class="amber">${d.date}</td><td>${d.note || "Sin incidencias"}</td></tr>`).join('')}
${incidencias.length === 0 ? '<tr><td colspan="2" style="text-align:center;color:#94a3b8">Sin incidencias</td></tr>' : ''}
</table></div>
<div class="footer">Informe generado automáticamente · Control de Montaje · Baumax SPA · Semana ${weekLabel}</div>
</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 500);
}

// ── Excel export ──────────────────────────────────────────────────────────────
function generateExcel(weekData, elements, dailyStats, weekLabel) {
  const wb = XLSX.utils.book_new();
  const resumen = [
    [`INFORME SEMANAL - SEMANA ${weekLabel}`], [],
    ["RESUMEN"],
    ["m² MD/MDT (bruto)", parseFloat(fmt2(weekData.areaMD))],
    ["m² P (neto)", parseFloat(fmt2(weekData.areaP))],
    ["m² Total", parseFloat(fmt2(weekData.areaTotal))],
    ["Días efectivos", weekData.diasEfectivos],
    ["Rendimiento efectivo (m²/día)", parseFloat(fmt2(weekData.rendEfectivo))], [],
    ["RENDIMIENTOS"],
    ["Cargo", "Personas", "m²/persona/día", "m²/persona/semana"],
    ["Líder", weekData.personal.lideres, parseFloat(fmt2(weekData.rendLider)), parseFloat(fmt2(weekData.rendLider * weekData.diasEfectivos))],
    ["Montajista", weekData.personal.montajistas, parseFloat(fmt2(weekData.rendMontajista)), parseFloat(fmt2(weekData.rendMontajista * weekData.diasEfectivos))],
    ["Ayudante", weekData.personal.ayudantes, parseFloat(fmt2(weekData.rendAyudante)), parseFloat(fmt2(weekData.rendAyudante * weekData.diasEfectivos))],
    ["Equipo Completo", weekData.equipoCompleto, parseFloat(fmt2(weekData.rendEquipo)), parseFloat(fmt2(weekData.rendEquipo * weekData.diasEfectivos))],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");
  const elemRows = [["Torre", "Posición", "Plano", "Tipo", "Área m²", "Fecha"]];
  weekData.positions.forEach(pos => {
    const el = elements.find(e => e.pos === pos);
    const d  = dailyStats.find(d => d.positions.includes(pos));
    if (el) elemRows.push([el.torre||"", el.pos, el.plano, el.tipo, getArea(el), d?.date || ""]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(elemRows), "Elementos");
  const incRows = [["Fecha", "Observación"]];
  dailyStats.filter(d => getWeekNumber(d.date) === weekLabel).forEach(d => incRows.push([d.date, d.note || "Sin incidencias"]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incRows), "Incidencias");
  XLSX.writeFile(wb, `informe_semana_${weekLabel}.xlsx`);
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("select"); // select | obra | admin | adminLogin
  const [obras, setObras] = useState([]);
  const [selectedObra, setSelectedObra] = useState(null);
  const [adminPin, setAdminPin] = useState("");
  const [adminError, setAdminError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { loadObras(); }, []);

  async function loadObras() {
    setLoading(true);
    try {
      const data = await sbFetch("obras?select=*&order=created_at.desc");
      setObras(data);
    } catch (e) { setError("Error cargando obras: " + e.message); }
    setLoading(false);
  }

  function handleAdminLogin() {
    if (adminPin === ADMIN_PIN) { setScreen("admin"); setAdminError(false); }
    else { setAdminError(true); }
  }

  if (loading) return <LoadingScreen/>;

  return (
    <div style={{ minHeight:"100vh", background:"#e2e8f0", fontFamily:"'DM Mono','Courier New',monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Archivo+Black&display=swap" rel="stylesheet"/>
      {error && <ErrorBar msg={error} onClose={()=>setError(null)}/>}

      {screen === "select" && (
        <SelectScreen obras={obras} onSelectObra={o=>{ setSelectedObra(o); setScreen("obra"); }} onAdminClick={()=>setScreen("adminLogin")} onRefresh={loadObras}/>
      )}
      {screen === "adminLogin" && (
        <AdminLogin pin={adminPin} setPin={setAdminPin} error={adminError} onLogin={handleAdminLogin} onBack={()=>{ setScreen("select"); setAdminPin(""); setAdminError(false); }}/>
      )}
      {screen === "admin" && (
        <AdminPanel obras={obras} onBack={()=>setScreen("select")} onObraCreated={loadObras} setError={setError}/>
      )}
      {screen === "obra" && selectedObra && (
        <ObraView obra={selectedObra} onBack={()=>setScreen("select")} setError={setError}/>
      )}
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
        {obras.length === 0 ? (
          <div style={{ color:"#94a3b8", fontSize:12, textAlign:"center", padding:20 }}>No hay obras activas. Ingresá como admin para crear una.</div>
        ) : (
          obras.map(o => (
            <div key={o.id} onClick={()=>onSelectObra(o)} style={{
              padding:"14px 16px", background:"#f1f5f9", border:"1px solid #cbd5e1", borderRadius:8,
              cursor:"pointer", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center",
              transition:"all 0.15s",
            }}
            onMouseEnter={e=>e.currentTarget.style.background="#e2e8f0"}
            onMouseLeave={e=>e.currentTarget.style.background="#f1f5f9"}>
              <div>
                <div style={{ color:"#1e293b", fontWeight:"bold", fontSize:13 }}>{o.nombre}</div>
                <div style={{ color:"#94a3b8", fontSize:10, marginTop:2 }}>{o.ubicacion} · Inicio: {o.fecha_inicio}</div>
              </div>
              <div style={{ color:"#d97706", fontSize:18 }}>→</div>
            </div>
          ))
        )}
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
        <input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&onLogin()}
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
  const [newObra, setNewObra] = useState({ nombre:"", ubicacion:"", fecha_inicio: TODAY });
  const [creando, setCreando] = useState(false);
  const [obraParaElementos, setObraParaElementos] = useState(obras[0]?.id || "");
  const [uploadStatus, setUploadStatus] = useState("");
  const [programa, setPrograma] = useState({ obra_id: obras[0]?.id || "", semana:"", meta:"" });
  const [programaRows, setProgramaRows] = useState([]);
  const fileRef = useRef();

  async function crearObra() {
    if (!newObra.nombre) return;
    setCreando(true);
    try {
      await sbFetch("obras", { method:"POST", body: JSON.stringify({ nombre: newObra.nombre, ubicacion: newObra.ubicacion, fecha_inicio: newObra.fecha_inicio, estado:"activa" }) });
      setNewObra({ nombre:"", ubicacion:"", fecha_inicio: TODAY });
      onObraCreated();
    } catch(e) { setError("Error creando obra: " + e.message); }
    setCreando(false);
  }

  async function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file || !obraParaElementos) return;
    setUploadStatus("Procesando...");
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const elementos = [];
      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });
        // Detect tipo from sheet name
        let tipo = "MD";
        const sn = sheetName.toUpperCase();
        if (sn.startsWith("P")) tipo = "P";
        else if (sn.startsWith("MDT")) tipo = "MDT";
        else if (sn.startsWith("MD")) tipo = "MD";

        rows.slice(1).forEach(row => {
          if (!row[1]) return; // skip empty
          elementos.push({
            obra_id: obraParaElementos,
            torre: String(row[0] || ""),
            pos: String(row[1] || ""),
            plano: sheetName,
            tipo,
            peso: parseFloat(row[7]) || 0,
            altura: parseFloat(row[4]) || 0,
            longitud: parseFloat(row[5]) || 0,
            espesor: parseFloat(row[6]) || 0,
            area_bruta: parseFloat(row[8]) || 0,
            area_neta: parseFloat(row[9]) || 0,
            volumen: parseFloat(row[10]) || 0,
            peso_acero: parseFloat(row[11]) || 0,
            cal_hormigon: String(row[3] || ""),
          });
        });
      });

      // Upload in batches of 50
      for (let i = 0; i < elementos.length; i += 50) {
        const batch = elementos.slice(i, i + 50);
        await sbFetch("elementos", { method:"POST", body: JSON.stringify(batch), headers:{ "Prefer":"return=minimal" } });
      }
      setUploadStatus(`✓ ${elementos.length} elementos cargados`);
    } catch(e) { setUploadStatus("Error: " + e.message); }
  }

  async function agregarPrograma() {
    if (!programa.obra_id || !programa.semana || !programa.meta) return;
    try {
      await sbFetch("programa", { method:"POST", body: JSON.stringify({ obra_id: programa.obra_id, semana: programa.semana, meta: parseFloat(programa.meta) }) });
      setProgramaRows(prev => [...prev, { ...programa }]);
      setPrograma(p => ({ ...p, semana:"", meta:"" }));
    } catch(e) { setError("Error guardando programa: " + e.message); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#e2e8f0" }}>
      {/* Header */}
      <div style={{ background:"#f8fafc", borderBottom:"1px solid #cbd5e1", padding:"14px 28px", display:"flex", alignItems:"center", gap:16 }}>
        <button onClick={onBack} style={btnSecondary}>← Volver</button>
        <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:18, color:"#d97706" }}>⚙ PANEL ADMINISTRADOR</div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", background:"#f8fafc", borderBottom:"1px solid #cbd5e1", padding:"0 28px" }}>
        {[["obras","Obras"],["elementos","Cargar Elementos"],["programa","Programa Semanal"]].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{
            background:"none", border:"none", cursor:"pointer", padding:"12px 18px",
            color: tab===k ? "#d97706" : "#64748b",
            borderBottom: tab===k ? "2px solid #d97706" : "2px solid transparent",
            fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:1,
          }}>{l}</button>
        ))}
      </div>

      <div style={{ padding:"24px 28px", maxWidth:800, margin:"0 auto" }}>

        {/* Obras */}
        {tab === "obras" && (
          <div>
            <Panel title="CREAR NUEVA OBRA">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><Label>Nombre obra</Label><input value={newObra.nombre} onChange={e=>setNewObra(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Torre A - Santiago" style={inp}/></div>
                <div><Label>Ubicación</Label><input value={newObra.ubicacion} onChange={e=>setNewObra(p=>({...p,ubicacion:e.target.value}))} placeholder="Ej: Las Condes" style={inp}/></div>
                <div><Label>Fecha inicio</Label><input type="date" value={newObra.fecha_inicio} onChange={e=>setNewObra(p=>({...p,fecha_inicio:e.target.value}))} style={inp}/></div>
              </div>
              <button onClick={crearObra} disabled={creando||!newObra.nombre} style={{ ...btnPrimary, marginTop:12 }}>
                {creando ? "Creando..." : "+ Crear Obra"}
              </button>
            </Panel>

            <Panel title="OBRAS ACTIVAS">
              {obras.length === 0 && <div style={{ color:"#94a3b8", fontSize:12 }}>No hay obras creadas aún.</div>}
              {obras.map(o => (
                <div key={o.id} style={{ padding:"12px 0", borderBottom:"1px solid #cbd5e1", display:"flex", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ color:"#1e293b", fontWeight:"bold" }}>{o.nombre}</div>
                    <div style={{ color:"#94a3b8", fontSize:10 }}>{o.ubicacion} · {o.fecha_inicio}</div>
                  </div>
                  <div style={{ fontSize:10, color:"#16a34a", border:"1px solid #16a34a33", padding:"2px 8px", borderRadius:10, alignSelf:"center" }}>{o.estado}</div>
                </div>
              ))}
            </Panel>
          </div>
        )}

        {/* Elementos */}
        {tab === "elementos" && (
          <Panel title="CARGAR ELEMENTOS DESDE EXCEL">
            <Label>Seleccionar Obra</Label>
            <select value={obraParaElementos} onChange={e=>setObraParaElementos(e.target.value)} style={inp}>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <Label>Archivo Excel</Label>
            <div style={{ background:"#f1f5f9", border:"2px dashed #cbd5e1", borderRadius:8, padding:24, textAlign:"center", marginTop:4 }}>
              <div style={{ color:"#64748b", fontSize:12, marginBottom:12 }}>
                El Excel debe tener la columna Torre como primera columna,<br/>seguida del formato estándar de elementos.
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} style={{ display:"none" }}/>
              <button onClick={()=>fileRef.current.click()} style={btnPrimary}>↑ Seleccionar Excel</button>
              {uploadStatus && <div style={{ marginTop:12, color: uploadStatus.startsWith("✓") ? "#16a34a" : "#dc2626", fontSize:12 }}>{uploadStatus}</div>}
            </div>
          </Panel>
        )}

        {/* Programa */}
        {tab === "programa" && (
          <Panel title="PROGRAMA SEMANAL">
            <Label>Obra</Label>
            <select value={programa.obra_id} onChange={e=>setPrograma(p=>({...p,obra_id:e.target.value}))} style={inp}>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:8, marginTop:12, alignItems:"flex-end" }}>
              <div>
                <Label>Semana (ej: 22.2026)</Label>
                <input value={programa.semana} onChange={e=>setPrograma(p=>({...p,semana:e.target.value}))} placeholder="22.2026" style={inp}/>
              </div>
              <div>
                <Label>m² programados</Label>
                <input type="number" value={programa.meta} onChange={e=>setPrograma(p=>({...p,meta:e.target.value}))} placeholder="600" style={inp}/>
              </div>
              <button onClick={agregarPrograma} style={{ ...btnPrimary, marginBottom:1 }}>+</button>
            </div>
            {programaRows.length > 0 && (
              <div style={{ marginTop:16 }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead><tr style={{ color:"#64748b", fontSize:9, letterSpacing:2 }}><Th>SEMANA</Th><Th>m² PROG.</Th></tr></thead>
                  <tbody>
                    {programaRows.map((r,i) => (
                      <tr key={i} style={{ borderBottom:"1px solid #f1f5f9" }}>
                        <Td accent="#d97706">{r.semana}</Td>
                        <Td>{r.meta}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
  const [selectedPos, setSelectedPos] = useState([]);
  const [note, setNote] = useState("");
  const [activeTab, setActiveTab] = useState("registro");
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("TODOS");
  const [filterTorre, setFilterTorre] = useState("TODAS");
  const [sortCol, setSortCol] = useState("pos");
  const [sortDir, setSortDir] = useState("asc");
  const [selectedWeek, setSelectedWeek] = useState(getWeekNumber(TODAY));

  useEffect(() => { loadData(); }, [obra.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [elemData, regData, progData] = await Promise.all([
        sbFetch(`elementos?obra_id=eq.${obra.id}&select=*`),
        sbFetch(`registros?obra_id=eq.${obra.id}&select=*`),
        sbFetch(`programa?obra_id=eq.${obra.id}&select=*&order=semana.asc`),
      ]);

      setElements(elemData.map(e => ({
        pos: e.pos, plano: e.plano, tipo: e.tipo, torre: e.torre||"",
        peso: e.peso, altura: e.altura, longitud: e.longitud, espesor: e.espesor,
        areaBruta: e.area_bruta, areaNeta: e.area_neta, volumen: e.volumen, pesoAcero: e.peso_acero,
        calHormigon: e.cal_hormigon,
      })));

      const expanded = [];
      regData.forEach(row => {
        const positions = row.elementos_montados ? row.elementos_montados.split(",") : [];
        positions.forEach(pos => {
          if (pos.trim()) expanded.push({
            date: row.fecha, pos: pos.trim(),
            personal: { coordinadores: row.coordinadores||0, calidad: row.calidad||0, lideres: row.lideres||0, montajistas: row.montajistas||0, ayudantes: row.ayudantes||0 },
            note: row.incidencias || ""
          });
        });
      });
      setLogs(expanded);
      setPrograma(progData);
    } catch(e) { setError("Error cargando datos: " + e.message); }
    setLoading(false);
  }

  const mountedPos = useMemo(() => new Set(logs.map(l => l.pos)), [logs]);
  const torres = useMemo(() => ["TODAS", ...new Set(elements.map(e=>e.torre).filter(Boolean).sort())], [elements]);

  const stats = useMemo(() => {
    const md = elements.filter(e => TIPOS_MD.includes(e.tipo));
    const p  = elements.filter(e => e.tipo === "P");
    const mdM = md.filter(e => mountedPos.has(e.pos));
    const pM  = p.filter(e => mountedPos.has(e.pos));
    return {
      md:  { total: md.length, mounted: mdM.length, areaTotal: md.reduce((s,e)=>s+e.areaBruta,0), areaMounted: mdM.reduce((s,e)=>s+e.areaBruta,0) },
      p:   { total: p.length,  mounted: pM.length,  areaTotal: p.reduce((s,e)=>s+e.areaNeta,0),   areaMounted: pM.reduce((s,e)=>s+e.areaNeta,0) },
      all: { total: elements.length, mounted: mountedPos.size,
             areaTotal: md.reduce((s,e)=>s+e.areaBruta,0)+p.reduce((s,e)=>s+e.areaNeta,0),
             areaMounted: mdM.reduce((s,e)=>s+e.areaBruta,0)+pM.reduce((s,e)=>s+e.areaNeta,0) },
    };
  }, [elements, mountedPos]);

  const pctMD  = stats.md.areaTotal  > 0 ? (stats.md.areaMounted  / stats.md.areaTotal)  * 100 : 0;
  const pctP   = stats.p.areaTotal   > 0 ? (stats.p.areaMounted   / stats.p.areaTotal)   * 100 : 0;
  const pctAll = stats.all.areaTotal > 0 ? (stats.all.areaMounted / stats.all.areaTotal) * 100 : 0;

  const dailyStats = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      if (!map[l.date]) map[l.date] = { date: l.date, positions: [], personal: l.personal, note: l.note };
      map[l.date].positions.push(l.pos);
    });
    return Object.values(map).map(d => {
      const elems = elements.filter(e => d.positions.includes(e.pos));
      const mdEl = elems.filter(e=>TIPOS_MD.includes(e.tipo));
      const pEl  = elems.filter(e=>e.tipo==="P");
      const areaMD = mdEl.reduce((s,e)=>s+e.areaBruta,0);
      const areaP  = pEl.reduce((s,e)=>s+e.areaNeta,0);
      const areaTotal = areaMD + areaP;
      const p = d.personal;
      const equipoCompleto = (p.coordinadores||0)+(p.calidad||0)+(p.lideres||0)+(p.montajistas||0)+(p.ayudantes||0);
      return {
        ...d, countMD: mdEl.length, areaMD, countP: pEl.length, areaP, areaTotal,
        rendLider:      p.lideres>0      ? areaTotal/p.lideres      : 0,
        rendMontajista: p.montajistas>0  ? areaTotal/p.montajistas  : 0,
        rendAyudante:   p.ayudantes>0    ? areaTotal/p.ayudantes    : 0,
        rendEquipo:     equipoCompleto>0 ? areaTotal/equipoCompleto : 0,
        equipoCompleto,
      };
    }).sort((a,b) => b.date.localeCompare(a.date));
  }, [logs, elements]);

  const weeklyStats = useMemo(() => {
    const map = {};
    dailyStats.forEach(d => {
      const week = getWeekNumber(d.date);
      if (!map[week]) map[week] = { week, days: [], positions: [] };
      map[week].days.push(d);
      map[week].positions.push(...d.positions);
    });
    return Object.values(map).map(w => {
      const diasEfectivos = w.days.filter(d=>d.areaTotal>0).length;
      const areaTotal = w.days.reduce((s,d)=>s+d.areaTotal,0);
      const areaMD = w.days.reduce((s,d)=>s+d.areaMD,0);
      const areaP  = w.days.reduce((s,d)=>s+d.areaP,0);
      const avgP = {
        coordinadores: Math.round(w.days.reduce((s,d)=>s+d.personal.coordinadores,0)/w.days.length),
        calidad:       Math.round(w.days.reduce((s,d)=>s+d.personal.calidad,0)/w.days.length),
        lideres:       Math.round(w.days.reduce((s,d)=>s+d.personal.lideres,0)/w.days.length),
        montajistas:   Math.round(w.days.reduce((s,d)=>s+d.personal.montajistas,0)/w.days.length),
        ayudantes:     Math.round(w.days.reduce((s,d)=>s+d.personal.ayudantes,0)/w.days.length),
      };
      const eq = Object.values(avgP).reduce((a,b)=>a+b,0);
      return {
        week: w.week, diasEfectivos, areaTotal, areaMD, areaP, positions: w.positions, personal: avgP, equipoCompleto: eq,
        rendLider:      avgP.lideres>0 ? areaTotal/avgP.lideres      : 0,
        rendMontajista: avgP.montajistas>0 ? areaTotal/avgP.montajistas : 0,
        rendAyudante:   avgP.ayudantes>0 ? areaTotal/avgP.ayudantes   : 0,
        rendEquipo:     eq>0 ? areaTotal/eq : 0,
        rendEfectivo:   diasEfectivos>0 ? areaTotal/diasEfectivos : 0,
      };
    }).sort((a,b) => b.week.localeCompare(a.week));
  }, [dailyStats]);

  const programaAcum = useMemo(() => {
    let acum = 0;
    return programa.map(p => {
      acum += p.meta;
      const realAcum = weeklyStats.filter(w=>w.week<=p.semana).reduce((s,w)=>s+w.areaTotal,0);
      const weekReal = weeklyStats.find(w=>w.week===p.semana);
      return { semana: p.semana, acum, real: weekReal ? realAcum : null };
    });
  }, [programa, weeklyStats]);

  // Filtered + sorted elements
  const filteredElements = useMemo(() => {
    let arr = elements.filter(e => {
      const ms = e.pos.toLowerCase().includes(search.toLowerCase()) || e.plano.toLowerCase().includes(search.toLowerCase()) || e.torre.toLowerCase().includes(search.toLowerCase());
      const mt = filterTipo==="TODOS" || e.tipo===filterTipo;
      const mtr = filterTorre==="TODAS" || e.torre===filterTorre;
      return ms && mt && mtr;
    });
    arr = [...arr].sort((a,b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir==="asc" ? -1 : 1;
      if (av > bv) return sortDir==="asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [elements, search, filterTipo, filterTorre, sortCol, sortDir]);

  const selSummary = useMemo(() => {
    const sel = elements.filter(e => selectedPos.includes(e.pos));
    const md = sel.filter(e=>TIPOS_MD.includes(e.tipo)); const p = sel.filter(e=>e.tipo==="P");
    return { md: md.length, areaMD: md.reduce((s,e)=>s+e.areaBruta,0), p: p.length, areaP: p.reduce((s,e)=>s+e.areaNeta,0) };
  }, [selectedPos, elements]);

  function handleSort(col) {
    if (sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  async function registrar() {
    const toAdd = selectedPos.filter(p => !mountedPos.has(p));
    if (toAdd.length === 0) return;
    setSaving(true);
    try {
      const mdEls = elements.filter(e => toAdd.includes(e.pos) && TIPOS_MD.includes(e.tipo));
      const pEls  = elements.filter(e => toAdd.includes(e.pos) && e.tipo==="P");
      await sbFetch("registros", {
        method:"POST",
        body: JSON.stringify({
          fecha: selectedDate, obra_id: obra.id,
          coordinadores: personal.coordinadores, calidad: personal.calidad,
          lideres: personal.lideres, montajistas: personal.montajistas, ayudantes: personal.ayudantes,
          m2_md: mdEls.reduce((s,e)=>s+e.areaBruta,0), m2_p: pEls.reduce((s,e)=>s+e.areaNeta,0),
          elementos_montados: toAdd.join(","), incidencias: note, registrado_por: "encargado",
        }),
      });
      const newLogs = toAdd.map(pos => ({ date: selectedDate, pos, personal: { ...personal }, note }));
      setLogs(prev => [...prev, ...newLogs]);
      setSelectedPos([]); setNote("");
    } catch(e) { setError("Error guardando: " + e.message); }
    setSaving(false);
  }

  function togglePos(pos) {
    setSelectedPos(prev => prev.includes(pos) ? prev.filter(p=>p!==pos) : [...prev, pos]);
  }

  const currentWeekData = weeklyStats.find(w=>w.week===selectedWeek);

  if (loading) return <LoadingScreen/>;

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
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <TypeKPI label="MD/MDT (m² bruto)" mounted={stats.md.areaMounted} total={stats.md.areaTotal} count={stats.md.mounted} countTotal={stats.md.total} pct={pctMD} color="#16a34a"/>
          <div style={{ width:1, background:"#cbd5e1", height:40 }}/>
          <TypeKPI label="PRELOSAS (m² neto)" mounted={stats.p.areaMounted} total={stats.p.areaTotal} count={stats.p.mounted} countTotal={stats.p.total} pct={pctP} color="#2563eb"/>
          <div style={{ width:1, background:"#cbd5e1", height:40 }}/>
          <TypeKPI label="AVANCE TOTAL" mounted={stats.all.areaMounted} total={stats.all.areaTotal} count={stats.all.mounted} countTotal={stats.all.total} pct={pctAll} color="#d97706" large/>
        </div>
      </div>

      {/* Progress bars */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", height:5 }}>
        <div style={{ background:"#dcfce7" }}><div style={{ height:5, width:pctMD+"%", background:"linear-gradient(90deg,#15803d,#16a34a)", transition:"width 0.6s" }}/></div>
        <div style={{ background:"#dbeafe" }}><div style={{ height:5, width:pctP+"%", background:"linear-gradient(90deg,#1d4ed8,#2563eb)", transition:"width 0.6s" }}/></div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", background:"#f8fafc", borderBottom:"1px solid #cbd5e1", padding:"0 28px" }}>
        {[["registro","▷ REGISTRO"],["elementos","◈ ELEMENTOS"],["historial","◫ HISTORIAL"],["semanal","◷ SEMANAL"],["curvaS","↗ CURVA S"]].map(([k,l]) => (
          <button key={k} onClick={()=>setActiveTab(k)} style={{
            background:"none", border:"none", cursor:"pointer", padding:"12px 16px",
            color: activeTab===k ? "#d97706" : "#64748b",
            borderBottom: activeTab===k ? "2px solid #d97706" : "2px solid transparent",
            fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:1,
          }}>{l}</button>
        ))}
      </div>

      <div style={{ padding:"20px 28px", maxWidth:1400, margin:"0 auto" }}>

        {/* ── REGISTRO ── */}
        {activeTab === "registro" && (
          <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:20 }}>
            <div>
              <Panel title="PARÁMETROS DEL DÍA">
                <Label>Fecha</Label>
                <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={inp}/>
                <div style={{ fontSize:9, color:"#94a3b8", letterSpacing:2, marginTop:4 }}>SEMANA {getWeekNumber(selectedDate)}</div>
                <Label>PERSONAL EN OBRA</Label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:4 }}>
                  {PERSONAL_CARGOS.map(cargo => (
                    <div key={cargo.key}>
                      <div style={{ fontSize:9, color: cargo.productivo?"#d97706":"#94a3b8", letterSpacing:1, marginBottom:2 }}>
                        {cargo.label.toUpperCase()} {cargo.productivo?"★":""}
                      </div>
                      <input type="number" min={0} max={cargo.max} value={personal[cargo.key]}
                        onChange={e=>setPersonal(prev=>({...prev,[cargo.key]:Number(e.target.value)}))}
                        style={{ ...inp, margin:0 }}/>
                    </div>
                  ))}
                </div>
                <Label>Incidencias / Nota</Label>
                <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
                  placeholder="Observaciones, incidentes…"
                  style={{ ...inp, resize:"vertical", fontFamily:"'DM Mono',monospace", fontSize:11 }}/>
                {selectedPos.length > 0 && (
                  <div style={{ background:"#f1f5f9", borderRadius:6, padding:10, marginTop:8, fontSize:11, border:"1px solid #cbd5e1" }}>
                    <div style={{ color:"#94a3b8", fontSize:9, letterSpacing:2, marginBottom:6 }}>SELECCIÓN</div>
                    {selSummary.md>0 && <div style={{ color:"#16a34a" }}>MD/MDT: {selSummary.md} · {fmt2(selSummary.areaMD)} m²</div>}
                    {selSummary.p>0  && <div style={{ color:"#2563eb", marginTop:3 }}>P: {selSummary.p} · {fmt2(selSummary.areaP)} m²</div>}
                    <div style={{ color:"#d97706", marginTop:6, borderTop:"1px solid #cbd5e1", paddingTop:6 }}>Total: {fmt2(selSummary.areaMD+selSummary.areaP)} m²</div>
                  </div>
                )}
                <button onClick={registrar} disabled={selectedPos.length===0||saving} style={{
                  width:"100%", padding:"11px", marginTop:10,
                  background: selectedPos.length>0&&!saving?"#d97706":"#e2e8f0",
                  color: selectedPos.length>0&&!saving?"#ffffff":"#94a3b8",
                  border:"none", borderRadius:6, cursor:selectedPos.length>0&&!saving?"pointer":"default",
                  fontFamily:"'Archivo Black',sans-serif", fontSize:13, letterSpacing:1, transition:"all 0.2s"
                }}>{saving?"GUARDANDO…":`▷ REGISTRAR ${selectedPos.length>0?"("+selectedPos.length+")":""}`}</button>
              </Panel>
              {dailyStats.filter(d=>d.date===selectedDate).map(d=>(
                <Panel key={d.date} title="RESUMEN HOY">
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                    <MiniStat label="m² MD/MDT" value={fmt2(d.areaMD)} color="#16a34a" small/>
                    <MiniStat label="m² P" value={fmt2(d.areaP)} color="#2563eb" small/>
                    <MiniStat label="m² TOTAL" value={fmt2(d.areaTotal)} color="#d97706" small/>
                    <MiniStat label="Equipo" value={d.equipoCompleto+" p."} small/>
                  </div>
                  <div style={{ borderTop:"1px solid #cbd5e1", paddingTop:8 }}>
                    <div style={{ fontSize:9, color:"#94a3b8", letterSpacing:2, marginBottom:6 }}>RENDIMIENTOS m²/persona</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                      <MiniStat label="Líder" value={fmt2(d.rendLider)} color="#d97706" small/>
                      <MiniStat label="Montajista" value={fmt2(d.rendMontajista)} color="#d97706" small/>
                      <MiniStat label="Ayudante" value={fmt2(d.rendAyudante)} color="#d97706" small/>
                      <MiniStat label="Equipo" value={fmt2(d.rendEquipo)} color="#d97706" small/>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>

            <Panel title="SELECCIONAR ELEMENTOS A MONTAR">
              <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
                <input placeholder="Buscar pos., plano, torre…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...inp, flex:1, margin:0, minWidth:160 }}/>
                {["TODOS","MD","MDT","P"].map(t => (
                  <button key={t} onClick={()=>setFilterTipo(t)} style={{
                    padding:"6px 12px", borderRadius:5, border:"1px solid",
                    borderColor: filterTipo===t?"#d97706":"#cbd5e1",
                    background: filterTipo===t?"#fef3c7":"#f8fafc",
                    color: filterTipo===t?"#d97706":"#64748b",
                    fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer"
                  }}>{t}</button>
                ))}
                <select value={filterTorre} onChange={e=>setFilterTorre(e.target.value)} style={{ ...inp, margin:0, width:"auto" }}>
                  {torres.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ maxHeight:560, overflowY:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ background:"#f1f5f9" }}>
                      <Th>SEL</Th>
                      {[["torre","TORRE"],["tipo","TIPO"],["pos","POS."],["plano","PLANO"],["peso","PESO Tn"],["altura","ALT m"],["longitud","LONG m"],["areaBruta","Á.BRUTA"],["areaNeta","Á.NETA"],["estado","ESTADO"]].map(([col,label])=>(
                        <th key={col} onClick={()=>handleSort(col)} style={{ padding:"7px 8px", textAlign:"left", color:"#64748b", fontSize:9, letterSpacing:1, cursor:"pointer", userSelect:"none", whiteSpace:"nowrap", borderBottom:"1px solid #cbd5e1" }}>
                          {label} {sortCol===col?(sortDir==="asc"?"↑":"↓"):""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredElements.map(el => {
                      const isMounted = mountedPos.has(el.pos);
                      const isSelected = selectedPos.includes(el.pos);
                      const tc = TIPOS_MD.includes(el.tipo)?"#16a34a":"#2563eb";
                      return (
                        <tr key={el.pos} onClick={()=>!isMounted&&togglePos(el.pos)} style={{
                          background: isSelected?"#fef9c3":isMounted?"#f8fafc":"#ffffff",
                          borderBottom:"1px solid #f1f5f9", cursor:isMounted?"default":"pointer",
                          opacity:isMounted?0.5:1,
                        }}>
                          <Td><div style={{ width:14,height:14,borderRadius:3,border:`2px solid ${isSelected?"#d97706":"#cbd5e1"}`,background:isSelected?"#d97706":"transparent",display:"flex",alignItems:"center",justifyContent:"center" }}>{isSelected&&<span style={{ fontSize:9,color:"#fff",fontWeight:"bold" }}>✓</span>}</div></Td>
                          <Td>{el.torre}</Td>
                          <Td><span style={{ color:tc,fontSize:9,border:`1px solid ${tc}33`,padding:"1px 5px",borderRadius:8 }}>{el.tipo}</span></Td>
                          <Td accent="#1e293b">{el.pos}</Td>
                          <Td>{el.plano}</Td>
                          <Td>{el.peso}</Td>
                          <Td>{el.altura}</Td>
                          <Td>{el.longitud}</Td>
                          <Td accent={TIPOS_MD.includes(el.tipo)?"#16a34a":undefined}>{fmt2(el.areaBruta)}</Td>
                          <Td accent={el.tipo==="P"?"#2563eb":undefined}>{fmt2(el.areaNeta)}</Td>
                          <Td><span style={{ padding:"1px 7px",borderRadius:10,fontSize:9,background:isMounted?"#dcfce7":"#f1f5f9",color:isMounted?"#16a34a":"#94a3b8",border:`1px solid ${isMounted?"#16a34a33":"#cbd5e1"}` }}>{isMounted?"MONTADO":"PENDIENTE"}</span></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:"#f1f5f9", borderTop:"1px solid #cbd5e1" }}>
                      <td colSpan={8} style={{ padding:"8px 10px",color:"#64748b",textAlign:"right",fontSize:10 }}>TOTALES FILTRADOS</td>
                      <td style={{ padding:"8px 10px",color:"#16a34a",fontWeight:"bold",fontSize:11 }}>{fmt2(filteredElements.filter(e=>TIPOS_MD.includes(e.tipo)).reduce((s,e)=>s+e.areaBruta,0))} m²</td>
                      <td style={{ padding:"8px 10px",color:"#2563eb",fontWeight:"bold",fontSize:11 }}>{fmt2(filteredElements.filter(e=>e.tipo==="P").reduce((s,e)=>s+e.areaNeta,0))} m²</td>
                      <td/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* ── ELEMENTOS ── */}
        {activeTab === "elementos" && (
          <Panel title="LISTADO COMPLETO DE ELEMENTOS">
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              <input placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...inp, width:200, margin:0 }}/>
              {["TODOS","MD","MDT","P"].map(t=>(
                <button key={t} onClick={()=>setFilterTipo(t)} style={{ padding:"6px 12px",borderRadius:5,border:"1px solid",borderColor:filterTipo===t?"#d97706":"#cbd5e1",background:filterTipo===t?"#fef3c7":"#f8fafc",color:filterTipo===t?"#d97706":"#64748b",fontFamily:"'DM Mono',monospace",fontSize:11,cursor:"pointer" }}>{t}</button>
              ))}
              <select value={filterTorre} onChange={e=>setFilterTorre(e.target.value)} style={{ ...inp, margin:0, width:"auto" }}>
                {torres.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ background:"#f1f5f9" }}>
                    {[["torre","TORRE"],["tipo","TIPO"],["pos","POSICIÓN"],["plano","PLANO"],["peso","PESO Tn"],["altura","ALT m"],["longitud","LONG m"],["espesor","ESP cm"],["areaBruta","Á.BRUTA m²"],["areaNeta","Á.NETA m²"]].map(([col,label])=>(
                      <th key={col} onClick={()=>handleSort(col)} style={{ padding:"7px 8px",textAlign:"left",color:"#64748b",fontSize:9,letterSpacing:1,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",borderBottom:"1px solid #cbd5e1" }}>
                        {label} {sortCol===col?(sortDir==="asc"?"↑":"↓"):""}
                      </th>
                    ))}
                    <Th>ESTADO</Th><Th>FECHA</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredElements.map(el => {
                    const isMounted = mountedPos.has(el.pos);
                    const logEntry = logs.find(l=>l.pos===el.pos);
                    const tc = TIPOS_MD.includes(el.tipo)?"#16a34a":"#2563eb";
                    return (
                      <tr key={el.pos} style={{ borderBottom:"1px solid #f1f5f9", background:"#ffffff" }}>
                        <Td>{el.torre}</Td>
                        <Td><span style={{ color:tc,fontSize:9,border:`1px solid ${tc}33`,padding:"1px 5px",borderRadius:8 }}>{el.tipo}</span></Td>
                        <Td accent="#1e293b">{el.pos}</Td>
                        <Td>{el.plano}</Td><Td>{el.peso}</Td><Td>{el.altura}</Td><Td>{el.longitud}</Td><Td>{el.espesor}</Td>
                        <Td accent={TIPOS_MD.includes(el.tipo)?"#16a34a":undefined}>{fmt2(el.areaBruta)}</Td>
                        <Td accent={el.tipo==="P"?"#2563eb":undefined}>{fmt2(el.areaNeta)}</Td>
                        <Td><span style={{ padding:"1px 7px",borderRadius:10,fontSize:9,background:isMounted?"#dcfce7":"#f1f5f9",color:isMounted?"#16a34a":"#94a3b8",border:`1px solid ${isMounted?"#16a34a33":"#cbd5e1"}` }}>{isMounted?"MONTADO":"PENDIENTE"}</span></Td>
                        <Td>{logEntry?.date||""}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {/* ── HISTORIAL ── */}
        {activeTab === "historial" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            <Panel title="RENDIMIENTO POR DÍA">
              {dailyStats.length===0&&<div style={{ color:"#94a3b8",fontSize:12 }}>Sin registros.</div>}
              {dailyStats.map(d=>(
                <div key={d.date} style={{ padding:"12px 0",borderBottom:"1px solid #f1f5f9" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                    <span style={{ color:"#d97706",fontSize:12,fontWeight:"bold" }}>{d.date}</span>
                    <span style={{ color:"#94a3b8",fontSize:10 }}>Sem. {getWeekNumber(d.date)}</span>
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8 }}>
                    <MiniStat label="m² MD/MDT" value={fmt2(d.areaMD)} color="#16a34a" small/>
                    <MiniStat label="m² P" value={fmt2(d.areaP)} color="#2563eb" small/>
                    <MiniStat label="m² TOTAL" value={fmt2(d.areaTotal)} color="#d97706" small/>
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
                  {d.note && <div style={{ fontSize:10,color:"#64748b",marginTop:6,fontStyle:"italic" }}>"{d.note}"</div>}
                </div>
              ))}
            </Panel>
            <Panel title="AVANCE POR PLANO">
              {[...new Set(elements.map(e=>e.plano))].sort().map(pl=>{
                const elems = elements.filter(e=>e.plano===pl);
                const tipo = elems[0]?.tipo;
                const mounted = elems.filter(e=>mountedPos.has(e.pos));
                const areaTotal = elems.reduce((s,e)=>s+getArea(e),0);
                const areaMounted = mounted.reduce((s,e)=>s+getArea(e),0);
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
        {activeTab === "semanal" && (
          <div>
            <div style={{ display:"flex",gap:12,alignItems:"flex-end",marginBottom:16,flexWrap:"wrap" }}>
              <div>
                <Label>Semana a exportar</Label>
                <select value={selectedWeek} onChange={e=>setSelectedWeek(e.target.value)} style={{ ...inp,width:"auto",margin:0 }}>
                  {weeklyStats.map(w=><option key={w.week} value={w.week}>{w.week}</option>)}
                  {weeklyStats.length===0&&<option value={getWeekNumber(TODAY)}>{getWeekNumber(TODAY)}</option>}
                </select>
              </div>
              <button onClick={()=>{ if(!currentWeekData){alert("Sin datos");return;} generatePDF(currentWeekData,elements,dailyStats,selectedWeek,obra.nombre); }} style={{ ...btnPrimary, background:"#d97706" }}>↓ PDF SEMANAL</button>
              <button onClick={()=>{ if(!currentWeekData){alert("Sin datos");return;} generateExcel(currentWeekData,elements,dailyStats,selectedWeek); }} style={{ ...btnPrimary, background:"#16a34a" }}>↓ EXCEL SEMANAL</button>
            </div>
            <Panel title="RESUMEN SEMANAL">
              {weeklyStats.length===0&&<div style={{ color:"#94a3b8",fontSize:12 }}>Sin registros.</div>}
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                <thead>
                  <tr style={{ background:"#f1f5f9" }}>
                    <Th>SEMANA</Th><Th>m² MD/MDT</Th><Th>m² P</Th><Th>m² TOTAL</Th><Th>DÍAS EFEC.</Th><Th>REND. EFEC. m²/día</Th><Th>REND. EQUIPO m²/p</Th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyStats.map(w=>(
                    <tr key={w.week} onClick={()=>setSelectedWeek(w.week)} style={{ borderBottom:"1px solid #f1f5f9",background:w.week===selectedWeek?"#fef9c3":"#ffffff",cursor:"pointer" }}>
                      <Td accent="#d97706">{w.week}</Td>
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
        {activeTab === "curvaS" && (
          <Panel title="CURVA S — AVANCE PROGRAMADO vs REAL">
            {programaAcum.length === 0 ? (
              <div style={{ color:"#94a3b8",fontSize:12,textAlign:"center",padding:40 }}>
                No hay programa cargado para esta obra.<br/>
                <span style={{ fontSize:10 }}>El admin puede ingresar el programa desde el Panel Admin → Programa Semanal.</span>
              </div>
            ) : (
              <CurvaS data={programaAcum}/>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

// ── Curva S Component ─────────────────────────────────────────────────────────
function CurvaS({ data }) {
  const canvasRef = useRef();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const padL=60, padR=30, padT=30, padB=50;
    const cW = W-padL-padR, cH = H-padT-padB;
    const maxVal = Math.max(...data.map(d=>d.acum), 100);

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,W,H);

    // Grid
    for(let i=0;i<=4;i++){
      const y = padT+(cH/4)*i;
      ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+cW,y); ctx.stroke();
      ctx.fillStyle='#64748b'; ctx.font='11px monospace'; ctx.textAlign='right';
      ctx.fillText(Math.round(maxVal*(1-i/4)),padL-8,y+4);
    }

    // X labels
    data.forEach((d,i) => {
      const x = padL+(i/(data.length-1||1))*cW;
      ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,padT+cH); ctx.stroke();
      ctx.fillStyle='#64748b'; ctx.font='10px monospace'; ctx.textAlign='center';
      ctx.fillText("S"+d.semana.split('.')[0], x, padT+cH+20);
      ctx.font='9px monospace'; ctx.fillStyle='#94a3b8';
      ctx.fillText(d.semana.split('.')[1], x, padT+cH+32);
    });

    // Programado area fill
    ctx.beginPath();
    data.forEach((d,i) => {
      const x=padL+(i/(data.length-1||1))*cW, y=padT+cH*(1-d.acum/maxVal);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.lineTo(padL+cW,padT+cH); ctx.lineTo(padL,padT+cH); ctx.closePath();
    ctx.fillStyle='rgba(37,99,235,0.08)'; ctx.fill();

    // Programado line
    ctx.strokeStyle='#2563eb'; ctx.lineWidth=2.5; ctx.setLineDash([6,3]);
    ctx.beginPath();
    data.forEach((d,i) => {
      const x=padL+(i/(data.length-1||1))*cW, y=padT+cH*(1-d.acum/maxVal);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.stroke(); ctx.setLineDash([]);

    // Real line
    const realPoints = data.filter(d=>d.real!==null);
    if(realPoints.length>0){
      ctx.strokeStyle='#16a34a'; ctx.lineWidth=3;
      ctx.beginPath();
      realPoints.forEach((d,i) => {
        const idx=data.indexOf(d);
        const x=padL+(idx/(data.length-1||1))*cW, y=padT+cH*(1-d.real/maxVal);
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      });
      ctx.stroke();
      realPoints.forEach(d => {
        const idx=data.indexOf(d);
        const x=padL+(idx/(data.length-1||1))*cW, y=padT+cH*(1-d.real/maxVal);
        ctx.fillStyle='#16a34a'; ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
        // Deviation label
        const dev = d.real - d.acum;
        ctx.fillStyle = dev>=0?'#16a34a':'#dc2626';
        ctx.font='bold 10px monospace'; ctx.textAlign='center';
        ctx.fillText((dev>=0?"+":"")+Math.round(dev)+" m²", x, y-12);
      });
    }

    // Legend
    ctx.setLineDash([6,3]); ctx.strokeStyle='#2563eb'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(padL,16); ctx.lineTo(padL+30,16); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='#2563eb'; ctx.font='11px monospace'; ctx.textAlign='left';
    ctx.fillText('Programado',padL+35,20);
    ctx.strokeStyle='#16a34a'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(padL+130,16); ctx.lineTo(padL+160,16); ctx.stroke();
    ctx.fillStyle='#16a34a'; ctx.fillText('Real',padL+165,20);

    // Axis labels
    ctx.fillStyle='#94a3b8'; ctx.font='10px monospace'; ctx.textAlign='center';
    ctx.fillText('Semana', padL+cW/2, H-5);
    ctx.save(); ctx.translate(14, padT+cH/2); ctx.rotate(-Math.PI/2);
    ctx.fillText('m² acumulados', 0, 0); ctx.restore();

  }, [data]);

  return <canvas ref={canvasRef} width={780} height={320} style={{ width:"100%", maxWidth:780, display:"block", margin:"0 auto" }}/>;
}

// ── Shared Components ─────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ minHeight:"100vh",background:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ color:"#d97706",fontFamily:"'DM Mono',monospace",fontSize:14,letterSpacing:3 }}>CARGANDO…</div>
    </div>
  );
}
function ErrorBar({ msg, onClose }) {
  return (
    <div style={{ background:"#fee2e2",color:"#dc2626",padding:"10px 28px",fontSize:11,borderBottom:"1px solid #fecaca" }}>
      ⚠ {msg} <button onClick={onClose} style={{ marginLeft:12,background:"none",border:"none",color:"#dc2626",cursor:"pointer" }}>×</button>
    </div>
  );
}
function Panel({ title, children }) {
  return (
    <div style={{ background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:10,padding:18,marginBottom:16 }}>
      <div style={{ fontSize:9,letterSpacing:3,color:"#94a3b8",marginBottom:12,borderBottom:"1px solid #e2e8f0",paddingBottom:8 }}>{title}</div>
      {children}
    </div>
  );
}
function TypeKPI({ label, mounted, total, count, countTotal, pct, color, large }) {
  return (
    <div style={{ textAlign:"right",minWidth:140 }}>
      <div style={{ fontSize:9,color:"#94a3b8",letterSpacing:1,marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:large?20:15,fontFamily:"'Archivo Black',sans-serif",color }}>{fmt2(mounted)} <span style={{ fontSize:9,color:"#94a3b8" }}>/ {fmt2(total)} m²</span></div>
      <div style={{ fontSize:9,color:"#94a3b8" }}>{count}/{countTotal} elem · {fmtPct(pct)}</div>
    </div>
  );
}
function Label({ children }) { return <div style={{ fontSize:9,color:"#64748b",letterSpacing:2,marginBottom:3,marginTop:10 }}>{children}</div>; }
function Th({ children }) { return <th style={{ padding:"6px 8px",textAlign:"left",color:"#64748b",fontSize:9,letterSpacing:1,borderBottom:"1px solid #cbd5e1",whiteSpace:"nowrap",background:"#f1f5f9" }}>{children}</th>; }
function Td({ children, accent }) { return <td style={{ padding:"7px 8px",color:accent||"#475569",fontSize:11,whiteSpace:"nowrap" }}>{children}</td>; }
function MiniStat({ label, value, color, small }) {
  return (
    <div style={{ marginBottom:small?0:4 }}>
      <div style={{ fontSize:8,color:"#94a3b8",letterSpacing:2 }}>{label}</div>
      <div style={{ fontSize:small?11:13,fontFamily:"'Archivo Black',sans-serif",color:color||"#1e293b" }}>{value}</div>
    </div>
  );
}
const btnPrimary = { background:"#d97706",color:"#fff",border:"none",borderRadius:6,padding:"8px 16px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:1 };
const btnSecondary = { background:"#f1f5f9",color:"#475569",border:"1px solid #cbd5e1",borderRadius:6,padding:"8px 14px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11 };
const inp = { width:"100%",padding:"7px 9px",background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:5,color:"#1e293b",fontFamily:"'DM Mono',monospace",fontSize:11,boxSizing:"border-box" };
