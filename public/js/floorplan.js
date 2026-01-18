/* public/js/floorplan.js
   Full frontend: Konva editor, palette, add/delete, owner-only reservation, socket sync.
*/
(async function(){
  const cfg = window.APP_CONFIG || {};
  const RESTAURANT_DB_ID = cfg.restaurantDbId; // Mongo _id
  const IS_OWNER = !!cfg.isOwner;
  const stageWidth = 1200, stageHeight = 800;
  const container = document.getElementById('stage-container');

  // Konva setup
  const stage = new Konva.Stage({ container, width: stageWidth, height: stageHeight });
  const backgroundLayer = new Konva.Layer();
  const itemsLayer = new Konva.Layer();
  const uiLayer = new Konva.Layer();
  stage.add(backgroundLayer, itemsLayer, uiLayer);

  // transformer
  const tr = new Konva.Transformer({ rotateEnabled:true, enabledAnchors: ['top-left','top-right','bottom-left','bottom-right'] });
  uiLayer.add(tr);

  // draw grid
  function drawGrid() {
    backgroundLayer.destroyChildren();
    const step = 50;
    for (let x=0;x<=stageWidth;x+=step) backgroundLayer.add(new Konva.Line({ points:[x,0,x,stageHeight], stroke:'#f0f0f0', strokeWidth:1 }));
    for (let y=0;y<=stageHeight;y+=step) backgroundLayer.add(new Konva.Line({ points:[0,y,stageWidth,y], stroke:'#f0f0f0', strokeWidth:1 }));
    backgroundLayer.draw();
  }
  drawGrid();

  // socket.io
  const socket = io();
  socket.on('connect', () => {
    if (RESTAURANT_DB_ID) socket.emit('joinRestaurant', RESTAURANT_DB_ID);
  });

  // UI elements
  const floorSelect = document.getElementById('floorSelect');
  const palette = document.getElementById('palette');
  const addCustomBtn = document.getElementById('addCustom');
  const deleteItemBtn = document.getElementById('deleteItem');
  const saveBtn = document.getElementById('saveBtn');
  const clearSelectionBtn = document.getElementById('clearSelection');
  const labelInput = document.getElementById('labelInput');
  const seatsInput = document.getElementById('seatsInput');

  // state
  let currentFloorKey = floorSelect.value || 'main';
  let selectedKind = 'table';
  let selectedGroup = null;
  let currentItemsMap = new Map(); // id -> group

  // helper uid
  function uid(prefix='i') { return prefix + Math.random().toString(36).slice(2,10); }

  // palette click
  palette.addEventListener('click', (e) => {
    const btn = e.target.closest('.palette-btn');
    if (!btn) return;
    selectedKind = btn.getAttribute('data-kind');
    // visually mark active
    palette.querySelectorAll('.palette-btn').forEach(b=>b.style.border='');
    btn.style.border = '2px solid #0b84ff';
  });

  // add item on button click
  addCustomBtn.addEventListener('click', async () => {
    const id = uid('it');
    const kind = selectedKind || 'table';
    const defaultItem = defaultItemByKind(kind, id);
    // send to server (owner-only)
    try {
      const res = await fetch(`/api/floorplan/${RESTAURANT_DB_ID}/${currentFloorKey}/add-item`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ item: defaultItem })
      });
      if (!res.ok) {
        const json = await res.json().catch(()=>({}));
        alert(`Add failed: ${json.error || 'server error'}`);
        return;
      }
      const json = await res.json();
      // create local node
      createItemNode(json.item);
      itemsLayer.draw();
    } catch (err) {
      console.error(err);
      alert('Network error adding item');
    }
  });

  // delete selected
  deleteItemBtn.addEventListener('click', async () => {
    if (!selectedGroup) return alert('Select an item first');
    const id = selectedGroup.id();
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`/api/floorplan/${RESTAURANT_DB_ID}/${currentFloorKey}/item/${id}`, { method:'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(()=>({}));
        alert('Delete failed: ' + (json.error || 'server error'));
        return;
      }
      // remove local
      selectedGroup.destroy();
      selectedGroup = null;
      tr.nodes([]);
      itemsLayer.draw();
    } catch (err) {
      console.error(err);
    }
  });

  // save all to server (owner-only)
  saveBtn.addEventListener('click', async () => {
    if (!IS_OWNER) return alert('Only the restaurant owner can save the floorplan.');
    const payload = gatherFloorPayload();
    try {
      const res = await fetch(`/api/floorplan/${RESTAURANT_DB_ID}/${currentFloorKey}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (!res.ok) {
        const json = await res.json().catch(()=>({}));
        alert('Save failed: ' + (json.error || 'server error'));
        return;
      }
      alert('Saved.');
    } catch (err) {
      console.error(err);
      alert('Network error saving');
    }
  });

  clearSelectionBtn.addEventListener('click', () => { tr.nodes([]); selectedGroup = null; itemsLayer.draw(); });

  // label & seats input bind
  labelInput.addEventListener('input', () => {
    if (!selectedGroup) return;
    const txt = selectedGroup.findOne(n=>n.name()==='label');
    if (txt) { txt.text(labelInput.value); itemsLayer.draw(); }
  });
  seatsInput.addEventListener('change', () => {
    if (!selectedGroup) return;
    const seats = parseInt(seatsInput.value) || 0;
    const meta = selectedGroup.getAttr('meta') || {};
    meta.seats = seats;
    selectedGroup.setAttr('meta', meta);
    // recalc seats visually
    refreshSeats(selectedGroup, seats);
    itemsLayer.draw();
  });

  // helper: default item per kind
  function defaultItemByKind(kind, id) {
    const base = { id, kind, x: 200 + Math.random()*300, y: 150 + Math.random()*200, rotation:0, meta:{} };
    switch(kind) {
      case 'table': return { ...base, shape:'circle', width:80, height:80, seats:4, isReserved:false, ownerReserved:false, meta:{ label:'Table' } };
      case 'rect_table': return { ...base, shape:'rect', width:120, height:80, seats:4, isReserved:false, ownerReserved:false, meta:{ label:'Table' } };
      case 'oval_table': return { ...base, shape:'oval', width:140, height:80, seats:6, isReserved:false, ownerReserved:false, meta:{ label:'Oval' } };
      case 'booth': return { ...base, shape:'rect', width:240, height:80, seats:6, kind:'booth', isReserved:false, ownerReserved:false, meta:{ label:'Booth' } };
      case 'sofa': return { ...base, shape:'rect', width:160, height:60, seats:0, meta:{ label:'Sofa' } };
      case 'plant': return { ...base, shape:'rect', width:36, height:36, seats:0, meta:{ label:'Plant' } };
      case 'door': return { ...base, shape:'rect', width:80, height:12, seats:0, meta:{ label:'Door' } };
      case 'window': return { ...base, shape:'rect', width:100, height:12, seats:0, meta:{ label:'Window' } };
      default: return { ...base, width:100, height:60, seats:0, meta:{} };
    }
  }

  // create konva node for item
  function createItemNode(it) {
    // prevent duplicate
    if (itemsLayer.findOne(g => g.id() === it.id)) return;
    let group = new Konva.Group({ id: it.id, x: it.x, y: it.y, rotation: it.rotation || 0, draggable: true, meta: it.meta || {} });
    // shape
    let main;
    const fill = it.isReserved ? '#ffcccc' : (it.ownerReserved ? '#ffd580' : '#d0f0d0');
    if (it.shape === 'circle' && (it.kind === 'table' || it.kind === 'table')) {
      main = new Konva.Circle({ x:0, y:0, radius: (it.width||80)/2, fill, stroke:'#333', strokeWidth:1 });
      group.width = (it.width||80); group.height = (it.width||80);
    } else {
      // rect/oval or others
      if (it.shape === 'oval') {
        main = new Konva.Ellipse({ x:0, y:0, radiusX:(it.width||120)/2, radiusY:(it.height||60)/2, fill, stroke:'#333', strokeWidth:1 });
        group.width = it.width||120; group.height = it.height||60;
      } else {
        main = new Konva.Rect({ x: -(it.width||120)/2, y: -(it.height||60)/2, width:it.width||120, height:it.height||60, cornerRadius: it.kind==='booth' ? 10 : 4, fill, stroke:'#333', strokeWidth:1 });
        group.width = it.width||120; group.height = it.height||60;
      }
    }
    group.add(main);

    // label
    const labelText = (it.meta && it.meta.label) ? it.meta.label : (it.kind || 'Item');
    const label = new Konva.Text({ name:'label', text: labelText, fontSize:13, x:-40, y:-10 });
    group.add(label);

    // seats auto
    if (it.seats && it.seats > 0) {
      refreshSeats(group, it.seats);
    }

    // owner reserved overlay
    if (it.isReserved || it.ownerReserved) {
      const overlay = new Konva.Rect({ x: -group.width/2 -6, y:-group.height/2 -6, width:group.width+12, height:group.height+12, stroke: it.ownerReserved ? '#d97706' : '#ff0000', strokeWidth:3, dash: it.ownerReserved ? [2,4] : [6,4], listening:false });
      overlay.setAttr('isOverlay', true);
      group.add(overlay);
    }

    // events
    group.on('click tap', (e) => {
      tr.nodes([group]);
      selectedGroup = group;
      // populate side inputs
      const lab = group.findOne(n=>n.name()==='label');
      labelInput.value = lab ? lab.text() : '';
      const meta = group.getAttr('meta') || {};
      seatsInput.value = meta.seats || 0;
      itemsLayer.draw();
    });

    // double-click to toggle reservation
    group.on('dblclick dbltap', async () => {
      const id = group.id();
      // owner can set ownerReserved flag; normal users can only toggle isReserved false/true (but backend requires owner session for save)
      if (!IS_OWNER) {
        // non-owner -> ask owner to reserve (or disallow)
        alert('Only owner/manager can set owner reservation. You can request owner to reserve this table.');
        return;
      }
      // if owner, open small confirm asking ownerReserve or normal reserve
      const setOwner = confirm('Do you want to mark this as OWNER-RESERVED? (OK = owner-reserve, Cancel = toggle normal reserve)');
      try {
        const res = await fetch(`/api/floorplan/${RESTAURANT_DB_ID}/${currentFloorKey}/toggle-reserve`, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ itemId: id, reserved: !hasOverlay(group), ownerReserved: setOwner })
        });
        if (!res.ok) {
          const j = await res.json().catch(()=>({}));
          alert('Reserve failed: ' + (j.error || 'server error'));
          return;
        }
        const j = await res.json();
        // update visuals
        updateReservationVisual(group, j.item.isReserved, j.item.ownerReserved);
      } catch (err) { console.error(err); }
    });

    // drag and transform -> update on server
    group.on('dragend transformend', async () => {
      // update position/size/rotation/label/seats meta
      const mainNode = group.findOne(n => n instanceof Konva.Rect || n instanceof Konva.Circle || n instanceof Konva.Ellipse);
      const w = mainNode.width ? mainNode.width() : (mainNode.radiusX? mainNode.radiusX()*2: group.width);
      const h = mainNode.height ? mainNode.height() : (mainNode.radiusY? mainNode.radiusY()*2: group.height);
      const item = {
        id: group.id(),
        kind: mainNode.className === 'Circle' ? 'table' : (group.getAttr('meta') && group.getAttr('meta').kind) || group.getAttr('kind') || 'item',
        x: Math.round(group.x()),
        y: Math.round(group.y()),
        width: Math.round(w),
        height: Math.round(h),
        rotation: Math.round(group.rotation()),
        seats: group.getAttr('meta') ? group.getAttr('meta').seats || 0 : 0,
        meta: group.getAttr('meta') || {}
      };
      // send update (owner-only allowed by server)
      try {
        const res = await fetch(`/api/floorplan/${RESTAURANT_DB_ID}/${currentFloorKey}/update-item`, {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ item })
        });
        if (!res.ok) {
          const j = await res.json().catch(()=>({}));
          console.error('Update failed', j);
        }
      } catch (err) { console.error(err); }
    });

    itemsLayer.add(group);
    currentItemsMap.set(it.id, group);
    return group;
  }

  // helper: check overlay
  function hasOverlay(group) { return !!group.findOne(n => n.getAttr && n.getAttr('isOverlay')); }

  function updateReservationVisual(group, isReserved, ownerReserved) {
    // update main fill & overlays
    const main = group.findOne(n => n instanceof Konva.Rect || n instanceof Konva.Circle || n instanceof Konva.Ellipse);
    if (main) main.fill(isReserved ? '#ffcccc' : (ownerReserved ? '#ffd580' : '#d0f0d0'));
    // remove old overlays
    group.find(node => node.getAttr && node.getAttr('isOverlay')).forEach(n=>n.destroy());
    if (isReserved || ownerReserved) {
      const overlay = new Konva.Rect({ x: -group.width/2 -6, y:-group.height/2 -6, width: group.width+12, height: group.height+12, stroke: ownerReserved ? '#d97706' : '#ff0000', strokeWidth:3, dash: ownerReserved ? [2,4] : [6,4], listening:false });
      overlay.setAttr('isOverlay', true);
      group.add(overlay);
    }
    itemsLayer.draw();
  }

  // refresh seat nodes around a group
  function refreshSeats(group, seats) {
    // remove old seats (they are listening:false rectangles/circles)
    group.find(n => n.listening && n.listening()===false && (n.className==='Circle' || n.className==='Rect')).forEach(n => {
      // ensure not overlay
      if (!n.getAttr || !n.getAttr('isOverlay')) n.destroy();
    });

    if (!seats || seats <= 0) return;
    const main = group.findOne(n => n instanceof Konva.Rect || n instanceof Konva.Circle || n instanceof Konva.Ellipse);
    const w = group.width || (main.width ? main.width() : 100);
    const h = group.height || (main.height ? main.height() : 60);

    if (main.className === 'Circle' || main.className === 'Ellipse') {
      const r = (w/2) + 16;
      for (let i=0;i<seats;i++){
        const angle = (i/seats) * Math.PI*2 - Math.PI/2;
        const sx = Math.cos(angle) * r;
        const sy = Math.sin(angle) * r;
        const seat = new Konva.Circle({ x:sx, y:sy, radius:8, stroke:'#333', strokeWidth:1, fill:'#fff', listening:false });
        group.add(seat);
      }
    } else {
      const perimeter = 2*(w + h);
      for (let i=0;i<seats;i++){
        const frac = i / seats;
        const dist = frac * perimeter;
        let xOff=0,yOff=0;
        if (dist < w/2) { xOff = -w/2 + dist; yOff = -h/2 - 14; }
        else if (dist < w/2 + h) { const d = dist - w/2; xOff = w/2 + 14; yOff = -h/2 + d; }
        else if (dist < w/2 + h + w) { const d = dist - (w/2 + h); xOff = w/2 - d; yOff = h/2 + 14; }
        else { const d = dist - (w/2 + h + w); xOff = -w/2 - 14; yOff = h/2 - d; }
        const seat = new Konva.Rect({ x:xOff, y:yOff, width:12, height:12, offset:{x:6,y:6}, stroke:'#333', strokeWidth:1, fill:'#fff', listening:false });
        group.add(seat);
      }
    }
  }

  // gather full floor payload (owner-only save)
  function gatherFloorPayload() {
    const items = [];
    itemsLayer.find('Group').each(group => {
      const main = group.findOne(n => n instanceof Konva.Rect || n instanceof Konva.Circle || n instanceof Konva.Ellipse);
      const isCircle = main.className === 'Circle' || main.className === 'Ellipse';
      const kind = group.getAttr('kind') || group.id().startsWith('it') ? (group.getAttr('meta') && group.getAttr('meta').kind) || 'table' : 'item';
      const w = isCircle ? (main.radius ? main.radius()*2 : group.width) : main.width ? main.width() : group.width;
      const h = isCircle ? (main.radius ? main.radius()*2 : group.height) : main.height ? main.height() : group.height;
      const label = group.findOne(n=>n.name()==='label');
      const seats = group.getAttr('meta') && group.getAttr('meta').seats ? group.getAttr('meta').seats : 0;
      const reservedOverlay = !!group.findOne(n=>n.getAttr && n.getAttr('isOverlay'));
      const ownerReserved = reservedOverlay && (main.fill && main.fill() === '#ffd580');
      items.push({
        id: group.id(),
        kind,
        shape: main.className === 'Circle' ? 'circle' : (main.className === 'Ellipse' ? 'oval' : 'rect'),
        x: Math.round(group.x()),
        y: Math.round(group.y()),
        width: Math.round(w),
        height: Math.round(h),
        rotation: Math.round(group.rotation()),
        seats,
        isReserved: reservedOverlay,
        ownerReserved,
        meta: { label: label ? label.text() : '' }
      });
    });
    return { floorName: currentFloorKey, width: stageWidth, height: stageHeight, items };
  }

  // load floor from server
  async function loadFloor(key) {
    currentFloorKey = key;
    try {
      const res = await fetch(`/api/floorplan/${RESTAURANT_DB_ID}/${key}`);
      if (!res.ok) {
        // no floor: clear
        itemsLayer.destroyChildren();
        itemsLayer.draw();
        return;
      }
      const data = await res.json();
      itemsLayer.destroyChildren();
      currentItemsMap.clear();
      (data.items || []).forEach(i => createItemNode(i));
      itemsLayer.draw();
    } catch (err) {
      console.error(err);
    }
  }

  // on floor change
  floorSelect.addEventListener('change', (e) => loadFloor(e.target.value));

  // socket listeners
  socket.on('itemAdded', payload => {
    if (!payload || payload.floorKey !== currentFloorKey) return;
    createItemNode(payload.item);
    itemsLayer.draw();
  });
  socket.on('itemUpdated', payload => {
    if (!payload || payload.floorKey !== currentFloorKey) return;
    const g = itemsLayer.findOne(n=> n.id() === payload.item.id);
    if (g) {
      g.x(payload.item.x); g.y(payload.item.y); g.rotation(payload.item.rotation || 0);
      // update shape size if needed
      const main = g.findOne(n => n instanceof Konva.Rect || n instanceof Konva.Circle || n instanceof Konva.Ellipse);
      if (main) {
        if (main.width) main.width(payload.item.width);
        if (main.height) main.height(payload.item.height);
        if (main.radiusX) { main.radiusX(payload.item.width/2); main.radiusY(payload.item.height/2); }
      }
      // label & seats
      const label = g.findOne(n=>n.name()==='label'); if (label) label.text(payload.item.meta?.label || '');
      const meta = g.getAttr('meta') || {}; meta.seats = payload.item.seats || 0; g.setAttr('meta', meta);
      refreshSeats(g, meta.seats);
      updateReservationVisual(g, payload.item.isReserved, payload.item.ownerReserved);
      itemsLayer.draw();
    } else {
      createItemNode(payload.item);
      itemsLayer.draw();
    }
  });
  socket.on('itemDeleted', payload => {
    if (!payload || payload.floorKey !== currentFloorKey) return;
    const g = itemsLayer.findOne(n => n.id() === payload.itemId);
    if (g) { g.destroy(); itemsLayer.draw(); }
  });
  socket.on('tableReserved', payload => {
    if (!payload || payload.floorKey !== currentFloorKey) return;
    const g = itemsLayer.findOne(n => n.id() === payload.itemId);
    if (g) updateReservationVisual(g, payload.reserved, payload.ownerReserved);
  });
  socket.on('floorplanUpdated', payload => {
    if (!payload || payload.floorKey !== currentFloorKey) return;
    // reload floor to reflect server state
    loadFloor(currentFloorKey);
  });

  // initial load
  await loadFloor(currentFloorKey);

  // stage click: deselect when clicking outside
  stage.on('click tap', e => {
    if (e.target === stage) { tr.nodes([]); selectedGroup = null; itemsLayer.draw(); }
  });

})();
