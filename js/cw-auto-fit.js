/* ============================================================
   cw-auto-fit.js - Auto Fit Layer to Panel
   ============================================================ */

'use strict';

CW.AutoFit = (function () {

  /**
   * Detect focal point using smartcrop.js (face/saliency detection).
   * Falls back to pixel-based center if smartcrop unavailable.
   */
  function detectFocalPoint(img) {
    return new Promise(function (resolve) {
      if (typeof smartcrop === 'undefined') {
        resolve(fallbackFocalPoint(img));
        return;
      }
      smartcrop.crop(img, { width: 100, height: 100 }).then(function (result) {
        if (result && result.topCrop) {
          var c = result.topCrop;
          resolve({
            x: (c.x + c.width / 2) / img.naturalWidth,
            y: (c.y + c.height / 2) / img.naturalHeight
          });
        } else {
          resolve(fallbackFocalPoint(img));
        }
      }).catch(function () {
        resolve(fallbackFocalPoint(img));
      });
    });
  }

  /**
   * Fallback: find content center by scanning non-transparent pixels.
   */
  function fallbackFocalPoint(img) {
    var w = Math.min(img.naturalWidth, 256);
    var h = Math.min(img.naturalHeight, 256);
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
        var a = data[idx + 3];
        var brightness = data[idx] + data[idx + 1] + data[idx + 2];
        // Weight by alpha and content (non-white, non-transparent)
        if (a > 30 && brightness < 700) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    if (count === 0) {
      return { x: 0.5, y: 0.5 };
    }
    return {
      x: (sumX / count) / w,
      y: (sumY / count) / h
    };
  }

  /**
   * Compute scale and offset to fit image into panel bounds,
   * centering the focal point on the panel center.
   */
  function computeFit(imgW, imgH, canvasW, canvasH, bounds, focal) {
    // Scale: cover the panel bounds with 1.1x margin
    var scaleX = bounds.w / imgW;
    var scaleY = bounds.h / imgH;
    var scale = Math.max(scaleX, scaleY) * 1.1;

    // Offset: align focal point to panel center
    // In the rendering system, offsetX/Y are pixel offsets in canvas space
    // The image is drawn centered on the canvas, then offset is applied
    var imgCenterX = canvasW / 2;
    var imgCenterY = canvasH / 2;

    // Where the focal point would be without offset (image centered on canvas)
    var focalCanvasX = imgCenterX + (focal.x - 0.5) * imgW * scale;
    var focalCanvasY = imgCenterY + (focal.y - 0.5) * imgH * scale;

    // We want focal point at panel center
    var offsetX = bounds.cx - focalCanvasX;
    var offsetY = bounds.cy - focalCanvasY;

    return {
      scale: scale,
      offsetX: offsetX,
      offsetY: offsetY
    };
  }

  /**
   * Main entry: apply auto-fit to a layer.
   * Returns a Promise that resolves when done.
   */
  function apply(layer) {
    if (!layer || !layer.image) {
      return Promise.resolve(false);
    }

    var img = layer.image;
    var imgW = img.naturalWidth || img.width;
    var imgH = img.naturalHeight || img.height;
    var canvasW = CW.state.internalWidth;
    var canvasH = CW.state.internalHeight;

    if (!canvasW || !canvasH) return Promise.resolve(false);

    // Get panel bounds from selected panels
    var bounds = CW.PanelDetector.getPanelBounds(layer.selectedPanels);
    if (!bounds) {
      // Fallback: use entire canvas
      bounds = { x: 0, y: 0, w: canvasW, h: canvasH, cx: canvasW / 2, cy: canvasH / 2 };
    }

    return detectFocalPoint(img).then(function (focal) {
      var fit = computeFit(imgW, imgH, canvasW, canvasH, bounds, focal);

      // Apply to layer
      layer.fillMode = 'fit';
      layer.scale = fit.scale;
      layer.offsetX = fit.offsetX;
      layer.offsetY = fit.offsetY;
      layer.rotation = 0;

      CW.emit('layer:updated', layer.id);
      CW.emit('render:request');

      return true;
    });
  }

  return {
    apply: apply
  };
})();
