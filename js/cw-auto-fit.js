/* ============================================================
   cw-auto-fit.js - Auto Fit Layer to Panel
   ============================================================ */

'use strict';

CW.AutoFit = (function () {

  // ---- Background Removal ----

  var removeBgFn = null;

  function loadRemoveBg() {
    if (removeBgFn) return Promise.resolve(removeBgFn);
    return import('https://esm.sh/@imgly/background-removal@1.5.8').then(function (module) {
      removeBgFn = module.removeBackground;
      return removeBgFn;
    });
  }

  function removeBackground(img, onProgress) {
    return loadRemoveBg().then(function (removeBg) {
      var canvas = document.createElement('canvas');
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0);
      var dataUrl = canvas.toDataURL('image/png');

      return fetch(dataUrl).then(function (r) { return r.blob(); }).then(function (blob) {
        return removeBg(blob, {
          model: 'isnet_quint8',
          output: { format: 'image/png', type: 'foreground' },
          progress: function (key, current, total) {
            if (onProgress && total > 0) onProgress(Math.round((current / total) * 100));
          }
        });
      });
    }).then(function (resultBlob) {
      return new Promise(function (resolve, reject) {
        var resultImg = new Image();
        resultImg.onload = function () {
          URL.revokeObjectURL(resultImg.src);
          resolve(resultImg);
        };
        resultImg.onerror = reject;
        resultImg.src = URL.createObjectURL(resultBlob);
      });
    });
  }

  // Check if image already has transparency (already bg-removed)
  function hasTransparency(img) {
    try {
      var w = Math.min(img.naturalWidth || img.width, 256);
      var h = Math.min(img.naturalHeight || img.height, 256);
      if (w === 0 || h === 0) return false;
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var data = ctx.getImageData(0, 0, w, h).data;
      var transparent = 0;
      var total = w * h;
      for (var i = 3; i < data.length; i += 4) {
        if (data[i] < 10) transparent++;
      }
      return (transparent / total) > 0.05;
    } catch (e) {
      return false;
    }
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
              resolve(contentCenter(img));
            }
          }).catch(function () {
            resolve(contentCenter(img));
          });
          return;
        } catch (e) { /* sync error */ }
      }
      resolve(contentCenter(img));
    });
  }

  // Find center of visible (non-transparent) content
  function contentCenter(img) {
    try {
      var iw = img.naturalWidth || img.width;
      var ih = img.naturalHeight || img.height;
      var w = Math.min(iw, 256);
      var h = Math.min(ih, 256);
      if (w === 0 || h === 0) return { x: 0.5, y: 0.5, source: 'default' };

      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var data = ctx.getImageData(0, 0, w, h).data;

      var sumX = 0, sumY = 0, count = 0;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 30) {
            sumX += x; sumY += y; count++;
          }
        }
      }
      if (count === 0) return { x: 0.5, y: 0.5, source: 'default' };
      return { x: (sumX / count) / w, y: (sumY / count) / h, source: 'content-center' };
    } catch (e) {
      return { x: 0.5, y: 0.5, source: 'default' };
    }
  }

  // ---- Apply Auto Fit ----

  function apply(layer, onProgress) {
    if (!layer || !layer.image) return Promise.resolve(false);

    var img = layer.image;
    var canvasW = CW.state.internalWidth;
    var canvasH = CW.state.internalHeight;
    if (!canvasW || !canvasH) return Promise.resolve(false);

    // Step 1: Remove background if image doesn't already have transparency
    var bgRemovePromise;
    if (hasTransparency(img)) {
      bgRemovePromise = Promise.resolve(img);
    } else {
      bgRemovePromise = removeBackground(img, onProgress).then(function (newImg) {
        // Update layer image with bg-removed version
        CW.LayerStore.updateImage(layer.id, newImg);
        return newImg;
      });
    }

    // Step 2: After bg removal, detect focal point and position
    return bgRemovePromise.then(function (processedImg) {
      var imgW = processedImg.naturalWidth || processedImg.width;
      var imgH = processedImg.naturalHeight || processedImg.height;
      if (!imgW || !imgH) return false;

      var bounds = CW.PanelDetector.getPanelBounds(layer.selectedPanels);
      if (!bounds) {
        bounds = { x: 0, y: 0, w: canvasW, h: canvasH, cx: canvasW / 2, cy: canvasH / 2 };
      }

      return detectFocalPoint(processedImg).then(function (focal) {
        // Scale: cover panel bounds + 15% margin
        var scale = Math.max(bounds.w / imgW, bounds.h / imgH) * 1.15;

        // Offset: place focal point at panel center
        var offsetX = bounds.cx - canvasW / 2 - (focal.x - 0.5) * imgW * scale;
        var offsetY = bounds.cy - canvasH / 2 - (focal.y - 0.5) * imgH * scale;

        console.log('[AutoFit] focal=' + focal.source +
          ' (' + focal.x.toFixed(2) + ',' + focal.y.toFixed(2) + ')' +
          ' scale=' + scale.toFixed(3) +
          ' offset=(' + Math.round(offsetX) + ',' + Math.round(offsetY) + ')' +
          ' bounds=' + bounds.w + 'x' + bounds.h +
          ' center(' + Math.round(bounds.cx) + ',' + Math.round(bounds.cy) + ')');

        CW.LayerStore.update(layer.id, {
          fillMode: 'center',
          scale: scale,
          offsetX: offsetX,
          offsetY: offsetY,
          rotation: 0
        });

        return true;
      });
    }).catch(function (e) {
      console.error('[AutoFit] error:', e);
      return false;
    });
  }

  return { apply: apply };
})();
