/* ============================================================
   cw-auto-fit.js - Batch Background Removal for All Layers
   ============================================================ */

'use strict';

CW.AutoFit = (function () {

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

  function removeAllBackgrounds(onProgress) {
    var layers = CW.LayerStore.getAll();
    var toProcess = [];
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].image && !hasTransparency(layers[i].image)) {
        toProcess.push(layers[i]);
      }
    }
    if (toProcess.length === 0) {
      if (onProgress) onProgress(100, 0, 0);
      return Promise.resolve();
    }

    var done = 0;
    var total = toProcess.length;

    function processNext(idx) {
      if (idx >= toProcess.length) return Promise.resolve();
      var layer = toProcess[idx];
      return removeBackground(layer.image, function (pct) {
        if (onProgress) {
          var overall = Math.round(((done + pct / 100) / total) * 100);
          onProgress(overall, done + 1, total);
        }
      }).then(function (newImg) {
        CW.LayerStore.updateImage(layer.id, newImg);
        done++;
        if (onProgress) onProgress(Math.round((done / total) * 100), done, total);
        return processNext(idx + 1);
      });
    }

    return processNext(0);
  }

  return { removeAllBackgrounds: removeAllBackgrounds };
})();
