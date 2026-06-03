// Shared CoastlineGuessr logic: maps, scoring, pins, coast pool, modes.

const MODES = {
  Easy:   { mult:1,   zoomAdj:-3, time:35 },
  Medium: { mult:1.5, zoomAdj:-2, time:26 },
  Hard:   { mult:2,   zoomAdj:-1, time:20 },
  Expert: { mult:3,   zoomAdj:0,  time:16 },
};

const PLAYER_COLORS = ["#e07a5f","#2a7f6f","#d4a017","#3d6db5","#9b5de5","#e36414","#06a77d","#bc4749"];

const COASTS = [
  ["the southern coast of England",50.75,-1.3,8],["the fjords of western Norway",60.39,5.32,8],["the Lofoten Islands, Norway",68.15,13.61,8],
  ["the Amalfi coast of Italy",40.63,14.6,9],["the Venetian lagoon, Italy",45.43,12.33,9],["the Croatian Adriatic coast",43.51,16.44,9],
  ["the Greek island of Rhodes",36.43,28.22,9],["the island of Santorini, Greece",36.39,25.46,10],["the coast of Athens, Greece",37.94,23.65,9],
  ["the coast of Lisbon, Portugal",38.7,-9.42,9],["the Algarve coast, Portugal",37.09,-8.25,9],["the Brittany coast of France",48.39,-4.49,8],
  ["the French Riviera at Nice",43.66,7.21,9],["the west coast of Ireland",53.27,-9.05,8],["the coast of Dublin, Ireland",53.35,-6.2,9],
  ["the Icelandic coast near Reykjavik",64.13,-21.94,7],["the Scottish Highlands coast",57.68,-3.97,8],["the Isle of Skye, Scotland",57.27,-6.21,8],
  ["the Costa Brava of Spain",41.92,3.16,9],["the coast of Barcelona, Spain",41.36,2.19,9],["the coast of Valencia, Spain",39.45,-0.33,9],
  ["the Bay of Biscay at Bilbao",43.36,-3.0,9],["the Danish coast near Copenhagen",55.68,12.57,8],["the Wadden coast of the Netherlands",53.18,5.4,8],
  ["the coast of Amsterdam, Netherlands",52.37,4.9,9],["the Belgian coast at Ostend",51.23,2.92,9],["the German Baltic coast at Rostock",54.09,12.1,8],
  ["the Stockholm archipelago, Sweden",59.32,18.4,9],["the coast of Gothenburg, Sweden",57.7,11.85,9],["the Helsinki coast, Finland",60.16,24.94,9],
  ["the Estonian coast at Tallinn",59.44,24.75,9],["the coast of Gdansk, Poland",54.35,18.65,9],["the Sicilian coast, Italy",37.5,15.09,9],
  ["the coast of Sardinia, Italy",39.22,9.12,9],["the Maltese coast",35.9,14.51,10],["the Cornwall coast, England",50.26,-5.05,8],
  ["the coast of Brighton, England",50.82,-0.14,9],["the coast of Marseille, France",43.3,5.37,9],["the Faroe Islands",62.01,-6.77,9],
  ["the coast of Crete, Greece",35.34,25.13,9],["the Bosphorus at Istanbul, Turkey",41.02,29.0,9],["the Turkish coast at Antalya",36.85,30.7,9],
  ["the Cape Town coast, South Africa",-33.9,18.42,8],["the coast of Durban, South Africa",-29.86,31.03,9],["the Garden Route, South Africa",-34.05,23.37,8],
  ["the coast near Dakar, Senegal",14.69,-17.45,8],["the Red Sea coast of Egypt",27.26,33.81,8],["the coast of Alexandria, Egypt",31.2,29.92,9],
  ["the Kenyan coast at Mombasa",-4.04,39.67,8],["the island of Zanzibar, Tanzania",-6.16,39.2,9],["the Moroccan Atlantic coast at Casablanca",33.59,-7.62,8],
  ["the coast of Tangier, Morocco",35.78,-5.81,9],["the coast of Madagascar at Toamasina",-18.15,49.4,8],["the coast of Tunis, Tunisia",36.81,10.18,9],
  ["the Libyan coast at Tripoli",32.89,13.18,9],["the Algerian coast at Algiers",36.75,3.06,9],["the coast of Lagos, Nigeria",6.45,3.4,9],
  ["the coast of Accra, Ghana",5.55,-0.2,9],["the coast of Abidjan, Ivory Coast",5.31,-4.01,9],["the coast of Luanda, Angola",-8.84,13.23,9],
  ["the Namibian coast at Walvis Bay",-22.95,14.51,8],["the Mozambique coast at Maputo",-25.97,32.57,9],["the coast of Mauritius",-20.16,57.5,9],
  ["the Seychelles coast",-4.62,55.45,10],["the coast of Djibouti",11.59,43.15,9],["the coast of Honshu near Tokyo, Japan",35.3,139.67,8],
  ["the coast of Osaka, Japan",34.65,135.43,9],["the coast of Okinawa, Japan",26.34,127.8,9],["the coast of Hokkaido, Japan",43.2,141.0,8],
  ["the island of Taiwan at Taipei",25.1,121.55,9],["the coast near Busan, South Korea",35.1,129.04,8],["the coast of Incheon, South Korea",37.45,126.6,9],
  ["the Vietnamese coast at Da Nang",16.05,108.22,8],["the coast of Ha Long Bay, Vietnam",20.91,107.18,9],["the coast of Ho Chi Minh delta, Vietnam",10.35,106.95,9],
  ["the island of Bali, Indonesia",-8.65,115.13,9],["the coast of Jakarta, Indonesia",-6.11,106.83,9],["the coast of Lombok, Indonesia",-8.65,116.32,9],
  ["the coast of Phuket, Thailand",7.89,98.3,9],["the coast of Bangkok bay, Thailand",13.45,100.59,9],["the coast near Chennai, India",13.08,80.27,8],
  ["the coast of Goa, India",15.3,73.91,9],["the coast of Mumbai, India",19.05,72.85,9],["the coast of Kerala at Kochi, India",9.97,76.27,9],
  ["the coast near Dubai, UAE",25.2,55.27,8],["the coast of Muscat, Oman",23.61,58.59,9],["the coast of Sri Lanka near Colombo",6.93,79.85,8],
  ["the Hong Kong coastline",22.28,114.16,9],["the coast of Shanghai, China",31.23,121.47,9],["the coast of Qingdao, China",36.07,120.38,9],
  ["the coast of Hainan, China",18.25,109.51,8],["the coast of Manila Bay, Philippines",14.58,120.9,8],["the coast of Cebu, Philippines",10.32,123.89,9],
  ["the coast of Penang, Malaysia",5.41,100.33,9],["the Singapore coastline",1.29,103.85,10],["the coast of Karachi, Pakistan",24.86,67.01,9],
  ["the coast of Beirut, Lebanon",33.89,35.5,9],["the coast of Tel Aviv, Israel",32.08,34.77,9],["the coast of Vladivostok, Russia",43.12,131.89,9],
  ["the coast of Jeddah, Saudi Arabia",21.49,39.18,9],["the coast near Sydney, Australia",-33.87,151.21,8],["the coast of Melbourne, Australia",-37.86,144.95,9],
  ["the coast near Perth, Australia",-31.95,115.86,8],["the Great Barrier Reef coast, Cairns",-16.92,145.77,8],["the Gold Coast, Australia",-28.0,153.43,9],
  ["the coast of Adelaide, Australia",-34.93,138.5,9],["the coast of Darwin, Australia",-12.46,130.84,9],["the coast near Auckland, New Zealand",-36.85,174.76,8],
  ["the South Island coast at Christchurch, NZ",-43.53,172.62,8],["the coast of Wellington, New Zealand",-41.29,174.78,9],["the island of Tasmania at Hobart",-42.88,147.33,8],
  ["the coast of Fiji",-18.14,178.44,9],["the coast of New Caledonia",-22.27,166.45,9],["the coast of Tahiti",-17.65,-149.43,9],
  ["the coast of Samoa",-13.83,-171.77,9],["the coast of Guam",13.44,144.79,9],["the coast of Vanuatu",-17.74,168.31,9],
  ["the coast of San Francisco, USA",37.77,-122.42,9],["the coast of Los Angeles, USA",33.9,-118.4,9],["the coast of San Diego, USA",32.72,-117.16,9],
  ["the coast of Miami, USA",25.77,-80.19,9],["the coast of Cape Cod, USA",41.67,-70.3,8],["the coast near Seattle, USA",47.61,-122.34,8],
  ["the coast of New York City, USA",40.65,-74.0,9],["the Outer Banks, North Carolina, USA",35.56,-75.47,8],["the coast of New Orleans, USA",29.95,-90.07,9],
  ["the coast of Honolulu, Hawaii, USA",21.31,-157.86,9],["the coast of Maui, Hawaii, USA",20.8,-156.33,9],["the Florida Keys, USA",24.66,-81.45,9],
  ["the coast of Galveston, Texas, USA",29.3,-94.8,9],["the coast of Portland, Maine, USA",43.66,-70.25,9],["the coast of Nova Scotia, Canada",44.65,-63.57,8],
  ["the coast near Vancouver, Canada",49.28,-123.12,8],["the coast of Newfoundland, Canada",47.56,-52.71,8],["the coast of Victoria, BC, Canada",48.43,-123.37,9],
  ["the Yucatán coast at Cancún, Mexico",21.16,-86.85,9],["the Baja California coast at Cabo, Mexico",22.89,-109.91,8],["the coast of Puerto Vallarta, Mexico",20.65,-105.23,9],
  ["the coast of Acapulco, Mexico",16.86,-99.88,9],["the coast of Veracruz, Mexico",19.17,-96.13,9],["the coast of Havana, Cuba",23.13,-82.38,9],
  ["the coast of Kingston, Jamaica",17.97,-76.79,9],["the coast of San Juan, Puerto Rico",18.47,-66.11,9],["the coast of Nassau, Bahamas",25.06,-77.34,9],
  ["the coast of Santo Domingo, Dominican Republic",18.47,-69.89,9],["the coast of Panama City, Panama",8.98,-79.52,9],["the coast of Belize",17.5,-88.2,9],
  ["the coast of Costa Rica at Puntarenas",9.98,-84.83,9],["the coast of Rio de Janeiro, Brazil",-22.95,-43.18,8],["the coast near Salvador, Brazil",-12.97,-38.5,8],
  ["the coast of Recife, Brazil",-8.05,-34.88,9],["the coast of Florianopolis, Brazil",-27.59,-48.55,9],["the coast of Fortaleza, Brazil",-3.73,-38.52,9],
  ["the coast near Valparaíso, Chile",-33.05,-71.62,8],["the coast of Lima, Peru",-12.05,-77.04,8],["the Caribbean coast of Cartagena, Colombia",10.39,-75.51,9],
  ["the coast near Buenos Aires estuary, Argentina",-34.61,-58.37,8],["the Galápagos coast, Ecuador",-0.74,-90.31,9],["the coast of Montevideo, Uruguay",-34.9,-56.16,8],
  ["the coast of Guayaquil, Ecuador",-2.2,-79.9,9],["the coast of Caracas, Venezuela",10.6,-66.98,9],["the Patagonian coast at Puerto Madryn, Argentina",-42.77,-65.04,8],
  ["the coast of Punta Arenas, Chile",-53.16,-70.91,8],["the coast of Mar del Plata, Argentina",-38.0,-57.55,9],
];

function shuffle(a){ a=[...a]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function regionOf(name){ const p=name.split(","); return p[p.length-1].trim(); }
function distKm(aLat,aLon,bLat,bLon){
  const R=6371,toR=d=>d*Math.PI/180;
  const dLat=toR(bLat-aLat),dLon=toR(bLon-aLon);
  const s=Math.sin(dLat/2)**2+Math.cos(toR(aLat))*Math.cos(toR(bLat))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
}
function baseScore(km){ return Math.max(0, Math.round(1000*Math.exp(-km/1100))); }
function pin(color){
  return L.divIcon({ className:'', html:`<div style="width:22px;height:22px;background:${color};border:3px solid #0d1b2a;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:2px 2px 5px rgba(0,0,0,0.4)"></div>`, iconSize:[22,22], iconAnchor:[11,22] });
}
function addImagery(map, onLoaded){
  const esri = L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom:18, crossOrigin:true });
  const fallback = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}{r}.png", { maxZoom:18, subdomains:'abcd' });
  let switched=false;
  esri.on('tileerror', ()=>{ if(switched)return; switched=true; map.removeLayer(esri); fallback.addTo(map); });
  esri.on('load', ()=>{ if(onLoaded) onLoaded(); });
  fallback.on('load', ()=>{ if(onLoaded) onLoaded(); });
  esri.addTo(map);
}
function streetLayer(map){
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom:18, subdomains:'abcd' })
    .on('tileerror', function(){ if(this._fb)return; this._fb=true; L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18}).addTo(map); })
    .addTo(map);
}

window.CLG = { MODES, PLAYER_COLORS, COASTS, shuffle, regionOf, distKm, baseScore, pin, addImagery, streetLayer };

// HMAC token for anti-tamper verification. Rotates every 5 minutes.
const _SOLO_SALT = '9352fdd7eaaeb81d318a043c359372411ef97d3fa70286b2';
const _MULTI_SALT = 'd36892e33860a916b0af6f22056dade962d216eb7f479518';
async function _hmacToken(salt){
  const win = Math.floor(Date.now()/1000/300).toString();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(salt), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(salt+win));
  return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function soloToken(){ return _hmacToken(_SOLO_SALT); }
async function multiToken(){ return _hmacToken(_MULTI_SALT); }
Object.assign(window.CLG, { soloToken, multiToken });
