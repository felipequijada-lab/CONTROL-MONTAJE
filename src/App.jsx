import React, { useState, useMemo, useEffect } from "react";

const SUPABASE_URL = "https://uxgkiuhcqcvcwkvtjqvo.supabase.co";
const SUPABASE_KEY = "sb_publishable_CSpI4hVvQmUWai7oQcPmuQ_mZe3EYqA";

const fmt2 = n => (Math.round(n * 100) / 100).toFixed(2);
const fmtPct = n => (Math.round(n * 10) / 10).toFixed(1) + "%";
const TODAY = new Date().toISOString().slice(0, 10);

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

const INITIAL_ELEMENTS = [
  { pos: "1004", plano: "MD1", tipo: "MD", peso: 2.543, altura: 2.51, longitud: 3.88, espesor: 18, areaBruta: 9.74, areaNeta: 9.71 },
  { pos: "1007", plano: "MD1", tipo: "MD", peso: 3.352, altura: 2.36, longitud: 5.41, espesor: 18, areaBruta: 12.77, areaNeta: 12.77 },
  { pos: "1008", plano: "MD1", tipo: "MD", peso: 1.712, altura: 2.36, longitud: 2.90, espesor: 18, areaBruta: 6.84, areaNeta: 6.42 },
  { pos: "1001", plano: "MD1", tipo: "MD", peso: 4.241, altura: 2.51, longitud: 6.56, espesor: 20, areaBruta: 16.47, areaNeta: 16.47 },
  { pos: "2003", plano: "MD2", tipo: "MD", peso: 2.803, altura: 2.36, longitud: 4.67, espesor: 20, areaBruta: 11.02, areaNeta: 11.01 },
  { pos: "2009", plano: "MD2", tipo: "MD", peso: 3.352, altura: 2.36, longitud: 5.41, espesor: 18, areaBruta: 12.77, areaNeta: 12.77 },
  { pos: "2001", plano: "MD2", tipo: "MD", peso: 3.054, altura: 2.51, longitud: 6.56, espesor: 20, areaBruta: 16.47, areaNeta: 12.55 },
  { pos: "1015", plano: "P1", tipo: "P", peso: 1.905, altura: 2.08, longitud: 6.90, espesor: 5.5, areaBruta: 14.35, areaNeta: 14.36 },
  { pos: "1014", plano: "P1", tipo: "P", peso: 2.250, altura: 2.22, longitud: 7.21, espesor: 6.0, areaBruta: 16.01, areaNeta: 15.55 },
  { pos: "1001p", plano: "P1", tipo: "P", peso: 1.111, altura: 2.51, longitud: 3.21, espesor: 5.5, areaBruta: 8.06, areaNeta: 8.01 },
  { pos: "1009", plano: "P1", tipo: "P", peso: 0.981, altura: 1.35, longitud: 5.45, espesor: 5.5, areaBruta: 7.36, areaNeta: 7.38 },
  { pos: "2001p", plano: "P2", tipo: "P", peso: 1.059, altura: 2.51, longitud: 3.04, espesor: 5.5, areaBruta: 7.63, areaNeta: 7.62 },
  { pos: "2003p", plano: "P2", tipo: "P", peso: 2.109, altura: 2.33, longitud: 6.54, espesor: 5.5, areaBruta: 15.24, areaNeta: 15.23 },
];

const PERSONAL_CARGOS = [
  { key: "coordinadores", label: "Coordinadores", max: 2, productivo: false },
  { key: "calidad", label: "Calidad", max: 4, productivo: false },
  { key: "lideres", label: "Líderes de Montaje", max: 4, productivo: true },
  { key: "montajistas", label: "Montajistas", max: 15, productivo: true },
  { key: "ayudantes", label: "Ayudantes", max: 15, productivo: true },
];

const defaultPersonal = () => ({ coordinadores: 1, calidad: 1, lideres: 1, montajistas: 2, ayudantes: 2 });

function getWeekNumber(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  return `${week}.${d.getFullYear()}`;
}

export default function ObraTracker() {
  const [elements] = useState(INITIAL_ELEMENTS);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [personal, setPersonal] = useState(defaultPersonal());
  const [selectedPos, setSelectedPos] = useState([]);
  const [note, setNote] = useState("");
  const [activeTab, setActiveTab] = useState("registro");
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("TODOS");
  const [obraId] = useState("001");
  const [error, setError] = useState(null);

  useEffect(() => { loadLogs(); }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await sbFetch(`registros?obra_id=eq.${obraId}&select=*`);
      const expanded = [];
      data.forEach(row => {
        const positions = row.elementos_montados ? row.elementos_montados.split(",") : [];
        positions.forEach(pos => {
          if (pos.trim()) expanded.push({
            date: row.fecha,
            pos: pos.trim(),
            personal: {
              coordinadores: row.coordinadores || 0,
              calidad: row.calidad || 0,
              lideres: row.lideres || 0,
              montajistas: row.montajistas || 0,
              ayudantes: row.ayudantes || 0,
            },
            note: row.incidencias || ""
          });
        });
      });
      setLogs(expanded);
    } catch (e) { setError("Error cargando datos: " + e.message); }
    setLoading(false);
  }

  const mountedPos = useMemo(() => new Set(logs.map(l => l.pos)), [logs]);

  const stats = useMemo(() => {
    const md = elements.filter(e => e.tipo === "MD");
    const p  = elements.filter(e => e.tipo === "P");
    const mdM = md.filter(e => mountedPos.has(e.pos));
    const pM  = p.filter(e => mountedPos.has(e.pos));
    return {
      md:  { total: md.length, mounted: mdM.length, areaTotal: md.reduce((s,e)=>s+e.areaBruta,0), areaMounted: mdM.reduce((s,e)=>s+e.areaBruta,0) },
      p:   { total: p.length,  mounted: pM.length,  areaTotal: p.reduce((s,e)=>s+e.areaNeta,0),   areaMounted: pM.reduce((s,e)=>s+e.areaNeta,0) },
      all: { total: elements.length, mounted: mountedPos.size,
             areaTotal:   md.reduce((s,e)=>s+e.areaBruta,0) + p.reduce((s,e)=>s+e.areaNeta,0),
             areaMounted: mdM.reduce((s,e)=>s+e.areaBruta,0) + pM.reduce((s,e)=>s+e.areaNeta,0) },
    };
  }, [elements, mountedPos]);

  const pctMD  = stats.md.areaTotal  > 0 ? (stats.md.areaMounted  / stats.md.areaTotal)  * 100 : 0;
  const pctP   = stats.p.areaTotal   > 0 ? (stats.p.areaMounted   / stats.p.areaTotal)   * 100 : 0;
  const pctAll = stats.all.areaTotal > 0 ? (stats.all.areaMounted / stats.all.areaTotal) * 100 : 0;

  const dailyStats = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      if (!map[l.date]) map[l.date] = { date: l.date, positions: [], personal: l.personal };
      map[l.date].positions.push(l.pos);
    });
    return Object.values(map).map(d => {
      const elems = elements.filter(e => d.positions.includes(e.pos));
      const mdEl = elems.filter(e=>e.tipo==="MD");
      const pEl  = elems.filter(e=>e.tipo==="P");
      const areaMD = mdEl.reduce((s,e)=>s+e.areaBruta,0);
      const areaP  = pEl.reduce((s,e)=>s+e.areaNeta,0);
      const areaTotal = areaMD + areaP;
      const p = d.personal;
      const equipoCompleto = (p.coordinadores||0)+(p.calidad||0)+(p.lideres||0)+(p.montajistas||0)+(p.ayudantes||0);
      return {
        ...d, countMD: mdEl.length, areaMD, countP: pEl.length, areaP, areaTotal,
        rendLider:      p.lideres      > 0 ? areaTotal / p.lideres      : 0,
        rendMontajista: p.montajistas  > 0 ? areaTotal / p.montajistas  : 0,
        rendAyudante:   p.ayudantes    > 0 ? areaTotal / p.ayudantes    : 0,
        rendEquipo:     equipoCompleto > 0 ? areaTotal / equipoCompleto : 0,
        equipoCompleto,
      };
    }).sort((a,b) => b.date.localeCompare(a.date));
  }, [logs, elements]);

  // Weekly stats
  const weeklyStats = useMemo(() => {
    const map = {};
    dailyStats.forEach(d => {
      const week = getWeekNumber(d.date);
      if (!map[week]) map[week] = { week, areaTotal: 0, days: 0, rendEquipo: [] };
      map[week].areaTotal += d.areaTotal;
      map[week].days += 1;
      if (d.rendEquipo > 0) map[week].rendEquipo.push(d.rendEquipo);
    });
    return Object.values(map).map(w => ({
      ...w,
      rendEquipoAvg: w.rendEquipo.length > 0 ? w.rendEquipo.reduce((s,v)=>s+v,0)/w.rendEquipo.length : 0,
    })).sort((a,b) => b.week.localeCompare(a.week));
  }, [dailyStats]);

  const filteredElements = useMemo(() => elements.filter(e => {
    const ms = e.pos.toLowerCase().includes(search.toLowerCase()) || e.plano.toLowerCase().includes(search.toLowerCase());
    const mt = filterTipo === "TODOS" || e.tipo === filterTipo;
    return ms && mt;
  }), [elements, search, filterTipo]);

  const selSummary = useMemo(() => {
    const sel = elements.filter(e => selectedPos.includes(e.pos));
    const md = sel.filter(e=>e.tipo==="MD"); const p = sel.filter(e=>e.tipo==="P");
    return { md: md.length, areaMD: md.reduce((s,e)=>s+e.areaBruta,0), p: p.length, areaP: p.reduce((s,e)=>s+e.areaNeta,0) };
  }, [selectedPos, elements]);

  async function registrar() {
    const toAdd = selectedPos.filter(p => !mountedPos.has(p));
    if (toAdd.length === 0) return;
    setSaving(true);
    try {
      const mdEls = elements.filter(e => toAdd.includes(e.pos) && e.tipo === "MD");
      const pEls  = elements.filter(e => toAdd.includes(e.pos) && e.tipo === "P");
      await sbFetch("registros", {
        method: "POST",
        body: JSON.stringify({
          fecha: selectedDate,
          obra_id: obraId,
          coordinadores: personal.coordinadores,
          calidad: personal.calidad,
          lideres: personal.lideres,
          montajistas: personal.montajistas,
          ayudantes: personal.ayudantes,
          m2_md: mdEls.reduce((s,e)=>s+e.areaBruta,0),
          m2_p: pEls.reduce((s,e)=>s+e.areaNeta,0),
          elementos_montados: toAdd.join(","),
          incidencias: note,
          registrado_por: "encargado",
        }),
      });
      const newLogs = toAdd.map(pos => ({ date: selectedDate, pos, personal: { ...personal }, note }));
      setLogs(prev => [...prev, ...newLogs]);
      setSelectedPos([]);
      setNote("");
    } catch (e) { setError("Error guardando: " + e.message); }
    setSaving(false);
  }

  function desmontar(pos) {
    if (!window.confirm(`¿Desmontar posición ${pos}?`)) return;
    setLogs(prev => prev.filter(l => l.pos !== pos));
  }

  function togglePos(pos) {
    setSelectedPos(prev => prev.includes(pos) ? prev.filter(p=>p!==pos) : [...prev, pos]);
  }

  function exportCSV() {
    const rows = [["Fecha","Semana","Posición","Plano","Tipo","Área m²","Coordinadores","Calidad","Líderes","Montajistas","Ayudantes","Rend.Líder","Rend.Montajista","Rend.Ayudante","Rend.Equipo","Incidencias"]];
    dailyStats.forEach(d => {
      d.positions.forEach(pos => {
        const e = elements.find(el=>el.pos===pos);
        if (!e) return;
        const area = e.tipo==="MD" ? e.areaBruta : e.areaNeta;
        rows.push([d.date, getWeekNumber(d.date), pos, e.plano, e.tipo, fmt2(area),
          d.personal.coordinadores, d.personal.calidad, d.personal.lideres, d.personal.montajistas, d.personal.ayudantes,
          fmt2(d.rendLider), fmt2(d.rendMontajista), fmt2(d.rendAyudante), fmt2(d.rendEquipo), d.note||""]);
      });
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "avance_obra.csv"; a.click();
  }

  function exportWeekly() {
    const rows = [["Semana","m² MD","m² P","m² Total","Rend.Equipo m²/p"]];
    weeklyStats.forEach(w => {
      const mdArea = dailyStats.filter(d=>getWeekNumber(d.date)===w.week).reduce((s,d)=>s+d.areaMD,0);
      const pArea  = dailyStats.filter(d=>getWeekNumber(d.date)===w.week).reduce((s,d)=>s+d.areaP,0);
      rows.push([w.week, fmt2(mdArea), fmt2(pArea), fmt2(w.areaTotal), fmt2(w.rendEquipoAvg)]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "avance_semanal.csv"; a.click();
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0d0f14", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#e8b84b", fontFamily:"'DM Mono',monospace", fontSize:14, letterSpacing:3 }}>CARGANDO DATOS…</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0d0f14", color:"#ddd8cc", fontFamily:"'DM Mono','Courier New',monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Archivo+Black&display=swap" rel="stylesheet"/>

      {error && (
        <div style={{ background:"#3a1a1a", color:"#f87171", padding:"10px 28px", fontSize:11, borderBottom:"1px solid #5a2a2a" }}>
          ⚠ {error} <button onClick={()=>setError(null)} style={{ marginLeft:12, background:"none", border:"none", color:"#f87171", cursor:"pointer" }}>×</button>
        </div>
      )}

      {/* HEADER */}
      <div style={{ background:"#13151e", borderBottom:"1px solid #222536", padding:"16px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:20, color:"#e8b84b", letterSpacing:1 }}>◈ CONTROL DE MONTAJE</div>
          <div style={{ fontSize:10, color:"#555", letterSpacing:3, marginTop:2 }}>BAUMAX · MD · PRELOSAS · SEGUIMIENTO DIARIO</div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <TypeKPI label="MUROS DOBLES (m² bruto)" mounted={stats.md.areaMounted} total={stats.md.areaTotal} count={stats.md.mounted} countTotal={stats.md.total} pct={pctMD} color="#4ade80"/>
          <div style={{ width:1, background:"#222536", height:40 }}/>
          <TypeKPI label="PRELOSAS (m² neto)" mounted={stats.p.areaMounted} total={stats.p.areaTotal} count={stats.p.mounted} countTotal={stats.p.total} pct={pctP} color="#60a5fa"/>
          <div style={{ width:1, background:"#222536", height:40 }}/>
          <TypeKPI label="AVANCE TOTAL" mounted={stats.all.areaMounted} total={stats.all.areaTotal} count={stats.all.mounted} countTotal={stats.all.total} pct={pctAll} color="#e8b84b" large/>
        </div>
      </div>

      {/* PROGRESS BARS */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", height:5 }}>
        <div style={{ background:"#1a1d26" }}><div style={{ height:5, width:pctMD+"%", background:"linear-gradient(90deg,#16a34a,#4ade80)", transition:"width 0.6s" }}/></div>
        <div style={{ background:"#1a1d26" }}><div style={{ height:5, width:pctP+"%", background:"linear-gradient(90deg,#1d4ed8,#60a5fa)", transition:"width 0.6s" }}/></div>
      </div>

      {/* TABS */}
      <div style={{ display:"flex", background:"#13151e", borderBottom:"1px solid #222536", padding:"0 28px" }}>
        {[["registro","▷ REGISTRO DIARIO"],["elementos","◈ ELEMENTOS"],["historial","◫ HISTORIAL"],["semanal","◷ SEMANAL"]].map(([k,l]) => (
          <button key={k} onClick={()=>setActiveTab(k)} style={{
            background:"none", border:"none", cursor:"pointer", padding:"12px 18px",
            color: activeTab===k ? "#e8b84b" : "#555",
            borderBottom: activeTab===k ? "2px solid #e8b84b" : "2px solid transparent",
            fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:2, transition:"color 0.2s"
          }}>{l}</button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          <ExportBtn onClick={exportWeekly} label="↓ SEMANAL"/>
          <ExportBtn onClick={exportCSV} label="↓ COMPLETO"/>
        </div>
      </div>

      <div style={{ padding:"20px 28px", maxWidth:1400, margin:"0 auto" }}>

        {/* ── REGISTRO ── */}
        {activeTab === "registro" && (
          <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:20 }}>
            <div>
              <Panel title="PARÁMETROS DEL DÍA">
                <Label>Fecha</Label>
                <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={inp}/>
                <div style={{ fontSize:9, color:"#555", letterSpacing:2, marginTop:4 }}>SEMANA {getWeekNumber(selectedDate)}</div>

                <Label>PERSONAL EN OBRA</Label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:4 }}>
                  {PERSONAL_CARGOS.map(cargo => (
                    <div key={cargo.key}>
                      <div style={{ fontSize:9, color: cargo.productivo ? "#e8b84b" : "#555", letterSpacing:1, marginBottom:2 }}>
                        {cargo.label.toUpperCase()} {cargo.productivo ? "★" : ""}
                      </div>
                      <input type="number" min={0} max={cargo.max}
                        value={personal[cargo.key]}
                        onChange={e => setPersonal(prev => ({ ...prev, [cargo.key]: Number(e.target.value) }))}
                        style={{ ...inp, margin:0 }}/>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:9, color:"#555", marginTop:4 }}>★ Cargos productivos</div>

                <Label>Incidencias / Nota</Label>
                <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
                  placeholder="Observaciones del día, incidentes…"
                  style={{ ...inp, resize:"vertical", fontFamily:"'DM Mono',monospace", fontSize:11 }}/>

                {selectedPos.length > 0 && (
                  <div style={{ background:"#1a1d26", borderRadius:6, padding:10, marginTop:8, fontSize:11 }}>
                    <div style={{ color:"#555", fontSize:9, letterSpacing:2, marginBottom:6 }}>SELECCIÓN ACTUAL</div>
                    {selSummary.md > 0 && <div style={{ color:"#4ade80" }}>MD: {selSummary.md} elem · {fmt2(selSummary.areaMD)} m² bruto</div>}
                    {selSummary.p  > 0 && <div style={{ color:"#60a5fa", marginTop:3 }}>P: {selSummary.p} elem · {fmt2(selSummary.areaP)} m² neto</div>}
                    <div style={{ color:"#e8b84b", marginTop:3, borderTop:"1px solid #2a2d3a", paddingTop:6 }}>
                      Total: {fmt2(selSummary.areaMD + selSummary.areaP)} m²
                    </div>
                  </div>
                )}

                <button onClick={registrar} disabled={selectedPos.length===0||saving} style={{
                  width:"100%", padding:"11px", marginTop:10,
                  background: selectedPos.length>0 && !saving ? "#e8b84b" : "#1e2130",
                  color: selectedPos.length>0 && !saving ? "#0d0f14" : "#444",
                  border:"none", borderRadius:6, cursor: selectedPos.length>0 && !saving ? "pointer" : "default",
                  fontFamily:"'Archivo Black',sans-serif", fontSize:13, letterSpacing:1, transition:"all 0.2s"
                }}>{saving ? "GUARDANDO…" : `▷ REGISTRAR ${selectedPos.length>0?"("+selectedPos.length+")":""}`}</button>
              </Panel>

              {dailyStats.filter(d=>d.date===selectedDate).map(d=>(
                <Panel key={d.date} title="RESUMEN HOY">
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                    <MiniStat label="m² MD" value={fmt2(d.areaMD)} color="#4ade80" small/>
                    <MiniStat label="m² P" value={fmt2(d.areaP)} color="#60a5fa" small/>
                    <MiniStat label="m² TOTAL" value={fmt2(d.areaTotal)} color="#e8b84b" small/>
                    <MiniStat label="Equipo" value={d.equipoCompleto + " pers."} small/>
                  </div>
                  <div style={{ borderTop:"1px solid #1e2130", paddingTop:8 }}>
                    <div style={{ fontSize:9, color:"#555", letterSpacing:2, marginBottom:6 }}>RENDIMIENTOS m²/persona</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                      <MiniStat label="Por Líder" value={fmt2(d.rendLider)} color="#e8b84b" small/>
                      <MiniStat label="Por Montajista" value={fmt2(d.rendMontajista)} color="#e8b84b" small/>
                      <MiniStat label="Por Ayudante" value={fmt2(d.rendAyudante)} color="#e8b84b" small/>
                      <MiniStat label="Por Equipo" value={fmt2(d.rendEquipo)} color="#e8b84b" small/>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>

            <Panel title="SELECCIONAR ELEMENTOS A MONTAR">
              <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                <input placeholder="Buscar posición o plano…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...inp, flex:1, margin:0 }}/>
                {["TODOS","MD","P"].map(t => (
                  <button key={t} onClick={()=>setFilterTipo(t)} style={{
                    padding:"6px 14px", borderRadius:5, border:"1px solid",
                    borderColor: filterTipo===t ? (t==="MD"?"#4ade80":t==="P"?"#60a5fa":"#e8b84b") : "#222536",
                    background: filterTipo===t ? "#1a1d26" : "transparent",
                    color: filterTipo===t ? (t==="MD"?"#4ade80":t==="P"?"#60a5fa":"#e8b84b") : "#555",
                    fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer"
                  }}>{t}</button>
                ))}
              </div>
              <div style={{ maxHeight:600, overflowY:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ color:"#444", fontSize:9, letterSpacing:2 }}>
                      <Th>SEL</Th><Th>TIPO</Th><Th>POS.</Th><Th>PLANO</Th><Th>PESO Tn</Th><Th>ALT m</Th><Th>LONG m</Th><Th>Á.BRUTA m²</Th><Th>Á.NETA m²</Th><Th>ESTADO</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredElements.map(el => {
                      const isMounted = mountedPos.has(el.pos);
                      const isSelected = selectedPos.includes(el.pos);
                      const tc = el.tipo==="MD" ? "#4ade80" : "#60a5fa";
                      return (
                        <tr key={el.pos} onClick={()=>!isMounted&&togglePos(el.pos)} style={{
                          background: isSelected ? "#1a2218" : isMounted ? "#161820" : "transparent",
                          borderBottom:"1px solid #181b24", cursor: isMounted?"default":"pointer",
                          opacity: isMounted?0.45:1, transition:"background 0.15s"
                        }}>
                          <Td><div style={{ width:14, height:14, borderRadius:3, border:`2px solid ${isSelected?"#e8b84b":"#333"}`, background:isSelected?"#e8b84b":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>{isSelected&&<span style={{ fontSize:9, color:"#0d0f14", fontWeight:"bold" }}>✓</span>}</div></Td>
                          <Td><span style={{ color:tc, fontSize:9, border:`1px solid ${tc}44`, padding:"1px 6px", borderRadius:8 }}>{el.tipo}</span></Td>
                          <Td accent="#ddd8cc">{el.pos}</Td>
                          <Td>{el.plano}</Td><Td>{el.peso}</Td><Td>{el.altura}</Td><Td>{el.longitud}</Td>
                          <Td accent={el.tipo==="MD"?"#4ade8099":undefined}>{fmt2(el.areaBruta)}</Td>
                          <Td accent={el.tipo==="P"?"#60a5fa99":undefined}>{fmt2(el.areaNeta)}</Td>
                          <Td><span style={{ padding:"1px 7px", borderRadius:10, fontSize:9, background:isMounted?"#14281a":"#1e1e1e", color:isMounted?"#4ade80":"#555", border:`1px solid ${isMounted?"#22c55e33":"#2a2d3a"}` }}>{isMounted?"MONTADO":"PENDIENTE"}</span></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop:"1px solid #2a2d3a" }}>
                      <td colSpan={7} style={{ padding:"8px 10px", color:"#555", textAlign:"right", fontSize:10, letterSpacing:1 }}>TOTALES FILTRADOS</td>
                      <td style={{ padding:"8px 10px", color:"#4ade80", fontSize:11, fontWeight:"bold" }}>{fmt2(filteredElements.filter(e=>e.tipo==="MD").reduce((s,e)=>s+e.areaBruta,0))} m²</td>
                      <td style={{ padding:"8px 10px", color:"#60a5fa", fontSize:11, fontWeight:"bold" }}>{fmt2(filteredElements.filter(e=>e.tipo==="P").reduce((s,e)=>s+e.areaNeta,0))} m²</td>
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
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              <input placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...inp, width:220, margin:0 }}/>
              {["TODOS","MD","P"].map(t => (
                <button key={t} onClick={()=>setFilterTipo(t)} style={{
                  padding:"6px 14px", borderRadius:5, border:"1px solid",
                  borderColor: filterTipo===t ? (t==="MD"?"#4ade80":t==="P"?"#60a5fa":"#e8b84b") : "#222536",
                  background: filterTipo===t ? "#1a1d26" : "transparent",
                  color: filterTipo===t ? (t==="MD"?"#4ade80":t==="P"?"#60a5fa":"#e8b84b") : "#555",
                  fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer"
                }}>{t}</button>
              ))}
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ color:"#444", fontSize:9, letterSpacing:2 }}>
                    <Th>TIPO</Th><Th>POSICIÓN</Th><Th>PLANO</Th><Th>PESO Tn</Th><Th>ALT m</Th><Th>LONG m</Th><Th>ESP cm</Th><Th>Á.BRUTA m²</Th><Th>Á.NETA m²</Th><Th>ESTADO</Th><Th>ACCIÓN</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredElements.map(el => {
                    const isMounted = mountedPos.has(el.pos);
                    const logEntry = logs.find(l=>l.pos===el.pos);
                    const tc = el.tipo==="MD" ? "#4ade80" : "#60a5fa";
                    return (
                      <tr key={el.pos} style={{ borderBottom:"1px solid #181b24" }}>
                        <Td><span style={{ color:tc, fontSize:9, border:`1px solid ${tc}44`, padding:"1px 6px", borderRadius:8 }}>{el.tipo}</span></Td>
                        <Td accent="#ddd8cc">{el.pos}</Td>
                        <Td>{el.plano}</Td><Td>{el.peso}</Td><Td>{el.altura}</Td><Td>{el.longitud}</Td><Td>{el.espesor}</Td>
                        <Td accent={el.tipo==="MD"?"#4ade8099":undefined}>{fmt2(el.areaBruta)}</Td>
                        <Td accent={el.tipo==="P"?"#60a5fa99":undefined}>{fmt2(el.areaNeta)}</Td>
                        <Td><span style={{ padding:"1px 7px", borderRadius:10, fontSize:9, background:isMounted?"#14281a":"#1e1e1e", color:isMounted?"#4ade80":"#555", border:`1px solid ${isMounted?"#22c55e33":"#2a2d3a"}` }}>{isMounted?`MONTADO ${logEntry?.date||""}`:"PENDIENTE"}</span></Td>
                        <Td>{isMounted&&<button onClick={()=>desmontar(el.pos)} style={{ background:"none", border:"1px solid #3a1a1a", color:"#f87171", padding:"2px 8px", borderRadius:4, cursor:"pointer", fontFamily:"'DM Mono',monospace", fontSize:9 }}>desmontar</button>}</Td>
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
              {dailyStats.length === 0 && <div style={{ color:"#555", fontSize:12 }}>Sin registros aún.</div>}
              {dailyStats.map(d => (
                <div key={d.date} style={{ padding:"12px 0", borderBottom:"1px solid #181b24" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ color:"#e8b84b", fontSize:12 }}>{d.date}</span>
                    <span style={{ color:"#555", fontSize:10 }}>Semana {getWeekNumber(d.date)}</span>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:8 }}>
                    <MiniStat label="m² MD" value={fmt2(d.areaMD)} color="#4ade80" small/>
                    <MiniStat label="m² P" value={fmt2(d.areaP)} color="#60a5fa" small/>
                    <MiniStat label="m² TOTAL" value={fmt2(d.areaTotal)} color="#e8b84b" small/>
                  </div>
                  <div style={{ background:"#1a1d26", borderRadius:6, padding:8 }}>
                    <div style={{ fontSize:9, color:"#555", letterSpacing:2, marginBottom:6 }}>RENDIMIENTOS m²/persona</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6 }}>
                      <MiniStat label={`Líder (${d.personal.lideres})`} value={fmt2(d.rendLider)} color="#e8b84b" small/>
                      <MiniStat label={`Montaj. (${d.personal.montajistas})`} value={fmt2(d.rendMontajista)} color="#e8b84b" small/>
                      <MiniStat label={`Ayud. (${d.personal.ayudantes})`} value={fmt2(d.rendAyudante)} color="#e8b84b" small/>
                      <MiniStat label={`Equipo (${d.equipoCompleto})`} value={fmt2(d.rendEquipo)} color="#e8b84b" small/>
                    </div>
                  </div>
                </div>
              ))}
            </Panel>

            <Panel title="AVANCE POR PLANO">
              {[...new Set(elements.map(e=>e.plano))].sort().map(pl => {
                const elems = elements.filter(e=>e.plano===pl);
                const tipo = elems[0]?.tipo;
                const mounted = elems.filter(e=>mountedPos.has(e.pos));
                const areaTotal   = elems.reduce((s,e)=>s+(tipo==="MD"?e.areaBruta:e.areaNeta),0);
                const areaMounted = mounted.reduce((s,e)=>s+(tipo==="MD"?e.areaBruta:e.areaNeta),0);
                const p = areaTotal>0 ? (areaMounted/areaTotal)*100 : 0;
                const color = tipo==="MD" ? "#4ade80" : "#60a5fa";
                return (
                  <div key={pl} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}>
                      <span style={{ color:"#ddd8cc" }}>{pl} <span style={{ color, fontSize:9 }}>{tipo}</span></span>
                      <span style={{ color, fontSize:10 }}>{mounted.length}/{elems.length} · {fmt2(areaMounted)}/{fmt2(areaTotal)} m² · {fmtPct(p)}</span>
                    </div>
                    <div style={{ background:"#1e2130", borderRadius:4, height:7 }}>
                      <div style={{ height:7, borderRadius:4, width:p+"%", background:color, opacity:0.8, transition:"width 0.5s" }}/>
                    </div>
                  </div>
                );
              })}
            </Panel>
          </div>
        )}

        {/* ── SEMANAL ── */}
        {activeTab === "semanal" && (
          <Panel title="RESUMEN SEMANAL">
            {weeklyStats.length === 0 && <div style={{ color:"#555", fontSize:12 }}>Sin registros aún.</div>}
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead>
                <tr style={{ color:"#444", fontSize:9, letterSpacing:2 }}>
                  <Th>SEMANA</Th><Th>m² MD</Th><Th>m² P</Th><Th>m² TOTAL</Th><Th>DÍAS</Th><Th>REND. EQUIPO m²/p</Th>
                </tr>
              </thead>
              <tbody>
                {weeklyStats.map(w => {
                  const mdArea = dailyStats.filter(d=>getWeekNumber(d.date)===w.week).reduce((s,d)=>s+d.areaMD,0);
                  const pArea  = dailyStats.filter(d=>getWeekNumber(d.date)===w.week).reduce((s,d)=>s+d.areaP,0);
                  return (
                    <tr key={w.week} style={{ borderBottom:"1px solid #181b24" }}>
                      <Td accent="#e8b84b">{w.week}</Td>
                      <Td accent="#4ade80">{fmt2(mdArea)}</Td>
                      <Td accent="#60a5fa">{fmt2(pArea)}</Td>
                      <Td accent="#e8b84b">{fmt2(w.areaTotal)}</Td>
                      <Td>{w.days}</Td>
                      <Td accent="#e8b84b">{fmt2(w.rendEquipoAvg)}</Td>
                    </tr>
                  );
                })}
              </tbody>
              {weeklyStats.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop:"2px solid #2a2d3a" }}>
                    <td style={{ padding:"8px 10px", color:"#555", fontSize:10 }}>TOTAL</td>
                    <td style={{ padding:"8px 10px", color:"#4ade80", fontSize:11, fontWeight:"bold" }}>{fmt2(dailyStats.reduce((s,d)=>s+d.areaMD,0))} m²</td>
                    <td style={{ padding:"8px 10px", color:"#60a5fa", fontSize:11, fontWeight:"bold" }}>{fmt2(dailyStats.reduce((s,d)=>s+d.areaP,0))} m²</td>
                    <td style={{ padding:"8px 10px", color:"#e8b84b", fontSize:11, fontWeight:"bold" }}>{fmt2(dailyStats.reduce((s,d)=>s+d.areaTotal,0))} m²</td>
                    <td colSpan={2}/>
                  </tr>
                </tfoot>
              )}
            </table>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={{ background:"#13151e", border:"1px solid #222536", borderRadius:10, padding:18, marginBottom:16 }}>
      <div style={{ fontSize:9, letterSpacing:3, color:"#444", marginBottom:12, borderBottom:"1px solid #1e2130", paddingBottom:8 }}>{title}</div>
      {children}
    </div>
  );
}
function TypeKPI({ label, mounted, total, count, countTotal, pct, color, large }) {
  return (
    <div style={{ textAlign:"right", minWidth:140 }}>
      <div style={{ fontSize:9, color:"#444", letterSpacing:1, marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:large?20:15, fontFamily:"'Archivo Black',sans-serif", color }}>{fmt2(mounted)} <span style={{ fontSize:9, color:"#555" }}>/ {fmt2(total)} m²</span></div>
      <div style={{ fontSize:9, color:"#555" }}>{count}/{countTotal} elem · {fmtPct(pct)}</div>
    </div>
  );
}
function Label({ children }) { return <div style={{ fontSize:9, color:"#555", letterSpacing:2, marginBottom:3, marginTop:10 }}>{children}</div>; }
function Th({ children }) { return <th style={{ padding:"6px 8px", textAlign:"left", color:"#444", fontSize:9, letterSpacing:2, borderBottom:"1px solid #1e2130", whiteSpace:"nowrap" }}>{children}</th>; }
function Td({ children, accent }) { return <td style={{ padding:"7px 8px", color:accent||"#666", fontSize:11, whiteSpace:"nowrap" }}>{children}</td>; }
function MiniStat({ label, value, color, small }) {
  return (
    <div style={{ marginBottom:small?0:4 }}>
      <div style={{ fontSize:8, color:"#444", letterSpacing:2 }}>{label}</div>
      <div style={{ fontSize:small?11:13, fontFamily:"'Archivo Black',sans-serif", color:color||"#ddd8cc" }}>{value}</div>
    </div>
  );
}
function ExportBtn({ onClick, label }) {
  return (
    <button onClick={onClick} style={{ background:"#1a1d26", border:"1px solid #2a2d3a", color:"#888", padding:"6px 12px", borderRadius:5, cursor:"pointer", fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:1 }}>{label}</button>
  );
}
const inp = { width:"100%", padding:"7px 9px", background:"#0d0f14", border:"1px solid #222536", borderRadius:5, color:"#ddd8cc", fontFamily:"'DM Mono',monospace", fontSize:11, boxSizing:"border-box" };

