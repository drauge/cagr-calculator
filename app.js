const fmtEUR=new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const fmtEUR2=new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2});

const scenarioDefs=[
  {key:"A",label:"A. Repay LT + buy AMS",color:"#1f77b4",enabled:true},
  {key:"B",label:"B. Sell LT + buy AMS",color:"#ff7f0e",enabled:true},
  {key:"C",label:"C. Keep LT + no AMS",color:"#2ca02c",enabled:true},
  {key:"D",label:"D. Sell LT + ETF only",color:"#9467bd",enabled:true},
];

const BOX3_2025_SINGLE_ALLOWANCE=57684;
const BOX3_2025_PARTNER_ALLOWANCE=115368;
const BOX3_2025_SINGLE_DEBT_THRESHOLD=3800;
const BOX3_2025_PARTNER_DEBT_THRESHOLD=7600;

const EUROZONE_HISTORICAL_INFLATION={
  1997:0.015,1998:0.008,1999:0.017,2000:0.026,2001:0.021,2002:0.023,2003:0.020,2004:0.024,2005:0.023,
  2006:0.019,2007:0.031,2008:0.017,2009:0.009,2010:0.022,2011:0.027,2012:0.022,2013:0.008,2014:-0.002,
  2015:0.002,2016:0.011,2017:0.013,2018:0.015,2019:0.013,2020:-0.003,2021:0.050,2022:0.093,2023:0.029,
  2024:0.024,2025:0.020
};

let activeDetailScenario="A";
let summaryCurrency="EUR";
let fxRates={EUR:1,USD:null,RUB:null};
let fxMeta={USD:"",RUB:""};

function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function inputNumber(id){const el=document.getElementById(id);return el?n(el.value):0}
function inputPct(id){return inputNumber(id)/100}
function dateUTC(s){return new Date(s+"T00:00:00Z")}
function ymToDate(y,m){return new Date(Date.UTC(y,m-1,1))}
function dateYear(s){return dateUTC(s).getUTCFullYear()}
function dateMonth(s){return dateUTC(s).getUTCMonth()+1}
function daysBetween(a,b){return Math.round((dateUTC(b)-dateUTC(a))/(24*3600*1000))}
function monthlyDateByDay(anchor,offset,day){const a=dateUTC(anchor);const d=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+offset,1));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10)}
function tableRows(sel){return Array.from(document.querySelectorAll(`${sel} tbody tr`)).map(r=>Array.from(r.querySelectorAll("input,select")).map(e=>e.value))}
function addInputCell(row,type,value,attrs={}){const td=document.createElement("td"),input=document.createElement("input");input.type=type;input.value=value;Object.entries(attrs).forEach(([k,v])=>input.setAttribute(k,v));input.addEventListener("input",calculate);td.appendChild(input);row.appendChild(td);return input}
function addSelectCell(row,value,values){const td=document.createElement("td"),sel=document.createElement("select");values.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;if(v===value)o.selected=true;sel.appendChild(o)});sel.addEventListener("change",calculate);td.appendChild(sel);row.appendChild(td);return sel}
function addRemoveButton(row){const td=document.createElement("td"),b=document.createElement("button");b.type="button";b.className="secondary";b.textContent="Remove";b.onclick=()=>{row.remove();calculate()};td.appendChild(b);row.appendChild(td)}
function addRateRow({effectiveFrom="2025-08-25",euribor=2.08}={}){const r=document.querySelector("#rateTable tbody").insertRow();addInputCell(r,"date",effectiveFrom);addInputCell(r,"number",euribor,{step:"0.01"});addRemoveButton(r)}
function addEtfContributionRow({amount=0,frequency="Yearly",month=1,startYear=2025,endYear=2045}={}){const r=document.querySelector("#etfContributionTable tbody").insertRow();addInputCell(r,"number",amount,{min:"0",step:"100"});addSelectCell(r,frequency,["Yearly","Monthly"]);addInputCell(r,"number",month,{min:"1",max:"12",step:"1"});addInputCell(r,"number",startYear,{min:"2000",max:"2100"});addInputCell(r,"number",endYear,{min:"2000",max:"2100"});addRemoveButton(r)}
function addLumpContributionRow({amount=0,year=2026,month=1,destination="ETF",description=""}={}){const r=document.querySelector("#lumpContributionTable tbody").insertRow();addInputCell(r,"number",amount,{min:"0",step:"100"});addInputCell(r,"number",year,{min:"2000",max:"2100"});addInputCell(r,"number",month,{min:"1",max:"12"});addSelectCell(r,destination,["ETF","LT repayment"]);addInputCell(r,"text",description);addRemoveButton(r)}

function readModel(){
  const start=Math.round(inputNumber("projectionStartYear")),years=Math.max(1,Math.round(inputNumber("projectionYears")));
  return {
    projectionStartYear:start,projectionYears:years,projectionEndYear:start+years-1,
    etfStartingValue:inputNumber("etfStartingValue"),etfGrossReturn:inputPct("etfGrossReturn"),personalInflation:inputPct("personalInflation"),
    hasFiscalPartner:document.getElementById("hasFiscalPartner")?.checked===true,box3Allowance:inputNumber("box3Allowance"),debtThreshold:inputNumber("debtThreshold"),
    otherAssetsReturn:inputPct("otherAssetsReturn"),debtReturn:inputPct("debtReturn"),box3TaxRate:inputPct("box3TaxRate"),
    ltPropertyValue:inputNumber("ltPropertyValue"),ltDownpayment:inputNumber("ltDownpayment"),ltLoanAmount:inputNumber("ltLoanAmount"),
    ltStartDate:document.getElementById("ltStartDate").value,ltFirstPayment:document.getElementById("ltFirstPayment").value,
    ltPrincipalStart:document.getElementById("ltPrincipalStart").value,ltPaymentDay:Math.round(inputNumber("ltPaymentDay")),ltMonths:Math.round(inputNumber("ltMonths")),
    ltMargin:inputPct("ltMargin"),ltAppreciation:inputPct("ltAppreciation"),
    amsPrice:inputNumber("amsPrice"),amsLoan:inputNumber("amsLoan"),amsRate:inputPct("amsRate"),amsMonths:Math.round(inputNumber("amsMonths")),
    amsAppreciation:inputPct("amsAppreciation"),amsCosts:inputNumber("amsCosts"),ownershipCosts:inputNumber("ownershipCosts"),rentAvoided:inputNumber("rentAvoided"),
    rateSchedule:tableRows("#rateTable").map(([effectiveFrom,euribor])=>({effectiveFrom,euribor:n(euribor)/100})).filter(r=>r.effectiveFrom).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)),
    etfContributions:tableRows("#etfContributionTable").map(([amount,frequency,month,startYear,endYear])=>({amount:n(amount),frequency,month:Math.round(n(month,1)),startYear:Math.round(n(startYear,start)),endYear:Math.round(n(endYear,start))})),
    lumpContributions:tableRows("#lumpContributionTable").map(([amount,year,month,destination,description])=>({amount:n(amount),year:Math.round(n(year,start)),month:Math.round(n(month,1)),destination,description})),
    scenarios:{
      A:{useEtf:document.getElementById("aUseEtf").value==="yes",extraCash:inputNumber("aExtraCash"),earliestPurchaseYear:Math.round(inputNumber("aEarliestPurchaseYear")),maxWaitYear:Math.round(inputNumber("aMaxWaitYear"))},
      B:{saleYear:Math.round(inputNumber("bSaleYear")),purchaseYear:Math.round(inputNumber("bPurchaseYear")),saleCostsPct:inputPct("bSaleCostsPct"),motherReserve:inputNumber("bMotherReserve"),allocate:document.getElementById("bAllocate").value},
      C:{},
      D:{saleYear:Math.round(inputNumber("dSaleYear")),saleCostsPct:inputPct("dSaleCostsPct"),motherReserve:inputNumber("dMotherReserve")}
    }
  };
}

function activeEuribor(model,date){let active=model.rateSchedule[0]?.euribor??0;for(const r of model.rateSchedule)if(r.effectiveFrom<=date)active=r.euribor;return active}
function annuityPayment(principal,monthlyRate,months){if(principal<=0||months<=0)return 0;if(Math.abs(monthlyRate)<1e-12)return principal/months;return principal*monthlyRate/(1-Math.pow(1+monthlyRate,-months))}
function buildLtSchedule(m){const dates=[];for(let i=0;i<m.ltMonths;i++)dates.push(i===0?m.ltFirstPayment:monthlyDateByDay(m.ltFirstPayment,i,m.ltPaymentDay));const startIdx=Math.max(0,dates.findIndex(d=>d>=m.ltPrincipalStart));let balance=m.ltLoanAmount,pmt=0,key=null,rows=[];const lumpMap=new Map();(m.lumpContributions||[]).filter(x=>x.destination==="LT repayment").forEach(x=>{if(x.amount>0){const k=`${x.year}-${String(x.month).padStart(2,"0")}`;lumpMap.set(k,(lumpMap.get(k)||0)+x.amount)}});for(let i=0;i<dates.length;i++){const d=dates[i],prev=i===0?m.ltStartDate:dates[i-1],start=balance,annual=activeEuribor(m,d)+m.ltMargin,mr=annual/12,isPrin=i>=startIdx,idx=Math.max(0,i-startIdx),rem=Math.max(1,m.ltMonths-idx),k=`${Math.floor(idx/6)}-${annual.toFixed(8)}`;if(isPrin&&k!==key){key=k;pmt=annuityPayment(start,mr,rem)}const interest=isPrin?start*mr:start*annual*Math.max(0,daysBetween(prev,d))/365;let principal=isPrin?Math.max(0,Math.min(start,pmt-interest)):0;const ym=`${dateYear(d)}-${String(dateMonth(d)).padStart(2,"0")}`;const lump=Math.max(0,Math.min(start-principal,lumpMap.get(ym)||0));principal+=lump;balance=Math.max(0,start-principal);rows.push({dateString:d,year:dateYear(d),month:dateMonth(d),balanceStart:start,balanceEnd:balance,principal,interest,payment:principal+interest,lumpRepayment:lump})}return rows}
function buildAmsSchedule(m,purchaseYear,loan){let balance=loan,rows=[],mr=m.amsRate/12,pmt=annuityPayment(loan,mr,m.amsMonths);for(let i=0;i<m.amsMonths;i++){const d=ymToDate(purchaseYear,1+i),year=d.getUTCFullYear(),month=d.getUTCMonth()+1,start=balance,interest=start*mr,principal=Math.max(0,Math.min(start,pmt-interest));balance=Math.max(0,start-principal);rows.push({year,month,balanceStart:start,balanceEnd:balance,principal,interest,payment:principal+interest})}return rows}
function debtJan1(schedule,year,initial){const prior=schedule.filter(r=>r.year<year).at(-1);return prior?prior.balanceEnd:initial}
function debtEoy(schedule,year,initial){const prior=schedule.filter(r=>r.year<=year).at(-1);return prior?prior.balanceEnd:initial}
function ltValue(m,year,sold){return sold?0:m.ltPropertyValue*Math.pow(1+m.ltAppreciation,year-m.projectionStartYear+1)}
function amsValue(m,purchaseYear,year,owned){return owned&&year>=purchaseYear?m.amsPrice*Math.pow(1+m.amsAppreciation,year-purchaseYear+1):0}
function etfContribution(m,year,month){return m.etfContributions.reduce((s,c)=>{if(c.amount<=0||year<c.startYear||year>c.endYear)return s;if(c.frequency==="Monthly")return s+c.amount;if(c.frequency==="Yearly"&&c.month===month)return s+c.amount;return s},0)}
function etfLump(m,year,month){return (m.lumpContributions||[]).filter(x=>x.destination==="ETF"&&x.year===year&&x.month===month).reduce((s,x)=>s+x.amount,0)}
function effectiveAllowance(m){return m.hasFiscalPartner?BOX3_2025_PARTNER_ALLOWANCE:m.box3Allowance}
function effectiveDebtThreshold(m){return m.hasFiscalPartner?BOX3_2025_PARTNER_DEBT_THRESHOLD:m.debtThreshold}
function box3Tax(m,etf,ltDebt,ltTaxValue,sold){const deductible=sold?0:Math.max(0,ltDebt-effectiveDebtThreshold(m)),assets=etf+(sold?0:ltTaxValue),base=Math.max(0,assets-deductible),taxable=Math.max(0,base-effectiveAllowance(m)),share=base>0?Math.round((taxable/base)*10000)/10000:0,totalRet=assets*m.otherAssetsReturn-deductible*m.debtReturn,income=Math.max(0,totalRet*share),before=income*m.box3TaxRate,foreignRet=sold?0:ltTaxValue*m.otherAssetsReturn-deductible*m.debtReturn,foreignIncome=Math.max(0,foreignRet*share),relief=income>0?before*Math.min(1,Math.max(0,foreignIncome/income)):0;return Math.max(0,before-relief)}

function estimateScenarioAPurchaseYear(m){const ltSchedule=buildLtSchedule(m),sc=m.scenarios.A;let etf=m.etfStartingValue,monthlyEtf=Math.pow(1+m.etfGrossReturn,1/12)-1;for(let year=m.projectionStartYear;year<=m.projectionEndYear;year++){const debt=debtJan1(ltSchedule,year,m.ltLoanAmount);if(year>=sc.earliestPurchaseYear&&year<=sc.maxWaitYear){const available=(sc.useEtf?etf:0)+sc.extraCash;if(available>=debt)return year}for(let mo=1;mo<=12;mo++){etf+=etfContribution(m,year,mo)+etfLump(m,year,mo);etf+=etf*monthlyEtf}}return null}

function simulateScenario(m,key){
  const ltSchedule=buildLtSchedule(m),monthlyEtf=Math.pow(1+m.etfGrossReturn,1/12)-1,sc=m.scenarios[key];
  if(key==="A"){const dyn=estimateScenarioAPurchaseYear(m);sc.purchaseYear=dyn;sc.repayYear=dyn}
  let etf=m.etfStartingValue,ltSold=false,ltRepaid=false,amsOwned=false,amsSchedule=[],amsLoan=m.amsLoan,reservedDownpayment=0,shortfall=0,totalTax=0,rows=[];
  for(let year=m.projectionStartYear;year<=m.projectionEndYear;year++){
    const events=[];
    const ltDebtJ=ltSold||ltRepaid?0:debtJan1(ltSchedule,year,m.ltLoanAmount);
    const tax=box3Tax(m,etf,ltDebtJ,m.ltPropertyValue,ltSold);
    totalTax+=tax; etf=Math.max(0,etf-tax);

    if(key==="A"&&sc.repayYear===null&&year===m.projectionEndYear&&!ltRepaid){shortfall+=debtJan1(ltSchedule,year,m.ltLoanAmount);events.push("LT repayment target not reached")}
    if(key==="A"&&sc.repayYear!==null&&year===sc.repayYear&&!ltRepaid&&!ltSold){const debt=ltDebtJ,available=(sc.useEtf?etf:0)+sc.extraCash,pay=Math.min(debt,available);if(sc.useEtf)etf=Math.max(0,etf-Math.min(etf,pay));if(pay<debt)shortfall+=debt-pay;ltRepaid=true;events.push(`LT repaid ${fmtEUR2.format(debt)}`);events.push(`AMS purchase year ${sc.purchaseYear}`)}

    if((key==="B"||key==="D")&&year===sc.saleYear&&!ltSold){const saleValue=ltValue(m,year,false),debt=ltDebtJ,cost=saleValue*sc.saleCostsPct,proceeds=Math.max(0,saleValue-debt-cost-sc.motherReserve);ltSold=true;if(key==="B"&&sc.allocate==="Amsterdam downpayment"){reservedDownpayment+=proceeds;events.push(`LT sold; reserved for AMS downpayment ${fmtEUR2.format(proceeds)}`)}else{etf+=proceeds;events.push(`LT sold; proceeds to ETF ${fmtEUR2.format(proceeds)}`)}}

    if((key==="A"||key==="B")&&year===sc.purchaseYear&&!amsOwned){amsOwned=true;const down=Math.min(reservedDownpayment,m.amsLoan);amsLoan=Math.max(0,m.amsLoan-down);reservedDownpayment=Math.max(0,reservedDownpayment-down);amsSchedule=buildAmsSchedule(m,year,amsLoan);etf=Math.max(0,etf-m.amsCosts);events.push(`Amsterdam purchased; mortgage ${fmtEUR2.format(amsLoan)}`)}

    let contrib=0,growth=0;
    for(let mo=1;mo<=12;mo++){
      const add=etfContribution(m,year,mo)+etfLump(m,year,mo);
      if(add>0){etf+=add;contrib+=add}
      if(amsOwned){const netCost=m.ownershipCosts-m.rentAvoided;if(netCost>0)etf=Math.max(0,etf-netCost);else etf+=Math.abs(netCost)}
      const g=etf*monthlyEtf;etf+=g;growth+=g;
    }

    const ltDebt=ltSold||ltRepaid?0:debtEoy(ltSchedule,year,m.ltLoanAmount);
    const ltMarket=ltValue(m,year,ltSold);
    const ltEquity=Math.max(0,ltMarket-ltDebt);
    const amsDebt=amsOwned?debtEoy(amsSchedule,year,amsLoan):0;
    const amsVal=amsValue(m,sc.purchaseYear||year,year,amsOwned);
    const amsEquity=Math.max(0,amsVal-amsDebt);
    const total=etf+ltEquity+amsEquity+reservedDownpayment;
    const real=total/Math.pow(1+m.personalInflation,year-m.projectionStartYear+1);
    rows.push({year,etf,ltMarketValue:ltMarket,ltDebt,ltEquity,amsValue:amsVal,amsDebt,amsEquity,totalNetWorth:total,realNetWorth:real,box3Tax:tax,events:events.join("; ")});
  }
  const last=rows.at(-1);
  let comment=key==="C"?"Baseline; may not satisfy borrowing capacity":key==="B"?"Conditional on mother housing / sale feasibility":key==="D"?"Sell LT, invest proceeds into ETF, no AMS":shortfall>0?"No year found where liquidity can fully repay LT debt within max wait year":`Dynamic repayment/purchase year: ${sc.purchaseYear}`;
  return {key,label:scenarioDefs.find(s=>s.key===key).label,rows,final:last,totalBox3Tax:totalTax,liquidityShortfall:shortfall,feasible:shortfall<=0,comment};
}

function simulateAll(){const model=readModel();return{model,scenarios:{A:simulateScenario(model,"A"),B:simulateScenario(model,"B"),C:simulateScenario(model,"C"),D:simulateScenario(model,"D")}}}

function formatCurrency(value){const rate=fxRates[summaryCurrency]||1;return new Intl.NumberFormat("en-IE",{style:"currency",currency:summaryCurrency,maximumFractionDigits:0}).format(value*rate)}
function setFxStatus(msg){const el=document.getElementById("fxStatus");if(el)el.textContent=msg}
async function loadFxRates(){setFxStatus("Loading FX...");try{const r=await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD",{cache:"no-store"});if(r.ok){const d=await r.json();if(d?.rates?.USD){fxRates.USD=d.rates.USD;fxMeta.USD=`ECB ${d.date||""}`.trim()}}}catch(e){console.warn("Frankfurter USD failed",e)}try{if(!fxRates.USD){const r=await fetch("https://open.er-api.com/v6/latest/EUR",{cache:"no-store"});if(r.ok){const d=await r.json();if(d?.rates?.USD){fxRates.USD=d.rates.USD;fxMeta.USD="fallback"}}}}catch(e){console.warn("USD fallback failed",e)}try{const r=await fetch("https://www.cbr-xml-daily.ru/daily_json.js",{cache:"no-store"});if(r.ok){const d=await r.json();if(d?.Valute?.EUR?.Value){fxRates.RUB=d.Valute.EUR.Value;fxMeta.RUB=`CBR ${String(d.Date||"").slice(0,10)}`.trim()}}}catch(e){console.warn("CBR RUB failed",e)}updateFxStatus();if(window.__lastResult)renderSummary(window.__lastResult)}
function updateFxStatus(){if(summaryCurrency==="EUR"){setFxStatus("EUR base");return}const rate=fxRates[summaryCurrency];if(!rate){setFxStatus(`${summaryCurrency} rate unavailable`);return}setFxStatus(`1 EUR = ${rate.toFixed(summaryCurrency==="RUB"?2:4)} ${summaryCurrency}${fxMeta[summaryCurrency]?" · "+fxMeta[summaryCurrency]:""}`)}
function setupCurrencyToggle(){document.querySelectorAll("#summaryCurrencyToggle .segment").forEach(b=>b.onclick=()=>{summaryCurrency=b.dataset.currency;document.querySelectorAll("#summaryCurrencyToggle .segment").forEach(x=>x.classList.remove("active"));b.classList.add("active");updateFxStatus();if(window.__lastResult)renderSummary(window.__lastResult)})}

function renderSummary(res){
  const body=document.querySelector("#summaryTable tbody");body.innerHTML="";
  Object.values(res.scenarios).forEach(s=>{const r=s.final,tr=body.insertRow();[s.label,s.feasible?"Yes":"No",formatCurrency(r.etf),formatCurrency(r.ltEquity),formatCurrency(r.amsEquity),formatCurrency(r.totalNetWorth),formatCurrency(r.realNetWorth),formatCurrency(s.totalBox3Tax),formatCurrency(s.liquidityShortfall),s.comment].forEach((v,i)=>{const td=tr.insertCell();td.textContent=v;if(i===0||i===9)td.style.textAlign="left"})});
  const feasible=Object.values(res.scenarios).filter(s=>s.feasible);
  const byN=[...feasible].sort((a,b)=>b.final.totalNetWorth-a.final.totalNetWorth)[0],byR=[...feasible].sort((a,b)=>b.final.realNetWorth-a.final.realNetWorth)[0],byL=[...feasible].sort((a,b)=>b.final.etf-a.final.etf)[0];
  document.getElementById("bestNominal").textContent=byN?`${byN.label}: ${formatCurrency(byN.final.totalNetWorth)}`:"No feasible scenario";
  document.getElementById("bestReal").textContent=byR?`${byR.label}: ${formatCurrency(byR.final.realNetWorth)}`:"No feasible scenario";
  document.getElementById("bestLiquidity").textContent=byL?`${byL.label}: ${formatCurrency(byL.final.etf)}`:"No feasible scenario";
}

function renderDetails(res){const body=document.querySelector("#detailsTable tbody");body.innerHTML="";res.scenarios[activeDetailScenario].rows.forEach(r=>{const tr=body.insertRow();[r.year,fmtEUR.format(r.etf),fmtEUR.format(r.ltMarketValue),fmtEUR.format(r.ltDebt),fmtEUR.format(r.ltEquity),fmtEUR.format(r.amsValue),fmtEUR.format(r.amsDebt),fmtEUR.format(r.amsEquity),fmtEUR.format(r.totalNetWorth),fmtEUR.format(r.realNetWorth),fmtEUR.format(r.box3Tax),r.events].forEach((v,i)=>{const td=tr.insertCell();td.textContent=v;if(i===0||i===11)td.style.textAlign="left"})})}
function renderChartControls(){const c=document.getElementById("chartControls");c.innerHTML="";scenarioDefs.forEach(s=>{const l=document.createElement("label");l.className="chart-control";const cb=document.createElement("input");cb.type="checkbox";cb.checked=s.enabled;cb.onchange=()=>{s.enabled=cb.checked;if(window.__lastResult)renderChart(window.__lastResult)};const sw=document.createElement("span");sw.className="swatch";sw.style.background=s.color;const t=document.createElement("span");t.textContent=s.label;l.append(cb,sw,t);c.appendChild(l)})}
function svgEl(tag,attrs={}){const e=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));return e}
function niceCeil(v){if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v))),n=v/p;return(n<=1?1:n<=2?2:n<=5?5:10)*p}
function renderChart(res){const svg=document.getElementById("chart");svg.innerHTML="";const rect=svg.getBoundingClientRect(),w=Math.max(680,rect.width||1000),h=Math.max(340,rect.height||420);svg.setAttribute("viewBox",`0 0 ${w} ${h}`);const m={top:24,right:28,bottom:46,left:92},pw=w-m.left-m.right,ph=h-m.top-m.bottom,enabled=scenarioDefs.filter(s=>s.enabled);if(!enabled.length)return;const rows=enabled.flatMap(d=>res.scenarios[d.key].rows),years=rows.map(r=>r.year),vals=rows.map(r=>r.totalNetWorth),xMin=Math.min(...years),xMax=Math.max(...years),yMax=niceCeil(Math.max(...vals)),xr=Math.max(1,xMax-xMin);const xs=y=>m.left+((y-xMin)/xr)*pw,ys=v=>m.top+((yMax-v)/yMax)*ph;for(let i=0;i<=5;i++){const val=yMax*i/5,y=ys(val);svg.appendChild(svgEl("line",{x1:m.left,y1:y,x2:w-m.right,y2:y,class:"chart-grid"}));const lab=svgEl("text",{x:m.left-10,y:y+4,"text-anchor":"end",class:"chart-label"});lab.textContent=fmtEUR.format(val);svg.appendChild(lab)}svg.append(svgEl("line",{x1:m.left,y1:m.top,x2:m.left,y2:h-m.bottom,class:"chart-axis"}),svgEl("line",{x1:m.left,y1:h-m.bottom,x2:w-m.right,y2:h-m.bottom,class:"chart-axis"}));enabled.forEach(d=>{const pts=res.scenarios[d.key].rows.map(r=>({x:xs(r.year),y:ys(r.totalNetWorth),year:r.year,value:r.totalNetWorth}));const path=pts.map((p,i)=>`${i?"L":"M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");svg.appendChild(svgEl("path",{d:path,class:"chart-line",stroke:d.color}));pts.forEach(p=>{const c=svgEl("circle",{cx:p.x,cy:p.y,r:3.2,fill:d.color,class:"chart-point"});const title=svgEl("title");title.textContent=`${d.label}, ${p.year}: ${fmtEUR.format(p.value)}`;c.appendChild(title);svg.appendChild(c)})})}

function calculateInflationFactor(startYear,targetYear,futureRate){let factor=1;if(targetYear===startYear)return factor;const step=targetYear>startYear?1:-1;for(let y=startYear+step;step>0?y<=targetYear:y>=targetYear;y+=step){const rate=EUROZONE_HISTORICAL_INFLATION[y] ?? futureRate;if(step>0)factor*=1+rate;else factor/=1+rate}return factor}
function renderInflationCalculator(){const amount=inputNumber("inflationAmount"),start=Math.round(inputNumber("inflationStartYear")),target=Math.round(inputNumber("inflationTargetYear")),future=inputPct("inflationFutureRate");const factor=calculateInflationFactor(start,target,future),adjusted=amount*factor,years=Math.abs(target-start),avg=years?Math.pow(factor,1/years)-1:0;document.getElementById("inflationAdjustedAmount").textContent=fmtEUR.format(adjusted);document.getElementById("inflationFactor").textContent=factor.toFixed(3)+"x";document.getElementById("inflationAvgRate").textContent=(avg*100).toFixed(2)+"%"}

function getScenarioLabel(key) {
  return scenarioDefs.find(s => s.key === key)?.label || key;
}

function getYearRow(scenarioResult, year) {
  if (!scenarioResult || !scenarioResult.rows) return null;
  return scenarioResult.rows.find(r => Number(r.year) === Number(year)) || scenarioResult.rows.at(-1) || null;
}

function calculatePensionFromResult(result) {
  const scenarioKey = document.getElementById("pensionScenario")?.value || "A";
  const scenario = result?.scenarios?.[scenarioKey];
  const row2053 = getYearRow(scenario, 2053);
  const finalRow = scenario?.rows?.at(-1);
  const model = result?.model || readModel();

  const basePensionAnnual = document.getElementById("pensionHigherBase")?.checked ? 34320 : 22584;
  const conservativeReturn = inputPct("pensionEtfReturn") || 0;
  const sellLtToggle = document.getElementById("pensionSellLt");

  let etfBase = row2053?.etf || 0;
  let ltSaleProceeds = 0;
  let sellDisabled = false;
  let note = "";

  const selectedScenarioAlreadySoldLt = row2053 ? row2053.ltMarketValue <= 0 && row2053.ltDebt <= 0 : false;
  if (sellLtToggle) {
    sellDisabled = selectedScenarioAlreadySoldLt;
    sellLtToggle.disabled = sellDisabled;
    if (sellDisabled) sellLtToggle.checked = false;
  }

  if (!row2053) {
    note = "Projection does not reach 2053. Increase projection years so the pension section can use EOY 2053 ETF value.";
  } else if (sellLtToggle?.checked && !selectedScenarioAlreadySoldLt) {
    ltSaleProceeds = Math.max(0, (row2053.ltMarketValue || 0) - (row2053.ltDebt || 0));
    etfBase += ltSaleProceeds;
    note = `Scenario ${scenarioKey}: remaining LT property is sold at EOY 2053 and net equity is added to ETF.`;
  } else if (selectedScenarioAlreadySoldLt) {
    note = `Scenario ${scenarioKey}: LT property is already sold before / by 2053, so the LT sale toggle is disabled.`;
  } else {
    note = `Scenario ${scenarioKey}: LT property is retained for pension calculation unless the sale toggle is enabled.`;
  }

  const annualEtfIncome = etfBase * conservativeReturn;
  const totalAnnualFuture = basePensionAnnual + annualEtfIncome;
  const monthlyFuture = totalAnnualFuture / 12;

  const years = 2054 - model.projectionStartYear;
  const inflationFactor = Math.pow(1 + (model.personalInflation ?? inputPct("personalInflation") ?? 0.033), years);
  const monthlyToday = monthlyFuture / inflationFactor;

  return {
    scenarioKey,
    scenario,
    row2053,
    basePensionAnnual,
    etfBase,
    ltSaleProceeds,
    conservativeReturn,
    annualEtfIncome,
    totalAnnualFuture,
    monthlyFuture,
    monthlyToday,
    inflationFactor,
    note,
  };
}

function renderPension(result) {
  const p = calculatePensionFromResult(result);

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  set("pensionEtfBase", fmtEUR.format(p.etfBase));
  set("pensionEtfIncomeAnnual", fmtEUR.format(p.annualEtfIncome));
  set("pensionMonthlyFuture", fmtEUR.format(p.monthlyFuture));
  set("pensionMonthlyToday", fmtEUR.format(p.monthlyToday));
  set("pensionLtSaleProceeds", fmtEUR.format(p.ltSaleProceeds));
  set("pensionInflationFactor", `${p.inflationFactor.toFixed(2)}x`);

  const noteEl = document.getElementById("pensionNote");
  if (noteEl) {
    noteEl.textContent = `${p.note} Pension base: ${fmtEUR.format(p.basePensionAnnual)}/year AOW + employer pension plus ${(p.conservativeReturn * 100).toFixed(1)}% ETF income.`;
  }
}

function render(res){renderSummary(res);renderDetails(res);renderChart(res);renderPension(res);renderInflationCalculator()}
function calculate(){try{const res=simulateAll();window.__lastResult=res;render(res)}catch(e){console.error(e)}}
function downloadCsv(){const res=window.__lastResult||simulateAll(),rows=[["Scenario","Year","ETF","LT value","LT debt","LT equity","AMS value","AMS debt","AMS equity","Total net worth","Real net worth","Box 3 tax","Events"]];Object.values(res.scenarios).forEach(s=>s.rows.forEach(r=>rows.push([s.label,r.year,r.etf.toFixed(2),r.ltMarketValue.toFixed(2),r.ltDebt.toFixed(2),r.ltEquity.toFixed(2),r.amsValue.toFixed(2),r.amsDebt.toFixed(2),r.amsEquity.toFixed(2),r.totalNetWorth.toFixed(2),r.realNetWorth.toFixed(2),r.box3Tax.toFixed(2),r.events])));const csv=rows.map(row=>row.map(x=>`"${String(x).replaceAll('"','""')}"`).join(",")).join("\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="scenario_comparison.csv";a.click();URL.revokeObjectURL(url)}
function applyFiscalPartnerDefaults(){const p=document.getElementById("hasFiscalPartner"),a=document.getElementById("box3Allowance"),d=document.getElementById("debtThreshold");if(!p||!a||!d)return;if(p.checked){a.value=BOX3_2025_PARTNER_ALLOWANCE;d.value=BOX3_2025_PARTNER_DEBT_THRESHOLD}else{a.value=BOX3_2025_SINGLE_ALLOWANCE;d.value=BOX3_2025_SINGLE_DEBT_THRESHOLD}}
function applyTheme(theme){document.body.classList.toggle("dark",theme==="dark");const t=document.getElementById("themeToggle");if(t)t.checked=theme==="dark";try{localStorage.setItem("calculatorTheme",theme)}catch(e){}}
function initTheme(){let stored="light";try{stored=localStorage.getItem("calculatorTheme")||"light"}catch(e){}applyTheme(stored);const t=document.getElementById("themeToggle");if(t)t.onchange=()=>applyTheme(t.checked?"dark":"light")}
function clearTableHighlights(table){table.querySelectorAll(".col-hover,.cell-hover,.header-hover").forEach(el=>el.classList.remove("col-hover","cell-hover","header-hover"))}
function setupTableHeaderHover(){document.querySelectorAll("table").forEach(table=>{table.addEventListener("mouseover",e=>{const th=e.target.closest("th");if(!th||!table.contains(th))return;clearTableHighlights(table);const idx=th.cellIndex;th.classList.add("header-hover");Array.from(table.rows).forEach(row=>{const cell=row.cells[idx];if(cell)cell.classList.add("col-hover")})});table.addEventListener("mouseout",e=>{if(!e.relatedTarget||!table.contains(e.relatedTarget))clearTableHighlights(table)})})}
function setupTabs(){document.querySelectorAll(".tab-button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab-button").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".tab-panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById(b.dataset.tab).classList.add("active")});document.querySelectorAll(".detail-tab-button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".detail-tab-button").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeDetailScenario=b.dataset.detail;if(window.__lastResult)renderDetails(window.__lastResult)})}
function init(){initTheme();addRateRow({effectiveFrom:"2025-08-25",euribor:2.08});addRateRow({effectiveFrom:"2026-01-01",euribor:2.12});addEtfContributionRow({amount:10000,frequency:"Yearly",month:1,startYear:2026,endYear:2028});addEtfContributionRow({amount:16500,frequency:"Yearly",month:1,startYear:2029,endYear:2045});addLumpContributionRow({amount:0,year:2026,month:1,destination:"LT repayment",description:"optional"});document.querySelectorAll("input,select").forEach(el=>{el.addEventListener("input",calculate);el.addEventListener("change",calculate)});document.getElementById("hasFiscalPartner").addEventListener("change",()=>{applyFiscalPartnerDefaults();calculate()});document.getElementById("personalInflation").addEventListener("input",()=>{document.getElementById("inflationFutureRate").value=document.getElementById("personalInflation").value;calculate()});document.getElementById("addRateRow").onclick=()=>{addRateRow();calculate()};document.getElementById("addEtfContribution").onclick=()=>{addEtfContributionRow();calculate()};document.getElementById("addLumpContribution").onclick=()=>{addLumpContributionRow();calculate()};document.getElementById("downloadCsv").onclick=downloadCsv;window.addEventListener("resize",()=>{if(window.__lastResult)renderChart(window.__lastResult)});setupTabs();renderChartControls();setupTableHeaderHover();setupCurrencyToggle();applyFiscalPartnerDefaults();calculate();loadFxRates()}
init();
