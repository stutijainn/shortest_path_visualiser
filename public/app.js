
const { useState, useRef, useEffect } = React;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function App(){
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [labelInput, setLabelInput] = useState('');
  const [colorInput, setColorInput] = useState('#1f2937');
  const [connectFrom, setConnectFrom] = useState('');
  const [connectTo, setConnectTo] = useState('');
  const [connectWeight, setConnectWeight] = useState(1);
  const [startNode, setStartNode] = useState('');
  const [endNode, setEndNode] = useState('');
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [nodeStatus, setNodeStatus] = useState({}); // id -> 'visiting'|'visited'|'path'
  const [result, setResult] = useState(null);
  const [steps, setSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(400); // ms per step
  const playTimerRef = useRef(null);
  const [currentDist, setCurrentDist] = useState(null);
  const [highlightedEdgeInfo, setHighlightedEdgeInfo] = useState(null); // {id, from, to}
  const [pseudoStep, setPseudoStep] = useState(0); // 1..6 to highlight pseudocode

  const svgRef = useRef(null);
  const historyRef = useRef([]);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [edgeEditWeight, setEdgeEditWeight] = useState(1);
  const [highlightedEdge, setHighlightedEdge] = useState(null);

  // Pseudocode lines to render and highlight based on `pseudoStep` (1-based index)
  const pseudocodeLines = [
    'Set dist[node] = ∞ for every node; dist[start] = 0.',
    'Keep a set of unvisited nodes.',
    'Pick the unvisited node u with smallest dist[u].',
    'For each neighbor v of u: if dist[u] + weight(u,v) < dist[v], update dist[v] and remember u as predecessor.',
    'Mark u visited and repeat until all nodes processed or target reached.',
    'Reconstruct shortest path by following predecessors from target back to start.'
  ];

  useEffect(()=>{
    // load saved graph if available
    try{
      const raw = localStorage.getItem('spv-graph');
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed.nodes && parsed.edges){ setNodes(parsed.nodes); setEdges(parsed.edges); return; }
      }
    }catch(err){ /* ignore */ }

    if(nodes.length===0){
      const a = {id: uid(), x:160, y:120, label:'1', color:'#2563eb'};
      const b = {id: uid(), x:380, y:220, label:'2', color:'#ef4444'};
      setNodes([a,b]);
      setEdges([{id: uid(), from: a.id, to: b.id, weight: 4}]);
    }
  },[]);

  useEffect(()=>{
    if(selected){
      const n = nodes.find(x=>x.id===selected);
      if(n){ setLabelInput(n.label); setColorInput(n.color || '#1f2937'); }
    } else {
      setLabelInput('');
      setColorInput('#1f2937');
    }
  },[selected]);

  function addNodeAt(x,y){
    saveSnapshot();
    const newNode = {id: uid(), x, y, label: `${nodes.length+1}`, color:'#1f2937'};
    setNodes(n=>[...n,newNode]);
    setSelected(newNode.id);
  }

  function handleSvgClick(e){
    if(e.target === svgRef.current){
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      addNodeAt(x,y);
    }
  }

  function handleMouseDown(e, id){
    e.stopPropagation();
    setDragging(id);
    setSelected(id);
  }

  function handleMouseMove(e){
    if(!dragging) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setNodes(ns => ns.map(n => n.id===dragging ? {...n, x, y} : n));
  }

  function handleMouseUp(){
    if(dragging){
      // store snapshot after move
      saveSnapshot();
    }
    setDragging(null);
  }

  function deleteSelected(){
    if(!selected) return;
    saveSnapshot();
    setNodes(ns => ns.filter(n => n.id !== selected));
    // remove edges connected
    setEdges(es => es.filter(e => e.from !== selected && e.to !== selected));
    setSelected(null);
  }

  function applyNodeEdit(){
    if(!selected) return;
    saveSnapshot();
    setNodes(ns => ns.map(n => n.id===selected ? {...n, label: labelInput, color: colorInput} : n));
  }

  function addEdgeBySelection(){
    if(!connectFrom || !connectTo) return;
    if(connectFrom === connectTo) return;
    saveSnapshot();
    const existing = edges.find(e => (e.from===connectFrom && e.to===connectTo) || (e.from===connectTo && e.to===connectFrom));
    const edge = {id: uid(), from: connectFrom, to: connectTo, weight: Number(connectWeight)||0};
    if(existing){
      setEdges(es => es.map(e => e.id===existing.id ? {...e, weight: edge.weight} : e));
    } else {
      setEdges(es => [...es, edge]);
    }
  }

  function saveSnapshot(){
    try{
      const snap = {nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges))};
      historyRef.current.push(snap);
      if(historyRef.current.length > 50) historyRef.current.shift();
    }catch(e){ /* ignore */ }
  }

  function undo(){
    const h = historyRef.current;
    if(!h || h.length===0) return;
    const last = h.pop();
    if(last){
      setNodes(last.nodes || []);
      setEdges(last.edges || []);
      setSelected(null);
      setSelectedEdge(null);
    }
  }

  function onEdgeClick(e, edge){
    e.stopPropagation();
    setSelectedEdge(edge.id);
    setSelected(null);
    setEdgeEditWeight(edge.weight || 0);
  }

  function deleteSelectedEdge(){
    if(!selectedEdge) return;
    saveSnapshot();
    setEdges(es => es.filter(ed => ed.id !== selectedEdge));
    setSelectedEdge(null);
  }

  function applyEdgeEdit(){
    if(!selectedEdge) return;
    saveSnapshot();
    setEdges(es => es.map(ed => ed.id===selectedEdge ? {...ed, weight: Number(edgeEditWeight)||0} : ed));
  }

  // autosave nodes+edges to localStorage whenever they change
  useEffect(()=>{
    try{
      const payload = {nodes, edges};
      localStorage.setItem('spv-graph', JSON.stringify(payload));
    }catch(e){ /* ignore storage errors */ }
  },[nodes, edges]);

  // Build deterministic steps for Dijkstra without mutating UI.
  function computeDijkstraSteps(start, end){
    const adj = buildAdj();
    const dist = {};
    const prev = {};
    nodes.forEach(n=>{ dist[n.id] = Infinity; prev[n.id]=null; });
    dist[start] = 0;
    const unvisited = new Set(nodes.map(n=>n.id));
    const localSteps = [];

    while(unvisited.size > 0){
      // pick node u
      let u = null; let min = Infinity;
      unvisited.forEach(id => { if(dist[id] < min){ min = dist[id]; u = id; } });
      if(u === null || min === Infinity) break;

  localSteps.push({type:'select', node:u, dist: dist[u], distSnapshot: {...dist}});

      unvisited.delete(u);
      const neighbors = adj.get(u) || [];
      for(const nb of neighbors){
        const v = nb.to; const w = nb.weight;
        const alt = dist[u] + w;
  localSteps.push({type:'consider', from:u, to:v, alt, old: dist[v], distSnapshot: {...dist}});
        if(alt < dist[v]){
          dist[v] = alt;
          prev[v] = u;
          localSteps.push({type:'update', node:v, newDist: alt, prev:u, distSnapshot: {...dist}});
        }
      }

  localSteps.push({type:'visited', node:u, distSnapshot: {...dist}});

      if(u === end) break;
    }

    // final path or distances
  if(end){
      if(prev[end] === null && start !== end){
  localSteps.push({type:'no-path', distSnapshot: {...dist}});
      } else {
        const path = [];
        let cur = end;
        while(cur){ path.push(cur); if(cur === start) break; cur = prev[cur]; }
        path.reverse();
  localSteps.push({type:'path', path, total: dist[end], distSnapshot: {...dist}});
      }
    } else {
      localSteps.push({type:'distances', dist: {...dist}});
    }

    return localSteps;
  }

  function resetPlayback(){
    setSteps([]); setStepIndex(0); setPlaying(false); if(playTimerRef.current){ clearInterval(playTimerRef.current); playTimerRef.current=null; }
    setNodeStatus({}); setResult(null);
  }

  function applyStepToStatus(idx){
    // compute status by replaying steps up to idx
    const s = {};
    for(let i=0;i<Math.min(idx, steps.length); i++){
      const st = steps[i];
      if(st.type === 'select'){ s[st.node] = 'visiting'; }
      else if(st.type === 'visited'){ if(s[st.node] !== 'path') s[st.node] = 'visited'; }
      else if(st.type === 'update'){ /* briefly mark visited later */ s[st.node] = 'visited'; }
      else if(st.type === 'path'){ st.path.forEach(id=> s[id]='path'); }
    }
    setNodeStatus(s);
    // highlight edges and apply result if final step reached; also update readable log and per-node distances
    const last = steps[Math.min(idx-1, steps.length-1)];
    // set default pseudocode when idx===0 (initialisation)
    if(idx === 0){ setPseudoStep(1); }

    if(last){
      // set current distances if snapshot exists
      if(last.distSnapshot) setCurrentDist(last.distSnapshot);

      if(last.type === 'path'){
        setResult({type:'path', path:last.path, total:last.total});
        setHighlightedEdgeInfo(null);
        setPseudoStep(6);
      } else if(last.type === 'no-path'){
        setResult({type:'no-path'});
        setHighlightedEdgeInfo(null);
        setPseudoStep(6);
      } else if(last.type === 'distances'){
        setResult({type:'distances', dist: last.dist});
        setHighlightedEdgeInfo(null);
        setPseudoStep(6);
      } else if(last.type === 'consider' || last.type === 'update'){
        // highlight the edge being considered/updated and show direction
        const eid = findEdgeId(last.from, last.to);
        setHighlightedEdgeInfo({id: eid, from: last.from, to: last.to});
        setResult({type:'step', step:last});
        setPseudoStep(4);
      } else if(last.type === 'select' || last.type === 'visited'){
        setHighlightedEdgeInfo(null);
        setResult({type:'step', step:last});
        setPseudoStep(3);
      } else {
        setHighlightedEdgeInfo(null);
      }
    } else {
      setResult(null);
      setHighlightedEdgeInfo(null);
      setCurrentDist(null);
      setPseudoStep(0);
    }
  }

  function findEdgeId(a,b){
    const e = edges.find(x => (x.from===a && x.to===b) || (x.from===b && x.to===a));
    return e ? e.id : null;
  }

  function describeStep(st){
    if(!st) return '';
    if(st.type === 'select') return `Selected node ${(nodes.find(n=>n.id===st.node)||{label:st.node}).label} (dist=${st.dist===Infinity? '∞':st.dist})`;
    if(st.type === 'consider') return `Considering edge ${(nodes.find(n=>n.id===st.from)||{label:st.from}).label} → ${(nodes.find(n=>n.id===st.to)||{label:st.to}).label}, alt=${st.alt} (old=${st.old===Infinity? '∞':st.old})`;
    if(st.type === 'update') return `Updated ${(nodes.find(n=>n.id===st.node)||{label:st.node}).label}: dist=${st.newDist} via ${(nodes.find(n=>n.id===st.prev)||{label:st.prev}).label}`;
    if(st.type === 'visited') return `Marked visited ${(nodes.find(n=>n.id===st.node)||{label:st.node}).label}`;
    if(st.type === 'path') return `Found path: ${st.path.map(id=> (nodes.find(n=>n.id===id)||{label:id}).label).join(' → ')} (total=${st.total})`;
    if(st.type === 'no-path') return `No path to target could be found.`;
    if(st.type === 'distances') return `Final distances computed.`;
    return JSON.stringify(st);
  }

  function startPlayback(computedSteps){
    resetPlayback();
    setSteps(computedSteps);
    setTimeout(()=>{ // start at index 0
      setStepIndex(0);
      applyStepToStatus(0);
    },0);
  }

  function play(){
    if(steps.length===0) return;
    setPlaying(true);
    playTimerRef.current = setInterval(()=>{
      setStepIndex(i => {
        const next = i+1;
        if(next > steps.length){ clearInterval(playTimerRef.current); setPlaying(false); return i; }
        applyStepToStatus(next);
        if(next === steps.length){ clearInterval(playTimerRef.current); setPlaying(false); }
        return next;
      });
    }, Math.max(30, speed));
  }

  function pause(){ if(playTimerRef.current){ clearInterval(playTimerRef.current); playTimerRef.current=null; } setPlaying(false); }

  function stepForward(){
    const next = Math.min(stepIndex+1, steps.length);
    setStepIndex(next); applyStepToStatus(next);
  }

  function stepBackward(){
    const prev = Math.max(stepIndex-1, 0);
    setStepIndex(prev); applyStepToStatus(prev);
  }

  // compute steps and prepare playback
  function prepareAndRun(){
    if(!startNode) return alert('Choose a start node');
    const s = computeDijkstraSteps(startNode, endNode);
    startPlayback(s);
  }

  function nodeOptions(){
    return nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>);
  }

  function coordsOf(id){
    const n = nodes.find(x=>x.id===id);
    return n ? [n.x, n.y] : [0,0];
  }

  function buildAdj(){
    const adj = new Map();
    nodes.forEach(n=> adj.set(n.id, []));
    edges.forEach(e=>{
      const w = Number(e.weight)||0;
      if(adj.has(e.from)) adj.get(e.from).push({to: e.to, weight: w});
      if(adj.has(e.to)) adj.get(e.to).push({to: e.from, weight: w});
    });
    return adj;
  }

  async function runDijkstra(){
    if(!startNode) return alert('Choose a start node');
    setResult(null);
    setNodeStatus({});
    setRunning(true);
    runningRef.current = true;

    const adj = buildAdj();
    const dist = {};
    const prev = {};
    nodes.forEach(n=>{ dist[n.id] = Infinity; prev[n.id]=null; });
    dist[startNode] = 0;

    const unvisited = new Set(nodes.map(n=>n.id));

    while(unvisited.size > 0 && runningRef.current){
      // pick node u in unvisited with smallest dist
      let u = null; let min = Infinity;
      unvisited.forEach(id => { if(dist[id] < min){ min = dist[id]; u = id; } });
      if(u === null || min === Infinity) break;

      // mark visiting
      setNodeStatus(s => ({...s, [u]: 'visiting'}));
      await sleep(350);

      unvisited.delete(u);
      setNodeStatus(s => ({...s, [u]: 'visited'}));

      if(u === endNode){ break; }

      const neighbors = adj.get(u) || [];
      for(const nb of neighbors){
        if(!runningRef.current) break;
        const v = nb.to; const w = nb.weight;
        const alt = dist[u] + w;
        if(alt < dist[v]){
          dist[v] = alt;
          prev[v] = u;
          // briefly highlight updated neighbor
          setNodeStatus(s => ({...s, [v]: 'visiting'}));
          await sleep(180);
          setNodeStatus(s => ({...s, [v]: 'visited'}));
        }
      }
    }

    // finished or stopped
    runningRef.current = false;
    setRunning(false);

    if(endNode){
      if(prev[endNode] === null && startNode !== endNode){
        setResult({type:'no-path'});
        return;
      }
      // reconstruct path
      const path = [];
      let cur = endNode;
      while(cur){ path.push(cur); if(cur === startNode) break; cur = prev[cur]; }
      path.reverse();
      // mark path
      const statusUpdate = {};
      path.forEach(id => statusUpdate[id] = 'path');
      setNodeStatus(s => ({...s, ...statusUpdate}));
      const total = dist[endNode];
      setResult({type:'path', path, total});
    } else {
      // show distances to all nodes
      setResult({type:'distances', dist});
    }
  }

  function stopRun(){
    runningRef.current = false;
    setRunning(false);
  }

  return (
    <div className="app">
      <div className="header panel">
        <h2 style={{margin:0}}>Dijkstra Visualiser</h2>
        <div className="sub" style={{marginLeft:12}}>Interactive editor · choose start/end, run/stop and view shortest path</div>
      </div>

      <div className="panel controls">
        <h3>Controls</h3>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{addNodeAt(120 + Math.random()*300, 80 + Math.random()*400)}}>Add Node</button>
          <button className="secondary" onClick={undo} disabled={!(historyRef.current && historyRef.current.length>0)}>Undo</button>
        </div>
        <button className="secondary" onClick={deleteSelected} disabled={!selected}>Delete Selected</button>

        <div style={{marginTop:10}}>
          <strong>Edit selected node</strong>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <input value={labelInput} onChange={e=>setLabelInput(e.target.value)} placeholder="label" />
            <input type="color" value={colorInput} onChange={e=>setColorInput(e.target.value)} />
            <button onClick={applyNodeEdit} disabled={!selected}>Apply</button>
          </div>
          <div className="hint">Label nodes by number and pick a color.</div>
        </div>

        <hr style={{opacity:0.06}} />

        <div>
          <strong>Connect nodes (weighted)</strong>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
            <label>From
              <select value={connectFrom} onChange={e=>setConnectFrom(e.target.value)}>
                <option value="">-- select --</option>
                {nodeOptions()}
              </select>
            </label>
            <label>To
              <select value={connectTo} onChange={e=>setConnectTo(e.target.value)}>
                <option value="">-- select --</option>
                {nodeOptions()}
              </select>
            </label>
            <label>Weight
              <input type="number" value={connectWeight} onChange={e=>setConnectWeight(e.target.value)} />
            </label>
            <div style={{display:'flex',gap:8}}>
              <button onClick={addEdgeBySelection} disabled={!connectFrom || !connectTo}>Add / Update Edge</button>
            </div>
          </div>
        </div>

        {selectedEdge && (
          <div style={{marginTop:10}}>
            <strong>Selected edge</strong>
            <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
              <div>Weight</div>
              <input type="number" value={edgeEditWeight} onChange={e=>setEdgeEditWeight(e.target.value)} />
              <button onClick={applyEdgeEdit}>Apply</button>
              <button className="secondary" onClick={deleteSelectedEdge}>Delete Edge</button>
            </div>
            <div className="hint">Click an edge (line or weight box) to select it for edit/delete.</div>
          </div>
        )}

        <hr style={{opacity:0.06}} />

        <div>
          <strong>Run Dijkstra</strong>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
            <label>Start
              <select value={startNode} onChange={e=>setStartNode(e.target.value)}>
                <option value="">-- select start --</option>
                {nodeOptions()}
              </select>
            </label>
            <label>End (optional)
              <select value={endNode} onChange={e=>setEndNode(e.target.value)}>
                <option value="">-- select end (show all distances) --</option>
                {nodeOptions()}
              </select>
            </label>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button onClick={prepareAndRun} disabled={playing}>Prepare</button>
              <button onClick={play} disabled={playing || steps.length===0}>Play</button>
              <button onClick={pause} className="secondary" disabled={!playing}>Pause</button>
              <button onClick={stepBackward} className="secondary" disabled={stepIndex===0}>◀</button>
              <button onClick={stepForward} className="secondary" disabled={stepIndex>=steps.length}>▶</button>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
              <label style={{fontSize:12,color:'#9fbbe6'}}>Speed</label>
              <input type="range" min="50" max="1000" value={speed} onChange={e=>setSpeed(Number(e.target.value))} />
              <div style={{fontSize:12}}>{Math.round(1000/speed)} steps/sec</div>
            </div>
          </div>
        </div>

        <div style={{marginTop:12}} className="hint">Tip: click empty canvas to add node at position. Drag nodes to move them. Select start/end and click Run.</div>
      </div>

      <div className="canvas-wrap panel">
        <h3>Graph area</h3>
        <svg
          ref={svgRef}
          className="svg-canvas"
          onClick={handleSvgClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,10 L10,5 Z" fill="#f59e0b" />
            </marker>
          </defs>
          {/* draw edges first (so they're under nodes) */}
          {edges.map(e=>{
            const [x1,y1] = coordsOf(e.from);
            const [x2,y2] = coordsOf(e.to);
            const mx = (x1 + x2)/2;
            const my = (y1 + y2)/2;
            const isSelected = selectedEdge === e.id;
            const isHighlighted = highlightedEdgeInfo && highlightedEdgeInfo.id === e.id;
            return (
              <g key={e.id} onClick={(evt)=>onEdgeClick(evt, e)} style={{cursor:'pointer'}}>
                <line
                  className={`edge-line ${isHighlighted? 'edge-highlight edge-anim' : ''} ${isSelected? 'edge-selected' : ''}`}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  markerEnd={isHighlighted && highlightedEdgeInfo && highlightedEdgeInfo.from === e.from && highlightedEdgeInfo.to === e.to ? 'url(#arrow)' : (isHighlighted && highlightedEdgeInfo && highlightedEdgeInfo.from === e.to && highlightedEdgeInfo.to === e.from ? 'url(#arrow)' : undefined)}
                  style={isHighlighted ? {animationDuration: `${Math.max(80, speed)}ms`} : undefined}
                />
                <rect x={mx-14} y={my-12} width={28} height={20} rx={4} ry={4} fill="#071427" stroke={isSelected? '#f97316' : '#0ea5a4'} opacity={0.95} />
                <text className="edge-weight" x={mx} y={my+3} textAnchor="middle">{e.weight}</text>
              </g>
            );
          })}

          {nodes.map(n=> {
            const status = nodeStatus[n.id] || '';
            const cls = `node-circle ${selected===n.id ? 'selected' : ''} ${status==='visiting' ? 'node-visiting' : ''} ${status==='visited' ? 'node-visited' : ''} ${status==='path' ? 'node-path' : ''}`;
            return (
              <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                <circle
                  r={26}
                  className={cls}
                  fill={n.color || '#1f2937'}
                  onMouseDown={(e)=>handleMouseDown(e, n.id)}
                  onClick={(e)=>{ e.stopPropagation(); setSelected(n.id); }}
                />
                <text className="node-label" y={5}>{n.label}</text>
                {currentDist && typeof currentDist[n.id] !== 'undefined' && (
                  <text className="node-distance" y={40} textAnchor="middle">{currentDist[n.id]===Infinity ? '∞' : currentDist[n.id]}</text>
                )}
              </g>
            );
          })}
        </svg>

        {result && (
          <div className="result-box">
            {result.type === 'no-path' && <div>No path found between chosen nodes.</div>}
            {result.type === 'path' && (
              <div>
                <div><strong>Shortest path</strong>: {result.path.map(id=> (nodes.find(n=>n.id===id)||{label:id}).label).join(' → ')}</div>
                <div><strong>Total weight</strong>: {result.total}</div>
              </div>
            )}
            {result.type === 'distances' && (
              <div>
                <div><strong>Distances from { (nodes.find(n=>n.id===startNode)||{label:startNode}).label }</strong></div>
                <ul>
                  {nodes.map(n=> <li key={n.id}>{n.label}: {result.dist[n.id]===Infinity? '∞' : result.dist[n.id]}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel right-panel">
        <h3>Pseudocode</h3>
        <div className="pseudocode">
          <div style={{fontWeight:'600', color:'var(--edge)', marginBottom:8}}>Dijkstra (simple explanation)</div>
          {pseudocodeLines.map((line, i) => (
            <div key={i} className={`pseudocode-line ${pseudoStep === i+1 ? 'active' : ''}`} onClick={() => { /* allow click to jump highlight if needed */ }}>
              <span className="num">{i+1}</span>
              <span className="txt">{line}</span>
            </div>
          ))}
        </div>
        <div style={{marginTop:12}}>
          <h4 style={{marginBottom:6}}>Step-by-step table</h4>
          <div style={{maxHeight:220,overflow:'auto',border:'1px solid rgba(255,255,255,0.03)',borderRadius:6}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{textAlign:'left',fontSize:13,color:'#9fbbe6'}}>
                  <th style={{padding:6}}>#</th>
                  <th style={{padding:6}}>Action</th>
                  <th style={{padding:6}}>Details</th>
                  <th style={{padding:6}}>Distances</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((st, i)=>{
                  const isCur = i < stepIndex && i===stepIndex-1;
                  return (
                    <tr key={i} onClick={()=>{ setStepIndex(i+1); applyStepToStatus(i+1); }} style={{background: i+1===stepIndex ? 'rgba(125,211,252,0.06)' : 'transparent', cursor:'pointer'}}>
                      <td style={{padding:6}}>{i+1}</td>
                      <td style={{padding:6}}>{st.type}</td>
                      <td style={{padding:6,fontSize:13}}>{st.type==='consider' ? `${(nodes.find(n=>n.id===st.from)||{label:st.from}).label} → ${(nodes.find(n=>n.id===st.to)||{label:st.to}).label} (alt=${st.alt})` : st.type==='update' ? `update ${(nodes.find(n=>n.id===st.node)||{label:st.node}).label} = ${st.newDist}` : st.type==='select' ? `select ${(nodes.find(n=>n.id===st.node)||{label:st.node}).label}` : st.type==='visited' ? `visited ${(nodes.find(n=>n.id===st.node)||{label:st.node}).label}` : st.type==='path' ? `path: ${st.path.map(id=> (nodes.find(n=>n.id===id)||{label:id}).label).join('→')}` : st.type==='no-path' ? 'no path' : st.type==='distances' ? 'final distances' : ''}</td>
                      <td style={{padding:6,fontSize:12}}>{st.distSnapshot ? Object.entries(st.distSnapshot).map(([id,d])=> `${(nodes.find(n=>n.id===id)||{label:id}).label}:${d===Infinity? '∞':d}`).join(', ') : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{marginTop:8}}>
            <strong>Log</strong>
            <div style={{minHeight:36,background:'rgba(255,255,255,0.02)',padding:8,borderRadius:6,marginTop:6}}>
              {stepIndex>0 ? describeStep(steps[Math.min(stepIndex-1, steps.length-1)]) : 'No step selected.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
