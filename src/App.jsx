// v2.1 - pos__tipo fix
import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://uxgkiuhcqcvcwkvtjqvo.supabase.co";
const SUPABASE_KEY = "sb_publishable_CSpI4hVvQmUWai7oQcPmuQ_mZe3EYqA";
const ADMIN_PIN = "18670610";
const TIPOS_MD = ["MD", "MDT"];

const fmt2 = n => isNaN(n) ? "0.00" : (Math.round(n*100)/100).toFixed(2);
const fmtPct = n => (Math.round(n*10)/10).toFixed(1)+"%";
const TODAY = new Date().toISOString().slice(0,10);

function getWeekNumber(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(),0,1);
  const week = Math.ceil(((d-start)/86400000+start.getDay()+1)/7);
  return `${week}.${d.getFullYear()}`;
}

async function sbFetch(path, options={}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers||{}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const PERSONAL_CARGOS = [
  { key:"coordinadores", label:"Coordinadores", max:2,  productivo:false },
  { key:"calidad",       label:"Calidad",       max:4,  productivo:false },
  { key:"gruas",         label:"N° Grúas",      max:10, productivo:false, special:true },
  { key:"lideres",       label:"Líderes",       max:4,  productivo:true  },
  { key:"montajistas",   label:"Montajistas",   max:15, productivo:true  },
  { key:"ayudantes",     label:"Ayudantes",     max:15, productivo:true  },
];
const defaultPersonal = () => ({coordinadores:1,calidad:1,gruas:1,lideres:1,montajistas:2,ayudantes:2});

// ── PDF Semanal ───────────────────────────────────────────────────────────────
function generatePDF(weekData, elements, dailyStats, weekLabel, obraName, programaAcum, allElements) {
  const fecha = new Date().toLocaleDateString('es-CL');
  const weekElements = weekData.montados.map(key => {
    // key can be torre__piso__pos__tipo or pos__tipo or pos (backward compat)
    const parts = key.split("__");
    let el;
    if(parts.length===4) el = elements.find(e=>`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`===key);
    else if(parts.length===2) el = elements.find(e=>`${e.pos}__${e.tipo}`===key);
    else el = elements.find(e=>e.pos===key);
    const d = dailyStats.find(d=>d.montados.includes(key));
    return el ? {...el, fecha:d?.date||""} : null;
  }).filter(Boolean);
  const incidencias = dailyStats.filter(d=>getWeekNumber(d.date)===weekLabel);

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Courier New',monospace;background:#e2e8f0;color:#1e293b;padding:20px;}.header{background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}.title{color:#d97706;font-size:18px;font-weight:bold;}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px;}.kpi{background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:10px;text-align:center;}.kpi-label{color:#94a3b8;font-size:8px;letter-spacing:1px;margin-bottom:4px;}.kpi-value{font-size:16px;font-weight:bold;}.section{background:#fff;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:12px;page-break-inside:avoid;}.section-title{color:#d97706;font-size:9px;letter-spacing:3px;padding:10px 14px;border-bottom:1px solid #cbd5e1;}table{width:100%;border-collapse:collapse;border-spacing:0;}th{background:#f1f5f9;color:#64748b;font-size:8px;letter-spacing:1px;padding:5px 8px;text-align:left;}td{padding:5px 8px;font-size:9px;color:#475569;border-bottom:1px solid #f1f5f9;}tr{page-break-inside:avoid;}thead{display:table-header-group;}.amber{color:#d97706;}.green{color:#16a34a;}.blue{color:#2563eb;}.footer{text-align:center;color:#94a3b8;font-size:8px;margin-top:16px;border-top:1px solid #cbd5e1;padding-top:8px;}@media print{body{background:#fff!important;}}</style>
</head><body>
<div class="header"><div><div class="title">◈ CONTROL DE MONTAJE</div><div style="color:#94a3b8;font-size:10px;letter-spacing:2px;margin-top:4px">BAUMAX SPA · ${obraName} · SEMANA ${weekLabel}</div></div><div style="text-align:right"><div style="color:#94a3b8;font-size:9px">FECHA</div><div style="font-size:12px;font-weight:bold">${fecha}</div></div></div>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">m² MD/MDT</div><div class="kpi-value green">${fmt2(weekData.areaMD)}</div></div>
  <div class="kpi"><div class="kpi-label">m² P</div><div class="kpi-value blue">${fmt2(weekData.areaP)}</div></div>
  <div class="kpi"><div class="kpi-label">m² TOTAL</div><div class="kpi-value amber">${fmt2(weekData.areaTotal)}</div></div>
  <div class="kpi"><div class="kpi-label">DÍAS EFECTIVOS</div><div class="kpi-value amber">${weekData.diasEfectivos}</div></div>
  <div class="kpi"><div class="kpi-label">REND. EFECTIVO</div><div class="kpi-value ${weekData.rendEfectivo>=600?'green':'red'}" style="${weekData.rendEfectivo<600?'color:#dc2626':''}">${fmt2(weekData.rendEfectivo)}</div></div>
</div>
${(()=>{
  const prog = programaAcum && programaAcum.find(p=>p.semana===weekLabel);
  if(!prog) return '';
  const programado = prog.acum - (programaAcum[programaAcum.indexOf(prog)-1]?.acum||0);
  const real = weekData.areaTotal;
  const diff = real - programado;
  const pct = programado>0 ? (diff/programado)*100 : 0;
  const color = diff>=0 ? '#16a34a' : '#dc2626';
  const label = diff>=0 ? 'SUPERÁVIT' : 'DÉFICIT';
  return `<div style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:12px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
  <div style="font-size:9px;color:#64748b;letter-spacing:2px">CUMPLIMIENTO DE PROGRAMA — SEMANA ${weekLabel}</div>
  <div style="display:flex;gap:24px;align-items:center">
    <div style="text-align:center"><div style="font-size:8px;color:#94a3b8">PROGRAMADO</div><div style="font-size:14px;font-weight:bold;color:#2563eb">${fmt2(programado)} m²</div></div>
    <div style="text-align:center"><div style="font-size:8px;color:#94a3b8">REAL MONTADO</div><div style="font-size:14px;font-weight:bold;color:#d97706">${fmt2(real)} m²</div></div>
    <div style="text-align:center;padding:8px 16px;background:${diff>=0?'#dcfce7':'#fee2e2'};border-radius:6px;border:1px solid ${diff>=0?'#16a34a33':'#dc262633'}">
      <div style="font-size:8px;color:${color};letter-spacing:1px">${label}</div>
      <div style="font-size:16px;font-weight:bold;color:${color}">${diff>=0?'+':''}${fmt2(diff)} m²</div>
      <div style="font-size:9px;color:${color}">${diff>=0?'+':''}${(Math.round(pct*10)/10).toFixed(1)}%</div>
    </div>
  </div>
</div>`;
})()}
${programaAcum&&programaAcum.length>0?`<div class="section"><div class="section-title">CURVA S</div><div style="padding:12px"><img id="curvaSImg" src="" style="width:100%;border-radius:4px"/></div></div>`:''}
<div class="section" style="page-break-before:always"><div class="section-title">RENDIMIENTO DIARIO — SEMANA ${weekLabel}</div>
<div style="padding:12px"><canvas id="barrasDiariasCanvas" width="700" height="180" style="width:100%;border-radius:4px"></canvas></div>
</div>
<div class="section"><div class="section-title">PLANO DE AVANCE — TORRES Y PISOS</div>
<div style="padding:14px" id="planoAvanceSection"></div>
</div>
<div class="section"><div class="section-title">RENDIMIENTOS</div><table>
<tr><th>CARGO</th><th>PERSONAS</th><th>m²/PERSONA/DÍA</th><th>m²/PERSONA/SEMANA</th></tr>
<tr><td class="amber">Líder</td><td>${weekData.personal.lideres}</td><td>${fmt2(weekData.rendLider)}</td><td>${fmt2(weekData.rendLider*weekData.diasEfectivos)}</td></tr>
<tr><td class="amber">Montajista</td><td>${weekData.personal.montajistas}</td><td>${fmt2(weekData.rendMontajista)}</td><td>${fmt2(weekData.rendMontajista*weekData.diasEfectivos)}</td></tr>
<tr><td class="amber">Ayudante</td><td>${weekData.personal.ayudantes}</td><td>${fmt2(weekData.rendAyudante)}</td><td>${fmt2(weekData.rendAyudante*weekData.diasEfectivos)}</td></tr>
<tr><td>Equipo</td><td>${weekData.equipoCompleto}</td><td>${fmt2(weekData.rendEquipo)}</td><td>${fmt2(weekData.rendEquipo*weekData.diasEfectivos)}</td></tr>
</table></div>
<div class="section"><div class="section-title">INCIDENCIAS</div><table>
<tr><th>FECHA</th><th>OBSERVACIÓN</th></tr>
${incidencias.map(d=>`<tr><td class="amber">${d.date}</td><td>${d.note||"Sin incidencias"}</td></tr>`).join('')}
${incidencias.length===0?'<tr><td colspan="2" style="text-align:center;color:#94a3b8">Sin incidencias</td></tr>':''}
</table></div>
<div class="section" style="page-break-before:always;"><div class="section-title">ELEMENTOS MONTADOS — SEMANA ${weekLabel}</div><table>
<tr><th>LOTE</th><th>TORRE</th><th>PISO</th><th>TIPO</th><th>POSICIÓN</th><th>ÁREA m²</th><th>FECHA</th></tr>
${weekElements.map(el=>`<tr><td>${el.lote||""}</td><td>${el.torre||""}</td><td>${el.piso||""}</td><td class="${TIPOS_MD.includes(el.tipo)?"green":"blue"}">${el.tipo}</td><td>${el.pos}</td><td>${fmt2(el.area)}</td><td>${el.fecha}</td></tr>`).join('')}
<tr style="background:#f1f5f9"><td colspan="5"><b>TOTAL</b></td><td class="amber"><b>${fmt2(weekData.areaTotal)} m²</b></td><td></td></tr>
</table></div>
<div style="margin-top:24px;padding:20px 28px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;display:flex;justify-content:space-between;align-items:flex-end">
  <div><div style="font-size:8px;color:#94a3b8;letter-spacing:2px;margin-bottom:4px">INFORME EMITIDO POR</div><div style="font-size:9px;color:#64748b">${fecha}</div></div>
  <div style="text-align:center">
    <div style="height:36px"></div>
    <div style="border-top:1px solid #1e293b;padding-top:8px;width:220px;margin:0 auto">
      <div style="font-size:12px;color:#1e293b;font-weight:bold;letter-spacing:1px">Felipe Quijada M.</div>
      <div style="font-size:9px;color:#64748b;margin-top:3px">Subgerente de Montaje · Baumax SPA</div>
    </div>
  </div>
  <div style="font-size:9px;color:#94a3b8;text-align:right">Control de Montaje<br/>Baumax SPA</div>
</div>
<div class="footer">Informe generado automáticamente · Control de Montaje · Baumax SPA · Semana ${weekLabel}</div>
</body></html>`;

  const existingCanvas = document.getElementById('curvaSMain');
  const curvaSImg = existingCanvas ? existingCanvas.toDataURL('image/png') : null;
  let finalHtml = curvaSImg ? html.replace('src=""', `src="${curvaSImg}"`) : html;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:800px;height:600px;border:0;opacity:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(finalHtml); doc.close();
  setTimeout(()=>{
    const doc2 = iframe.contentWindow.document;
    
    // Draw barras diarias
    const bc = doc2.getElementById('barrasDiariasCanvas');
    if(bc) {
      const ctx = bc.getContext('2d');
      const W=bc.width, H=bc.height;
      const padL=50,padR=20,padT=20,padB=35,cW=W-padL-padR,cH=H-padT-padB;
      ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,W,H);
      const weekDaysRaw = weekData.days || dailyStats.filter(d=>getWeekNumber(d.date)===weekLabel);
      const weekDays = [...weekDaysRaw].sort((a,b)=>a.date.localeCompare(b.date)); // ascending
      const maxVal = Math.max(...weekDays.map(d=>Math.max(d.areaTotal||0,d.areaRecibida||0)),100);
      const bW = Math.max(8,(cW/Math.max(weekDays.length,1))*0.2);
      const gap = 2;
      weekDays.forEach((d,i)=>{
        const x = padL+(i/(Math.max(weekDays.length-1,1)))*cW;
        // Format date as DD/MM
        const parts = (d.date||'').split('-');
        const dateLabel = parts.length===3 ? parts[2]+'/'+parts[1] : d.date;
        // Recibidos bar
        if(d.areaRecibida>0){const h=(d.areaRecibida/maxVal)*cH;ctx.fillStyle='rgba(59,130,246,0.7)';ctx.fillRect(x-bW-gap,padT+cH-h,bW,h);}
        // Montados bar
        if(d.areaTotal>0){const h=(d.areaTotal/maxVal)*cH;ctx.fillStyle='rgba(34,197,94,0.85)';ctx.fillRect(x+gap,padT+cH-h,bW,h);ctx.fillStyle='#166534';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(Math.round(d.areaTotal),x+gap+bW/2,padT+cH-h-3);}
        // X label DD/MM
        ctx.fillStyle='#64748b';ctx.font='9px monospace';ctx.textAlign='center';
        ctx.fillText(dateLabel,x,padT+cH+14);
      });
      // Grid
      for(let i=0;i<=4;i++){const y=padT+(cH/4)*i;ctx.strokeStyle='#e2e8f0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(padL+cW,y);ctx.stroke();ctx.fillStyle='#94a3b8';ctx.font='9px monospace';ctx.textAlign='right';ctx.fillText(Math.round(maxVal*(1-i/4)),padL-4,y+3);}
      // Legend
      ctx.fillStyle='rgba(59,130,246,0.7)';ctx.fillRect(padL,8,10,8);ctx.fillStyle='#64748b';ctx.font='9px monospace';ctx.textAlign='left';ctx.fillText('Despachados',padL+14,15);
      ctx.fillStyle='rgba(34,197,94,0.85)';ctx.fillRect(padL+90,8,10,8);ctx.fillStyle='#64748b';ctx.fillText('Montados',padL+104,15);
    }

    // Draw plano de avance
    const planoDiv = doc2.getElementById('planoAvanceSection');
    if(planoDiv && allElements) {
      const torres=[...new Set(allElements.map(e=>e.torre).filter(Boolean))].sort();
      const pisos=[...new Set(allElements.map(e=>e.piso).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
      const tipos=['MD','P'];
      const montPos=new Set(dailyStats.filter(d=>d.aprobado).flatMap(d=>d.montados));
      const chk=(e)=>montPos.has(e.torre+'__'+e.piso+'__'+e.pos+'__'+e.tipo)||montPos.has(e.pos+'__'+e.tipo)||montPos.has(e.pos);
      
      let html='<table style="border-collapse:separate;border-spacing:3px;font-size:10px"><thead><tr><th style="width:30px"></th>';
      torres.forEach(t=>{ html+='<th colspan="2" style="text-align:center;font-weight:bold;font-size:12px;padding-bottom:4px">'+t+'</th>'; });
      html+='</tr><tr><th></th>';
      torres.forEach(t=>tipos.forEach(tip=>{ html+='<th style="text-align:center;color:'+(tip==='MD'?'#16a34a':'#2563eb')+';font-size:8px">'+tip+'</th>'; }));
      html+='</tr></thead><tbody>';
      pisos.forEach(piso=>{
        html+='<tr><td style="color:#64748b;font-weight:bold;padding-right:8px;text-align:right">P'+piso+'</td>';
        torres.forEach(t=>tipos.forEach(tipo=>{
          const elems=allElements.filter(e=>e.torre===t&&String(e.piso)===String(piso)&&e.tipo===tipo);
          if(elems.length===0){html+='<td></td>';return;}
          const mounted=elems.filter(e=>chk(e));
          const pct=mounted.length/elems.length;
          const bg=pct===1?'#16a34a':pct>0?'#86efac':'#e2e8f0';
          const color=pct===1?'#fff':pct>0?'#166534':'#94a3b8';
          const label=pct===1?'OK':pct>0?'>>':'';
          html+='<td style="padding:1px"><div style="width:28px;height:18px;background:'+bg+';border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-family:monospace;color:'+color+';font-weight:bold">'+label+'</div></td>';
        }));
        html+='</tr>';
      });
      html+='</tbody></table>';
      html+='<div style="display:flex;gap:16px;margin-top:8px;font-size:9px;color:#64748b">';
      html+='<span><span style="display:inline-block;width:12px;height:10px;background:#16a34a;border-radius:2px;margin-right:4px"></span>Completo</span>';
      html+='<span><span style="display:inline-block;width:12px;height:10px;background:#86efac;border-radius:2px;margin-right:4px"></span>Parcial</span>';
      html+='<span><span style="display:inline-block;width:12px;height:10px;background:#e2e8f0;border-radius:2px;margin-right:4px"></span>Pendiente</span>';
      html+='</div>';
      planoDiv.innerHTML=html;
    }

    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(()=>document.body.removeChild(iframe),1000);
  },800);
}

// ── PDF Completo ──────────────────────────────────────────────────────────────
function generateFullPDF(elements, dailyStats, weeklyStats, programaAcum, obraName) {
  const fecha = new Date().toLocaleDateString('es-CL');
  const mountedPos = new Set(dailyStats.flatMap(d=>d.montados));
  const receivedPos = new Set(dailyStats.flatMap(d=>d.recibidos));
  const mountedEls = elements.filter(e=>mountedPos.has(e.pos));
  const totalArea = elements.reduce((s,e)=>s+e.area,0);
  const mountedArea = mountedEls.reduce((s,e)=>s+e.area,0);
  const pctMounted = totalArea>0?(mountedArea/totalArea)*100:0;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Courier New',monospace;background:#e2e8f0;color:#1e293b;padding:20px;}.header{background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}.title{color:#d97706;font-size:18px;font-weight:bold;}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}.kpi{background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:10px;text-align:center;}.kpi-label{color:#94a3b8;font-size:8px;letter-spacing:1px;margin-bottom:4px;}.kpi-value{font-size:18px;font-weight:bold;}.section{background:#fff;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:12px;page-break-inside:avoid;}.section-title{color:#d97706;font-size:9px;letter-spacing:3px;padding:10px 14px;border-bottom:1px solid #cbd5e1;}table{width:100%;border-collapse:collapse;}th{background:#f1f5f9;color:#64748b;font-size:8px;padding:5px 8px;text-align:left;}td{padding:5px 8px;font-size:9px;color:#475569;border-bottom:1px solid #f1f5f9;}tr{page-break-inside:avoid;}.amber{color:#d97706;}.green{color:#16a34a;}.blue{color:#2563eb;}.footer{text-align:center;color:#94a3b8;font-size:8px;margin-top:16px;border-top:1px solid #cbd5e1;padding-top:8px;}@media print{body{background:#fff!important;}}</style>
</head><body>
<div class="header"><div><div class="title">◈ REPORTE COMPLETO DE OBRA</div><div style="color:#94a3b8;font-size:10px;letter-spacing:2px;margin-top:4px">BAUMAX SPA · ${obraName}</div></div><div style="text-align:right"><div style="color:#94a3b8;font-size:9px">GENERADO</div><div style="font-size:12px;font-weight:bold">${fecha}</div></div></div>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">TOTAL ELEMENTOS</div><div class="kpi-value amber">${elements.length}</div></div>
  <div class="kpi"><div class="kpi-label">MONTADOS</div><div class="kpi-value green">${mountedEls.length}</div></div>
  <div class="kpi"><div class="kpi-label">m² MONTADOS</div><div class="kpi-value green">${fmt2(mountedArea)}</div></div>
  <div class="kpi"><div class="kpi-label">% AVANCE</div><div class="kpi-value ${pctMounted>=75?'green':pctMounted>=40?'amber':'red'}">${fmtPct(pctMounted)}</div></div>
</div>
${programaAcum&&programaAcum.length>0?`<div class="section"><div class="section-title">CURVA S</div><div style="padding:12px"><img src="" id="curvaSFullImg" style="width:100%;border-radius:4px"/></div></div>`:''}
<div class="section"><div class="section-title">RESUMEN SEMANAL</div><table>
<tr><th>SEMANA</th><th>m² RECIBIDOS</th><th>m² MD/MDT</th><th>m² P</th><th>m² TOTAL</th><th>DÍAS EFEC.</th><th>REND. EFEC.</th><th>REND. EQUIPO</th></tr>
${weeklyStats.map(w=>`<tr><td class="amber">${w.week}</td><td class="blue">${fmt2(w.areaRecibida)}</td><td class="green">${fmt2(w.areaMD)}</td><td class="blue">${fmt2(w.areaP)}</td><td class="amber">${fmt2(w.areaTotal)}</td><td>${w.diasEfectivos}</td><td>${fmt2(w.rendEfectivo)}</td><td>${fmt2(w.rendEquipo)}</td></tr>`).join('')}
<tr style="background:#f1f5f9;font-weight:bold"><td class="amber">TOTAL</td><td class="blue">${fmt2(weeklyStats.reduce((s,w)=>s+w.areaRecibida,0))}</td><td class="green">${fmt2(weeklyStats.reduce((s,w)=>s+w.areaMD,0))}</td><td class="blue">${fmt2(weeklyStats.reduce((s,w)=>s+w.areaP,0))}</td><td class="amber">${fmt2(weeklyStats.reduce((s,w)=>s+w.areaTotal,0))}</td><td>${weeklyStats.reduce((s,w)=>s+w.diasEfectivos,0)}</td><td colspan="2"></td></tr>
</table></div>
<div class="section"><div class="section-title">INVENTARIO COMPLETO</div><table>
<tr><th>LOTE</th><th>TORRE</th><th>PISO</th><th>TIPO</th><th>POSICIÓN</th><th>ÁREA m²</th><th>ESTADO</th><th>F. RECEPCIÓN</th><th>F. MONTAJE</th></tr>
${elements.map(el=>{
  const logM=dailyStats.find(d=>d.montados.includes(el.pos));
  const logR=dailyStats.find(d=>d.recibidos.includes(el.pos));
  const estado=logM?"MONTADO":logR?"RECIBIDO":"PENDIENTE";
  const color=logM?"green":logR?"blue":"";
  return `<tr><td>${el.lote||""}</td><td>${el.torre||""}</td><td>${el.piso||""}</td><td class="${TIPOS_MD.includes(el.tipo)?"green":"blue"}">${el.tipo}</td><td>${el.pos}</td><td>${fmt2(el.area)}</td><td class="${color}">${estado}</td><td>${logR?.date||""}</td><td>${logM?.date||""}</td></tr>`;
}).join('')}
</table></div>
<div class="section"><div class="section-title">INCIDENCIAS</div><table>
<tr><th>FECHA</th><th>SEMANA</th><th>OBSERVACIÓN</th></tr>
${dailyStats.filter(d=>d.note).map(d=>`<tr><td class="amber">${d.date}</td><td>${getWeekNumber(d.date)}</td><td>${d.note}</td></tr>`).join('')}
${dailyStats.filter(d=>d.note).length===0?'<tr><td colspan="3" style="text-align:center;color:#94a3b8">Sin incidencias</td></tr>':''}
</table></div>
<div class="footer">Reporte completo · Control de Montaje · Baumax SPA · ${fecha}</div>
</body></html>`;

  const existingCanvas = document.getElementById('curvaSMain');
  const curvaSImg = existingCanvas ? existingCanvas.toDataURL('image/png') : null;
  let finalHtml = curvaSImg ? html.replace('src="" id="curvaSFullImg"', `src="${curvaSImg}" id="curvaSFullImg"`) : html;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:800px;height:600px;border:0;opacity:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(finalHtml); doc.close();
  setTimeout(()=>{ iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(()=>document.body.removeChild(iframe),1000); },600);
}

// ── Excel Semanal ─────────────────────────────────────────────────────────────
function generateExcel(weekData, elements, dailyStats, weekLabel) {
  const wb = XLSX.utils.book_new();
  const resumen = [
    [`INFORME SEMANAL - SEMANA ${weekLabel}`],[],
    ["RESUMEN"],
    ["m² MD/MDT",parseFloat(fmt2(weekData.areaMD))],
    ["m² P",parseFloat(fmt2(weekData.areaP))],
    ["m² Total",parseFloat(fmt2(weekData.areaTotal))],
    ["Días efectivos",weekData.diasEfectivos],
    ["Rendimiento efectivo (m²/día)",parseFloat(fmt2(weekData.rendEfectivo))],[],
    ["RENDIMIENTOS"],
    ["Cargo","Personas","m²/persona/día","m²/persona/semana"],
    ["Líder",weekData.personal.lideres,parseFloat(fmt2(weekData.rendLider)),parseFloat(fmt2(weekData.rendLider*weekData.diasEfectivos))],
    ["Montajista",weekData.personal.montajistas,parseFloat(fmt2(weekData.rendMontajista)),parseFloat(fmt2(weekData.rendMontajista*weekData.diasEfectivos))],
    ["Ayudante",weekData.personal.ayudantes,parseFloat(fmt2(weekData.rendAyudante)),parseFloat(fmt2(weekData.rendAyudante*weekData.diasEfectivos))],
    ["Equipo",weekData.equipoCompleto,parseFloat(fmt2(weekData.rendEquipo)),parseFloat(fmt2(weekData.rendEquipo*weekData.diasEfectivos))],
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(resumen),"Resumen");
  const elemRows=[["Lote","Torre","Piso","Tipo","Posición","Área m²","Fecha"]];
  weekData.montados.forEach(pos=>{
    const el=elements.find(e=>e.pos===pos);
    const d=dailyStats.find(d=>d.montados.includes(pos));
    if(el) elemRows.push([el.lote||"",el.torre||"",el.piso||"",el.tipo,el.pos,el.area,d?.date||""]);
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(elemRows),"Montados");
  const incRows=[["Fecha","Observación"]];
  dailyStats.filter(d=>getWeekNumber(d.date)===weekLabel).forEach(d=>incRows.push([d.date,d.note||""]));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(incRows),"Incidencias");
  XLSX.writeFile(wb,`informe_semana_${weekLabel}.xlsx`);
}

// ── Excel Completo ────────────────────────────────────────────────────────────
function generateFullExcel(elements, dailyStats, weeklyStats, obraName) {
  const wb = XLSX.utils.book_new();
  const semRows=[
    [`REPORTE COMPLETO — ${obraName}`],[],
    ["RESUMEN SEMANAL"],
    ["Semana","m² Recibidos","m² MD/MDT","m² Prelosas","m² Total","Días Efectivos","Rend. Efec. m²/día","Rend. Equipo m²/p"],
    ...weeklyStats.map(w=>[w.week,parseFloat(fmt2(w.areaRecibida)),parseFloat(fmt2(w.areaMD)),parseFloat(fmt2(w.areaP)),parseFloat(fmt2(w.areaTotal)),w.diasEfectivos,parseFloat(fmt2(w.rendEfectivo)),parseFloat(fmt2(w.rendEquipo))]),
    [],["TOTALES",
      parseFloat(fmt2(weeklyStats.reduce((s,w)=>s+w.areaRecibida,0))),
      parseFloat(fmt2(weeklyStats.reduce((s,w)=>s+w.areaMD,0))),
      parseFloat(fmt2(weeklyStats.reduce((s,w)=>s+w.areaP,0))),
      parseFloat(fmt2(weeklyStats.reduce((s,w)=>s+w.areaTotal,0))),
      weeklyStats.reduce((s,w)=>s+w.diasEfectivos,0),
    ],
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(semRows),"Resumen Semanal");
  const invRows=[["Lote","Torre","Piso","Tipo","Posición","Área m²","Estado","F. Recepción","F. Montaje"]];
  elements.forEach(el=>{
    const logM=dailyStats.find(d=>d.montados.includes(el.pos));
    const logR=dailyStats.find(d=>d.recibidos.includes(el.pos));
    invRows.push([el.lote||"",el.torre||"",el.piso||"",el.tipo,el.pos,el.area,logM?"Montado":logR?"Recibido":"Pendiente",logR?.date||"",logM?.date||""]);
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(invRows),"Inventario");
  const regRows=[["Fecha","Semana","Montados","Recibidos","m² MD","m² P","m² Total","m² Recibidos","Líderes","Montajistas","Ayudantes","Equipo","Rend.Líder","Rend.Montajista","Rend.Ayudante","Rend.Equipo","Incidencias"]];
  dailyStats.forEach(d=>{
    regRows.push([d.date,getWeekNumber(d.date),d.montados.length,d.recibidos.length,parseFloat(fmt2(d.areaMD)),parseFloat(fmt2(d.areaP)),parseFloat(fmt2(d.areaTotal)),parseFloat(fmt2(d.areaRecibida)),d.personal.lideres,d.personal.montajistas,d.personal.ayudantes,d.equipoCompleto,parseFloat(fmt2(d.rendLider)),parseFloat(fmt2(d.rendMontajista)),parseFloat(fmt2(d.rendAyudante)),parseFloat(fmt2(d.rendEquipo)),d.note||""]);
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(regRows),"Registro Diario");
  const incRows=[["Fecha","Semana","Observación"]];
  dailyStats.filter(d=>d.note).forEach(d=>incRows.push([d.date,getWeekNumber(d.date),d.note]));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(incRows),"Incidencias");
  XLSX.writeFile(wb,`reporte_completo_${obraName.replace(/\s+/g,"_")}.xlsx`);
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("login");
  const [obras, setObras] = useState([]);
  const [selectedObra, setSelectedObra] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [adminPin, setAdminPin] = useState("");
  const [adminError, setAdminError] = useState(false);
  const [loginMail, setLoginMail] = useState("");
  const [loginRut, setLoginRut] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(()=>{ loadObras(); },[]);

  async function loadObras() {
    setLoading(true);
    try { const data = await sbFetch("obras?select=*&order=created_at.desc"); setObras(data); }
    catch(e) { setError("Error: "+e.message); }
    setLoading(false);
  }

  async function handleUserLogin() {
    setLoginError("");
    try {
      const users = await sbFetch(`usuarios?mail=eq.${encodeURIComponent(loginMail)}&rut=eq.${encodeURIComponent(loginRut)}&select=*`);
      if(users.length===0){ setLoginError("Mail o RUT incorrecto"); return; }
      const user = users[0];
      setCurrentUser({...user, role:"encargado"});
      const obrasActivas = obras.filter(o=>o.estado!=="cerrada");
      if(obrasActivas.length===1){ setSelectedObra(obrasActivas[0]); setScreen("obra"); }
      else setScreen("select");
    } catch(e){ setLoginError("Error al conectar"); }
  }

  function handleAdminLogin() {
    if(adminPin===ADMIN_PIN){ setCurrentUser({nombre:"Admin",role:"admin"}); setScreen("admin"); setAdminError(false); }
    else setAdminError(true);
  }

  function handleLogout() {
    setCurrentUser(null); setSelectedObra(null);
    setLoginMail(""); setLoginRut(""); setAdminPin(""); setLoginError("");
    setScreen("login");
  }

  if(loading) return <LoadingScreen/>;

  return (
    <div style={{ minHeight:"100vh", background:"#e2e8f0", fontFamily:"'DM Mono','Courier New',monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Archivo+Black&display=swap" rel="stylesheet"/>
      {error && <ErrorBar msg={error} onClose={()=>setError(null)}/>}
      {screen==="login"      && <LoginScreen loginMail={loginMail} setLoginMail={setLoginMail} loginRut={loginRut} setLoginRut={setLoginRut} loginError={loginError} onLogin={handleUserLogin} adminPin={adminPin} setAdminPin={setAdminPin} adminError={adminError} onAdminLogin={handleAdminLogin}/>}
      {screen==="select"     && <SelectScreen obras={obras.filter(o=>o.estado!=="cerrada")} currentUser={currentUser} onSelectObra={o=>{setSelectedObra(o);setScreen("obra");}} onLogout={handleLogout} onRefresh={loadObras}/>}
      {screen==="admin"      && <AdminPanel obras={obras} onBack={handleLogout} onObraCreated={loadObras} setError={setError} onViewObra={o=>{setSelectedObra(o);setScreen("obraAdmin");}}/>}
      {screen==="obra"       && selectedObra && <ObraView obra={selectedObra} onBack={()=>{currentUser?.role==="admin"?setScreen("admin"):setScreen("select");}} setError={setError} isAdmin={false} currentUser={currentUser}/>}
      {screen==="obraAdmin"  && selectedObra && <ObraView obra={selectedObra} onBack={()=>setScreen("admin")} setError={setError} isAdmin={true} currentUser={currentUser} onObraUpdated={loadObras}/>}
    </div>
  );
}


// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ loginMail, setLoginMail, loginRut, setLoginRut, loginError, onLogin, adminPin, setAdminPin, adminError, onAdminLogin }) {
  const [mode, setMode] = useState("encargado");
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:24, color:"#d97706", marginBottom:4 }}>◈ CONTROL DE MONTAJE</div>
      <div style={{ fontSize:10, color:"#94a3b8", letterSpacing:3, marginBottom:32 }}>BAUMAX SPA</div>
      <div style={{ background:"#f8fafc", border:"1px solid #cbd5e1", borderRadius:12, padding:28, width:"100%", maxWidth:400 }}>
        <div style={{ display:"flex", marginBottom:20, borderBottom:"1px solid #e2e8f0" }}>
          <button onClick={()=>setMode("encargado")} style={{ flex:1,padding:"10px",background:"none",border:"none",cursor:"pointer",color:mode==="encargado"?"#d97706":"#64748b",borderBottom:mode==="encargado"?"2px solid #d97706":"2px solid transparent",fontFamily:"'DM Mono',monospace",fontSize:11 }}>ENCARGADO</button>
          <button onClick={()=>setMode("admin")} style={{ flex:1,padding:"10px",background:"none",border:"none",cursor:"pointer",color:mode==="admin"?"#d97706":"#64748b",borderBottom:mode==="admin"?"2px solid #d97706":"2px solid transparent",fontFamily:"'DM Mono',monospace",fontSize:11 }}>ADMINISTRADOR</button>
        </div>
        {mode==="encargado" ? (
          <div>
            <Label>Correo electrónico</Label>
            <input type="email" value={loginMail} onChange={e=>setLoginMail(e.target.value)} placeholder="nombre@empresa.cl" style={inp}/>
            <Label>RUT (sin puntos, con guión)</Label>
            <input value={loginRut} onChange={e=>setLoginRut(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onLogin()} placeholder="12345678-9" style={inp}/>
            {loginError&&<div style={{ color:"#dc2626",fontSize:11,marginTop:8,textAlign:"center" }}>{loginError}</div>}
            <button onClick={onLogin} style={{ ...btnPrimary,width:"100%",marginTop:16,padding:"11px" }}>Ingresar →</button>
          </div>
        ) : (
          <div>
            <Label>PIN de administrador</Label>
            <input type="password" inputMode="numeric" value={adminPin} onChange={e=>setAdminPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onAdminLogin()} placeholder="PIN numérico" style={{ ...inp,fontSize:18,letterSpacing:4,textAlign:"center" }}/>
            {adminError&&<div style={{ color:"#dc2626",fontSize:11,marginTop:8,textAlign:"center" }}>PIN incorrecto</div>}
            <button onClick={onAdminLogin} style={{ ...btnPrimary,width:"100%",marginTop:16,padding:"11px" }}>Ingresar →</button>
          </div>
        )}
      </div>
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
        {obras.length===0 ? <div style={{ color:"#94a3b8", fontSize:12, textAlign:"center", padding:20 }}>No hay obras activas.</div>
        : obras.map(o=>(
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
        <input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onLogin()} placeholder="PIN numérico" style={{ ...inp, marginBottom:8, fontSize:18, letterSpacing:4, textAlign:"center" }}/>
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
function AdminPanel({ obras, onBack, onObraCreated, setError, onViewObra }) {
  const [tab, setTab] = useState("resumen");
  const [newObra, setNewObra] = useState({ nombre:"", ubicacion:"", fecha_inicio:TODAY });
  const [pendingRegs, setPendingRegs] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [newUser, setNewUser] = useState({ nombre:"", mail:"", rut:"" });
  const [editingUser, setEditingUser] = useState(null);
  const [creando, setCreando] = useState(false);
  const [obraId, setObraId] = useState(obras.filter(o=>o.estado!=="cerrada")[0]?.id||"");
  const [uploadStatus, setUploadStatus] = useState("");
  const [programa, setPrograma] = useState({ obra_id:obras[0]?.id||"", semana:"", meta:"" });
  const [programaObra, setProgramaObra] = useState(obras[0]?.id||"");
  const [programaRows, setProgramaRows] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [newSemana, setNewSemana] = useState("");
  const [newMeta, setNewMeta] = useState("");
  const [adminStats, setAdminStats] = useState([]);
  const [weekColumns, setWeekColumns] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const fileRef = useRef();

  const obrasActivas = obras.filter(o=>o.estado!=="cerrada");
  const obrasCerradas = obras.filter(o=>o.estado==="cerrada");

  useEffect(()=>{
    if(tab==="resumen") loadAdminStats();
    if(tab==="aprobacion") loadPendingRegs();
    if(tab==="usuarios") loadUsuarios();
    if(tab==="programa") loadPrograma();
  },[tab,obras]);

  useEffect(()=>{
    if(tab==="programa") loadPrograma();
  },[programaObra]);

  async function loadPrograma() {
    if(!programaObra) return;
    try {
      const rows = await sbFetch(`programa?obra_id=eq.${programaObra}&select=*&order=semana.asc`);
      setProgramaRows(rows);
    } catch(e){ setError("Error: "+e.message); }
  }

  async function guardarEdicion(row) {
    try {
      await sbFetch(`programa?id=eq.${row.id}`,{method:"PATCH",body:JSON.stringify({meta:parseFloat(row._meta||row.meta)}),headers:{"Prefer":"return=minimal"}});
      setEditingRow(null);
      loadPrograma();
    } catch(e){ setError("Error: "+e.message); }
  }

  async function eliminarPrograma(id) {
    if(!window.confirm("¿Eliminar esta semana del programa?")) return;
    try {
      await sbFetch(`programa?id=eq.${id}`,{method:"DELETE",headers:{"Prefer":"return=minimal"}});
      loadPrograma();
    } catch(e){ setError("Error: "+e.message); }
  }

  async function loadPendingRegs() {
    try {
      const regs = await sbFetch("registros?aprobado=eq.false&select=*&order=fecha.asc");
      const map={};
      regs.forEach(r=>{
        const key=`${r.obra_id}||${r.fecha}`;
        if(!map[key]) map[key]={obra_id:r.obra_id,fecha:r.fecha,registros:[],ids:[]};
        map[key].registros.push(r); map[key].ids.push(r.id);
      });
      const grouped=Object.values(map);
      grouped.forEach(g=>{ g.obraNombre=obras.find(o=>String(o.id)===String(g.obra_id))?.nombre||g.obra_id; });
      setPendingRegs(grouped);
    } catch(e){ setError("Error: "+e.message); }
  }

  async function loadUsuarios() {
    try { const data=await sbFetch("usuarios?select=*"); setUsuarios(data); }
    catch(e){ setError("Error: "+e.message); }
  }

  async function aprobarDia(group) {
    try {
      for(const id of group.ids)
        await sbFetch(`registros?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({aprobado:true}),headers:{"Prefer":"return=minimal"}});
      loadPendingRegs(); loadAdminStats();
    } catch(e){ setError("Error: "+e.message); }
  }

  async function rechazarDia(group) {
    if(!window.confirm(`¿Rechazar el registro del ${group.fecha} en ${group.obraNombre}? Los elementos volverán a Pendiente.`)) return;
    try {
      for(const id of group.ids)
        await sbFetch(`registros?id=eq.${id}`,{method:"DELETE",headers:{"Prefer":"return=minimal"}});
      loadPendingRegs();
    } catch(e){ setError("Error: "+e.message); }
  }

  async function crearUsuario() {
    if(!newUser.nombre||!newUser.mail||!newUser.rut) return;
    try {
      await sbFetch("usuarios",{method:"POST",body:JSON.stringify({nombre:newUser.nombre,mail:newUser.mail,rut:newUser.rut})});
      setNewUser({nombre:"",mail:"",rut:""});
      loadUsuarios();
    } catch(e){ setError("Error: "+e.message); }
  }

  async function guardarUsuario(u) {
    try {
      await sbFetch(`usuarios?id=eq.${u.id}`,{method:"PATCH",body:JSON.stringify({nombre:u._nombre||u.nombre,mail:u._mail||u.mail,rut:u._rut||u.rut}),headers:{"Prefer":"return=minimal"}});
      setEditingUser(null);
      loadUsuarios();
    } catch(e){ setError("Error: "+e.message); }
  }

  async function eliminarUsuario(id) {
    if(!window.confirm("¿Eliminar este usuario?")) return;
    try {
      await sbFetch(`usuarios?id=eq.${id}`,{method:"DELETE",headers:{"Prefer":"return=minimal"}});
      loadUsuarios();
    } catch(e){ setError("Error: "+e.message); }
  }

  async function loadAdminStats() {
    setLoadingStats(true);
    try {
      const stats = await Promise.all(obrasActivas.map(async o => {
        const [elems, regs] = await Promise.all([
          (async()=>{
            const all=[];
            let offset=0;
            while(true){
              const batch=await sbFetch(`elementos?obra_id=eq.${o.id}&select=pos,area,tipo,torre,piso&limit=1000&offset=${offset}`);
              all.push(...batch);
              if(batch.length<1000) break;
              offset+=1000;
            }
            return all;
          })(),
          sbFetch(`registros?obra_id=eq.${o.id}&select=fecha,elementos_montados,elementos_recibidos,aprobado`),
        ]);
        const aprobados = regs.filter(r=>r.aprobado);
        const montadosPos = new Set(aprobados.flatMap(r=>r.elementos_montados?r.elementos_montados.split(",").map(p=>p.trim()).filter(Boolean):[]));
        const recibidosPos = new Set(aprobados.flatMap(r=>r.elementos_recibidos?r.elementos_recibidos.split(",").map(p=>p.trim()).filter(Boolean):[]));
        const totalArea = elems.reduce((s,e)=>s+e.area,0);
        const chkM = (e,keys) => keys.has(`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`)||keys.has(`${e.pos}__${e.tipo}`)||keys.has(e.pos);
        const mountedArea = elems.filter(e=>chkM(e,montadosPos)).reduce((s,e)=>s+e.area,0);
        const receivedArea = elems.filter(e=>chkM(e,recibidosPos)||chkM(e,montadosPos)).reduce((s,e)=>s+e.area,0);

        // Weekly breakdown
        const weekMap = {};
        aprobados.forEach(r=>{
          const week = getWeekNumber(r.fecha);
          if(!weekMap[week]) weekMap[week] = 0;
          const elPos = new Set(r.elementos_montados?r.elementos_montados.split(",").map(p=>p.trim()).filter(Boolean):[]);
          weekMap[week] += elems.filter(e=>chkM(e,elPos)).reduce((s,e)=>s+e.area,0);
        });

        return { obra:o, totalArea, mountedArea, receivedArea, pctMounted:totalArea>0?(mountedArea/totalArea)*100:0, pctReceived:totalArea>0?(receivedArea/totalArea)*100:0, weekMap };
      }));

      // Get all weeks
      const allWeeks = [...new Set(stats.flatMap(s=>Object.keys(s.weekMap)))].sort();
      setWeekColumns(allWeeks);
      setAdminStats(stats);
    } catch(e) { setError("Error: "+e.message); }
    setLoadingStats(false);
  }

  async function crearObra() {
    if(!newObra.nombre) return;
    setCreando(true);
    try {
      await sbFetch("obras",{method:"POST",body:JSON.stringify({nombre:newObra.nombre,ubicacion:newObra.ubicacion,fecha_inicio:newObra.fecha_inicio,estado:"activa"})});
      setNewObra({nombre:"",ubicacion:"",fecha_inicio:TODAY});
      onObraCreated();
    } catch(e){ setError("Error: "+e.message); }
    setCreando(false);
  }

  async function cerrarObra(obra) {
    if(!window.confirm(`¿Cerrar la obra "${obra.nombre}"? Ya no se podrán hacer modificaciones.`)) return;
    try {
      await sbFetch(`obras?id=eq.${obra.id}`,{method:"PATCH",body:JSON.stringify({estado:"cerrada"})});
      onObraCreated();
    } catch(e){ setError("Error: "+e.message); }
  }

  async function handleExcelUpload(e) {
    const file = e.target.files[0];
    if(!file||!obraId) return;
    setUploadStatus("Procesando...");
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const elementos = [];
      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
        rows.slice(1).forEach(row=>{
          if(!row[4]) return;
          const tipo = String(row[3]||"").toUpperCase().trim();
          const pos  = String(row[4]||"").trim();
          if(!pos) return;
          let area = 0;
          const areaRaw = row[5];
          if(typeof areaRaw==="number") area=areaRaw;
          else if(typeof areaRaw==="string") area=parseFloat(areaRaw.replace(",","."))||0;
          elementos.push({ obra_id:obraId, lote:String(row[0]||"").trim(), torre:String(row[1]||"").trim(), piso:String(row[2]||"").trim(), tipo, pos, area, estado:"pendiente" });
        });
      });
      let uploaded = 0;
      for(let i=0;i<elementos.length;i+=100){
        const batch = elementos.slice(i,i+100);
        await sbFetch("elementos",{method:"POST",body:JSON.stringify(batch),headers:{"Prefer":"return=minimal"}});
        uploaded += batch.length;
        setUploadStatus(`Cargando... ${uploaded}/${elementos.length}`);
      }
      setUploadStatus(`✓ ${elementos.length} elementos cargados correctamente`);
    } catch(e){ setUploadStatus("Error: "+e.message); }
    e.target.value="";
  }

  async function agregarPrograma() {
    if(!programaObra||!newSemana||!newMeta) return;
    try {
      await sbFetch("programa",{method:"POST",body:JSON.stringify({obra_id:programaObra,semana:newSemana,meta:parseFloat(newMeta)})});
      setNewSemana(""); setNewMeta("");
      loadPrograma();
    } catch(e){ setError("Error: "+e.message); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#e2e8f0" }}>
      <div style={{ background:"#f8fafc", borderBottom:"1px solid #cbd5e1", padding:"14px 28px", display:"flex", alignItems:"center", gap:16 }}>
        <button onClick={onBack} style={btnSecondary}>← Volver</button>
        <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:18, color:"#d97706" }}>⚙ PANEL ADMINISTRADOR</div>
      </div>
      <div style={{ display:"flex", background:"#f8fafc", borderBottom:"1px solid #cbd5e1", padding:"0 28px" }}>
        {[["resumen","Dashboard"],["aprobacion","Aprobaciones"],["obras","Obras"],["usuarios","Usuarios"],["elementos","Elementos"],["programa","Programa"],["historico","Histórico"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ background:"none",border:"none",cursor:"pointer",padding:"12px 16px",color:tab===k?"#d97706":"#64748b",borderBottom:tab===k?"2px solid #d97706":"2px solid transparent",fontFamily:"'DM Mono',monospace",fontSize:11 }}>{l}</button>
        ))}
      </div>

      <div style={{ padding:"24px 28px", maxWidth:1200, margin:"0 auto" }}>

        {/* ── DASHBOARD ── */}
        {tab==="resumen" && (
          <div>
            {loadingStats ? <div style={{ color:"#94a3b8",textAlign:"center",padding:40 }}>Cargando datos…</div> : (
              <>
                {/* Resumen por obra */}
                <Panel title="RESUMEN POR OBRA">
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                    <thead><tr style={{ background:"#f1f5f9" }}>
                      <Th>OBRA</Th><Th>m² TOTAL</Th><Th>m² RECIBIDOS</Th><Th>% RECEPCIÓN</Th><Th>m² MONTADOS</Th><Th>% AVANCE</Th><Th>ACCIÓN</Th>
                    </tr></thead>
                    <tbody>
                      {adminStats.map(s=>(
                        <tr key={s.obra.id} style={{ borderBottom:"1px solid #f1f5f9",background:"#fff" }}>
                          <Td accent="#1e293b">{s.obra.nombre}</Td>
                          <Td>{fmt2(s.totalArea)}</Td>
                          <Td accent="#2563eb">{fmt2(s.receivedArea)}</Td>
                          <Td><ProgressCell pct={s.pctReceived} color="#2563eb"/></Td>
                          <Td accent="#16a34a">{fmt2(s.mountedArea)}</Td>
                          <Td><ProgressCell pct={s.pctMounted} color="#16a34a"/></Td>
                          <Td><button onClick={()=>onViewObra(s.obra)} style={{ ...btnSecondary,padding:"4px 10px",fontSize:10 }}>Ver detalle →</button></Td>
                        </tr>
                      ))}
                      {adminStats.length>1&&(
                        <tr style={{ background:"#f1f5f9",borderTop:"2px solid #cbd5e1",fontWeight:"bold" }}>
                          <Td accent="#d97706">TOTAL</Td>
                          <Td accent="#d97706">{fmt2(adminStats.reduce((s,a)=>s+a.totalArea,0))}</Td>
                          <Td accent="#2563eb">{fmt2(adminStats.reduce((s,a)=>s+a.receivedArea,0))}</Td>
                          <Td></Td>
                          <Td accent="#16a34a">{fmt2(adminStats.reduce((s,a)=>s+a.mountedArea,0))}</Td>
                          <Td></Td><Td></Td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Panel>

                {/* Tabla semanal */}
                {weekColumns.length>0&&(
                  <Panel title="m² MONTADOS POR SEMANA">
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%",borderCollapse:"collapse",fontSize:10 }}>
                        <thead><tr style={{ background:"#f1f5f9" }}>
                          <Th>OBRA</Th>
                          {weekColumns.map(w=><Th key={w}>{w}</Th>)}
                          <th style={{ padding:"6px 8px",textAlign:"left",color:"#d97706",fontSize:9,fontWeight:"bold",borderBottom:"1px solid #cbd5e1",background:"#fef3c7",whiteSpace:"nowrap" }}>ACUMULADO AÑO</th>
                        </tr></thead>
                        <tbody key="admin-weekly">
                          {adminStats.map(s=>(
                            <tr key={s.obra.id} style={{ borderBottom:"1px solid #f1f5f9",background:"#fff" }}>
                              <Td accent="#1e293b">{s.obra.nombre}</Td>
                              {weekColumns.map(w=><td key={w} style={{ padding:"6px 8px",color:s.weekMap[w]>0?"#16a34a":"#94a3b8",fontSize:10,textAlign:"right" }}>{s.weekMap[w]>0?fmt2(s.weekMap[w]):"—"}</td>)}
                              <td style={{ padding:"6px 8px",color:"#d97706",fontSize:10,fontWeight:"bold",textAlign:"right",background:"#fef9c3" }}>{fmt2(Object.values(s.weekMap).reduce((a,b)=>a+b,0))}</td>
                            </tr>
                          ))}
                          {adminStats.length>1&&(
                            <tr style={{ background:"#f1f5f9",borderTop:"2px solid #cbd5e1" }}>
                              <td style={{ padding:"6px 8px",color:"#d97706",fontWeight:"bold",fontSize:10 }}>TOTAL</td>
                              {weekColumns.map(w=>(
                                <td key={w} style={{ padding:"6px 8px",color:"#d97706",fontWeight:"bold",fontSize:10,textAlign:"right" }}>
                                  {fmt2(adminStats.reduce((s,a)=>s+(a.weekMap[w]||0),0))}
                                </td>
                              ))}
                              <td style={{ padding:"6px 8px",color:"#d97706",fontWeight:"bold",fontSize:10,textAlign:"right",background:"#fef9c3" }}>
                                {fmt2(adminStats.reduce((s,a)=>s+Object.values(a.weekMap).reduce((x,y)=>x+y,0),0))}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                )}
              </>
            )}
          </div>
        )}

        {/* ── OBRAS ── */}
        {tab==="obras" && (
          <div>
            <Panel title="CREAR NUEVA OBRA">
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <div><Label>Nombre obra</Label><input value={newObra.nombre} onChange={e=>setNewObra(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Torre A - Santiago" style={inp}/></div>
                <div><Label>Ubicación</Label><input value={newObra.ubicacion} onChange={e=>setNewObra(p=>({...p,ubicacion:e.target.value}))} placeholder="Ej: Las Condes" style={inp}/></div>
                <div><Label>Fecha inicio</Label><input type="date" value={newObra.fecha_inicio} onChange={e=>setNewObra(p=>({...p,fecha_inicio:e.target.value}))} style={inp}/></div>
              </div>
              <button onClick={crearObra} disabled={creando||!newObra.nombre} style={{ ...btnPrimary,marginTop:12 }}>{creando?"Creando...":"+ Crear Obra"}</button>
            </Panel>
            <Panel title="OBRAS ACTIVAS">
              {obrasActivas.length===0&&<div style={{ color:"#94a3b8",fontSize:12 }}>No hay obras activas.</div>}
              {obrasActivas.map(o=>(
                <div key={o.id} style={{ padding:"12px 0",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <div style={{ color:"#1e293b",fontWeight:"bold" }}>{o.nombre}</div>
                    <div style={{ color:"#94a3b8",fontSize:10 }}>{o.ubicacion} · {o.fecha_inicio}</div>
                  </div>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    <button onClick={()=>onViewObra(o)} style={{ ...btnSecondary,padding:"6px 12px",fontSize:10 }}>Ver →</button>
                    <button onClick={()=>cerrarObra(o)} style={{ background:"#fee2e2",color:"#dc2626",border:"1px solid #fecaca",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10 }}>✕ Cerrar Obra</button>
                  </div>
                </div>
              ))}
            </Panel>
          </div>
        )}

        {/* ── ELEMENTOS ── */}
        {tab==="elementos" && (
          <Panel title="CARGAR ELEMENTOS DESDE EXCEL">
            <div style={{ background:"#fef9c3",border:"1px solid #fde68a",borderRadius:6,padding:10,marginBottom:12,fontSize:11,color:"#92400e" }}>
              <b>Formato:</b> Col A=Lote, B=Torre, C=Piso, D=Tipo (MD/MDT/P), E=Posición, F=Área m²<br/>Fila 1=encabezados (se omite). Lote puede estar vacío.
            </div>
            <Label>Obra destino</Label>
            <select value={obraId} onChange={e=>setObraId(e.target.value)} style={inp}>
              {obrasActivas.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <div style={{ background:"#f1f5f9",border:"2px dashed #cbd5e1",borderRadius:8,padding:24,textAlign:"center",marginTop:12 }}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} style={{ display:"none" }}/>
              <button onClick={()=>fileRef.current.click()} style={btnPrimary}>↑ Seleccionar Excel</button>
              {uploadStatus&&<div style={{ marginTop:12,color:uploadStatus.startsWith("✓")?"#16a34a":"#dc2626",fontSize:12 }}>{uploadStatus}</div>}
            </div>
          </Panel>
        )}

        {/* ── PROGRAMA ── */}
        {tab==="programa" && (
          <Panel title="PROGRAMA SEMANAL">
            <Label>Obra</Label>
            <select value={programa.obra_id} onChange={e=>setPrograma(p=>({...p,obra_id:e.target.value}))} style={inp}>
              {obrasActivas.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,marginTop:12,alignItems:"flex-end" }}>
              <div><Label>Semana (ej: 22.2026)</Label><input value={programa.semana} onChange={e=>setPrograma(p=>({...p,semana:e.target.value}))} placeholder="22.2026" style={inp}/></div>
              <div><Label>m² programados</Label><input type="number" value={programa.meta} onChange={e=>setPrograma(p=>({...p,meta:e.target.value}))} placeholder="600" style={inp}/></div>
              <button onClick={agregarPrograma} style={{ ...btnPrimary,marginBottom:1 }}>+</button>
            </div>
            {programaRows.length>0&&(
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,marginTop:16 }}>
                <thead><tr><Th>SEMANA</Th><Th>m² PROG.</Th><Th>ACCIÓN</Th></tr></thead>
                <tbody key="prog-rows">
                  {programaRows.map((r)=>(
                    <tr key={r.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                      <Td accent="#d97706">{r.semana}</Td>
                      <td style={{ padding:"7px 8px" }}>
                        {editingRow===r.id
                          ? <input type="number" defaultValue={r.meta} onChange={e=>r._meta=e.target.value} style={{ ...inp,margin:0,width:100 }}/>
                          : <span style={{ color:"#475569" }}>{r.meta}</span>
                        }
                      </td>
                      <td style={{ padding:"7px 8px" }}>
                        <div style={{ display:"flex",gap:6 }}>
                          {editingRow===r.id ? (
                            <>
                              <button onClick={()=>guardarEdicion(r)} style={{ background:"#dcfce7",color:"#16a34a",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:10 }}>✓ Guardar</button>
                              <button onClick={()=>setEditingRow(null)} style={{ background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:10 }}>✕</button>
                            </>
                          ) : (
                            <>
                              <button onClick={()=>setEditingRow(r.id)} style={{ background:"#fef3c7",color:"#d97706",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:10 }}>✏ Editar</button>
                              <button onClick={()=>eliminarPrograma(r.id)} style={{ background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:10 }}>✕</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        )}

        {/* ── APROBACIONES ── */}
        {tab==="aprobacion" && (
          <Panel title="REGISTROS PENDIENTES DE APROBACIÓN">
            {pendingRegs.length===0&&<div style={{ color:"#94a3b8",fontSize:12,textAlign:"center",padding:20 }}>✓ No hay registros pendientes.</div>}
            {pendingRegs.map((group,gi)=>{
              const totalM=group.registros.reduce((s,r)=>s+(r.elementos_montados?r.elementos_montados.split(",").filter(Boolean).length:0),0);
              const totalR=group.registros.reduce((s,r)=>s+(r.elementos_recibidos?r.elementos_recibidos.split(",").filter(Boolean).length:0),0);
              const totalM2md=group.registros.reduce((s,r)=>s+(r.m2_md||0),0);
              const totalM2p=group.registros.reduce((s,r)=>s+(r.m2_p||0),0);
              return (
                <div key={gi} style={{ border:"1px solid #cbd5e1",borderRadius:8,marginBottom:16,overflow:"hidden" }}>
                  <div style={{ background:"#f1f5f9",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div>
                      <span style={{ fontWeight:"bold",color:"#1e293b",fontSize:13 }}>{group.obraNombre}</span>
                      <span style={{ color:"#94a3b8",fontSize:11,marginLeft:12 }}>{group.fecha} · Semana {getWeekNumber(group.fecha)}</span>
                    </div>
                    <div style={{ display:"flex",gap:8 }}>
                      <button onClick={()=>aprobarDia(group)} style={{ background:"#dcfce7",color:"#16a34a",border:"1px solid #16a34a44",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:"bold" }}>✓ Aprobar</button>
                      <button onClick={()=>rechazarDia(group)} style={{ background:"#fee2e2",color:"#dc2626",border:"1px solid #dc262644",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11 }}>✕ Rechazar</button>
                    </div>
                  </div>
                  <div style={{ padding:"12px 16px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
                    <MiniStat label="Recibidos" value={totalR} color="#2563eb" small/>
                    <MiniStat label="Montados" value={totalM} color="#16a34a" small/>
                    <MiniStat label="m² MD/MDT" value={fmt2(totalM2md)} color="#16a34a" small/>
                    <MiniStat label="m² P" value={fmt2(totalM2p)} color="#2563eb" small/>
                  </div>
                  {group.registros.some(r=>r.incidencias)&&(
                    <div style={{ padding:"8px 16px",borderTop:"1px solid #f1f5f9",fontSize:11,color:"#64748b",fontStyle:"italic" }}>
                      "{group.registros.find(r=>r.incidencias)?.incidencias}"
                    </div>
                  )}
                </div>
              );
            })}
          </Panel>
        )}

        {/* ── USUARIOS ── */}
        {tab==="usuarios" && (
          <div>
            <Panel title="CREAR USUARIO">
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
                <div><Label>Nombre</Label><input value={newUser.nombre} onChange={e=>setNewUser(p=>({...p,nombre:e.target.value}))} placeholder="Juan Pérez" style={inp}/></div>
                <div><Label>Mail</Label><input type="email" value={newUser.mail} onChange={e=>setNewUser(p=>({...p,mail:e.target.value}))} placeholder="juan@empresa.cl" style={inp}/></div>
                <div><Label>RUT (sin puntos, con guión)</Label><input value={newUser.rut} onChange={e=>setNewUser(p=>({...p,rut:e.target.value}))} placeholder="12345678-9" style={inp}/></div>
              </div>
              <button onClick={crearUsuario} disabled={!newUser.nombre||!newUser.mail||!newUser.rut} style={{ ...btnPrimary,marginTop:12 }}>+ Crear Usuario</button>
            </Panel>
            <Panel title="USUARIOS REGISTRADOS">
              {usuarios.length===0&&<div style={{ color:"#94a3b8",fontSize:12 }}>No hay usuarios registrados.</div>}
              {usuarios.map(u=>(
                <div key={u.id} style={{ padding:"12px 0",borderBottom:"1px solid #f1f5f9" }}>
                  {editingUser===u.id ? (
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:8,alignItems:"flex-end" }}>
                      <div><Label>Nombre</Label><input defaultValue={u.nombre} onChange={e=>u._nombre=e.target.value} style={inp}/></div>
                      <div><Label>Mail</Label><input defaultValue={u.mail} onChange={e=>u._mail=e.target.value} style={inp}/></div>
                      <div><Label>RUT</Label><input defaultValue={u.rut} onChange={e=>u._rut=e.target.value} style={inp}/></div>
                      <div style={{ display:"flex",gap:6,paddingBottom:2 }}>
                        <button onClick={()=>guardarUsuario(u)} style={{ background:"#dcfce7",color:"#16a34a",border:"none",borderRadius:6,padding:"8px 12px",cursor:"pointer",fontSize:11 }}>✓</button>
                        <button onClick={()=>setEditingUser(null)} style={{ background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:6,padding:"8px 12px",cursor:"pointer",fontSize:11 }}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <div>
                        <div style={{ color:"#1e293b",fontWeight:"bold" }}>{u.nombre}</div>
                        <div style={{ color:"#94a3b8",fontSize:10 }}>{u.mail} · RUT: {u.rut}</div>
                      </div>
                      <div style={{ display:"flex",gap:6 }}>
                        <button onClick={()=>{ u._nombre=u.nombre; u._mail=u.mail; u._rut=u.rut; setEditingUser(u.id); }} style={{ background:"#fef3c7",color:"#d97706",border:"none",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10 }}>✏ Editar</button>
                        <button onClick={()=>eliminarUsuario(u.id)} style={{ background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10 }}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </Panel>
            <Panel title="ADMINISTRADORES">
              <div style={{ fontSize:11,color:"#64748b",marginBottom:12 }}>Los administradores acceden con PIN. PIN actual: <span style={{ color:"#d97706",fontWeight:"bold" }}>configurado en el código</span></div>
              <div style={{ background:"#fef9c3",border:"1px solid #fde68a",borderRadius:6,padding:10,fontSize:11,color:"#92400e" }}>
                Para cambiar el PIN de administrador, editá la constante <b>ADMIN_PIN</b> en el archivo App.jsx y hacé deploy.
              </div>
            </Panel>
          </div>
        )}

        {/* ── HISTÓRICO ── */}
        {tab==="historico" && (
          <Panel title="OBRAS CERRADAS — ARCHIVO HISTÓRICO">
            {obrasCerradas.length===0&&<div style={{ color:"#94a3b8",fontSize:12,textAlign:"center",padding:20 }}>No hay obras cerradas aún.</div>}
            {obrasCerradas.map(o=>(
              <div key={o.id} style={{ padding:"12px 0",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div>
                  <div style={{ color:"#1e293b",fontWeight:"bold" }}>{o.nombre}</div>
                  <div style={{ color:"#94a3b8",fontSize:10 }}>{o.ubicacion} · {o.fecha_inicio}</div>
                </div>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <span style={{ fontSize:9,color:"#64748b",border:"1px solid #cbd5e1",padding:"2px 8px",borderRadius:10 }}>CERRADA</span>
                  <button onClick={()=>onViewObra(o)} style={{ ...btnSecondary,padding:"6px 12px",fontSize:10 }}>Ver histórico →</button>
                </div>
              </div>
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}

// ── Obra View ─────────────────────────────────────────────────────────────────
function ObraView({ obra, onBack, setError, isAdmin, currentUser, onObraUpdated }) {
  const [elements, setElements] = useState([]);
  const [logs, setLogs] = useState([]);
  const [programa, setPrograma] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [personal, setPersonal] = useState(defaultPersonal());
  const [note, setNote] = useState("");
  const [activeTab, setActiveTab] = useState("registro");
  const [selectedWeek, setSelectedWeek] = useState(getWeekNumber(TODAY));

  // Per-element selection: { pos -> "recibido" | "montado" | "ambos" | null }
  const [elementActions, setElementActions] = useState({});

  // Filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterTipo,   setFilterTipo]   = useState("TODOS");
  const [filterTorre,  setFilterTorre]  = useState("TODAS");
  const [filterPiso,   setFilterPiso]   = useState("TODOS");
  const [filterLote,   setFilterLote]   = useState("TODOS");
  const [filterEstado, setFilterEstado] = useState("TODOS");
  const [sortCol, setSortCol] = useState("torre");
  const [sortDir, setSortDir] = useState("asc");

  const isClosed = obra.estado === "cerrada";

  useEffect(()=>{ loadData(); },[obra.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [elemData,regData,progData] = await Promise.all([
        (async () => {
          const all = [];
          let offset = 0;
          while(true) {
            const batch = await sbFetch(`elementos?obra_id=eq.${obra.id}&select=*&limit=1000&offset=${offset}`);
            all.push(...batch);
            if(batch.length < 1000) break;
            offset += 1000;
          }
          return all;
        })(),
        sbFetch(`registros?obra_id=eq.${obra.id}&select=*&order=fecha.asc`),
        sbFetch(`programa?obra_id=eq.${obra.id}&select=*&order=semana.asc`),
      ]);
      setElements(elemData.map(e=>({pos:e.pos,lote:e.lote||"",torre:e.torre||"",piso:e.piso||"",tipo:e.tipo,area:e.area||0,estado:e.estado||"pendiente",id:e.id})));
      const expanded=[];
      regData.forEach(row=>{
        // Keys may be "pos__tipo" (new format) or just "pos" (old format)
        // For old format, try to find the element and reconstruct the key
        const rawMontados=(row.elementos_montados||"").split(",").map(p=>p.trim()).filter(Boolean);
        const rawRecibidos=(row.elementos_recibidos||"").split(",").map(p=>p.trim()).filter(Boolean);
        expanded.push({date:row.fecha,montados:rawMontados,recibidos:rawRecibidos,aprobado:row.aprobado===true||row.aprobado==="true",personal:{coordinadores:row.coordinadores||0,calidad:row.calidad||0,gruas:row.gruas||0,lideres:row.lideres||0,montajistas:row.montajistas||0,ayudantes:row.ayudantes||0},note:row.incidencias||""});
      });
      setLogs(expanded);
      setPrograma(progData);
    } catch(e){ setError("Error: "+e.message); }
    setLoading(false);
  }

  const montadosPos     = useMemo(()=>new Set(logs.filter(l=>l.aprobado).flatMap(l=>l.montados)),[logs]);
  // recibidosPos = ALL elements that appeared in recibidos (including those also mounted)
  const recibidosPos    = useMemo(()=>new Set([
    ...logs.filter(l=>l.aprobado).flatMap(l=>l.recibidos),
    ...logs.filter(l=>l.aprobado).flatMap(l=>l.montados), // montados also count as received
  ]),[logs]);
  const montadosPending = useMemo(()=>new Set(logs.filter(l=>!l.aprobado).flatMap(l=>l.montados)),[logs]);
  const recibidosPending= useMemo(()=>new Set(logs.filter(l=>!l.aprobado).flatMap(l=>l.recibidos)),[logs]);

  const elK        = (el) => `${el.torre}__${el.piso}__${el.pos}__${el.tipo}`;
  const isMontado  = (el) => { const k=elK(el); return montadosPos.has(k)||montadosPending.has(k); };
  const isRecibido = (el) => { const k=elK(el); return recibidosPos.has(k)||recibidosPending.has(k); };
  const isPendingM = (el) => montadosPending.has(elK(el));
  const isPendingR = (el) => recibidosPending.has(elK(el));

  function getEstado(key) {
    if(montadosPos.has(key)||montadosPending.has(key)) return "montado";
    if(recibidosPos.has(key)||recibidosPending.has(key)) return "recibido";
    return "pendiente";
  }

  // Toggle element action — key is pos__tipo
  function toggleAction(el, action) {
    const key = `${el.torre}__${el.piso}__${el.pos}__${el.tipo}`;
    if(isClosed && !isAdmin) return;
    const estado = getEstado(key);
    if(estado==="montado" && !isAdmin) return;
    setElementActions(prev=>{
      const current = prev[key] || null;
      if(action==="recibido") {
        if(current==="recibido") return {...prev,[key]:null};
        if(current==="ambos") return {...prev,[key]:"montado"};
        if(current==="montado") return {...prev,[key]:"ambos"};
        return {...prev,[key]:"recibido"};
      }
      if(action==="montado") {
        if(current==="montado") return {...prev,[key]:null};
        if(current==="ambos") return {...prev,[key]:"recibido"};
        if(current==="recibido") return {...prev,[key]:"ambos"};
        return {...prev,[key]:"ambos"}; // auto-select recibido too
      }
      return prev;
    });
  }

  async function registrar() {
    // Keys are pos__tipo to avoid collision between MD/P with same number
    const toReceive = Object.entries(elementActions).filter(([key,action])=>(action==="recibido"||action==="ambos")&&!recibidosPos.has(key)&&!montadosPos.has(key)&&!recibidosPending.has(key)&&!montadosPending.has(key)).map(([key])=>key);
    const toMount   = Object.entries(elementActions).filter(([key,action])=>(action==="montado"||action==="ambos")&&!montadosPos.has(key)&&!montadosPending.has(key)).map(([key])=>key);
    if(toReceive.length===0&&toMount.length===0) return;
    setSaving(true);
    try {
      // toMount/toReceive contain pos__tipo keys
      const mdEls = elements.filter(e=>toMount.includes(`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`)&&TIPOS_MD.includes(e.tipo));
      const pEls  = elements.filter(e=>toMount.includes(`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`)&&e.tipo==="P");
      await sbFetch("registros",{method:"POST",body:JSON.stringify({
        fecha:selectedDate,obra_id:obra.id,
        coordinadores:personal.coordinadores,calidad:personal.calidad,gruas:personal.gruas,lideres:personal.lideres,montajistas:personal.montajistas,ayudantes:personal.ayudantes,
        m2_md:mdEls.reduce((s,e)=>s+e.area,0),m2_p:pEls.reduce((s,e)=>s+e.area,0),
        elementos_montados:toMount.join(","),elementos_recibidos:toReceive.join(","),
        incidencias:note,registrado_por:currentUser?.nombre||"encargado",
        aprobado:false,
      })});
      setLogs(prev=>[...prev,{date:selectedDate,montados:toMount,recibidos:toReceive,aprobado:false,personal:{...personal},note}]);
      setElementActions({});
      setNote("");
    } catch(e){ setError("Error: "+e.message); }
    setSaving(false);
  }

  async function eliminarRegistroDia(fecha) {
    if(!window.confirm(`¿Eliminar todos los registros del ${fecha}? Los elementos volverán a su estado anterior.`)) return;
    try {
      // Delete from DB
      await sbFetch(`registros?obra_id=eq.${obra.id}&fecha=eq.${fecha}`,{method:"DELETE",headers:{"Prefer":"return=minimal"}});
      // Remove from local state
      setLogs(prev=>prev.filter(l=>l.date!==fecha));
    } catch(e){ setError("Error: "+e.message); }
  }

  async function desmontarAdmin(pos, tipo) {
    if(!isAdmin) return;
    if(!window.confirm(`¿${tipo==="montado"?"Desmontar":"Desrecibir"} posición ${pos}?`)) return;
    if(tipo==="montado") setLogs(prev=>prev.map(l=>({...l,montados:l.montados.filter(p=>p!==pos&&p!==`${pos}__${elements.find(e=>e.pos===pos)?.tipo||''}`)  })));
    else setLogs(prev=>prev.map(l=>({...l,recibidos:l.recibidos.filter(p=>p!==pos&&!p.startsWith(pos+'__')),montados:l.montados.filter(p=>p!==pos&&!p.startsWith(pos+'__'))})));
  }

  // Stats
  const stats = useMemo(()=>{
    const md=elements.filter(e=>TIPOS_MD.includes(e.tipo));
    const p=elements.filter(e=>e.tipo==="P");
    const mdM=md.filter(e=>isMontado(e));
    const pM=p.filter(e=>isMontado(e));
    // en obra = todos los que tienen algún registro (recibidos o montados)
    const enObra = elements.filter(e=>isRecibido(e)); // recibidosPos now includes montados
    // solo recibidos (no montados aún)
    const soloRecibidos = elements.filter(e=>isRecibido(e)&&!isMontado(e));
    return {
      md:{total:md.length,mounted:mdM.length,areaTotal:md.reduce((s,e)=>s+e.area,0),areaMounted:mdM.reduce((s,e)=>s+e.area,0)},
      p:{total:p.length,mounted:pM.length,areaTotal:p.reduce((s,e)=>s+e.area,0),areaMounted:pM.reduce((s,e)=>s+e.area,0)},
      all:{total:elements.length,mounted:montadosPos.size,areaTotal:elements.reduce((s,e)=>s+e.area,0),areaMounted:[...mdM,...pM].reduce((s,e)=>s+e.area,0)},
      areaReceived:enObra.reduce((s,e)=>s+e.area,0),
      countReceived:soloRecibidos.length,
      areaOnlyReceived:soloRecibidos.reduce((s,e)=>s+e.area,0),
    };
  },[elements,montadosPos,recibidosPos]);

  const pctMD  = stats.md.areaTotal>0?(stats.md.areaMounted/stats.md.areaTotal)*100:0;
  const pctP   = stats.p.areaTotal>0?(stats.p.areaMounted/stats.p.areaTotal)*100:0;
  const pctAll = stats.all.areaTotal>0?(stats.all.areaMounted/stats.all.areaTotal)*100:0;
  const pctRec = stats.all.areaTotal>0?(stats.areaReceived/stats.all.areaTotal)*100:0;

  const dailyStats = useMemo(()=>{
    const map={};
    logs.forEach(l=>{
      if(!map[l.date]) map[l.date]={date:l.date,montados:[],recibidos:[],aprobado:true,personal:l.personal,note:l.note};
      if(!l.aprobado) map[l.date].aprobado=false;
      map[l.date].montados.push(...l.montados);
      map[l.date].recibidos.push(...l.recibidos);
      map[l.date].note=l.note||map[l.date].note;
    });
    return Object.values(map).map(d=>{
      const elems=elements.filter(e=>d.montados.includes(`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`)||d.montados.includes(`${e.pos}__${e.tipo}`)||d.montados.includes(e.pos));
      const mdEl=elems.filter(e=>TIPOS_MD.includes(e.tipo));
      const pEl=elems.filter(e=>e.tipo==="P");
      const areaMD=mdEl.reduce((s,e)=>s+e.area,0);
      const areaP=pEl.reduce((s,e)=>s+e.area,0);
      const areaTotal=areaMD+areaP;
      const areaRecibida=elements.filter(e=>d.recibidos.includes(`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`)||d.recibidos.includes(`${e.pos}__${e.tipo}`)||d.recibidos.includes(e.pos)).reduce((s,e)=>s+e.area,0);
      const p=d.personal;
      const eq=(p.coordinadores||0)+(p.calidad||0)+(p.lideres||0)+(p.montajistas||0)+(p.ayudantes||0);
      const gruas=p.gruas||p.lideres||1;
      return {...d,areaMD,areaP,areaTotal,areaRecibida,rendLider:p.lideres>0?areaTotal/p.lideres:0,rendMontajista:p.montajistas>0?areaTotal/p.montajistas:0,rendAyudante:p.ayudantes>0?areaTotal/p.ayudantes:0,rendEquipo:gruas>0?areaTotal/gruas:0,equipoCompleto:eq,gruas};
    }).sort((a,b)=>b.date.localeCompare(a.date));
  },[logs,elements]);

  const weeklyStats = useMemo(()=>{
    const map={};
    dailyStats.filter(d=>d.aprobado).forEach(d=>{
      const week=getWeekNumber(d.date);
      if(!map[week]) map[week]={week,days:[],montados:[],recibidos:[]};
      map[week].days.push(d);
      map[week].montados.push(...d.montados);
      map[week].recibidos.push(...d.recibidos);
    });
    return Object.values(map).map(w=>{
      const diasEfectivos=Math.min(5, w.days.filter(d=>d.areaTotal>0).length);
      const areaTotal=w.days.reduce((s,d)=>s+d.areaTotal,0);
      const areaMD=w.days.reduce((s,d)=>s+d.areaMD,0);
      const areaP=w.days.reduce((s,d)=>s+d.areaP,0);
      const areaRecibida=w.days.reduce((s,d)=>s+d.areaRecibida,0);
      const avgP={
        coordinadores:Math.round(w.days.reduce((s,d)=>s+d.personal.coordinadores,0)/w.days.length),
        calidad:Math.round(w.days.reduce((s,d)=>s+d.personal.calidad,0)/w.days.length),
        gruas:Math.round(w.days.reduce((s,d)=>s+(d.personal.gruas||d.personal.lideres||1),0)/w.days.length),
        lideres:Math.round(w.days.reduce((s,d)=>s+d.personal.lideres,0)/w.days.length),
        montajistas:Math.round(w.days.reduce((s,d)=>s+d.personal.montajistas,0)/w.days.length),
        ayudantes:Math.round(w.days.reduce((s,d)=>s+d.personal.ayudantes,0)/w.days.length),
      };
      const eq=Object.values(avgP).reduce((a,b)=>a+b,0);
      const gruas=avgP.gruas||avgP.lideres||1;
      return {week:w.week,diasEfectivos,areaTotal,areaMD,areaP,areaRecibida,montados:w.montados,recibidos:w.recibidos,personal:avgP,equipoCompleto:eq,gruas,rendLider:avgP.lideres>0?areaTotal/avgP.lideres:0,rendMontajista:avgP.montajistas>0?areaTotal/avgP.montajistas:0,rendAyudante:avgP.ayudantes>0?areaTotal/avgP.ayudantes:0,rendEquipo:gruas>0?areaTotal/gruas:0,rendEfectivo:diasEfectivos>0?areaTotal/diasEfectivos:0};
    }).sort((a,b)=>b.week.localeCompare(a.week));
  },[dailyStats]);

  const programaAcum = useMemo(()=>{
    let acum=0;
    return programa.map(p=>{
      acum+=p.meta;
      const realAcum=weeklyStats.filter(w=>w.week<=p.semana).reduce((s,w)=>s+w.areaTotal,0);
      return {semana:p.semana,acum,real:weeklyStats.find(w=>w.week===p.semana)?realAcum:null};
    });
  },[programa,weeklyStats]);

  const lotes  = useMemo(()=>["TODOS",...new Set(elements.map(e=>e.lote).filter(Boolean).sort())]  ,[elements]);
  const torres = useMemo(()=>["TODAS",...new Set(elements.map(e=>e.torre).filter(Boolean).sort())] ,[elements]);
  const pisos  = useMemo(()=>["TODOS",...new Set(elements.map(e=>e.piso).filter(Boolean).sort())]  ,[elements]);

  const filteredElements = useMemo(()=>{
    return elements.filter(e=>{
      const s=filterSearch.toLowerCase();
      const ms=e.pos.toLowerCase().includes(s)||e.torre.toLowerCase().includes(s)||e.piso.toLowerCase().includes(s);
      const mt=filterTipo==="TODOS"||e.tipo===filterTipo;
      const mtr=filterTorre==="TODAS"||e.torre===filterTorre;
      const mp=filterPiso==="TODOS"||e.piso===filterPiso;
      const ml=filterLote==="TODOS"||e.lote===filterLote;
      const est=getEstado(`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`);
      const me=filterEstado==="TODOS"||est===filterEstado;
      return ms&&mt&&mtr&&mp&&ml&&me;
    }).sort((a,b)=>{
      let av=a[sortCol],bv=b[sortCol];
      if(typeof av==="string") av=av.toLowerCase();
      if(typeof bv==="string") bv=bv.toLowerCase();
      return sortDir==="asc"?(av<bv?-1:av>bv?1:0):(av<bv?1:av>bv?-1:0);
    });
  },[elements,filterSearch,filterTipo,filterTorre,filterPiso,filterLote,filterEstado,sortCol,sortDir,montadosPos,recibidosPos]);

  function handleSort(col){ if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortCol(col);setSortDir("asc");} }

  // Auto-select most recent week if selectedWeek has no data
  const currentWeekData = weeklyStats.find(w=>w.week===selectedWeek) || weeklyStats[0];
  const effectiveWeek = currentWeekData?.week || selectedWeek;

  // Count pending actions
  const pendingCount = Object.values(elementActions).filter(v=>v!==null).length;
  const toReceiveCount = Object.entries(elementActions).filter(([pos,a])=>(a==="recibido"||a==="ambos")&&!recibidosPos.has(pos)&&!montadosPos.has(pos)).length;
  const toMountCount = Object.entries(elementActions).filter(([pos,a])=>(a==="montado"||a==="ambos")&&!montadosPos.has(pos)).length;

  if(loading) return <LoadingScreen/>;

  return (
    <div style={{ minHeight:"100vh", background:"#e2e8f0" }}>
      {/* Header */}
      <div style={{ background:"#f8fafc", borderBottom:"1px solid #cbd5e1", padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <button onClick={onBack} style={btnSecondary}>← {isAdmin?"Admin":"Obras"}</button>
          <div>
            <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:18, color:"#d97706" }}>
              ◈ {obra.nombre}
              {isClosed && <span style={{ marginLeft:8,fontSize:11,color:"#64748b",border:"1px solid #cbd5e1",padding:"2px 8px",borderRadius:10 }}>CERRADA</span>}
              {isAdmin && <span style={{ marginLeft:8,fontSize:10,color:"#7c3aed",border:"1px solid #7c3aed33",padding:"2px 8px",borderRadius:10 }}>ADMIN</span>}
            </div>
            <div style={{ fontSize:9, color:"#94a3b8", letterSpacing:2 }}>{obra.ubicacion} · SEMANA {getWeekNumber(TODAY)}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <KPIBox label="RECIBIDOS" value={fmtPct(pctRec)} sub={fmt2(stats.areaReceived)+" m²"} color="#2563eb"/>
          <KPIBox label="MD/MDT" value={fmtPct(pctMD)} sub={fmt2(stats.md.areaMounted)+"/"+fmt2(stats.md.areaTotal)+" m²"} color="#16a34a"/>
          <KPIBox label="PRELOSAS" value={fmtPct(pctP)} sub={fmt2(stats.p.areaMounted)+"/"+fmt2(stats.p.areaTotal)+" m²"} color="#2563eb"/>
          <KPIBox label="AVANCE TOTAL" value={fmtPct(pctAll)} sub={fmt2(stats.all.areaMounted)+"/"+fmt2(stats.all.areaTotal)+" m²"} color="#d97706" large/>
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
        {[["registro","▷ REGISTRO"],["elementos","◈ ELEMENTOS"],["historial","◫ HISTORIAL"],["semanal","◷ SEMANAL"],["curvaS","↗ GRÁFICOS"]].map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k)} style={{ background:"none",border:"none",cursor:"pointer",padding:"12px 16px",color:activeTab===k?"#d97706":"#64748b",borderBottom:activeTab===k?"2px solid #d97706":"2px solid transparent",fontFamily:"'DM Mono',monospace",fontSize:11 }}>{l}</button>
        ))}
      </div>

      <div style={{ padding:"20px 28px", maxWidth:1400, margin:"0 auto" }}>

        {/* ── REGISTRO ── */}
        {activeTab==="registro" && (
          <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:20 }}>
            <div>
              {isClosed ? (
                <Panel title="OBRA CERRADA">
                  <div style={{ color:"#94a3b8",fontSize:12,textAlign:"center",padding:20 }}>Esta obra está cerrada.<br/>No se pueden registrar cambios.</div>
                </Panel>
              ) : (
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
                  {pendingCount>0&&(
                    <div style={{ background:"#f1f5f9",borderRadius:6,padding:10,marginTop:8,border:"1px solid #cbd5e1",fontSize:11 }}>
                      <div style={{ color:"#94a3b8",fontSize:9,letterSpacing:2,marginBottom:6 }}>SELECCIÓN ACTUAL</div>
                      {toReceiveCount>0&&<div style={{ color:"#2563eb" }}>📦 Recibir: {toReceiveCount} elementos</div>}
                      {toMountCount>0&&<div style={{ color:"#16a34a",marginTop:3 }}>🔧 Montar: {toMountCount} elementos</div>}
                    </div>
                  )}
                  <button onClick={registrar} disabled={pendingCount===0||saving} style={{ width:"100%",padding:"11px",marginTop:10,background:pendingCount>0&&!saving?"#d97706":"#e2e8f0",color:pendingCount>0&&!saving?"#fff":"#94a3b8",border:"none",borderRadius:6,cursor:pendingCount>0&&!saving?"pointer":"default",fontFamily:"'Archivo Black',sans-serif",fontSize:13,letterSpacing:1 }}>
                    {saving?"GUARDANDO…":"▷ REGISTRAR"}
                  </button>
                </Panel>
              )}
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

            {/* Tabla con doble checkbox */}
            <Panel title="ELEMENTOS">
              {/* Filtros */}
              <div style={{ display:"flex",gap:6,marginBottom:10,flexWrap:"wrap" }}>
                <input placeholder="Buscar posición…" value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} style={{ ...inp,flex:1,margin:0,minWidth:120 }}/>
                <select value={filterLote}   onChange={e=>setFilterLote(e.target.value)}   style={{ ...inp,margin:0,width:"auto" }}>{lotes.map(t=><option key={t} value={t}>{t==="TODOS"?"Lote: Todos":t}</option>)}</select>
                <select value={filterTorre}  onChange={e=>setFilterTorre(e.target.value)}  style={{ ...inp,margin:0,width:"auto" }}>{torres.map(t=><option key={t} value={t}>{t==="TODAS"?"Torre: Todas":t}</option>)}</select>
                <select value={filterPiso}   onChange={e=>setFilterPiso(e.target.value)}   style={{ ...inp,margin:0,width:"auto" }}>{pisos.map(t=><option key={t} value={t}>{t==="TODOS"?"Piso: Todos":t}</option>)}</select>
                <select value={filterTipo}   onChange={e=>setFilterTipo(e.target.value)}   style={{ ...inp,margin:0,width:"auto" }}>{["TODOS","MD","MDT","P"].map(t=><option key={t} value={t}>{t==="TODOS"?"Tipo: Todos":t}</option>)}</select>
                <select value={filterEstado} onChange={e=>setFilterEstado(e.target.value)} style={{ ...inp,margin:0,width:"auto" }}>{["TODOS","pendiente","recibido","montado"].map(t=><option key={t} value={t}>{t==="TODOS"?"Estado: Todos":t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select>
              </div>
              <div style={{ maxHeight:560,overflowY:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                  <thead>
                    <tr style={{ background:"#f1f5f9",position:"sticky",top:0 }}>
                      <th style={{ padding:"7px 6px",color:"#2563eb",fontSize:9,borderBottom:"1px solid #cbd5e1",background:"#f1f5f9",textAlign:"center",whiteSpace:"nowrap" }}>📦 REC.</th>
                      <th style={{ padding:"7px 6px",color:"#16a34a",fontSize:9,borderBottom:"1px solid #cbd5e1",background:"#f1f5f9",textAlign:"center",whiteSpace:"nowrap" }}>🔧 MONT.</th>
                      {[["lote","LOTE"],["torre","TORRE"],["piso","PISO"],["tipo","TIPO"],["pos","POSICIÓN"],["area","ÁREA m²"],["estado","ESTADO"]].map(([col,label])=>(
                        <th key={col} onClick={()=>handleSort(col)} style={{ padding:"7px 8px",textAlign:"left",color:"#64748b",fontSize:9,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",borderBottom:"1px solid #cbd5e1",background:"#f1f5f9" }}>
                          {label} {sortCol===col?(sortDir==="asc"?"↑":"↓"):""}
                        </th>
                      ))}
                      {isAdmin&&<th style={{ padding:"7px 8px",color:"#7c3aed",fontSize:9,borderBottom:"1px solid #cbd5e1",background:"#f1f5f9" }}>ADMIN</th>}
                    </tr>
                  </thead>
                  <tbody key={`${filterTorre}-${filterTipo}-${filterPiso}-${filterLote}-${filterEstado}-${filterSearch}`}>
                    {filteredElements.map(el=>{
                      const elKey = `${el.torre}__${el.piso}__${el.pos}__${el.tipo}`;
                      const estado = getEstado(elKey);
                      const isMounted  = estado==="montado";
                      const isReceived = estado==="recibido";
                      const action = elementActions[elKey]||null;
                      const selR = action==="recibido"||action==="ambos";
                      const selM = action==="montado"||action==="ambos";
                      const tc = TIPOS_MD.includes(el.tipo)?"#16a34a":"#2563eb";

                      let rowBg = "#ffffff";
                      if(isMounted) rowBg="#f0fdf4";
                      else if(isReceived) rowBg="#eff6ff";
                      if(selR||selM) rowBg="#fef9c3";

                      const estadoConfig = {
                        montado:  {bg:"#dcfce7",color:"#16a34a",label:"MONTADO"},
                        recibido: {bg:"#dbeafe",color:"#2563eb",label:"RECIBIDO"},
                        pendiente:{bg:"#f1f5f9",color:"#94a3b8",label:"PENDIENTE"},
                      }[estado];

                      const canToggleR = !isClosed&&!isMounted&&!isReceived;
                      const canToggleM = !isClosed&&!isMounted;

                      return (
                        <tr key={el.pos} style={{ background:rowBg,borderBottom:"1px solid #f1f5f9" }}>
                          {/* Recibido checkbox */}
                          <td style={{ padding:"6px",textAlign:"center" }}>
                            {(isReceived||isMounted) ? (
                              <div style={{ width:18,height:18,borderRadius:3,background:"#2563eb",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto" }}>
                                <span style={{ fontSize:11,color:"#fff" }}>✓</span>
                              </div>
                            ) : (
                              <div onClick={()=>canToggleR&&toggleAction(el,"recibido")} style={{ width:18,height:18,borderRadius:3,border:`2px solid ${selR?"#2563eb":"#cbd5e1"}`,background:selR?"#dbeafe":"transparent",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",cursor:canToggleR?"pointer":"default" }}>
                                {selR&&<span style={{ fontSize:11,color:"#2563eb" }}>✓</span>}
                              </div>
                            )}
                          </td>
                          {/* Montado checkbox */}
                          <td style={{ padding:"6px",textAlign:"center" }}>
                            {isMounted ? (
                              <div style={{ width:18,height:18,borderRadius:3,background:"#16a34a",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto" }}>
                                <span style={{ fontSize:11,color:"#fff" }}>✓</span>
                              </div>
                            ) : (
                              <div onClick={()=>canToggleM&&toggleAction(el,"montado")} style={{ width:18,height:18,borderRadius:3,border:`2px solid ${selM?"#16a34a":"#cbd5e1"}`,background:selM?"#dcfce7":"transparent",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",cursor:canToggleM?"pointer":"default" }}>
                                {selM&&<span style={{ fontSize:11,color:"#16a34a" }}>✓</span>}
                              </div>
                            )}
                          </td>
                          <Td>{el.lote}</Td>
                          <Td>{el.torre}</Td>
                          <Td>{el.piso}</Td>
                          <Td><span style={{ color:tc,fontSize:9,border:`1px solid ${tc}33`,padding:"1px 5px",borderRadius:8 }}>{el.tipo}</span></Td>
                          <Td accent="#1e293b">{el.pos}</Td>
                          <Td accent={TIPOS_MD.includes(el.tipo)?"#16a34a":"#2563eb"}>{fmt2(el.area)}</Td>
                          <Td><span style={{ padding:"1px 7px",borderRadius:10,fontSize:9,background:estadoConfig.bg,color:estadoConfig.color,border:`1px solid ${estadoConfig.color}33` }}>{estadoConfig.label}</span></Td>
                          {isAdmin&&(
                            <td style={{ padding:"6px 8px" }}>
                              <div style={{ display:"flex",gap:4 }}>
                                {(isReceived||isMounted)&&<button onClick={()=>desmontarAdmin(el.pos,"recibido")} style={{ background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:4,padding:"2px 6px",cursor:"pointer",fontSize:9 }}>↩ rec.</button>}
                                {isMounted&&<button onClick={()=>desmontarAdmin(el.pos,"montado")} style={{ background:"#fef3c7",color:"#d97706",border:"none",borderRadius:4,padding:"2px 6px",cursor:"pointer",fontSize:9 }}>↩ mont.</button>}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:"#f1f5f9",borderTop:"1px solid #cbd5e1" }}>
                      <td colSpan={7} style={{ padding:"8px 10px",color:"#64748b",textAlign:"right",fontSize:10 }}>TOTAL FILTRADO</td>
                      <td style={{ padding:"8px 10px",color:"#d97706",fontWeight:"bold",fontSize:11 }}>{fmt2(filteredElements.reduce((s,e)=>s+e.area,0))} m²</td>
                      <td colSpan={isAdmin?2:1}/>
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
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16 }}>
              <StatCard label="PENDIENTES" value={elements.filter(e=>getEstado(`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`)==="pendiente").length} sub={fmt2(elements.filter(e=>getEstado(`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`)==="pendiente").reduce((s,e)=>s+e.area,0))+" m²"} color="#94a3b8"/>
              <StatCard label="RECIBIDOS EN OBRA" value={elements.filter(e=>getEstado(`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`)!=="pendiente").length} sub={fmt2(elements.filter(e=>getEstado(`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`)!=="pendiente").reduce((s,e)=>s+e.area,0))+" m²"} color="#2563eb"/>
              <StatCard label="MONTADOS" value={montadosPos.size} sub={fmt2(stats.all.areaMounted)+" m²"} color="#16a34a"/>
              <StatCard label="% AVANCE" value={fmtPct(pctAll)} sub={fmt2(stats.all.areaMounted)+" / "+fmt2(stats.all.areaTotal)+" m²"} color="#d97706"/>
            </div>
            <div style={{ display:"flex",gap:6,marginBottom:14,flexWrap:"wrap" }}>
              <input placeholder="Buscar…" value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} style={{ ...inp,width:160,margin:0 }}/>
              <select value={filterLote}   onChange={e=>setFilterLote(e.target.value)}   style={{ ...inp,margin:0,width:"auto" }}>{lotes.map(t=><option key={t} value={t}>{t==="TODOS"?"Lote: Todos":t}</option>)}</select>
              <select value={filterTorre}  onChange={e=>setFilterTorre(e.target.value)}  style={{ ...inp,margin:0,width:"auto" }}>{torres.map(t=><option key={t} value={t}>{t==="TODAS"?"Torre: Todas":t}</option>)}</select>
              <select value={filterPiso}   onChange={e=>setFilterPiso(e.target.value)}   style={{ ...inp,margin:0,width:"auto" }}>{pisos.map(t=><option key={t} value={t}>{t==="TODOS"?"Piso: Todos":t}</option>)}</select>
              <select value={filterTipo}   onChange={e=>setFilterTipo(e.target.value)}   style={{ ...inp,margin:0,width:"auto" }}>{["TODOS","MD","MDT","P"].map(t=><option key={t} value={t}>{t==="TODOS"?"Tipo: Todos":t}</option>)}</select>
              <select value={filterEstado} onChange={e=>setFilterEstado(e.target.value)} style={{ ...inp,margin:0,width:"auto" }}>{["TODOS","pendiente","recibido","montado"].map(t=><option key={t} value={t}>{t==="TODOS"?"Estado: Todos":t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                <thead>
                  <tr style={{ background:"#f1f5f9" }}>
                    {[["lote","LOTE"],["torre","TORRE"],["piso","PISO"],["tipo","TIPO"],["pos","POSICIÓN"],["area","ÁREA m²"]].map(([col,label])=>(
                      <th key={col} onClick={()=>handleSort(col)} style={{ padding:"7px 8px",textAlign:"left",color:"#64748b",fontSize:9,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",borderBottom:"1px solid #cbd5e1",background:"#f1f5f9" }}>
                        {label} {sortCol===col?(sortDir==="asc"?"↑":"↓"):""}
                      </th>
                    ))}
                    <Th>ESTADO</Th><Th>F. RECEPCIÓN</Th><Th>F. MONTAJE</Th>
                    {isAdmin&&<Th>ADMIN</Th>}
                  </tr>
                </thead>
                <tbody key={`elem-${filterTorre}-${filterTipo}-${filterPiso}-${filterLote}-${filterEstado}-${filterSearch}`}>
                  {filteredElements.map(el=>{
                    const estado=getEstado(`${el.torre}__${el.piso}__${el.pos}__${el.tipo}`);
                    const logR=logs.find(l=>l.aprobado&&(l.recibidos.includes(`${el.torre}__${el.piso}__${el.pos}__${el.tipo}`)||l.recibidos.includes(`${el.pos}__${el.tipo}`)||l.recibidos.includes(el.pos)));
                    const logM=logs.find(l=>l.aprobado&&(l.montados.includes(`${el.torre}__${el.piso}__${el.pos}__${el.tipo}`)||l.montados.includes(`${el.pos}__${el.tipo}`)||l.montados.includes(el.pos)));
                    const tc=TIPOS_MD.includes(el.tipo)?"#16a34a":"#2563eb";
                    const estadoConfig={montado:{bg:"#dcfce7",color:"#16a34a",label:"MONTADO"},recibido:{bg:"#dbeafe",color:"#2563eb",label:"RECIBIDO"},pendiente:{bg:"#f1f5f9",color:"#94a3b8",label:"PENDIENTE"}}[estado];
                    return (
                      <tr key={el.pos} style={{ borderBottom:"1px solid #f1f5f9",background:"#ffffff" }}>
                        <Td>{el.lote}</Td><Td>{el.torre}</Td><Td>{el.piso}</Td>
                        <Td><span style={{ color:tc,fontSize:9,border:`1px solid ${tc}33`,padding:"1px 5px",borderRadius:8 }}>{el.tipo}</span></Td>
                        <Td accent="#1e293b">{el.pos}</Td>
                        <Td accent={TIPOS_MD.includes(el.tipo)?"#16a34a":"#2563eb"}>{fmt2(el.area)}</Td>
                        <Td><span style={{ padding:"1px 7px",borderRadius:10,fontSize:9,background:estadoConfig.bg,color:estadoConfig.color,border:`1px solid ${estadoConfig.color}33` }}>{estadoConfig.label}</span></Td>
                        <Td>{logR?.date||""}</Td>
                        <Td>{logM?.date||""}</Td>
                        {isAdmin&&(
                          <td style={{ padding:"6px 8px" }}>
                            <div style={{ display:"flex",gap:4 }}>
                              {(estado==="recibido"||estado==="montado")&&<button onClick={()=>desmontarAdmin(el.pos,"recibido")} style={{ background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:4,padding:"2px 6px",cursor:"pointer",fontSize:9 }}>↩ rec.</button>}
                              {estado==="montado"&&<button onClick={()=>desmontarAdmin(el.pos,"montado")} style={{ background:"#fef3c7",color:"#d97706",border:"none",borderRadius:4,padding:"2px 6px",cursor:"pointer",fontSize:9 }}>↩ mont.</button>}
                            </div>
                          </td>
                        )}
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
                    <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                      <span style={{ color:"#94a3b8",fontSize:10 }}>Sem. {getWeekNumber(d.date)}</span>
                      <span style={{ fontSize:9,padding:"1px 6px",borderRadius:8,background:d.aprobado?"#dcfce7":"#fef9c3",color:d.aprobado?"#16a34a":"#d97706" }}>{d.aprobado?"✓ Aprobado":"⏳ Pendiente"}</span>
                      {isAdmin&&<button onClick={()=>eliminarRegistroDia(d.date)} style={{ background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:9 }}>✕ Eliminar</button>}
                    </div>
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
            <Panel title="AVANCE POR TORRE Y PISO">
              {[...new Set(elements.map(e=>`${e.torre}||${e.piso}`).filter(Boolean))].sort().map(key=>{
                const [torre,piso] = key.split("||");
                const elems=elements.filter(e=>e.torre===torre&&e.piso===piso);
                const mounted=elems.filter(e=>isMontado(e));
                const areaTotal=elems.reduce((s,e)=>s+e.area,0);
                const areaMounted=mounted.reduce((s,e)=>s+e.area,0);
                const p=areaTotal>0?(areaMounted/areaTotal)*100:0;
                const color = p>=75?"#16a34a":p>=40?"#d97706":"#2563eb";
                return (
                  <div key={key} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4 }}>
                      <span style={{ color:"#1e293b",fontWeight:"bold" }}>{torre} <span style={{ color:"#94a3b8",fontWeight:"normal" }}>· {piso}</span></span>
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
                <Label>Semana seleccionada</Label>
                <select value={effectiveWeek} onChange={e=>setSelectedWeek(e.target.value)} style={{ ...inp,width:"auto",margin:0 }}>
                  {weeklyStats.map(w=><option key={w.week} value={w.week}>{w.week}</option>)}
                  {weeklyStats.length===0&&<option value={getWeekNumber(TODAY)}>{getWeekNumber(TODAY)}</option>}
                </select>
              </div>
            </div>
            <Panel title="RESUMEN SEMANAL">
              {weeklyStats.length===0&&<div style={{ color:"#94a3b8",fontSize:12 }}>Sin registros.</div>}
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                <thead><tr style={{ background:"#f1f5f9" }}><Th>SEMANA</Th><Th>m² RECIBIDOS</Th><Th>m² MD/MDT</Th><Th>m² P</Th><Th>m² MONTADOS</Th><Th>DÍAS EFEC.</Th><Th>REND. EFEC.</Th><Th>REND. EQUIPO</Th></tr></thead>
                <tbody key="weekly-stats">
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
          <div>
            <Panel title="m² DESPACHADOS Y MONTADOS — SEMANA ACTUAL">
              <BarrasSemanales dailyStats={dailyStats} elements={elements}/>
            </Panel>
            <Panel title="PLANO DE AVANCE — TORRES Y PISOS">
              <PlanoAvance elements={elements} montadosPos={montadosPos}/>
            </Panel>
            <Panel title="CURVA S — AVANCE PROGRAMADO vs REAL (registros aprobados)">
              {programaAcum.length===0?(
                <div style={{ color:"#94a3b8",fontSize:12,textAlign:"center",padding:40 }}>
                  No hay programa cargado.<br/><span style={{ fontSize:10 }}>El admin puede ingresarlo desde Panel Admin → Programa Semanal.</span>
                </div>
              ):<CurvaS data={programaAcum}/>}
            </Panel>
            <div style={{ background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:10,padding:18,marginBottom:16 }}>
              <div style={{ fontSize:9,letterSpacing:3,color:"#94a3b8",marginBottom:14,borderBottom:"1px solid #e2e8f0",paddingBottom:8 }}>EXPORTAR INFORMES</div>
              <div style={{ display:"flex",gap:10,flexWrap:"wrap",alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:9,color:"#64748b",letterSpacing:1,marginBottom:4 }}>SEMANA</div>
                  <select value={effectiveWeek} onChange={e=>setSelectedWeek(e.target.value)} style={{ ...inp,width:"auto",margin:0 }}>
                    {weeklyStats.map(w=><option key={w.week} value={w.week}>{w.week}</option>)}
                    {weeklyStats.length===0&&<option value={getWeekNumber(TODAY)}>{getWeekNumber(TODAY)}</option>}
                  </select>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                  <div style={{ fontSize:9,color:"#64748b",letterSpacing:1,marginBottom:2 }}>INFORME SEMANAL</div>
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>{ 
                      if(!currentWeekData){
                        const hasPendingThisWeek = dailyStats.some(d=>!d.aprobado&&getWeekNumber(d.date)===selectedWeek);
                        alert(hasPendingThisWeek ? "La semana "+selectedWeek+" tiene registros pendientes de aprobación. El admin debe aprobarlos primero." : "No hay registros aprobados para la semana "+selectedWeek);
                        return;
                      } 
                      generatePDF(currentWeekData,elements,dailyStats,effectiveWeek,obra.nombre,programaAcum,elements); }} style={{ ...btnPrimary,background:"#d97706" }}>↓ PDF SEMANAL</button>
                    <button onClick={()=>{ if(!currentWeekData){alert("Sin datos para esta semana");return;} generateExcel(currentWeekData,elements,dailyStats,effectiveWeek); }} style={{ ...btnPrimary,background:"#16a34a" }}>↓ EXCEL SEMANAL</button>
                  </div>
                </div>
                <div style={{ width:1,background:"#cbd5e1",height:48,margin:"0 4px" }}/>
                <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                  <div style={{ fontSize:9,color:"#64748b",letterSpacing:1,marginBottom:2 }}>REPORTE COMPLETO DE OBRA</div>
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>generateFullPDF(elements,dailyStats,weeklyStats,programaAcum,obra.nombre)} style={{ ...btnPrimary,background:"#7c3aed" }}>↓ PDF COMPLETO</button>
                    <button onClick={()=>generateFullExcel(elements,dailyStats,weeklyStats,obra.nombre)} style={{ ...btnPrimary,background:"#0891b2" }}>↓ EXCEL COMPLETO</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



// ── Plano de Avance ───────────────────────────────────────────────────────────
function PlanoAvance({ elements, montadosPos }) {
  // Get unique torres and pisos from data, sorted
  const torres = [...new Set(elements.map(e=>e.torre).filter(Boolean))].sort();
  const pisos  = [...new Set(elements.map(e=>e.piso).filter(Boolean))].sort((a,b)=>Number(b)-Number(a)); // P4 top, P1 bottom
  const TIPOS  = ['MD','P'];

  if(torres.length===0) return <div style={{ color:"#94a3b8",fontSize:12 }}>Sin elementos cargados.</div>;

  function getCellStatus(torre, piso, tipo) {
    const elems = elements.filter(e=>e.torre===torre&&String(e.piso)===String(piso)&&e.tipo===tipo);
    if(elems.length===0) return 'empty';
    const mounted = elems.filter(e=>
      montadosPos.has(`${e.torre}__${e.piso}__${e.pos}__${e.tipo}`)||
      montadosPos.has(`${e.pos}__${e.tipo}`)||
      montadosPos.has(e.pos)
    );
    const pct = mounted.length/elems.length;
    if(pct===0) return 'pendiente';
    if(pct===1) return 'completo';
    return 'parcial';
  }

  const cellStyle = (status) => ({
    width:28, height:20, borderRadius:3, display:'inline-flex', alignItems:'center', justifyContent:'center',
    fontSize:9, fontFamily:"'DM Mono',monospace", fontWeight:'bold',
    background: status==='completo'?'#16a34a': status==='parcial'?'#86efac': status==='empty'?'transparent':'#e2e8f0',
    color: status==='completo'?'#fff': status==='parcial'?'#166534':'#94a3b8',
    border: `1px solid ${status==='completo'?'#15803d':status==='parcial'?'#4ade80':status==='empty'?'transparent':'#cbd5e1'}`,
  });

  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ borderCollapse:'separate', borderSpacing:3, fontSize:10 }}>
        <thead>
          <tr>
            <th style={{ width:40, textAlign:'left', color:'#94a3b8', fontSize:9, paddingBottom:4 }}>PISO</th>
            {torres.map(t=>(
              <th key={t} colSpan={2} style={{ textAlign:'center', color:'#1e293b', fontSize:13, fontWeight:'bold', paddingBottom:4, minWidth:62 }}>
                {t}
              </th>
            ))}
          </tr>
          <tr>
            <th/>
            {torres.map(t=>TIPOS.map(tip=>(
              <th key={`${t}-${tip}`} style={{ textAlign:'center', color:tip==='MD'?'#16a34a':'#2563eb', fontSize:8, paddingBottom:6, width:28 }}>{tip}</th>
            )))}
          </tr>
        </thead>
        <tbody>
          {pisos.map(piso=>(
            <tr key={piso}>
              <td style={{ color:'#64748b', fontSize:10, fontWeight:'bold', paddingRight:8, textAlign:'right' }}>P{piso}</td>
              {torres.map(t=>TIPOS.map(tipo=>{
                const status = getCellStatus(t, piso, tipo);
                return (
                  <td key={`${t}-${piso}-${tipo}`} style={{ padding:1 }}>
                    <div style={cellStyle(status)}>
                      {status==='completo'?'✓': status==='parcial'?'~':''}
                    </div>
                  </td>
                );
              }))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display:'flex', gap:16, marginTop:12, fontSize:10, color:'#64748b' }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <div style={{ width:16,height:12,background:'#16a34a',borderRadius:2 }}/> Completo (100%)
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <div style={{ width:16,height:12,background:'#86efac',borderRadius:2 }}/> Parcial
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <div style={{ width:16,height:12,background:'#e2e8f0',borderRadius:2 }}/> Pendiente
        </div>
      </div>
    </div>
  );
}

// ── Barras Semanales ──────────────────────────────────────────────────────────
function BarrasSemanales({ dailyStats, elements }) {
  const canvasRef = useRef();

  // Get current week days (Mon-Sun)
  const weekDays = useMemo(() => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day===0?6:day-1));
    const days = [];
    for(let i=0;i<7;i++){
      const d = new Date(monday);
      d.setDate(monday.getDate()+i);
      days.push(d.toISOString().slice(0,10));
    }
    return days;
  }, []);

  const dayLabels = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

  const data = useMemo(() => {
    return weekDays.map((date, i) => {
      const dayLogs = dailyStats.find(d=>d.date===date);
      return {
        date,
        label: dayLabels[i],
        montados: dayLogs ? dayLogs.areaTotal : 0,
        recibidos: dayLogs ? dayLogs.areaRecibida : 0,
        isToday: date === new Date().toISOString().slice(0,10),
        hasDat: !!dayLogs,
      };
    });
  }, [weekDays, dailyStats]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W=rect.width, H=rect.height;
    const padL=55, padR=20, padT=30, padB=45;
    const cW=W-padL-padR, cH=H-padT-padB;
    const maxVal = Math.max(...data.flatMap(d=>[d.montados,d.recibidos]), 100);

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,W,H);

    // Grid lines
    for(let i=0;i<=4;i++){
      const y=padT+(cH/4)*i;
      ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+cW,y); ctx.stroke();
      ctx.fillStyle='#64748b'; ctx.font='10px monospace'; ctx.textAlign='right';
      ctx.fillText(Math.round(maxVal*(1-i/4)),padL-6,y+4);
    }

    // Bars
    const barW = (cW/7)*0.35;
    const gap  = (cW/7)*0.08;

    data.forEach((d,i) => {
      const x = padL + (i/7)*cW + (cW/7)*0.12;

      // Today highlight
      if(d.isToday){
        ctx.fillStyle='rgba(251,191,36,0.08)';
        ctx.fillRect(padL+(i/7)*cW, padT, cW/7, cH);
      }

      // Recibidos bar (blue)
      if(d.recibidos>0){
        const bh = (d.recibidos/maxVal)*cH;
        ctx.fillStyle='#3b82f6';
        ctx.fillRect(x, padT+cH-bh, barW, bh);
        ctx.fillStyle='#2563eb';
        ctx.font='bold 9px monospace'; ctx.textAlign='center';
        ctx.fillText(Math.round(d.recibidos), x+barW/2, padT+cH-bh-4);
      }

      // Montados bar (green)
      if(d.montados>0){
        const bh = (d.montados/maxVal)*cH;
        ctx.fillStyle='#22c55e';
        ctx.fillRect(x+barW+gap, padT+cH-bh, barW, bh);
        ctx.fillStyle='#16a34a';
        ctx.font='bold 9px monospace'; ctx.textAlign='center';
        ctx.fillText(Math.round(d.montados), x+barW+gap+barW/2, padT+cH-bh-4);
      }

      // X label
      ctx.fillStyle = d.isToday?'#d97706':'#64748b';
      ctx.font = d.isToday?'bold 11px monospace':'11px monospace';
      ctx.textAlign='center';
      ctx.fillText(d.label, padL+(i/7)*cW+(cW/14), padT+cH+16);
      ctx.font='9px monospace'; ctx.fillStyle='#94a3b8';
      const dp=d.date.split('-');
      const meses=['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      ctx.fillText(dp[2]+' '+meses[parseInt(dp[1])], padL+(i/7)*cW+(cW/14), padT+cH+28);
    });

    // Legend
    ctx.fillStyle='#3b82f6'; ctx.fillRect(padL,12,12,10);
    ctx.fillStyle='#64748b'; ctx.font='10px monospace'; ctx.textAlign='left';
    ctx.fillText('Despachados m²',padL+16,21);
    ctx.fillStyle='#22c55e'; ctx.fillRect(padL+140,12,12,10);
    ctx.fillStyle='#64748b'; ctx.fillText('Montados m²',padL+156,21);

    // Y label
    ctx.save(); ctx.translate(12,padT+cH/2); ctx.rotate(-Math.PI/2);
    ctx.fillStyle='#94a3b8'; ctx.font='10px monospace'; ctx.textAlign='center';
    ctx.fillText('m²', 0, 0); ctx.restore();

  }, [data]);

  const totRec = data.reduce((s,d)=>s+d.recibidos,0);
  const totMon = data.reduce((s,d)=>s+d.montados,0);

  return (
    <div>
      <div style={{ display:"flex",gap:12,marginBottom:12,flexWrap:"wrap" }}>
        <div style={{ background:"#dbeafe",border:"1px solid #2563eb33",borderRadius:8,padding:"10px 20px",textAlign:"center" }}>
          <div style={{ fontSize:9,color:"#2563eb",letterSpacing:2 }}>DESPACHADOS SEMANA</div>
          <div style={{ fontSize:20,fontFamily:"'Archivo Black',sans-serif",color:"#2563eb" }}>{Math.round(totRec)} m²</div>
        </div>
        <div style={{ background:"#dcfce7",border:"1px solid #16a34a33",borderRadius:8,padding:"10px 20px",textAlign:"center" }}>
          <div style={{ fontSize:9,color:"#16a34a",letterSpacing:2 }}>MONTADOS SEMANA</div>
          <div style={{ fontSize:20,fontFamily:"'Archivo Black',sans-serif",color:"#16a34a" }}>{Math.round(totMon)} m²</div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width:"100%",maxWidth:780,height:260,display:"block" }}/>
    </div>
  );
}

// ── Curva S (dual axis) ─────────────────────────────────────────────────────
function CurvaS({ data }) {
  const canvasRef = useRef();
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width*dpr; canvas.height=rect.height*dpr;
    const ctx=canvas.getContext('2d');
    ctx.scale(dpr,dpr);
    const W=rect.width, H=rect.height;
    const padL=90, padR=70, padT=36, padB=52;
    const cW=W-padL-padR, cH=H-padT-padB;
    const n=data.length; if(n===0) return;

    const weeklyProg = data.map((d,i)=> d.acum-(i>0?data[i-1].acum:0));
    const weeklyReal = data.map((d,i)=> d.real!==null?(d.real-(i>0&&data[i-1].real!==null?data[i-1].real:0)):null);
    const maxAcumRaw = Math.max(...data.map(d=>Math.max(d.acum,d.real||0)),100);
    const maxWeekRaw = Math.max(...weeklyProg,...weeklyReal.filter(v=>v!==null),10);
    const maxAcum = Math.ceil(maxAcumRaw/2500)*2500;
    const maxWeek = Math.ceil(maxWeekRaw/500)*500;

    ctx.clearRect(0,0,W,H); ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,W,H);

    // Draw grid based on acum ticks (2500 intervals) — right axis
    const numTicksAcum = Math.round(maxAcum/2500);
    for(let i=0;i<=numTicksAcum;i++){
      const y=padT+cH*(1-i/numTicksAcum);
      ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+cW,y); ctx.stroke();
      ctx.fillStyle='#2563eb'; ctx.font='10px monospace'; ctx.textAlign='left';
      ctx.fillText(i*2500,padL+cW+6,y+4);
    }
    // Left axis ticks (500 intervals) — draw line + labels well outside bars
    const numTicksWeek = Math.round(maxWeek/500);
    // Draw left axis line
    ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+cH); ctx.stroke();
    for(let i=0;i<=numTicksWeek;i++){
      const y=padT+cH*(1-i/numTicksWeek);
      // Tick mark
      ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(padL-4,y); ctx.lineTo(padL,y); ctx.stroke();
      // Label
      ctx.fillStyle='#475569'; ctx.font='10px monospace'; ctx.textAlign='right';
      ctx.fillText(i*500, padL-8, y+4);
    }

    // xPos: add inner margin so bars never overflow outside chart area
    const innerPad = Math.max(20, cW/(n*2));
    const xPos=(i)=>padL+innerPad+(n<=1?cW-innerPad*2:((cW-innerPad*2)/(n<=1?1:n-1))*i);
    data.forEach((d,i)=>{
      const x=xPos(i);
      ctx.strokeStyle='#f1f5f9'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,padT+cH); ctx.stroke();
      // Calculate week start date (Monday) for label
      const [wNum,wYear]=d.semana.split('.').map(Number);
      const jan1=new Date(wYear,0,1);
      const weekStart=new Date(jan1.getTime()+((wNum-1)*7-(jan1.getDay()||7)+1)*86400000);
      const dd=String(weekStart.getDate()).padStart(2,'0');
      const mm=String(weekStart.getMonth()+1).padStart(2,'0');
      ctx.fillStyle='#475569'; ctx.font='10px monospace'; ctx.textAlign='center';
      ctx.fillText(dd+'-'+mm,x,padT+cH+16);
      ctx.fillStyle='#94a3b8'; ctx.font='9px monospace';
      ctx.fillText('S'+wNum,x,padT+cH+28);
    });

    // Bar width based on available space per week
    const slotW = cW/(n||1);
    const bW = Math.max(8, slotW*0.22);
    const bGap = Math.max(2, slotW*0.04);

    // Bars programado semanal (orange) - draw bars first, then labels
    data.forEach((d,i)=>{
      const cx=xPos(i);
      const h=(weeklyProg[i]/maxWeek)*cH;
      const x=cx - bGap/2 - bW;
      ctx.fillStyle='rgba(251,146,60,0.65)';
      ctx.fillRect(x, padT+cH-h, bW, h);
    });

    // Bars real semanal (green)
    data.forEach((d,i)=>{
      if(weeklyReal[i]===null||weeklyReal[i]<=0) return;
      const cx=xPos(i);
      const h=(weeklyReal[i]/maxWeek)*cH;
      const x=cx + bGap/2;
      ctx.fillStyle='rgba(74,222,128,0.85)';
      ctx.fillRect(x, padT+cH-h, bW, h);
    });

    // Bar value labels - draw inside bar near top, small and unobtrusive
    data.forEach((d,i)=>{
      const cx=xPos(i);
      if(weeklyProg[i]>0){
        const h=(weeklyProg[i]/maxWeek)*cH;
        const x=cx - bGap/2 - bW;
        ctx.fillStyle='rgba(120,53,15,0.8)'; ctx.font='8px monospace'; ctx.textAlign='center';
        ctx.fillText(Math.round(weeklyProg[i]), x+bW/2, padT+cH-h+10);
      }
      if(weeklyReal[i]!==null&&weeklyReal[i]>0){
        const h=(weeklyReal[i]/maxWeek)*cH;
        const x=cx + bGap/2;
        ctx.fillStyle='rgba(20,83,45,0.9)'; ctx.font='8px monospace'; ctx.textAlign='center';
        ctx.fillText(Math.round(weeklyReal[i]), x+bW/2, padT+cH-h+10);
      }
    });

    // Acum programado fill + line
    ctx.beginPath();
    data.forEach((d,i)=>{ const x=xPos(i),y=padT+cH*(1-d.acum/maxAcum); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
    ctx.lineTo(xPos(n-1),padT+cH); ctx.lineTo(xPos(0),padT+cH); ctx.closePath();
    ctx.fillStyle='rgba(37,99,235,0.06)'; ctx.fill();
    ctx.strokeStyle='#2563eb'; ctx.lineWidth=2.5; ctx.setLineDash([6,3]);
    ctx.beginPath();
    data.forEach((d,i)=>{ const x=xPos(i),y=padT+cH*(1-d.acum/maxAcum); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
    ctx.stroke(); ctx.setLineDash([]);

    // Acum real line + dots
    const realPts=data.filter(d=>d.real!==null);
    if(realPts.length>0){
      ctx.strokeStyle='#16a34a'; ctx.lineWidth=3;
      ctx.beginPath();
      realPts.forEach((d,ii)=>{ const i=data.indexOf(d),x=xPos(i),y=padT+cH*(1-d.real/maxAcum); ii===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
      ctx.stroke();
      realPts.forEach(d=>{
        const i=data.indexOf(d),x=xPos(i),y=padT+cH*(1-d.real/maxAcum);
        ctx.fillStyle='#16a34a'; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill();
        const dev=d.real-d.acum;
        ctx.fillStyle=dev>=0?'#16a34a':'#dc2626'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
        ctx.fillText((dev>=0?'+':'')+Math.round(dev),x,y-11);
      });
    }

    // Legend
    const ly=16;
    ctx.fillStyle='rgba(251,146,60,0.7)'; ctx.fillRect(padL,ly,11,9);
    ctx.fillStyle='#64748b'; ctx.font='10px monospace'; ctx.textAlign='left'; ctx.fillText('Prog. sem.',padL+15,ly+8);
    ctx.fillStyle='rgba(74,222,128,0.85)'; ctx.fillRect(padL+88,ly,11,9);
    ctx.fillStyle='#64748b'; ctx.fillText('Real sem.',padL+103,ly+8);
    ctx.strokeStyle='#2563eb'; ctx.lineWidth=2; ctx.setLineDash([5,3]);
    ctx.beginPath(); ctx.moveTo(padL+180,ly+4); ctx.lineTo(padL+200,ly+4); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='#2563eb'; ctx.fillText('Acum. prog.',padL+204,ly+8);
    ctx.strokeStyle='#16a34a'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(padL+298,ly+4); ctx.lineTo(padL+318,ly+4); ctx.stroke();
    ctx.fillStyle='#16a34a'; ctx.fillText('Acum. real',padL+322,ly+8);

    // Axis labels
    ctx.fillStyle='#64748b'; ctx.font='10px monospace'; ctx.textAlign='center';
    ctx.fillText('Semana',padL+cW/2,H-3);
    ctx.save(); ctx.translate(12,padT+cH/2); ctx.rotate(-Math.PI/2);
    ctx.fillStyle='#475569'; ctx.font='10px monospace'; ctx.fillText('m² semanal',0,0); ctx.restore();
    ctx.save(); ctx.translate(W-10,padT+cH/2); ctx.rotate(Math.PI/2);
    ctx.fillStyle='#2563eb'; ctx.font='10px monospace'; ctx.fillText('m² acumulado',0,0); ctx.restore();
  },[data]);
  return <canvas id="curvaSMain" ref={canvasRef} style={{ width:"100%",maxWidth:820,height:360,display:"block",margin:"0 auto" }}/>;
}

// ── Shared Components ─────────────────────────────────────────────────────────
function LoadingScreen() { return <div style={{ minHeight:"100vh",background:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center" }}><div style={{ color:"#d97706",fontFamily:"'DM Mono',monospace",fontSize:14,letterSpacing:3 }}>CARGANDO…</div></div>; }
function ErrorBar({msg,onClose}) { return <div style={{ background:"#fee2e2",color:"#dc2626",padding:"10px 28px",fontSize:11,borderBottom:"1px solid #fecaca" }}>⚠ {msg} <button onClick={onClose} style={{ marginLeft:12,background:"none",border:"none",color:"#dc2626",cursor:"pointer" }}>×</button></div>; }
function Panel({title,children}) { return <div style={{ background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:10,padding:18,marginBottom:16 }}><div style={{ fontSize:9,letterSpacing:3,color:"#94a3b8",marginBottom:12,borderBottom:"1px solid #e2e8f0",paddingBottom:8 }}>{title}</div>{children}</div>; }
function KPIBox({label,value,sub,color,large}) { return <div style={{ textAlign:"right",minWidth:130,background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:"8px 12px" }}><div style={{ fontSize:8,color:"#94a3b8",letterSpacing:1,marginBottom:2 }}>{label}</div><div style={{ fontSize:large?20:15,fontFamily:"'Archivo Black',sans-serif",color }}>{value}</div><div style={{ fontSize:9,color:"#94a3b8" }}>{sub}</div></div>; }
function StatCard({label,value,sub,color}) { return <div style={{ background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:8,padding:"12px 16px",textAlign:"center" }}><div style={{ fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:4 }}>{label}</div><div style={{ fontSize:22,fontFamily:"'Archivo Black',sans-serif",color }}>{value}</div><div style={{ fontSize:10,color:"#64748b",marginTop:2 }}>{sub}</div></div>; }
function ProgressCell({pct,color}) { return <div style={{ display:"flex",alignItems:"center",gap:6 }}><div style={{ flex:1,background:"#f1f5f9",borderRadius:4,height:6 }}><div style={{ width:pct+"%",height:6,background:color,borderRadius:4,transition:"width 0.5s" }}/></div><span style={{ fontSize:10,color,minWidth:36 }}>{fmtPct(pct)}</span></div>; }
function Label({children}) { return <div style={{ fontSize:9,color:"#64748b",letterSpacing:2,marginBottom:3,marginTop:10 }}>{children}</div>; }
function Th({children}) { return <th style={{ padding:"6px 8px",textAlign:"left",color:"#64748b",fontSize:9,letterSpacing:1,borderBottom:"1px solid #cbd5e1",whiteSpace:"nowrap",background:"#f1f5f9" }}>{children}</th>; }
function Td({children,accent}) { return <td style={{ padding:"7px 8px",color:accent||"#475569",fontSize:11,whiteSpace:"nowrap" }}>{children}</td>; }
function MiniStat({label,value,color,small}) { return <div style={{ marginBottom:small?0:4 }}><div style={{ fontSize:8,color:"#94a3b8",letterSpacing:2 }}>{label}</div><div style={{ fontSize:small?11:13,fontFamily:"'Archivo Black',sans-serif",color:color||"#1e293b" }}>{value}</div></div>; }
const btnPrimary   = { background:"#d97706",color:"#fff",border:"none",borderRadius:6,padding:"8px 16px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:1 };
const btnSecondary = { background:"#f1f5f9",color:"#475569",border:"1px solid #cbd5e1",borderRadius:6,padding:"8px 14px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11 };
const inp = { width:"100%",padding:"7px 9px",background:"#f8fafc",border:"1px solid #cbd5e1",borderRadius:5,color:"#1e293b",fontFamily:"'DM Mono',monospace",fontSize:11,boxSizing:"border-box" };
