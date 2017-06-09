const spriteRegEx = /^(.*)(\?.*)$/;

function getSourceIdByRef(layers, ref) {
  var sourceId;
  layers.some(function(layer) {
    if (layer.id == ref) {
      sourceId = layer.source;
      return true;
    }
  });
  return sourceId;
}

function processStyle(glStyle, globe, baseUrl, path, accessToken) {
  if ('center' in glStyle) {
    // TODO calculate resolution / zoom
    // TODO decide if flyTo makes sense or not
    globe.camera.flyTo({
      destination : Cesium.Cartesian3.fromDegrees(glStyle.center[0], glStyle.center[1], 5000000)
    });
  }

  var glLayers = glStyle.layers;
  var layerIds = [];

  function finalizeLayer(layer) {
    if (layerIds.length > 0) {
      globe.scene.imageryLayers.add(layer);
    }
  }

  var glLayer, glSource, glSourceId, id, layer, mapid, url;
  for (var i = 0, ii = glLayers.length; i < ii; ++i) {
    glLayer = glLayers[i];
    if (glLayer.type == 'background') {
    } else {
      id = glLayer.source || getSourceIdByRef(glLayers, glLayer.ref);
      if (id != glSourceId) {
        finalizeLayer(layer);
        layerIds = [];
        glSource = glStyle.sources[id];
        url = glSource.url;
        var tiles = glSource.tiles;
        if (url) {
          if (url.indexOf('mapbox://') == 0) {
            mapid = url.replace('mapbox://', '');
            tiles = ['a', 'b', 'c', 'd'].map(function(host) {
              return 'https://' + host + '.tiles.mapbox.com/v4/' + mapid +
                  '/{z}/{x}/{y}.' +
                  (glSource.type == 'vector' ? 'vector.pbf' : 'png') +
                  accessToken;
            });
          }
        }
        if (glSource.type == 'vector') {
        } else if (glSource.type == 'raster') {
          var source;
          if (glSource.tiles) {
            var sourceUrl = url ? url : glSource.tiles[0];
            if (sourceUrl.toUpperCase().indexOf('SERVICE=WMS') !== -1) {
              var params = new URL(sourceUrl).searchParams;
              var layers = params.get("LAYERS");
              var format = params.get("FORMAT");
              sourceUrl = sourceUrl.split('?')[0];
              source = new Cesium.WebMapServiceImageryProvider({
                url: sourceUrl,
                layers: layers,
                parameters: {format: format}
              });
            } else {
              sourceUrl = sourceUrl.replace('{z}/{x}/{y}.png', '');
              source = Cesium.createOpenStreetMapImageryProvider({
                credit: glSource.attribution,
                tileWidth: glSource.tileSize || 512,
                tileHeight: glSource.tileSize || 512,
                minimumLevel: glSource.minzoom,
                maximumLevel: 'maxzoom' in glSource ? glSource.maxzoom : 22,
                url: sourceUrl
              });
            }
          }
          layer = new Cesium.ImageryLayer(source);
        }
        glSourceId = id;
      }
      layerIds.push(glLayer.id);
    }
  }
  finalizeLayer(layer);
}

export function apply(globe, style) {

  var accessToken, baseUrl, path;

  if (!(globe instanceof Cesium.CesiumWidget)) {
    globe = new Cesium.CesiumWidget(globe);
  }

  var parts = style.match(spriteRegEx);
  if (parts) {
    baseUrl = parts[1];
    accessToken = parts.length > 2 ? parts[2] : '';
  }
  var xhr = new XMLHttpRequest();
  xhr.open('GET', style);
  var a = document.createElement('A');
  a.href = style;
  path = a.pathname.split('/').slice(0, -1).join('/') + '/';
  xhr.addEventListener('load', function() {
    var glStyle = JSON.parse(xhr.responseText);
    processStyle(glStyle, globe, baseUrl, path, accessToken);
  });
  xhr.addEventListener('error', function() {
    throw new Error('Could not load ' + style);
  });
  xhr.send();

  return globe;
}

var globe = apply('map', 'wms.json');
