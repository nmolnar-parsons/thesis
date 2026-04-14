//   Register to get your Mapbox access token https://docs.mapbox.com/help/glossary/access-token/
//   Code from https://docs.mapbox.com/help/tutorials/custom-markers-gl-js/ 

mapboxgl.accessToken = ''; // set a local token before running the prototype

// State for controls
let currentYear = 2020;
let currentType = 'count';

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [0, 0],
  zoom: 1.5,
  renderWorldCopies: true
});

// Add geojson grid layer when map is loaded
map.on('load', function() {
  map.addSource('cwp-grid', {
    type: 'geojson',
    data: 'data/cwp-grid-5deg-var3.geojson'
  });

  // map.addLayer({
  //   id: 'cwp-grid-fill',
  //   type: 'fill',
  //   source: 'cwp-grid',
  //   paint: {
  //     'fill-color': '#0080ff',
  //     'fill-opacity': 0.4
  //   }
  // });

  // map.addLayer({
  //   id: 'cwp-grid-outline',
  //   type: 'line',
  //   source: 'cwp-grid',
  //   paint: { 'line-color': '#005bb5', 'line-width': 0.5 }
  // });

  // Add tuna catch data
  map.addSource('tuna-catch', {
    type: 'geojson',
    data: 'data/tuna_data/cwp-grid-5deg-catch.geojson'
  });

  map.addLayer({
    id: 'tuna-catch-fill',
    type: 'fill',
    source: 'tuna-catch',
    paint: {
      'fill-color': [
        'interpolate', ['linear'],
        ['coalesce', ['get', 'count_2020'], 0],
        0,    '#fff5f0',
        100,  '#fee0d2',
        500,  '#fcbba1',
        1000, '#fc9272',
        5000, '#fb6a4a',
        10000,'#de2d26',
        50000,'#a50f15',
        100000,'#67000d'
      ],
      'fill-opacity': 0.7
    }
  });

  // Setup slider control
  const yearSlider = document.getElementById('yearSlider');
  if (yearSlider) {
    yearSlider.addEventListener('input', function(e) {
      currentYear = parseInt(e.target.value);
      document.getElementById('yearValue').textContent = currentYear;
      updateMapLayer();
    });
  }

  // Setup toggle buttons
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      toggleBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentType = this.dataset.type;
      updateMapLayer();
    });
  });

  // map.addLayer({
  //   id: 'tuna-catch-outline',
  //   type: 'line',
  //   source: 'tuna-catch',
  //   paint: { 'line-color': '#8B0000', 'line-width': 0.1 }
  // });
});

// Function to update the map layer based on current year and type
function updateMapLayer() {
  const propertyName = currentType + '_' + currentYear;
  
  map.setPaintProperty('tuna-catch-fill', 'fill-color', [
    'interpolate', ['linear'],
    ['coalesce', ['get', propertyName], 0],
    0,    '#fff5f0',
    100,  '#fee0d2',
    500,  '#fcbba1',
    1000, '#fc9272',
    5000, '#fb6a4a',
    10000,'#de2d26',
    50000,'#a50f15',
    100000,'#67000d'
  ]);
}

// Setup projection selector
const projectionSelect = document.getElementById('projectionSelect');
if (projectionSelect) {
  projectionSelect.addEventListener('change', function(e) {
    const projectionMap = {
      'mercator': 'mercator',
      'equirectangular': 'equirectangular',
      'naturalEarth': 'naturalEarth',
      'winkelTripel': 'winkelTripel'
    };
    map.setProjection(projectionMap[e.target.value]);
  });
}




/*** load data ***/
async function loadData() {
  const airports = await d3.csv('data/airports.csv');

  // add markers to map
  airports.forEach(function(d) {

  // create a HTML element for each feature
  var el = document.createElement('div');
  el.className = 'marker';

  // make a marker for each feature and add to the map
  new mapboxgl.Marker(el)
    .setLngLat([d.longitude, d.latitude])
    .setPopup(new mapboxgl.Popup({ offset: 25 }) // add popups
    .setHTML('<h3>' + d.name + '</h3>'))
    .addTo(map);
  });
}

// loadData();