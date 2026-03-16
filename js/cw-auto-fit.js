/* ============================================================
   cw-auto-fit.js - Auto Fit Layer to Panel
   ============================================================ */

'use strict';

CW.AutoFit = (function () {

  function detectFocalPoint(img) {
    return new Promise(function (resolve) {
      if (typeof smartcrop !== 'undefined') {
        try {
          smartcrop.crop(img, { width: 100, height: 100 }).then(function (result) {
            if (result && result.topCrop) {
              var c = result.topCrop;
              resolve({
                x: (c.x + c.width / 2) / (img.naturalWidth || img.width),
                y: (c.y + c.height / 2) / (img.naturalHeight || img.height)
              });
            } else {
              resolve(fallbackFocalPoint(img));
            }
          }).catch(function () {
            resolve(fallbackFocalPoint(img));
          });
          return;
        } catch (e) {
          // smartcrop threw synchronously
        }
      }
      resolve(fallbackFocalPoint(img));
    });
  }

  function fallbackFocalPoint(img) {
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
          var idx = (y * w + x) * 4;
          if (data[idx + 3] > 30 && (data[idx] + data[idx + 1] + data[idx + 2]) < 700) {
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

  function apply(layer) {
    if (!layer || !layer.image) return Promise.resolve(false);

    var img = layer.image;
    var imgW = img.naturalWidth || img.width;
    var imgH = img.naturalHeight || img.height;
    var canvasW = CW.state.internalWidth;
    var canvasH = CW.state.internalHeight;
    if (!canvasW || !canvasH || !imgW || !imgH) return Promise.resolve(false);

    var bounds = CW.PanelDetector.getPanelBounds(layer.selectedPanels);
    if (!bounds) {
      bounds = { x: 0, y: 0, w: canvasW, h: canvasH, cx: canvasW / 2, cy: canvasH / 2 };
    }

    console.log('[AutoFit] imgW=' + imgW + ' imgH=' + imgH + ' canvasW=' + canvasW + ' canvasH=' + canvasH);
    console.log('[AutoFit] bounds:', JSON.stringify(bounds));

    return detectFocalPoint(img).then(function (focal) {
      console.log('[AutoFit] focal:', JSON.stringify(focal));

      // Renderer fit mode: actualPixelScale = min(canvasW/imgW, canvasH/imgH) * layer.scale
      // Image center drawn at (canvasW/2 + offsetX, canvasH/2 + offsetY)
      var baseFit = Math.min(canvasW / imgW, canvasH / imgH);

      // layer.scale multiplier to cover panel bounds + 10% margin
      var coverScale = Math.max(bounds.w / imgW, bounds.h / imgH) * 1.1;
      var layerScale = coverScale / baseFit;
      var actual = baseFit * layerScale;

      // Offset to place focal point at panel center
      var offsetX = bounds.cx - canvasW / 2 - (focal.x - 0.5) * imgW * actual;
      var offsetY = bounds.cy - canvasH / 2 - (focal.y - 0.5) * imgH * actual;

      console.log('[AutoFit] layerScale=' + layerScale.toFixed(3) + ' offsetX=' + offsetX.toFixed(1) + ' offsetY=' + offsetY.toFixed(1));

      CW.LayerStore.update(layer.id, {
        fillMode: 'fit',
        scale: layerScale,
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

  return { apply: apply };
})();
