/* ============================================================
   cw-auto-fit.js - Auto Fit Layer to Panel
   ============================================================ */

'use strict';

CW.AutoFit = (function () {

  // ---- Image Type Classification ----

  function classifyImage(img) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var w = Math.min(iw, 256);
    var h = Math.min(ih, 256);
    if (w === 0 || h === 0) return 'photo';

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    var data;
    try { data = ctx.getImageData(0, 0, w, h).data; }
    catch (e) { return 'photo'; }

    var total = w * h;
    var transparentCount = 0;
    for (var i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 10) transparentCount++;
    }

    if (transparentCount / total > 0.15) return 'logo';

    var ratio = iw / ih;
    if (ratio > 3 || ratio < 0.33) return 'pattern';
    if (iw < 300 && ih < 300) return 'logo';

    return 'photo';
  }

  // ---- Focal Point Detection ----

  function detectFocalPoint(img) {
    var useSmartcrop = typeof smartcrop !== 'undefined';

    return new Promise(function (resolve) {
      if (useSmartcrop) {
        try {
          smartcrop.crop(img, { width: 100, height: 100 }).then(function (result) {
            if (result && result.topCrop) {
              var c = result.topCrop;
              var iw = img.naturalWidth || img.width;
              var ih = img.naturalHeight || img.height;
              resolve({
                x: (c.x + c.width / 2) / iw,
                y: (c.y + c.height / 2) / ih,
                source: 'smartcrop'
              });
            } else {
              resolve(heuristicFocal(img));
            }
          }).catch(function () {
            resolve(heuristicFocal(img));
          });
          return;
        } catch (e) { /* sync error */ }
      }
      resolve(heuristicFocal(img));
    });
  }

  function heuristicFocal(img) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (ih > iw) return { x: 0.5, y: 0.33, source: 'heuristic-portrait' };
    return { x: 0.5, y: 0.42, source: 'heuristic-landscape' };
  }

  function contentCenter(img) {
    try {
      var iw = img.naturalWidth || img.width;
      var ih = img.naturalHeight || img.height;
      var w = Math.min(iw, 256);
      var h = Math.min(ih, 256);
      if (w === 0 || h === 0) return { x: 0.5, y: 0.5 };

      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var data = ctx.getImageData(0, 0, w, h).data;

      var sumX = 0, sumY = 0, count = 0;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 30) { sumX += x; sumY += y; count++; }
        }
      }
      if (count === 0) return { x: 0.5, y: 0.5 };
      return { x: (sumX / count) / w, y: (sumY / count) / h };
    } catch (e) {
      return { x: 0.5, y: 0.5 };
    }
  }

  // ---- Apply Auto Fit ----

  function apply(layer) {
    if (!layer || !layer.image) return Promise.resolve(false);

    var img = layer.image;
    var imgW = img.naturalWidth || img.width;
    var imgH = img.naturalHeight || img.height;
    var canvasW = CW.state.internalWidth;
    var canvasH = CW.state.internalHeight;
    if (!canvasW || !canvasH || !imgW || !imgH) return Promise.resolve(false);

    // Save before values
    var before = {
      fillMode: layer.fillMode,
      scale: layer.scale,
      offsetX: layer.offsetX,
      offsetY: layer.offsetY
    };

    var type = classifyImage(img);

    var bounds = CW.PanelDetector.getPanelBounds(layer.selectedPanels);
    var boundsSource = 'panels';
    if (!bounds) {
      bounds = { x: 0, y: 0, w: canvasW, h: canvasH, cx: canvasW / 2, cy: canvasH / 2 };
      boundsSource = 'fullCanvas';
    }

    var resultPromise;
    if (type === 'logo') {
      resultPromise = applyLogo(layer, img, imgW, imgH, canvasW, canvasH, bounds);
    } else if (type === 'pattern') {
      resultPromise = applyPattern(layer);
    } else {
      resultPromise = applyPhoto(layer, img, imgW, imgH, canvasW, canvasH, bounds);
    }

    return resultPromise.then(function (info) {
      // Debug toast
      var msg = '[' + type + '] ' + (info.focalSource || '') +
        '\nBounds: ' + bounds.w + 'x' + bounds.h + ' center(' + Math.round(bounds.cx) + ',' + Math.round(bounds.cy) + ') ' + boundsSource +
        '\nBefore: mode=' + before.fillMode + ' s=' + before.scale.toFixed(2) + ' off(' + Math.round(before.offsetX) + ',' + Math.round(before.offsetY) + ')' +
        '\nAfter: mode=' + layer.fillMode + ' s=' + layer.scale.toFixed(2) + ' off(' + Math.round(layer.offsetX) + ',' + Math.round(layer.offsetY) + ')';
      console.log('[AutoFit]\n' + msg);

      return true;
    }).catch(function (e) {
      console.error('[AutoFit] error:', e);
      return false;
    });
  }

  function applyPhoto(layer, img, imgW, imgH, canvasW, canvasH, bounds) {
    return detectFocalPoint(img).then(function (focal) {
      var scale = Math.max(bounds.w / imgW, bounds.h / imgH) * 1.15;
      var offsetX = bounds.cx - canvasW / 2 - (focal.x - 0.5) * imgW * scale;
      var offsetY = bounds.cy - canvasH / 2 - (focal.y - 0.5) * imgH * scale;

      CW.LayerStore.update(layer.id, {
        fillMode: 'center',
        scale: scale,
        offsetX: offsetX,
        offsetY: offsetY,
        rotation: 0
      });
      return { focalSource: focal.source + ' (' + focal.x.toFixed(2) + ',' + focal.y.toFixed(2) + ')' };
    });
  }

  function applyLogo(layer, img, imgW, imgH, canvasW, canvasH, bounds) {
    var focal = contentCenter(img);
    var scale = Math.min(bounds.w / imgW, bounds.h / imgH) * 0.8;
    var offsetX = bounds.cx - canvasW / 2 - (focal.x - 0.5) * imgW * scale;
    var offsetY = bounds.cy - canvasH / 2 - (focal.y - 0.5) * imgH * scale;

    CW.LayerStore.update(layer.id, {
      fillMode: 'center',
      scale: scale,
      offsetX: offsetX,
      offsetY: offsetY,
      rotation: 0
    });
    return Promise.resolve({ focalSource: 'content-center' });
  }

  function applyPattern(layer) {
    CW.LayerStore.update(layer.id, {
      fillMode: 'tile',
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0
    });
    return Promise.resolve({ focalSource: 'pattern-tile' });
  }

  return { apply: apply };
})();
