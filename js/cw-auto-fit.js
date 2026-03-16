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
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch (e) {
      return 'photo';
    }

    var total = w * h;
    var transparentCount = 0;

    for (var i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 10) transparentCount++;
    }

    var transparentRatio = transparentCount / total;

    // Has significant transparency → logo/icon
    if (transparentRatio > 0.15) return 'logo';

    // Aspect ratio check
    var ratio = iw / ih;
    if (ratio > 3 || ratio < 0.33) return 'pattern';

    // Small image → icon
    if (iw < 300 && ih < 300) return 'logo';

    return 'photo';
  }

  // ---- Focal Point Detection ----

  function detectFocalPoint(img) {
    var useSmartcrop = typeof smartcrop !== 'undefined';
    console.log('[AutoFit] smartcrop available:', useSmartcrop);

    return new Promise(function (resolve) {
      if (useSmartcrop) {
        try {
          smartcrop.crop(img, { width: 100, height: 100 }).then(function (result) {
            if (result && result.topCrop) {
              var c = result.topCrop;
              var focal = {
                x: (c.x + c.width / 2) / (img.naturalWidth || img.width),
                y: (c.y + c.height / 2) / (img.naturalHeight || img.height)
              };
              console.log('[AutoFit] smartcrop focal:', focal.x.toFixed(3), focal.y.toFixed(3));
              resolve(focal);
            } else {
              resolve(heuristicFocal(img));
            }
          }).catch(function (e) {
            console.warn('[AutoFit] smartcrop failed:', e);
            resolve(heuristicFocal(img));
          });
          return;
        } catch (e) {
          console.warn('[AutoFit] smartcrop sync error:', e);
        }
      }
      resolve(heuristicFocal(img));
    });
  }

  // Heuristic focal point for opaque photos (JPEG etc.)
  // Portrait-oriented → assume face in upper 35%
  // Landscape-oriented → center
  function heuristicFocal(img) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;

    // Portrait orientation: face is typically in upper third
    if (ih > iw) {
      console.log('[AutoFit] heuristic: portrait orientation, focal upper-center');
      return { x: 0.5, y: 0.35 };
    }

    // Landscape: subject typically center
    console.log('[AutoFit] heuristic: landscape orientation, focal center');
    return { x: 0.5, y: 0.45 };
  }

  // Focal point for transparent images (logo/icon)
  function contentCenter(img) {
    try {
      var iw = img.naturalWidth || img.width;
      var ih = img.naturalHeight || img.height;
      var w = Math.min(iw, 256);
      var h = Math.min(ih, 256);
      if (w === 0 || h === 0) return { x: 0.5, y: 0.5 };

      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var data = ctx.getImageData(0, 0, w, h).data;

      var sumX = 0, sumY = 0, count = 0;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 30) {
            sumX += x;
            sumY += y;
            count++;
          }
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

    var type = classifyImage(img);
    console.log('[AutoFit] image type:', type, 'size:', imgW + 'x' + imgH);

    var bounds = CW.PanelDetector.getPanelBounds(layer.selectedPanels);
    if (!bounds) {
      bounds = { x: 0, y: 0, w: canvasW, h: canvasH, cx: canvasW / 2, cy: canvasH / 2 };
    }
    console.log('[AutoFit] bounds:', JSON.stringify(bounds));

    if (type === 'logo') {
      return applyLogo(layer, img, imgW, imgH, canvasW, canvasH, bounds);
    } else if (type === 'pattern') {
      return applyPattern(layer, bounds);
    } else {
      return applyPhoto(layer, img, imgW, imgH, canvasW, canvasH, bounds);
    }
  }

  // Photo/portrait: cover panel area, center focal point on panel
  function applyPhoto(layer, img, imgW, imgH, canvasW, canvasH, bounds) {
    return detectFocalPoint(img).then(function (focal) {
      // Scale to cover panel bounds + margin
      var scale = Math.max(bounds.w / imgW, bounds.h / imgH) * 1.15;

      // Move focal point to panel center
      var offsetX = bounds.cx - canvasW / 2 - (focal.x - 0.5) * imgW * scale;
      var offsetY = bounds.cy - canvasH / 2 - (focal.y - 0.5) * imgH * scale;

      console.log('[AutoFit] photo result: scale=' + scale.toFixed(3) +
        ' offset=(' + offsetX.toFixed(1) + ',' + offsetY.toFixed(1) + ')' +
        ' focal=(' + focal.x.toFixed(3) + ',' + focal.y.toFixed(3) + ')');

      CW.LayerStore.update(layer.id, {
        fillMode: 'center',
        scale: scale,
        offsetX: offsetX,
        offsetY: offsetY,
        rotation: 0
      });
      return true;
    }).catch(function (e) {
      console.error('[AutoFit] error:', e);
      return false;
    });
  }

  // Logo/icon: fit inside panel with padding
  function applyLogo(layer, img, imgW, imgH, canvasW, canvasH, bounds) {
    var focal = contentCenter(img);
    // Fit inside panel with 20% padding
    var scale = Math.min(bounds.w / imgW, bounds.h / imgH) * 0.8;

    var offsetX = bounds.cx - canvasW / 2 - (focal.x - 0.5) * imgW * scale;
    var offsetY = bounds.cy - canvasH / 2 - (focal.y - 0.5) * imgH * scale;

    console.log('[AutoFit] logo result: scale=' + scale.toFixed(3) +
      ' offset=(' + offsetX.toFixed(1) + ',' + offsetY.toFixed(1) + ')');

    CW.LayerStore.update(layer.id, {
      fillMode: 'center',
      scale: scale,
      offsetX: offsetX,
      offsetY: offsetY,
      rotation: 0
    });
    return Promise.resolve(true);
  }

  // Pattern/texture: tile from origin
  function applyPattern(layer, bounds) {
    CW.LayerStore.update(layer.id, {
      fillMode: 'tile',
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      rotation: 0
    });
    return Promise.resolve(true);
  }

  return { apply: apply };
})();
