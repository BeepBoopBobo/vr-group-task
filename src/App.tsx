import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { Feature, Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { OSM, Vector as VectorSource } from 'ol/source.js';
import { getLength } from 'ol/sphere.js';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Stroke, Style } from 'ol/style.js';
import VectorLayer from 'ol/layer/Vector';
import { LineString } from 'ol/geom';
interface coords {
  lat: number | null,
  long: number | null,
}
interface line {
  firstPointCoords: coords,
  secondPointCoords: coords,
  distanceBetweenPoints: number | null,
}

enum menuOptions { distance = "Measure line", angle = "Measure angle", freeDraw = "Free draw" };

function App() {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource>(new VectorSource());
  const [mapLine, setLine] = useState<line>(
    { firstPointCoords: { lat: null, long: null }, secondPointCoords: { lat: null, long: null }, distanceBetweenPoints: null }
  );
  const [activeMenuOpt, setActiveMenuOpt] = useState<menuOptions>(menuOptions.distance);

  useEffect(() => {
    console.log("effect", mapLine);
  }, [mapLine]);


  useEffect(() => {
    if (mapElement.current && !mapRef.current) {
      const vectorLayer = new VectorLayer({
        source: vectorSourceRef.current,
      });

      mapRef.current = new Map({
        view: new View({
          center: [0, 0],
          zoom: 0,
        }),
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
          vectorLayer,
        ],
        target: mapElement.current,
      });

      mapRef.current.on('click', handleMapClick);
    }
  }, []);

  const calculateDistance = (point1: coords, point2: coords): number => {
    const coord1 = fromLonLat([point1.long!, point1.lat!]);
    const coord2 = fromLonLat([point2.long!, point2.lat!]);
    const line = new LineString([coord1, coord2]);
    return getLength(line);
  };

  const drawLine = (point1: coords, point2: coords) => {
    const coord1 = fromLonLat([point1.long!, point1.lat!]);
    const coord2 = fromLonLat([point2.long!, point2.lat!]);
    const line = new LineString([coord1, coord2]);

    const lineFeature = new Feature({
      geometry: line
    });

    lineFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: '#ffcc33',
          width: 2
        })
      })
    );
    vectorSourceRef.current.clear();
    vectorSourceRef.current.addFeature(lineFeature);
  };

  const handleMapClick = (event: any) => {
    const coords = event.coordinate;
    const [lon, lat] = toLonLat(coords);

    switch (activeMenuOpt) {
      case menuOptions.distance:
        setLine((prevState) => {
          const newLine = { ...prevState };
          if (prevState.firstPointCoords.lat === null) {
            newLine.firstPointCoords = { lat: lat, long: lon };
          } else if (prevState.secondPointCoords.lat === null) {
            newLine.secondPointCoords = { lat: lat, long: lon };
            const distance = calculateDistance(newLine.firstPointCoords, { lat, long: lon });
            newLine.distanceBetweenPoints = distance;
            drawLine({ ...newLine.firstPointCoords }, { lat: lat, long: lon });
          } else {
            newLine.firstPointCoords = { lat: lat, long: lon };
            newLine.secondPointCoords = { lat: null, long: null };
          }
          return newLine;
        });
        break;
      case menuOptions.angle:
      case menuOptions.freeDraw:
        break;
    }
  };
  const handleInputChange = (e: any) => {
    const { id, value } = e.target;
    const floatValue = parseFloat(value);
    setLine((prevState) => {
      const newLine = { ...prevState };
      if (id === 'first-lat') {
        newLine.firstPointCoords.lat = floatValue;
      } else if (id === 'first-long') {
        newLine.firstPointCoords.long = floatValue;
      } else if (id === 'second-lat') {
        newLine.secondPointCoords.lat = floatValue;
      } else if (id === 'second-long') {
        newLine.secondPointCoords.long = floatValue;
      }

      if (newLine.firstPointCoords.lat !== null && newLine.firstPointCoords.long !== null &&
        newLine.secondPointCoords.lat !== null && newLine.secondPointCoords.long !== null) {
        newLine.distanceBetweenPoints = calculateDistance(newLine.firstPointCoords, newLine.secondPointCoords);
        drawLine(newLine.firstPointCoords, newLine.secondPointCoords);
      } else {
        newLine.distanceBetweenPoints = null;
        vectorSourceRef.current.clear();
      }

      return newLine;
    });
  }

  return (
    <div className="App">
      <div className="Menu">
        <h2>Line Information:</h2>
        <div>
          <p>Starting Point</p>
          <label>
            Latitude:
            <input value={mapLine.firstPointCoords.lat || ''} type='number' id='first-lat' onChange={handleInputChange} />
          </label>
          <label>
            Longitude:
            <input value={mapLine.firstPointCoords.long || ''} type='number' id='first-long' onChange={handleInputChange} />
          </label>
        </div>

        <div>
          <p>Ending Point</p>
          <label>
            Latitude:
            <input value={mapLine.secondPointCoords.lat || ''} type='number' id='second-lat' onChange={handleInputChange} />
          </label>
          <label>
            Longitude:
            <input value={mapLine.secondPointCoords.long || ''} type='number' id='second-long' onChange={handleInputChange} />
          </label>
        </div>

        <p>Distance: {(mapLine.distanceBetweenPoints ? (mapLine.distanceBetweenPoints / 1000).toFixed(2) : "N/A")} km</p>
      </div>

      <div className="Map" ref={mapElement}></div>
    </div>
  );
}

export default App;