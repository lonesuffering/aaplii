(() => {
  'use strict';

  const ui = {
    btnLocate: document.getElementById('btnLocate'),
    btnSnapshot: document.getElementById('btnSnapshot'),
    mapHost: document.getElementById('leafletStage'),
    shotHost: document.getElementById('snapshotStage'),
    bank: document.getElementById('bank'),
    board: document.getElementById('board'),
  };

  const state = {
    leafletMap: null,
    mapReady: false,
    chunks: [],          // dataURL частей по порядку (0..15)
    solvedOnce: false,   // чтобы не спамить уведомлениями
  };

  // ---------- helpers ----------
  const shuffleInPlace = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const notifyWin = async () => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      new Notification('Congratulations!', {
        body: 'You have successfully completed the puzzle!',
      });
    }
  };

  // ---------- map ----------
  const renderMapAt = (lat, lng) => {
    if (state.leafletMap) {
      state.leafletMap.setView([lat, lng], 13);
      return;
    }

    state.leafletMap = L.map(ui.mapHost).setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
      .addTo(state.leafletMap);

    L.marker([lat, lng])
      .addTo(state.leafletMap)
      .bindPopup('You are here, human')
      .openPopup();

    state.mapReady = true;
  };

  const geoFail = (err) => {
    const code = err?.code;
    if (code === err.PERMISSION_DENIED) alert('Geolocation request denied.');
    else if (code === err.POSITION_UNAVAILABLE) alert('Location information is unavailable.');
    else if (code === err.TIMEOUT) alert('Geolocation request timed out.');
    else alert('An unknown error occurred.');
  };

  const askGeolocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation API is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        renderMapAt(latitude, longitude);
      },
      geoFail
    );
  };

  // ---------- puzzle board (cells) ----------
  const buildBoard = () => {
    ui.board.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const cell = document.createElement('div');
      cell.dataset.slot = String(i);

      cell.addEventListener('dragover', (e) => e.preventDefault());
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        const token = e.dataTransfer.getData('text/plain');
        if (!token) return;

        // если в ячейке уже есть кусок — ничего не делаем
        if (cell.firstChild) return;

        const idx = Number(token);
        const pieceUrl = state.chunks[idx];
        if (!pieceUrl) return;

        const node = makePiece(idx, pieceUrl);
        cell.appendChild(node);

        // удалить из банка (если там есть)
        const inBank = ui.bank.querySelector(`img[data-piece="${idx}"]`);
        if (inBank) inBank.remove();

        checkSolved();
      });

      ui.board.appendChild(cell);
    }
  };

  // drop обратно в bank
  const enableBankDrop = () => {
    ui.bank.addEventListener('dragover', (e) => e.preventDefault());
    ui.bank.addEventListener('drop', (e) => {
      e.preventDefault();
      const token = e.dataTransfer.getData('text/plain');
      if (!token) return;

      const idx = Number(token);
      const pieceUrl = state.chunks[idx];
      if (!pieceUrl) return;

      // если уже лежит в банке — не дублируем
      if (ui.bank.querySelector(`img[data-piece="${idx}"]`)) return;

      // убрать с доски
      const onBoard = ui.board.querySelector(`img[data-piece="${idx}"]`);
      if (onBoard) onBoard.remove();

      ui.bank.appendChild(makePiece(idx, pieceUrl));
    });
  };

  const makePiece = (pieceIndex, dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    img.draggable = true;
    img.dataset.piece = String(pieceIndex);

    img.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(pieceIndex));
    });

    return img;
  };

  const checkSolved = () => {
    const slots = Array.from(ui.board.children);

    let ok = 0;
    for (let s = 0; s < slots.length; s++) {
      const cell = slots[s];
      const pic = cell.firstChild;
      if (!pic) return; // не заполнено — точно не решено
      if (Number(pic.dataset.piece) === s) ok++;
    }

    if (ok === 16 && !state.solvedOnce) {
      state.solvedOnce = true;
      notifyWin();
    }
  };

  // ---------- snapshot + slicing ----------
  const takeSnapshot = () => {
    if (!state.leafletMap || !state.mapReady) {
      alert('Map is still loading. Please try again in a few seconds.');
      return;
    }

    leafletImage(state.leafletMap, (err, canvas) => {
      if (err) {
        console.error('Error creating map image:', err);
        return;
      }

      ui.shotHost.innerHTML = '';
      const preview = new Image();

      preview.onload = () => {
        preview.style.maxWidth = '100%';
        preview.style.maxHeight = '100%';
        ui.shotHost.appendChild(preview);

        const parts = splitTo16(preview);
        fillBank(parts);
        buildBoard();
        state.solvedOnce = false;
      };

      preview.src = canvas.toDataURL();
    });
  };

  const splitTo16 = (imgEl) => {
    const w = imgEl.width;
    const h = imgEl.height;

    if (!w || !h) {
      console.error('Image dimensions are invalid:', w, h);
      return [];
    }

    const tileW = w / 4;
    const tileH = h / 4;

    const out = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cnv = document.createElement('canvas');
        cnv.width = tileW;
        cnv.height = tileH;

        const ctx = cnv.getContext('2d');
        ctx.drawImage(
          imgEl,
          c * tileW, r * tileH, tileW, tileH,
          0, 0, tileW, tileH
        );

        out.push(cnv.toDataURL());
      }
    }
    return out;
  };

  const fillBank = (partsInOrder) => {
    state.chunks = partsInOrder.slice();
    ui.bank.innerHTML = '';

    // создать элементы по оригинальному индексу, а потом перемешать порядок отображения
    const nodes = partsInOrder.map((url, idx) => makePiece(idx, url));
    shuffleInPlace(nodes);

    nodes.forEach((n) => ui.bank.appendChild(n));
  };

  // ---------- boot ----------
  const boot = () => {
    // bank должен принимать drop
    enableBankDrop();

    // доску строим заранее (пустую)
    buildBoard();

    ui.btnLocate.addEventListener('click', askGeolocation);
    ui.btnSnapshot.addEventListener('click', takeSnapshot);
  };

  document.addEventListener('DOMContentLoaded', boot);
})();
